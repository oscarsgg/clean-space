const TECHNICAL = /API_ERROR|traceback|stack trace|internal server error|sql(?:ite|alchemy|state)?|database error|integrityerror|operationalerror|validationerror|pydantic|exception|failed to fetch|networkerror|request failed|status code|at\s+\S+\.(?:js|ts|tsx)/i

function extractMessage(body) {
  if (!body) return ''
  try {
    const parsed = JSON.parse(body)
    const detail = parsed?.detail ?? parsed?.message ?? parsed?.error
    if (typeof detail === 'string') return detail.trim()
    if (Array.isArray(detail)) return 'validation'
    if (detail && typeof detail === 'object') return String(detail.message ?? '')
  } catch {
    return body.trim()
  }
  return ''
}

export function userFacingApiError(status, body = '') {
  const detail = extractMessage(body)
  if (status === 401) return 'Tu sesión venció. Inicia sesión de nuevo para continuar.'
  if (status === 403) return 'Tu cuenta no tiene permiso para realizar esta acción.'
  if (status === 404) return 'No encontramos el registro solicitado. Actualiza la página e inténtalo de nuevo.'
  if (status === 409) return 'Este cambio entra en conflicto con información existente. Revisa los datos e inténtalo de nuevo.'
  if (status === 422 || detail === 'validation') return 'Revisa los datos del formulario e inténtalo de nuevo.'
  if (status === 429) return 'Hay muchas solicitudes en curso. Espera un momento e inténtalo de nuevo.'
  if (status >= 500 || TECHNICAL.test(detail)) return 'No pudimos completar la solicitud. Inténtalo de nuevo más tarde.'
  if (detail && detail.length <= 180 && !/[{}<>\n\r]/.test(detail)) return detail
  if (status >= 400) return 'No pudimos completar la solicitud. Revisa la información e inténtalo de nuevo.'
  return 'Ocurrió un problema inesperado. Inténtalo de nuevo.'
}

export function userFacingClientError(error) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (message && !TECHNICAL.test(message) && message.length <= 180 && !/[{}<>\n\r]/.test(message)) {
    return message
  }
  return 'No pudimos completar la solicitud. Revisa tu conexión e inténtalo de nuevo.'
}
