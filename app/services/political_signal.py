"""
Political and Party-Leaning Signal Analysis Service.

Responsible for:
1. Identifying political entities (political parties, politicians, government/advocacy organizations)
   and reusing/creating canonical ENTITY records.
2. Linking entities to ARTICLE_ANALYSIS via ANALYSIS_ENTITY with targeted sentiment and role.
3. Detecting evidence-based political presentation signals (favorable, unfavorable, neutral treatment).
4. Evaluating article-level ideological slant (-1.0 to +1.0) and partisanship scores (0.0 to 1.0).
5. Persisting results in ARTICLE_ANALYSIS (bias_score, bias_label) and COMPARISON_POLITICAL_SIGNAL
   for comparative cross-outlet evaluation.
6. Guarding against false assumptions:
   - Does not assume mentioning a party indicates ideological bias.
   - Treats predictions strictly as empirical analytical estimates.
   - Grounds every detected signal in verbatim article evidence.
"""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.analysis_entity import AnalysisEntity
from app.models.article import Article
from app.models.article_analysis import ArticleAnalysis
from app.models.comparison_article import ComparisonArticle
from app.models.comparison_political_signal import ComparisonPoliticalSignal
from app.models.entity import Entity
from app.models.news_comparison import NewsComparison
from app.schemas.political_signal import (
    ArticlePoliticalSignalResponse,
    ComparisonPoliticalCoverageResponse,
    ComparisonPoliticalSignalResponse,
    PoliticalEntityResponse,
    PoliticalPresentationSignal,
)
from app.services.content_extraction import (
    HONORIFICS,
    split_sentences,
)
from app.services.tone_framing import ToneAndFramingAnalyzer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Political Knowledge Bases & Catalogs
# ---------------------------------------------------------------------------

# Major political parties and their typical orientation coordinates
# (Used strictly as reference mapping for recognized party entities)
KNOWN_PARTIES: Dict[str, Dict[str, Any]] = {
    # US
    "democratic party": {"canonical": "Democratic Party", "acronym": "Democrats", "orientation": -0.4, "country": "US"},
    "democrats": {"canonical": "Democratic Party", "acronym": "Democrats", "orientation": -0.4, "country": "US"},
    "democratic": {"canonical": "Democratic Party", "acronym": "Democrats", "orientation": -0.4, "country": "US"},
    "republican party": {"canonical": "Republican Party", "acronym": "GOP", "orientation": 0.4, "country": "US"},
    "republicans": {"canonical": "Republican Party", "acronym": "GOP", "orientation": 0.4, "country": "US"},
    "republican": {"canonical": "Republican Party", "acronym": "GOP", "orientation": 0.4, "country": "US"},
    "gop": {"canonical": "Republican Party", "acronym": "GOP", "orientation": 0.4, "country": "US"},
    "green party": {"canonical": "Green Party", "acronym": "Greens", "orientation": -0.6, "country": "Global"},
    "libertarian party": {"canonical": "Libertarian Party", "acronym": "Libertarians", "orientation": 0.5, "country": "US"},

    # UK
    "labour party": {"canonical": "Labour Party", "acronym": "Labour", "orientation": -0.35, "country": "UK"},
    "labour": {"canonical": "Labour Party", "acronym": "Labour", "orientation": -0.35, "country": "UK"},
    "conservative party": {"canonical": "Conservative Party", "acronym": "Tories", "orientation": 0.35, "country": "UK"},
    "conservatives": {"canonical": "Conservative Party", "acronym": "Tories", "orientation": 0.35, "country": "UK"},
    "tory": {"canonical": "Conservative Party", "acronym": "Tories", "orientation": 0.35, "country": "UK"},
    "tories": {"canonical": "Conservative Party", "acronym": "Tories", "orientation": 0.35, "country": "UK"},
    "liberal democrats": {"canonical": "Liberal Democrats", "acronym": "Lib Dems", "orientation": -0.15, "country": "UK"},
    "reform uk": {"canonical": "Reform UK", "acronym": "Reform", "orientation": 0.65, "country": "UK"},

    # International / Multi-party generic
    "social democratic party": {"canonical": "Social Democratic Party", "acronym": "SPD", "orientation": -0.3, "country": "Global"},
    "christian democratic union": {"canonical": "Christian Democratic Union", "acronym": "CDU", "orientation": 0.3, "country": "Global"},
}

