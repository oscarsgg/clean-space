# Design

## Context

See `proposal.md` for motivation and `specs/role-based-navigation/spec.md` plus `specs/operational-analytics/spec.md` for observable behavior. El portal actual mantiene arreglos distintos de enlaces Admin/Supervisor, pero el contenedor de rol administra rutas y navegación en el cliente. El JWT de acceso se conserva en el navegador; por ello una ruta Next.js servida en el servidor no puede decidir de forma fiable un HTTP 403 antes de renderizar sin definir una sesión legible/verificable del lado servidor. Los endpoints analíticos aceptan ambos roles, la UI de análisis ya presenta correlación, grupos, anomalías e indicadores, y ETL actualmente informa conteos sin ejecutar la transformación documentada.

## Goals / Non-Goals

**Goals:**
- Establecer un contrato único de rol y permisos para proteger tanto rutas web como endpoints, sin tratar la visibilidad del sidebar como autorización.
- Dar a Admin y Supervisor acceso coherente a análisis, conservando acceso global de Admin y limitación de Supervisor a cuartos asignados.
- Convertir los dashboards en resúmenes visuales alimentados por datos persistidos y filtros explícitos.
- Hacer observables el periodo, alcance, calidad de datos y estado de ETL/modelos.

**Non-Goals:**
- Integrar o controlar hardware, firmware, lectores RFID, sensores, relés o cerraduras.
- Certificar el sistema para producción industrial o afirmar cumplimiento normativo del cuarto limpio.
- Sustituir por completo el proceso de autenticación de la API o introducir un proveedor externo de identidad.

## Decisions

1. **La autorización tendrá una matriz central de roles y rutas.** Mantener configuraciones de navegación separadas para Admin y Supervisor y definir qué rutas son compartidas (incluido Análisis) o exclusivas. Un guard de página debe rechazar antes de presentar contenido protegido y producir estado HTTP 403 para una sesión autenticada sin rol. La sesión ausente/expirada conserva el flujo de inicio de sesión. Como el acceso actual depende de almacenamiento del navegador, la implementación debe añadir un mecanismo de sesión seguro disponible en el servidor (cookie HttpOnly, Secure en HTTPS, SameSite y validación/revocación coordinada con la API); no confiar en un rol leído de `localStorage` como control de seguridad. Mantener validación de roles y autorización por cuarto en FastAPI como límite de datos.
   - Alternativa descartada: ocultar enlaces y redirigir en `useEffect`; no impide acceso directo y no devuelve HTTP 403.

2. **Los dos roles compartirán la superficie analítica, con alcance de datos distinto.** Los endpoints de lectura y acciones analíticas aceptarán ambos roles; Admin consulta todos los cuartos, Supervisor solo sus asignaciones. Los filtros recibidos por API nunca podrán ampliar ese alcance. La política queda explícita para ETL y entrenamiento: ambos roles pueden ejecutarlos como solicitó el usuario, y cada respuesta/resultados se limita al alcance del actor.
   - Alternativa descartada: acceso visual compartido con operaciones exclusivas de Admin, porque dejaría módulos descritos inaccesibles al Supervisor.

3. **Gráficas separadas por audiencia y periodo.** Dashboard Admin: KPIs globales, tendencias de accesos/denegaciones, avisos por severidad y estado comparativo de cuartos/dispositivos. Dashboard Supervisor: ocupación frente a capacidad, accesos por hora/resultado, últimas lecturas por métrica y alertas de sus cuartos. Dashboard Análisis: series ambientales, porcentaje de lecturas en rango, accesos permitidos/denegados, patrón horario, anomalías y correlación ocupación–PM2.5, además de métricas e historial de modelos. Añadir periodo/cuarto a las consultas de API y mostrar unidad, zona horaria/intervalo, carga, vacío y error. Reutilizar SWR, eventos en vivo y gráficos SVG existentes antes de sumar dependencias.
   - Alternativa descartada: gráficos alimentados con arreglos de demostración en el cliente, porque pueden ocultar falta de datos reales o divergencias del backend.

4. **ETL y resultados de modelo deben ser verificables.** El endpoint ETL reportará una ejecución persistida (inicio/fin, ventana, leídos/descartados/cargados y origen real/simulado). Entrenamiento registrará versión, parámetros, conjunto/periodo y métricas de prueba; resultados insuficientes se marcarán como tales. La interfaz no debe afirmar que el ETL procesó datos si solo contó filas, ni presentar detección exploratoria como desempeño validado.
   - Alternativa descartada: conservar respuestas nominales de éxito sin pipeline ni evaluación, porque no son evidencia válida para la presentación académica.

## Risks / Trade-offs

- [Sesión segura para 403 de página puede requerir cambio coordinado de cookies, frontend y CORS] → definir y probar login, refresh, logout, expiración y revocación antes de aplicar el guard; conservar los checks de API.
- [El filtro temporal puede cambiar firmas y volumen de consultas] → establecer periodos predeterminados, límites de rango y paginación/agregación del lado servidor.
- [Muestras escasas producen correlaciones o clusters engañosos] → exigir tamaño mínimo y mostrar estado de datos insuficientes.
- [Admin y Supervisor ven los mismos módulos de análisis, pero no deben ver datos fuera de alcance] → filtrar en backend y cubrir intentos de ampliar `cleanroom_id` con pruebas negativas.
- [La integración física queda fuera de este cambio] → los dashboards identifican estados recibidos por software y no inferirán apertura física, calibración o condición certificada.

## Migration Plan

1. Implementar primero la sesión y matriz de autorización, con pruebas de acceso directo por rol y respuesta 403.
2. Extender endpoints para filtros temporales, agregaciones, alcance y respuestas verificables del ETL/modelo; mantener compatibilidad de consultas existentes durante el cambio de UI.
3. Construir sidebars y dashboards por audiencia; habilitar Análisis en ambos y validar que los datos de Supervisor nunca excedan sus cuartos asignados.
4. Retirar los flujos/rutas duplicados o inconsistentes solo después de migrar enlaces y probar navegación. Para revertir, restaurar rutas/menús previos y mantener los nuevos campos analíticos opcionales hasta que el frontend deje de depender de ellos.

## Open Questions

- Los umbrales mínimos de muestra y periodos analíticos predeterminados pueden fijarse durante implementación con datos de demostración, siempre que se muestren al usuario y queden configurables.
