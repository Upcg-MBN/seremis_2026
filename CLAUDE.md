# Panel de Seguimiento de SEREMIs

Gabinete del Subsecretario de Bienes Nacionales. Consolida en un solo panel el
seguimiento de las **16 SEREMIs** del Ministerio, hoy disperso en planillas
separadas.

Idioma del proyecto: **español de Chile** (interfaz, comentarios, documentación,
nombres de variables y funciones), igual que `..\DASHBOARD SUBSE` y `..\Arriendo`.

El requerimiento es `Sistema_Seguimiento_SEREMIs.docx` (Gabinete, 09-09-2026).
Su criterio rector manda sobre cualquier decisión de diseño:

> «la confiabilidad del dato por sobre la exhaustividad: es preferible registrar
> menos con certeza que registrar todo con brechas».

**Estado al 01-10-2026:** **CDC, gestión DCPR, presupuesto CDC, gestión de
Bienes y gestión de Convenios con datos reales**, leídos de los paneles
publicados de DIPLAP, del DCPR, del Departamento de Presupuesto y de
Panel-Autoridades, y de la planilla `plantillas/Base_Convenios.xlsx` (UPCG).
Oficios, catastro y gobierno en terreno siguen con **datos de ejemplo** (cada
bloque de `datos.js` lleva su `origen` y el panel marca lo inventado). Falta
la fuente de esas tres (§6) y decidir dónde se publica (§8).

Los KPI por dimensión los fijó el usuario el 25-09-2026: CDC = barras del
cumplimiento global por SEREMI y, al hacer clic, sus indicadores bajo 90 %;
catastro = UC de inmuebles fiscales, superficie fiscal (ha), % nacional,
UC administradas por el Ministerio (= sin acto de administración) y UC con acto
de administración vigente (= «Entregado a tercero»), estas dos con variación; la
«Parcialmente administrada» del informe va aparte y las tres suman el total; DCPR = títulos entregados y
solicitudes tramitadas (positivas/CBR, negativas, tribunales) con variación.
Las cifras **tienen que concordar** con los paneles fuente.

---

## 1. Las cinco dimensiones

