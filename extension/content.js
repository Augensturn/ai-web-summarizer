console.log('Content script injected');

// 获取正文函数
function getCleanText() {
  // 1. 标题
  const title = document.querySelector('h1')?.innerText || document.title;

  // 2. 副标题 h2, h3
  const subTitles = Array.from(document.querySelectorAll('h2, h3'))
    .map(el => el.innerText)
    .filter(t => t.trim().length > 0);

  // 3. 段落
  const paragraphs = Array.from(document.querySelectorAll('p'))
    .filter(p => {
      const text = p.innerText.trim();
      const style = window.getComputedStyle(p);
      // 去掉长度太短或不可见的
      return text.length > 10 && style.display !== 'none';
    })
    .map(p => p.innerText);

  // 4. 合并文本
  const content = [title, ...subTitles, ...paragraphs].join('\n\n');

  // 5. 截取前 5000 字
  return content.slice(0, 5000);
}

// 发送给 background
let textData = '';
try {
  console.log('开始提取正文');
  textData = getCleanText();
  console.log('提取内容长度：', textData.length);
  console.log('提取内容预览：', textData.slice(0, 200));
} catch (e) {
  console.error('提取内容失败：', e);
}

chrome.runtime.sendMessage(
  {
    type: 'PAGE_CONTENT',
    payload: {
      url: window.location.href,
      title: document.title,
      content: textData
    }
  },
  (resp) => {
    if (chrome.runtime.lastError) {
      console.error('发送消息失败：', chrome.runtime.lastError.message);
    } else {
      console.log('后台响应：', resp);
    }
  }
);
