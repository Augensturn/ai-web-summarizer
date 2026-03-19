

export interface HistoryRecord {
  id: string;
  url: string
  title: string
  content: string
  summary: string
  mode: 'brief' | 'study' | 'custom' | string
  timestamp: number
  favorite?: boolean
  tags?: string[]
  note?: string
  recommendation?: string
}


