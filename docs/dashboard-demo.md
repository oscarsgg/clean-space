# Guía de demostración académica: CleanSpace

## Precondiciones

- Iniciar API y frontend con sus variables de entorno y base de datos configuradas.
- Contar con una cuenta activa `ADMINISTRADOR` y una cuenta `SUPERVISOR` con cuartos asignados.
- Disponer de registros guardados de accesos, lecturas ambientales, dispositivos y avisos. Identificar por separado cualquier dato creado para demostración.
- Para validar cookies entre subdominios, configurar `COOKIE_DOMAIN` con el dominio compartido; en HTTPS se habilitan cookies `Secure` automáticamente fuera de `development` y `test`.

## Recorrido

1. Iniciar sesión como Administrador y abrir `/admin/dashboard`. Cambiar periodo y cuarto; contrastar accesos por día, ocupación, estados de dispositivo y KPIs con los registros de origen.
2. Abrir `/admin/analisis` o `/analisis`. Revisar indicadores y módulos analíticos con el alcance global de Admin.
3. Iniciar sesión como Supervisor y abrir `/supervisor/dashboard`. Confirmar que solo aparecen cuartos asignados; filtrar periodo/cuarto y contrastar accesos y promedios ambientales.
4. Abrir `/supervisor/analisis` o `/analisis`. Confirmar disponibilidad de análisis y alcance limitado a los cuartos asignados.
5. Solicitar directamente una página exclusiva del otro rol con una sesión autenticada. El resultado esperado es HTTP 403; sin sesión, el resultado esperado es redirección a inicio de sesión. Repetir con el módulo compartido de análisis.
6. En análisis, revisar primero los estados vacíos/insuficientes. Ejecutar ETL o entrenamiento solo como demostración del comportamiento que efectivamente reporte la API; no interpretar datos de muestra como mediciones físicas ni una detección exploratoria como certificación.

## Evidencia sugerida

- Capturas de ambos dashboards con los filtros y rol visibles.
- Respuestas de API para los mismos filtros, con timestamps, cuartos y resultados contrastables.
- Código HTTP de acceso directo (403 para rol incompatible; login para sesión ausente/expirada).
- Evidencia de registros de origen y, si aplica, etiqueta explícita de datos simulados.

El estado de dispositivos representa el último estado reportado por software. Esta demostración no valida sensores, RFID, cerraduras, calibración ni cumplimiento normativo físico.
