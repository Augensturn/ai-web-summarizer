console.log('Background service worker loaded');

const DASHSCOPE_API_KEY = 'sk-a5ed9a63ecf14b3d94e005bf62c17c85';

/* ================= Prompt 构造 ================= */

function buildPrompt(content, mode, userPrompt = '') {
  if (mode === 'brief') {
    return `
你是一个【网页精简摘要生成器】。

【严格要求】：
1. 只输出【一段话】
2. 不得少于【5 句话】

【任务】：
${userPrompt}
请对下面网页内容进行极简摘要：

网页内容：
${content.slice(0, 3000)}
`;
  }

  if (mode === 'points') {
    return `
你是一个信息提炼助手。
${userPrompt}
请将下面网页内容总结为【条目式要点列表】，每条不少于 10 字：
${content.slice(0, 3000)}
`;
  }

  if (mode === 'study') {
    return `
你是一个学习笔记整理助手。
${userPrompt}
请将下面网页内容整理成【学习笔记】，格式如下：
一、核心概念
二、关键结论
三、复习要点

内容：
${content.slice(0, 3000)}
`;
  }

  if (mode === 'custom') {
    return `
${userPrompt}
请基于下面网页内容完成上述要求：

${content.slice(0, 3000)}
`;
  }

  return content;
}

function buildTitlePrompt(content) {
  return `
请为下面内容生成一个中文标题，不超过20字，要求精准、可读、避免标点符号过多：
${content.slice(0, 3000)}
`;
}

/* ================= 调用通义千问 ================= */

async function callQwen(prompt) {
  const response = await fetch(
    'http://localhost:3000/api/qwen',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
      })
    }
  );

  const data = await response.json();
  return data?.output?.text || 'AI 未返回有效结果';
}

function isRestrictedUrl(url = '') {
  return /^(chrome|edge|about|view-source):/i.test(url) || /^https?:\/\/chrome\.google\.com\//i.test(url);
}

function extractFromTab(tab, retry = 3) {
  return new Promise((resolve) => {
    if (!tab?.id || isRestrictedUrl(tab.url)) {
      resolve(null);
      return;
    }
    
    // 首先尝试直接发送消息
    chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_CONTENT' }, (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        console.log('Content script not ready, attempting injection...', chrome.runtime.lastError);
        
        if (retry <= 0 || isRestrictedUrl(tab.url)) {
          chrome.storage.local.set({ connectionError: true });
          resolve(null);
          return;
        }
        
        // 注入 content.js 并等待更长时间
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: ['content.js'] },
          () => {
            // 增加等待时间，确保 content script 完全加载
            setTimeout(() => {
              extractFromTab(tab, retry - 1).then(resolve);
            }, 500); // 从 200ms 增加到 500ms
          }
        );
      } else {
        chrome.storage.local.set({ connectionError: false });
        resolve(res.payload);
      }
    });
  });
}

function cacheAndBroadcast(payload) {
  if (!payload) return;
  chrome.storage.local.set({
    lastContent: payload.content || '',
    lastMeta: { url: payload.url || '', title: payload.title || '' }
  });
  chrome.runtime.sendMessage({ type: 'PAGE_CONTENT', payload });
}

function tryExtractAndCache(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab || isRestrictedUrl(tab.url)) return;
    extractFromTab(tab, 2).then((payload) => {
      if (payload) cacheAndBroadcast(payload);
    });
  });
}

/* ================= 核心：消息监听 ================= */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息：', message?.type);

  if (message.type === 'PAGE_CONTENT') {
    cacheAndBroadcast(message.payload);
    sendResponse({ ok: true });
    return true;
  }

  /**
   * ⭐ 关键修复点：
   * popup 请求内容时，不再用缓存
   * 而是实时向「当前激活 tab」发送消息
   */
  if (message.type === 'GET_PAGE_CONTENT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || isRestrictedUrl(tab.url)) {
        chrome.storage.local.set({ connectionError: true });
        sendResponse({ error: 'NO_RECEIVER', content: '' });
        return;
      }

      extractFromTab(tab, 2).then((payload) => {
        if (payload) {
          cacheAndBroadcast(payload);
          sendResponse(payload);
        } else {
          chrome.storage.local.set({ connectionError: true });
          sendResponse({ error: 'NO_RECEIVER', content: '' });
        }
      });
    });

    return true; // 必须
  }

  /**
   * AI 总结
   */
  if (message.type === 'AI_SUMMARIZE') {
    const { content, mode = 'custom', userPrompt = '' } = message.payload;

    const prompt = buildPrompt(content, mode, userPrompt);
    const titlePrompt = buildTitlePrompt(content);

    Promise.all([callQwen(prompt), callQwen(titlePrompt)])
      .then(([summary, genTitle]) => {
        const record = {
          url: sender.tab?.url || '',
          title: genTitle?.trim() || sender.tab?.title || '',
          content,
          summary,
          mode,
          timestamp: Date.now()
        };

        chrome.storage.local.get(['history'], (res) => {
          const history = res?.history || [];
          chrome.storage.local.set({
            history: [record, ...history]
          });
        });

        sendResponse({
          summary: record.summary,
          title: record.title
        });
      })
      .catch(err => {
        console.error(err);
        sendResponse({ summary: 'AI 总结失败' });
      });

    return true;
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  tryExtractAndCache(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.active) {
    tryExtractAndCache(tabId);
  }
});
