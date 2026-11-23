const STATUS_LABELS = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ENABLED: 'Activo',
  DISABLED: 'Inactivo',
  PENDING: 'Pendiente',
  SCHEDULED: 'Programado',
  PROCESSING: 'En proceso',
  COMPLETED: 'Completado',
  SUCCEEDED: 'Completado',
  FAILED: 'No completado',
  ERROR: 'Con problema',
  OFFLINE: 'Sin conexión',
  ONLINE: 'Conectado',
  ALLOWED: 'Permitido',
  DENIED: 'Denegado',
  EXPIRED: 'Vencido',
  REVOKED: 'Revocado',
  ACKNOWLEDGED: 'Atendido',
  NORMAL: 'Normal',
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const TONES = {
  ACTIVE: 'success', ENABLED: 'success', ONLINE: 'success', ALLOWED: 'success',
  COMPLETED: 'success', SUCCEEDED: 'success', ACKNOWLEDGED: 'success',
  PENDING: 'warning', SCHEDULED: 'info', PROCESSING: 'info', MEDIUM: 'warning', LOW: 'neutral', NORMAL: 'neutral',
  INACTIVE: 'neutral', DISABLED: 'neutral', EXPIRED: 'warning', REVOKED: 'neutral', OFFLINE: 'warning',
  DENIED: 'danger', FAILED: 'danger', ERROR: 'danger', HIGH: 'danger', CRITICAL: 'danger',
}

export function statusPresentation(value, kind = 'status') {
  const code = String(value ?? '').trim().toUpperCase()
  if (!code) return { code: '', label: 'Sin estado', tone: 'neutral' }
  const label = STATUS_LABELS[code] ?? code.toLowerCase().replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
  const tone = kind === 'severity' ? (TONES[code] ?? 'neutral') : (TONES[code] ?? 'neutral')
  return { code, label, tone }
}
