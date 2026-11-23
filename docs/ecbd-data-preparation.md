# Preparación de datos de CleanSpace

## Fuentes y periodo

La preparación consulta dos fuentes internas de la base relacional del sistema:

| Fuente | Tabla | Campos utilizados |
| --- | --- | --- |
| Telemetría ambiental | `sensor_readings` | `id`, `cleanroom_id`, `device_id`, `metric`, `value`, `unit`, `recorded_at` |
| Eventos de acceso | `access_events` | `id`, `cleanroom_id`, `source_device_id`, `direction`, `result`, `occurred_at` |

El periodo se interpreta en UTC y es semiabierto: incluye `start_at` y excluye `end_at`. Si no se envía un periodo, se usan los últimos siete días. Se permite un máximo de 366 días y de 50,000 registros por fuente en una ejecución. El administrador puede elegir cualquier cuarto existente; un supervisor solo puede preparar datos de sus cuartos asignados.

## Ejecución

`POST /api/v1/analitica/etl/ejecutar?start_at=...&end_at=...&cleanroom_id=...`

La ruta ejecuta extracción, validación, transformación, agregación resumida y persistencia. La respuesta contiene el identificador, el alcance, las fuentes, conteos de origen/preparados, calidad y transformaciones. El historial se consulta en `GET /api/v1/analitica/etl/ejecuciones`; el detalle, con `GET /api/v1/analitica/etl/ejecuciones/{run_id}`.

## Reglas de preparación

### Lecturas ambientales

- Se descartan lecturas cuyo dispositivo no existe o pertenece a otro cuarto.
- Se descartan variables o unidades vacías, valores no finitos, unidades incompatibles con el parámetro habilitado del cuarto y duplicados exactos de dispositivo/cuarto/variable/instante/valor/unidad.
- Los nombres de variable se recortan y convierten a minúsculas; la unidad se recorta y se compara sin distinguir mayúsculas. No se convierten unidades físicamente distintas.
- Se calcula una puntuación z por cuarto, variable y unidad. Una desviación estándar cero se sustituye por uno, de modo que las lecturas idénticas obtienen puntuación cero.
- Se derivan hora y día de semana UTC. Se conserva el valor original; no se imputan valores faltantes ni se eliminan excursiones ambientales válidas.
- Se calcula un resumen por día, cuarto, variable y unidad con conteo, promedio, mínimo y máximo.

### Eventos de acceso

- Solo se preparan direcciones `ENTRY`/`EXIT` y resultados `ALLOWED`/`DENIED`; los valores se normalizan a mayúsculas.
- Se descartan duplicados exactos por cuarto, instante, dirección, resultado, persona y dispositivo. Un evento denegado sin persona identificada es válido.
- Se derivan hora y día de semana UTC y se agregan conteos por cuarto, fecha, hora, dirección y resultado.

Los datos operativos originales permanecen intactos. Los motivos de exclusión se guardan en el resumen de la ejecución para que la limpieza sea visible y reproducible.

## Persistencia y linaje

- `analytics_runs` registra usuario, cuarto opcional, periodo, estado, conteos, horas de inicio/finalización y resumen del proceso.
- `prepared_analytics_records` guarda una copia por ejecución con tipo e identificador de origen, cuarto, instante observado y atributos preparados. Las lecturas incluyen valor, unidad y puntuación normalizada; los eventos incluyen categoría y atributos temporales.
- `run_id` une cada fila preparada con su resumen y permite volver a localizar su origen.
- Las ejecuciones tienen estados `RUNNING`, `COMPLETED` o `FAILED`. Los errores no exponen detalles internos al cliente.

## Isolation Forest

El entrenamiento recibe `run_id` y solo consulta las lecturas ambientales preparadas en esa ejecución. Agrupa por cuarto, variable y unidad, y omite grupos con menos de cinco filas. Sus características son la puntuación z calculada por el ETL, hora UTC y día de semana UTC. El resultado queda enlazado a `analytics_runs` mediante `model_results.analytics_run_id` y conserva periodo, parámetros, variables, grupos procesados y lecturas candidatas.

