# Tasks

## 1. Protección de rutas y navegación por rol

- [x] 1.1 Definir y documentar la matriz de rutas compartidas/exclusivas y permisos para `ADMINISTRADOR` y `SUPERVISOR`; verificar que cada ruta protegida tenga rol esperado.
- [ ] 1.2 Implementar sesión disponible para validación del lado servidor y guard de rutas que preserve login para sesión ausente y devuelva HTTP 403 para sesión autenticada sin rol; verificar acceso directo a rutas Admin, Supervisor y Análisis.
- [x] 1.3 Separar menús y destinos iniciales por rol, mostrando Análisis a ambos y ocultando navegación exclusiva del otro; verificar el menú para ambos perfiles.
- [ ] 1.4 Añadir pruebas de API y frontend para matriz de rutas, expiración/logout y 403; documentar el comportamiento de sesión y autorización.

## 2. API y dashboards operativos

- [ ] 2.1 Añadir filtros de periodo y cuarto a resúmenes operativos, aplicando alcance global para Admin y cuartos asignados para Supervisor; verificar con fixtures de cuartos ajenos.
- [ ] 2.2 Añadir agregaciones necesarias para accesos, denegaciones, alertas, ocupación, estados de cuartos/dispositivos y lecturas por periodo; verificar respuestas, límites y casos vacíos.
- [ ] 2.3 Crear gráficas del dashboard Admin para tendencias globales y comparativos por cuarto/estado, y del dashboard Supervisor para ocupación, actividad de acceso, lecturas y alertas; verificar datos contra las respuestas de API.
- [ ] 2.4 Documentar indicadores, filtros y alcance de datos, y cubrir carga, error y ausencia de datos en pruebas de componentes.

## 3. Módulos de análisis

- [ ] 3.1 Asegurar que Admin y Supervisor puedan consultar y ejecutar los módulos analíticos requeridos, filtrando del lado servidor el alcance del Supervisor; verificar llamadas válidas y denegación de roles no permitidos.
- [ ] 3.2 Implementar filtros consistentes de periodo, cuarto y métrica para indicadores y series ambientales/accesos; verificar el resultado y paginación/rangos aceptados.
- [ ] 3.3 Implementar ETL verificable con resumen de filas leídas, descartadas y cargadas, periodo y origen real/simulado; añadir pruebas de transformación, datos duplicados/invalidos y estado insuficiente.
- [ ] 3.4 Completar entrenamiento y evaluación con conjunto de prueba temporal, versión, parámetros e historial de métricas; verificar que datos insuficientes no aparezcan como desempeño validado.
- [ ] 3.5 Completar gráficas y tablas de porcentaje en rango, series ambientales, anomalías, accesos por hora, correlación ocupación–PM2.5 y métricas del modelo; verificar estados vacíos y datos insuficientes.
- [ ] 3.6 Documentar los endpoints, métricas y límites de interpretación; añadir pruebas de API y UI para cada módulo descrito en el documento.

## 4. Aceptación integrada

- [ ] 4.1 Ejecutar una matriz de aceptación con cuentas Admin, Supervisor y rol sin autorización; verificar HTTP 403, navegación separada, acceso analítico compartido y aislamiento de cuartos.
- [ ] 4.2 Verificar dashboards y módulos analíticos con datos de demostración etiquetados y datos almacenados, contrastando gráficas, filtros, KPIs, ETL y métricas con registros de origen.
- [x] 4.3 Preparar una guía breve de demostración académica con precondiciones, pasos, resultados esperados y evidencia para cada flujo incluido.
