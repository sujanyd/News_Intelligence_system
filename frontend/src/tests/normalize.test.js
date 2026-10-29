import { describe, it, expect } from 'vitest'
import { toList, toSource, toArticle, toIngestionResult } from '../api/normalize'

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
    const result = toIngestionResult({ feeds_attempted: 3, articles_inserted: 0, something_else: 9 })
    expect(result.counts).toEqual([
      { key: 'feeds_attempted', label: 'Feeds attempted', value: 3 },
      { key: 'articles_inserted', label: 'New articles inserted', value: 0 },
    ])
    expect(result.errors).toBeNull()
  })

  it('turns feed errors into messages', () => {
    const result = toIngestionResult({ errors: ['timeout', { message: 'bad XML' }] })
    expect(result.errors).toEqual(['timeout', 'bad XML'])
  })

  it('rejects a reply that is not an object', () => {
    expect(() => toIngestionResult([1, 2])).toThrow('unexpected format')
  })
})
