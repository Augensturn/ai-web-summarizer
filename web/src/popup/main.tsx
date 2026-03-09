import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { createRoot } from 'react-dom/client'
import { renderMarkdown } from './md'
import 'antd/dist/reset.css'
import Tabs from 'antd/es/tabs'
import type { TabsProps } from 'antd/es/tabs'
import type { HistoryRecord } from './types'

import { SummaryTab } from './SummaryTab'
import { HistoryTab } from './HistoryTab'
import { LearnTab } from './LearnTab.tsx'

function App() {
  const [currentContent, setCurrentContent] = useState('')
  const [summary, setSummary] = useState('尚未生成')
  const [mode, setMode] = useState<'brief' | 'points' | 'study' | 'custom'>('custom')
  const [customPrompt, setCustomPrompt] = useState('')
  const [connectionError, setConnectionError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'learn'>('summary')
  const [allHistory, setAllHistory] = useState<HistoryRecord[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [filterMode, setFilterMode] = useState<'all' | 'brief' | 'points' | 'study'>('all')
  const [filterTag, setFilterTag] = useState<string | 'all'>('all')
  const [displayedCount, setDisplayedCount] = useState(0)
  const [libraryTags, setLibraryTags] = useState<string[]>([])
  const [summaryView, setSummaryView] = useState<'text' | 'mindmap'>('text')
  const [recommendMd, setRecommendMd] = useState('')
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendContext, setRecommendContext] = useState<{
    content: string
    summary: string
    mode: HistoryRecord['mode']
    userPrompt: string
  } | null>(null)
  const [currentRecordTs, setCurrentRecordTs] = useState<number | null>(null)
  const pageSize = 10
  const historyListRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const filteredHistory = useMemo(() => {
    let list = allHistory
    if (filterMode !== 'all') list = list.filter(r => r.mode === filterMode)
    if (filterTag !== 'all') list = list.filter(r => (r.tags || []).includes(filterTag as string))
    return list
  }, [allHistory, filterMode, filterTag])

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' }, (response: any) => {
      if (chrome.runtime.lastError || response?.error === 'NO_RECEIVER') {
        setConnectionError(true)
        setSummary('当前页面无法建立连接，已禁止生成总结')
        chrome.storage.local.get(['lastContent'], (res: any) => {
          setCurrentContent(res?.lastContent || '')
        })
        return
      }
      setConnectionError(false)
      setCurrentContent(response?.content || '')
    })

    const handler = (message: any) => {
      if (message?.type === 'PAGE_CONTENT') {
        setCurrentContent(message.payload?.content || '')
        setConnectionError(false)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => {
      chrome.runtime.onMessage.removeListener(handler)
    }
  }, [])

  useEffect(() => {
    chrome.storage.local.get(['history', 'allTags'], (res: any) => {
      const list: HistoryRecord[] = res?.history || []
      const storedTags: string[] = res?.allTags || []
      setAllHistory(list)
      setDisplayedCount(Math.min(pageSize, list.length))

      const tagSet = new Set<string>(storedTags)
      for (const r of list) {
        ;(r.tags || []).forEach(t => tagSet.add(t))
      }
      const merged = Array.from(tagSet).sort()
      setAllTags(merged)
      chrome.storage.local.set({ allTags: merged })
    })
  }, [])

  useEffect(() => {
    setDisplayedCount(0)
    setDisplayedCount(Math.min(pageSize, filteredHistory.length))
    const el = historyListRef.current
    if (el) el.scrollTop = 0
  }, [filterMode, filterTag, filteredHistory.length])

  useEffect(() => {
    const el = historyListRef.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
        setDisplayedCount((prev) => {
          const next = prev + pageSize
          return Math.min(next, filteredHistory.length)
        })
      }
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [filteredHistory])

  const summaryHtml = useMemo(() => renderMarkdown(summary), [summary])
  const recommendHtml = useMemo(() => renderMarkdown(recommendMd || ''), [recommendMd])
  const isEmptySummary = useMemo(() => {
    const s = (summary || '').trim()
    return s.length === 0 || s === '尚未生成'
  }, [summary])

  const onSummarize = () => {
    if (connectionError) return
    setLoading(true)
    chrome.runtime.sendMessage(
      { type: 'AI_SUMMARIZE',
        payload: {
          content: currentContent,
          mode,
          userPrompt: customPrompt
        } },
      (response: any) => {
        setLoading(false)
        const text = response?.summary || '生成失败'
        setSummary(text)
        // 每次重新生成总结时，清空之前的学习推荐，避免内容错位
        setRecommendMd('')
        chrome.storage.local.get(['history'], (res: any) => {
          const list: HistoryRecord[] = res?.history || []
          setAllHistory(list)
          if (list.length > 0) {
            // 新生成的一条记录会被追加在最前面
            setCurrentRecordTs(list[0].timestamp)
            setRecommendContext({
              content: list[0].content,
              summary: list[0].summary,
              mode: list[0].mode,
              userPrompt: customPrompt
            })
          }
        })
      }
    )
  }

  const onClearHistory = () => {
    chrome.storage.local.set({ history: [] }, () => {
      setAllHistory([])
      setDisplayedCount(0)
    })
  }

  const updateHistory = (updater: (list: HistoryRecord[]) => HistoryRecord[]) => {
    setAllHistory(prev => {
      const next = updater(prev)
      chrome.storage.local.set({ history: next })
      return next
    })
  }

  const ensureTagsExist = (tags: string[]) => {
    setAllTags(prev => {
      const set = new Set(prev)
      tags.forEach(t => set.add(t))
      const merged = Array.from(set).sort()
      chrome.storage.local.set({ allTags: merged })
      return merged
    })
  }

  const updateRecordTags = (ts: number, tags: string[]) => {
    updateHistory(list =>
      list.map(r => r.timestamp === ts ? { ...r, tags: Array.from(new Set(tags)) } : r)
    )
    ensureTagsExist(tags)
  }

  const updateRecordNote = (ts: number, note: string) => {
    updateHistory(list =>
      list.map(r => r.timestamp === ts ? { ...r, note } : r)
    )
  }

  const toggleSelectRecord = (ts: number, checked: boolean) => {
    setSelectedIds(prev => {
      if (checked) {
        if (prev.includes(ts)) return prev
        return [...prev, ts]
      }
      return prev.filter(id => id !== ts)
    })
  }

  const deleteSelectedRecords = () => {
    if (!selectedIds.length) return
    updateHistory(list => list.filter(r => !selectedIds.includes(r.timestamp)))
    setSelectedIds([])
  }

  const learnRecords = useMemo(
    () => allHistory.filter(r => (r.tags || []).length > 0),
    [allHistory]
  )

  const addCurrentSummaryToLibrary = () => {
    if (libraryTags.length === 0 || isEmptySummary) return
    updateHistory(list => {
      if (!list.length) return list
      const sorted = [...list].sort((a, b) => b.timestamp - a.timestamp)
      const target = sorted[0]
      const mergedTags = Array.from(new Set([...(target.tags || []), ...libraryTags]))
      return list.map(r =>
        r.timestamp === target.timestamp ? { ...r, tags: mergedTags } : r
      )
    })
    ensureTagsExist(libraryTags)
    setActiveTab('learn')
  }

  const createTag = (parentPath: string | null) => {
    const baseLabel = parentPath && parentPath !== 'all' ? parentPath : '根'
    const name = window.prompt(`在「${baseLabel}」下新建标签，请输入名称：`)
    if (!name) return
    const trimmed = name.trim()
    if (!trimmed) return
    const fullPath =
      parentPath && parentPath !== 'all'
        ? `${parentPath}/${trimmed}`
        : trimmed
    setAllTags(prev => {
      if (prev.includes(fullPath)) return prev
      const next = [...prev, fullPath].sort()
      chrome.storage.local.set({ allTags: next })
      return next
    })
  }

  const onGenerateRecommend = () => {
    if (connectionError) return
    if (isEmptySummary) return
    const ctx = recommendContext || {
      content: currentContent,
      summary,
      mode,
      userPrompt: customPrompt
    }
    setRecommendLoading(true)
    chrome.runtime.sendMessage(
      {
        type: 'AI_RECOMMEND',
        payload: {
          content: ctx.content,
          summary: ctx.summary,
          mode: ctx.mode,
          userPrompt: ctx.userPrompt
        }
      },
      (response: any) => {
        setRecommendLoading(false)
        const text = (response?.recommendation || '').trim()
        setRecommendMd(text || '未能生成有效的学习推荐')
        // 将推荐结果写回对应的历史记录，方便下次从历史记录打开时直接展示
        if (text && text.length > 0) {
          updateHistory(list => {
            if (!list.length) return list
            const targetTs =
              currentRecordTs ??
              [...list].sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp
            if (!targetTs) return list
            return list.map(r =>
              r.timestamp === targetTs ? { ...r, recommendation: text } : r
            )
          })
        }
      }
    )
  }






  return (
    <div style={{ width: 380, height: 600, padding: 12, display: 'flex', flexDirection: 'column' }}>
      <style>
        {`
        .md-content pre {
          background: #0f172a;
          color: #e2e8f0;
          padding: 8px 10px;
          border-radius: 6px;
          overflow: auto;
          font-size: 12px;
          line-height: 1.5;
        }
        .md-content code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .md-content .token.keyword { color: #c084fc; }
        .md-content .token.string { color: #22d3ee; }
        .md-content .token.number { color: #f97316; }
        .md-content .token.comment { color: #94a3b8; font-style: italic; }
        .md-content .token.tag { color: #60a5fa; }
        .md-content .token.attr-name { color: #34d399; }
        .md-content .token.attr-value { color: #f59e0b; }
        .md-content table {
          width: 100%;
          border-collapse: collapse;
        }
        .md-content td, .md-content th {
          border: 1px solid #e5e7eb;
          padding: 6px;
        }
        .md-content th {
          background: #f8fafc;
          font-weight: 600;
        }
        .md-content td.align-left, .md-content th.align-left { text-align: left; }
        .md-content td.align-right, .md-content th.align-right { text-align: right; }
        .md-content td.align-center, .md-content th.align-center { text-align: center; }
        .md-content.md-mindmap ul {
          list-style: none;
          padding-left: 0;
        }
        .md-content.md-mindmap li {
          position: relative;
          margin: 4px 0;
          padding-left: 16px;
        }
        .md-content.md-mindmap li::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 0.8em;
          width: 8px;
          height: 0;
          border-top: 1px solid #cbd5f5;
        }
        .md-content.md-mindmap li::after {
          content: '';
          position: absolute;
          left: 4px;
          top: -4px;
          bottom: -4px;
          border-left: 1px solid #e2e8f0;
        }
        .md-content.md-mindmap > ul > li::after {
          top: 0.8em;
        }
        `}
      </style>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        destroyInactiveTabPane
        items={[
          {
            key: 'summary',
            label: 'AI 总结',
            children: (
              <SummaryTab
                connectionError={connectionError}
                mode={mode}
                setMode={setMode}
                customPrompt={customPrompt}
                setCustomPrompt={setCustomPrompt}
                onSummarize={onSummarize}
                loading={loading}
                isEmptySummary={isEmptySummary}
                summaryHtml={summaryHtml}
                summaryText={summary}
                allTags={allTags}
                libraryTags={libraryTags}
                setLibraryTags={setLibraryTags}
                onAddToLibrary={addCurrentSummaryToLibrary}
                summaryView={summaryView}
                setSummaryView={setSummaryView}
                recommendHtml={recommendHtml}
                recommendLoading={recommendLoading}
                onGenerateRecommend={onGenerateRecommend}
              />
            ),
          },
          {
            key: 'history',
            label: '历史记录',
            children: (
              <HistoryTab
                filterMode={filterMode}
                setFilterMode={setFilterMode}
                filterTag={filterTag}
                setFilterTag={setFilterTag}
                allTags={allTags}
                onClearHistory={onClearHistory}
                historyListRef={historyListRef as React.RefObject<HTMLDivElement>}
                filteredHistory={filteredHistory}
                displayedCount={displayedCount}
                onRecordClick={(record) => {
                  setSummary(record.summary)
                  // 从历史记录打开问答时，切换当前记录，并恢复该条已有的学习推荐（如果有）
                  setCurrentRecordTs(record.timestamp)
                  setRecommendMd(record.recommendation || '')
                  setRecommendContext({
                    content: record.content,
                    summary: record.summary,
                    mode: record.mode,
                    userPrompt: ''
                  })
                  setActiveTab('summary')
                }}
                onUpdateTags={updateRecordTags}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectRecord}
                onBatchDelete={deleteSelectedRecords}
              />
            ),
          },
          {
            key: 'learn',
            label: '学习库',
            children: (
              <LearnTab
                records={learnRecords}
                allTags={allTags}
                onUpdateTags={updateRecordTags}
                onUpdateNote={updateRecordNote}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectRecord}
                onBatchDelete={deleteSelectedRecords}
                onCreateTag={createTag}
              />
            ),
          },

        ] as TabsProps['items']}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
