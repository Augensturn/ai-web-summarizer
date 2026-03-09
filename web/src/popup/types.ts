

export interface HistoryRecord {
  id: string;
  url: string
  title: string
  content: string
  summary: string
  mode: 'brief' | 'points' | 'study' | 'custom'
  timestamp: number
  favorite?: boolean
  tags?: string[]
  note?: string
  recommendation?: string
}


