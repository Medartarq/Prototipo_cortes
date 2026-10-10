# Indesaco · Estudio de cortes

Aplicación estática para preparar solicitudes de corte en melamina. Los datos se procesan en el navegador: no necesita cuentas, servidor de procesamiento ni base de datos. Las bibliotecas están incluidas; no carga scripts de terceros ni envía los archivos del usuario a un servicio.

## Ejecutar en Windows

Haz doble clic en **Iniciar.cmd** y abre **http://127.0.0.1:4173**. Mantén la ventana abierta mientras uses la aplicación. Si el servidor ya está funcionando, basta con abrir esa dirección.

Alternativamente, con Node.js 20 o posterior instalado:

```powershell
cd D:\Muebles_Melamina\indesaco-app
npm run start
```

No necesitas ejecutar `npm install`. El servidor de desarrollo solo escucha en tu equipo. Abre la aplicación mediante HTTP, no mediante doble clic en index.html: los módulos, archivos de ejemplo y Web Workers requieren un servidor o alojamiento estático.

## Flujo de trabajo

1. **Proyecto:** nombre, fecha, cliente, teléfono, email y observaciones.
2. **Piezas:** importar el CSV de OpenCutList, probar el ejemplo incluido o ingresar piezas manualmente. Revisar dimensiones, cantidades, cantos y etiquetas. Las filas de material Canto no se cuentan como piezas de tablero.
3. **Materiales:** asignar el nombre de color/acabado a cada material genérico. Se conserva la separación por material de origen y espesor, aunque sus nombres de presentación coincidan.
4. **Detalles de corte:** adjuntar imágenes PNG/JPG a los identificadores CE; indicar el ancho de cinta para los biseles. Opcionalmente agregar una imagen general del mueble.
5. **Optimizar tableros:** elegir un grupo, configurar tablero/sierra/saneado/veta y calcular. Es un paso opcional para emitir la solicitud.
6. **Revisar y exportar:** Excel/PDF completos, Excel/PDF individuales, ZIP de todos los grupos o CSV revisado. Los errores bloquean la exportación; los detalles pendientes se pueden emitir como borrador explícito.

**Guardar proyecto** descarga un archivo `.indesaco` con datos, imágenes y planes calculados, incluidos movimientos manuales. **Abrir proyecto** permite recuperarlo. Los planes recuperados vuelven a verificarse. Sin este archivo, cerrar o recargar la página pierde los datos de la sesión. No hay guardado automático ni historial.

## Guía integrada de OpenCutList

Abre **Recursos → Guía de OpenCutList**, o el botón de ayuda de la pantalla Piezas. Incluye preparación del modelo, ubicación de las etiquetas en las propiedades de pieza, sintaxis de ranuras/biseles/cortes especiales, resolución de bordes AUTO, pasos de exportación y tabla de columnas. Los ejemplos tienen botones para copiar las etiquetas y hay un CSV de referencia descargable. La guía distingue las convenciones de Indesaco de las funciones nativas de OpenCutList e incluye enlaces a su documentación oficial. Abrirla y regresar al listado conserva el proyecto de la sesión.

## CSV esperado

Referencia incluida: `assets/ejemplo.csv`, basada en escrotorio_rev2.csv. Contiene 15 tipos de pieza, 39 unidades y dos grupos de tablero; se incluye como ejemplo público.

Exporta desde OpenCutList en UTF-8 con las siguientes columnas:

- `No.`, `Designación`, `Cantidad`.
- `Longitud - cruda`, `Ancho - crudo`, `Espesor - crudo`: medidas de corte, con los descuentos ya realizados por OpenCutList.
- `Longitud`, `Anchura`: medidas finales de referencia.
- `Tipo de material`, `Nombre del material`, `Etiquetas`.
- `Longitud del borde 1`, `Longitud del borde 2`, `Ancho del borde 1`, `Ancho de borde 2`.

