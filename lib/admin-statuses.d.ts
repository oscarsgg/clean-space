export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'
export function statusPresentation(value: unknown, kind?: 'status' | 'severity'): { code: string; label: string; tone: StatusTone }
