import React, { useEffect, useState } from 'react'
import Card from './Card'
import LoadingState from './LoadingState'
import AlertMessage from './AlertMessage'
import EmptyState from './EmptyState'
import StatusBadge from './StatusBadge'
import PoliticalCoverageComparison from './PoliticalCoverageComparison'
import {
  fetchAllStories,
  fetchArticleAnalyses,
  fetchStory,
  STORIES_AVAILABLE,
} from '../api/newsApi'
import { compareByName, pickDefaultPair } from '../utils/coverage'
import { formatEntityType } from '../utils/groupEntities'
import { formatDate } from '../utils/formatDate'
import { formatToneScore, frameInfo, toneInfo } from '../utils/toneLabels'

// "BBC News (Article A)"
function sideName(article, letter) {
  return `${article.source_name || 'Unknown publisher'} (Article ${letter})`
}

/**
 * One article's headline, tone and framing: one column of the comparison.
 */
function HeadlineColumn({ article, letter, analyses }) {
  const tone = analyses.tone
  return (
    <div className="cmp-column">
      <p className="pol-side-label">{sideName(article, letter)}</p>
      <p className="cmp-headline">{article.title}</p>
      <p className="ai-chip-extra">Published {formatDate(article.published_at)}</p>
      {tone ? (
        <>
          <p className="pol-evidence-label">Headline framing</p>
          {tone.headline_framing.frames.length > 0 ? (
            <div className="cmp-badges">
              {tone.headline_framing.frames.map((frame) => (
                <StatusBadge key={frame} variant="info">
                  {frameInfo(frame).label}
                </StatusBadge>
              ))}
              {tone.headline_framing.evidence_phrases.length > 0 && (
                <span className="pol-technique">
                  matched: {tone.headline_framing.evidence_phrases.map((phrase) => `“${phrase}”`).join(', ')}
                </span>
              )}
            </div>
          ) : (
            <p className="ai-none">No framing cue found.</p>
          )}
          <p className="pol-evidence-label">Tone of the article</p>
          <div className="cmp-badges">
            <StatusBadge variant={toneInfo(tone.tone.label).variant}>
              {toneInfo(tone.tone.label).label}
            </StatusBadge>
            <span className="pol-technique">score {formatToneScore(tone.tone.score)}</span>
          </div>
          <p className="pol-evidence-label">Framing signals in the text</p>
          <p className="ai-none">
            {tone.signals.length === 0
              ? 'None found.'
              : tone.signals.map((signal) => frameInfo(signal.frame_type).label).join(', ')}
          </p>
        </>
      ) : (
        <p className="ai-none">Tone and framing could not be loaded: {analyses.errors.tone}</p>
      )}
    </div>
  )
}

/**
 * Names in both articles, and names in only one of them.
 */
function NameCoverage({ title, comparison, nameA, nameB, describe }) {
  const listNames = (items) =>
    items.length > 0 ? items.map((item) => describe(item)).join(', ') : 'None'
  return (
    <div className="cmp-block">
      <h5 className="pol-subheading">{title}</h5>
      <dl className="details-list">
        <div>
          <dt>Named in both</dt>
          <dd>{listNames(comparison.shared.map((row) => row.a))}</dd>
        </div>
        <div>
          <dt>Only in {nameA}</dt>
          <dd>{listNames(comparison.onlyA)}</dd>
        </div>
        <div>
          <dt>Only in {nameB}</dt>
          <dd>{listNames(comparison.onlyB)}</dd>
        </div>
      </dl>
    </div>
  )
}

