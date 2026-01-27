function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyInline(s) {
  let t = escapeHtml(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}

function renderMarkdown(md) {
  const lines = (md || '').split(/\r?\n/);
  const out = [];
  let inUL = false;
  let inOL = false;

  function closeLists() {
    if (inUL) { out.push('</ul>'); inUL = false; }
    if (inOL) { out.push('</ol>'); inOL = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimRight();

    if (line.trim() === '') {
      closeLists();
      out.push('<br/>');
      continue;
    }

    const mZhTitle = line.match(/^([一二三四五六七八九十]+)、\s*(.+)$/);
    if (mZhTitle) {
      closeLists();
      out.push('<h3>' + applyInline(mZhTitle[1] + '、' + mZhTitle[2]) + '</h3>');
      continue;
    }

    const mOL = line.match(/^\d+\.\s+(.*)$/);
    if (mOL) {
      if (!inOL) { closeLists(); out.push('<ol>'); inOL = true; }
      out.push('<li>' + applyInline(mOL[1]) + '</li>');
      continue;
    }

    const mUL = line.match(/^[-*]\s+(.*)$/);
    if (mUL) {
      if (!inUL) { closeLists(); out.push('<ul>'); inUL = true; }
      out.push('<li>' + applyInline(mUL[1]) + '</li>');
      continue;
    }

    closeLists();
    out.push('<p>' + applyInline(line) + '</p>');
  }

  closeLists();
  return out.join('\n');
}