# Prominent politicians and public officials
KNOWN_POLITICIANS: Dict[str, Dict[str, Any]] = {
    "joe biden": {"canonical": "Joe Biden", "party": "Democratic Party", "title": "President", "orientation": -0.35},
    "biden": {"canonical": "Joe Biden", "party": "Democratic Party", "title": "President", "orientation": -0.35},
    "donald trump": {"canonical": "Donald Trump", "party": "Republican Party", "title": "Former President", "orientation": 0.55},
    "trump": {"canonical": "Donald Trump", "party": "Republican Party", "title": "Former President", "orientation": 0.55},
    "kamala harris": {"canonical": "Kamala Harris", "party": "Democratic Party", "title": "Vice President", "orientation": -0.35},
    "harris": {"canonical": "Kamala Harris", "party": "Democratic Party", "title": "Vice President", "orientation": -0.35},
    "rishi sunak": {"canonical": "Rishi Sunak", "party": "Conservative Party", "title": "Prime Minister", "orientation": 0.35},
    "keir starmer": {"canonical": "Keir Starmer", "party": "Labour Party", "title": "Prime Minister", "orientation": -0.25},
    "starmer": {"canonical": "Keir Starmer", "party": "Labour Party", "title": "Prime Minister", "orientation": -0.25},
    "emmanuel macron": {"canonical": "Emmanuel Macron", "party": "Renaissance", "title": "President", "orientation": 0.05},
    "macron": {"canonical": "Emmanuel Macron", "party": "Renaissance", "title": "President", "orientation": 0.05},
    "justin trudeau": {"canonical": "Justin Trudeau", "party": "Liberal Party", "title": "Prime Minister", "orientation": -0.30},
    "trudeau": {"canonical": "Justin Trudeau", "party": "Liberal Party", "title": "Prime Minister", "orientation": -0.30},
    "olaf scholz": {"canonical": "Olaf Scholz", "party": "Social Democratic Party", "title": "Chancellor", "orientation": -0.25},
    "mitch mcconnell": {"canonical": "Mitch McConnell", "party": "Republican Party", "title": "Senator", "orientation": 0.45},
    "chuck schumer": {"canonical": "Chuck Schumer", "party": "Democratic Party", "title": "Senator", "orientation": -0.40},
    "mike johnson": {"canonical": "Mike Johnson", "party": "Republican Party", "title": "Speaker", "orientation": 0.50},
    "hakeem jeffries": {"canonical": "Hakeem Jeffries", "party": "Democratic Party", "title": "Representative", "orientation": -0.40},
}

# Political and governmental institutions / organizations
KNOWN_POLITICAL_ORGS: Dict[str, Dict[str, Any]] = {
    "congress": {"canonical": "United States Congress", "type": "GOVERNMENT", "country": "US"},
    "u.s. congress": {"canonical": "United States Congress", "type": "GOVERNMENT", "country": "US"},
    "senate": {"canonical": "United States Senate", "type": "GOVERNMENT", "country": "US"},
    "house of representatives": {"canonical": "House of Representatives", "type": "GOVERNMENT", "country": "US"},
    "parliament": {"canonical": "Parliament", "type": "GOVERNMENT", "country": "Global"},
    "supreme court": {"canonical": "Supreme Court", "type": "GOVERNMENT", "country": "Global"},
    "white house": {"canonical": "The White House", "type": "GOVERNMENT", "country": "US"},
    "10 downing street": {"canonical": "10 Downing Street", "type": "GOVERNMENT", "country": "UK"},
    "european parliament": {"canonical": "European Parliament", "type": "GOVERNMENT", "country": "EU"},
    "european commission": {"canonical": "European Commission", "type": "GOVERNMENT", "country": "EU"},
    "democratic national committee": {"canonical": "Democratic National Committee", "type": "POLITICAL_ORGANIZATION", "country": "US"},
    "dnc": {"canonical": "Democratic National Committee", "type": "POLITICAL_ORGANIZATION", "country": "US"},
    "republican national committee": {"canonical": "Republican National Committee", "type": "POLITICAL_ORGANIZATION", "country": "US"},
    "rnc": {"canonical": "Republican National Committee", "type": "POLITICAL_ORGANIZATION", "country": "US"},
}

