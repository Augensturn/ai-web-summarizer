
import { useMemo } from 'react'
import Space from 'antd/es/space'
import Select from 'antd/es/select'
import Button from 'antd/es/button'
import List from 'antd/es/list'
import Tag from 'antd/es/tag'
import Checkbox from 'antd/es/checkbox'
import TreeSelect from 'antd/es/tree-select'
import type { DataNode } from 'antd/es/tree'

import type { HistoryRecord } from './types'

interface HistoryTabProps {
  filterMode: 'all' | 'brief' | 'points' | 'study'
  setFilterMode: (mode: 'all' | 'brief' | 'points' | 'study') => void
  filterTag: string | 'all'
  setFilterTag: (tag: string | 'all') => void
  allTags: string[];
  onClearHistory: () => void
  historyListRef: React.RefObject<HTMLDivElement | null>
  filteredHistory: HistoryRecord[]
  displayedCount: number
  onRecordClick: (record: HistoryRecord) => void
  onUpdateTags: (ts: number, tags: string[]) => void;
  selectedIds: number[]
  onToggleSelect: (ts: number, checked: boolean) => void
  onBatchDelete: () => void
}

export function HistoryTab({
  filterMode,
  setFilterMode,
  filterTag,
  setFilterTag,
  allTags,
  onClearHistory,
  historyListRef,
  filteredHistory,
  displayedCount,
  onRecordClick,
  onUpdateTags,
  selectedIds,
  onToggleSelect,
  onBatchDelete
}: HistoryTabProps) {
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

    return rootChildren
  }, [allTags])

  return (
    <Space vertical style={{ width: '100%' }} size="middle">
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap size="middle">
          <Select
            value={filterMode}
            onChange={(v) => setFilterMode(v as any)}
            options={[
              { value: 'all', label: '全部模式' },
              { value: 'brief', label: '精简摘要' },
              { value: 'points', label: '要点列表' },
              { value: 'study', label: '学习笔记' },
            ]}
            style={{ width: 120 }}
            size="small"
          />
          <Select
            value={filterTag}
            onChange={(v) => setFilterTag(v as any)}
            options={[
              { value: 'all', label: '全部标签' },
              ...allTags.map(t => ({ value: t, label: t }))
            ]}
            style={{ width: 180 }}
            size="small"
            allowClear
          />
        </Space>

        <Space>
          <Button 
            danger 
            onClick={onClearHistory}
            size="small"
          >
            清空历史
          </Button>
          <Button
            danger
            size="small"
            disabled={selectedIds.length === 0}
            onClick={onBatchDelete}
          >
            批量删除
          </Button>
        </Space>
      </Space>

      <div 
        ref={historyListRef} 
        style={{ 
          height: 400, 
          overflowY: 'auto',
          border: '1px solid #f0f0f0',
          borderRadius: 6,
          padding: '8px 4px'
        }}
      >
        <List
          dataSource={filteredHistory.slice(0, displayedCount)}
          renderItem={(record) => (
            <List.Item
              key={record.timestamp}
              style={{ 
                padding: '12px 8px',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background-color 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fafafa'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: 4
              }}>
                <span 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  <Checkbox
                    checked={selectedIds.includes(record.timestamp)}
                    onChange={(e) => onToggleSelect(record.timestamp, e.target.checked)}
                    style={{ marginRight: 4 }}
                  />
                  <span
                    style={{ 
                      fontWeight: 500,
                      fontSize: 14,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={() => onRecordClick(record)}
                  >
                    {(record.title || record.url).replace(/\s+/g, ' ').trim()}
                  </span>
                </span>
              </div>
              
              <div style={{ 
                fontSize: 12, 
                color: '#666',
                marginBottom: 4,
                width: '100%'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>模式：{record.mode}</span>
                  <span>{new Date(record.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ width: '100%' }}>
                <Space size={[4, 8]} wrap style={{ width: '100%' }}>
                  <TreeSelect
                    treeData={treeData}
                    treeCheckable
                    showCheckedStrategy={TreeSelect.SHOW_PARENT}
                    allowClear
                    size="small"
                    style={{ minWidth: 220 }}
                    placeholder="选择标签（树形结构）"
                    value={record.tags || []}
                    onChange={(value) => onUpdateTags(record.timestamp, value as string[])}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {(record.tags || []).length > 0 && (
                    <Space size={[4, 4]} wrap>
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
                  )}
                </Space>
              </div>
            </List.Item>
          )}
          locale={{
            emptyText: (
              <div style={{ 
                padding: 40, 
                textAlign: 'center',
                color: '#999'
              }}>
                暂无历史记录
              </div>
            )
          }}
        />
      </div>
    </Space>
  )
}
