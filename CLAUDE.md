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

**Estado al 25-09-2026:** **CDC y gestión DCPR con datos reales**, leídos de los
paneles publicados de DIPLAP y del DCPR. Oficios, catastro, gestión de Bienes y
gobierno en terreno siguen con **datos de ejemplo** (cada bloque de `datos.js`
lleva su `origen` y el panel marca lo inventado). Falta la fuente de esas
cuatro (§6), definir qué es «gestión de Bienes» y decidir dónde se publica (§8).

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
| 2.4 a | Gestión de Bienes | mensual | ¿Planilla DBN o base GXP? | **Por definir** (§8). Datos de ejemplo. |
| 2.4 b | Gestión DCPR | mensual | Informe de Gestión DCPR | **Real.** `extraer.py` baja `https://bienesnacionales.github.io/mbn-dcpr-reportes/` (25 MB): un `const MES_AAAA = {...}` por informe y el detalle por expediente en `<script id="data-…" data-gz="1">` (gzip + base64). Títulos por región vienen agregados; las tramitadas por región solo salen del detalle (`data-tramitadas*`), que trae **nombre y RUT**: se cuenta y se descarta. |
| 2.5 | Gobierno en terreno | quincenal | Planilla de cada SEREMI | **Por crear.** `plantillas/gobierno_en_terreno.csv`. |
| — | Presupuesto CDC | sin serie, corte único | [Panel Presupuestario MBN](https://presupuestombn.github.io/panel-presupuestario-mbn/) (Depto. de Presupuesto) | **Real, fuera de las cinco dimensiones del documento.** Página aparte, sin semáforo ni umbral que acordar con Gabinete: presupuesto vigente, devengado y meta del CDC por SEREMI, al «resultado final» del mes. El panel publica solo el corte vigente, no una serie mensual, así que no hay variación contra el periodo anterior. |

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
- §2.4: «los 4 más gestionados por cada una y ver cómo avanzan **respecto a
  ellos mismos** el mes anterior».
- §2.5: **formato libre** en esta etapa. Mínimos: comunas visitadas, actores y
  una minuta breve.

---

## 2. Arquitectura

```
SEREMIS/
  CLAUDE.md            este archivo
  README.md            para personas (cómo correr, decisiones, pendientes)
  extraer.py           construye datos.js: CDC y DCPR reales + el resto de ejemplo
  datos.js             GENERADO. No editar.
  index.html           el panel (HTML + CSS + IIFE); lee datos.js, mapa.js y agregar.js
  agregar.js           agregaciones puras, sin DOM. Aquí viven las REGLAS del semáforo
  prueba.js            node prueba.js
  mapa.js              copia de ..\DASHBOARD SUBSE\mapa.js (SVG regional preproyectado)
  ds/                  sistema de diseño: tokens, fuentes gobCL y logos
  plantillas/          formatos de captura propuestos + LEEME.md
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
`demo`): el panel muestra el aviso de datos de ejemplo en las páginas `demo`,
marca «ejemplo» en su columna de la matriz y en sus alertas, y lo escribe en la
cabecera del PDF.

Un bloque por dimensión: `cdc`, `oficios`, `catastro`, `gestion` (Bienes),
`dcpr`, `terreno`, más `regiones`, `corte` y `hoy` (estos dos, de la parte de
ejemplo). `cdc.sumas[r][mes] = [Σ contrib. cumplimiento, Σ contrib. meta]`;
`cdc.filas` es el detalle por indicador **solo del último mes**.
`dcpr.titulos` y `dcpr.tramitadas` son tablas `[región][mes]`.

Aparte, `presupuesto`: no es una de las cinco dimensiones ni tiene `r` en el
semáforo. `presupuesto.filas[r] = { r, presupuesto, devengado, pct, meta }`,
un corte único (`presupuesto.corte`, `'AAAA-MM'`) sin serie mensual, así que
`agregar.js` no calcula variación para este bloque.

`extraer.py` **se niega a escribir** si la suma de las 16 regiones del DCPR no
da el total nacional que publica el informe (`_cuadra()`), o si aparece un
estado de tramitación desconocido. La concordancia con la fuente es requisito. `gestion.cubo` es un arreglo plano de tramos de 4
(`[mes, región, trámite, n]`) con índices a los catálogos, igual que el cubo de
SUBSE: un objeto JSON por fila es lo que llevó el panel de Arriendo a 102 MB.
Con datos reales el archivo debería quedar **bajo 500 KB** (la demo pesa 89 KB),
porque no hay dato por expediente, solo agregados por región.

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
| Bienes | < −10 % | < −25 % | Su propio mes anterior |
| DCPR | tramitadas sin crecer, **o** ningún título entregado teniendo títulos por entregar | las dos | Su propio informe anterior |
| Terreno | 1 quincena cerrada sin reportar | > 1 | El calendario quincenal; la quincena en curso no cuenta |

La página CDC lista los indicadores bajo 90 % aunque el global esté al día. La
superficie fiscal no entra al semáforo: bajarla puede ser la gestión misma.

Por qué el umbral de gestión es más ancho que el de catastro: los conteos
mensuales de trámites oscilan varios puntos sin que pase nada. Con el umbral
trimestral aplicado al mensual, 15 de 16 SEREMIs salían en alerta por ruido.

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
  REGLA_TRIM | REGLA_MES)`): un −1,7 % en rojo cuando la alerta es −2 % mentía.
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

