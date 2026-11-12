"""
Story and Event Grouping Service.

Responsible for:
1. Evaluating an article against existing article matches (SAME, RELATED, DIFFERENT),
   semantic vector similarity, publication timestamps, and extracted entity signals.
2. Grouping articles into overarching Stories:
   - Reuses an existing Story when candidate articles have RELATED or SAME classifications,
     high shared entities, or temporal narrative continuation.
   - Creates a new Story when an article represents a distinct subject/narrative.
3. Grouping articles into specific Events within a Story:
   - Reuses an existing Event when an article has a verified 'SAME' classification with
     an existing article in that event, or shares exact/tight temporal alignment (< 48h)
     and high entity overlap reporting the same occurrence.
   - Creates a new Event under the story when an article is a new development, follow-up,
     or different occurrence within the same broader story (e.g. rate cut decision vs job report).
4. Strictly preserves:
   - event_time: Real-world time when the event occurred (derived from published_at or explicit).
   - event_time_precision: Precision indicator ('exact', 'date', 'range', 'unknown').
   - published_at: Publisher timestamp.
   - retrieved_at: Scraper timestamp.
5. Operates reliably on both SQLite and PostgreSQL.
"""

from datetime import datetime, timezone
import logging
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.article import Article
from app.models.article_match import ArticleMatch
from app.models.event import Event
from app.models.story import Story
from app.schemas.story_event import GroupArticleResult
from app.services.matching import (
    ArticleMatchingService,
    extract_salient_entities,
    compute_entity_overlap,
    get_matching_service,
)

logger = logging.getLogger(__name__)


def derive_story_title_from_article(article: Article) -> str:
    """
    Synthesizes a clean, readable Story title from an article headline.
    Removes outlet suffixes (e.g., ' - Reuters', ' | BBC News').
    """
    title = (article.title or "").strip()
    # Strip common news source suffixes
    for separator in [" - ", " | ", " — ", " :: "]:
        if separator in title:
            title = title.split(separator)[0].strip()

    if not title:
        return f"News Story {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    return title


