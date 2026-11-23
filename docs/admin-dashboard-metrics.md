# Indicadores del dashboard Admin

El dashboard consume `GET /api/v1/dashboard/admin/summary` y envía `cleanroom_id`, `start_at` y `end_at`. Los presets son 7, 30 y 90 días; el intervalo se transmite en UTC como `[inicio, fin)`. La API rechaza intervalos invertidos o mayores de 366 días y cuartos inexistentes.

| Indicador | Definición | Alcance y cautela |
| --- | --- | --- |
| Accesos permitidos (%) | Permitidos / (permitidos + denegados) × 100, derivado de la serie de eventos del periodo. | Los días sin eventos no cuentan. Sin eventos muestra “—”. |
| Lecturas en rango (%) | Lecturas que caen dentro del mínimo y máximo / lecturas comparables con un límite habilitado y unidad coincidente × 100. | El denominador se reporta como `limits_sample_count`; sin muestras comparables no se calcula porcentaje. La respuesta limita la inspección a 20 000 registros más antiguos dentro del periodo, por lo que una serie muy densa necesita paginación/agregación SQL antes de uso operativo. |
| Alertas activas | Alertas con estado activo al consultar. | Snapshot actual; no hereda el filtro de fecha. El filtro de cuarto sí limita el resumen del cuarto. |
| Lecturas recibidas | Conteo de lecturas en el intervalo y cuartos consultados. | Registros almacenados, no disponibilidad garantizada de sensores. |
| Personas activas | Cuentas activas registradas. | El conteo actual es global y no depende del periodo. |
| Alertas por severidad | Alertas agrupadas por fecha de creación y severidad. | Representa creación, no alertas que permanecen activas en cada fecha. |
| Tendencia ambiental | Promedio diario ponderado por conteo de muestras y unidad para la métrica seleccionada. | Con cuarto seleccionado muestra límites configurados cuando la unidad coincide; sin cuarto seleccionado es una tendencia agregada y no dibuja límites. |
| Ocupación actual | Personas estimadas dentro / capacidad registrada por cuarto. | Snapshot independiente del periodo. Se deriva de eventos de entrada/salida y puede diferir de un conteo físico. |

Las tarjetas y gráficas no representan telemetría no recibida, certificación ISO, calibración ni cumplimiento normativo. Valores faltantes se expresan como ausencia de datos; no se rellenan con demos.
