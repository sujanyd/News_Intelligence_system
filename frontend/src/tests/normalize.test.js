import { describe, it, expect } from 'vitest'
import { toList, toSource, toArticle } from '../api/normalize'

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
  it('marks content as available, missing or unknown', () => {
    expect(toArticle({ id: 1, title: 'A', content: 'Some text' }).contentStatus).toBe('available')
    expect(toArticle({ id: 2, title: 'B', content: '' }).contentStatus).toBe('missing')
    expect(toArticle({ id: 3, title: 'C', content: null }).contentStatus).toBe('missing')
    expect(toArticle({ id: 4, title: 'D' }).contentStatus).toBe('unknown')
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