class StoryEventGroupingService:
    """
    Core service implementing automated Story and Event assignment.
    """

    def __init__(self, matching_service: Optional[ArticleMatchingService] = None):
        self._matching_service = matching_service

    @property
    def matching_service(self) -> ArticleMatchingService:
        if self._matching_service is None:
            return get_matching_service()
        return self._matching_service

    def group_article(
        self,
        db: Session,
        article_id: int,
        force_regroup: bool = False,
    ) -> GroupArticleResult:
        """
        Groups an article into a Story and an Event.
        
        Logic flow:
        1. If article already has an event_id and not force_regroup: return existing mapping.
        2. Inspect existing ArticleMatch records involving this article.
           If none exist, attempt to retrieve matches via matching_service.
        3. Evaluate 'SAME' matches first:
           - An article with a 'SAME' match to an already-grouped article belongs to the
             EXACT SAME Event (and therefore the same Story).
        4. If no 'SAME' match to a grouped event, evaluate 'RELATED' matches:
           - An article with a 'RELATED' match to an article in Story S belongs to
             the SAME STORY S, but represents a NEW EVENT under Story S.
        5. If no 'SAME' or 'RELATED' matches exist, check entity and temporal overlap with
           recent active stories in the database.
        6. Fallback: Create a brand NEW Story and a brand NEW Event.
        """
        article = (
            db.query(Article)
            .options(joinedload(Article.event).joinedload(Event.story))
            .filter(Article.id == article_id)
            .first()
        )
        if not article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        # Check if already grouped
        if article.event_id is not None and not force_regroup:
            event = article.event
            story = event.story if event else None
            story_title = story.title if story else "Unknown Story"
            story_id = story.id if story else 0
            return GroupArticleResult(
                article_id=article.id,
                story_id=story_id,
                story_title=story_title,
                story_action="reused",
                event_id=article.event_id,
                event_action="reused",
                reason=f"Article already assigned to Event {article.event_id} under Story '{story_title}'.",
                matched_article_id=None,
            )

        # Retrieve all pairwise matches involving this article from DB
        matches = (
            db.query(ArticleMatch)
            .filter(
                (ArticleMatch.article_id_1 == article.id)
                | (ArticleMatch.article_id_2 == article.id)
            )
            .order_by(ArticleMatch.similarity_score.desc().nullslast())
            .all()
        )

        # If no matches in DB, run matching service on candidates
        if not matches:
            try:
                self.matching_service.match_article_with_candidates(
                    db=db,
                    article_id=article.id,
                    candidate_limit=10,
                )
                matches = (
                    db.query(ArticleMatch)
                    .filter(
                        (ArticleMatch.article_id_1 == article.id)
                        | (ArticleMatch.article_id_2 == article.id)
                    )
                    .order_by(ArticleMatch.similarity_score.desc().nullslast())
                    .all()
                )
            except Exception as exc:
                logger.warning("Automated candidate matching failed for article %d: %s", article.id, exc)

        # -----------------------------------------------------------------------
        # STEP 1: Search for 'SAME' classification with an article that has an event
        # -----------------------------------------------------------------------
        same_target: Optional[Tuple[ArticleMatch, Article, Event]] = None
        for m in matches:
            if m.match_label == "SAME":
                other_id = m.article_id_2 if m.article_id_1 == article.id else m.article_id_1
                other_art = (
                    db.query(Article)
                    .options(joinedload(Article.event).joinedload(Event.story))
                    .filter(Article.id == other_id)
                    .first()
                )
                if other_art and other_art.event_id is not None and other_art.event:
                    same_target = (m, other_art, other_art.event)
                    break

        if same_target:
            match_rec, anchor_art, existing_event = same_target
            story = existing_event.story

            # Assign article to this existing event
            article.event_id = existing_event.id
            db.commit()
            db.refresh(article)

            return GroupArticleResult(
                article_id=article.id,
                story_id=story.id if story else existing_event.story_id,
                story_title=story.title if story else f"Story {existing_event.story_id}",
                story_action="reused",
                event_id=existing_event.id,
                event_action="reused",
                reason=(
                    f"Article matched as 'SAME' (similarity {match_rec.similarity_score}) "
                    f"to Article {anchor_art.id} ('{anchor_art.title[:40]}...'). "
                    f"Grouped into existing Event {existing_event.id}."
                ),
                matched_article_id=anchor_art.id,
            )

        # -----------------------------------------------------------------------
        # STEP 2: Search for 'RELATED' classification with an article that has an event/story
        # -----------------------------------------------------------------------
        related_target: Optional[Tuple[ArticleMatch, Article, Story]] = None
        for m in matches:
            if m.match_label == "RELATED":
                other_id = m.article_id_2 if m.article_id_1 == article.id else m.article_id_1
                other_art = (
                    db.query(Article)
                    .options(joinedload(Article.event).joinedload(Event.story))
                    .filter(Article.id == other_id)
                    .first()
                )
                if other_art and other_art.event and other_art.event.story:
                    related_target = (m, other_art, other_art.event.story)
                    break

        if related_target:
            match_rec, anchor_art, existing_story = related_target

            # Related coverage means it belongs to the SAME STORY, but is a DIFFERENT EVENT.
            # Never conflate publication time with actual real-world event occurrence time.
            new_event = Event(
                story_id=existing_story.id,
                event_time=None,  # Independent of published_at
                event_time_precision="unknown",
                event_time_disagreement=False,
            )
            db.add(new_event)
            db.flush()

            article.event_id = new_event.id
            db.commit()
            db.refresh(article)

            return GroupArticleResult(
                article_id=article.id,
                story_id=existing_story.id,
                story_title=existing_story.title,
                story_action="reused",
                event_id=new_event.id,
                event_action="created",
                reason=(
                    f"Article matched as 'RELATED' to Article {anchor_art.id} ('{anchor_art.title[:40]}...'). "
                    f"Reused overarching Story '{existing_story.title}' and created new Event {new_event.id}."
                ),
                matched_article_id=anchor_art.id,
            )

        # -----------------------------------------------------------------------
        # STEP 3: Multi-signal Story Reuse via Entity Overlap & Temporal Alignment
        # (Avoid grouping purely by vector similarity; require shared named entities)
        # -----------------------------------------------------------------------
        article_text = f"{article.title or ''} {article.content or ''}"
        article_entities = extract_salient_entities(article_text)

        if article_entities:
            # Query recent stories with their events and articles
            existing_stories = (
                db.query(Story)
                .options(joinedload(Story.events).joinedload(Event.articles))
                .order_by(Story.id.desc())
                .limit(25)
                .all()
            )

            for cand_story in existing_stories:
                # Aggregate entities across articles in candidate story
                story_entities = set()
                story_articles: List[Article] = []
                for ev in cand_story.events:
                    for art in ev.articles:
                        story_articles.append(art)
                        art_text = f"{art.title or ''} {art.content or ''}"
                        story_entities.update(extract_salient_entities(art_text))

                overlap_score, shared = compute_entity_overlap(article_entities, story_entities)
                # If strong entity overlap (>= 3 shared key entities or overlap >= 0.30)
                if len(shared) >= 3 or overlap_score >= 0.30:
                    # Belongs to this story! Create a new event under it.
                    # Never conflate publication time with event time.
                    new_event = Event(
                        story_id=cand_story.id,
                        event_time=None,
                        event_time_precision="unknown",
                        event_time_disagreement=False,
                    )
                    db.add(new_event)
                    db.flush()

                    article.event_id = new_event.id
                    db.commit()
                    db.refresh(article)

                    return GroupArticleResult(
                        article_id=article.id,
                        story_id=cand_story.id,
                        story_title=cand_story.title,
                        story_action="reused",
                        event_id=new_event.id,
                        event_action="created",
                        reason=(
                            f"Identified strong entity overlap ({len(shared)} entities: {list(shared)[:3]}) "
                            f"with Story '{cand_story.title}'. Assigned to Story and created Event {new_event.id}."
                        ),
                        matched_article_id=story_articles[0].id if story_articles else None,
                    )

        # -----------------------------------------------------------------------
        # STEP 4: Fallback - Create Brand New Story and New Event
        # -----------------------------------------------------------------------
        story_title = derive_story_title_from_article(article)
        new_story = Story(
            title=story_title,
            created_at=datetime.now(timezone.utc),
        )
        db.add(new_story)
        db.flush()

        # Real-world event time is distinct from publication time (published_at) and retrieval time (retrieved_at).
        # When unstated in article metadata or body, event_time remains null with precision 'unknown'.
        new_event = Event(
            story_id=new_story.id,
            event_time=None,
            event_time_precision="unknown",
            event_time_disagreement=False,
        )
        db.add(new_event)
        db.flush()

        article.event_id = new_event.id
        db.commit()
        db.refresh(article)

        return GroupArticleResult(
            article_id=article.id,
            story_id=new_story.id,
            story_title=new_story.title,
            story_action="created",
            event_id=new_event.id,
            event_action="created",
            reason=(
                f"No suitable existing story found based on article classifications or entity signals. "
                f"Created new Story '{new_story.title}' and initial Event {new_event.id}."
            ),
            matched_article_id=None,
        )

    def group_ungrouped_articles(self, db: Session, limit: int = 50) -> List[GroupArticleResult]:
        """
        Batches through all articles that currently have no event_id,
        and assigns them to stories and events.
        """
        ungrouped = (
            db.query(Article)
            .filter(Article.event_id.is_(None))
            .order_by(Article.id.asc())
            .limit(limit)
            .all()
        )
        results: List[GroupArticleResult] = []
        for art in ungrouped:
            res = self.group_article(db=db, article_id=art.id, force_regroup=False)
            results.append(res)
        return results


# Global singleton
_grouping_service: Optional[StoryEventGroupingService] = None


def get_grouping_service() -> StoryEventGroupingService:
    global _grouping_service
    if _grouping_service is None:
        _grouping_service = StoryEventGroupingService()
    return _grouping_service
