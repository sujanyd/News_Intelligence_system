"""
Tone and Framing Analysis Service.

Responsible for:
1. Article Tone Analysis:
   - Evaluates emotional valence and journalistic tone across supported categories:
     'neutral', 'positive', 'negative', 'critical', 'alarming', 'optimistic', 'contentious'.
   - Computes continuous tone score (-1.0 to +1.0) and confidence.
   - Distinctly separates tone (emotional valence) from political bias or framing techniques.
   - Updates `sentiment_score`, `sentiment_label`, and `confidence_score` in `ARTICLE_ANALYSIS`.
2. Headline Framing Analysis:
   - Evaluates how the headline positions the event before the reader opens the article.
   - Categorizes techniques:
     - 'emotional_language': sensationalized adjectives, shock value, evocative phrasing.
     - 'conflict_emphasis': battle/clash metaphors, confrontation, showdown framing.
     - 'blame_attribution': finger-pointing, fault assignment, scapegoating.
     - 'urgency': crisis framing, panic, ticking-clock language, immediate threat.
     - 'economic_consequence': cost burdens, financial stakes, market shocks.
     - 'achievement_progress': breakthrough, victory, landmark milestones.
     - 'neutral_reporting': balanced, objective, descriptive reporting without loaded rhetoric.
3. Article-Level Framing Signal Extraction:
   - Discovers rhetorical devices and thematic frames across sentences.
   - Preserves exact verbatim supporting evidence (`evidence_text`), character boundaries (`start_char`, `end_char`),
     intensity scores (0.0 to 1.0), and explanatory rationales.
   - Persists signals in `ANALYSIS_FRAMING_SIGNAL`.
4. Analysis Connection:
   - Reliably links all signals to the article's `ARTICLE_ANALYSIS` record.
   - Reuses existing completed analyses unless `force_reanalyze=True`.
"""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.analysis_framing_signal import AnalysisFramingSignal
from app.models.article import Article
from app.models.article_analysis import ArticleAnalysis
from app.schemas.tone_framing import (
    ArticleToneResponse,
    HeadlineFramingResponse,
    HeadlineFramingType,
    ToneAndFramingAnalysisResponse,
    ToneCategory,
)
from app.services.content_extraction import split_sentences

logger = logging.getLogger(__name__)

# Lexicons for Tone Analysis
POSITIVE_WORDS = {
    "consensus", "landmark", "historic", "agreement", "pact", "progress", "breakthrough",
    "breakthroughs", "growth", "rebound", "recovery", "stability", "resilient", "success",
    "successful", "optimistic", "booming", "strengthened", "achievement", "achievements",
    "support", "benefit", "benefits", "boost", "cooperation", "solution", "solutions",
    "triumph", "discovery", "innovative", "gain", "gains", "surpassed", "eased",
    "celebrated", "celebrate", "celebrating", "promising", "extraordinary", "outstanding"
}

NEGATIVE_WORDS = {
    "recession", "decline", "fall", "slump", "loss", "downturn", "struggle", "deficit",
    "unemployment", "layoffs", "turmoil", "poverty", "hardship", "damage", "crisis",
    "deterioration", "slowdown", "weakness", "failing", "stagnation", "trouble"
}

CRITICAL_WORDS = {
    "criticized", "condemned", "slammed", "blamed", "flawed", "accused", "alleged",
    "failed", "misleading", "ineffective", "shortcoming", "reprehensible", "incompetence",
    "scrutiny", "controversial", "scandal", "fault", "dispute", "questioned", "rebuked"
}

ALARMING_WORDS = {
    "catastrophe", "disaster", "collapse", "devastating", "dire", "apocalyptic", "panic",
    "emergency", "spiral", "terrifying", "deadly", "peril", "unprecedented crisis",
    "brink", "catastrophic", "chaos", "looming threat", "nightmare", "danger"
}

# Lexicons and Patterns for Framing Techniques

