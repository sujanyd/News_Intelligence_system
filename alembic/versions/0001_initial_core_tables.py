"""Initial core tables for news sources, stories, events, and articles.

Revision ID: 0001_initial_core_tables
Revises: 
Create Date: 2026-10-26 19:27:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0001_initial_core_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. NEWS_SOURCE Table
    op.create_table(
        'news_sources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('base_url', sa.String(length=512), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_news_sources_id'), 'news_sources', ['id'], unique=False)
    op.create_index(op.f('ix_news_sources_name'), 'news_sources', ['name'], unique=True)

    # 2. STORY Table
    op.create_table(
        'stories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=512), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stories_id'), 'stories', ['id'], unique=False)
    op.create_index(op.f('ix_stories_title'), 'stories', ['title'], unique=False)

    # 3. EVENT Table
    op.create_table(
        'events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('story_id', sa.Integer(), nullable=False),
        sa.Column('event_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('event_time_precision', sa.String(length=50), nullable=True),
        sa.Column('event_time_disagreement', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['story_id'], ['stories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_events_id'), 'events', ['id'], unique=False)
    op.create_index(op.f('ix_events_story_id'), 'events', ['story_id'], unique=False)

    # 4. ARTICLE Table
    op.create_table(
        'articles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('source_id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=512), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('url', sa.String(length=1024), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('retrieved_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['source_id'], ['news_sources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_articles_id'), 'articles', ['id'], unique=False)
    op.create_index(op.f('ix_articles_source_id'), 'articles', ['source_id'], unique=False)
    op.create_index(op.f('ix_articles_event_id'), 'articles', ['event_id'], unique=False)
    op.create_index(op.f('ix_articles_url'), 'articles', ['url'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_articles_url'), table_name='articles')
    op.drop_index(op.f('ix_articles_event_id'), table_name='articles')
    op.drop_index(op.f('ix_articles_source_id'), table_name='articles')
    op.drop_index(op.f('ix_articles_id'), table_name='articles')
    op.drop_table('articles')

    op.drop_index(op.f('ix_events_story_id'), table_name='events')
    op.drop_index(op.f('ix_events_id'), table_name='events')
    op.drop_table('events')

    op.drop_index(op.f('ix_stories_title'), table_name='stories')
    op.drop_index(op.f('ix_stories_id'), table_name='stories')
    op.drop_table('stories')

    op.drop_index(op.f('ix_news_sources_name'), table_name='news_sources')
    op.drop_index(op.f('ix_news_sources_id'), table_name='news_sources')
    op.drop_table('news_sources')