Admite separadores punto y coma, coma o tabulación, comillas CSV y decimales con coma o punto. Las dimensiones admiten mm, cm, m e pulgadas. Las cantidades deben ser enteros positivos. Si hay dos columnas Etiquetas, usa la primera como operaciones, como en las exportaciones anteriores.

Los cuatro bordes se corresponden con L1, L2, A1 y A2, respectivamente. Las medidas de corte importadas **no se descuentan nuevamente**. El reporte distingue estas medidas de las medidas finales. Al ingresar una pieza manualmente, se introducen sus medidas de corte; las medidas finales calculadas usan 1 mm para D y 3 mm para G como referencia. No sustituyen los datos físicos de la cinta del taller.

## Etiquetas estandarizadas

Una operación por etiqueta, separadas por punto y coma o salto de línea:

```text
RANURA P=4 A=4 D=18 BORDE=L_AUTO
BISEL ANG=45 BORDE=A1
CORTE_ESPECIAL DETALLE="AUTO"
```

- **RANURA:** P = profundidad; A = ancho de la ranura; D = distancia hasta el **inicio** de la ranura, todo en mm. BORDE acepta L1, L2, A1, A2, L_AUTO o A_AUTO.
- **AUTO de ranura:** si solo uno de los dos bordes del eje lleva canto, la referencia será el borde opuesto. Si ambos o ninguno llevan canto, se elige L1 o A1 porque, según el criterio de montaje establecido, son equivalentes. La cara es indiferente. El lado se resuelve de nuevo si se editan los cantos.
- **BISEL:** ANG entre 0 y 90 grados, sin incluir los extremos; BORDE explícito. El borde inclinado recibe canto D por defecto, aun si el CSV trae G. En Detalles de corte se puede cambiar a G. La cinta debe cubrir como mínimo espesor/cos(ángulo); a 45° y 18 mm son 25,5 mm. El ancho se informa por separado de su grosor. No se modifica la medida de corte importada.
- **CORTE_ESPECIAL:** AUTO asigna CE01, CE02, etc. y solicita una imagen. El reporte y CSV revisado muestran el identificador resuelto. Puedes escribir `DETALLE=CE01` para relacionar varias piezas con el mismo dibujo. Los identificadores AUTO se conservan al reordenar o guardar un proyecto y no dependen del código de pieza, que puede repetirse entre materiales.

El CSV revisado es un resumen de fabricación; el archivo `.indesaco` es el respaldo completo con imágenes, ajustes de cantos y planes. Usa este último para retomar un trabajo sin perder configuración.

## Optimizador: alcance de esta versión

- Motor rectangular de guillotina con dos etapas: primero obtiene un plan mediante 96 alternativas rápidas o 600 ampliadas; después explora colocaciones y ambos sentidos de división, conservando hasta 256 o 512 estados alternativos. Descarta estados con área útil insuficiente o sin capacidad para las piezas pendientes, elimina equivalencias geométricas y verifica cada mejora de forma independiente. Se ejecuta en un Web Worker.
- La segunda etapa está acotada a 160 unidades y hasta 4 tableros por grupo, con límites de 160 000 nodos / 6 segundos en búsqueda rápida y 800 000 nodos / 20 segundos en ampliada. Fuera de ese alcance sigue disponible la primera etapa, hasta el límite general de 1500 piezas. Agotar la búsqueda no demuestra que una solución mejor sea imposible; se conserva el mejor plan válido. Si una nueva búsqueda devuelve un resultado peor en cantidades ubicadas o número de tableros, la interfaz conserva el anterior.
- Separa los grupos de material y espesor. El nombre comercial es editable.
- Medidas sugeridas 2440 × 2150 y 2440 × 1220 mm, editables. Defaults de sierra 3 mm y saneado 10 mm **en cada lado**: confirmar con el taller.
- Veta paralela al largo por defecto; también ancho o sin veta. La orientación de cada pieza y la autorización de giro se editan en Piezas. Permitir giro no elimina la restricción de veta.
- Cantidad de tableros disponible opcional. Las piezas sin ubicar se muestran y el plan incompleto no se exporta como ejecutable.
- Selección y arrastre de piezas, ajuste de coordenadas, giro, traslado entre tableros y deshacer. Los cambios se aceptan solo si pasan una verificación independiente de contención, dimensiones, veta, separación de sierra, cantidades y existencia de una secuencia de guillotina.
- Dibujo, métricas, secuencia de cortes y anexo de retazos recuperables exportables a PDF; las coordenadas se miden desde la esquina superior izquierda del tablero original, incluido el saneado. La secuencia muestra tramo y origen del subtablero.
- Límite de esta versión: 1500 unidades por grupo, geometría a centésimas de mm. Las operaciones especiales se procesan después del corte rectangular de la pieza; no hay nesting de contornos irregulares.

