# Spec Delta

## Purpose

Permite consultar y ejecutar los módulos de análisis documentados para convertir los eventos de acceso y las lecturas ambientales en indicadores, visualizaciones y resultados de modelo comprensibles para Administradores y Supervisores.

## ADDED Requirements

### Requirement: Acceso compartido al módulo analítico
El sistema SHALL permitir a `ADMINISTRADOR` y `SUPERVISOR` acceder a la ruta de análisis y a sus módulos documentados. Las consultas y operaciones de análisis SHALL respetar el alcance de cuartos asignados al Supervisor y el alcance global del Administrador.

#### Scenario: Supervisor abre análisis
- **WHEN** un Supervisor autenticado abre análisis o cualquiera de sus módulos
- **THEN** puede consultar indicadores, series, anomalías, patrones, correlación y resultados del modelo solo para cuartos asignados

#### Scenario: Administrador abre análisis
- **WHEN** un Administrador autenticado abre análisis o cualquiera de sus módulos
- **THEN** puede consultar los resultados de todos los cuartos y ejecutar las operaciones analíticas disponibles

#### Scenario: Usuario de otro rol abre análisis
- **WHEN** una sesión autenticada sin rol `ADMINISTRADOR` ni `SUPERVISOR` solicita el módulo analítico
- **THEN** el sistema responde 403 y no revela resultados ni datos de análisis

### Requirement: Indicadores y series temporales
El sistema SHALL presentar indicadores y gráficas de lecturas y accesos con filtros por cuarto y periodo, e identificar claramente unidades, intervalo temporal y ausencia de datos.

#### Scenario: Usuario filtra un periodo y cuarto
- **WHEN** un Administrador o Supervisor selecciona un cuarto y un periodo
- **THEN** las tarjetas, gráficas y tablas muestran solo datos del alcance y periodo seleccionados

#### Scenario: Usuario consulta una serie ambiental
- **WHEN** hay lecturas ambientales para el filtro seleccionado
- **THEN** el sistema muestra una serie temporal identificada por métrica, unidad y tiempo

### Requirement: Indicadores de acceso y patrones
El sistema SHALL mostrar volúmenes y resultados de acceso por periodo, incluida la distribución horaria y el agrupamiento de afluencia cuando existan datos suficientes.

#### Scenario: Hay eventos de acceso suficientes
- **WHEN** el periodo seleccionado contiene eventos de acceso
- **THEN** el sistema muestra accesos permitidos y denegados, y la distribución o agrupamiento horario derivado

#### Scenario: No hay datos suficientes para agrupar
- **WHEN** el conjunto seleccionado es insuficiente para producir agrupamientos
- **THEN** la interfaz indica que no hay datos suficientes y no presenta grupos como una conclusión válida

### Requirement: Anomalías y correlación ambiental
El sistema SHALL mostrar lecturas fuera de umbral y resultados analíticos de anomalías, además de la correlación entre ocupación y PM2.5 cuando existan mediciones suficientes y sincronizadas.

#### Scenario: Se consulta una anomalía
- **WHEN** existen lecturas anómalas para el alcance y periodo seleccionados
- **THEN** la interfaz presenta el cuarto, métrica, valor, umbral, severidad y tiempo disponibles

#### Scenario: Correlación sin muestra suficiente
- **WHEN** no hay suficientes pares de ocupación y PM2.5 para el filtro solicitado
- **THEN** el sistema informa que el resultado no es concluyente en lugar de mostrar una correlación interpretada como válida

### Requirement: ETL verificable
El sistema SHALL extraer, limpiar, transformar y preparar los datos de acceso y ambiente para análisis, e informar cuántos registros leyó, descartó y cargó, el periodo procesado y si usó datos simulados.

#### Scenario: ETL procesa datos almacenados
- **WHEN** un usuario autorizado ejecuta el ETL
- **THEN** el sistema realiza el procesamiento y devuelve un resumen verificable de la ejecución

#### Scenario: ETL usa datos simulados
- **WHEN** el proceso necesita datos de demostración por insuficiencia de datos reales
- **THEN** los resultados identifican explícitamente los datos como simulados y no los mezclan silenciosamente con datos operativos

### Requirement: Entrenamiento y evaluación de modelos
El sistema SHALL conservar la versión y parámetros del modelo, evaluar resultados con un conjunto de prueba apropiado y exponer métricas e historial suficientes para interpretar cada entrenamiento.

#### Scenario: Entrenamiento con datos suficientes
- **WHEN** un usuario autorizado entrena un modelo con datos suficientes
- **THEN** el sistema persiste el resultado, la versión, los parámetros y las métricas de evaluación y los presenta en análisis

#### Scenario: Entrenamiento con datos insuficientes
- **WHEN** no hay datos suficientes para entrenar o evaluar
- **THEN** el sistema informa el estado insuficiente y no presenta métricas como desempeño validado