# Political titles used to identify public representatives dynamically
POLITICAL_TITLES = {
    "president", "prime minister", "premier", "chancellor", "senator", "representative",
    "congressman", "congresswoman", "lawmaker", "mp", "governor", "mayor", "minister",
    "secretary of state", "attorney general", "speaker", "majority leader", "minority leader",
    "party leader", "candidate", "nominee", "deputy prime minister"
}

# Lexicons for detecting positive vs negative political framing cues
FAVORABLE_CUES = [
    (r"\b(praised|commended|applauded|championed|celebrated|historic achievement|strong leadership|visionary|triumphant|decisive action|landmark reform|bold plan)\b", "praise_achievement", 0.75),
    (r"\b(effective policy|broad support|widely hailed|masterful|diplomatic triumph|delivered on promise|resounding success)\b", "policy_success", 0.70),
    (r"\b(unifying|statesmanlike|principled stand|courageous|vindicated)\b", "principled_leadership", 0.65),
]

UNFAVORABLE_CUES = [
    (r"\b(slammed|blamed|condemned|denounced|criticized|under fire|rebuked|scandal-ridden|disastrous policy|catastrophic failure|flawed leadership)\b", "harsh_criticism", 0.80),
    (r"\b(backlash|outrage|embroiled in controversy|mismanagement|corruption allegations|reckless|ineffective|faltering|embattled)\b", "controversy_failure", 0.75),
    (r"\b(hypocrisy|broken promise|authoritarian|radical|extremist|corrupt|incompetent|weak)\b", "character_censure", 0.85),
]


