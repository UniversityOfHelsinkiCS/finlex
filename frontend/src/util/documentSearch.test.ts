import { buildHighlightedHtml } from './documentSearch'

describe('buildHighlightedHtml', () => {
  it('highlights matches and marks the active hit', () => {
    const result = buildHighlightedHtml(
      '<p>Alpha beta alpha.</p><p>Gamma alpha.</p>',
      'alpha',
      1,
    )

    expect(result.matchCount).toBe(3)
    expect(result.html).toContain('data-finlex-search-hit="true"')
    expect(result.html).toContain('data-finlex-search-active="true"')
    expect(result.html).toContain('Alpha')
    expect(result.html).toContain('Gamma')
  })

  it('returns the original html when the query is empty', () => {
    const html = '<p>No search here.</p>'

    const result = buildHighlightedHtml(html, '   ', 0)

    expect(result.matchCount).toBe(0)
    expect(result.html).toBe(html)
  })
})