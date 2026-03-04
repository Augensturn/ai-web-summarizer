
/* =========================
   正文提取核心逻辑
========================= */

function getCleanText() {
  // ⚠️ 每次提取都重新选 root，避免被 remove 污染
  const root =
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.body;

  // 克隆一份，避免破坏原 DOM（非常重要）
  const clone = root.cloneNode(true);

  // 移除明显无关节点
  const removeSelectors = [
    'script',
    'style',
    'nav',
    'footer',
    'header',
    'aside',
    'noscript',
    'iframe',
    '.advertisement',
    '.ads',
    '.sidebar'
  ];

  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // 标题
  const title =
    document.querySelector('h1')?.innerText?.trim() ||
    document.title ||
    '';

  // 小标题
  const subTitles = Array.from(clone.querySelectorAll('h2, h3'))
    .map(el => el.innerText.trim())
    .filter(Boolean);

  // 正文段落
  const paragraphs = Array.from(clone.querySelectorAll('p'))
    .map(p => p.innerText.trim())
    .filter(text => text.length > 20);

  // 去重
  const uniqueParagraphs = Array.from(new Set(paragraphs));

  const blocks = [];

  if (title) blocks.push(`【标题】\n${title}`);
  if (subTitles.length)
    blocks.push(`【小标题】\n${subTitles.join('\n')}`);
  if (uniqueParagraphs.length)
    blocks.push(`【正文】\n${uniqueParagraphs.join('\n\n')}`);

  const result = blocks.join('\n\n');

  return result.slice(0, 5000);
}

/* =========================
   安全兜底提取
========================= */

function extractContentSafe() {
  let content = '';

  try {
    content = getCleanText();
  } catch (err) {
    console.error('[Content Script] 提取异常', err);
  }

  if (!content || content.length < 100) {
    console.warn('[Content Script] 正文过短，使用 body.innerText 兜底');
    content = document.body?.innerText?.slice(0, 3000) || '';
  }

  return content;
}

/* =========================
   主动发送正文（可选）
========================= */

let hasSent = false;

function sendPageContent() {
  if (hasSent) return;
  hasSent = true;
  chrome.runtime.sendMessage({
    type: 'PAGE_CONTENT',
    payload: {
      url: location.href,
      title: document.title,
      content
    }
  });
      }

// 页面稳定后发送（兼容 SPA）
if (document.readyState === 'complete') {
  sendPageContent();
} else {
  window.addEventListener('load', sendPageContent);
}

/* =========================
   响应 background 的请求（核心）
========================= */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'EXTRACT_PAGE_CONTENT') return;

  try {
    const content = extractContentSafe();

    sendResponse({
      success: true,
      payload: {
        url: location.href,
        title: document.title,
        content
      }
    });
  } catch (e) {
    console.error('[Content Script] 响应提取失败', e);
    sendResponse({
      success: false,
      error: e.message
    });
  }

  return true; // ⭐ 保证异步响应不被回收
});
