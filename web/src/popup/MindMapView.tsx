import { useEffect, useRef, useState } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

interface MindMapViewProps {
  markdown: string
}

function buildMindmapMarkdown(raw: string): string {
  const text = (raw || '').trim()
  if (!text) return ''

  // 先按行拆分，适配已经有换行/列表的情况
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  let title = lines[0]
  let items: string[] = []

  if (lines.length > 1) {
    items = lines.slice(1)
  } else {
    // 如果只有一行，就按句子拆成标题 + 若干要点
    const sentences = text
      .split(/(?<=[。！？.!?])/)
      .map(s => s.trim())
      .filter(Boolean)

    if (sentences.length > 1) {
      title = sentences[0]
      items = sentences.slice(1)
    } else {
      // 实在拆不出结构，就直接当成一个节点
      return `# ${title}`
    }
  }

  const mdLines = [
    `# ${title}`,
    ...items.map(it => `- ${it}`)
  ]
  return mdLines.join('\n')
}

export function MindMapView({ markdown }: MindMapViewProps) {
  const ref = useRef<SVGSVGElement | null>(null)
  const mmRef = useRef<Markmap | null>(null)
  const [zoom, setZoom] = useState(1) // 1 为默认，>1 放大，<1 缩小

  // 初始化 / 更新思维导图
  useEffect(() => {
    if (!ref.current) return

    const mmMarkdown = buildMindmapMarkdown(markdown)
    const transformer = new Transformer()
    const { root } = transformer.transform(mmMarkdown)

    let mm = mmRef.current
    if (!mm) {
      mm = Markmap.create(ref.current)
      mmRef.current = mm
    }
    mm.setData(root)
    mm.fit()
    setZoom(1)
  }, [markdown])

  // 使用 markmap 自带的缩放能力，只缩放导图内容
  useEffect(() => {
    const mm = mmRef.current
    if (!mm) return
    // markmap 的 rescale 属于内部 API，这里通过 any 调用
    try {
      ;(mm as any).rescale(zoom)
    } catch {
      // 如果 rescale 不存在，就忽略缩放，保证至少能正常显示
    }
  }, [zoom])

  const zoomIn = () => {
    setZoom(prev => Math.min(3, +(prev + 0.2).toFixed(2)))
  }

  const zoomOut = () => {
    setZoom(prev => Math.max(0.5, +(prev - 0.2).toFixed(2)))
  }

  const resetZoom = () => {
    setZoom(1)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        ref={ref}
        style={{
          width: '100%',
          height: '100%'
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: 'rgba(15, 23, 42, 0.7)',
          borderRadius: 4,
          padding: 4,
          color: '#e5e7eb',
          fontSize: 10
        }}
      >
        <button
          type="button"
          onClick={zoomIn}
          style={{
            width: 22,
            height: 22,
            border: 'none',
            borderRadius: 3,
            background: '#22c55e',
            color: '#fff',
            cursor: 'pointer',
            lineHeight: '22px'
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          style={{
            width: 22,
            height: 22,
            border: 'none',
            borderRadius: 3,
            background: '#0ea5e9',
            color: '#fff',
            cursor: 'pointer',
            lineHeight: '22px'
          }}
        >
          -
        </button>
        <button
          type="button"
          onClick={resetZoom}
          style={{
            width: 22,
            height: 22,
            border: 'none',
            borderRadius: 3,
            background: '#4b5563',
            color: '#fff',
            cursor: 'pointer',
            lineHeight: '22px'
          }}
        >
          1x
        </button>
      </div>
    </div>
  )
}
