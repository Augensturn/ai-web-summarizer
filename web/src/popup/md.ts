export function renderMarkdown(md: string) {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  const applyInline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')

  const lines = (md || '').split(/\r?\n/)
  const out: string[] = []
  let inUL = false
  let inOL = false
  let inTable = false
  let codeBuffer: string[] | null = null
  let codeLang = ''
  let tableAligns: ('left' | 'right' | 'center' | 'none')[] = []
  const closeLists = () => {
    if (inUL) {
      out.push('</ul>')
      inUL = false
    }
    if (inOL) {
      out.push('</ol>')
      inOL = false
    }
  }
  const closeTable = () => {
    if (inTable) {
      out.push('</tbody></table>')
      inTable = false
      tableAligns = []
    }
  }
  const highlightCode = (text: string, lang: string) => {
    let t = escape(text)
    if (lang === 'json') {
      t = t
        .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="token string">$1</span>$2')
        .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="token string">$1</span>')
        .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="token number">$&</span>')
        .replace(/\b(true|false|null)\b/g, '<span class="token keyword">$1</span>')
    } else {
      t = t
        .replace(/\/\*[\s\S]*?\*\//g, '<span class="token comment">$&</span>')
        .replace(/(^|[^:])\/\/.*$/gm, '$1<span class="token comment">$&</span>')
        .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '<span class="token string">$&</span>')
        .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="token number">$&</span>')
        .replace(/\b(async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield)\b/g, '<span class="token keyword">$1</span>')
      if (lang === 'jsx' || lang === 'tsx' || lang === 'html') {
        t = t
          .replace(/&lt;\/?([A-Za-z][\\w.-]*)/g, '&lt;<span class="token tag">$1</span>')
          .replace(/([\\s])([A-Za-z_:][\\w:.-]*)(=)/g, '$1<span class="token attr-name">$2</span>$3')
          .replace(/=(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g, '=<span class="token attr-value">$1</span>')
      }
    }
    return t
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === '') {
      if (codeBuffer) {
        codeBuffer.push('')
        continue
      }
      closeLists()
      closeTable()
      out.push('<br/>')
      continue
    }
    const mFence = line.match(/^\s*(```|~~~)\s*(\S+)?\s*$/)
    if (mFence) {
      if (!codeBuffer) {
        closeLists()
        closeTable()
        codeBuffer = []
        codeLang = ((mFence[2] || '').toLowerCase())
      } else {
        const highlighted = highlightCode(codeBuffer.join('\n'), codeLang)
        out.push('<pre class="md-code"><code class="lang-' + (codeLang || 'text') + '">' + highlighted + '</code></pre>')
        codeBuffer = null
        codeLang = ''
      }
      continue
    }
    if (codeBuffer) {
      codeBuffer.push(raw)
      continue
    }
    const mHeading = line.match(/^#{1,6}\s+(.*)$/)
    if (mHeading) {
      closeLists()
      closeTable()
      const level = line.indexOf(' ')
      const text = line.slice(level + 1)
      out.push('<h' + level + '>' + applyInline(text) + '</h' + level + '>')
      continue
    }
    if (/^---+$/.test(line)) {
      closeLists()
      closeTable()
      out.push('<hr/>')
      continue
    }
    const mQuote = line.match(/^>\s+(.*)$/)
    if (mQuote) {
      closeLists()
      closeTable()
      out.push('<blockquote><p>' + applyInline(mQuote[1]) + '</p></blockquote>')
      continue
    }
    if (line.includes('|')) {
      const next = (lines[i + 1] || '').trim()
      if (!inTable) {
        closeLists()
        const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0)
        const alignRow = next.match(/^\|?\s*[:\-]+(?:\s*\|\s*[:\-]+)+\s*\|?$/)
        if (alignRow) {
          const rawAligns = next.split('|').map(c => c.trim()).filter(c => c.length > 0)
          tableAligns = rawAligns.map(a => {
            const left = a.startsWith(':')
            const right = a.endsWith(':')
            if (left && right) return 'center'
            if (right) return 'right'
            if (left) return 'left'
            return 'none'
          })
          out.push('<table><thead><tr>' + cells.map((c, idx) => {
            const cls = tableAligns[idx] ? 'align-' + tableAligns[idx] : ''
            return '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + applyInline(c) + '</th>'
          }).join('') + '</tr></thead><tbody>')
          inTable = true
          i += 1
          continue
        } else {
          out.push('<table><tbody>')
          inTable = true
        }
      }
      const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0)
      if (cells.length) {
        out.push('<tr>' + cells.map((c, idx) => {
          const cls = tableAligns[idx] ? 'align-' + tableAligns[idx] : ''
          return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + applyInline(c) + '</td>'
        }).join('') + '</tr>')
      }
      continue
    } else {
      closeTable()
    }
    const mZhTitle = line.match(/^([一二三四五六七八九十]+)、\s*(.+)$/)
    if (mZhTitle) {
      closeLists()
      closeTable()
      out.push('<h3>' + applyInline(mZhTitle[1] + '、' + mZhTitle[2]) + '</h3>')
      continue
    }
    const mTaskChecked = line.match(/^[-*]\s+\[[xX]\]\s+(.*)$/)
    if (mTaskChecked) {
      if (!inUL) {
        closeLists()
        closeTable()
        out.push('<ul>')
        inUL = true
      }
      out.push('<li><label><input type="checkbox" disabled checked/> <span>' + applyInline(mTaskChecked[1]) + '</span></label></li>')
      continue
    }
    const mTaskUnchecked = line.match(/^[-*]\s+\[\s\]\s+(.*)$/)
    if (mTaskUnchecked) {
      if (!inUL) {
        closeLists()
        closeTable()
        out.push('<ul>')
        inUL = true
      }
      out.push('<li><label><input type="checkbox" disabled/> <span>' + applyInline(mTaskUnchecked[1]) + '</span></label></li>')
      continue
    }
    const mOL = line.match(/^\d+\.\s+(.*)$/)
    if (mOL) {
      if (!inOL) {
        closeLists()
        closeTable()
        out.push('<ol>')
        inOL = true
      }
      out.push('<li>' + applyInline(mOL[1]) + '</li>')
      continue
    }
    const mUL = line.match(/^[-*]\s+(.*)$/)
    if (mUL) {
      if (!inUL) {
        closeLists()
        closeTable()
        out.push('<ul>')
        inUL = true
      }
      out.push('<li>' + applyInline(mUL[1]) + '</li>')
      continue
    }
    closeLists()
    closeTable()
    out.push('<p>' + applyInline(line) + '</p>')
  }
  closeLists()
  closeTable()
  return out.join('\n')
}
