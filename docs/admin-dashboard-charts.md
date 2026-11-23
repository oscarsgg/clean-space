# Gráficas del dashboard Admin

- **Filtros:** el encabezado acepta 7, 30 o 90 días y un cuarto. El cuarto filtra series históricas; los datos actuales de capacidad/ocupación se identifican como snapshot. El intervalo exacto de la API aparece en UTC.
- **Accesos:** línea de permitidos y denegados por fecha, con tooltip, leyenda y conteos textuales.
- **Alertas:** barras apiladas por severidad y fecha de creación, tooltip, leyenda y total textual por severidad.
- **Ambiente:** métrica seleccionable y promedio diario ponderado. Con un cuarto seleccionado se muestran los límites configurados que comparten unidad con la lectura; al consultar varios cuartos, los límites no se agregan ni se dibujan.
- **Ocupación:** comparación vertical de ocupación estimada y capacidad por cuarto. Su descripción aclara que se calcula con eventos de acceso y que requiere contraste operativo.
- **Teclado y lector de pantalla:** las gráficas Recharts usan `accessibilityLayer` para navegación del punto de datos, rol de imagen y etiqueta accesible; el texto vecino da una síntesis legible sin depender del color. Filtros y selectores tienen etiquetas persistentes. Los estados de carga, error y vacío se renderizan fuera del SVG.
- **Límites:** los tooltips presentan el valor registrado y su unidad cuando existe. Los registros ausentes no se interpolan; promedios, límites y ocupación no certifican calibración, cumplimiento ISO ni condición física.
