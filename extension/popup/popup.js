document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup 页面已加载');
  let currentContent = '';
  const summaryDisplay = document.getElementById('summary-display');
  const historyListEl = document.getElementById('history-list');
  const filterModeEl = document.getElementById('filter-mode');
  const tabSummaryBtn = document.getElementById('tab-summary-btn');
  const tabHistoryBtn = document.getElementById('tab-history-btn');
  const summaryPanel = document.getElementById('tab-summary-panel');
  const historyPanel = document.getElementById('tab-history-panel');

  let allHistory = [];
  let displayedCount = 0;
  const pageSize = 10;

  // 获取最近正文内容
  chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('获取内容失败：', chrome.runtime.lastError.message);
      chrome.storage.local.get(['lastContent'], (res) => {
        currentContent = res?.lastContent || '';
      });
      return;
    }
    currentContent = response?.content || '';
  });

  // 后台推送内容
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PAGE_CONTENT') {
      currentContent = message.payload?.content || '';
    }
  });

  // 生成 AI 总结
  document.getElementById('summarize-btn').addEventListener('click', () => {
    const btn = document.getElementById('summarize-btn');
    const content = currentContent || '';
    let mode = 'brief';
    const select = document.getElementById('mode-select');
    if (select && select.value) mode = select.value;

    btn.setAttribute('disabled', 'true');
    summaryDisplay.innerHTML = '<span class="loader"></span><span>生成中...</span>';

    chrome.runtime.sendMessage(
      { type: 'AI_SUMMARIZE', payload: { content, mode } },
      (response) => {
        if (chrome.runtime.lastError) {
          summaryDisplay.innerText = '生成失败';
          btn.removeAttribute('disabled');
          return;
        }
        const summary = response?.summary || '生成失败';
        summaryDisplay.innerHTML = renderMarkdown(summary);
        btn.removeAttribute('disabled');

        // 保存历史
        chrome.storage.local.get(['history'], (res) => {
          allHistory = res?.history || [];
          displayedCount = 0;
          renderHistory(historyListEl, allHistory, displayedCount, pageSize);
        });
      }
    );
  });

  // 清空历史
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (!confirm('确定要清空所有历史记录吗？此操作不可撤销。')) return;
    chrome.storage.local.set({ history: [] }, () => {
      allHistory = [];
      displayedCount = 0;
      historyListEl.innerHTML = '';
      summaryDisplay.innerText = '';
      alert('已清空所有历史记录');
    });
  });

  // 切换模式筛选
  filterModeEl.addEventListener('change', () => {
  displayedCount = 0;
  historyListEl.innerHTML = ''; // 清空旧列表
  renderHistory(historyListEl, allHistory, displayedCount, pageSize);
});


  // 滚动加载更多
  historyListEl.addEventListener('scroll', () => {
    if (historyListEl.scrollTop + historyListEl.clientHeight >= historyListEl.scrollHeight - 5) {
      renderHistory(historyListEl, allHistory, displayedCount, pageSize);
    }
  });

  // 加载历史
  chrome.storage.local.get(['history'], (res) => {
    allHistory = res?.history || [];
    displayedCount = 0;
    renderHistory(historyListEl, allHistory, displayedCount, pageSize);
  });

  function renderHistory(container, list, startIndex = 0, count = 10) {
  const modeFilter = filterModeEl.value;
  let filteredList = list;
  if (modeFilter !== 'all') {
    filteredList = list.filter(item => item.mode === modeFilter);
  }

  const end = Math.min(startIndex + count, filteredList.length);
  for (let i = startIndex; i < end; i++) {
    const record = filteredList[i];
    const item = document.createElement('div');
    item.style.borderBottom = '1px solid #ddd';
    item.style.padding = '6px 0';
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <b>${record.title || record.url}</b>
      <div>模式：${record.mode} | ${new Date(record.timestamp).toLocaleString()}</div>
    `;
    item.addEventListener('click', () => {
      document.getElementById('summary-display').innerHTML = renderMarkdown(record.summary);
      const tabSummaryBtn = document.getElementById('tab-summary-btn');
      const tabHistoryBtn = document.getElementById('tab-history-btn');
      const summaryPanel = document.getElementById('tab-summary-panel');
      const historyPanel = document.getElementById('tab-history-panel');
      tabSummaryBtn.classList.add('active');
      tabHistoryBtn.classList.remove('active');
      summaryPanel.classList.add('active');
      historyPanel.classList.remove('active');
    });
    container.appendChild(item);
  }
  displayedCount = end;
}

  function setActiveTab(name) {
    const isSummary = name === 'summary';
    tabSummaryBtn.classList.toggle('active', isSummary);
    tabHistoryBtn.classList.toggle('active', !isSummary);
    summaryPanel.classList.toggle('active', isSummary);
    historyPanel.classList.toggle('active', !isSummary);
  }
  tabSummaryBtn.addEventListener('click', () => setActiveTab('summary'));
  tabHistoryBtn.addEventListener('click', () => setActiveTab('history'));
  setActiveTab('summary');

});
