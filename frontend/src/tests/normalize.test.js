import { describe, it, expect } from 'vitest'
import {
  toList,
  toSource,
  toArticle,
  toIngestionResult,
  toEmbeddingResult,
  toEmbeddingResultList,
  toSimilarArticleMatch,
  toSimilarArticlesResponse,
} from '../api/normalize'

describe('toList', () => {
  it('accepts a plain array', () => {
    expect(toList([{ id: 1 }], 'source')).toEqual({ items: [{ id: 1 }], total: null })
  })

  it('accepts an object with items and total', () => {
    expect(toList({ items: [], total: 12 }, 'article')).toEqual({ items: [], total: 12 })
  })

  it('throws for anything else', () => {
    expect(() => toList({ data: [] }, 'article')).toThrow(
      'The backend sent the article list in an unexpected format.'
    )
    expect(() => toList(null, 'source')).toThrow()
  })
})

describe('toSource', () => {
  it('keeps the known fields', () => {
    const source = toSource({ id: 1, name: 'Daily Ledger', base_url: 'https://a.example', extra: true })
    expect(source).toEqual({ id: 1, name: 'Daily Ledger', base_url: 'https://a.example', created_at: null })
  })

  it('throws when id or name is missing', () => {
    expect(() => toSource({ name: 'No id' })).toThrow('news source in an unexpected format')
    expect(() => toSource({ id: 1 })).toThrow()
    expect(() => toSource('text')).toThrow()
  })
})

describe('toArticle', () => {
  it('keeps content_availability from the backend', () => {
    expect(toArticle({ id: 1, title: 'A', content_availability: 'full_text' }).content_availability)
      .toBe('full_text')
    expect(toArticle({ id: 2, title: 'B', content_availability: 'headline_only' }).content_availability)
      .toBe('headline_only')
  })

  it('does not make up content or availability when they are missing', () => {
    const article = toArticle({ id: 3, title: 'C' })
    expect(article.content_availability).toBeNull()
    expect(article.content).toBeNull()
  })

  it('fills missing optional fields with safe values', () => {
    const article = toArticle({ id: 5, title: 'E' })
    expect(article.source_id).toBeNull()
    expect(article.source_name).toBeNull()
    expect(article.url).toBe('')
    expect(article.published_at).toBeNull()
  })

  it('throws when id or title is missing', () => {
    expect(() => toArticle({ id: 1 })).toThrow('article in an unexpected format')
    expect(() => toArticle([])).toThrow()
  })
})

describe('toIngestionResult', () => {
  it('keeps only the counts the backend sent', () => {
    const result = toIngestionResult({ feeds_attempted: 5, articles_inserted: 0, something_else: 9 })
    expect(result.counts).toEqual([
      { key: 'feeds_attempted', label: 'Feeds attempted', value: 5 },
      { key: 'articles_inserted', label: 'New articles inserted', value: 0 },
    ])
    expect(result.feeds).toEqual([])
  })

  it('reads the per-feed details', () => {
    const result = toIngestionResult({
      details: [
        { source_name: 'BBC News', feed_url: 'https://bbc.example/rss', status: 'error',
          articles_inserted: 0, articles_skipped_duplicate: 0, error: 'HTTP 503' },
        'not an object',
      ],
    })
    expect(result.feeds).toEqual([
      { id: 0, source_name: 'BBC News', feed_url: 'https://bbc.example/rss', status: 'error',
        articles_inserted: 0, articles_skipped_duplicate: 0, error: 'HTTP 503' },
    ])
  })

  it('rejects a reply that is not an object', () => {
    expect(() => toIngestionResult([1, 2])).toThrow('unexpected format')
  })
})

describe('toEmbeddingResult', () => {
  it('normalizes valid embedding response from backend', () => {
    const raw = {
      article_id: 101,
      embedding_type: 'headline',
      status: 'generated',
      model_name: 'all-MiniLM-L6-v2',
      vector_reference: 'art_101_headline_vec',
      dimensions: 384,
      error: null,
    }
    const result = toEmbeddingResult(raw)
    expect(result).toEqual(raw)
  })

  it('handles optional fields gracefully', () => {
    const raw = {
      article_id: 102,
      embedding_type: 'body',
      status: 'error',
      error: 'Text too short',
    }
    const result = toEmbeddingResult(raw)
    expect(result.article_id).toBe(102)
    expect(result.embedding_type).toBe('body')
    expect(result.status).toBe('error')
    expect(result.model_name).toBe('unknown')
    expect(result.vector_reference).toBeNull()
    expect(result.dimensions).toBeNull()
    expect(result.error).toBe('Text too short')
  })

  it('throws for invalid format', () => {
    expect(() => toEmbeddingResult(null)).toThrow('unexpected format')
    expect(() => toEmbeddingResult({ article_id: 101 })).toThrow('unexpected format')
  })
})

describe('toEmbeddingResultList', () => {
  it('maps an array of embedding items', () => {
    const raw = [
      {
        article_id: 101,
        embedding_type: 'headline',
        status: 'generated',
        model_name: 'all-MiniLM-L6-v2',
        dimensions: 384,
      },
    ]
    const list = toEmbeddingResultList(raw)
    expect(list.length).toBe(1)
    expect(list[0].dimensions).toBe(384)
  })

  it('throws if input is not an array', () => {
    expect(() => toEmbeddingResultList({ not: 'an array' })).toThrow('unexpected format')
  })
})

describe('toSimilarArticleMatch', () => {
  it('normalizes a valid match from backend', () => {
    const raw = {
      article_id: 103,
      title: 'Commuters react to planned bus route changes',
      source_name: 'Metro Times',
      source_id: 3,
      url: 'https://metrotimes.example/local/bus-route-changes',
      published_at: '2026-10-25T17:45:00Z',
      similarity_score: 0.884,
      embedding_type: 'headline',
      model_name: 'all-MiniLM-L6-v2',
      vector_id: 'art_103_headline_vec',
    }
    const result = toSimilarArticleMatch(raw)
    expect(result).toEqual(raw)
  })

  it('provides safe fallbacks for optional fields', () => {
    const raw = {
      article_id: 104,
      similarity_score: 0.72,
    }
    const result = toSimilarArticleMatch(raw)
    expect(result.article_id).toBe(104)
    expect(result.similarity_score).toBe(0.72)
    expect(result.title).toBe('Untitled article')
    expect(result.source_name).toBeNull()
    expect(result.source_id).toBeNull()
    expect(result.url).toBe('')
    expect(result.embedding_type).toBe('headline')
  })

  it('throws for invalid match payload', () => {
    expect(() => toSimilarArticleMatch(null)).toThrow('unexpected format')
    expect(() => toSimilarArticleMatch({ title: 'No ID or score' })).toThrow('unexpected format')
  })
})

describe('toSimilarArticlesResponse', () => {
  it('normalizes full similarity response', () => {
    const raw = {
      query_article_id: 101,
      query_title: 'City council approves new budget',
      embedding_type: 'headline',
      model_name: 'all-MiniLM-L6-v2',
      total_matches: 1,
      matches: [
        {
          article_id: 103,
          title: 'Commuters react',
          similarity_score: 0.88,
        },
      ],
    }
    const result = toSimilarArticlesResponse(raw)
    expect(result.query_article_id).toBe(101)
    expect(result.total_matches).toBe(1)
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].similarity_score).toBe(0.88)
  })

  it('throws for invalid response format', () => {
    expect(() => toSimilarArticlesResponse(null)).toThrow('unexpected format')
    expect(() => toSimilarArticlesResponse({ matches: 'not an array' })).toThrow('unexpected format')
  })
})


