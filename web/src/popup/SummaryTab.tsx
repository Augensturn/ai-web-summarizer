import { Suspense, lazy } from 'react'
import Space from 'antd/es/space'
import Alert from 'antd/es/alert'
import Select from 'antd/es/select'
import Input from 'antd/es/input'
import Button from 'antd/es/button'
import Card from 'antd/es/card'
import { MindMapView } from './MindMapView'

const LazySpin = lazy(() => import('antd/es/spin'))
const LazyEmpty = lazy(() => import('antd/es/empty'))

interface SummaryTabProps {
  connectionError: boolean
  mode: 'brief' | 'study' | 'custom'
  setMode: (mode: 'brief' | 'study' | 'custom') => void
  customPrompt: string
  setCustomPrompt: (prompt: string) => void
  onSummarize: () => void
  loading: boolean
  isEmptySummary: boolean
  summaryHtml: string
  summaryText: string
  allTags: string[]
  libraryTags: string[]
  setLibraryTags: (tags: string[]) => void
  onAddToLibrary: () => void
  summaryView: 'text' | 'mindmap'
  setSummaryView: (v: 'text' | 'mindmap') => void
  recommendHtml: string
  recommendLoading: boolean
  onGenerateRecommend: () => void
}

export function SummaryTab({
  connectionError,
  mode,
  setMode,
  customPrompt,
  setCustomPrompt,
  onSummarize,
  loading,
  isEmptySummary,
  summaryHtml,
  summaryText,
  allTags,
  libraryTags,
  setLibraryTags,
  onAddToLibrary,
  summaryView,
  setSummaryView,
  recommendHtml,
  recommendLoading,
  onGenerateRecommend
}: SummaryTabProps) {

  return (
    <Space vertical style={{ width: '100%' }} size="small">
      {connectionError && <Alert type="error" message="当前页面无法建立连接，已禁止生成总结" />}
      <Select
        value={mode}
        onChange={(v) => setMode(v as any)}
        options={[
          { value: 'custom', label: '问答' },
          { value: 'brief', label: '精简摘要' },
          { value: 'study', label: '学习笔记' },
        ]}
        style={{ width: '100%' }}
      />
      <Input.TextArea
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        placeholder="例如：面向小白解释、突出技术点、适合复习"
        rows={3}
      />
      <Space style={{ width: '100%' }}>
        {mode === 'brief' && (
          <Select
            size="middle"
            style={{ width: 140 }}
            value={summaryView}
            onChange={(v) => setSummaryView(v as 'text' | 'mindmap')}
            options={[
              { value: 'text', label: '文字' },
              { value: 'mindmap', label: '思维导图' }
            ]}
          />
        )}

        <Button
          type="primary"
          style={{ flex: 1 }}
          onClick={onSummarize}
          loading={loading}
          disabled={connectionError || (mode === 'custom' && customPrompt.length === 0)}
        >
          生成 AI 总结
        </Button>
      </Space>
      <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            mode="tags"
            size="small"
            style={{ minWidth: 200 }}
            placeholder="选择或新建标签，加入学习库"
            value={libraryTags}
            onChange={(value) => setLibraryTags(value as string[])}
            options={allTags.map(t => ({ value: t, label: t }))}
          />
          <Button
            size="small"
            type="default"
            disabled={connectionError || isEmptySummary || libraryTags.length === 0}
            onClick={onAddToLibrary}
          >
            加入学习库
          </Button>
        </Space>
      </Space>
      <Card
        size="small"
        style={{ height: 300, overflowY: summaryView === 'mindmap' && mode === 'brief' ? 'hidden' : 'auto' }}
        bodyStyle={summaryView === 'mindmap' && mode === 'brief' ? { padding: 0 } : undefined}
      >
        {loading || isEmptySummary ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <Suspense fallback={null}>
                <LazySpin />
              </Suspense>
            ) : (
              <Suspense fallback={null}>
                <LazyEmpty description="暂无内容" />
              </Suspense>
            )}
          </div>
        ) : summaryView === 'mindmap' && mode === 'brief' ? (
          <div style={{ width: '100%', height: 280 }}>
            <MindMapView markdown={summaryText} />
          </div>
        ) : (
          <div
            className="md-content"
            style={{ width: '100%' }}
            dangerouslySetInnerHTML={{ __html: summaryHtml }}
          />
        )}
      </Card>
      <Card
        size="small"
        title="延伸学习推荐"
        extra={(
          <Button
            size="small"
            type="link"
            onClick={onGenerateRecommend}
            disabled={connectionError || isEmptySummary}
            loading={recommendLoading}
            style={{ padding: 0 }}
          >
            生成学习推荐
          </Button>
        )}
        style={{ minHeight: 300, overflow: 'hidden' }}
        bodyStyle={{ padding: 8, height: 300 }}
      >
        {recommendLoading ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Suspense fallback={null}>
              <LazySpin />
            </Suspense>
          </div>
        ) : recommendHtml && recommendHtml.trim().length > 0 ? (
          <div
            className="md-content"
            style={{ width: '100%', height: '100%', overflowY: 'auto', fontSize: 12 }}
            dangerouslySetInnerHTML={{ __html: recommendHtml }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#9ca3af',
              textAlign: 'center',
              padding: '0 8px'
            }}
          >
            点击右上角「生成学习推荐」，获取推荐学习主题、书籍方向、搜索关键词与学习路径。
          </div>
        )}
      </Card>
    </Space>
  )
}
