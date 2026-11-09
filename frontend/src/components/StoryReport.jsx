import React, { useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import DataTable from './DataTable'
import StatusBadge from './StatusBadge'
import { PrecisionBadge, TimeAgreementBadge } from './EventTimeInfo'
import { fetchArticleAnalyses, fetchStory } from '../api/newsApi'
import {
  dateRangeOf,
  entityCoverage,
  groupFrames,
  publishersOf,
  REPORT_ARTICLE_LIMIT,
} from '../utils/coverage'
import { formatEntityType } from '../utils/groupEntities'
import { formatEventTime, sortEventsByTime } from '../utils/formatEventTime'
import { formatDate } from '../utils/formatDate'
import { formatToneScore, frameInfo, toneInfo } from '../utils/toneLabels'
import { categoryLabel } from '../utils/politicalLabels'

// "BBC News: Headline"
function articleName(article) {
  return `${article.source_name || 'Unknown publisher'}: ${article.title}`
}

function sourceList(articles) {
  return [...new Set(articles.map((article) => article.source_name || 'Unknown publisher'))].join(', ')
}

/**
 * The evidence behind one article's results, folded away until opened.
 */
function ArticleEvidence({ article, analyses }) {
  const { insights, tone, political, errors } = analyses
  return (
    <details className="rep-evidence">
      <summary>{articleName(article)}</summary>

      <p className="pol-evidence-label">Framing signals</p>
      {tone ? (
        tone.signals.length > 0 ? (
          <ul className="rep-evidence-list">
            {tone.signals.map((signal) => (
              <li key={signal.id}>
                <StatusBadge variant="info">{frameInfo(signal.frame_type).label}</StatusBadge>
                <blockquote className="pol-evidence">“{signal.evidence_text}”</blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ai-none">None found.</p>
        )
      ) : (
        <p className="ai-none">Not loaded: {errors.tone}</p>
      )}

      <p className="pol-evidence-label">Political wording signals</p>
      {political ? (
        political.signals.length > 0 ? (
          <ul className="rep-evidence-list">
            {political.signals.map((signal) => (
              <li key={signal.id}>
                <strong>{signal.entity_name}</strong>
                <blockquote className="pol-evidence">“{signal.evidence_text}”</blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ai-none">None found.</p>
        )
      ) : (
        <p className="ai-none">Not loaded: {errors.political}</p>
      )}

      <p className="pol-evidence-label">Facts</p>
      {insights ? (
        insights.facts.length > 0 ? (
          <ul className="rep-evidence-list">
            {insights.facts.map((fact) => (
              <li key={fact.id}>
                <blockquote className="pol-evidence">“{fact.statement}”</blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ai-none">None found.</p>
        )
      ) : (
        <p className="ai-none">Not loaded: {errors.insights}</p>
      )}

      {article.url && (
        <p className="pol-explanation">
          Original article:{' '}
          <a href={article.url} target="_blank" rel="noreferrer" className="table-link">
            {article.url}
          </a>
        </p>
      )}
    </details>
  )
}

/**
 * StoryReport Component
 *
 * An evidence-based report about one story, built in the browser from real
 * backend data (the backend has no report route):
 *   GET /stories/{id}, then for each article (up to REPORT_ARTICLE_LIMIT)
 *   GET /extraction, /tone-framing and /political-signals.
 *
 * Sections: summary, events, publishers, coverage by article, framing and
 * tone differences, shared and missing coverage, evidence, limitations.
 * Nothing is added: every number is a count of backend results.
 *
 * @param {Object} props
 * @param {number} props.storyId
 * @param {() => void} props.onBack
 */
export function StoryReport({ storyId, onBack }) {
  const [story, setStory] = useState(null)
  const [items, setItems] = useState([]) // [{ article, analyses }]
  const [builtAt, setBuiltAt] = useState(null) // when the report was put together
  const [progress, setProgress] = useState(0) // articles analysed so far
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let isCurrentRequest = true
    async function load() {
      const result = await fetchStory(storyId)
      if (!isCurrentRequest) return
      setStory(result)
      const loaded = []
      // One article after the other, so the backend is not flooded
      for (const article of result.articles.slice(0, REPORT_ARTICLE_LIMIT)) {
        const analyses = await fetchArticleAnalyses(article.id)
        if (!isCurrentRequest) return
        loaded.push({ article, analyses })
        setProgress(loaded.length)
      }
      setItems(loaded)
      setBuiltAt(new Date().toISOString())
    }
    load()
      .catch((error) => {
        if (isCurrentRequest) setErrorMessage(error.message)
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoading(false)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [storyId, reloadCount])

  function handleRetry() {
    setIsLoading(true)
    setErrorMessage('')
    setStory(null)
    setItems([])
    setProgress(0)
    setReloadCount(reloadCount + 1)
  }

  const backButton = (
    <button type="button" className="btn btn-secondary story-back" onClick={onBack}>
      ← All reports
    </button>
  )

  if (errorMessage) {
    return (
      <>
        {backButton}
        <AlertMessage type="error" title="Could not build the report." message={errorMessage} onRetry={handleRetry} />
      </>
    )
  }
  if (isLoading) {
    const total = story ? Math.min(story.articles.length, REPORT_ARTICLE_LIMIT) : null
    return (
      <>
        {backButton}
        <LoadingState
          message={
            story
              ? `Analysing article ${Math.min(progress + 1, total)} of ${total}...`
              : 'Loading the story...'
          }
        />
      </>
    )
  }

  const publishers = publishersOf(story.articles)
  const dateRange = dateRangeOf(story.articles)
  const frames = groupFrames(items)
  const coverage = entityCoverage(items)
  const events = sortEventsByTime(story.events)
  const notAnalysed = story.articles.length - items.length
  const failed = items.filter(({ analyses }) => Object.keys(analyses.errors).length > 0)
  const headlineOnly = story.articles.filter((article) => article.content_availability === 'headline_only')

  const coverageColumns = [
    { key: 'source', label: 'Publisher', render: ({ article }) => article.source_name || 'Unknown' },
    { key: 'title', label: 'Headline', render: ({ article }) => <strong>{article.title}</strong> },
    { key: 'published', label: 'Published', render: ({ article }) => formatDate(article.published_at) },
    {
      key: 'tone',
      label: 'Tone',
      render: ({ analyses }) =>
        analyses.tone ? (
          <StatusBadge variant={toneInfo(analyses.tone.tone.label).variant}>
            {toneInfo(analyses.tone.tone.label).label} {formatToneScore(analyses.tone.tone.score)}
          </StatusBadge>
        ) : (
          'Not loaded'
        ),
    },
    {
      key: 'headline',
      label: 'Headline framing',
      render: ({ analyses }) =>
        !analyses.tone
          ? 'Not loaded'
          : analyses.tone.headline_framing.frames.length > 0
          ? analyses.tone.headline_framing.frames.map((frame) => frameInfo(frame).label).join(', ')
          : 'No cue found',
    },
    {
      key: 'signals',
      label: 'Framing signals',
      render: ({ analyses }) => (analyses.tone ? analyses.tone.signals.length : 'Not loaded'),
    },
    {
      key: 'political',
      label: 'Political entities',
      render: ({ analyses }) =>
        analyses.political
          ? analyses.political.entities.map((entity) => entity.name).join(', ') || 'None'
          : 'Not loaded',
    },
    {
      key: 'facts',
      label: 'Facts',
      render: ({ analyses }) => (analyses.insights ? analyses.insights.facts.length : 'Not loaded'),
    },
  ]

  return (
    <article className="rep-report" data-testid="story-report">
      {backButton}
      <h3 className="rep-title">{story.title}</h3>
      <p className="ai-chip-extra">
        Report built on {formatDate(builtAt)} from the backend&apos;s current data.
      </p>

      <section className="ad-section" aria-labelledby="rep-summary">
        <h4 className="ad-section-title" id="rep-summary">Summary</h4>
        <dl className="details-list">
          <div>
            <dt>Events</dt>
            <dd>{story.events.length}</dd>
          </div>
          <div>
            <dt>Articles</dt>
            <dd>{story.articles.length}</dd>
          </div>
          <div>
            <dt>Publishers</dt>
            <dd>{publishers.length}</dd>
          </div>
          <div>
            <dt>Published between</dt>
            <dd>
              {dateRange ? `${formatDate(dateRange.first)} and ${formatDate(dateRange.last)}` : 'No dates given'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="ad-section" aria-labelledby="rep-events">
        <h4 className="ad-section-title" id="rep-events">Events</h4>
        {events.length === 0 ? (
          <p className="ai-none">This story has no events.</p>
        ) : (
          <ul className="rep-event-list">
            {events.map((event) => (
              <li key={event.id}>
                <strong>Event #{event.id}: {formatEventTime(event)}</strong>
                <PrecisionBadge precision={event.event_time_precision} />
                <TimeAgreementBadge disagreement={event.event_time_disagreement} />
                <span className="pol-technique">
                  {event.article_count} {event.article_count === 1 ? 'article' : 'articles'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ad-section" aria-labelledby="rep-publishers">
        <h4 className="ad-section-title" id="rep-publishers">Participating publishers</h4>
        <ul className="ai-chip-list" aria-label="Publishers">
          {publishers.map((publisher) => (
            <li key={publisher.name} className="ai-chip">
              {publisher.name}
              <span className="ai-chip-extra"> · {publisher.count} {publisher.count === 1 ? 'article' : 'articles'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ad-section" aria-labelledby="rep-coverage">
        <h4 className="ad-section-title" id="rep-coverage">Coverage by article</h4>
        {items.length === 0 ? (
          <EmptyState title="No articles to analyse" description="This story has no articles." />
        ) : (
          <DataTable
            columns={coverageColumns}
            rows={items.map((item) => ({ ...item, id: item.article.id }))}
            caption="Coverage by article"
          />
        )}
      </section>

      <section className="ad-section" aria-labelledby="rep-framing">
        <h4 className="ad-section-title" id="rep-framing">Framing differences</h4>
        {frames.length === 0 ? (
          <p className="ai-none">No framing cue was found in any analysed article.</p>
        ) : (
          <ul className="rep-frame-list" aria-label="Framing types used">
            {frames.map(({ frame, articles }) => (
              <li key={frame}>
                <StatusBadge variant="info">{frameInfo(frame).label}</StatusBadge>
                <span className="pol-technique">
                  {articles.length} of {items.length} articles ({sourceList(articles)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ad-section" aria-labelledby="rep-gaps">
        <h4 className="ad-section-title" id="rep-gaps">Shared and missing coverage</h4>
        {coverage.analysedCount < 2 ? (
          <p className="ai-none">Needs the insights of at least two articles.</p>
        ) : (
          <dl className="details-list details-list-wide">
            <div>
              <dt>Named by every analysed article</dt>
              <dd>
                {coverage.inAll.length > 0
                  ? coverage.inAll.map((row) => `${row.name} (${formatEntityType(row.type)})`).join(', ')
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt>Named by only some articles</dt>
              <dd>
                {coverage.inSome.length > 0 ? (
                  <ul className="rep-gap-list">
                    {coverage.inSome.slice(0, 15).map((row) => (
                      <li key={row.name}>
                        {row.name} ({formatEntityType(row.type)}): {sourceList(row.articles)}
                      </li>
                    ))}
                    {coverage.inSome.length > 15 && <li>and {coverage.inSome.length - 15} more</li>}
                  </ul>
                ) : (
                  'None'
                )}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="ad-section" aria-labelledby="rep-political">
        <h4 className="ad-section-title" id="rep-political">Political entities</h4>
        {items.every(({ analyses }) => !analyses.political || analyses.political.entities.length === 0) ? (
          <p className="ai-none">No political entity was found in the analysed articles.</p>
        ) : (
          <ul className="rep-frame-list">
            {items
              .filter(({ analyses }) => analyses.political?.entities.length > 0)
              .map(({ article, analyses }) => (
                <li key={article.id}>
                  <strong>{article.source_name || 'Unknown publisher'}</strong>
                  <span className="pol-technique">
                    {' '}
                    {analyses.political.entities
                      .map((entity) => `${entity.name} (${categoryLabel(entity.political_category)})`)
                      .join(', ')}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="ad-section" aria-labelledby="rep-evidence">
        <h4 className="ad-section-title" id="rep-evidence">Supporting evidence</h4>
        <p className="pol-explanation">Open an article to read the sentences behind its results.</p>
        {items.map(({ article, analyses }) => (
          <ArticleEvidence key={article.id} article={article} analyses={analyses} />
        ))}
      </section>

      <section className="ad-section" aria-labelledby="rep-limits" data-testid="report-limitations">
        <h4 className="ad-section-title" id="rep-limits">Limitations and uncertainty</h4>
        <ul className="rep-limit-list">
          <li>
            All results were found automatically, mostly by matching words from fixed lists. They
            are not checked facts and can be wrong.
          </li>
          <li>
            Tone is not bias, and one story says nothing about a publisher&apos;s politics in
            general.
          </li>
          <li>
            &quot;Named by only some articles&quot; does not prove that a publisher left something
            out on purpose.
          </li>
          <li>The backend has no report route: this report is put together in the browser and is not saved.</li>
          {publishers.length < 2 && (
            <li>
              <strong>Only one publisher</strong> covers this story, so publishers cannot be
              compared.
            </li>
          )}
          {notAnalysed > 0 && (
            <li>
              <strong>{notAnalysed} articles were not analysed</strong>: a report analyses at most{' '}
              {REPORT_ARTICLE_LIMIT}.
            </li>
          )}
          {headlineOnly.length > 0 && (
            <li>
              {headlineOnly.length} {headlineOnly.length === 1 ? 'article has' : 'articles have'} only a
              headline, so very little could be analysed.
            </li>
          )}
          {failed.map(({ article, analyses }) => (
            <li key={article.id}>
              Some analyses of &quot;{article.title}&quot; could not be loaded:{' '}
              {Object.values(analyses.errors).join('; ')}
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}

export default StoryReport