El parámetro `contamination` es 0.1, así que la proporción señalada describe la salida del modelo y no una prevalencia real confirmada. Como aún no hay etiquetas revisadas por personas, se reporta consistencia Jaccard al repetir el ajuste con tres semillas. Esa evaluación indica estabilidad, no precisión ni validez de cada señalamiento.

La interfaz permite analizar directamente el último conjunto preparado; si no existe uno para los filtros actuales, prepara datos antes de entrenar. El endpoint de métricas filtra por periodo y cuarto, y los supervisores solo reciben resultados cuyos registros preparados pertenecen a cuartos que tienen asignados.

`POST /api/v1/analitica/modelo/entrenar?run_id={run_id}` entrena sobre una ejecución específica. Si se omite `run_id` por compatibilidad con clientes anteriores, primero crea un conjunto para los últimos siete días y entrena con esa nueva ejecución.

## Límites actuales

La ejecución y el entrenamiento son síncronos; el ETL se limita a 50,000 filas por fuente y se guardan como máximo las 500 candidatas más atípicas por ejecución. Para cargas mayores, ambos procesos deberán moverse a un trabajador en segundo plano y manejar lotes/reintentos. La validación con etiquetas confirmadas, un modelo supervisado y la evaluación de K-Means continúan pendientes.

## Conjunto didáctico

Para poblar `/admin/analisis` con tendencias, accesos permitidos y denegados, alertas, duplicados detectables por ETL y resultados comparables del modelo, usa el entorno virtual del backend e instala `backend/requirements.txt` (ahí ya está `psycopg[binary]`, el driver que necesita PostgreSQL). En PowerShell, sigue los pasos de [`backend/README.md`](../backend/README.md#ejecutar-en-windows). Configura también `backend/.env` a partir de `backend/.env.example` (incluye `JWT_SECRET_KEY`, `RFID_HMAC_KEY` e `INITIAL_ADMIN_PASSWORD` válidos) y asegúrate de que la base de datos configurada en `DATABASE_URL` esté disponible. Después, desde `backend`, carga los datos base y el conjunto didáctico:

```powershell
python -m scripts.seed_data
python -m scripts.seed_analytics_demo
```

El generador crea hasta 30 días de telemetría y accesos sintéticos. Incluye excursiones deliberadas fuera de rango y algunos duplicados exactos; prepara ejecuciones de 7, 14 y 30 días por cuarto y entrena Isolation Forest para cada conjunto. Las filas fuente repetidas se reconocen para evitar volver a insertarlas, aunque cada ejecución del generador agrega nuevas ejecuciones al historial. Los registros son ficticios, solo para desarrollo/clase, y no deben mezclarse con datos operativos reales.

La demostración se puede contar como una cadena:

1. **Datos fuente:** sensores producen temperatura, humedad, partículas y presión; los controles de acceso producen entradas/salidas permitidas y denegadas.
2. **ETL:** extrae ambos tipos, valida el cuarto/dispositivo, unidades y duplicados, normaliza variables y deriva hora/día. No borra ni corrige la fuente; guarda un conjunto preparado con linaje.
3. **Características:** por cada cuarto, variable y unidad, convierte el valor a puntuación z (cuántas desviaciones respecto a la media del grupo) y agrega hora/día de semana.
4. **Isolation Forest:** analiza por separado cada grupo con al menos cinco lecturas. Elige puntos que se aíslan con pocos cortes como candidatos atípicos; contaminación 0.1 fija una proporción esperada del algoritmo, no una tasa real de fallas.
5. **Revisión:** compara resultados entre semillas con Jaccard para ver estabilidad. Sin etiquetas confirmadas, no es una medición de precisión: el resultado es una lista para investigar, no un diagnóstico.

Guion corto para la pantalla: selecciona **Últimos 30 días** y **Todos los cuartos**, pulsa **Preparar datos** para enseñar registros preparados y apartados, y después **Analizar lecturas** para enseñar candidatos, grupos y el historial de ejecuciones. Los gráficos de accesos y alertas vienen de los eventos operativos; las tarjetas y tendencias reflejan el mismo periodo filtrado. La correlación entre ocupación y partículas describe asociación, no causa.
