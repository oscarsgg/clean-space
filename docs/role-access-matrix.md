# Matriz de rutas y permisos

Esta matriz define los permisos web del portal CleanSpace. La API conserva su autorización por rol y alcance de cuarto como control de datos independiente.

| Ruta | Administrador | Supervisor | Sin sesión |
| --- | --- | --- | --- |
| `/` | Pública | Pública | Pública |
| `/login` | Pública | Pública | Pública |
| `/acceso/**` | Pública (estado del lector) | Pública (estado del lector) | Pública (estado del lector) |
| `/admin/**` | Permitida | HTTP 403 | Ir a login |
| `/admin/analisis` | Permitida | HTTP 403 | Ir a login |
| `/supervisor/**` excepto análisis | HTTP 403 | Permitida | Ir a login |
| `/analisis` | Permitida | Permitida | Ir a login |
| `/supervisor/analisis` | Permitida (ruta compartida de compatibilidad) | Permitida | Ir a login |
| `/monitoreo/parametros` | Permitida (ruta de compatibilidad) | HTTP 403 | Ir a login |
| `/monitoreo`, `/monitoreo/historico`, `/avisos`, `/accesos` | HTTP 403 | Permitida (rutas de compatibilidad) | Ir a login |
| `/app/admin` | Permitida | HTTP 403 | Ir a login |
| `/app/operador` | HTTP 403 | HTTP 403 | Ir a login |

El módulo de análisis y sus consultas/acciones están disponibles para Administrador y Supervisor. La API entrega al Administrador todos los cuartos y limita al Supervisor a sus cuartos asignados, aunque intente cambiar filtros o parámetros de URL. Un rol autenticado que no aparezca como permitido recibe HTTP 403; una sesión ausente o vencida se redirige a `/login`.

Los sidebars deben ser exclusivos de la audiencia: el menú Admin no ofrece destinos exclusivos de Supervisor y el menú Supervisor no ofrece destinos exclusivos de Admin. Análisis aparece en ambos. Las rutas de compatibilidad no deben convertirse en accesos indirectos a módulos fuera de esta matriz.
