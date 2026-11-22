# Proposal

## Why

CleanSpace ya tiene dashboards, analítica y autorización por roles, pero la experiencia y los límites entre Admin y Supervisor no están completamente definidos ni cubren todos los módulos analíticos descritos en la documentación. Esta propuesta organiza la navegación y los permisos por rol, y completa los dashboards para que los resultados operativos y analíticos sean visibles y verificables en la demostración académica.

## What Changes

- Definir acceso a rutas y vistas por rol `ADMINISTRADOR` y `SUPERVISOR`, con respuesta 403 visible cuando el usuario autenticado no tenga el rol requerido; mantener el redireccionamiento de usuarios no autenticados al inicio de sesión.
- Mantener sidebars y dashboards separados por rol, sin mostrar opciones exclusivas del otro rol.
- Dar a ambos roles acceso al módulo de análisis y a sus vistas, filtros, resultados y acciones analíticas documentadas, respetando el alcance de cuartos asignados para Supervisor.
- Enriquecer los dashboards de Admin y Supervisor con gráficas operativas y ambientales, filtros temporales y por cuarto cuando correspondan, estados de carga/vacío/error y datos obtenidos de la API.
- Completar el dashboard de análisis con módulos y gráficas para indicadores, series ambientales, anomalías, patrones de acceso, correlación ocupación–PM2.5 y métricas/resultados del modelo.
- Alinear ETL, entrenamiento y evaluación con los resultados que presenta la interfaz; distinguir datos simulados de datos recibidos y evitar presentar una ejecución nominal como procesamiento si no se realizó.
- Añadir cobertura de aceptación para permisos de rutas, visibilidad de menús, aislamiento de datos por cuarto y módulos analíticos.

## Capabilities

### New Capabilities
- `role-based-navigation`: navegación, dashboards y autorización de páginas diferenciados para Administrador y Supervisor, incluidos errores 403.
- `operational-analytics`: dashboards y análisis de datos operativos/ambientales con acceso compartido por rol y datos filtrados por alcance.

### Modified Capabilities
- Ninguna. El proyecto aún no tiene specs existentes; estas capacidades crean contratos iniciales.

## Impact

- Frontend Next.js: `components/cleanspace-portal.tsx`, dashboards de Admin y Supervisor, `components/ecbd-analytics.tsx`, rutas en `app/` y componentes de estado 403.
- Backend FastAPI: autorización y alcance por cuarto en `backend/app/api/v1/analytics.py`, `backend/app/services/ecbd.py` y endpoints de resumen; completar procesamiento y métricas analíticas cuando aplique.
- Documentación de requisitos: módulos ECBD RF-14–RF-24, requisitos de integración analítica RF-32 y criterios de aceptación del PDF del proyecto.
- Fuera de alcance: firmware, sensores físicos, lector RFID, relés/cerraduras, instalación en planta y certificación de cuarto limpio. La integración física corresponde a otro responsable.
