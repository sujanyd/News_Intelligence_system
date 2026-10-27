"""Implement remaining database schema, tables, and constraints.

Revision ID: 0002_remaining_tables_and_constraints
Revises: 0001_initial_core_tables
Create Date: 2026-10-27 11:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002_remaining_tables_and_constraints'
down_revision: Union[str, None] = '0001_initial_core_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------
    # 1. Update ARTICLE table (using batch_alter_table for cross-database support)
    # -------------------------------------------------------------
    with op.batch_alter_table('articles') as batch_op:
        batch_op.add_column(
            sa.Column('content_availability', sa.String(length=50), nullable=False, server_default='full_text'),
        )
        batch_op.add_column(
            sa.Column('canonical_url', sa.String(length=1024), nullable=True),
        )
        batch_op.add_column(
            sa.Column('content_hash', sa.String(length=64), nullable=True),
        )
        batch_op.add_column(
            sa.Column('duplicate_of_article_id', sa.Integer(), nullable=True),
        )
        batch_op.alter_column('content', existing_type=sa.Text(), nullable=True)
        batch_op.create_index(batch_op.f('ix_articles_canonical_url'), ['canonical_url'], unique=False)
        batch_op.create_index(batch_op.f('ix_articles_content_hash'), ['content_hash'], unique=False)
        batch_op.create_index(batch_op.f('ix_articles_duplicate_of_article_id'), ['duplicate_of_article_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_articles_duplicate_of_article_id_articles',
            'articles',
            ['duplicate_of_article_id'],
            ['id'],
            ondelete='SET NULL',
        )
        batch_op.create_check_constraint(
            'ck_articles_content_availability',
            "content_availability IN ('full_text', 'summary_only', 'headline_only')",
        )

    # -------------------------------------------------------------
    # 2. ARTICLE_EMBEDDING Table (Table 5)
    # -------------------------------------------------------------
    op.create_table(
        'article_embeddings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('embedding_type', sa.String(length=50), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('vector_reference', sa.String(length=255), nullable=False),
        sa.Column('dimensions', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['article_id'], ['articles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('article_id', 'embedding_type', 'model_name', name='uq_article_embeddings_article_type_model'),
    )
    op.create_index(op.f('ix_article_embeddings_id'), 'article_embeddings', ['id'], unique=False)
    op.create_index(op.f('ix_article_embeddings_article_id'), 'article_embeddings', ['article_id'], unique=False)

    # -------------------------------------------------------------
    # 3. ARTICLE_MATCH Table (Table 6)
    # -------------------------------------------------------------
    op.create_table(
        'article_matches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id_1', sa.Integer(), nullable=False),
        sa.Column('article_id_2', sa.Integer(), nullable=False),
        sa.Column('match_label', sa.String(length=50), nullable=False),
        sa.Column('similarity_score', sa.Float(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('model_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('article_id_1 < article_id_2', name='ck_article_matches_canonical_order'),
        sa.CheckConstraint("match_label IN ('SAME', 'RELATED', 'DIFFERENT')", name='ck_article_matches_label'),
        sa.ForeignKeyConstraint(['article_id_1'], ['articles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['article_id_2'], ['articles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('article_id_1', 'article_id_2', name='uq_article_matches_pair'),
    )
    op.create_index(op.f('ix_article_matches_id'), 'article_matches', ['id'], unique=False)
    op.create_index(op.f('ix_article_matches_article_id_1'), 'article_matches', ['article_id_1'], unique=False)
    op.create_index(op.f('ix_article_matches_article_id_2'), 'article_matches', ['article_id_2'], unique=False)

    # -------------------------------------------------------------
    # 4. ARTICLE_ANALYSIS Table (Table 7)
    # -------------------------------------------------------------
    op.create_table(
        'article_analyses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('pipeline_version', sa.String(length=100), server_default='v1.0.0', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='completed', nullable=False),
        sa.Column('bias_score', sa.Float(), nullable=True),
        sa.Column('bias_label', sa.String(length=50), nullable=True),
        sa.Column('sentiment_score', sa.Float(), nullable=True),
        sa.Column('sentiment_label', sa.String(length=50), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('language', sa.String(length=20), server_default='en', nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['article_id'], ['articles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_article_analyses_id'), 'article_analyses', ['id'], unique=False)
    op.create_index(op.f('ix_article_analyses_article_id'), 'article_analyses', ['article_id'], unique=False)

    # -------------------------------------------------------------
    # 5. ANALYSIS_TOPIC Table (Table 8)
    # -------------------------------------------------------------
    op.create_table(
        'analysis_topics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=False),
        sa.Column('topic_name', sa.String(length=255), nullable=False),
        sa.Column('relevance_score', sa.Float(), nullable=True),
        sa.Column('start_char', sa.Integer(), nullable=True),
        sa.Column('end_char', sa.Integer(), nullable=True),
        sa.Column('evidence_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('start_char IS NULL OR end_char IS NULL OR start_char <= end_char', name='ck_analysis_topics_char_range'),
        sa.ForeignKeyConstraint(['analysis_id'], ['article_analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_analysis_topics_id'), 'analysis_topics', ['id'], unique=False)
    op.create_index(op.f('ix_analysis_topics_analysis_id'), 'analysis_topics', ['analysis_id'], unique=False)
    op.create_index(op.f('ix_analysis_topics_topic_name'), 'analysis_topics', ['topic_name'], unique=False)

    # -------------------------------------------------------------
    # 6. ANALYSIS_FACT Table (Table 9)
    # -------------------------------------------------------------
    op.create_table(
        'analysis_facts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=False),
        sa.Column('fact_statement', sa.Text(), nullable=False),
        sa.Column('verification_status', sa.String(length=50), server_default='unverified', nullable=True),
        sa.Column('start_char', sa.Integer(), nullable=True),
        sa.Column('end_char', sa.Integer(), nullable=True),
        sa.Column('evidence_text', sa.Text(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('start_char IS NULL OR end_char IS NULL OR start_char <= end_char', name='ck_analysis_facts_char_range'),
        sa.ForeignKeyConstraint(['analysis_id'], ['article_analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_analysis_facts_id'), 'analysis_facts', ['id'], unique=False)
    op.create_index(op.f('ix_analysis_facts_analysis_id'), 'analysis_facts', ['analysis_id'], unique=False)

    # -------------------------------------------------------------
    # 7. ANALYSIS_QUOTE Table (Table 10)
    # -------------------------------------------------------------
    op.create_table(
        'analysis_quotes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=False),
        sa.Column('quote_text', sa.Text(), nullable=False),
        sa.Column('speaker_name', sa.String(length=255), nullable=True),
        sa.Column('speaker_title', sa.String(length=255), nullable=True),
        sa.Column('source_type', sa.String(length=50), server_default='speaker_opinion', nullable=False),
        sa.Column('is_opinion', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('sentiment_score', sa.Float(), nullable=True),
        sa.Column('start_char', sa.Integer(), nullable=True),
        sa.Column('end_char', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("source_type IN ('speaker_opinion', 'publisher_narration')", name='ck_analysis_quotes_source_type'),
        sa.CheckConstraint('start_char IS NULL OR end_char IS NULL OR start_char <= end_char', name='ck_analysis_quotes_char_range'),
        sa.ForeignKeyConstraint(['analysis_id'], ['article_analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_analysis_quotes_id'), 'analysis_quotes', ['id'], unique=False)
    op.create_index(op.f('ix_analysis_quotes_analysis_id'), 'analysis_quotes', ['analysis_id'], unique=False)

    # -------------------------------------------------------------
    # 8. ANALYSIS_FRAMING_SIGNAL Table (Table 11)
    # -------------------------------------------------------------
    op.create_table(
        'analysis_framing_signals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=False),
        sa.Column('frame_type', sa.String(length=100), nullable=False),
        sa.Column('intensity_score', sa.Float(), nullable=True),
        sa.Column('evidence_text', sa.Text(), nullable=False),
        sa.Column('start_char', sa.Integer(), nullable=True),
        sa.Column('end_char', sa.Integer(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('start_char IS NULL OR end_char IS NULL OR start_char <= end_char', name='ck_analysis_framing_signals_char_range'),
        sa.ForeignKeyConstraint(['analysis_id'], ['article_analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_analysis_framing_signals_id'), 'analysis_framing_signals', ['id'], unique=False)
    op.create_index(op.f('ix_analysis_framing_signals_analysis_id'), 'analysis_framing_signals', ['analysis_id'], unique=False)
    op.create_index(op.f('ix_analysis_framing_signals_frame_type'), 'analysis_framing_signals', ['frame_type'], unique=False)

    # -------------------------------------------------------------
    # 9. ENTITY Table (Table 12)
    # -------------------------------------------------------------
    op.create_table(
        'entities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('entity_type', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_entities_id'), 'entities', ['id'], unique=False)
    op.create_index(op.f('ix_entities_name'), 'entities', ['name'], unique=True)
    op.create_index(op.f('ix_entities_entity_type'), 'entities', ['entity_type'], unique=False)

    # -------------------------------------------------------------
    # 10. ENTITY_ALIAS Table (Table 13)
    # -------------------------------------------------------------
    op.create_table(
        'entity_aliases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('alias', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('entity_id', 'alias', name='uq_entity_aliases_entity_alias'),
    )
    op.create_index(op.f('ix_entity_aliases_id'), 'entity_aliases', ['id'], unique=False)
    op.create_index(op.f('ix_entity_aliases_entity_id'), 'entity_aliases', ['entity_id'], unique=False)
    op.create_index(op.f('ix_entity_aliases_alias'), 'entity_aliases', ['alias'], unique=False)

    # -------------------------------------------------------------
    # 11. ANALYSIS_ENTITY Table (Table 14)
    # -------------------------------------------------------------
    op.create_table(
        'analysis_entities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('mention_count', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('sentiment_score', sa.Float(), nullable=True),
        sa.Column('salience_score', sa.Float(), nullable=True),
        sa.Column('role', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['analysis_id'], ['article_analyses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('analysis_id', 'entity_id', name='uq_analysis_entities_analysis_entity'),
    )
    op.create_index(op.f('ix_analysis_entities_id'), 'analysis_entities', ['id'], unique=False)
    op.create_index(op.f('ix_analysis_entities_analysis_id'), 'analysis_entities', ['analysis_id'], unique=False)
    op.create_index(op.f('ix_analysis_entities_entity_id'), 'analysis_entities', ['entity_id'], unique=False)

    # -------------------------------------------------------------
    # 12. NEWS_COMPARISON Table (Table 15)
    # -------------------------------------------------------------
    op.create_table(
        'news_comparisons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=512), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='completed', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_news_comparisons_id'), 'news_comparisons', ['id'], unique=False)
    op.create_index(op.f('ix_news_comparisons_event_id'), 'news_comparisons', ['event_id'], unique=False)

    # -------------------------------------------------------------
    # 13. COMPARISON_ARTICLE Table (Table 16)
    # -------------------------------------------------------------
    op.create_table(
        'comparison_articles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comparison_id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['article_id'], ['articles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['comparison_id'], ['news_comparisons.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('comparison_id', 'article_id', name='uq_comparison_articles_comparison_article'),
    )
    op.create_index(op.f('ix_comparison_articles_id'), 'comparison_articles', ['id'], unique=False)
    op.create_index(op.f('ix_comparison_articles_comparison_id'), 'comparison_articles', ['comparison_id'], unique=False)
    op.create_index(op.f('ix_comparison_articles_article_id'), 'comparison_articles', ['article_id'], unique=False)

    # -------------------------------------------------------------
    # 14. COMPARISON_EVIDENCE Table (Table 17)
    # -------------------------------------------------------------
    op.create_table(
        'comparison_evidences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comparison_id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=True),
        sa.Column('evidence_type', sa.String(length=100), nullable=False),
        sa.Column('claim_or_topic', sa.String(length=512), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('start_char', sa.Integer(), nullable=True),
        sa.Column('end_char', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('start_char IS NULL OR end_char IS NULL OR start_char <= end_char', name='ck_comparison_evidences_char_range'),
        sa.ForeignKeyConstraint(['comparison_id'], ['news_comparisons.id'], ondelete='CASCADE', name='fk_comparison_evidences_comparison'),
        sa.ForeignKeyConstraint(
            ['comparison_id', 'article_id'],
            ['comparison_articles.comparison_id', 'comparison_articles.article_id'],
            ondelete='CASCADE',
            name='fk_comparison_evidences_comparison_article',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_comparison_evidences_id'), 'comparison_evidences', ['id'], unique=False)
    op.create_index(op.f('ix_comparison_evidences_comparison_id'), 'comparison_evidences', ['comparison_id'], unique=False)
    op.create_index(op.f('ix_comparison_evidences_article_id'), 'comparison_evidences', ['article_id'], unique=False)

    # -------------------------------------------------------------
    # 15. COMPARISON_COVERAGE Table (Table 18)
    # -------------------------------------------------------------
    op.create_table(
        'comparison_coverages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comparison_id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('coverage_score', sa.Float(), nullable=True),
        sa.Column('tone_score', sa.Float(), nullable=True),
        sa.Column('primary_frame', sa.String(length=100), nullable=True),
        sa.Column('omitted_topics', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['comparison_id'], ['news_comparisons.id'], ondelete='CASCADE', name='fk_comparison_coverages_comparison'),
        sa.ForeignKeyConstraint(
            ['comparison_id', 'article_id'],
            ['comparison_articles.comparison_id', 'comparison_articles.article_id'],
            ondelete='CASCADE',
            name='fk_comparison_coverages_comparison_article',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('comparison_id', 'article_id', name='uq_comparison_coverages_comparison_article'),
    )
    op.create_index(op.f('ix_comparison_coverages_id'), 'comparison_coverages', ['id'], unique=False)
    op.create_index(op.f('ix_comparison_coverages_comparison_id'), 'comparison_coverages', ['comparison_id'], unique=False)
    op.create_index(op.f('ix_comparison_coverages_article_id'), 'comparison_coverages', ['article_id'], unique=False)

    # -------------------------------------------------------------
    # 16. COMPARISON_POLITICAL_SIGNAL Table (Table 19)
    # -------------------------------------------------------------
    op.create_table(
        'comparison_political_signals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comparison_id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('political_leaning', sa.String(length=50), nullable=False),
        sa.Column('slant_score', sa.Float(), nullable=True),
        sa.Column('partisanship_score', sa.Float(), nullable=True),
        sa.Column('signal_description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['comparison_id'], ['news_comparisons.id'], ondelete='CASCADE', name='fk_comparison_political_signals_comparison'),
        sa.ForeignKeyConstraint(
            ['comparison_id', 'article_id'],
            ['comparison_articles.comparison_id', 'comparison_articles.article_id'],
            ondelete='CASCADE',
            name='fk_comparison_political_signals_comparison_article',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('comparison_id', 'article_id', name='uq_comparison_political_signals_comparison_article'),
    )
    op.create_index(op.f('ix_comparison_political_signals_id'), 'comparison_political_signals', ['id'], unique=False)
    op.create_index(op.f('ix_comparison_political_signals_comparison_id'), 'comparison_political_signals', ['comparison_id'], unique=False)
    op.create_index(op.f('ix_comparison_political_signals_article_id'), 'comparison_political_signals', ['article_id'], unique=False)

    # -------------------------------------------------------------
    # 17. AI_DETECTION_RESULT Table (Table 20)
    # -------------------------------------------------------------
    op.create_table(
        'ai_detection_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('ai_likelihood', sa.Float(), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('model_version', sa.String(length=50), nullable=True),
        sa.Column('analysis_details', sa.Text(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('is_flagged_for_review', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('ai_likelihood >= 0.0 AND ai_likelihood <= 1.0', name='ck_ai_detection_results_likelihood_range'),
        sa.ForeignKeyConstraint(['article_id'], ['articles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_detection_results_id'), 'ai_detection_results', ['id'], unique=False)
    op.create_index(op.f('ix_ai_detection_results_article_id'), 'ai_detection_results', ['article_id'], unique=False)

    # -------------------------------------------------------------
    # 18. REPORT Table (Table 21)
    # -------------------------------------------------------------
    op.create_table(
        'reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comparison_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=512), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('report_format', sa.String(length=50), server_default='markdown', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['comparison_id'], ['news_comparisons.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_reports_id'), 'reports', ['id'], unique=False)
    op.create_index(op.f('ix_reports_comparison_id'), 'reports', ['comparison_id'], unique=False)


def downgrade() -> None:
    # Drop in reverse order of creation
    op.drop_index(op.f('ix_reports_comparison_id'), table_name='reports')
    op.drop_index(op.f('ix_reports_id'), table_name='reports')
    op.drop_table('reports')

    op.drop_index(op.f('ix_ai_detection_results_article_id'), table_name='ai_detection_results')
    op.drop_index(op.f('ix_ai_detection_results_id'), table_name='ai_detection_results')
    op.drop_table('ai_detection_results')

    op.drop_index(op.f('ix_comparison_political_signals_article_id'), table_name='comparison_political_signals')
    op.drop_index(op.f('ix_comparison_political_signals_comparison_id'), table_name='comparison_political_signals')
    op.drop_index(op.f('ix_comparison_political_signals_id'), table_name='comparison_political_signals')
    op.drop_table('comparison_political_signals')

    op.drop_index(op.f('ix_comparison_coverages_article_id'), table_name='comparison_coverages')
    op.drop_index(op.f('ix_comparison_coverages_comparison_id'), table_name='comparison_coverages')
    op.drop_index(op.f('ix_comparison_coverages_id'), table_name='comparison_coverages')
    op.drop_table('comparison_coverages')

    op.drop_index(op.f('ix_comparison_evidences_article_id'), table_name='comparison_evidences')
    op.drop_index(op.f('ix_comparison_evidences_comparison_id'), table_name='comparison_evidences')
    op.drop_index(op.f('ix_comparison_evidences_id'), table_name='comparison_evidences')
    op.drop_table('comparison_evidences')

    op.drop_index(op.f('ix_comparison_articles_article_id'), table_name='comparison_articles')
    op.drop_index(op.f('ix_comparison_articles_comparison_id'), table_name='comparison_articles')
    op.drop_index(op.f('ix_comparison_articles_id'), table_name='comparison_articles')
    op.drop_table('comparison_articles')

    op.drop_index(op.f('ix_news_comparisons_event_id'), table_name='news_comparisons')
    op.drop_index(op.f('ix_news_comparisons_id'), table_name='news_comparisons')
    op.drop_table('news_comparisons')

    op.drop_index(op.f('ix_analysis_entities_entity_id'), table_name='analysis_entities')
    op.drop_index(op.f('ix_analysis_entities_analysis_id'), table_name='analysis_entities')
    op.drop_index(op.f('ix_analysis_entities_id'), table_name='analysis_entities')
    op.drop_table('analysis_entities')

    op.drop_index(op.f('ix_entity_aliases_alias'), table_name='entity_aliases')
    op.drop_index(op.f('ix_entity_aliases_entity_id'), table_name='entity_aliases')
    op.drop_index(op.f('ix_entity_aliases_id'), table_name='entity_aliases')
    op.drop_table('entity_aliases')

    op.drop_index(op.f('ix_entities_entity_type'), table_name='entities')
    op.drop_index(op.f('ix_entities_name'), table_name='entities')
    op.drop_index(op.f('ix_entities_id'), table_name='entities')
    op.drop_table('entities')

    op.drop_index(op.f('ix_analysis_framing_signals_frame_type'), table_name='analysis_framing_signals')
    op.drop_index(op.f('ix_analysis_framing_signals_analysis_id'), table_name='analysis_framing_signals')
    op.drop_index(op.f('ix_analysis_framing_signals_id'), table_name='analysis_framing_signals')
    op.drop_table('analysis_framing_signals')

    op.drop_index(op.f('ix_analysis_quotes_analysis_id'), table_name='analysis_quotes')
    op.drop_index(op.f('ix_analysis_quotes_id'), table_name='analysis_quotes')
    op.drop_table('analysis_quotes')

    op.drop_index(op.f('ix_analysis_facts_analysis_id'), table_name='analysis_facts')
    op.drop_index(op.f('ix_analysis_facts_id'), table_name='analysis_facts')
    op.drop_table('analysis_facts')

    op.drop_index(op.f('ix_analysis_topics_topic_name'), table_name='analysis_topics')
    op.drop_index(op.f('ix_analysis_topics_analysis_id'), table_name='analysis_topics')
    op.drop_index(op.f('ix_analysis_topics_id'), table_name='analysis_topics')
    op.drop_table('analysis_topics')

    op.drop_index(op.f('ix_article_analyses_article_id'), table_name='article_analyses')
    op.drop_index(op.f('ix_article_analyses_id'), table_name='article_analyses')
    op.drop_table('article_analyses')

    op.drop_index(op.f('ix_article_matches_article_id_2'), table_name='article_matches')
    op.drop_index(op.f('ix_article_matches_article_id_1'), table_name='article_matches')
    op.drop_index(op.f('ix_article_matches_id'), table_name='article_matches')
    op.drop_table('article_matches')

    op.drop_index(op.f('ix_article_embeddings_article_id'), table_name='article_embeddings')
    op.drop_index(op.f('ix_article_embeddings_id'), table_name='article_embeddings')
    op.drop_table('article_embeddings')

    # Revert articles columns using batch_alter_table
    with op.batch_alter_table('articles') as batch_op:
        batch_op.drop_constraint('ck_articles_content_availability', type_='check')
        batch_op.drop_constraint('fk_articles_duplicate_of_article_id_articles', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_articles_duplicate_of_article_id'))
        batch_op.drop_index(batch_op.f('ix_articles_content_hash'))
        batch_op.drop_index(batch_op.f('ix_articles_canonical_url'))
        batch_op.alter_column('content', existing_type=sa.Text(), nullable=False)
        batch_op.drop_column('duplicate_of_article_id')
        batch_op.drop_column('content_hash')
        batch_op.drop_column('canonical_url')
        batch_op.drop_column('content_availability')
