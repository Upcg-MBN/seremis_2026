# Panel de Seguimiento de SEREMIs

Panel para el Gabinete del Subsecretario de Bienes Nacionales: consolida en una
sola pantalla el seguimiento de las 16 SEREMIs, que hoy vive repartido en
planillas separadas. Cubre las cinco dimensiones del documento
`Sistema_Seguimiento_SEREMIs.docx`: cumplimiento CDC, tiempos de respuesta a
oficios, gestión de catastro, gestión de Bienes y DCPR, y gobierno en terreno.

**Datos mixtos.** El **CDC**, la **gestión DCPR**, el **presupuesto CDC**, la
**gestión de Bienes** y la **gestión de Convenios** son cifras reales, leídas
de los paneles que publican DIPLAP, el DCPR, el Departamento de Presupuesto y
Panel-Autoridades, y de la planilla de UPCG, así que coinciden con lo que ve
el resto del Ministerio. Oficios, catastro y gobierno en terreno siguen con
**datos de ejemplo** hasta que exista su fuente; el panel lo marca en
pantalla, en la matriz y en el PDF.

| Dimensión | Fuente | Estado |
|---|---|---|
| Cumplimiento CDC | [Panel de Gestión Institucional 2026](https://upcg-mbn.github.io/panel_gestion_2026/) (DIPLAP) | Real |
| Gestión Regularización | [Panel de Gestión Mensual DCPR](https://bienesnacionales.github.io/mbn-dcpr-reportes/) (títulos/tramitadas de la fuente principal; ingresados, resoluciones, proceso y CBR de su sub-panel «Flujos») | Real |
| Presupuesto CDC | [Panel Presupuestario MBN](https://presupuestombn.github.io/panel-presupuestario-mbn/) (Depto. de Presupuesto) | Real |
| Gestión de Bienes | [Panel-Autoridades](https://github.com/Upcg-MBN/Panel-Autoridades) (6 trámites: Concesión OLP, Servidumbres, Arriendo, Aprovechamiento de Aguas, Venta, Ventas por Propuesta Pública) | Real |
| Gestión de Convenios | `plantillas/Base_Convenios.xlsx` (planilla de UPCG, sincronizada por OneDrive; no es un panel público, ver «Comprobado» del 01-10-2026) | Real |
| Catastro | `plantillas/catastro.csv` (informe trimestral) | Ejemplo |
| Oficios | `plantillas/oficios.csv` | Ejemplo |
| Gobierno en terreno | `plantillas/gobierno_en_terreno.csv` | Ejemplo |

```powershell
# leer las fuentes y escribir datos.js (necesita internet, ~5 s)
C:\Users\jvalenzuelal\AppData\Local\Python\pythoncore-3.14-64\python.exe extraer.py

# comprobar la lógica (43 aserciones)
node prueba.js

# abrir el panel: doble clic en index.html, o servirlo para revisarlo con Chrome
python -m http.server 8765 --bind 127.0.0.1
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | El panel entero: HTML, CSS y la lógica de dibujo. Sin framework ni build. Se abre con doble clic. |
| `datos.js` | **Generado.** `window.DATOS = {…}` con un bloque por dimensión. No editar a mano. |
| `agregar.js` | Filtros y agregaciones puras, sin DOM: días de respuesta, variaciones contra el periodo anterior, top de trámites y las reglas del semáforo. Se prueba con Node. |
| `prueba.js` | `node prueba.js`. Sin framework: `assert` y listo. |
| `extraer.py` | Construye `datos.js`: lee los paneles de DIPLAP, del DCPR, del Panel Presupuestario y de Panel-Autoridades, lee `plantillas/Base_Convenios.xlsx` con `openpyxl`, y genera la parte de ejemplo. `FUENTE_CDC`, `FUENTE_DCPR`, `FUENTE_PRESUPUESTO`, `FUENTE_GESTION` y `FUENTE_CONVENIOS` (en `.env`) aceptan una ruta local. |
| `mapa.js` | **Generado en `DASHBOARD SUBSE`.** Chile en tres paneles, como rutas SVG ya proyectadas. Copia literal. |
| `ds/` | Sistema de diseño MinBienes: tokens, fuentes gobCL y logos. Copia literal de `..\DASHBOARD SUBSE\ds\`. |
| `plantillas/` | `Base_Convenios.xlsx` (real, la mantiene UPCG) y los formatos de captura propuestos para las tres fuentes que todavía no existen, con `LEEME.md`. |
| `CLAUDE.md` | Contexto largo: modelo de datos, reglas del semáforo, entorno, pendientes. |
| `_design/ _estandar/ _referencia/` | Material de consulta. No se publican (están en `.gitignore`). |

## Las páginas

| Página | Qué responde |
|---|---|
| **Resumen ejecutivo** | Cumplimiento CDC, títulos entregados, solicitudes tramitadas y SEREMIs en rojo; la matriz de 16 SEREMIs × 6 dimensiones y la lista de alertas ordenada por gravedad. |
| **Cumplimiento CDC** | Barras del cumplimiento global de cada SEREMI con el umbral de 90 %. Al hacer clic en una, abajo aparecen sus indicadores bajo 90 %, con meta, avance y análisis de causa. Más la evolución mensual. |
| **Respuesta a oficios** | La mediana de días que demora cada SEREMI y la lista de lo que sigue sin responder, del más antiguo al más reciente. |
| **Gestión de catastro** | Cantidad de UC, superficie fiscal (ha), % de la superficie fiscal nacional, UC administradas por el Ministerio (sin acto de administración), UC con acto de administración vigente (entregadas a terceros), estas dos con su variación contra el trimestre anterior, y UC parcialmente administradas. Las tres de tenencia suman el total de UC, como en el informe de Catastro en Power BI. |
| **Gestión de Bienes** | Ingresados, finalizados, stock y rezago de casos (Concesión OLP, Servidumbres, Arriendo, Aprovechamiento de Aguas, Venta, Ventas por Propuesta Pública — esta última incluye Concesión por propuesta pública), con un combo de checkboxes para elegir trámites. Los tres primeros KPI comparan el año a la fecha con el mismo periodo del año anterior; el rezago es un conteo aparte (ver Decisiones de visualización). Tabla por trámite; gráfico por SEREMI (con marca del valor del año anterior) para Ingresados, Finalizados o Stock, a elección. |
| **Gestión Regularización** | Seis KPI: Ingresados, Títulos entregados, Resoluciones positivas, Resoluciones negativas (tipos A+B+C), Casos en proceso (foto al corte) y Casos ingresados al CBR — los cinco últimos comparados con el mismo periodo del año anterior. Abajo, un solo gráfico «Resoluciones por SEREMI» con botones para elegir el tipo (A, B o C) y una marca del mismo mes del año anterior sobre cada barra, más su tabla de datos (los tres tipos juntos) plegada debajo. |
| **Gestión de Convenios** | Foto del estado de los convenios a la fecha de la planilla (sin serie mensual): Convenios vigentes, Monto Convenio y Convenios en trámite, con un combo de Materia (Propiedad fiscal, Regularización, Mixto, Otro) junto al de SEREMI. Debajo, la tabla «Convenios FT» (con un botón Vigentes/Todos, parte en Vigentes) y la tabla «Convenios en trámite». |
| **Gobierno en terreno** | Salidas a terreno sobre el mapa regional y las minutas de la última quincena. |
| **Presupuesto CDC** | Presupuesto vigente, devengado y % de ejecución del Convenio de Desempeño Colectivo por SEREMI, con el detalle de cada una. No es una de las cinco dimensiones del documento del Gabinete ni entra al semáforo: es un corte único («resultado final» del mes) del Panel Presupuestario, sin serie mensual. |

El filtro de SEREMI es global: se aplica a todas las páginas. También se puede
elegir una región haciendo clic en el mapa o en una barra del CDC o del DCPR.

## Decisiones de visualización

- **El estado nunca va solo en color.** Cada celda de la matriz lleva ícono, y
  etiqueta de texto salvo en celular, donde la llevan el `title` y el
  `aria-label`. Es la regla del estándar del Ministerio y aquí importa el doble,
  porque la matriz es lo primero que se mira.
- **Ninguna comparación entre SEREMIs.** Cada una se mide contra su meta o
  contra sí misma en el periodo anterior. El documento lo pide explícitamente
  para catastro, y aplicarlo en todo el panel evita que el resumen se lea como
  un ranking, que no es lo que el Gabinete encargó.
- **Los umbrales están declarados, no escondidos.** Qué cuenta como «alerta» y
  como «crítico» está en el glosario del panel y en un solo lugar del código
  (`REGLAS`, en `agregar.js`). El documento no los fija: son una propuesta que
  hay que acordar.
- **El periodo en curso no entra en las comparaciones.** El mes de corte es
  parcial y se informa en su propia columna. Si entrara, todas las SEREMIs
  aparecerían cayendo.
- **Los oficios sin responder cuentan su espera hasta hoy.** Promediar solo lo
  respondido escondería a quien no contesta.
- **Una sola serie, un solo azul.** El largo de la barra ya codifica la
  magnitud; pintarla más oscura es redundante y se rompe al filtrar.
- **Sin librerías de gráficos.** Los dos gráficos y los minigráficos son SVG
  armado a mano, como en los otros paneles del Ministerio. El archivo pesa lo
  que pesa el HTML.
- **El catastro se ordena de norte a sur, no por magnitud**, justamente para que
  no se lea como ranking. Las barras del CDC y del DCPR también.
- **El CDC se calcula igual que en DIPLAP** (Σ contribución ponderada al
  cumplimiento ÷ Σ contribución ponderada a la meta) y con sus mismos cortes de
  color (90 % y 75 %): una SEREMI no puede salir verde allá y ámbar aquí.
- **Las cifras del DCPR cuadran con el informe publicado o no se escriben.**
  `extraer.py` suma las 16 regiones y las compara con los totales nacionales
  del informe; si no calzan, sale con error y deja el `datos.js` anterior. Lo
  mismo con el sub-panel «Flujos» (ingresados, resoluciones, proceso, CBR):
  cada uno se compara contra el total «NACIONAL» que trae esa fuente.
- **Cada métrica de «Flujos» usa su propio corte**, no uno compartido: a veces
  ingresados y casos en proceso van un mes más atrás que resoluciones y CBR,
  porque esa es la fecha hasta donde la fuente los tiene cargados. Forzar un
  solo corte para las seis tarjetas habría escondido ese atraso o mostrado un
  mes sin datos como si fuera cero.
- **Tramos apilados en los colores de serie 1 a 3**, no en verde y rojo: una
  solicitud negativa no es un «estado crítico», y los colores de estado están
  reservados. Validados con el validador de la skill `dataviz`.
- **El rezago de Gestión de Bienes es una cota, no un conteo exacto.** Es
  «casos que ya estaban en trámite al 31-12-2025 y que al corte siguen sin
  resolver», pero el panel no guarda el caso a caso (por diseño: nunca se
  versiona una fila por expediente). Se calcula como el stock a diciembre de
  2025 menos todas las bajas desde enero de 2026, sin bajar de cero — es decir,
  suponiendo que las bajas del año cierran primero lo más antiguo. Se calcula
  igual por trámite que en total (columna de la tabla y tarjeta), y el % que
  «ya se cerró» sale de comparar ambos. Si la fuente algún día entrega
  antigüedad por caso, esto se reemplaza por un conteo real.
- **El gráfico de Gestión de Bienes cambia de color según la variable elegida**
  (Ingresados / Finalizados / Stock), con los mismos tres tokens que ya usan las
  tramitadas del DCPR (`--chart-1…3`, validados), en el mismo orden fijo:
  ayuda a notar de un vistazo cuál de las tres se está mirando sin inventar
  colores nuevos.
- **Gestión de Convenios muestra el monto en pesos (`$`), no en miles (`M$`)
  como el resto del panel.** Es el único bloque cuya fuente trae el monto así
  (`$20.000.000` en la propia planilla); convertirlo a miles para que calzara
  con Presupuesto habría sido una columna calculada que nadie pidió, y el
  símbolo distinto ya avisa que la unidad es otra.

## Pendientes

| Pendiente | Nota |
|---|---|
| **Dónde se publica** | El panel trae desempeño por SEREMI, atribuible a personas. No publicarlo en un repositorio público sin aprobación. |
| Catastro real | Pedir a DICAT el informe trimestral en el formato de `plantillas/catastro.csv`. |
| Oficios y terreno | Las dos planillas por crear. Ver `CLAUDE.md` §6. |
| Umbrales del semáforo | Acordarlos con el Gabinete y recalibrarlos con datos reales, incluido el de Gestión de Bienes (§ finalizados vs. año anterior), provisional igual que los demás. |
| Plantillas en `.xlsx` | Con encabezados bloqueados y listas desplegables se capturarían menos errores. `openpyxl` ya está instalado (lo usa Gestión de Convenios). |
| Convenios: actualización manual | `Base_Convenios.xlsx` no se sincroniza solo: el enlace de SharePoint exige login institucional, así que alguien de UPCG debe mantener al día la copia local. Si se consigue un acceso programático (API de Graph con credenciales de aplicación, o un enlace de «compartir» con descarga anónima habilitada), se podría volver a automatizar como las demás fuentes. |
| Publicación diaria | Copiar `publicar_diario.ps1` + `publicar_oculto.vbs` de `..\DASHBOARD SUBSE` cuando haya fuente real. |
| Enlace en el Centro de Paneles | La entrada `desempeno-seremis` ya está reservada; falta ponerle la `url`. |

## Comprobado

Al 25-09-2026:

- `python extraer.py` lee los dos paneles publicados en ~4 s, escribe
  `datos.js` (93 KB) y sale con código 0. Las 16 regiones de ambas fuentes
  calzan con un código.
- Las cifras coinciden con las fuentes: el cumplimiento CDC de agosto por
  SEREMI es el mismo de DIPLAP (p. ej. Arica y Parinacota 67,9 %, Maule
  106,6 %); el DCPR a agosto da 3.040 títulos entregados y 3.101 / 10.234 / 336
  solicitudes positivas / negativas / a tribunales, las mismas del informe.
- `node prueba.js`: 24 aserciones, todas pasan.
- Las siete páginas cargan sin mensajes de consola y sin desborde horizontal a
  **1440, 1024 y 390 px** (`.impeccable/review/anchos.html`, 21 combinaciones).
- **Sin verificar:** el PDF del modo informe con las páginas nuevas.

Al 29-09-2026:

- Gestión de Bienes pasó a real: `extraer.py` lee `Panel-Autoridades/datos.js`
  (JSON válido), filtra a los trámites acordados (`TRAMITES_BIENES`) y conserva la serie
  completa desde 1998 para poder calcular el stock. La suma de los cuatro
  trámites cuadra con el total que trae la fuente, o no se escribe.
- `node prueba.js`: 32 aserciones, todas pasan (nuevas: `AGG.bienes()`, con
  un modelo en miniatura de dos años y dos SEREMIs).
- Con datos reales a septiembre: ingresados 2.900 (−17,1 % vs. 2025),
  finalizados 2.013 (−19,4 % vs. 2025), stock 5.988 casos (+1,1 % vs.
  septiembre de 2025).
- **Sin verificar:** las páginas nuevas (Presupuesto CDC, Gestión de Bienes)
  en un navegador real — no hubo uno disponible en esta sesión. Revisar el
  ancho de las tarjetas y el gráfico de barras con marca de año anterior
  antes de darlo por bueno.

Al 30-09-2026:

- El filtro de trámites de Gestión de Bienes pasó de una fila de checkboxes a
  un combo (`<details>/<summary>` con la cara de `.chip`) que se cierra solo
  al hacer clic afuera.
- Se agregó la cuarta tarjeta, Rezago: casos en trámite desde antes del
  31-12-2025 que siguen sin resolver al corte. Es una cota (no un conteo
  exacto por expediente), documentada en `CLAUDE.md` y en Decisiones de
  visualización. Con los datos actuales: 5.101 casos había a fin de 2025, de
  los cuales quedan 3.088 sin resolver a septiembre de 2026.
- `node prueba.js`: 33 aserciones, todas pasan (nueva: el cálculo del rezago,
  con un caso que prueba que no baja de cero).
- **Sin verificar** (igual que ayer): las páginas nuevas en un navegador real,
  incluido el combo nuevo.

Al 01-10-2026:

- El combo de trámites se movió junto al de SEREMI, en la misma barra de
  filtros (antes vivía dentro de la página). Hubo que agregar
  `.ges-combo[hidden]{display:none}`: una regla de autor con selector de
  clase (`.ges-combo{display:block}`) le ganaba en la cascada al `[hidden]`
  del navegador, así que el combo quedaba visible en todas las páginas.
- Rezago ahora también se calcula por trámite (`porTramite[].rezago`), la
  tabla trae una columna nueva y el nombre del trámite es un botón que filtra
  a ese trámite solo. La tarjeta de Rezago agrega el % ya cerrado.
- El gráfico por SEREMI usa `--chart-1/2/3` según la variable elegida, en vez
  del azul único del resto del panel.
- «Terminados» pasó a llamarse **«Finalizados»** en toda la sección (tarjeta,
  botón del gráfico, columna de la tabla), para que coincida con el nombre del
  campo del cubo (`finalizados`, ya usado así en `agregar.js` desde el
  principio). La leyenda de la tarjeta de Rezago ahora es una sola oración:
  «Se ha finalizado un XX % de los ZZZ casos rezagados (casos que al
  31-12-2025 estaban en proceso).».
- Se agregaron **Venta** y **Ventas por Propuesta Pública** a los trámites de
  Gestión de Bienes (ahora 6, antes 4). La segunda incluye Concesión por
  propuesta pública, aclarado con una nota chica junto a su nombre en el combo
  y la tabla, y en el glosario.
- De paso se encontró y corrigió una entrada del **Glosario** que había
  quedado desactualizada desde que Gestión de Bienes pasó a ser real: todavía
  decía «pendiente de definición… datos de ejemplo». También le faltaba la
  entrada de Presupuesto CDC, que nunca se había agregado.
- `node prueba.js`: 34 aserciones, todas pasan.
- **Sin verificar** (igual que los dos días anteriores): todo lo de Gestión de
  Bienes en un navegador real.
- **Gestión DCPR pasó a llamarse Gestión Regularización** y sumó seis
  tarjetas nuevas (Ingresados, Títulos entregados —sin cambios—, Resoluciones
  positivas, Resoluciones negativas, Casos en proceso, Casos ingresados al
  CBR) y una tabla nueva, «Resoluciones por SEREMI» (tipos A, B y C). Las
  cinco tarjetas nuevas y la tabla salen del sub-panel «Flujos» del DCPR: un
  HTML completo codificado en base64 dentro de la página principal
  (`FLUJOS_HTML_B64`), con su propio `DATA_BY_YEAR`/`INGRESOS_BY_YEAR`/
  `CBR_BY_YEAR`. `extraer.py` ahora baja la página del DCPR **una sola vez**
  y se la pasa tanto a `dcpr()` como a la función nueva `regularizacion()`,
  para no bajar los ~25 MB dos veces.
- Las tarjetas de títulos y tramitadas, las barras y la tabla «Detalle por
  SEREMI» **no cambiaron**: siguen con la fuente y la lógica de siempre
  (`AGG.dcpr()`), porque de ahí sale el semáforo de la matriz.
- `node prueba.js`: 38 aserciones, todas pasan (4 nuevas: `AGG.regularizacion()`
  con un modelo en miniatura de dos SEREMIs, incluido un caso con año anterior
  null en una sola región para comprobar que el total no queda a medias; y
  una contra el `datos.js` real que verifica A+B+C = positivas+negativas en
  las 16 SEREMIs).
- Verificado contra datos reales a agosto de 2026: 3.101 «casos ingresados al
  CBR» del sub-panel Flujos coincide exacto con las 3.101 «Positivas (ingreso
  CBR)» que ya traía la fuente principal — mismo concepto, dos datasets
  distintos del mismo panel, buena señal de que la lectura es correcta.
- **Simplificado el mismo día:** las barras «Solicitudes tramitadas»/«Títulos
  entregados» y la tabla «Detalle por SEREMI» (de la fuente principal) y la
  tabla «Resoluciones por SEREMI» (de Flujos) se reemplazaron por un solo
  gráfico de barras con botones para elegir Resolución A/B/C y la marca del
  año anterior, con su propia tabla de datos plegada debajo (los tres tipos
  juntos). Los datos y el semáforo que dependían de `AGG.dcpr()` siguen
  intactos — solo cambió qué se dibuja, no qué se calcula.
- Ajustes finos a las tarjetas: «Ingresados» ya no compara con el año
  anterior; «Casos en proceso» perdió la línea «Corte a {mes}» (ya queda
  implícito en la comparación); «Resoluciones positivas»/«Resoluciones
  negativas» ahora dicen «(A+B+C)» en el nombre.
- **Corrección: «Ingresados» traía la fuente equivocada.** Había quedado leyendo
  `INGRESOS_BY_YEAR` del sub-panel «Flujos» — y en su momento se dio por
  confirmado porque ese gráfico también se llama «Nuevos ingresos» — pero esa
  no es la fuente: el panel principal del DCPR tiene su **propio** panel
  «A · Nuevos ingresos» (`obj.ingresos.porRegion` en cada `const MES_AAAA`
  que ya lee `dcpr()`), con un total distinto y actualizado a un mes más
  reciente. El usuario lo detectó comparando la cifra en pantalla (12.146,
  de Flujos, a julio) contra la del sitio (13.972, del panel A, a agosto). Se
  movió la extracción de `regularizacion()` a `dcpr()` (mismo mecanismo que
  ya usa para títulos/tramitadas, un `const` por mes), con su propio
  cruce contra el total publicado. De paso: es del **mes del corte**, no un
  acumulado en el año — otra diferencia con lo que tenía antes. `D.regularizacion`
  ya no trae ningún campo de ingresos; `D.dcpr.ingresos` es la fuente ahora.
- `node prueba.js`: 39 aserciones, todas pasan.
- **Sin verificar:** la sección nueva en un navegador real.

Al 01-10-2026:

- La navegación quedó en el orden pedido: Resumen ejecutivo, Cumplimiento CDC,
  Presupuesto, Gestión de Bienes, Gestión Regularización, Gestión de
  Convenios, Gestión de catastro, Gobierno en terreno, Respuesta a oficios.
  Afecta el menú, el orden de las `<section>` y el del diálogo de PDF; nada
  cambió de nombre salvo lo ya reordenado.
- **Nueva sección: Gestión de Convenios**, octavo bloque de `datos.js`. Fuente:
  `Base_Convenios.xlsx`, una planilla de UPCG — **no** uno de los paneles
  públicos de siempre. El enlace que se pidió usar
  (`mbnchile.sharepoint.com/:x:/…`) exige iniciar sesión con una cuenta
  institucional: se probó y redirige a `login.microsoftonline.com`, así que
  `extraer.py` no puede bajarlo por URL como a las demás fuentes. Se lee en
  cambio la copia local que OneDrive sincroniza en `plantillas/Base_Convenios.xlsx`
  (con `openpyxl`, ya instalado en el equipo); quien la mantiene la actualiza a
  mano y `extraer.py` recoge lo último que haya ahí. `FUENTE_CONVENIOS` (en
  `.env`) permite apuntar a otra copia.
- Dos hojas con columnas distintas: **«Convenios FT»** (convenios
  formalizados, vigentes y no vigentes) y **«En trámite»** (en negociación o
  firma). Ambas traen la SEREMI en texto libre, mezclada con unidades
  nacionales (DIPLAP, GABSUB, DBN, DCPR, DICAT, SNIT…) y alguna nota suelta
  que no es una región: esas filas **se omiten sin avisar**, porque no es un
  error de captura (no usan `_fallo`/`_SIN_MAPEO`, que es para avisar de algo
  que debería haber calzado y no calzó) — es justamente la regla que pidió el
  Gabinete («omitir los registros que no están relacionados a una Región o
  Seremi»). En «Convenios FT» la región sale de la columna «Región/División»
  tal cual; en «En trámite» hay que buscar el nombre de la SEREMI **dentro**
  de «RESPONSABLE MBN» (p. ej. «Seremi Los Lagos», «DCPR - Seremi O'Higgins»),
  porque ahí viene embebido en más texto.
- La Materia de «Convenios FT» es la que trae la propia planilla
  (Propiedad fiscal / Regularización / Mixto / Otro). La de «En trámite» no es
  un campo cerrado — «MATERIA (referencial)» es texto libre — así que se
  homologa por palabra clave a esas mismas 4 categorías (incluidos los números
  de las dos leyes de regularización, 2.695/1979 y 1.939/1977, como señal de
  «Regularización» aunque el texto no use esa palabra).
- Tres indicadores: **Convenios vigentes** y **Monto Convenio** salen solo de
  «Convenios FT» con Estado = Vigente (un convenio vencido no debe inflar el
  monto vigente); **Convenios en trámite** es el total de la hoja «En
  trámite». Los tres respetan el filtro de SEREMI (el global del panel) y un
  filtro de Materia nuevo, propio de la página, con el mismo combo de
  checkboxes que ya usa Gestión de Bienes para Trámites. Debajo, dos tablas:
  «Convenios FT» (con un botón Vigentes/Todos, parte en Vigentes) y «Convenios
  en trámite».
- El monto va en pesos completos (`$ 20.000.000`), no en miles como el resto
  del panel (`M$`): la planilla los trae así y convertirlos habría sido
  inventar una columna calculada que nadie pidió.
- Con los datos de hoy: 77 convenios de «Convenios FT» con región reconocida
  (36 vigentes) y 11 de «En trámite», de 94 y 16 filas totales respectivamente
  — el resto son divisiones nacionales o notas sueltas, correctamente
  descartadas.
- `node prueba.js`: 43 aserciones, todas pasan (4 nuevas: `AGG.convenios()`
  con un modelo en miniatura de dos SEREMIs que prueba que un convenio no
  vigente no suma a «vigentes» ni a su monto, y que los filtros de SEREMI y de
  Materia recortan igual las dos hojas; más una contra el `datos.js` real).
- Verificado en un navegador real (Edge, sin cabeza): las tres tarjetas, el
  toggle Vigentes/Todos y ambas tablas se dibujan con datos correctos y sin
  errores de consola. **Sin verificar con mouse:** el combo de Materia
  (abrir/cerrar, «Seleccionar todos», cierre al hacer clic afuera) y el
  diálogo de exportar PDF con la sección nueva — revisarlos antes de darlo por
  completamente probado.
