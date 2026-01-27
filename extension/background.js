console.log('Background service worker loaded');
const DASHSCOPE_API_KEY = 'sk-a5ed9a63ecf14b3d94e005bf62c17c85';
function buildPrompt(content, mode) {
  if (mode === 'brief') {
    return `
你是一个【网页精简摘要生成器】。

【严格要求】：
1. 只输出【一段话】
2. 不得超过【5 句话】
3. 不得分点
4. 不得解释背景

【任务】：
请对下面网页内容进行极简摘要：

网页内容：
${content.slice(0, 3000)}
`;
  }

  if (mode === 'points') {
    return `
你是一个信息提炼助手。
请将下面网页内容总结为【条目式要点列表】，每条不超过 20 字：
${content.slice(0, 3000)}
`;
  }

  if (mode === 'study') {
    return `
你是一个学习笔记整理助手。
请将下面网页内容整理成【学习笔记】，格式如下：
一、核心概念
二、关键结论
三、复习要点
内容：
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
//调用通义千问
async function callQwen(prompt) {
  const response = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          prompt
        },
        parameters: {
          temperature: 0.3
        }
      })
    }
  );
  const data = await response.json();

  return (
    data?.output?.text ||
    'AI 未返回有效总结结果'
  );
}

let lastContent = '';
let lastTitle = '';
let lastUrl = '';

// 监听 content script 发来的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息类型：', message?.type);

  if (message?.type === 'PAGE_CONTENT') {
    const content = message?.payload?.content || '';
    console.log('提取内容（长度）：', content.length);
    console.log('提取内容预览：', content.slice(0, 200));
    lastContent = content;
    lastTitle = message?.payload?.title || '';
    lastUrl = message?.payload?.url || '';
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastContent: content });
    }
    sendResponse({ status: 'received', length: content.length });
    return true;
  }

  if (message?.type === 'GET_PAGE_CONTENT') {
    const reply = () => sendResponse({ content: lastContent });
    if (!lastContent && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['lastContent'], (res) => {
        lastContent = res?.lastContent || '';
        reply();
      });
      return true;
    }
    reply();
    return true;
  }
  if (message.type === 'AI_SUMMARIZE') {
    const { content, mode = 'brief' } = message.payload;
    const prompt = buildPrompt(content, mode);
    const titlePrompt = buildTitlePrompt(content);
    console.log('mode:', mode);
    console.log('prompt preview:', prompt.slice(0, 200));

    Promise.all([callQwen(prompt), callQwen(titlePrompt)])
      .then(([summary, genTitle]) => {
        const title = (genTitle || '').trim() || lastTitle || sender.tab?.title || '';
        const newRecord = {
          url: lastUrl || sender.tab?.url || '',
          title,
          content,
          summary,
          mode,
          timestamp: Date.now()
        };
        chrome.storage.local.get(['history'], (res) => {
          const oldHistory = res?.history || [];
          const updatedHistory = [newRecord, ...oldHistory];
          chrome.storage.local.set({ history: updatedHistory });
        });
        sendResponse({ summary, title });
      })
      .catch(err => {
        console.error(err);
        sendResponse({ summary: 'AI 总结失败，请稍后重试' });
      });

    return true; // 一定要保留
  }
});
