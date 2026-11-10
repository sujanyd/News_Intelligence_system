import React, { useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import DataTable from './DataTable'
import StatusBadge from './StatusBadge'
import { PrecisionBadge, TimeAgreementBadge } from './EventTimeInfo'
import { fetchArticleAnalyses } from '../api/newsApi'
import {
  dateRangeOf,
  groupFrames,
  nameCoverage,
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

function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`
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

      <p className="pol-evidence-label">Quotes</p>
      {insights ? (
        insights.quotes.length > 0 ? (
          <ul className="rep-evidence-list">
            {insights.quotes.map((quote) => (
              <li key={quote.id}>
                <blockquote className="pol-evidence">“{quote.text}”</blockquote>
                <span className="pol-explanation">— {quote.speaker_name || 'Speaker not identified'}</span>
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
 * Names in every article, and names in only some of them.
 */
function NameCoverageBlock({ title, coverage, describe }) {
  return (
    <section className="ad-section">
      <h4 className="ad-section-title">{title}</h4>
      {coverage.analysedCount < 2 ? (
        <p className="ai-none">Needs the insights of at least two articles.</p>
      ) : (
        <dl className="details-list details-list-wide">
          <div>
            <dt>In every analysed article</dt>
            <dd>{coverage.inAll.length > 0 ? coverage.inAll.map(describe).join(', ') : 'None'}</dd>
          </div>
          <div>
            <dt>In only some articles</dt>
            <dd>
              {coverage.inSome.length > 0 ? (
                <ul className="rep-gap-list">
                  {coverage.inSome.slice(0, 15).map((row) => (
                    <li key={row.name}>
                      {describe(row)}: {sourceList(row.articles)}
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
  )
}

/**
 * CoverageAnalysis Component
 *
 * Lines up the analyses of several articles about the same news: used inside
 * a saved comparison and a saved report. For each article (up to
 * REPORT_ARTICLE_LIMIT) it loads, one after the other,
 * GET /extraction, /tone-framing and /political-signals.
 *
 * Sections: summary, events, publishers, coverage by article, framing
 * differences, people/places and topics in every or only some articles,
 * facts by article, political entities, evidence, limitations.
 * Nothing is added: every number is a count of backend results.
 *
 * @param {Object} props
 * @param {Array} props.articles - the articles (from the comparison)
 * @param {Array} [props.events] - their events, when known
 * @param {string[]} [props.extraLimitations] - more limitation lines
 */
export function CoverageAnalysis({ articles, events = [], extraLimitations = [] }) {
  const [items, setItems] = useState([]) // [{ article, analyses }]
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCurrentRequest = true
    async function load() {
      const loaded = []
      // One article after the other, so the backend is not flooded.
      // fetchArticleAnalyses never fails: a failed analysis comes back as null.
      for (const article of articles.slice(0, REPORT_ARTICLE_LIMIT)) {
        const analyses = await fetchArticleAnalyses(article.id)
        if (!isCurrentRequest) return
        loaded.push({ article, analyses })
        setProgress(loaded.length)
      }
      setItems(loaded)
      setIsLoading(false)
    }
    load()
    return () => {
      isCurrentRequest = false
    }
  }, [articles])

  if (isLoading) {
    const total = Math.min(articles.length, REPORT_ARTICLE_LIMIT)
    return <LoadingState message={`Analysing article ${Math.min(progress + 1, total)} of ${total}...`} />
  }

  const publishers = publishersOf(articles)
  const dateRange = dateRangeOf(articles)
  const frames = groupFrames(items)
  const entities = nameCoverage(items, 'entities')
  const topics = nameCoverage(items, 'topics')
  const sortedEvents = sortEventsByTime(events)
  const notAnalysed = articles.length - items.length
  const failed = items.filter(({ analyses }) => Object.keys(analyses.errors).length > 0)
  const headlineOnly = articles.filter((article) => article.content_availability === 'headline_only')

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
      key: 'facts',
      label: 'Facts',
      render: ({ analyses }) => (analyses.insights ? analyses.insights.facts.length : 'Not loaded'),
    },
  ]

  return (
    <div className="rep-report" data-testid="coverage-analysis">
      <section className="ad-section" aria-labelledby="rep-summary">
        <h4 className="ad-section-title" id="rep-summary">Summary</h4>
        <dl className="details-list">
          <div>
            <dt>Articles</dt>
            <dd>{articles.length}</dd>
          </div>
          <div>
            <dt>Publishers</dt>
            <dd>{publishers.length}</dd>
          </div>
          <div>
            <dt>Events</dt>
            <dd>{events.length > 0 ? events.length : 'Not linked to an event'}</dd>
          </div>
          <div>
            <dt>Published between</dt>
            <dd>
              {dateRange ? `${formatDate(dateRange.first)} and ${formatDate(dateRange.last)}` : 'No dates given'}
            </dd>
          </div>
        </dl>
      </section>

      {sortedEvents.length > 0 && (
        <section className="ad-section" aria-labelledby="rep-events">
          <h4 className="ad-section-title" id="rep-events">Events</h4>
          <ul className="rep-event-list">
            {sortedEvents.map((event) => (
              <li key={event.id}>
                <strong>
                  Event #{event.id}: {formatEventTime(event)}
                </strong>
                <PrecisionBadge precision={event.event_time_precision} />
                <TimeAgreementBadge disagreement={event.event_time_disagreement} />
                <span className="pol-technique">{plural(event.article_count, 'article')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ad-section" aria-labelledby="rep-publishers">
        <h4 className="ad-section-title" id="rep-publishers">Participating publishers</h4>
        <ul className="ai-chip-list" aria-label="Publishers">
          {publishers.map((publisher) => (
            <li key={publisher.name} className="ai-chip">
              {publisher.name}
              <span className="ai-chip-extra"> · {plural(publisher.count, 'article')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ad-section" aria-labelledby="rep-coverage">
        <h4 className="ad-section-title" id="rep-coverage">Headlines, tone and framing by article</h4>
        <DataTable
          columns={coverageColumns}
          rows={items.map((item) => ({ ...item, id: item.article.id }))}
          caption="Coverage by article"
        />
      </section>

      <section className="ad-section" aria-labelledby="rep-framing">
        <h4 className="ad-section-title" id="rep-framing">Framing differences</h4>
        {frames.length === 0 ? (
          <p className="ai-none">No framing cue was found in any analysed article.</p>
        ) : (
          <ul className="rep-frame-list" aria-label="Framing types used">
            {frames.map(({ frame, articles: framed }) => (
              <li key={frame}>
                <StatusBadge variant="info">{frameInfo(frame).label}</StatusBadge>
                <span className="pol-technique">
                  {framed.length} of {items.length} articles ({sourceList(framed)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NameCoverageBlock
        title="People, organizations and places"
        coverage={entities}
        describe={(row) => `${row.name} (${formatEntityType(row.type)})`}
      />
      <NameCoverageBlock title="Topics" coverage={topics} describe={(row) => row.name} />

      <section className="ad-section" aria-labelledby="rep-facts">
        <h4 className="ad-section-title" id="rep-facts">Facts by article</h4>
        <ul className="rep-evidence-list" aria-label="Facts by article">
          {items.map(({ article, analyses }) => (
            <li key={article.id}>
              <strong>{articleName(article)}</strong>
              {!analyses.insights ? (
                <span className="ai-none">Not loaded: {analyses.errors.insights}</span>
              ) : analyses.insights.facts.length === 0 ? (
                <span className="ai-none">No factual statements found.</span>
              ) : (
                analyses.insights.facts.map((fact) => (
                  <blockquote key={fact.id} className="pol-evidence">
                    “{fact.statement}”
                  </blockquote>
                ))
              )}
            </li>
          ))}
        </ul>
        <p className="ad-section-note">
          Facts are extracted from each article separately. The system does not check whether two
          facts say the same thing or contradict each other, so it cannot list &quot;common&quot; or
          &quot;differing&quot; claims; read them side by side.
        </p>
      </section>

      <section className="ad-section" aria-labelledby="rep-political">
        <h4 className="ad-section-title" id="rep-political">Political entities</h4>
        {items.every(({ analyses }) => !analyses.political || analyses.political.entities.length === 0) ? (
          <p className="ai-none">No political entity was found in the analysed articles.</p>
        ) : (
          <ul className="rep-frame-list" aria-label="Political entities by article">
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
            are estimates, not checked facts, and can be wrong.
          </li>
          <li>
            Tone is not bias, and a few articles say nothing about a publisher&apos;s politics in
            general.
          </li>
          <li>
            &quot;In only some articles&quot; does not prove that a publisher left something out on
            purpose.
          </li>
          {extraLimitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {publishers.length < 2 && (
            <li>
              <strong>Only one publisher</strong> is included, so publishers cannot be compared.
            </li>
          )}
          {notAnalysed > 0 && (
            <li>
              <strong>{plural(notAnalysed, 'article')} not analysed</strong>: at most{' '}
              {REPORT_ARTICLE_LIMIT} are analysed here.
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
        {failed.length > 0 && (
          <AlertMessage type="warning" message="Some analyses are missing; see the limitations above." />
        )}
      </section>
    </div>
  )
}

export default CoverageAnalysis
