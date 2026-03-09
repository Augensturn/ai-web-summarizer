import { useEffect, useRef, useState } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

export async function mindmapToImage(markdown: string): Promise<string> {
  const { Markmap, deriveOptions } = await import('markmap-view')
  const { Transformer } = await import('markmap-lib')

  const transformer = new Transformer()
  const { root, features } = transformer.transform(markdown)

  const options = deriveOptions(features)

  // 关键：关闭动画
  options.duration = 0

  // 限制节点宽度避免一行过长
  options.maxWidth = 260

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '2000px'

  document.body.appendChild(container)

  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    container.appendChild(svg)

    const mm = Markmap.create(svg, options)

    mm.setData(root)
    mm.fit()

    // 等待 d3 布局完成
    await new Promise(resolve => setTimeout(resolve, 300))

    const bbox = svg.getBBox()

    const padding = 60

    const width = bbox.width + padding * 2
    const height = bbox.height + padding * 2

    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))

    svg.setAttribute(
      'viewBox',
      `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`
    )

    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svg)

    const img = new Image()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')!

    return new Promise(resolve => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }

      img.src =
        'data:image/svg+xml;base64,' +
        btoa(unescape(encodeURIComponent(svgString)))
    })
  } finally {
    document.body.removeChild(container)
  }
}

interface MindMapViewProps {
  markdown: string
}

export function buildMindmapMarkdown(raw: string): string {
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
      mm = Markmap.create(ref.current, {
        // 让节点在纵向上更紧凑，减少横向拉伸
        spacingHorizontal: 60,
        spacingVertical: 16,
        // 限制单行最大宽度，自动换行，避免一条分支太长
        maxWidth: 180,
        // 自动适配容器尺寸，尽量整体缩放到视口内
        autoFit: true
      } as any)
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

  const exportAsSvg = () => {
    const svgEl = ref.current
    if (!svgEl) return
    try {
      const serializer = new XMLSerializer()
      let source = serializer.serializeToString(svgEl)
      if (!source.match(/^<svg[^>]+xmlns=/)) {
        source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      }
      if (!source.includes('xmlns:xlink')) {
        source = source.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
      }
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mindmap.svg'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // 导出失败时静默失败，避免影响正常使用
    }
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
        <button
          type="button"
          onClick={exportAsSvg}
          style={{
            width: 22,
            height: 22,
            border: 'none',
            borderRadius: 3,
            background: '#f97316',
            color: '#fff',
            cursor: 'pointer',
            lineHeight: '22px'
          }}
          title="导出为 SVG 图片"
        >
          ↓
        </button>
      </div>
    </div>
  )
}
