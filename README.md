# Panel de Seguimiento de SEREMIs

Panel para el Gabinete del Subsecretario de Bienes Nacionales: consolida en una
sola pantalla el seguimiento de las 16 SEREMIs, que hoy vive repartido en
planillas separadas. Cubre las cinco dimensiones del documento
`Sistema_Seguimiento_SEREMIs.docx`: cumplimiento CDC, tiempos de respuesta a
oficios, gestión de catastro, gestión de Bienes y DCPR, y gobierno en terreno.

**Datos mixtos.** El **CDC** y la **gestión DCPR** son cifras reales, leídas de
los paneles que publican DIPLAP y el DCPR, así que coinciden con lo que ve el
resto del Ministerio. Oficios, catastro, gestión de Bienes y gobierno en terreno
siguen con **datos de ejemplo** hasta que exista su fuente; el panel lo marca en
pantalla, en la matriz y en el PDF.

| Dimensión | Fuente | Estado |
|---|---|---|
| Cumplimiento CDC | [Panel de Gestión Institucional 2026](https://upcg-mbn.github.io/panel_gestion_2026/) (DIPLAP) | Real |
| Gestión DCPR | [Panel de Gestión Mensual DCPR](https://bienesnacionales.github.io/mbn-dcpr-reportes/) | Real |
| Presupuesto CDC | [Panel Presupuestario MBN](https://presupuestombn.github.io/panel-presupuestario-mbn/) (Depto. de Presupuesto) | Real |
| Catastro | `plantillas/catastro.csv` (informe trimestral) | Ejemplo |
| Gestión de Bienes | por definir (ver Pendientes) | Ejemplo |
| Oficios | `plantillas/oficios.csv` | Ejemplo |
| Gobierno en terreno | `plantillas/gobierno_en_terreno.csv` | Ejemplo |

```powershell
# leer las fuentes y escribir datos.js (necesita internet, ~5 s)
C:\Users\jvalenzuelal\AppData\Local\Python\pythoncore-3.14-64\python.exe extraer.py

# comprobar la lógica (24 aserciones)
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
| `extraer.py` | Construye `datos.js`: lee los paneles de DIPLAP, del DCPR y del Panel Presupuestario, y genera la parte de ejemplo. `FUENTE_CDC`, `FUENTE_DCPR` y `FUENTE_PRESUPUESTO` (en `.env`) aceptan una ruta local. |
| `mapa.js` | **Generado en `DASHBOARD SUBSE`.** Chile en tres paneles, como rutas SVG ya proyectadas. Copia literal. |
| `ds/` | Sistema de diseño MinBienes: tokens, fuentes gobCL y logos. Copia literal de `..\DASHBOARD SUBSE\ds\`. |
| `plantillas/` | Los formatos de captura propuestos para las tres fuentes que no existen, con `LEEME.md`. |
| `CLAUDE.md` | Contexto largo: modelo de datos, reglas del semáforo, entorno, pendientes. |
| `_design/ _estandar/ _referencia/` | Material de consulta. No se publican (están en `.gitignore`). |

## Las páginas

| Página | Qué responde |
|---|---|
| **Resumen ejecutivo** | Cumplimiento CDC, títulos entregados, solicitudes tramitadas y SEREMIs en rojo; la matriz de 16 SEREMIs × 6 dimensiones y la lista de alertas ordenada por gravedad. |
| **Cumplimiento CDC** | Barras del cumplimiento global de cada SEREMI con el umbral de 90 %. Al hacer clic en una, abajo aparecen sus indicadores bajo 90 %, con meta, avance y análisis de causa. Más la evolución mensual. |
| **Respuesta a oficios** | La mediana de días que demora cada SEREMI y la lista de lo que sigue sin responder, del más antiguo al más reciente. |
| **Gestión de catastro** | Cantidad de UC, superficie fiscal (ha), % de la superficie fiscal nacional, UC administradas por el Ministerio (sin acto de administración), UC con acto de administración vigente (entregadas a terceros), estas dos con su variación contra el trimestre anterior, y UC parcialmente administradas. Las tres de tenencia suman el total de UC, como en el informe de Catastro en Power BI. |
| **Gestión de Bienes** | Los cuatro trámites que más gestiona cada SEREMI y cómo se mueven mes a mes. Pendiente de definir qué se mide. |
| **Gestión DCPR** | Títulos entregados y solicitudes tramitadas (positivas con ingreso al CBR, negativas y enviadas a tribunales): acumulado del año y variación desde el informe anterior, por SEREMI. |
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
  del informe; si no calzan, sale con error y deja el `datos.js` anterior.
- **Tramos apilados en los colores de serie 1 a 3**, no en verde y rojo: una
  solicitud negativa no es un «estado crítico», y los colores de estado están
  reservados. Validados con el validador de la skill `dataviz`.

## Pendientes

| Pendiente | Nota |
|---|---|
| **Dónde se publica** | El panel trae desempeño por SEREMI, atribuible a personas. No publicarlo en un repositorio público sin aprobación. |
| **Qué es «gestión de Bienes»** | ¿Casos con actos dictados (planilla manual que arma DBN con lo que reportan las regiones) o casos finalizados en el sistema (base GXP)? De eso depende la fuente. |
| Catastro real | Pedir a DICAT el informe trimestral en el formato de `plantillas/catastro.csv`. |
| Oficios y terreno | Las dos planillas por crear. Ver `CLAUDE.md` §6. |
| Umbrales del semáforo | Acordarlos con el Gabinete y recalibrarlos con datos reales. |
| Catálogos de ejemplo | La lista de trámites de Bienes es inventada. |
| Plantillas en `.xlsx` | Con encabezados bloqueados y listas desplegables se capturarían menos errores. Requiere `openpyxl`. |
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
