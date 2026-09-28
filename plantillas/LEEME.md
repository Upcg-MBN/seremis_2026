# Plantillas de captura

Las tres fuentes que el sistema necesita y que hoy no existen. (El CDC y la
gestión DCPR ya no necesitan planilla: se leen de los paneles que publican
DIPLAP y el DCPR.) Cada archivo es
un CSV con encabezado: se abre y se edita en Excel como cualquier planilla, pero
`extraer.py` lo lee con el módulo `csv` de la biblioteca estándar, sin
dependencias ni macros.

El criterio del documento manda sobre todo lo demás: **«es preferible registrar
menos con certeza que registrar todo con brechas»**. De ahí salen las cuatro
reglas comunes:

1. **Ninguna columna calculada.** Los días de respuesta, los promedios y las
   variaciones los calcula el panel. Si la SEREMI los escribe a mano, dos
   planillas dejan de cuadrar y nadie sabe cuál manda.
2. **Una fila = un hecho.** Un oficio, una comuna visitada, un trimestre. Nada
   de celdas combinadas, filas de subtotal ni columnas que se agregan sobre la
   marcha.
3. **Vocabulario cerrado donde importa.** Las columnas marcadas abajo solo
   aceptan los valores de la lista. Lo que no calza se descarta y se avisa por
   pantalla; el panel nunca inventa una SEREMI ni un estado.
4. **La celda vacía significa «todavía no», no cero.** Un oficio sin
   `fecha_respuesta` está pendiente. Un cero es un cero medido.

Guardar como **CSV UTF-8** (en Excel: *Guardar como → CSV UTF-8 (delimitado por
comas)*). Las fechas van en `AAAA-MM-DD`; las comas dentro de un texto obligan a
poner el campo entre comillas dobles, cosa que Excel hace solo.

La columna `seremi` se escribe con el nombre exacto de la región tal como
aparece en la lista `REGIONES` de `extraer.py` (orden norte a sur): Arica y
Parinacota, Tarapacá, Antofagasta, Atacama, Coquimbo, Valparaíso, Metropolitana,
O'Higgins, Maule, Ñuble, Biobío, La Araucanía, Los Ríos, Los Lagos, Aysén,
Magallanes. `normalizar_region()` tolera los prefijos «SEREMI de» y «Región de»,
y también el código de dos dígitos.

---

## `oficios.csv` — §2.2 Tiempos de respuesta a requerimientos formales

Lo lleva el **Gabinete**, de forma continua: una fila por oficio despachado.

| Columna | Tipo | Obligatoria | Notas |
|---|---|---|---|
| `folio` | texto | sí | Como aparece en el oficio: `ORD 1234`. Identifica la fila. |
| `seremi` | lista cerrada | sí | Nombre de la región. |
| `fecha_envio` | `AAAA-MM-DD` | sí | Fecha de despacho desde el Gabinete. |
| `materia` | texto | sí | Una línea. Sirve para reconocer el oficio, no para clasificarlo. |
| `fecha_respuesta` | `AAAA-MM-DD` | no | **Vacía mientras no haya respuesta.** El panel cuenta los días de espera hasta hoy. |

El documento dice expresamente que **no hay plazo estándar de respuesta**, porque
los requerimientos son heterogéneos. Por eso la planilla no tiene columna de
plazo ni de cumplimiento: el panel muestra la distribución de demoras de cada
SEREMI y marca los oficios que llevan mucho tiempo sin contestar, con el umbral
declarado en el glosario (`REGLAS.oficioViejo` de `agregar.js`, hoy 30 días).

## `catastro.csv` — §2.3 Gestión de catastro

La llena **cada SEREMI**, trimestralmente. Una fila por SEREMI y trimestre.

| Columna | Tipo | Obligatoria | Notas |
|---|---|---|---|
| `seremi` | lista cerrada | sí | |
| `trimestre` | `AAAA-Tn` | sí | `2026-T2`. El trimestre en curso no se carga hasta que cierra. |
| `unidades_catastrales` | entero | sí | Cantidad de UC de inmuebles fiscales de la región. |
| `superficie_fiscal_ha` | decimal | sí | Hectáreas, con punto decimal y sin separador de miles. |
| `uc_administradas_ministerio` | entero | sí | «Administrado por el Ministerio»: UC **sin** acto de administración. |
| `uc_acto_administracion_vigente` | entero | sí | «Entregado a tercero»: UC con acto de administración vigente. |
| `uc_parcialmente_administradas` | entero | sí | «Parcialmente administrada»: tenencia mixta, una parte con acto y otra sin él. |

Las tres categorías de tenencia son las del informe de Catastro en Power BI
(pregunta P-005) y **tienen que sumar `unidades_catastrales`**, sin duplicar. Si
una fila no cuadra, `extraer.py` no escribe nada: vale más un panel del
trimestre anterior que uno con una región mal sumada.

El **porcentaje de la superficie fiscal regional respecto del nacional no se
captura**: lo calcula el panel dividiendo cada región por la suma de las 16. Si
lo escribiera cada SEREMI, las 16 cifras no sumarían 100.

Las UC administradas por el Ministerio y las UC con acto de administración
vigente se comparan **con el
propio trimestre anterior de cada SEREMI**: el documento pide explícitamente no
comparar SEREMIs entre sí. La cantidad de UC y la superficie se informan sin
semáforo, porque bajar superficie fiscal puede ser justamente la gestión
(ventas, transferencias). El panel no publica ranking de catastro.

## `gobierno_en_terreno.csv` — §2.5 Gobierno en terreno

La llena **cada SEREMI**, cada quincena. Una fila por comuna visitada.

| Columna | Tipo | Obligatoria | Notas |
|---|---|---|---|
| `seremi` | lista cerrada | sí | |
| `quincena` | `AAAA-MM-Q1` \| `AAAA-MM-Q2` | sí | Q1 es del 1 al 15; Q2, del 16 al fin de mes. |
| `comuna` | texto | sí | Nombre de la comuna visitada. |
| `actores` | lista cerrada, separada por `;` | sí | Delegado Presidencial, Alcalde, Dirigente social, Servicio público, Gremio, Comunidad indígena, Otro. |
| `temas` | texto | sí | La minuta breve: los temas relevantes levantados. Una o dos líneas. |

El documento deja el **formato libre en esta etapa inicial** y fija solo los
mínimos: comunas visitadas, actores con quienes se reunieron y una minuta breve.
Esta plantilla es exactamente esos mínimos; `temas` es texto libre a propósito.
Una quincena sin fila es una quincena sin reporte, y el panel la marca.

---

## Pendiente

Estos CSV son el formato mínimo que funciona hoy. Convertirlos a **`.xlsx` con
encabezados bloqueados y listas desplegables** en `seremi`, `actores` y
`trimestre` reduciría los errores de captura en origen, que es donde importan.
Requiere `pip install openpyxl` en el Python del equipo (hoy solo tiene
`psycopg2`).