function FactColumn({ article, letter, insights, error }) {
  return (
    <div className="cmp-column">
      <p className="pol-side-label">{sideName(article, letter)}</p>
      {!insights ? (
        <p className="ai-none">Insights could not be loaded: {error}</p>
      ) : insights.facts.length === 0 ? (
        <p className="ai-none">No factual statements found.</p>
      ) : (
        <ul className="cmp-fact-list">
          {insights.facts.map((fact) => (
            <li key={fact.id}>
              <blockquote className="pol-evidence">“{fact.statement}”</blockquote>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * StoryComparison Component
 *
 * Compares two articles of the same story, ideally from different publishers:
 *   1. Headlines and framing (headline framing, tone, framing signals)
 *   2. People, organizations, places and topics named in both, or in only one
 *      (coverage gaps)
 *   3. The facts each article states, side by side
 *   4. Political coverage (the existing political comparison panel)
 *
 * Data: GET /stories (all pages), GET /stories/{id}, and for each of the two
 * articles GET /extraction, /tone-framing and /political-signals.
 * Everything is real backend data; this component only lines it up.
 */
export function StoryComparison() {
  const [stories, setStories] = useState([])
  const [isLoadingStories, setIsLoadingStories] = useState(STORIES_AVAILABLE)
  const [storiesError, setStoriesError] = useState('')
  const [storiesReloadCount, setStoriesReloadCount] = useState(0)

  const [storyId, setStoryId] = useState('')
  const [story, setStory] = useState(null)
  const [storyError, setStoryError] = useState('')
  const [pairIds, setPairIds] = useState(['', ''])

  // The analyses of the two articles, with the pair they belong to
  const [comparison, setComparison] = useState(null) // { pairKey, a, b }

  // 1. The stories that have 2 or more articles
  useEffect(() => {
    if (!STORIES_AVAILABLE) return undefined
    let isCurrentRequest = true
    fetchAllStories()
      .then(({ items }) => {
        if (!isCurrentRequest) return
        const comparable = items
          .filter((item) => item.article_count >= 2)
          .sort((x, y) => y.article_count - x.article_count)
        setStories(comparable)
      })
      .catch((error) => {
        if (isCurrentRequest) setStoriesError(error.message)
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingStories(false)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [storiesReloadCount])

  // 2. The chosen story, with its articles; then pick two to compare
  useEffect(() => {
    if (!storyId) return undefined
    let isCurrentRequest = true
    fetchStory(storyId)
      .then((result) => {
        if (!isCurrentRequest) return
        setStory(result)
        const pair = pickDefaultPair(result.articles)
        setPairIds(pair ? [String(pair[0].id), String(pair[1].id)] : ['', ''])
      })
      .catch((error) => {
        if (isCurrentRequest) setStoryError(error.message)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [storyId])

  // 3. The analyses of the two chosen articles
  // (fetchArticleAnalyses never fails: a failed analysis comes back as null)
  const [idA, idB] = pairIds
  const pairKey = `${idA}-${idB}`
  useEffect(() => {
    if (!idA || !idB || idA === idB) return undefined
    let isCurrentRequest = true
    Promise.all([fetchArticleAnalyses(idA), fetchArticleAnalyses(idB)]).then(([a, b]) => {
      if (isCurrentRequest) setComparison({ pairKey: `${idA}-${idB}`, a, b })
    })
    return () => {
      isCurrentRequest = false
    }
  }, [idA, idB])
  // Still loading while the shown analyses belong to another pair
  const analyses = comparison && comparison.pairKey === pairKey ? comparison : null

  function handleStoryChange(event) {
    setStoryId(event.target.value)
    setStory(null)
    setStoryError('')
    setComparison(null)
    setPairIds(['', ''])
  }

  function handleArticleChange(side, value) {
    setPairIds(side === 0 ? [value, idB] : [idA, value])
  }

  function retryStories() {
    setIsLoadingStories(true)
    setStoriesError('')
    setStoriesReloadCount(storiesReloadCount + 1)
  }

  function renderStoryPicker() {
    if (isLoadingStories) return <LoadingState message="Loading stories..." />
    if (storiesError) {
      return (
        <AlertMessage type="error" title="Could not load stories." message={storiesError} onRetry={retryStories} />
      )
    }
    if (stories.length === 0) {
      return (
        <EmptyState
          title="No story has two or more articles yet"
          description='Collect more news, then use "Group articles" on the Stories page.'
        />
      )
    }
    return (
      <div className="form-field">
        <label htmlFor="cmp-story" className="form-label">
          Story
        </label>
        <select id="cmp-story" className="form-input" value={storyId} onChange={handleStoryChange}>
          <option value="">Choose a story...</option>
          {stories.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.title} ({item.article_count} articles)
            </option>
          ))}
        </select>
      </div>
    )
  }

  function renderArticlePickers() {
    const articles = story.articles
    return (
      <div className="cmp-pickers">
        {['A', 'B'].map((letter, side) => (
          <div className="form-field" key={letter}>
            <label htmlFor={`cmp-article-${letter}`} className="form-label">
              Article {letter}
            </label>
            <select
              id={`cmp-article-${letter}`}
              className="form-input"
              value={pairIds[side]}
              onChange={(event) => handleArticleChange(side, event.target.value)}
            >
              {articles.map((article) => (
                <option key={article.id} value={String(article.id)}>
                  {article.source_name || 'Unknown publisher'}: {article.title}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    )
  }

  function renderComparison() {
    if (!storyId) return null
    if (storyError) {
      return <AlertMessage type="error" title="Could not load the story." message={storyError} />
    }
    if (!story) return <LoadingState message="Loading the story..." />

    const articleA = story.articles.find((article) => String(article.id) === idA)
    const articleB = story.articles.find((article) => String(article.id) === idB)
    if (!articleA || !articleB) {
      return <EmptyState title="Not enough articles" description="This story has fewer than two articles." />
    }

    const samePublisher = articleA.source_name === articleB.source_name
    let body
    if (idA === idB) {
      body = <AlertMessage type="info" message="Choose two different articles." />
    } else if (!analyses) {
      body = <LoadingState message="Loading the analyses of both articles..." />
    } else {
      const { a, b } = analyses
      const nameA = sideName(articleA, 'A')
      const nameB = sideName(articleB, 'B')
      const bothInsights = a.insights && b.insights
      body = (
        <>
          <div className="cmp-block">
            <h5 className="pol-subheading">Headlines and framing</h5>
            <div className="pol-compare-sides">
              <HeadlineColumn article={articleA} letter="A" analyses={a} />
              <HeadlineColumn article={articleB} letter="B" analyses={b} />
            </div>
          </div>

          {bothInsights ? (
            <>
              <NameCoverage
                title="People, organizations and places"
                comparison={compareByName(a.insights.entities, b.insights.entities)}
                nameA={nameA}
                nameB={nameB}
                describe={(entity) => `${entity.name} (${formatEntityType(entity.type)})`}
              />
              <NameCoverage
                title="Topics"
                comparison={compareByName(a.insights.topics, b.insights.topics)}
                nameA={nameA}
                nameB={nameB}
                describe={(topic) => topic.name}
              />
            </>
          ) : (
            <AlertMessage
              type="warning"
              title="Shared and missing coverage cannot be shown."
              message={`The insights of ${a.insights ? nameB : nameA} could not be loaded.`}
            />
          )}

          <div className="cmp-block">
            <h5 className="pol-subheading">Facts each article states</h5>
            <div className="pol-compare-sides">
              <FactColumn article={articleA} letter="A" insights={a.insights} error={a.errors.insights} />
              <FactColumn article={articleB} letter="B" insights={b.insights} error={b.errors.insights} />
            </div>
            <p className="ad-section-note">
              Facts are extracted from each article separately. The system does not check whether
              two facts say the same thing or contradict each other, so read them side by side.
            </p>
          </div>
        </>
      )
    }

    return (
      <>
        {renderArticlePickers()}
        {samePublisher && idA !== idB && (
          <AlertMessage
            type="info"
            message={`Both articles are from ${articleA.source_name || 'the same publisher'}, so this compares two articles of one publisher, not two publishers.`}
          />
        )}
        {body}
        {idA !== idB && <PoliticalCoverageComparison key={`${idA}-${idB}`} articleA={articleA} articleB={articleB} />}
      </>
    )
  }

  return (
    <Card
      title="Compare coverage of a story"
      subtitle="Two articles from the same story, side by side"
    >
      {!STORIES_AVAILABLE ? (
        <AlertMessage
          type="info"
          title="Story comparison needs the real backend."
          message="Set VITE_USE_MOCK_DATA=false in frontend/.env and restart the dev server."
        />
      ) : (
        <>
          {renderStoryPicker()}
          {renderComparison()}
          {storyId && (
            <p className="ad-section-note">
              Everything here was found automatically by the backend and can be wrong. A
              &quot;gap&quot; only means one article did not name something; it does not prove the
              publisher left it out on purpose. Two articles say nothing about a publisher&apos;s
              politics.
            </p>
          )}
        </>
      )}
    </Card>
  )
}

export default StoryComparison