class PoliticalSignalAnalyzer:
    """
    Core engine for identifying political entities and evaluating party-presentation signals.
    """

    def __init__(self):
        self.tone_analyzer = ToneAndFramingAnalyzer()

    def identify_political_entities(self, text: str, headline: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extracts political parties, politicians, and political organizations from text.
        Returns deduplicated entities with mention count and character location.
        """
        full_text = f"{headline or ''}\n{text or ''}"
        found: Dict[str, Dict[str, Any]] = {}

        # 1. Match known political parties
        for party_key, meta in KNOWN_PARTIES.items():
            pattern = re.compile(rf'\b{re.escape(party_key)}\b', re.IGNORECASE)
            matches = list(pattern.finditer(full_text))
            if matches:
                canonical = meta["canonical"]
                if canonical not in found or len(matches) > found[canonical]["mention_count"]:
                    found[canonical] = {
                        "name": canonical,
                        "entity_type": "ORGANIZATION",
                        "political_category": "POLITICAL_PARTY",
                        "ideological_affiliation": canonical,
                        "mention_count": len(matches),
                        "first_pos": matches[0].start(),
                        "orientation": meta.get("orientation", 0.0),
                    }

        # 2. Match known politicians
        for pol_key, meta in KNOWN_POLITICIANS.items():
            # For short last names like 'trump', 'biden', 'harris', make sure word boundaries match
            pattern = re.compile(rf'\b{re.escape(pol_key)}\b', re.IGNORECASE)
            matches = list(pattern.finditer(full_text))
            if matches:
                canonical = meta["canonical"]
                # If canonical already present with more full name, update count
                current = found.get(canonical)
                total_mentions = (current["mention_count"] if current else 0) + len(matches)
                found[canonical] = {
                    "name": canonical,
                    "entity_type": "PERSON",
                    "political_category": "POLITICIAN",
                    "ideological_affiliation": meta.get("party"),
                    "mention_count": total_mentions,
                    "first_pos": matches[0].start(),
                    "orientation": meta.get("orientation", 0.0),
                }

        # 3. Match known political organizations / governmental institutions
        for org_key, meta in KNOWN_POLITICAL_ORGS.items():
            pattern = re.compile(rf'\b{re.escape(org_key)}\b', re.IGNORECASE)
            matches = list(pattern.finditer(full_text))
            if matches:
                canonical = meta["canonical"]
                if canonical not in found:
                    found[canonical] = {
                        "name": canonical,
                        "entity_type": meta.get("type", "ORGANIZATION"),
                        "political_category": "POLITICAL_ORGANIZATION",
                        "ideological_affiliation": None,
                        "mention_count": len(matches),
                        "first_pos": matches[0].start(),
                        "orientation": 0.0,
                    }

        # 4. Contextual search for politicians using political titles
        title_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(t) for t in POLITICAL_TITLES) + r')\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b',
            re.IGNORECASE,
        )
        for match in title_pattern.finditer(full_text):
            title = match.group(1).title()
            name_raw = match.group(2).strip()
            name_words = name_raw.split()
            if len(name_words) >= 2:
                name_clean = " ".join(name_words[:2])
                if name_clean not in found:
                    found[name_clean] = {
                        "name": name_clean,
                        "entity_type": "PERSON",
                        "political_category": "POLITICIAN",
                        "ideological_affiliation": None,
                        "mention_count": 1,
                        "first_pos": match.start(),
                        "orientation": 0.0,
                        "title": title,
                    }

        return list(found.values())

    def analyze_political_presentation(
        self,
        text: str,
        entities: List[Dict[str, Any]],
        headline: Optional[str] = None,
    ) -> Tuple[List[PoliticalPresentationSignal], Dict[str, Any]]:
        """
        Scans article sentences mentioning political entities for favorable, unfavorable,
        or neutral presentation, extracting evidence text and offsets.

        Calculates overall article slant score (-1.0 to +1.0) and partisanship score (0.0 to 1.0).
        """
        signals: List[PoliticalPresentationSignal] = []
        sentences = split_sentences(text or "")

        # Also evaluate headline if provided
        all_units: List[Tuple[str, int, int]] = []
        if headline:
            all_units.append((headline, 0, len(headline)))
        all_units.extend(sentences)

        entity_scores: Dict[str, List[float]] = {e["name"]: [] for e in entities}

        for sent_str, start_c, end_c in all_units:
            # Check which entities are present in this sentence
            for ent in entities:
                ent_name = ent["name"]
                name_parts = ent_name.split()
                # Check either full name or prominent surname
                pattern = re.compile(
                    rf'\b({re.escape(ent_name)}|{re.escape(name_parts[-1])})\b',
                    re.IGNORECASE,
                )
                if pattern.search(sent_str):
                    # Check for favorable cues
                    favorable_match = None
                    for cue_regex, tech, strength in FAVORABLE_CUES:
                        m = re.search(cue_regex, sent_str, re.IGNORECASE)
                        if m:
                            favorable_match = (m.group(0), tech, strength)
                            break

                    # Check for unfavorable cues
                    unfavorable_match = None
                    for cue_regex, tech, strength in UNFAVORABLE_CUES:
                        m = re.search(cue_regex, sent_str, re.IGNORECASE)
                        if m:
                            unfavorable_match = (m.group(0), tech, strength)
                            break

                    # Deduce presentation
                    if favorable_match and not unfavorable_match:
                        treatment = "favorable"
                        tech = favorable_match[1]
                        intensity = favorable_match[2]
                        explanation = f"Entity '{ent_name}' presented favorably via cue '{favorable_match[0]}'."
                        entity_scores[ent_name].append(0.6)
                    elif unfavorable_match and not favorable_match:
                        treatment = "unfavorable"
                        tech = unfavorable_match[1]
                        intensity = unfavorable_match[2]
                        explanation = f"Entity '{ent_name}' presented unfavorably via cue '{unfavorable_match[0]}'."
                        entity_scores[ent_name].append(-0.6)
                    elif favorable_match and unfavorable_match:
                        treatment = "mixed"
                        tech = "balanced_conflict"
                        intensity = 0.5
                        explanation = f"Entity '{ent_name}' discussed with mixed favorable and critical cues."
                        entity_scores[ent_name].append(0.0)
                    else:
                        continue

                    # Adjust character boundaries if inside body text
                    raw_span = text[start_c:end_c] if start_c < len(text) else sent_str
                    lstrip_offset = len(raw_span) - len(raw_span.lstrip())
                    actual_start = start_c + lstrip_offset
                    actual_end = actual_start + len(sent_str)

                    signals.append(
                        PoliticalPresentationSignal(
                            entity_name=ent_name,
                            political_category=ent["political_category"],
                            treatment=treatment,
                            framing_technique=tech,
                            intensity_score=intensity,
                            confidence_score=0.82,
                            evidence_text=sent_str,
                            start_char=actual_start,
                            end_char=actual_end,
                            explanation=explanation,
                        )
                    )

        # -------------------------------------------------------------------
        # Compute Aggregate Slant and Partisanship
        # -------------------------------------------------------------------
        slant_contributions: List[float] = []
        for ent in entities:
            name = ent["name"]
            base_orientation = ent.get("orientation", 0.0)
            scores = entity_scores.get(name, [])
            avg_treatment = sum(scores) / len(scores) if scores else 0.0

            # If an outlet praises a left entity (+treatment * -orientation = negative slant)
            # or criticizes a right entity (-treatment * +orientation = negative slant)
            if base_orientation != 0.0 and avg_treatment != 0.0:
                slant_contributions.append(base_orientation * avg_treatment)

        if slant_contributions:
            computed_slant = sum(slant_contributions) / len(slant_contributions)
        else:
            computed_slant = 0.0

        # Bound slant to [-1.0, +1.0]
        slant_score = round(max(-1.0, min(1.0, computed_slant)), 2)

        # Partisanship score derived from intensity of treatment and signal frequency
        if signals:
            avg_intensity = sum(s.intensity_score for s in signals) / len(signals)
            partisanship_score = round(min(1.0, 0.25 + 0.15 * len(signals) + 0.3 * avg_intensity), 2)
        else:
            partisanship_score = 0.05

        # Determine ideological classification
        if slant_score <= -0.45:
            leaning_label = "left"
        elif slant_score <= -0.15:
            leaning_label = "center-left"
        elif slant_score >= 0.45:
            leaning_label = "right"
        elif slant_score >= 0.15:
            leaning_label = "center-right"
        else:
            leaning_label = "center"

        # Signal summary narrative
        if not signals:
            description = "Factual descriptive reporting with neutral presentation of political entities."
        else:
            fav_count = sum(1 for s in signals if s.treatment == "favorable")
            unfav_count = sum(1 for s in signals if s.treatment == "unfavorable")
            description = (
                f"Identified {len(signals)} political presentation cues across "
                f"{len(entities)} political entities ({fav_count} favorable, {unfav_count} unfavorable). "
                f"Coverage exhibits an estimated '{leaning_label}' ideological orientation."
            )

        metrics = {
            "slant_score": slant_score,
            "partisanship_score": partisanship_score,
            "political_leaning": leaning_label,
            "confidence_score": 0.85 if signals else 0.90,
            "signal_description": description,
            "entity_scores": entity_scores,
        }

        return signals, metrics


class PoliticalSignalService:
    """
    High-level business service for analyzing, persisting, and retrieving political signals.
    """

    def __init__(self):
        self.analyzer = PoliticalSignalAnalyzer()

    def get_or_create_entity(
        self,
        db: Session,
        name: str,
        entity_type: str,
        description: Optional[str] = None,
    ) -> Entity:
        """
        Reuses existing canonical ENTITY record by name or inserts a new one.
        """
        entity = db.query(Entity).filter(Entity.name == name).first()
        if not entity:
            entity = Entity(
                name=name,
                entity_type=entity_type,
                description=description or f"Canonical {entity_type.lower()} entity: {name}",
                created_at=datetime.now(timezone.utc),
            )
            db.add(entity)
            db.flush()
        return entity

    def analyze_and_store_article_political_signals(
        self,
        db: Session,
        article_id: int,
        force_reanalyze: bool = False,
        comparison_id: Optional[int] = None,
    ) -> ArticlePoliticalSignalResponse:
        """
        Analyzes an article for political entities and leaning signals.
        Stores/updates ARTICLE_ANALYSIS (bias_score, bias_label), ENTITY, ANALYSIS_ENTITY,
        and COMPARISON_POLITICAL_SIGNAL if comparison_id is provided.
        """
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        # Check existing ArticleAnalysis
        analysis = (
            db.query(ArticleAnalysis)
            .filter(ArticleAnalysis.article_id == article.id)
            .order_by(ArticleAnalysis.id.desc())
            .first()
        )

        headline_text = article.title or ""
        body_text = article.content or ""

        # 1. Identify political entities
        raw_entities = self.analyzer.identify_political_entities(text=body_text, headline=headline_text)

        # 2. Extract presentation signals
        signals, metrics = self.analyzer.analyze_political_presentation(
            text=body_text,
            entities=raw_entities,
            headline=headline_text,
        )

        # 3. Ensure canonical ENTITY and ANALYSIS_ENTITY exist
        political_entity_responses: List[PoliticalEntityResponse] = []

        if not analysis:
            analysis = ArticleAnalysis(
                article_id=article.id,
                pipeline_version="political-analysis-v1.0",
                status="completed",
                bias_score=metrics["slant_score"],
                bias_label=metrics["political_leaning"],
                sentiment_score=0.0,
                sentiment_label="neutral",
                confidence_score=metrics["confidence_score"],
                summary=metrics["signal_description"],
                created_at=datetime.now(timezone.utc),
            )
            db.add(analysis)
            db.flush()
        else:
            # Update bias fields in existing analysis
            analysis.bias_score = metrics["slant_score"]
            analysis.bias_label = metrics["political_leaning"]
            if metrics["confidence_score"] is not None:
                if analysis.confidence_score is not None:
                    analysis.confidence_score = round((analysis.confidence_score + metrics["confidence_score"]) / 2.0, 2)
                else:
                    analysis.confidence_score = round(metrics["confidence_score"], 2)
            db.flush()

        # Connect entities to analysis
        for rent in raw_entities:
            entity_rec = self.get_or_create_entity(
                db=db,
                name=rent["name"],
                entity_type=rent["entity_type"],
                description=rent.get("ideological_affiliation"),
            )

            # Link via AnalysisEntity
            scores = metrics["entity_scores"].get(rent["name"], [])
            avg_sent = round(sum(scores) / len(scores), 2) if scores else 0.0

            if avg_sent > 0.2:
                pres = "favorable"
            elif avg_sent < -0.2:
                pres = "unfavorable"
            elif scores:
                pres = "mixed"
            else:
                pres = "neutral"

            analysis_entity = (
                db.query(AnalysisEntity)
                .filter(
                    AnalysisEntity.analysis_id == analysis.id,
                    AnalysisEntity.entity_id == entity_rec.id,
                )
                .first()
            )

            if not analysis_entity:
                analysis_entity = AnalysisEntity(
                    analysis_id=analysis.id,
                    entity_id=entity_rec.id,
                    mention_count=rent["mention_count"],
                    sentiment_score=avg_sent,
                    salience_score=min(1.0, 0.4 + 0.1 * rent["mention_count"]),
                    role="political_subject",
                    created_at=datetime.now(timezone.utc),
                )
                db.add(analysis_entity)
                db.flush()
            else:
                analysis_entity.mention_count = rent["mention_count"]
                analysis_entity.sentiment_score = avg_sent

            # Fill in entity_id in signals
            for s in signals:
                if s.entity_name == rent["name"]:
                    s.entity_id = entity_rec.id

            political_entity_responses.append(
                PoliticalEntityResponse(
                    id=entity_rec.id,
                    name=entity_rec.name,
                    entity_type=entity_rec.entity_type,
                    political_category=rent["political_category"],
                    ideological_affiliation=rent.get("ideological_affiliation"),
                    mention_count=rent["mention_count"],
                    salience_score=min(1.0, 0.4 + 0.1 * rent["mention_count"]),
                    sentiment_score=avg_sent,
                    presentation=pres,
                )
            )

        # 4. If comparison_id is provided, persist into COMPARISON_POLITICAL_SIGNAL
        if comparison_id:
            self._link_comparison_political_signal(
                db=db,
                comparison_id=comparison_id,
                article_id=article.id,
                political_leaning=metrics["political_leaning"],
                slant_score=metrics["slant_score"],
                partisanship_score=metrics["partisanship_score"],
                signal_description=metrics["signal_description"],
            )

        db.commit()

        return ArticlePoliticalSignalResponse(
            article_id=article.id,
            headline=headline_text,
            political_leaning=metrics["political_leaning"],
            slant_score=metrics["slant_score"],
            partisanship_score=metrics["partisanship_score"],
            confidence_score=metrics["confidence_score"],
            signal_description=metrics["signal_description"],
            political_entities=political_entity_responses,
            signals=signals,
            analyzed_at=datetime.now(timezone.utc),
        )

    def _link_comparison_political_signal(
        self,
        db: Session,
        comparison_id: int,
        article_id: int,
        political_leaning: str,
        slant_score: float,
        partisanship_score: float,
        signal_description: str,
    ) -> ComparisonPoliticalSignal:
        """
        Creates or updates a COMPARISON_POLITICAL_SIGNAL entry, verifying
        the composite foreign key requirements of comparison_articles.
        """
        # Ensure ComparisonArticle link exists
        comp_art = (
            db.query(ComparisonArticle)
            .filter(
                ComparisonArticle.comparison_id == comparison_id,
                ComparisonArticle.article_id == article_id,
            )
            .first()
        )
        if not comp_art:
            comp_art = ComparisonArticle(
                comparison_id=comparison_id,
                article_id=article_id,
                created_at=datetime.now(timezone.utc),
            )
            db.add(comp_art)
            db.flush()

        comp_sig = (
            db.query(ComparisonPoliticalSignal)
            .filter(
                ComparisonPoliticalSignal.comparison_id == comparison_id,
                ComparisonPoliticalSignal.article_id == article_id,
            )
            .first()
        )

        if not comp_sig:
            comp_sig = ComparisonPoliticalSignal(
                comparison_id=comparison_id,
                article_id=article_id,
                political_leaning=political_leaning,
                slant_score=slant_score,
                partisanship_score=partisanship_score,
                signal_description=signal_description,
                created_at=datetime.now(timezone.utc),
            )
            db.add(comp_sig)
            db.flush()
        else:
            comp_sig.political_leaning = political_leaning
            comp_sig.slant_score = slant_score
            comp_sig.partisanship_score = partisanship_score
            comp_sig.signal_description = signal_description

        return comp_sig

    def get_comparison_political_coverage(
        self,
        db: Session,
        comparison_id: int,
    ) -> ComparisonPoliticalCoverageResponse:
        """
        Retrieves all political signals within a NewsComparison session,
        synthesizing cross-outlet coverage patterns.
        """
        comparison = db.query(NewsComparison).filter(NewsComparison.id == comparison_id).first()
        if not comparison:
            raise ValueError(f"News comparison with ID {comparison_id} not found.")

        # Fetch all comparison articles
        comp_articles = (
            db.query(ComparisonArticle)
            .options(joinedload(ComparisonArticle.article))
            .filter(ComparisonArticle.comparison_id == comparison_id)
            .all()
        )

        if not comp_articles:
            return ComparisonPoliticalCoverageResponse(
                comparison_id=comparison.id,
                comparison_title=comparison.title,
                status=comparison.status,
                event_id=comparison.event_id,
                article_count=0,
                signals=[],
                diversity_summary="No articles associated with this comparison.",
            )

        signal_responses: List[ComparisonPoliticalSignalResponse] = []
        leanings_found: List[str] = []

        for ca in comp_articles:
            art = ca.article
            if not art:
                continue

            # Fetch or generate signal
            sig_row = (
                db.query(ComparisonPoliticalSignal)
                .filter(
                    ComparisonPoliticalSignal.comparison_id == comparison_id,
                    ComparisonPoliticalSignal.article_id == art.id,
                )
                .first()
            )

            # If not yet analyzed for political signals, analyze now
            if not sig_row:
                analysis_res = self.analyze_and_store_article_political_signals(
                    db=db,
                    article_id=art.id,
                    comparison_id=comparison_id,
                )
                sig_row = (
                    db.query(ComparisonPoliticalSignal)
                    .filter(
                        ComparisonPoliticalSignal.comparison_id == comparison_id,
                        ComparisonPoliticalSignal.article_id == art.id,
                    )
                    .first()
                )
                evidence_signals = analysis_res.signals
            else:
                # Reconstruct evidence signals from content
                raw_entities = self.analyzer.identify_political_entities(text=art.content or "", headline=art.title or "")
                evidence_signals, _ = self.analyzer.analyze_political_presentation(
                    text=art.content or "",
                    entities=raw_entities,
                    headline=art.title or "",
                )

            source_name = art.source.name if art.source else "Unknown Outlet"
            leanings_found.append(sig_row.political_leaning)

            signal_responses.append(
                ComparisonPoliticalSignalResponse(
                    id=sig_row.id,
                    comparison_id=sig_row.comparison_id,
                    article_id=sig_row.article_id,
                    political_leaning=sig_row.political_leaning,
                    slant_score=sig_row.slant_score,
                    partisanship_score=sig_row.partisanship_score,
                    signal_description=sig_row.signal_description,
                    created_at=sig_row.created_at,
                    article_title=art.title,
                    source_name=source_name,
                    evidence_signals=evidence_signals,
                )
            )

        unique_leanings = set(leanings_found)
        if len(unique_leanings) > 1:
            div_summary = (
                f"Comparison demonstrates ideological diversity across {len(signal_responses)} outlets, "
                f"ranging across: {', '.join(sorted(unique_leanings))}."
            )
        elif len(unique_leanings) == 1:
            div_summary = (
                f"All {len(signal_responses)} analyzed outlets exhibit consistent "
                f"'{list(unique_leanings)[0]}' presentation."
            )
        else:
            div_summary = "Neutral factual consensus observed across reporting outlets."

        return ComparisonPoliticalCoverageResponse(
            comparison_id=comparison.id,
            comparison_title=comparison.title,
            status=comparison.status,
            event_id=comparison.event_id,
            article_count=len(signal_responses),
            signals=signal_responses,
            diversity_summary=div_summary,
        )


# Global singleton
_political_signal_service: Optional[PoliticalSignalService] = None


def get_political_signal_service() -> PoliticalSignalService:
    global _political_signal_service
    if _political_signal_service is None:
        _political_signal_service = PoliticalSignalService()
    return _political_signal_service
