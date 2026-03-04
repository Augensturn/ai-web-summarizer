import { useMemo, useState } from 'react'
import Space from 'antd/es/space'
import Tree from 'antd/es/tree'
import type { DataNode } from 'antd/es/tree'
import List from 'antd/es/list'
import Tag from 'antd/es/tag'
import Input from 'antd/es/input'
import Button from 'antd/es/button'
import Card from 'antd/es/card'
import Checkbox from 'antd/es/checkbox'
import TreeSelect from 'antd/es/tree-select'

import type { HistoryRecord } from './types'
import { renderMarkdown } from './md'

interface LearnTabProps {
  records: HistoryRecord[]
  allTags: string[]
  onUpdateTags: (ts: number, tags: string[]) => void
  onUpdateNote: (ts: number, note: string) => void
  selectedIds: number[]
  onToggleSelect: (ts: number, checked: boolean) => void
  onBatchDelete: () => void
  onCreateTag: (parentPath: string | null) => void
}

export function LearnTab({
  records,
  allTags,
  onUpdateTags,
  onUpdateNote,
  selectedIds,
  onToggleSelect,
  onBatchDelete,
  onCreateTag
}: LearnTabProps) {
  const [selectedTagKey, setSelectedTagKey] = useState<string | 'all'>('all')
  const [expandedIds, setExpandedIds] = useState<number[]>([])

  const treeData: DataNode[] = useMemo(() => {
    const rootChildren: DataNode[] = []
    const pathMap = new Map<string, DataNode>()

    allTags.forEach(tag => {
      const parts = tag.split('/').map(p => p.trim()).filter(Boolean)
      if (!parts.length) return
      let currentPath = ''
      let parentArray = rootChildren

      parts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const existing = pathMap.get(currentPath)
        if (existing) {
          parentArray = (existing.children ||= [])
          return
        }
        const node: DataNode = {
          key: currentPath,
          title: part,
          value: currentPath,
          children: []
        } as any
        parentArray.push(node)
        pathMap.set(currentPath, node)
        parentArray = node.children!
      })
    })

    return [
      {
        key: 'all',
        title: '全部标签',
        value: 'all',
        children: rootChildren
      }
    ]
  }, [allTags])

  const filtered = useMemo(() => {
    const base = records.filter(r => (r.tags || []).length > 0)
    if (selectedTagKey === 'all') return base
    return base.filter(r => (r.tags || []).some(tag => {
      if (tag === selectedTagKey) return true
      // 树形路径：选择父节点时，包含该前缀的子标签也会被匹配
      return (tag.startsWith(`${selectedTagKey}/`))
    }))
  }, [records, selectedTagKey])

  const handleExport = (format: 'md' | 'word') => {
    if (!filtered.length) return

    // 如果有勾选，则只导出勾选的记录；否则导出当前筛选出的全部记录
    const targetRecords =
      selectedIds.length > 0
        ? filtered.filter(r => selectedIds.includes(r.timestamp))
        : filtered

    if (!targetRecords.length) return
    const now = new Date()
    const title = `学习库导出_${now.toISOString().slice(0, 10)}`

      const buildMarkdown = () => {
      const lines: string[] = []
      lines.push(`# 学习库导出`)
      lines.push('')
        targetRecords.forEach((r, idx) => {
        lines.push(`## 问答 ${idx + 1}`)
        lines.push('')
        lines.push(`- 标题：${r.title || r.url}`)
        lines.push(`- 链接：${r.url}`)
        lines.push(`- 模式：${r.mode}`)
        lines.push(`- 时间：${new Date(r.timestamp).toLocaleString()}`)
        lines.push(`- 标签：${(r.tags || []).join('，') || '无'}`)
        lines.push('')
        lines.push(`### 总结 / 回答`)
        lines.push(r.summary || '')
        lines.push('')
        lines.push(`### 笔记`)
        lines.push(r.note || '')
        lines.push('')
      })
      return lines.join('\n')
    }

    if (format === 'md') {
      const md = buildMarkdown()
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.md`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // 生成简单的 RTF，Word 等工具可以直接打开，避免 .doc HTML 兼容性问题
      const md = buildMarkdown()
      // const plain = md.replace(/\r\n/g, '\n')
      // const escapeRtf = (text: string) =>
      //   text
      //     .replace(/\\/g, '\\\\')
      //     .replace(/{/g, '\\{')
      //     .replace(/}/g, '\\}')
      //     .replace(/\n/g, '\\par\n')

      // const rtfBody = escapeRtf(plain)
      // const rtf = `{\\rtf1\\ansi\\deff0\n${rtfBody}\n}`

      // const blob = new Blob([rtf], { type: 'application/rtf;charset=utf-8' })
      const html = `
          <html>
           <head>
             <meta charset="utf-8"/>
             <title>${title}</title>
           </head>
           <body>
            <pre>${md.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
           </body>
          </html>
      `
      const blob = new Blob([html], { type: 'application/msword;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // 使用 .doc 扩展名，Word 仍然可以正常打开 RTF 内容
      a.download = `${title}.doc`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <Space style={{ width: '100%', flexDirection: 'column' }} size="middle" align="start">
      <Card
        size="small"
        style={{ width: 360, maxHeight: 420, overflowY: 'auto' }}
        bodyStyle={{ padding: 4 }}
      >
        <Tree
          defaultExpandAll
          treeData={treeData}
          titleRender={(node) => (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>{node.title as string}</span>
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  const parentPath =
                    node.key === 'all'
                      ? null
                      : (node.key as string)
                  onCreateTag(parentPath)
                }}
                style={{ padding: 0, fontSize: 12 }}
              >
                ＋
              </Button>
            </span>
          )}
          selectedKeys={[selectedTagKey]}
          onSelect={(keys) => {
            const k = (keys[0] as string) || 'all'
            setSelectedTagKey(k as any)
          }}
        />
      </Card>

      <div style={{ flex: 1 }}>
        <Space style={{ marginBottom: 8, justifyContent: 'space-between', width: '100%' }}>
          <Space size="small">
            <Button
              danger
              size="small"
              disabled={selectedIds.length === 0}
              onClick={onBatchDelete}
            >
              批量删除
            </Button>
          </Space>
          <Space size="small">
            <TreeSelect
              treeData={[
                { key: 'md', value: 'md', title: 'Markdown' },
                { key: 'word', value: 'word', title: 'Word' }
              ]}
              size="small"
              placeholder="选择导出格式"
              style={{ width: 160 }}
              onChange={(v) => handleExport(v as 'md' | 'word')}
              treeDefaultExpandAll
            />
          </Space>
        </Space>
        <div
          style={{
            height: 380,
            overflowY: 'auto',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            padding: 8
          }}
        >
          <List
            dataSource={filtered}
            renderItem={(record) => (
              <List.Item
                key={record.timestamp}
                style={{
                  display: 'block',
                  paddingBottom: 12,
                  borderBottom: '1px solid #f5f5f5'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 4,
                    gap: 6
                  }}
                >
                  <Checkbox
                    checked={selectedIds.includes(record.timestamp)}
                    onChange={(e) => onToggleSelect(record.timestamp, e.target.checked)}
                  />
                  <span
                    style={{
                      fontWeight: 500,
                      fontSize: 14,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {record.title || record.url}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#666',
                    marginBottom: 4,
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>模式：{record.mode}</span>
                  <span>{new Date(record.timestamp).toLocaleString()}</span>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    marginBottom: 4
                  }}
                >
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setExpandedIds(prev =>
                        prev.includes(record.timestamp)
                          ? prev.filter(id => id !== record.timestamp)
                          : [...prev, record.timestamp]
                      )
                    }}
                    style={{ padding: 0, fontSize: 12 }}
                  >
                    {expandedIds.includes(record.timestamp) ? '收起内容' : '展开完整问答'}
                  </Button>
                </div>
                <Space size={[4, 4]} wrap style={{ marginBottom: 6 }}>
                  <TreeSelect
                    treeData={treeData[0]?.children || []}
                    treeCheckable
                    showCheckedStrategy={TreeSelect.SHOW_PARENT}
                    allowClear
                    size="small"
                    style={{ minWidth: 220 }}
                    placeholder="选择标签（树形结构）"
                    value={record.tags || []}
                    onChange={(value) => onUpdateTags(record.timestamp, value as string[])}
                  />
                  {(record.tags || []).map(tag => (
                    <Tag
                      key={tag}
                      style={{
                        fontSize: 11,
                        borderRadius: 10,
                        marginRight: 0
                      }}
                    >
                      {tag}
                    </Tag>
                  ))}
                </Space>
                {expandedIds.includes(record.timestamp) ? (
                  <div
                    className="md-content"
                    style={{
                      fontSize: 12,
                      color: '#444',
                      marginBottom: 6
                    }}
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const text = (record.summary || '').trim()
                        // 如果看起来是 HTML 片段（例如 <p>...</p>），直接作为 HTML 渲染
                        if (text.startsWith('<') && text.endsWith('>')) {
                          return text
                        }
                        // 否则按 Markdown 渲染，避免 *** 等原样显示
                        return renderMarkdown(text)
                      })()
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#444',
                      marginBottom: 6,
                      maxHeight: 80,
                      overflow: 'hidden'
                    }}
                  >
                    {record.summary}
                  </div>
                )}
                <Input.TextArea
                  rows={3}
                  defaultValue={record.note || ''}
                  placeholder="在此记录你的学习笔记（自动同步到该问答）"
                  onBlur={(e) => onUpdateNote(record.timestamp, e.target.value)}
                />
              </List.Item>
            )}
            locale={{
              emptyText: '当前暂无添加标签的问答，请先在历史记录或总结页为问答添加标签'
            }}
          />
        </div>
      </div>
    </Space>
  )
}

