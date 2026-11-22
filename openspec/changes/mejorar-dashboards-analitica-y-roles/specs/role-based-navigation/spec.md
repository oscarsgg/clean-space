# Spec Delta

## Purpose

Define una navegación y una experiencia inicial coherentes con los roles de CleanSpace, impidiendo que un usuario autenticado consulte páginas fuera de su autorización y mostrando a cada rol sus herramientas de trabajo.

## ADDED Requirements

### Requirement: Rutas protegidas por rol
El sistema SHALL autorizar cada página protegida según los roles de la sesión vigente. Una sesión ausente o inválida SHALL dirigirse al inicio de sesión; una sesión válida sin el rol requerido SHALL recibir una página de error y respuesta HTTP 403.

#### Scenario: Administrador intenta abrir una ruta exclusiva de Supervisor
- **WHEN** un usuario con sesión válida de `ADMINISTRADOR` solicita una ruta exclusiva de `SUPERVISOR`
- **THEN** el sistema responde 403 y no presenta el contenido protegido

#### Scenario: Supervisor intenta abrir una ruta exclusiva de Administrador
- **WHEN** un usuario con sesión válida de `SUPERVISOR` solicita una ruta exclusiva de `ADMINISTRADOR`
- **THEN** el sistema responde 403 y no presenta el contenido protegido

#### Scenario: Usuario sin sesión solicita una ruta protegida
- **WHEN** una persona sin sesión válida solicita una página protegida
- **THEN** el sistema la dirige al inicio de sesión y no entrega datos protegidos

### Requirement: Navegación separada por rol
El sistema SHALL presentar sidebars independientes para Administrador y Supervisor, mostrando en cada uno únicamente las rutas disponibles para ese rol y su propio dashboard de inicio.

#### Scenario: Supervisor consulta su navegación
- **WHEN** un usuario Supervisor abre el menú principal
- **THEN** se muestran su dashboard, accesos, monitoreo, históricos, avisos y análisis, sin opciones administrativas exclusivas

#### Scenario: Administrador consulta su navegación
- **WHEN** un usuario Administrador abre el menú principal
- **THEN** se muestran su dashboard y herramientas administrativas, sin opciones exclusivas de supervisión

### Requirement: Dashboard por rol
El sistema SHALL ofrecer dashboards iniciales diferenciados, con indicadores y gráficas operativas derivados de la API y limitados al alcance de datos del usuario.

#### Scenario: Administrador consulta el dashboard global
- **WHEN** un Administrador abre su dashboard
- **THEN** ve resumen global de cuartos, personas, dispositivos y avisos, con gráficas de actividad y estados

#### Scenario: Supervisor consulta el dashboard asignado
- **WHEN** un Supervisor abre su dashboard
- **THEN** ve ocupación, accesos, avisos y condiciones ambientales de sus cuartos asignados, con gráficas operativas

#### Scenario: Dashboard no tiene datos disponibles
- **WHEN** una consulta del dashboard no devuelve registros o falla
- **THEN** la interfaz presenta un estado vacío o error comprensible y no inventa ni sustituye los datos por valores de éxito