`extraer.py` necesita internet (baja ~30 MB). Sin red: `FUENTE_CDC` y
`FUENTE_DCPR` en `.env` aceptan una ruta local (ver `.env.ejemplo`).

`prueba.js` son 26 aserciones sin framework, en dos capas: un modelo en
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

CDC y DCPR ya son reales. Lo que se agrega, **sobre el mismo archivo**, sin
cambiar la forma del payload (cada fuente nueva cambia el `origen` de su bloque):

1. **§2.4a gestión de Bienes**, una vez definida (§8). Si es «casos finalizados
   en el sistema», desde la base GXP / `cliodinamica`, mismo patrón que
   `..\DASHBOARD SUBSE\extraer.py`: `psycopg2`, `con.set_session(readonly=True)`,
   `SET statement_timeout`, agregación por mes × región × trámite, `comprobar()`
   antes de `escribir()`. Base `10.0.14.241:5432`, **PostgreSQL 9.1.5** (sin
   `FILTER (WHERE …)`), solo accesible desde la red del Ministerio. Si es
   «casos con actos dictados», es una planilla manual de DBN: pedir el formato.
2. **§2.2, §2.3 y §2.5 desde `plantillas/*.csv`**, con el módulo `csv` de la
   biblioteca estándar. Sin pandas: este equipo solo tiene `psycopg2`.
3. **Referencia no usada todavía:** el Power BI de cobranza
   (`app.powerbi.com/reportEmbed?reportId=603b87f0-…`) pide inicio de sesión
   y ningún KPI acordado lo usa. Probable insumo de gestión de Bienes.
4. **Publicación**: copiar `..\DASHBOARD SUBSE\publicar_diario.ps1` y
   `publicar_oculto.vbs`, cambiando solo `$Archivos` y `$Repo`. Hay que reusar
   su función `Correr`: en PowerShell 5.1, git y python escriben avisos normales
   en stderr y con `$ErrorActionPreference = 'Stop'` eso aborta el script.
5. **Registro en el Centro de Paneles**: la entrada ya existe reservada en
   `..\PROYECT_CENTRO_PANELES\centro-paneles\src\data\paneles.js:25`
   (`id: 'desempeno-seremis'`, `estado: 'desarrollo'`, `url: null`). Basta poner
   la `url` y cambiar `estado` a `'disponible'`. No se toca ningún componente ni
   CSS.

Los `TRAMITES` y las comunas de `COMUNAS` que hay en `extraer.py` son **datos de
ejemplo verosímiles**, no catálogos oficiales.

**Trampa de publicación:** la corrida diaria depende de dos páginas de GitHub
Pages ajenas. Si DIPLAP o el DCPR cambian la estructura (`const ALL`,
`const DATA`, los `descargables`), `extraer.py` sale con error y deja el
`datos.js` anterior: el aviso de datos viejos del panel lo hará visible.

---

## 7. Entorno y trampas conocidas

- **Python:** `C:\Users\jvalenzuelal\AppData\Local\Python\pythoncore-3.14-64\python.exe`.
  Solo tiene `psycopg2`. En una tarea programada el PATH es otro y `python` a
  secas es el alias de la Tienda de Windows: usar siempre la ruta completa.
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
| **¿Qué es «gestión» de Bienes?** | ¿Casos con actos dictados (planilla manual de DBN con lo que reportan las regiones) o casos finalizados en el sistema (base GXP)? Define la fuente entera de §2.4a. |
| ¿Qué define «rezagada»? | Los umbrales de §3 son una propuesta. El documento no los fija y cambian qué SEREMI aparece en rojo. La regla DCPR («sin avance») es nueva: con el informe de agosto enciende 4 SEREMIs por títulos detenidos (Tarapacá, Antofagasta, Atacama y Metropolitana, esta con 164 por entregar). |
| ¿Quién opera cada planilla y con qué frecuencia la entrega? | Define si el panel se actualiza solo o depende de una carga manual, y qué significa una quincena sin filas. |
| El panel público del DCPR expone nombre y RUT | `mbn-dcpr-reportes` publica en GitHub Pages el detalle por expediente con datos personales de los solicitantes. Aquí solo se cuentan; conviene avisar al DCPR. `otros_informacion/` está en `.gitignore` por lo mismo. |
| ¿Se pasan las plantillas a `.xlsx` con listas desplegables? | Reduciría los errores de captura en origen, que es donde importan. Requiere `pip install openpyxl`. |

## Otros proyectos en `PROY` (contexto)

| Carpeta | Relación |
|---|---|
| `DASHBOARD SUBSE` | **El modelo.** De aquí salen `ds/`, `mapa.js`, el esqueleto de `index.html`, el patrón de `extraer.py` y los scripts de publicación. |
| `Arriendo` | Panel de tiempos de tramitación. Su `CLAUDE.md` es la referencia más completa del entorno y de la metodología de expedientes. |
| `Panel-Autoridades` | Clon git desde el que se publica SUBSE. |
| `PROYECT_CENTRO_PANELES` | Portal React que agrupa los paneles. Tiene reservada la entrada `desempeno-seremis`. |