El motor ofrece un plan válido, **no garantiza el óptimo global**. Solo informa mínimo demostrado cuando usa tantos tableros como el límite inferior de área, que es una prueba de cantidad, no de orden de corte ni de desperdicio óptimo. La búsqueda ampliada intenta mejorar el resultado y puede devolver el mismo. Los movimientos manuales recalculan la secuencia, los retazos y las métricas de calidad, después de comprobar su validez geométrica.

Con el CSV de ejemplo, tablero 2440 × 2150 mm, sierra 3 mm, saneado 10 mm por lado y veta al largo, esta versión encuentra **1 tablero de 18 mm para las 35 unidades** y **1 tablero de 3 mm para las 4 unidades**. El mínimo de cantidad queda demostrado al alcanzar la cota inferior de área. La búsqueda usa exclusivamente el CSV y las restricciones: no lee el SVG de referencia ni guarda sus coordenadas. Se comprobó también con nombres/códigos distintos, entrada invertida, stock limitado a 1 y dimensiones escaladas. Todavía falta comparar más casos y mejorar criterios de retazos reutilizables, continuidad de veta y costos.

### Retazos y facilidad de corte

Después de buscar el menor número de tableros, una etapa de refinamiento compara más distribuciones dentro del mismo límite. Siempre prioriza cantidades ubicadas y tableros: una mejora secundaria no puede empeorar esos resultados. Si la búsqueda ampliada no mejora el plan anterior con la prioridad elegida, se conserva el anterior.

En Optimizar tableros puedes elegir:

- **Equilibrado:** pondera área recuperable, mayor retazo, número y longitud de cortes y cambios de dirección. Es una preferencia de selección, no una prueba de óptimo global.
- **Conservar retazos útiles:** favorece primero la suma de áreas útiles y después el mayor retazo; desempata por cortes. Comparte candidatos equilibrados antes de dirigir la búsqueda a retazos.
- **Simplificar los cortes:** favorece primero el número de cortes, luego su longitud y cambios de dirección; desempata por retazos. Los cambios de dirección son una aproximación al manejo, no un cálculo de tiempo de taller.

Un retazo se considera útil si su lado mayor alcanza **300 mm** y su lado menor **100 mm**, por defecto y en cualquier orientación. Ambos mínimos son editables. Los retazos se recuperan de una secuencia de guillotina ejecutable, con ancho de sierra descontado; no se usa el espacio vacío como si todo pudiera recuperarse. Se muestran en verde, con referencias R1, R2… por tablero y tabla de medidas. El PDF conserva esas referencias. Se evalúan dos órdenes de reconstrucción y dos órdenes de recorte final para mejorar la secuencia; el saneado y las operaciones especiales posteriores al despiece rectangular se cuentan aparte.

El refinamiento está acotado a 70 000 nodos / 3 segundos en búsqueda rápida y 240 000 nodos / 10 segundos en ampliada, hasta 32 candidatos completos por política rápida o 64 ampliada. Mantiene el alcance de 160 unidades / 4 tableros de la búsqueda de alternativas. El límite asegura un esfuerzo acotado; no garantiza el óptimo de cortes o retazos.