# 1. Conflict Framing (battles, clashes, showdowns)
CONFLICT_PATTERNS = [
    (r"\b(clash|clashes|clashing|battle|battles|feud|showdown|standoff|war of words|spar|sparring|confrontation|face-off|versus|vs\.?)\b", "conflict_emphasis"),
    (r"\b(splits|divided|bitter fight|hostile|antagonism|opponents clash|at odds|collision|slam|slams|slammed|slamming|attack|attacks|attacked)\b", "conflict_emphasis"),
]

# 2. Urgency / Crisis Framing
URGENCY_PATTERNS = [
    (r"\b(time running out|last chance|urgent|urgently|ticking clock|code red|crisis point|brink of|deadline looms|emergency|immediate action|act immediately|act fast|without delay|crisis|severe crisis)\b", "urgency"),
    (r"\b(perilously close|run out of time|rapidly worsening|countdown|threatens to derail|must act)\b", "urgency"),
]

# 3. Blame Attribution Framing
BLAME_PATTERNS = [
    (r"\b(blame|blames|blamed|blaming|holds responsible|fault lies with|scapegoat|finger-pointing|accuses|accused of|points finger|culprit)\b", "blame_attribution"),
    (r"\b(held accountable|at fault|fallout over|culpable|under fire for|condemn|condemned|condemning|denounce|denounced)\b", "blame_attribution"),
]

# 4. Emotional / Sensational Language
EMOTIONAL_PATTERNS = [
    (r"\b(bombshell|shocking|stunning|jaw-dropping|furious|outrage|nightmare|horrific|explosive|mind-blowing|chaos ensues|unbelievable)\b", "emotional_language"),
    (r"\b(devastated|devastating|heartbreaking|ignites fury|firestorm|sensational|hysteria|catastrophe|disaster|disastrous)\b", "emotional_language"),
]

# 5. Economic Consequence Framing
ECONOMIC_PATTERNS = [
    (r"\b(cost burden|price tag|economic fallout|inflationary pressure|taxpayers pay|financial pain|costs soar|economic pain|trillion-dollar|rising costs|financial collapse|financial disaster|severe economic distress)\b", "economic_consequence"),
    (r"\b(household budgets|market turmoil|financial wreckage|wallet|cost of living|economic distress|economic crisis)\b", "economic_consequence"),
]

# 6. Cooperative Progress / Landmark Framing
PROGRESS_PATTERNS = [
    (r"\b(historic consensus|landmark agreement|pact signed|multilateral breakthrough|unprecedented cooperation|unite to|joint commitment)\b", "cooperative_progress"),
    (r"\b(common ground|step forward|watershed moment|global accord|pioneering)\b", "cooperative_progress"),
]

# 7. Security / Threat Framing
SECURITY_PATTERNS = [
    (r"\b(national security threat|defense readiness|foreign adversary|cyber attack|espionage|vulnerability exposed|existential danger)\b", "security_threat"),
]