| § doc | Dimensión | Cadencia | Fuente | Estado |
|---|---|---|---|---|
| 2.1 | Cumplimiento CDC | mensual | DIPLAP | **Real.** `extraer.py` baja `https://upcg-mbn.github.io/panel_gestion_2026/` y lee su `const ALL = [...]` (una fila por equipo × indicador × mes; Python escribe `NaN`). Filtro: `Instrumento de gestión` = CDC y `Ubicación` = Seremi. |
| 2.2 | Tiempos de respuesta a oficios | continua | Planilla del Gabinete | **Por crear.** Formato propuesto en `plantillas/oficios.csv`. |
| 2.3 | Gestión de catastro | trimestral | Informe de Catastro en Power BI (preguntas P-004 a P-008) | **Datos de ejemplo.** El informe publica una foto actual, sin historia: la variación exige guardar cada corte. Hoy solo vienen **por región** el total de UC (suma verificada 33.197 al 21-08-2026) y urbano/rural; la tenencia (Ministerio / tercero / parcial) solo en total nacional (17.152 / 15.217 / 828). Falta exportar Región × Tipo de administración y la superficie en ha. Formato en `plantillas/catastro.csv`. |
| 2.4 a | Gestión de Bienes | anual (año a la fecha vs. año anterior) | [Panel-Autoridades](https://github.com/Upcg-MBN/Panel-Autoridades) | **Real, pero distinto de lo que pedía el documento** (ver nota abajo y §8): no es «los más gestionados» dinámico ni viene de GXP/DBN, sino una lista fija (`TRAMITES_BIENES` en `extraer.py`: Concesión OLP, Servidumbres, Arriendo, Aprovechamiento de Aguas, Venta, Ventas por Propuesta Pública — ampliada el 01-10-2026; esta última incluye Concesión por propuesta pública) desde la base pública que ya usa DASHBOARD SUBSE. |
| 2.4 b | Gestión Regularización (antes «Gestión DCPR») | mensual | Informe de Gestión DCPR | **Real.** `extraer.py` baja `https://bienesnacionales.github.io/mbn-dcpr-reportes/` (25 MB) **una sola vez** y la pasa a dos funciones: `dcpr()` (títulos, tramitadas **e ingresados** — ver nota de ingresados abajo — de un `const MES_AAAA = {...}` por informe; el detalle de tramitadas va en `<script id="data-…" data-gz="1">`, gzip + base64, trae **nombre y RUT**, se cuenta y se descarta) y `regularizacion()`, nueva (01-10-2026): el sub-panel «Flujos» de esa misma página, un HTML completo en base64 (`FLUJOS_HTML_B64`) con su propio `DATA_BY_YEAR`/`CBR_BY_YEAR` — resoluciones A/B/C (positivas/negativas), casos en proceso y CBR, cada uno con su propio corte. Solo el nombre de la página cambió; `dcpr`/`DCPR` como clave e id interno siguen igual (ver §2). |
| 2.5 | Gobierno en terreno | quincenal | Planilla de cada SEREMI | **Por crear.** `plantillas/gobierno_en_terreno.csv`. |
| — | Presupuesto CDC | sin serie, corte único | [Panel Presupuestario MBN](https://presupuestombn.github.io/panel-presupuestario-mbn/) (Depto. de Presupuesto) | **Real, fuera de las cinco dimensiones del documento.** Página aparte, sin semáforo ni umbral que acordar con Gabinete: presupuesto vigente, devengado y meta del CDC por SEREMI, al «resultado final» del mes. El panel publica solo el corte vigente, no una serie mensual, así que no hay variación contra el periodo anterior. |
| — | Gestión de Convenios | sin serie, foto a la fecha de la planilla | `plantillas/Base_Convenios.xlsx` (UPCG, 01-10-2026) | **Real, fuera de las cinco dimensiones del documento**, igual que Presupuesto: sin semáforo ni serie mensual. Fuente **no** automatizable por URL (ver nota abajo): planilla local sincronizada por OneDrive, leída con `openpyxl`. |

Lo que el documento pide y **no** hay que confundir:

- §2.1: las metas del CDC son **en parte compartidas y en parte diferenciadas
  por región**. Por eso la meta viaja en cada fila del payload, no en el
  catálogo de indicadores. El cumplimiento global es **el de DIPLAP**:
  Σ `Contrib Cumpl Pond` ÷ Σ `Contrib Meta Pond`, sin tope en 100 % (Maule da
  106,6 %). El de un indicador es el campo `Cumplimiento` (avance efectivo ÷
  meta del periodo), tal cual viene.
- §2.4b: las cifras del DCPR son **acumuladas en el año**. La «variación
  respecto al periodo anterior» es cuánto creció el acumulado desde el informe
  previo. Tramitadas = positivas + negativas + tribunales (= «Cumplido» del
  informe); positivas = ingresos al CBR (`cbr.total`). Junio no trae detalle
  por región de tramitadas: queda `null`, nunca 0.
- §2.2: **no hay plazo estándar de respuesta**, porque los requerimientos son
  heterogéneos. El panel muestra el patrón de demora de cada SEREMI; no mide
  cumplimiento. El umbral de «oficio viejo» es una regla operativa del
  seguimiento, declarada en el glosario, no un incumplimiento.
- §2.3: «medir el progreso respecto al período anterior, **no** establecer
  comparaciones entre SEREMIs». La página de catastro no publica ranking y
  ordena de norte a sur, no por magnitud.
- §2.4: el documento pide «los 4 más gestionados por cada una y ver cómo
  avanzan respecto a ellos mismos el mes anterior». Lo que hay hoy (29-09-2026)
  es distinto en dos sentidos, decidido en sesión, no con el Gabinete: los 4
  trámites son **fijos** (Concesión OLP, Servidumbres, Arriendo, Aprovechamiento
  de Aguas), no «los que más se gestionan» de cada SEREMI; y la comparación es
  **contra el mismo tramo del año anterior**, no contra el mes anterior — el
  conteo mensual real es demasiado ruidoso para eso (mismo motivo que ya valía
  para el umbral, ver §3). Confirmar con Gabinete/DBN si estos trámites
  (`TRAMITES_BIENES`) son los que hay que seguir.
- §2.5: **formato libre** en esta etapa. Mínimos: comunas visitadas, actores y
  una minuta breve.

---

## 2. Arquitectura

```
SEREMIS/
  CLAUDE.md            este archivo
  README.md            para personas (cómo correr, decisiones, pendientes)
  extraer.py           construye datos.js: CDC, DCPR, presupuesto, gestión de Bienes y de Convenios reales + el resto de ejemplo
  datos.js             GENERADO. No editar.
  index.html           el panel (HTML + CSS + IIFE); lee datos.js, mapa.js y agregar.js
  agregar.js           agregaciones puras, sin DOM. Aquí viven las REGLAS del semáforo
  prueba.js            node prueba.js
  mapa.js              copia de ..\DASHBOARD SUBSE\mapa.js (SVG regional preproyectado)
  ds/                  sistema de diseño: tokens, fuentes gobCL y logos
  plantillas/          Base_Convenios.xlsx (real) + formatos de captura propuestos + LEEME.md
  .env.ejemplo  .gitignore
  .impeccable/         config + review/anchos.html (arnés de puntos de quiebre)
  _design/ _estandar/ _referencia/   material de consulta, NO se publica (gitignored)
```

Sin framework, sin build, sin dependencias en el navegador. `index.html` se abre
con doble clic y funciona desde `file://`, intranet o hosting: los datos entran
por una etiqueta `<script src="datos.js">`, nunca por `fetch`.

### `datos.js`

`window.DATOS = {…}`, primera línea `// Generado por extraer.py — no editar a
mano.` Trae `generado`; el panel avisa en pantalla si los datos tienen más de
`DIAS_FRESCO` días (2). **Cada bloque** trae su `origen` (`diplap` | `dcpr` |
`presupuesto` | `panel-autoridades` | `excel-local` | `demo`): el panel
muestra el aviso de datos de ejemplo en las páginas `demo`, marca «ejemplo» en
su columna de la matriz y en sus alertas, y lo escribe en la cabecera del PDF.

Un bloque por dimensión: `cdc`, `oficios`, `catastro`, `gestion` (Bienes),
`dcpr`, `terreno`, más `regiones`, `corte` y `hoy` (estos dos, de la parte de
ejemplo), más `presupuesto` y `convenios` (fuera de las cinco dimensiones, ver
abajo). `cdc.sumas[r][mes] = [Σ contrib. cumplimiento, Σ contrib. meta]`;
`cdc.filas` es el detalle por indicador **solo del último mes**.
`dcpr.titulos` y `dcpr.tramitadas` son tablas `[región][mes]`.

`dcpr.ingresos = { mes, total, porRegion }` (panel «A · Nuevos ingresos» de la
fuente principal, **no** del sub-panel «Flujos» — ahí hay un gráfico con el
mismo nombre pero es otro dataset, más atrasado; se confundieron una vez,
ver Comprobado del README al 01-10-2026). `porRegion[r]` es el total **del
mes del corte**, no un acumulado en el año; no trae año anterior, ese panel
no lo publica por región.

Aparte, `regularizacion` (el sub-panel «Flujos», ver §1): a diferencia de
todos los demás bloques, **ya viene acumulado por `extraer.py`**, no en
series por mes — cada fila trae `{ actual, anterior }` directo (año a la
fecha contra el mismo tramo del año anterior; `AGG.regularizacion(D, r)` solo
suma las filas que correspondan, no recalcula nada). Trae **tres cortes
independientes** (`corteResol`, `corteProceso`, `corteCbr`, cada uno con su
`...Anterior`), porque la fuente no actualiza esas métricas el mismo mes —
normalmente `corteProceso` va un mes atrás de `corteResol`/`corteCbr`.
`filas[r].resA/resB/resC` son el total de cada tipo de resolución (positiva +
negativa); `positivas`/`negativas` son la suma de los tres tipos por
resultado — los dos cruces (por tipo, por resultado) salen de la misma cuenta
en `extraer.py`, nunca de datos distintos. **Ya no trae `ingresos`**: eso se
movió a `dcpr.ingresos` (arriba), que es la fuente correcta.

`AGG.bienes()` también devuelve `kpi.rezago = { actual, base }` y, con el
mismo cálculo, `porTramite[].rezago`: casos que ya estaban en trámite al
**31-12-2025** (fecha fija, no relativa al año elegido) y que al corte siguen
sin resolver. El cubo no trae el caso a caso, así que es una **cota, no un
conteo exacto**: `base` es el stock acumulado hasta 2025-12 (puede salir
negativo si un trámite tuvo más bajas que ingresos antes de esa fecha — no se
recorta, para que `actual` quede bien), y `actual` es
`max(0, base − bajas desde 2026-01 al corte)`, bajo el supuesto de que las
bajas del año cierran primero lo más antiguo (FIFO). Es la única cifra de la
página que no compara con el año anterior (no tiene sentido: es del año
anterior); en vez de eso, la tarjeta muestra `(base − actual) / base` como
«% ya cerrado». La columna de la tabla respeta el mismo filtro de trámites que
las demás (si se eligen 2, la tabla muestra solo esos 2, cada uno con su
propio rezago — no hay forma de ver el rezago de uno dentro de un total
filtrado a otros).

Aparte, `presupuesto`: no es una de las cinco dimensiones ni tiene `r` en el
semáforo. `presupuesto.filas[r] = { r, presupuesto, devengado, pct, meta }`,
un corte único (`presupuesto.corte`, `'AAAA-MM'`) sin serie mensual, así que
`agregar.js` no calcula variación para este bloque.

Aparte, `convenios` (01-10-2026): tampoco una de las cinco dimensiones, sin
`r` en el semáforo, foto a la fecha de la planilla (`convenios.corte`,
`'AAAA-MM-DD'` o `null` si la hoja no trae «Fecha corte»). **Fuente distinta a
todas las demás**: el enlace que se pidió usar
(`mbnchile.sharepoint.com/:x:/s/Controldegestin2/…`) redirige a
`login.microsoftonline.com` — se probó con una petición directa y exige una
cuenta institucional — así que no es un sitio público como DIPLAP/DCPR/
Presupuesto/Panel-Autoridades y `leer()` no puede bajarlo. `convenios(fuente)`
usa `openpyxl.load_workbook()` sobre `RUTA_CONVENIOS`
(`plantillas/Base_Convenios.xlsx`, la copia que OneDrive sincroniza; override
con `FUENTE_CONVENIOS`), no `leer()`.

`convenios.materias = ["Propiedad fiscal", "Regularización", "Mixto", "Otro"]`
(índice fijo, en ese orden). `convenios.ft` y `convenios.tramite` son listas
planas (no por región/mes como el resto): cada fila trae `r` (índice 0-15,
como en todo el panel), `materia` (índice en `materias`) y `monto` (**pesos
completos**, no miles — ver `index.html` §4 y README «Decisiones de
visualización»; `null` si la celda viene vacía, nunca 0 salvo que la planilla
diga 0). `ft[].vigente` es `fila.Estado === 'Vigente'`; `AGG.convenios()` solo
suma a `kpi.vigentes`/`kpi.monto` las filas con `vigente: true`.
`AGG.convenios(D, { region, materias })` filtra ambas listas por igual
(`region`: código de dos dígitos o `null`; `materias`: nombres, no índices,
mismo patrón que `f.tramites` de Gestión de Bienes) y devuelve también
`ftVigentes` (subconjunto ya filtrado por vigente, lo que pinta la tabla
cuando el toggle de la página está en «Vigentes»).

La planilla trae la región en **texto libre, mezclado con unidades
nacionales** (DIPLAP, GABSUB, DBN, DCPR, DICAT, SNIT…) y alguna nota suelta —
no en el `región_id` numérico de la hoja «Regiones», que `extraer.py` ni
siquiera usa. Dos funciones de resolución, ninguna reutiliza `_fallo`/
`_SIN_MAPEO` (esas filas no son un error de captura, es la regla pedida:
«omitir los registros que no están relacionados a una Región o Seremi»):
- `_region_directa(valor)`: para «Región/División» de «Convenios FT», donde el
  valor YA debería ser un nombre de región. Va directo a `_POR_NOMBRE` vía
  `_clave()`; lo que no calza (DIPLAP, notas sueltas) vuelve `None` y la fila
  se descarta en silencio.
- `_region_en_texto(valor)`: para «RESPONSABLE MBN» de «En trámite», donde el
  nombre de la SEREMI va **embebido** en más texto («Seremi Los Lagos», «DCPR
  - Seremi O'Higgins», «Seremi Aysén - DBN»). Busca cada clave de
  `_POR_NOMBRE` como substring de `_clave(valor)` y se queda con la más larga
  que calce (para que «Atacama» no gane por error dentro de un nombre más
  largo que no corresponde). Lo que no trae ninguna región reconocible
  («SNIT», «DBN - UGTP», «DIVAD - DIJUR») es un convenio de alcance nacional:
  se omite igual, sin avisar.

La Materia de «Convenios FT» es la que trae la propia columna `Materia`
(cerrada a las 4 categorías; si una fila con región válida trae otra cosa o
nada, `convenios()` **lanza**, no la descarta en silencio — a diferencia de
la región, una Materia faltante en un convenio real sí es un hueco que hay
que avisar). La de «En trámite» no es un campo cerrado (`MATERIA
(referencial)` es texto libre), así que `_homologar_materia()` la clasifica
por palabra clave: `_MATERIA_PROPIEDAD_KW` (fiscal, catastro, geoespacial) y
`_MATERIA_REGULARIZACION_KW` (regulariz, saneamiento, título gratuito, y los
números de las dos leyes de regularización — 2.695/1979 y 1.939/1977 — porque
el texto a veces dice «regulada por el D.L. 2.695» sin usar la palabra
«regulariza»); ambas → Mixto, ninguna → Otro. Siempre devuelve algo, nunca
lanza: es un clasificador, no una búsqueda que pueda fallar.

Encabezados de columna pasan por `_encabezados(ws)`, que colapsa espacios de
más (`"Monto  Convenio "` → `"Monto Convenio"`): la planilla la edita una
persona en Excel, no un sistema, y ese tipo de variación no debería botar la
carga. `comprobar()` exige que ambas hojas tengan al menos una fila después
del filtro de región, y que todo `r`/`materia` quede dentro de rango y todo
`monto` sea `None` o `>= 0`.

`extraer.py` **se niega a escribir** si la suma de las 16 regiones del DCPR no
da el total nacional que publica el informe (`_cuadra()`), o si aparece un
estado de tramitación desconocido; lo mismo si la suma de los trámites elegidos
de `gestion` no da el total que publica Panel-Autoridades. La concordancia con
la fuente es requisito.

`gestion.cubo` es un arreglo plano de tramos de **6**
(`[mes, región, trámite, ingresados, finalizados, bajas]`), con la semántica de
Power BI del propio Panel-Autoridades (`reporte_autoridades_v2`): ingresados y
finalizados son flujo del periodo (se suman); el stock («mochila») es saldo —
ingresados menos **bajas** (no menos finalizados) acumulado desde el inicio de
la serie (`gestion.meses[0]` = 1998-12), nunca solo del año en curso. Por eso
`gestion.meses` trae la serie completa (334 meses hoy) y no solo el año
elegido: recortarla rompería el cálculo del stock. `gestion.mes_parcial` es el
último mes cargado por la fuente (no necesariamente `gestion.meses[-1]`, pero
hoy coinciden); `AGG.bienes(D, f)` calcula siempre el año de `mes_parcial`
contra el mismo tramo del año anterior. `f.tramites` son nombres (no índices)
y admite varios; `f.region` es un código de dos dígitos. El cubo real pesa
~28 KB del total de `datos.js` (~144 KB), muy por debajo de los 102 MB a los
que llegó el panel de Arriendo guardando un objeto JSON por fila.

### La dimensión SEREMI

`REGIONES` de `extraer.py` es la copia de la de `..\DASHBOARD SUBSE\extraer.py:57`
y `..\Arriendo\extraer.py:100`: orden norte a sur, código de dos dígitos, y es la
misma clave que usan las rutas de `mapa.js`. Las 16 SEREMIs calzan 1:1 con los
16 códigos. `normalizar_region()` compara **sin tildes ni signos** (`_clave()`),
porque cada fuente escribe distinto: DIPLAP usa «O´Higgins» (tilde aguda) y
«Arica»; el DCPR escribe «Arica»/«Bío-Bío» en el detalle de agosto y «Arica y
Parinacota»/«Biobío» en el de julio.

**Una diferencia con los otros dos proyectos:** aquí no existe el bucket
`"00" Sin región`. Una SEREMI siempre tiene región, así que una fila sin región
es un error de captura: `normalizar_region()` devuelve `None`, la fila se
descarta y se avisa por `stderr`. No se inventa una SEREMI.

---

## 3. Las reglas del semáforo

El documento pide **alerta temprana** pero no fija ningún umbral. El panel
declara los suyos en un solo lugar, `REGLAS` al principio de `agregar.js`, y los
explica en el glosario de la interfaz. **No son criterio a ojo y no son
definitivos: hay que acordarlos con el Gabinete y recalibrarlos con datos
reales.**

| Dimensión | Alerta | Crítico | Contra qué se compara |
|---|---|---|---|
| CDC | cumplimiento global < 90 % | < 75 % | Su meta del periodo (los mismos cortes con que DIPLAP colorea su panel) |
| Oficios | algún pendiente ≥ 30 días | ≥ 60 días | Nada: es una regla operativa, no un plazo de cumplimiento |
| Catastro | < −2 % | < −10 % | Su propio trimestre anterior, solo en UC administradas por el Ministerio y UC con acto vigente |
| Bienes | < −10 % | < −25 % | Finalizados del año a la fecha, contra el mismo tramo del año anterior (todos los trámites de `TRAMITES_BIENES`, no el filtro de la página) |
| DCPR | tramitadas sin crecer, **o** ningún título entregado teniendo títulos por entregar | las dos | Su propio informe anterior |
| Terreno | 1 quincena cerrada sin reportar | > 1 | El calendario quincenal; la quincena en curso no cuenta |

La página CDC lista los indicadores bajo 90 % aunque el global esté al día. La
superficie fiscal no entra al semáforo: bajarla puede ser la gestión misma.

Por qué el umbral de gestión es más ancho que el de catastro: con el conteo
mensual real por trámite (antes de pasar a datos reales, con el demo) el
umbral trimestral de catastro aplicado al mes dejaba a 15 de 16 SEREMIs en
alerta por puro ruido. Con datos reales la comparación ya no es mes contra
mes sino año a la fecha contra el mismo tramo del año anterior (§1, nota de
§2.4), lo que de por sí filtra buena parte del ruido; el umbral en sí sigue
siendo el mismo −10 %/−25 % heredado, sin recalibrar todavía.

**Ninguna celda del semáforo compara SEREMIs entre sí.** Cada una se mide contra
su meta o contra sí misma en el periodo anterior.

### Dos trampas que el código evita a propósito

1. **El periodo en curso no entra en las comparaciones.** El mes de corte es
   parcial y el trimestre en curso no se carga hasta que cierra. Si el parcial
   entrara en la variación contra el periodo anterior, *todas* las SEREMIs
   aparecerían cayendo. El parcial se informa en su propia columna.
2. **Los oficios sin responder no se descartan**: cuentan su espera hasta hoy.
   Promediar solo lo respondido esconde justamente a la SEREMI que no contesta.

---

## 4. Diseño

La referencia visual real es `..\DASHBOARD SUBSE\index.html`; hay una copia en
`_referencia/index_subse.html`, solo para leer (sola no funciona: carga el `ds/`,
`datos.js`, `mapa.js` y `agregar.js` de SUBSE). De ahí salen la franja azul con
filete rojo, el menú lateral de 280 px, los filtros como chips, las tarjetas
blancas sobre `--gris-5`, el aviso de datos viejos, el diálogo «Exportar PDF» y
el CSS de impresión. Los tres paneles tienen que verse como un solo sistema.

**Reglas obligatorias:** `_estandar/ESTANDAR-VISUALIZACION.md`, hay que leerlo
entero. Lo que más se olvida:

- Una sola serie = azul `#0051A8` (`--primario-darken-1`). La paleta cualitativa
  (`--chart-1…8`) se usa **desde dos series**, en orden fijo, máximo ocho.
- El color **nunca** codifica magnitud en barras y no se repinta al filtrar.
- Estados (`#2E7D32` / `#D47A10` / `#CD1E2C`) **siempre con ícono y etiqueta**.
  El color va en el **ícono**; la etiqueta, en tinta de texto: el ámbar como
  texto chico da 3,19:1 y no pasa AA. En la matriz, «Al día» va en gris para
  que el color quede para las excepciones. Bajo 760 px la etiqueta pasa a
  visualmente oculta (no `display:none`) y `.sem` la contiene (`position:
  relative`): si no, el span absoluto escapa del scroll de la tabla y estira
  la página.
- **Las variaciones son neutras** (flecha + cifra en tinta). Se colorean, con
  ícono de alerta, solo cuando cruzan el umbral de su regla (`celdaVar(v,
  REGLA_TRIM)`, catastro): un −1,7 % en rojo cuando la alerta es −2 % mentía.
  En Gestión de Bienes `celdaVar(v)` va **siempre sin color** (sin segundo
  argumento): esa página filtra por trámite a elección del usuario, y el
  juicio de alerta (con todos los trámites completos) vive solo en la matriz y las
  alertas del Resumen, nunca en la tarjeta o la tabla de la propia página.
- **Lo de ejemplo no entra en lo que se cita.** El KPI «SEREMIs en rojo» del
  Resumen cuenta solo dimensiones con `origen` real; las alertas de ejemplo van
  plegadas bajo las reales; el CSV y el PDF las rotulan «ejemplo».
- `.fila--toda` (Resumen, CDC, Oficios, DCPR): las 16 SEREMIs a la vista sin
  caja con scroll. Sus reglas van **solo sobre 1200 px**.
- El gráfico de evolución CDC tiene dominio fijo 40–140 %: enero se dispara
  por el prorrateo de DIPLAP y se marca con flecha y cifra.
- La vista viaja en la URL: `#pagina/código` (p. ej. `#cdc/08`).
- **Nunca dos ejes Y.** Grilla solo horizontal, etiquetas de datos apagadas,
  leyenda desde dos series.
- Roboto en la interfaz, **Roboto Slab** en las cifras destacadas
  (`--font-slab`). Tarjetas blancas, radio 8, sin sombra.
- Cada gráfico lleva su vista de tabla. La matriz del semáforo **es** una tabla,
  así que no necesita gemela.
- Gráficos en **SVG armado a mano**, sin librerías. Aquí hay dos funciones:
  `dibujarSerieCdc()` (evolución mensual del cumplimiento con el umbral de
  90 %) y `chispa()` (minigráficos de catastro). El mapa viene de `mapa.js`.
  Las barras (CDC, DCPR) son HTML `.barra-fila`; si llevan `data-r` son botones
  que eligen la SEREMI, como el mapa.
- Las tramitadas DCPR van apiladas en `--chart-1…3` (positivas, negativas,
  tribunales), **no** en verde/rojo: los colores de estado están reservados.
  Validado: `validate_palette.js "#6929C4,#009D9A,#4A62D1"` pasa todo.
- Gestión de Bienes reutiliza `.meta-tick` (ya usado para el umbral del CDC y
  la espera de oficios) como marca del valor del **mismo periodo del año
  anterior** sobre la barra del año actual: mismo componente, tercer uso,
  ningún CSS nuevo. El filtro de trámites es un combo de checkboxes
  (`<details>/<summary>` con la cara de `.chip`, el mismo tamaño y estilo que
  el `<select>` de SEREMI) que vive **junto al de SEREMI**, dentro de
  `#f-hoja`, pero **no es un filtro global**: `irA()` le pone `hidden` salvo
  en `pagina === 'gestion'`, porque solo esa página lo usa. Checkbox y no
  `<select multiple>`: con varios trámites elegidos, un `<select multiple>`
  nativo no deja ver de un vistazo cuáles son sin abrir la lista, y su estilo
  varía demasiado entre navegadores. Arriba de la lista va «Seleccionar
  todos» (`#ges-check-todos`), con estado intermedio (`.indeterminate`, solo
  por JS, no hay atributo HTML) cuando hay algunos pero no todos marcados; el
  checkbox de cada trámite sigue siendo la fuente de verdad, «Seleccionar
  todos» solo la refleja. El nombre del trámite en la tabla de
  detalle es un botón (`.btn-fila`) que lo deja como único elegido en el combo
  — mismo gesto de «clic para filtrar» que una SEREMI en el mapa o en una
  barra; un segundo clic sobre el ya único vuelve a marcarlos todos. El
  gráfico usa `--chart-1/2/3` (los mismos tres tokens validados que ya usan
  las tramitadas del DCPR) según la variable elegida en `#ges-var`, no el azul
  único `--primario-darken-1` de las demás barras del panel: aquí ayuda a
  distinguir de un vistazo qué variable se está mirando. La leyenda
  (`#ges-ley-color`) cambia de color junto con la barra.
- Todo el color por `var(--token)`: en el CSS del panel no hay un solo
  hexadecimal suelto.

`ds/` es copia literal de `..\DASHBOARD SUBSE\ds\` (14 archivos, ~370 KB): los 6
tokens, `dataviz-tokens.css`, las fuentes gobCL y los dos logos. **No
re-derivarlo desde `_design/`**: el `styles.css` de allá importa además los
`fig-assets.css` de los componentes React, que el panel no usa.

`tokens/fonts.css` carga Roboto y Roboto Slab desde Google Fonts. Sin internet
caen a la fuente de respaldo, igual que en SUBSE. Si el panel va a una intranet
sin salida, hay que alojar esas dos fuentes en `ds/`.

---

## 5. Comprobación

```powershell
C:\Users\jvalenzuelal\AppData\Local\Python\pythoncore-3.14-64\python.exe extraer.py
node prueba.js
```

`extraer.py` necesita internet (baja ~30 MB). Sin red: `FUENTE_CDC`,
`FUENTE_DCPR`, `FUENTE_PRESUPUESTO` y `FUENTE_GESTION` en `.env` aceptan una
ruta local (ver `.env.ejemplo`).

`prueba.js` son 32 aserciones sin framework, en dos capas: un modelo en
miniatura donde las cifras correctas se saben de memoria (y que fija las reglas
que fallan en silencio), y el `datos.js` real contra el que se comprueba que el
payload que escribe Python es el que lee JavaScript.

Para revisar la maqueta hay que servir la carpeta, porque la extensión de Chrome
no abre `file://`:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

`.impeccable/review/anchos.html` mete el panel en iframes de 1440, 1024 y 390 px
y comprueba `scrollWidth === clientWidth` en las siete páginas. Existe porque la
ventana de Chrome está maximizada y `resize_window` no la achica. Deja el
resultado en `<pre id="res">`, así que también corre sin ventana:
`chrome --headless=new --virtual-time-budget=15000 --dump-dom http://127.0.0.1:8765/.impeccable/review/anchos.html`.
Al 25-09-2026 pasan las 21 combinaciones.

---

## 6. Lo que falta (fase 3)

CDC, DCPR, presupuesto CDC y gestión de Bienes ya son reales. Lo que se
agrega, **sobre el mismo archivo**, sin cambiar la forma del payload (cada
fuente nueva cambia el `origen` de su bloque):

1. **§2.2, §2.3 y §2.5 desde `plantillas/*.csv`**, con el módulo `csv` de la
   biblioteca estándar. Sin pandas: este equipo solo tiene `psycopg2`.
2. **Referencia no usada todavía:** el Power BI de cobranza
   (`app.powerbi.com/reportEmbed?reportId=603b87f0-…`) pide inicio de sesión
   y ningún KPI acordado lo usa.
3. **Publicación**: copiar `..\DASHBOARD SUBSE\publicar_diario.ps1` y
   `publicar_oculto.vbs`, cambiando solo `$Archivos` y `$Repo`. Hay que reusar
   su función `Correr`: en PowerShell 5.1, git y python escriben avisos normales
   en stderr y con `$ErrorActionPreference = 'Stop'` eso aborta el script.
4. **Registro en el Centro de Paneles**: la entrada ya existe reservada en
   `..\PROYECT_CENTRO_PANELES\centro-paneles\src\data\paneles.js:25`
   (`id: 'desempeno-seremis'`, `estado: 'desarrollo'`, `url: null`). Basta poner
   la `url` y cambiar `estado` a `'disponible'`. No se toca ningún componente ni
   CSS.

**Camino no tomado para §2.4a:** este archivo (§6, versión anterior) tenía
previsto conectar directo a la base GXP/`cliodinamica` (`10.0.14.241:5432`,
PostgreSQL 9.1.5, solo red del Ministerio, patrón `psycopg2` de
`..\DASHBOARD SUBSE\extraer.py`) o, si «gestión» resultaba ser «casos con
actos dictados», una planilla manual de DBN. En vez de eso, el 29-09-2026 se
usó **Panel-Autoridades** (la misma base pública que ya lee SUBSE, ver §8):
más rápido de tener funcionando, pero **sin confirmar con Gabinete/DBN** que
esos trámites y esa fuente sean el «gestión de Bienes» correcto. Si más
adelante se decide que sí es GXP directo, la conexión psycopg2 sigue sin
escribir y `gestion_bienes()` en `extraer.py` habría que reemplazarla, no
extenderla: el payload que espera `agregar.js` (`[mes, región, trámite,
ingresados, finalizados, bajas]`) seguiría siendo válido si esa base también
puede entregar esas tres cifras.

Las comunas de `COMUNAS` que hay en `extraer.py` (para gobierno en terreno)
son **datos de ejemplo verosímiles**, no un catálogo oficial.

**Trampa de publicación:** la corrida diaria depende de dos páginas de GitHub
Pages ajenas. Si DIPLAP o el DCPR cambian la estructura (`const ALL`,
`const DATA`, los `descargables`), `extraer.py` sale con error y deja el
`datos.js` anterior: el aviso de datos viejos del panel lo hará visible.

---

## 7. Entorno y trampas conocidas

- **Python:** `C:\Users\jvalenzuelal\AppData\Local\Python\pythoncore-3.14-64\python.exe`.
  Tiene `psycopg2` y, desde el 01-10-2026, `openpyxl` (lo usa Gestión de
  Convenios). En una tarea programada el PATH es otro y `python` a secas es el
  alias de la Tienda de Windows: usar siempre la ruta completa.
- **Git:** `C:\Users\jvalenzuelal\AppData\Local\Programs\Git\cmd\git.exe`.
  Si se crea un clon para publicar, configurar `core.autocrlf false`.
- En PowerShell, `python -c "…"` pierde las comillas: los scripts de prueba se
  escriben en un archivo.
- La extensión de Chrome no abre `file://`; para revisar hay que servir la
  carpeta (§5). El panel sí funciona desde `file://` con doble clic.
- Chrome cachea `datos.js` con fuerza: al regenerarlo, recargar con
  `fetch('datos.js', {cache:'reload'})` o abrir la página con otro parámetro.

---

## 8. Decisiones abiertas (preguntar antes de asumir)

| Pregunta | Por qué importa |
|---|---|
| **¿Dónde se publica?** | El panel trae desempeño por SEREMI, atribuible a personas con nombre y cargo. SUBSE publica en un repositorio **público** (`Upcg-MBN/Panel-Autoridades`, GitHub Pages) y eso ahí es inocuo porque es un cubo agregado. Aquí no. Alternativas: intranet vía el Centro de Paneles, repositorio privado, carpeta compartida. **No publicar sin aprobación.** |
| **¿Son estos trámites y esa fuente lo correcto para «gestión» de Bienes?** | El 29-09-2026 se decidió en sesión (no con Gabinete/DBN) usar Panel-Autoridades y limitarlo a Concesión OLP, Servidumbres, Arriendo y Aprovechamiento de Aguas, en vez de conectar a GXP directo o pedir la planilla manual de DBN (ver §6). El 01-10-2026 se agregaron, también en sesión, Venta y Ventas por Propuesta Pública (esta última incluye Concesión por propuesta pública). Confirmar con Gabinete/DBN si esta lista (`TRAMITES_BIENES`) es «los más gestionados» que pedía el documento, o si hay que ajustarla. |
| ¿Qué define «rezagada»? | Los umbrales de §3 son una propuesta. El documento no los fija y cambian qué SEREMI aparece en rojo. La regla DCPR («sin avance») es nueva: con el informe de agosto enciende 4 SEREMIs por títulos detenidos (Tarapacá, Antofagasta, Atacama y Metropolitana, esta con 164 por entregar). |
| ¿Quién opera cada planilla y con qué frecuencia la entrega? | Define si el panel se actualiza solo o depende de una carga manual, y qué significa una quincena sin filas. |
| El panel público del DCPR expone nombre y RUT | `mbn-dcpr-reportes` publica en GitHub Pages el detalle por expediente con datos personales de los solicitantes. Aquí solo se cuentan; conviene avisar al DCPR. `otros_informacion/` está en `.gitignore` por lo mismo. |
| ¿Se pasan las plantillas a `.xlsx` con listas desplegables? | Reduciría los errores de captura en origen, que es donde importan. `openpyxl` ya está instalado (Gestión de Convenios lo usa desde el 01-10-2026); falta decidir si oficios/catastro/terreno siguen el mismo camino. |
| ¿La homologación de Materia de «En trámite» es la correcta? | `_homologar_materia()` (01-10-2026) clasifica por palabra clave contra texto libre (`MATERIA (referencial)`) porque esa hoja no trae un campo cerrado como «Convenios FT». Es una regla razonable, no una del documento ni acordada con quien llena la planilla: confirmar con UPCG, y si la hoja llega a tener más filas con texto que no calce bien, puede necesitar más palabras clave (ver `_MATERIA_PROPIEDAD_KW`/`_MATERIA_REGULARIZACION_KW` en `extraer.py`). |
| ¿«Monto Convenio» del KPI debe sumar solo vigentes? | Se interpretó que el segundo KPI de Gestión de Convenios acompaña al primero (Convenios vigentes): ambos solo de «Convenios FT» con Estado = Vigente. El pedido original no lo precisó; si se quería el monto de todos los convenios (vigentes y no), o el de «En trámite» también, hay que ajustar `AGG.convenios()`. |

## Otros proyectos en `PROY` (contexto)

| Carpeta | Relación |
|---|---|
| `DASHBOARD SUBSE` | **El modelo.** De aquí salen `ds/`, `mapa.js`, el esqueleto de `index.html`, el patrón de `extraer.py` y los scripts de publicación. |
| `Arriendo` | Panel de tiempos de tramitación. Su `CLAUDE.md` es la referencia más completa del entorno y de la metodología de expedientes. |
| `Panel-Autoridades` | Clon git desde el que se publica SUBSE. |
| `PROYECT_CENTRO_PANELES` | Portal React que agrupa los paneles. Tiene reservada la entrada `desempeno-seremis`. |
