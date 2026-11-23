export function summarizeAccess(series?: { allowed?: number; denied?: number }[]): { allowed: number; denied: number; total: number; allowedPercent: number | null }
export function summarizeCompliance(series?: { limits_sample_count?: number; in_range_count?: number }[]): { comparable: number; inRange: number; percent: number | null }
export function aggregateEnvironment(series: { date: string; cleanroom_id: number; metric: string; average: number; count: number; min_value: number | null; max_value: number | null }[], metric: string, roomId?: string): { date: string; count: number; min_value: number | null; max_value: number | null; average: number }[]
export function summarizeAlerts(series: { by_severity?: Record<string, number> }[], severities: string[]): Record<string, number>