En el escritorio de referencia, el refinamiento rápido equilibrado mantiene 1 tablero y pasa de **59 a 56 cortes**, de **0,155 a 0,199 m²** de retazos útiles y de un mayor retazo de **413 × 199 mm** a uno de **764 × 188 mm**, con los mínimos 300 × 100 mm. Estas cifras comparan el plan inicial de esta versión con su refinamiento usando la misma medición de cortes. No son una comparación de tiempo de máquina con OpenCutList.

## Publicar manualmente en GitHub y Cloudflare Pages

Sube **el contenido de indesaco-app** como raíz de tu repositorio. Así evitas publicar tus PDF, SKP y documentos de trabajo de la carpeta superior.

En Cloudflare Pages, conecta tu repositorio GitHub y configura:

| Configuración | Valor |
| --- | --- |
| Framework | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Vacío, si indesaco-app es la raíz del repositorio |
| Node.js | 20 o posterior |

Si mantienes indesaco-app como subcarpeta del repositorio, usa `indesaco-app` como Root directory y conserva los demás valores. El build copia solo los archivos públicos a dist; no despliega el servidor local ni las pruebas. `_headers` aporta cabeceras del sitio para Pages. No hacen falta variables secretas, Functions, Workers de servidor ni base de datos.

Guía oficial: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

Puedes verificar el contenido generado localmente con `npm run build`. La aplicación no se ha publicado ni se han creado repositorios desde esta sesión.

## Verificación y estructura

```powershell
npm run test
npm run build
```

Pruebas del núcleo y optimizador en `tests/core.test.mjs`: CSV real, cantidades, agrupación, resolución de ranuras, biseles, identificación CE, lectura de CSV, límites de stock/veta/saneado/sierra, detección de solapes, secuencia de guillotina y 20 casos geométricos variados. También se verificaron en navegador importación, edición, eliminación, cargas de imagen, exportaciones, borradores, movimientos y guardado/recuperación.

- `core.mjs`: importación, reglas y validación de fabricación.
- `optimizer.mjs`: motor y verificación independiente; `optimizer-search.mjs`: búsqueda acotada de alternativas de guillotina; `optimizer-quality.mjs`: métricas y selección de recortes/retazos; `optimizer-worker.mjs`: ejecución en segundo plano.
- `exports.mjs`: Excel, PDF, CSV, plano de corte.
- `app.mjs`, `index.html`, `styles.css`: interfaz; `guide.mjs`: manual integrado de OpenCutList.
- `build.mjs`: empaquetado estático; `server.mjs`: servidor local.
- `assets` y `vendor`: recursos incluidos y bibliotecas con sus licencias.

No incluye todavía importación directa de PDF o SKP, extracción de geometría 3D, OCR, cotas automáticas de detalles ni integración de máquinas CNC. La entrada estructurada inicial es CSV o ingreso manual.


## Manual y estimación de costos
El manual incluye capturas de OpenCutList e Indesaco, ejemplo SKP/CSV y enlace oficial de la extensión. El SKP se abre en SketchUp.
La estimación está dirigida al diseñador: no agrega servicios automáticamente. Compra usa tableros completos y cajas de tornillos; consumo usa área de piezas y tornillos requeridos, sin desperdicio de corte ni crédito automático por retazos. Cinta: reserva inicial editable de 5 %. Tornillos: uniones y fijaciones no incluidas más reserva editable de 10 %, redondeados a cajas. Estos porcentajes y dos bisagras por puerta son supuestos iniciales, no recomendaciones del fabricante.
Asocia piezas a puertas y confirma su función; el CSV no define conexiones ni identifica automáticamente los herrajes. Configura bisagras, bases, cierre suave integrado o independiente, adaptadores, topes adhesivos y tiradores. Integrado no suma amortiguadores independientes. Precio de tornillos por caja; resto de herrajes por unidad o juego. Para distintos tipos, añade conceptos separados. Modelos y cantidades se confirman manualmente.
Los datos se guardan en .indesaco; además se puede descargar/cargar configuración de herrajes JSON. Si cambia una pieza asociada, la estimación avisa. Los archivos existentes conservan sus datos; precios antiguos de servicios ya no se incluyen automáticamente. El PDF indica supuestos y pendientes.
