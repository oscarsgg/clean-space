# Catálogo de estados en la consola Admin

La interfaz conserva el código enviado por la API para filtros y acciones, y presenta una etiqueta localizada. El tono es informativo; no equivale a validación física del dispositivo ni del cuarto.

| Código | Etiqueta visible | Tono |
| --- | --- | --- |
| `ACTIVE`, `ENABLED`, `ONLINE`, `ALLOWED`, `COMPLETED`, `SUCCEEDED`, `ACKNOWLEDGED` | Activo, Conectado, Permitido, Completado, Atendido (según contexto) | Éxito |
| `INACTIVE`, `DISABLED`, `REVOKED` | Inactivo, Deshabilitado, Revocado | Neutro |
| `PENDING`, `EXPIRED`, `OFFLINE` | Pendiente, Vencido, Sin conexión | Atención |
| `PROCESSING` | En proceso | Información |
| `DENIED`, `FAILED`, `ERROR` | Denegado, No completado, Con problema | Error |
| `NORMAL`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Normal, Baja, Media, Alta, Crítica | Neutro/atención/error |

Los valores vacíos se muestran como “Sin estado”. Los códigos nuevos se convierten a título legible y tono neutro para evitar falsos positivos. El mapeo fuente vive en `lib/admin-statuses.mjs`; las pruebas de regresión en `lib/admin-statuses.test.mjs`.