class ToneAndFramingAnalyzer:
    """
    Core analysis engine for evaluating tone, headline framing, and narrative framing signals.
    """

    def analyze_tone(self, text: str, headline: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculates emotional valence and classifies the overall tone of the article.
        Returns:
            dict containing:
            - tone: 'neutral', 'positive', 'negative', 'critical', 'alarming', 'optimistic'
            - tone_score: float from -1.0 to +1.0
            - confidence: float from 0.0 to 1.0
            - subjectivity_score: float from 0.0 to 1.0
            - explanation: detailed justification
        """
        full_text = f"{headline or ''} {text or ''}".lower()
        words = re.findall(r'\b[a-z]{3,}\b', full_text)
        total_words = max(len(words), 1)

        pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
        neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
        crit_count = sum(1 for w in words if w in CRITICAL_WORDS)
        alarm_count = sum(1 for w in words if w in ALARMING_WORDS)

        # Detect high-intensity sub-categories first
        if alarm_count >= 2 or (alarm_count >= 1 and total_words < 50):
            tone = "alarming"
            valence = -0.75 - min(0.20, 0.05 * alarm_count)
            confidence = min(0.92, 0.70 + 0.06 * alarm_count)
            explanation = (
                f"Tone categorized as 'alarming' due to prominent crisis/danger vocabulary "
                f"({alarm_count} alarming occurrences)."
            )
        elif crit_count >= 2 or (crit_count >= 1 and total_words < 50):
            tone = "critical"
            valence = -0.55 - min(0.25, 0.04 * crit_count)
            confidence = min(0.90, 0.68 + 0.05 * crit_count)
            explanation = (
                f"Tone categorized as 'critical' characterized by evaluative censure and accountability claims "
                f"({crit_count} critical indicators)."
            )
        elif pos_count > neg_count and (pos_count - neg_count) >= 2:
            tone = "positive" if pos_count < 4 else "optimistic"
            valence = min(0.85, 0.20 + 0.12 * (pos_count - neg_count))
            confidence = min(0.90, 0.65 + 0.05 * (pos_count - neg_count))
            explanation = (
                f"Tone categorized as '{tone}' driven by constructive achievements and stabilization indicators "
                f"(positive count: {pos_count}, negative count: {neg_count})."
            )
        elif neg_count > pos_count and (neg_count - pos_count) >= 2:
            tone = "negative"
            valence = max(-0.85, -0.20 - 0.12 * (neg_count - pos_count))
            confidence = min(0.90, 0.65 + 0.05 * (neg_count - pos_count))
            explanation = (
                f"Tone categorized as 'negative' reflecting adverse economic, social, or operational conditions "
                f"(negative count: {neg_count}, positive count: {pos_count})."
            )
        else:
            tone = "neutral"
            valence = round((pos_count - neg_count) * 0.05, 3)
            confidence = 0.88 if (pos_count + neg_count) == 0 else 0.80
            explanation = (
                "Tone evaluated as 'neutral' with descriptive, factual presentation and minimal emotive rhetoric."
            )

        subjectivity = min(1.0, (pos_count + neg_count + crit_count + alarm_count) / max(total_words * 0.15, 1.0))

        return {
            "tone": tone,
            "tone_score": round(max(-1.0, min(1.0, valence)), 3),
            "confidence": round(confidence, 2),
            "subjectivity_score": round(subjectivity, 2),
            "explanation": explanation,
        }

    def analyze_headline_framing(self, headline: str) -> Dict[str, Any]:
        """
        Analyzes the headline for framing techniques, rhetorical positioning, and evidence words.
        """
        if not headline:
            return {
                "headline": "",
                "primary_frame": "neutral_reporting",
                "detected_frames": ["neutral_reporting"],
                "confidence": 0.80,
                "evidence_phrases": [],
                "explanation": "No headline provided; classified as neutral reporting by default.",
            }

        detected: List[str] = []
        evidence_phrases: List[str] = []

        all_rules = [
            (CONFLICT_PATTERNS, "conflict_emphasis"),
            (URGENCY_PATTERNS, "urgency"),
            (BLAME_PATTERNS, "blame_attribution"),
            (EMOTIONAL_PATTERNS, "emotional_language"),
            (ECONOMIC_PATTERNS, "economic_consequence"),
            (PROGRESS_PATTERNS, "achievement_progress"),
            (SECURITY_PATTERNS, "security_threat"),
        ]

        for patterns, frame_category in all_rules:
            for pattern_str, mapped_frame in patterns:
                m = re.search(pattern_str, headline, re.IGNORECASE)
                if m:
                    phrase = m.group(0).strip()
                    if phrase not in evidence_phrases:
                        evidence_phrases.append(phrase)
                    if mapped_frame not in detected:
                        detected.append(mapped_frame)

        if not detected:
            primary_frame = "neutral_reporting"
            detected = ["neutral_reporting"]
            confidence = 0.85
            explanation = "Headline employs objective, descriptive framing without overt conflict, emotional, or blame cues."
        else:
            primary_frame = detected[0]
            confidence = min(0.92, 0.70 + 0.10 * len(evidence_phrases))
            frame_descriptions = {
                "conflict_emphasis": "Highlights friction, opposition, or adversarial confrontation.",
                "urgency": "Emphasizes imminent crisis, ticking clock, or emergency timelines.",
                "blame_attribution": "Assigns responsibility or fault to specific actors.",
                "emotional_language": "Uses evocative or dramatic adjectives to elicit affective reader response.",
                "economic_consequence": "Frames the event primarily through monetary costs, financial burdens, or market shocks.",
                "achievement_progress": "Spotlights collaborative breakthroughs, milestones, or constructive progress.",
                "security_threat": "Frames the subject around danger, defense vulnerability, or external threats.",
            }
            explanation = (
                f"Headline exhibits '{primary_frame}' framing (evidence: {evidence_phrases}). "
                f"{frame_descriptions.get(primary_frame, '')}"
            )

        return {
            "headline": headline,
            "primary_frame": primary_frame,
            "detected_frames": detected,
            "confidence": round(confidence, 2),
            "evidence_phrases": evidence_phrases,
            "explanation": explanation,
        }

    def extract_framing_signals(self, text: str, headline: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extracts sentence-level and phrase-level framing signals with character boundaries and evidence text.
        """
        if not text and not headline:
            return []

        signals: List[Dict[str, Any]] = []

        all_rules = [
            (CONFLICT_PATTERNS, "conflict_emphasis", "Emphasizes dispute, confrontation, or adversarial division.", 0.85),
            (URGENCY_PATTERNS, "urgency", "Frames circumstances as requiring immediate action or under imminent threat.", 0.80),
            (BLAME_PATTERNS, "blame_attribution", "Attributes culpability, fault, or responsibility for adverse outcomes.", 0.85),
            (EMOTIONAL_PATTERNS, "emotional_language", "Uses charged, evocative rhetoric designed to stimulate affective response.", 0.80),
            (ECONOMIC_PATTERNS, "economic_consequence", "Frames events through financial costs, market disruptions, or economic burdens.", 0.75),
            (PROGRESS_PATTERNS, "cooperative_progress", "Spotlights multilateral consensus, milestone breakthroughs, or collaborative success.", 0.75),
            (SECURITY_PATTERNS, "security_threat", "Focuses narrative on security risks, strategic vulnerability, or defense concerns.", 0.80),
        ]

        # 1. Headline framing signal if distinct technique used
        if headline:
            for patterns, frame_type, exp_base, base_intensity in all_rules:
                for pattern_str, _ in patterns:
                    m = re.search(pattern_str, headline, re.IGNORECASE)
                    if m:
                        matched_text = m.group(0).strip()
                        signals.append({
                            "frame_type": frame_type,
                            "intensity_score": base_intensity,
                            "evidence_text": headline,
                            "start_char": 0,
                            "end_char": len(headline),
                            "explanation": f"Headline cue '{matched_text}': {exp_base}",
                        })
                        break
                if any(s["frame_type"] == frame_type for s in signals):
                    break

        # 2. Body sentence-level framing signals
        sentences = split_sentences(text or "")
        for sent_str, start_c, end_c in sentences:
            # Adjust offsets to match exact stripped sent_str within text[start_c:end_c]
            raw_span = text[start_c:end_c]
            lstrip_offset = len(raw_span) - len(raw_span.lstrip())
            actual_start = start_c + lstrip_offset
            actual_end = actual_start + len(sent_str)

            for patterns, frame_type, exp_base, base_intensity in all_rules:
                matched_cue = None
                for pattern_str, _ in patterns:
                    m = re.search(pattern_str, sent_str, re.IGNORECASE)
                    if m:
                        matched_cue = m.group(0).strip()
                        break

                if matched_cue:
                    # Avoid duplicate overlapping signal for same sentence & frame
                    if not any(s["start_char"] == actual_start and s["frame_type"] == frame_type for s in signals):
                        signals.append({
                            "frame_type": frame_type,
                            "intensity_score": round(base_intensity, 2),
                            "evidence_text": sent_str,
                            "start_char": actual_start,
                            "end_char": actual_end,
                            "explanation": f"Text cue '{matched_cue}': {exp_base}",
                        })

        return signals


class ToneAndFramingService:
    """
    Coordinates tone and framing analysis, updates ARTICLE_ANALYSIS,
    and stores framing signals in ANALYSIS_FRAMING_SIGNAL.
    """

    def __init__(self, analyzer: Optional[ToneAndFramingAnalyzer] = None):
        self.analyzer = analyzer or ToneAndFramingAnalyzer()

    def analyze_and_store_tone_and_framing(
        self,
        db: Session,
        article_id: int,
        force_reanalyze: bool = False,
    ) -> ToneAndFramingAnalysisResponse:
        """
        Analyzes an article's tone and framing, persists records in database, and returns structured response.
        """
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        # Find or create ArticleAnalysis record
        analysis = (
            db.query(ArticleAnalysis)
            .options(joinedload(ArticleAnalysis.framing_signals))
            .filter(ArticleAnalysis.article_id == article_id)
            .order_by(ArticleAnalysis.id.desc())
            .first()
        )

        headline_text = article.title or ""
        body_text = article.content or ""

        # Perform analysis
        tone_res = self.analyzer.analyze_tone(text=body_text, headline=headline_text)
        headline_framing_res = self.analyzer.analyze_headline_framing(headline=headline_text)
        framing_signals_data = self.analyzer.extract_framing_signals(text=body_text, headline=headline_text)

        if not analysis:
            analysis = ArticleAnalysis(
                article_id=article.id,
                pipeline_version="tone-framing-v1.0",
                status="completed",
                bias_score=0.0,
                bias_label="center",
                sentiment_score=tone_res["tone_score"],
                sentiment_label=tone_res["tone"],
                confidence_score=tone_res["confidence"],
                language="en",
                summary=(
                    f"Tone: {tone_res['tone']} ({tone_res['tone_score']:+.2f}). "
                    f"Headline Framing: {headline_framing_res['primary_frame']}."
                ),
                created_at=datetime.now(timezone.utc),
            )
            db.add(analysis)
            db.flush()
        else:
            # Update tone fields in existing analysis
            analysis.sentiment_score = tone_res["tone_score"]
            analysis.sentiment_label = tone_res["tone"]
            analysis.confidence_score = round((analysis.confidence_score + tone_res["confidence"]) / 2.0, 2)
            if force_reanalyze:
                # Remove prior framing signals for clean replacement
                db.query(AnalysisFramingSignal).filter(AnalysisFramingSignal.analysis_id == analysis.id).delete()
                db.flush()

        # If analysis already had framing signals and not force_reanalyze, keep them
        existing_signal_count = (
            db.query(AnalysisFramingSignal).filter(AnalysisFramingSignal.analysis_id == analysis.id).count()
        )

        stored_signals: List[AnalysisFramingSignal] = []
        if existing_signal_count == 0 or force_reanalyze:
            for sig in framing_signals_data:
                signal_record = AnalysisFramingSignal(
                    analysis_id=analysis.id,
                    frame_type=sig["frame_type"],
                    intensity_score=sig["intensity_score"],
                    evidence_text=sig["evidence_text"],
                    start_char=sig["start_char"],
                    end_char=sig["end_char"],
                    explanation=sig["explanation"],
                    created_at=datetime.now(timezone.utc),
                )
                db.add(signal_record)
                stored_signals.append(signal_record)
            db.commit()
            db.refresh(analysis)
        else:
            stored_signals = (
                db.query(AnalysisFramingSignal)
                .filter(AnalysisFramingSignal.analysis_id == analysis.id)
                .order_by(AnalysisFramingSignal.id.asc())
                .all()
            )

        # Build response objects
        tone_out = ArticleToneResponse(
            article_id=article.id,
            analysis_id=analysis.id,
            tone=tone_res["tone"],
            tone_score=tone_res["tone_score"],
            confidence=tone_res["confidence"],
            explanation=tone_res["explanation"],
            subjectivity_score=tone_res["subjectivity_score"],
        )

        headline_out = HeadlineFramingResponse(
            article_id=article.id,
            headline=headline_text,
            primary_frame=headline_framing_res["primary_frame"],
            detected_frames=headline_framing_res["detected_frames"],
            confidence=headline_framing_res["confidence"],
            evidence_phrases=headline_framing_res["evidence_phrases"],
            explanation=headline_framing_res["explanation"],
        )

        return ToneAndFramingAnalysisResponse(
            article_id=article.id,
            analysis_id=analysis.id,
            headline=headline_text,
            tone=tone_out,
            headline_framing=headline_out,
            framing_signals=stored_signals,
            total_signals_count=len(stored_signals),
            summary=(
                f"Article tone assessed as '{tone_res['tone']}' with valence {tone_res['tone_score']:+.2f}. "
                f"Headline framed through '{headline_framing_res['primary_frame']}'. "
                f"{len(stored_signals)} framing signals detected."
            ),
        )

    def get_article_tone(self, db: Session, article_id: int) -> ArticleToneResponse:
        """Retrieves or computes tone assessment for an article."""
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        analysis = (
            db.query(ArticleAnalysis)
            .filter(ArticleAnalysis.article_id == article_id)
            .order_by(ArticleAnalysis.id.desc())
            .first()
        )

        if analysis and analysis.sentiment_label:
            tone_res = self.analyzer.analyze_tone(text=article.content or "", headline=article.title or "")
            return ArticleToneResponse(
                article_id=article.id,
                analysis_id=analysis.id,
                tone=analysis.sentiment_label,  # type: ignore
                tone_score=analysis.sentiment_score or 0.0,
                confidence=analysis.confidence_score or 0.85,
                explanation=tone_res["explanation"],
                subjectivity_score=tone_res["subjectivity_score"],
            )

        # Trigger analysis if none exists
        full = self.analyze_and_store_tone_and_framing(db=db, article_id=article_id)
        return full.tone

    def get_article_headline_framing(self, db: Session, article_id: int) -> HeadlineFramingResponse:
        """Retrieves headline framing analysis for an article."""
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        raw = self.analyzer.analyze_headline_framing(headline=article.title or "")
        return HeadlineFramingResponse(
            article_id=article.id,
            headline=raw["headline"],
            primary_frame=raw["primary_frame"],
            detected_frames=raw["detected_frames"],
            confidence=raw["confidence"],
            evidence_phrases=raw["evidence_phrases"],
            explanation=raw["explanation"],
        )

    def get_article_framing_signals(self, db: Session, article_id: int) -> List[AnalysisFramingSignal]:
        """Retrieves stored framing signals for an article."""
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        analysis = (
            db.query(ArticleAnalysis)
            .filter(ArticleAnalysis.article_id == article_id)
            .order_by(ArticleAnalysis.id.desc())
            .first()
        )

        if not analysis:
            full = self.analyze_and_store_tone_and_framing(db=db, article_id=article_id)
            return full.framing_signals

        signals = (
            db.query(AnalysisFramingSignal)
            .filter(AnalysisFramingSignal.analysis_id == analysis.id)
            .order_by(AnalysisFramingSignal.id.asc())
            .all()
        )
        if not signals:
            full = self.analyze_and_store_tone_and_framing(db=db, article_id=article_id, force_reanalyze=True)
            return full.framing_signals
        return signals


# Global singleton
_tone_framing_service: Optional[ToneAndFramingService] = None


def get_tone_framing_service() -> ToneAndFramingService:
    global _tone_framing_service
    if _tone_framing_service is None:
        _tone_framing_service = ToneAndFramingService()
    return _tone_framing_service
