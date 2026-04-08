const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEXTAREA'])

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSearchRegex(query: string): RegExp | null {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return null
  }

  return new RegExp(escapeRegExp(trimmedQuery), 'gi')
}

export interface HighlightedHtmlResult {
  html: string
  matchCount: number
}

export function buildHighlightedHtml(html: string, query: string, activeMatchIndex: number): HighlightedHtmlResult {
  const searchRegex = buildSearchRegex(query)
  if (!html || !searchRegex) {
    return {
      html,
      matchCount: 0,
    }
  }

  const parser = new DOMParser()
  const parsedDocument = parser.parseFromString(`<div id="finlex-search-root">${html}</div>`, 'text/html')
  const root = parsedDocument.getElementById('finlex-search-root')

  if (!root) {
    return {
      html,
      matchCount: 0,
    }
  }

  const nodeFilter = parsedDocument.defaultView?.NodeFilter ?? NodeFilter
  const textNodes: Text[] = []
  const walker = parsedDocument.createTreeWalker(
    root,
    nodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parentElement = node.parentElement
        const textContent = node.textContent || ''

        if (!parentElement || !textContent.trim()) {
          return nodeFilter.FILTER_REJECT
        }

        if (SKIP_TAGS.has(parentElement.tagName)) {
          return nodeFilter.FILTER_REJECT
        }

        return nodeFilter.FILTER_ACCEPT
      },
    },
  )

  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  const nodeMatches = textNodes
    .map((textNode) => {
      const text = textNode.textContent || ''
      const matches: Array<{ start: number, end: number }> = []
      searchRegex.lastIndex = 0

      let match: RegExpExecArray | null = searchRegex.exec(text)
      while (match) {
        const matchedText = match[0]
        if (!matchedText) {
          break
        }

        matches.push({
          start: match.index,
          end: match.index + matchedText.length,
        })

        if (matchedText.length === 0) {
          searchRegex.lastIndex += 1
        }

        match = searchRegex.exec(text)
      }

      return {
        textNode,
        text,
        matches,
      }
    })
    .filter((item) => item.matches.length > 0)

  const matchCount = nodeMatches.reduce((total, item) => total + item.matches.length, 0)
  if (matchCount === 0) {
    return {
      html,
      matchCount: 0,
    }
  }

  const activeIndex = Math.min(Math.max(activeMatchIndex, 0), matchCount - 1)
  let matchCursor = 0

  nodeMatches.forEach(({ textNode, text, matches }) => {
    const fragment = parsedDocument.createDocumentFragment()
    let lastIndex = 0

    matches.forEach(({ start, end }) => {
      if (start > lastIndex) {
        fragment.append(text.slice(lastIndex, start))
      }

      const highlight = parsedDocument.createElement('span')
      highlight.setAttribute('data-finlex-search-hit', 'true')
      highlight.setAttribute('data-finlex-search-index', String(matchCursor))
      highlight.style.backgroundColor = '#fff1a8'
      highlight.style.borderRadius = '2px'
      highlight.style.color = 'inherit'

      if (matchCursor === activeIndex) {
        highlight.setAttribute('data-finlex-search-active', 'true')
        highlight.style.backgroundColor = '#ffd24d'
        highlight.style.boxShadow = '0 0 0 2px rgba(255, 210, 77, 0.35)'
      }

      highlight.textContent = text.slice(start, end)
      fragment.append(highlight)
      lastIndex = end
      matchCursor += 1
    })

    if (lastIndex < text.length) {
      fragment.append(text.slice(lastIndex))
    }

    textNode.parentNode?.replaceChild(fragment, textNode)
  })

  return {
    html: root.innerHTML,
    matchCount,
  }
}