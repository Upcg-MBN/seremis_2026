#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Arma datos.js para el panel de seguimiento de SEREMIs.

    python extraer.py

Fuentes:

    §2.1 CDC                  Panel de Gestión Institucional de DIPLAP (real)
    §2.4b Gestión DCPR        Panel de Gestión Mensual del DCPR (real)
    Presupuesto CDC           Panel Presupuestario MBN (real, sin serie mensual)
    §2.4a Gestión Bienes      Panel-Autoridades, ver TRAMITES_BIENES (real)
    Gestión de Convenios      plantillas/Base_Convenios.xlsx (real, archivo local)
    §2.2 Oficios              plantillas/oficios.csv              (ejemplo)
    §2.3 Catastro             plantillas/catastro.csv             (ejemplo)
    §2.5 Gobierno en terreno  plantillas/gobierno_en_terreno.csv  (ejemplo)

Las fuentes reales se leen de los paneles publicados, así las cifras son las
mismas que ve todo el Ministerio. FUENTE_CDC, FUENTE_DCPR, FUENTE_PRESUPUESTO,
FUENTE_GESTION y FUENTE_CONVENIOS (en el entorno o en .env) aceptan otra URL o
ruta local, para correr sin internet.

Gestión de Convenios es un caso aparte: el documento fuente vive en SharePoint
(enlace que exige inicio de sesión institucional, no un sitio público como las
demás), así que no se descarga por URL. Se lee la copia local sincronizada por
OneDrive, en plantillas/Base_Convenios.xlsx; quien la mantiene actualiza ese
archivo a mano y extraer.py recoge lo último que haya ahí.

Cada bloque de datos.js lleva su `origen`: el panel marca en pantalla los que
todavía son de ejemplo.
"""

import base64
import gzip
import json
import os
import random
import re
import sys
import unicodedata
import urllib.request
from datetime import date, datetime, timedelta

import openpyxl

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "datos.js")

URL_CDC = "https://upcg-mbn.github.io/panel_gestion_2026/"
URL_DCPR = "https://bienesnacionales.github.io/mbn-dcpr-reportes/"
URL_PRESUPUESTO = "https://presupuestombn.github.io/panel-presupuestario-mbn/"
URL_GESTION = "https://raw.githubusercontent.com/Upcg-MBN/Panel-Autoridades/main/datos.js"
RUTA_CONVENIOS = os.path.join(AQUI, "plantillas", "Base_Convenios.xlsx")

SEMILLA = 20260924      # la parte de ejemplo es determinista
CORTE = "2026-09"       # último mes de los datos de ejemplo; se dibuja como parcial
HOY = date(2026, 9, 24)

MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
            "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def cargar_env():
    """Vuelca .env al entorno. Lo que ya viene en el entorno manda: así se
    puede apuntar a otra fuente sin editar el archivo."""
    ruta = os.path.join(AQUI, ".env")
    if not os.path.exists(ruta):
        return
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            os.environ.setdefault(clave.strip(), valor.strip())


# Orden norte a sur, igual que DASHBOARD SUBSE/extraer.py y que mapa.js. Son
# las 16 SEREMIs. Aquí no va "00 Sin región": una SEREMI siempre tiene región,
# y una fila sin región es un error de captura que hay que avisar, no graficar.
REGIONES = [
    ("15", "Arica y Parinacota"), ("01", "Tarapacá"), ("02", "Antofagasta"),
    ("03", "Atacama"), ("04", "Coquimbo"), ("05", "Valparaíso"),
    ("13", "Metropolitana"), ("06", "O'Higgins"), ("07", "Maule"),
    ("16", "Ñuble"), ("08", "Biobío"), ("09", "La Araucanía"),
    ("14", "Los Ríos"), ("10", "Los Lagos"), ("11", "Aysén"),
    ("12", "Magallanes"),
]


def _clave(valor):
    """Cada fuente escribe las regiones a su manera: «O´Higgins» con tilde
    aguda en DIPLAP, «Bío-Bío» y «Arica» en un mes del DCPR y «Biobío» y
    «Arica y Parinacota» en el siguiente. Se comparan sin tildes ni signos."""
    v = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode()
    v = re.sub(r"^(seremi|region)( de| del)? ", "", v.lower().strip())
    return re.sub(r"[^a-z]", "", v)


_CODIGOS = {c for c, _ in REGIONES}
_INDICE = {c: i for i, (c, _) in enumerate(REGIONES)}
_POR_NOMBRE = {_clave(n): c for c, n in REGIONES}
_POR_NOMBRE.update({
    "arica": "15", "araucania": "09",
    # El Panel Presupuestario usa el nombre formal completo de la región.
    "libertadorgeneralbernardoohiggins": "06",
    # El sub-panel «Flujos» del DCPR antepone «Del»/«De» a tres regiones.
    "delmaule": "07", "denuble": "16", "delbiobio": "08",
})
_SIN_MAPEO = set()


def normalizar_region(valor):
    """Las fuentes traen nombres; el panel indexa por código de dos dígitos.
    Lo que no calza se avisa y se descarta, en vez de inventar una SEREMI."""
    if valor is None or not str(valor).strip():
        return _fallo(valor)
    v = str(valor).strip()
    if v.isdigit():
        v = v.zfill(2)
        return v if v in _CODIGOS else _fallo(valor)
    return _POR_NOMBRE.get(_clave(v)) or _fallo(valor)


def indice_region(valor):
    c = normalizar_region(valor)
    return None if c is None else _INDICE[c]


def _fallo(valor):
    _SIN_MAPEO.add(str(valor))
    return None


def leer(fuente):
    if fuente.startswith(("http://", "https://")):
        with urllib.request.urlopen(fuente, timeout=300) as r:
            return r.read().decode("utf-8")
    with open(fuente, encoding="utf-8") as f:
        return f.read()


# ------------------------------------------------------------------ calendario
def meses(desde, hasta):
    """['2026-01', …, '2026-09'], ambos extremos incluidos."""
    a, m = int(desde[:4]), int(desde[5:7])
    fin = (int(hasta[:4]), int(hasta[5:7]))
    out = []
    while (a, m) <= fin:
        out.append("%04d-%02d" % (a, m))
        m += 1
        if m == 13:
            a, m = a + 1, 1
    return out


def trimestre(mes):
    return "%s-T%d" % (mes[:4], (int(mes[5:7]) - 1) // 3 + 1)


# ------------------------------------------------------------------ §2.1 CDC
# El panel de DIPLAP trae todos los instrumentos de gestión en un arreglo
# `const ALL = [...]`, una fila por equipo × indicador × mes. Aquí entra solo
# el CDC de las SEREMIs, y el cumplimiento global se calcula con la misma
# fórmula que DIPLAP: Σ «Contrib Cumpl Pond» ÷ Σ «Contrib Meta Pond».
def cdc_diplap(fuente):
    texto = leer(fuente)
    m = re.search(r"const ALL = (\[.*\]);", texto)
    if not m:
        raise ValueError("el panel de DIPLAP ya no trae `const ALL = [...]`")
    # Python escribe NaN donde falta un dato; aquí vale lo mismo que vacío.
    filas = [f for f in json.loads(m.group(1), parse_constant=lambda _: None)
             if f["Instrumento de gestión"] == "Convenio de Desempeño Colectivo"
             and f["Ubicación"] == "Seremi"]
    ms = sorted({f["Periodo"][:7] for f in filas})
    nombre = lambda f: " ".join(f["Nombre Indicador"].split())
    indicadores = sorted({nombre(f) for f in filas})
    sumas = [[[0.0, 0.0] for _ in ms] for _ in REGIONES]
    detalle = []
    for f in filas:
        r = indice_region(f["Equipo"])
        if r is None:
            continue
        k = ms.index(f["Periodo"][:7])
        sumas[r][k][0] += f["Contrib Cumpl Pond"] or 0
        sumas[r][k][1] += f["Contrib Meta Pond"] or 0
        if k == len(ms) - 1:
            detalle.append({
                "r": r, "i": indicadores.index(nombre(f)),
                "pond": f["Ponderacion"], "meta": _r4(f["Meta periodo"]),
                "metaAnual": _r4(f["Meta anual"]),
                "avance": _r4(f["Avance efectivo"]), "cumpl": _r4(f["Cumplimiento"]),
                "num": f["Numerador"], "den": f["Denominador"],
                "causa": (f["Analisis_Causa"] or "").strip(),
            })
    detalle.sort(key=lambda d: (d["r"], d["i"]))
    return {
        "origen": "diplap", "fuente": fuente, "meses": ms,
        "indicadores": indicadores,
        "sumas": [[[round(a, 6), round(b, 6)] for a, b in s] for s in sumas],
        "filas": detalle,
    }


def _r4(v):
    return None if v is None else round(v, 4)


# ---------------------------------------------------------- §2.4b gestión DCPR
# El Panel de Gestión Mensual del DCPR guarda un objeto por mes
# (`const AGOSTO_2026 = {...}`) y el detalle por expediente comprimido en
# etiquetas <script id="data-…" data-gz="1">. Los títulos entregados vienen ya
# por región; las solicitudes tramitadas solo vienen por región en el detalle,
# que trae nombre y RUT del solicitante: aquí se cuenta y se descarta, a
# datos.js no llega ni una fila por persona.
ESTADOS_TRAMITE = {"Tramitado Positivo": "positivo", "Tramitado Negativo": "negativo",
                   "Enviado a Tribunales": "tribunales", "En Proceso": "enProceso"}


def dcpr(texto, fuente):
    m = re.search(r"const DATA = \{([^}]*)\}", texto)
    if not m:
        raise ValueError("el panel DCPR ya no trae `const DATA = {...}`")
    pares = sorted(("%s-%02d" % (anio, MESES_ES.index(mes.lower()) + 1), var)
                   for mes, anio, var in re.findall(r'"(\w+) (\d{4})":\s*(\w+)', m.group(1)))
    ms = [p[0] for p in pares]
    vacio = lambda: [[None] * len(ms) for _ in REGIONES]
    tit = {"entregados": vacio(), "porEntregar": vacio()}
    tra = {k: vacio() for k in ESTADOS_TRAMITE.values()}
    ingresos = None  # se queda con el último mes que lo traiga: ver más abajo

    for k, (mes, var) in enumerate(pares):
        obj = json.loads(re.search(r"^const %s = (\{.*\});\s*$" % var, texto, re.M).group(1))

        # Panel «A · Nuevos ingresos» del DCPR (distinto del gráfico del mismo
        # nombre dentro de «D · Flujos», que es otro dataset y va más atrás en
        # el tiempo). Es del mes en curso, no acumulado en el año: cada mes
        # reemplaza al anterior, así que al final del bucle queda el último
        # mes que lo trajo, sin importar si los meses previos también lo traían.
        ing = obj.get("ingresos")
        if ing and ing.get("porRegion"):
            filas_ing = [None] * len(REGIONES)
            for fila in ing["porRegion"]:
                r = indice_region(fila[0])
                if r is not None:
                    filas_ing[r] = fila[1]
            if all(v is not None for v in filas_ing):
                total_ing = sum(filas_ing)
                publicado_ing = ing.get("totalJunio")  # nombre de campo heredado del sitio: es el total del mes del corte, no de junio
                if publicado_ing is not None and total_ing != publicado_ing:
                    raise ValueError("DCPR %s: ingresos por región suman %s y el panel publica %s"
                                     % (mes, total_ing, publicado_ing))
                ingresos = {"mes": mes, "total": total_ing, "porRegion": filas_ing}

        it = obj.get("informacionTitulos")
        if it:
            for c in tit.values():
                for fila in c:
                    fila[k] = 0
            for nom, ent, por in it["porRegion"]:
                r = indice_region(nom)
                if r is not None:
                    tit["entregados"][r][k] += ent
                    tit["porEntregar"][r][k] += por
            _cuadra(mes, "títulos entregados", tit["entregados"], k, it["totalEntregados"])
            _cuadra(mes, "títulos por entregar", tit["porEntregar"], k, it["totalPorEntregar"])

        bloque = re.search(r"^%s\.descargables = \{(.*?)^\};" % var, texto, re.M | re.S)
        t = bloque and re.search(r"tramitadas: \{ headers:(\[.*?\]),.*?dataId:'([^']+)'",
                                 bloque.group(1), re.S)
        if not t or not obj.get("solicitudesTramitadas"):
            continue        # ese mes el DCPR no publicó el detalle por región
        cab = json.loads(t.group(1))
        ir, ie = cab.index("REGION"), cab.index("ESTADO_TRAMITE")
        b64 = re.search(r'id="%s" data-gz="1">([^<]+)<' % re.escape(t.group(2)), texto).group(1)
        for c in tra.values():
            for fila in c:
                fila[k] = 0
        for fila in json.loads(gzip.decompress(base64.b64decode(b64)).decode("utf-8")):
            estado = ESTADOS_TRAMITE.get(fila[ie])
            if estado is None:
                raise ValueError("%s: estado de tramitación desconocido %r" % (mes, fila[ie]))
            r = indice_region(fila[ir])
            if r is not None:
                tra[estado][r][k] += 1
        publicado = obj["solicitudesTramitadas"]["porTramitacion"]
        for estado, serie in tra.items():
            _cuadra(mes, "tramitadas " + estado, serie, k, publicado[estado])

    if ingresos is None:
        raise ValueError("el panel DCPR no trae «Nuevos ingresos» por región en ningún mes")

    return {"origen": "dcpr", "fuente": fuente, "meses": ms,
            "titulos": tit, "tramitadas": tra, "ingresos": ingresos}


def _cuadra(mes, que, serie, k, publicado):
    """La suma de las regiones tiene que dar el total que publica el DCPR. Si
    no da, algo cambió en la fuente y es mejor no escribir que publicar otra
    cifra que la oficial."""
    suma = sum(fila[k] for fila in serie)
    if suma != publicado:
        raise ValueError("DCPR %s, %s: las regiones suman %s y el informe publica %s"
                         % (mes, que, suma, publicado))


# ----------------------------------------------- Gestión Regularización («Flujos»)
# El mismo panel del DCPR trae, en un iframe aparte («D · Flujos»), un
# sub-panel con su propio HTML completo codificado en base64
# (`FLUJOS_HTML_B64`): resoluciones A/B/C (positivas y negativas), casos en
# proceso (saldo al corte — NO se suma, es una foto) y los que llegan a
# ingresar al CBR, todo por región y mes, con su propio total «NACIONAL» para
# comprobar contra la suma de las 16 regiones. Es un dataset distinto del que
# usa dcpr(): no tiene tramitadas/títulos entregados, que para esos siguen
# siendo la fuente de siempre. Los «Nuevos ingresos» NO salen de acá: hay un
# gráfico con ese mismo nombre dentro de Flujos, pero es otro dataset que va
# más atrás en el tiempo (ver dcpr(), panel «A · Nuevos ingresos»).
TIPOS_RESOL = ["A", "B", "C"]


def _region_flujos(nombre):
    return None if nombre == "NACIONAL" else indice_region(nombre)


def _corte_flujos(por_anio, clave):
    """Último año-mes de `por_anio[año][clave]['NACIONAL']`, y el mismo mes
    del año anterior si existe. No asume que coincide con `meses`: proceso_total,
    por ejemplo, suele ir un mes atrás de lo que lista el año."""
    for anio in sorted((int(a) for a in por_anio), reverse=True):
        bloque = por_anio[str(anio)][clave].get("NACIONAL", {})
        disponibles = [m for m in por_anio[str(anio)]["meses"] if m in bloque]
        if not disponibles:
            continue
        mes = disponibles[-1]
        num = MESES_ES.index(mes.lower()) + 1
        previo = por_anio.get(str(anio - 1))
        hay_previo = bool(previo) and mes in previo[clave].get("NACIONAL", {})
        return {"anio": anio, "mes": mes, "k": "%d-%02d" % (anio, num),
                "kAnt": ("%d-%02d" % (anio - 1, num)) if hay_previo else None}
    raise ValueError("Flujos: %s sin datos" % clave)


def regularizacion(texto_dcpr, fuente):
    m = re.search(r"FLUJOS_HTML_B64\s*=\s*[\"'](.*?)[\"'];", texto_dcpr, re.S)
    if not m:
        raise ValueError("el panel DCPR ya no trae `FLUJOS_HTML_B64`")
    flujos = base64.b64decode(m.group(1)).decode("utf-8")

    def cargar(nombre):
        mm = re.search(r"const %s\s*=\s*(\{.*?\});\s*\n" % nombre, flujos, re.S)
        if not mm:
            raise ValueError("Flujos ya no trae `const %s = {...}`" % nombre)
        return json.loads(mm.group(1))

    data = cargar("DATA_BY_YEAR")      # resol, proceso_total
    cbr = cargar("CBR_BY_YEAR")        # cbr (ingresados al CBR)

    cResol = _corte_flujos(data, "resol")
    cProc = _corte_flujos(data, "proceso_total")
    cCbr = _corte_flujos(cbr, "cbr")

    def suma(por_anio, clave, anio, nombre_region, hasta_mes):
        """Σ del mes de enero a `hasta_mes` de ese año, para esa región."""
        if anio is None or nombre_region is None:
            return 0
        bloque = por_anio[str(anio)][clave].get(nombre_region, {})
        total = 0
        for mes in por_anio[str(anio)]["meses"]:
            total += bloque.get(mes) or 0
            if mes == hasta_mes:
                break
        return total

    def suma_resol(anio, nombre_region, hasta_mes, tipo, resultado):
        if anio is None or nombre_region is None:
            return 0
        bloque = data[str(anio)]["resol"].get(nombre_region, {})
        total = 0
        for mes in data[str(anio)]["meses"]:
            total += (bloque.get(mes, {}).get(tipo, {}).get(resultado) or 0)
            if mes == hasta_mes:
                break
        return total

    def proceso_en(anio, nombre_region, mes):
        if anio is None or nombre_region is None or mes is None:
            return None
        return data[str(anio)]["proceso_total"].get(nombre_region, {}).get(mes)

    # Cada dataset trae su propio catálogo de nombres de región: se resuelve
    # cada uno por separado en vez de asumir que calzan entre sí.
    regResol = {r: n for n in data[str(cResol["anio"])]["regiones"] for r in [_region_flujos(n)] if r is not None}
    regCbr = {r: n for n in cbr[str(cCbr["anio"])]["regiones"] for r in [_region_flujos(n)] if r is not None}

    def medida(actual, anterior_o_none):
        return {"actual": actual, "anterior": anterior_o_none}

    filas = []
    for r in range(len(REGIONES)):
        nr, nc = regResol.get(r), regCbr.get(r)
        pos_a = sum(suma_resol(cResol["anio"], nr, cResol["mes"], t, "POSITIVA") for t in TIPOS_RESOL)
        neg_a = sum(suma_resol(cResol["anio"], nr, cResol["mes"], t, "NEGATIVA") for t in TIPOS_RESOL)
        anio_ant = cResol["anio"] - 1 if cResol["kAnt"] else None
        pos_p = sum(suma_resol(anio_ant, nr, cResol["mes"], t, "POSITIVA") for t in TIPOS_RESOL) if anio_ant else None
        neg_p = sum(suma_resol(anio_ant, nr, cResol["mes"], t, "NEGATIVA") for t in TIPOS_RESOL) if anio_ant else None

        def tipo_total(anio, tipo):
            if anio is None:
                return None
            return (suma_resol(anio, nr, cResol["mes"], tipo, "POSITIVA")
                    + suma_resol(anio, nr, cResol["mes"], tipo, "NEGATIVA"))

        fila = {
            "r": r,
            "cbr": medida(
                suma(cbr, "cbr", cCbr["anio"], nc, cCbr["mes"]),
                suma(cbr, "cbr", cCbr["anio"] - 1, nc, cCbr["mes"]) if cCbr["kAnt"] else None),
            "proceso": medida(
                proceso_en(cProc["anio"], nr, cProc["mes"]),
                proceso_en(cProc["anio"] - 1, nr, cProc["mes"]) if cProc["kAnt"] else None),
            "positivas": medida(pos_a, pos_p),
            "negativas": medida(neg_a, neg_p),
            "resA": medida(tipo_total(cResol["anio"], "A"), tipo_total(anio_ant, "A")),
            "resB": medida(tipo_total(cResol["anio"], "B"), tipo_total(anio_ant, "B")),
            "resC": medida(tipo_total(cResol["anio"], "C"), tipo_total(anio_ant, "C")),
        }
        filas.append(fila)

    # La suma de las 16 regiones tiene que dar el total «NACIONAL» que trae
    # Flujos, igual que con el DCPR: si no cuadra, no se escribe.
    def exigir_cuadra(campo, nacional):
        suma_filas = sum(f[campo]["actual"] for f in filas)
        if suma_filas != nacional:
            raise ValueError("Flujos %s: las 16 regiones suman %s y NACIONAL da %s"
                             % (campo, suma_filas, nacional))

    exigir_cuadra("cbr", suma(cbr, "cbr", cCbr["anio"], "NACIONAL", cCbr["mes"]))
    exigir_cuadra("positivas", sum(suma_resol(cResol["anio"], "NACIONAL", cResol["mes"], t, "POSITIVA") for t in TIPOS_RESOL))
    exigir_cuadra("negativas", sum(suma_resol(cResol["anio"], "NACIONAL", cResol["mes"], t, "NEGATIVA") for t in TIPOS_RESOL))
    proceso_nacional = proceso_en(cProc["anio"], "NACIONAL", cProc["mes"])
    suma_proceso = sum(f["proceso"]["actual"] for f in filas)
    if suma_proceso != proceso_nacional:
        raise ValueError("Flujos proceso: las 16 regiones suman %s y NACIONAL da %s"
                         % (suma_proceso, proceso_nacional))

    return {
        "origen": "dcpr-flujos", "fuente": fuente,
        "corteResol": cResol["k"], "corteResolAnterior": cResol["kAnt"],
        "corteProceso": cProc["k"], "corteProcesoAnterior": cProc["kAnt"],
        "corteCbr": cCbr["k"], "corteCbrAnterior": cCbr["kAnt"],
        "filas": filas,
    }


# --------------------------------------------------------- presupuesto CDC
# El Panel Presupuestario del Departamento de Presupuesto publica, dentro de
# un <script> de ajuste mensual, un objeto JS (no JSON: comillas simples y
# claves sin comillas) con el resultado regional del Convenio de Desempeño
# Colectivo: presupuesto vigente, devengado y meta por SEREMI. A diferencia
# del CDC de DIPLAP, el panel presupuestario NO publica una serie mensual:
# solo el corte vigente («resultado final agosto 2026» hoy), así que este
# bloque no tiene «meses» ni variación contra el periodo anterior.
def presupuesto_cdc(fuente):
    texto = leer(fuente)
    m = re.search(r"cdc:\{\s*budget:(\d+),dev:(\d+).*?rows:\[(.*?)\]\s*\}", texto, re.S)
    if not m:
        raise ValueError("el panel presupuestario ya no trae `cdc:{ budget, dev, rows:[...] }`")
    budget_pub, dev_pub = int(m.group(1)), int(m.group(2))

    tit = re.search(r"resultado final (\w+) (\d{4})", texto, re.I)
    corte = ("%s-%02d" % (tit.group(2), MESES_ES.index(tit.group(1).lower()) + 1)) if tit else None

    filas = [None] * len(REGIONES)
    for _cita, nombre, presupuesto, devengado, pct, meta in re.findall(
            r"\[(['\"])((?:(?!\1).)*)\1,([\d.]+),([\d.]+),([\d.]+),([\d.]+)\]", m.group(3)):
        r = indice_region(nombre)
        if r is None:
            continue
        filas[r] = {"r": r, "presupuesto": int(float(presupuesto)), "devengado": int(float(devengado)),
                    "pct": round(float(pct), 4), "meta": round(float(meta), 4)}
    faltan = [REGIONES[i][1] for i, f in enumerate(filas) if f is None]
    if faltan:
        raise ValueError("presupuesto CDC sin fila para: %s" % ", ".join(faltan))

    # Igual que con el DCPR: la suma de las 16 SEREMIs tiene que dar el total
    # que publica el panel, o no se escribe.
    budget = sum(f["presupuesto"] for f in filas)
    dev = sum(f["devengado"] for f in filas)
    if budget != budget_pub or dev != dev_pub:
        raise ValueError(
            "presupuesto CDC: la suma de las 16 SEREMIs (%d / %d) no calza con el total publicado (%d / %d)"
            % (budget, dev, budget_pub, dev_pub))

    return {"origen": "presupuesto", "fuente": fuente, "corte": corte,
            "budget": budget, "dev": dev, "filas": filas}


# ------------------------------------------------------- §2.4a gestión de Bienes
# Panel-Autoridades (de donde publica DASHBOARD SUBSE) ya trae, para 17
# trámites y 16 SEREMIs, un cubo real `[mes, región, trámite, ingresados,
# finalizados, bajas]` desde 1998, en JSON válido (a diferencia del panel
# presupuestario). Aquí se toman solo los trámites acordados y se conserva la
# serie COMPLETA, no solo el año en curso: el stock («mochila») es un
# acumulado de ingresos menos bajas desde el inicio de la base, y recortarlo
# al año actual daría un stock que no cuadra con nada.
TRAMITES_BIENES = [
    ("Concesion OLP", "Concesión OLP"),
    ("Servidumbres", "Servidumbres"),
    ("Arriendo", "Arriendo"),
    ("Aprovechamiento de Aguas", "Aprovechamiento de Aguas"),
    ("Venta", "Venta"),
    ("Ventas por Propuesta Pública", "Ventas por Propuesta Pública"),
]


def gestion_bienes(fuente):
    texto = leer(fuente)
    m = re.search(r"window\.DATOS\s*=\s*(\{.*\});?\s*$", texto, re.S)
    if not m:
        raise ValueError("Panel-Autoridades ya no trae `window.DATOS = {...}`")
    src = json.loads(m.group(1))

    remap_region = {i: _INDICE.get(r["codigo"]) for i, r in enumerate(src["regiones"])}
    nuestro_indice = {nombre: i for i, (nombre, _) in enumerate(TRAMITES_BIENES)}
    nombres_fuente = {t["nombre"] for t in src["tramites"]}
    faltan = [n for n, _ in TRAMITES_BIENES if n not in nombres_fuente]
    if faltan:
        raise ValueError("Panel-Autoridades ya no trae el trámite: %s" % ", ".join(faltan))
    remap_tramite = {i: nuestro_indice[t["nombre"]]
                      for i, t in enumerate(src["tramites"]) if t["nombre"] in nuestro_indice}

    cubo_src = src["cubo"]
    if len(cubo_src) % 6:
        raise ValueError("Panel-Autoridades: el cubo no es múltiplo de 6 (¿cambió el formato?)")

    cubo = []
    for i in range(0, len(cubo_src), 6):
        m_, r_, t_, ing, fin, baja = cubo_src[i:i + 6]
        if t_ not in remap_tramite:
            continue
        r2 = remap_region.get(r_)
        if r2 is None:
            continue        # «00 Sin región»: no hay SEREMI a la que atribuirlo
        cubo.extend([m_, r2, remap_tramite[t_], ing, fin, baja])
    if not cubo:
        raise ValueError("Panel-Autoridades: sin filas para los trámites de Bienes elegidos")

    return {
        "origen": "panel-autoridades", "fuente": fuente,
        "meses": src["meses"], "mes_parcial": src["mes_parcial"],
        "tramites": [{"nombre": n} for _, n in TRAMITES_BIENES],
        "cubo": cubo,
    }


# ---------------------------------------------------- Gestión de Convenios
# Base_Convenios.xlsx trae dos hojas con columnas distintas:
#   «Convenios FT»   — convenios formalizados, vigentes y no vigentes.
#   «En trámite»     — convenios en proceso de negociación o firma.
# Ambas traen la región en texto libre, mezclada con unidades nacionales
# (DIPLAP, GABSUB, DBN, DCPR, DICAT) y alguna nota suelta que no es una
# SEREMI. Esas filas se omiten en silencio: no es un error de captura como en
# las demás fuentes (`_fallo`/`_SIN_MAPEO` es para avisar de algo que debería
# haber calzado y no calzó), es exactamente lo que el documento pide excluir.
MATERIAS_CONVENIO = ["Propiedad fiscal", "Regularización", "Mixto", "Otro"]

# «En trámite» no trae una columna de Materia cerrada como «Convenios FT»: su
# «MATERIA (referencial)» es texto libre, así que se homologa por palabra
# clave a las mismas 4 categorías. Los números de ley (2.695/1979 y
# 1.939/1977, las dos normas de regularización) cuentan como «Regularización»
# aunque el texto no use la palabra «regulariza».
_MATERIA_PROPIEDAD_KW = ("fiscal", "catastro", "geoespacial")
_MATERIA_REGULARIZACION_KW = ("regulariz", "saneamiento", "titulo gratuito",
                               "2.695", "2695", "1.939", "1939", "19.776", "19776")


def _texto_plano(valor):
    """Como `_clave`, pero sin sacar dígitos ni el prefijo «seremi/región»:
    sirve para buscar palabras clave en texto libre, no nombres de región."""
    return unicodedata.normalize("NFKD", str(valor or "")).encode("ascii", "ignore").decode().lower()


def _homologar_materia(valor):
    t = _texto_plano(valor)
    prop = any(k in t for k in _MATERIA_PROPIEDAD_KW)
    reg = any(k in t for k in _MATERIA_REGULARIZACION_KW)
    if prop and reg:
        return "Mixto"
    if reg:
        return "Regularización"
    if prop:
        return "Propiedad fiscal"
    return "Otro"


def _region_en_texto(valor):
    """Para «RESPONSABLE MBN» («Seremi Los Lagos», «DCPR - Seremi O'Higgins»):
    el nombre de la SEREMI va embebido en más texto, así que se busca como
    substring (el más largo que calce) en vez de exigir una coincidencia
    exacta como `normalizar_region`. Lo que no trae ninguna región reconocible
    («SNIT», «DBN - UGTP», «DIVAD - DIJUR») no es un error, es un convenio de
    alcance nacional: se omite sin avisar."""
    if not valor:
        return None
    t = _clave(valor)
    mejor = None
    for clave, codigo in _POR_NOMBRE.items():
        if clave and clave in t and (mejor is None or len(clave) > len(mejor[0])):
            mejor = (clave, codigo)
    return _INDICE.get(mejor[1]) if mejor else None


def _region_directa(valor):
    """Para «Región/División»: el valor YA es (o debería ser) un nombre de
    región. Va directo a `_POR_NOMBRE`, sin pasar por `normalizar_region`,
    para no marcar con `_SIN_MAPEO` las filas de DIPLAP/GABSUB/DBN/DCPR/DICAT
    ni las notas sueltas de la planilla: omitirlas es la regla, no un aviso."""
    if valor is None:
        return None
    codigo = _POR_NOMBRE.get(_clave(valor))
    return _INDICE.get(codigo) if codigo else None


def _monto(valor):
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return round(valor)
    digitos = re.sub(r"[^\d]", "", str(valor))
    return int(digitos) if digitos else None


def _fecha_excel(valor):
    if valor is None:
        return None
    if hasattr(valor, "date") and callable(valor.date):
        valor = valor.date()
    return valor.isoformat() if hasattr(valor, "isoformat") else None


def _encabezados(ws):
    """Encabezados con espacios de más («Monto  Convenio ») colapsados a uno
    solo: la planilla la edita una persona en Excel, no un sistema, y ese
    tipo de variación no debería botar la carga."""
    fila = next(ws.iter_rows(min_row=1, max_row=1))
    return {" ".join(str(c.value or "").split()): i for i, c in enumerate(fila)}


def convenios(fuente):
    wb = openpyxl.load_workbook(fuente, data_only=True)
    for hoja in ("Convenios FT", "En trámite"):
        if hoja not in wb.sheetnames:
            raise ValueError("Base_Convenios.xlsx ya no trae la hoja «%s»" % hoja)
    idx_materia = {m: i for i, m in enumerate(MATERIAS_CONVENIO)}

    ws = wb["Convenios FT"]
    col = _encabezados(ws)
    requeridas = ["Región/División", "Tipo Otorgante", "Entidad Otorgante", "Nombre Convenio",
                  "Inicio", "Fin", "Monto Convenio", "Estado", "Fecha corte", "Materia"]
    faltan = [c for c in requeridas if c not in col]
    if faltan:
        raise ValueError("Base_Convenios.xlsx, hoja «Convenios FT»: faltan columnas %s" % faltan)
    ft, cortes = [], set()
    for fila in ws.iter_rows(min_row=2, values_only=True):
        r = _region_directa(fila[col["Región/División"]])
        if r is None:
            continue
        nombre = fila[col["Nombre Convenio"]]
        if not nombre or not str(nombre).strip():
            raise ValueError("Convenios FT: fila con región %s y sin Nombre Convenio" % fila[col["Región/División"]])
        materia = fila[col["Materia"]]
        if materia not in idx_materia:
            raise ValueError("Convenios FT: convenio %r sin Materia válida (valor: %r)" % (nombre, materia))
        corte = _fecha_excel(fila[col["Fecha corte"]])
        if corte:
            cortes.add(corte)
        ft.append({
            "r": r, "materia": idx_materia[materia], "nombre": str(nombre).strip(),
            "inicio": _fecha_excel(fila[col["Inicio"]]), "fin": _fecha_excel(fila[col["Fin"]]),
            "tipoOtorgante": (fila[col["Tipo Otorgante"]] or "").strip(),
            "entidadOtorgante": (fila[col["Entidad Otorgante"]] or "").strip(),
            "monto": _monto(fila[col["Monto Convenio"]]),
            "vigente": fila[col["Estado"]] == "Vigente",
        })

    ws = wb["En trámite"]
    col = _encabezados(ws)
    requeridas = ["NOMBRE CONVENIO", "MATERIA (referencial)", "MONTO", "RESPONSABLE MBN", "ORGANISMO EXTERNO"]
    faltan = [c for c in requeridas if c not in col]
    if faltan:
        raise ValueError("Base_Convenios.xlsx, hoja «En trámite»: faltan columnas %s" % faltan)
    tramite = []
    for fila in ws.iter_rows(min_row=2, values_only=True):
        nombre = fila[col["NOMBRE CONVENIO"]]
        if not nombre or not str(nombre).strip():
            continue        # fila en blanco al final de la hoja, no un dato
        r = _region_en_texto(fila[col["RESPONSABLE MBN"]])
        if r is None:
            continue
        tramite.append({
            "r": r, "materia": idx_materia[_homologar_materia(fila[col["MATERIA (referencial)"]])],
            "nombre": str(nombre).strip(),
            "organismoExterno": (fila[col["ORGANISMO EXTERNO"]] or "").strip(),
            "monto": _monto(fila[col["MONTO"]]),
        })

    if not ft:
        raise ValueError("Base_Convenios.xlsx: «Convenios FT» sin filas con región reconocida")
    if not tramite:
        raise ValueError("Base_Convenios.xlsx: «En trámite» sin filas con región reconocida")

    return {
        "origen": "excel-local", "fuente": fuente,
        "corte": max(cortes) if cortes else None,
        "materias": MATERIAS_CONVENIO,
        "ft": ft, "tramite": tramite,
    }


# ------------------------------------------------------------- §2.3 catastro
# `compara`: el indicador se mide contra el trimestre anterior y entra al
# semáforo. La superficie fiscal no: bajar superficie fiscal puede ser
# justamente la gestión (ventas, transferencias). El porcentaje de la
# superficie regional respecto del nacional lo calcula el panel.
#
# Las tres categorías de tenencia son las del informe de Catastro (Power BI,
# pregunta P-005) y suman el total de UC sin duplicar:
#   administradas por el Ministerio = SIN acto de administración
#   con acto de administración vigente = «Entregado a tercero»
#   parcialmente administradas = tenencia mixta; va aparte, como en el informe
CATASTRO = [
    ("Unidades catastrales", "N°", False),
    ("Superficie fiscal", "ha", False),
    ("UC administradas por el Ministerio", "N°", True),
    ("UC con acto de administración vigente", "N°", True),
    ("UC parcialmente administradas", "N°", False),
]

# ------------------------------------------------- §2.5 gobierno en terreno
COMUNAS = {
    "15": ["Arica", "Putre", "Camarones", "General Lagos"],
    "01": ["Iquique", "Alto Hospicio", "Pozo Almonte", "Pica"],
    "02": ["Antofagasta", "Calama", "Tocopilla", "Taltal"],
    "03": ["Copiapó", "Vallenar", "Caldera", "Chañaral"],
    "04": ["La Serena", "Coquimbo", "Ovalle", "Illapel"],
    "05": ["Valparaíso", "Viña del Mar", "Quillota", "San Antonio"],
    "13": ["Santiago", "Maipú", "Puente Alto", "Melipilla"],
    "06": ["Rancagua", "San Fernando", "Pichilemu", "Santa Cruz"],
    "07": ["Talca", "Curicó", "Linares", "Cauquenes"],
    "16": ["Chillán", "San Carlos", "Bulnes", "Quirihue"],
    "08": ["Concepción", "Los Ángeles", "Talcahuano", "Arauco"],
    "09": ["Temuco", "Villarrica", "Angol", "Lautaro"],
    "14": ["Valdivia", "La Unión", "Panguipulli", "Río Bueno"],
    "10": ["Puerto Montt", "Osorno", "Castro", "Ancud"],
    "11": ["Coyhaique", "Aysén", "Chile Chico", "Cochrane"],
    "12": ["Punta Arenas", "Puerto Natales", "Porvenir", "Cabo de Hornos"],
}
ACTORES = ["Delegado Presidencial", "Alcalde", "Dirigente social",
           "Servicio público", "Gremio", "Comunidad indígena"]
TEMAS = [
    "Regularización de títulos pendientes en el sector rural",
    "Solicitud de transferencia gratuita para sede comunitaria",
    "Ocupaciones irregulares en terreno fiscal",
    "Avance del catastro de inmuebles fiscales de la comuna",
    "Concesión de uso gratuito para proyecto municipal",
    "Coordinación con la delegación para mesa de tierras",
    "Demanda habitacional sobre terrenos fiscales disponibles",
]
MATERIAS = [
    "Informe de avance CDC", "Antecedentes para respuesta parlamentaria",
    "Solicitud de transparencia derivada", "Estado de ocupaciones irregulares",
    "Catastro de inmuebles fiscales", "Programación de gobierno en terreno",
    "Rendición de gastos regionales", "Denuncia ciudadana derivada",
]


# ------------------------------------------------------------------- demo
def construir_demo():
    """Las dimensiones sin fuente todavía: datos inventados pero verosímiles,
    con semilla fija. Sirven para validar estructura y navegación, NUNCA para
    tomar decisiones."""
    az = random.Random(SEMILLA)
    # El trimestre en curso todavía no cierra: no se muestra.
    tris = sorted({trimestre(m) for m in meses("2025-07", CORTE)})[:-1]

    # --- §2.2 oficios: unos pocos sin responder, y colas de demora distintas
    items = []
    folio = 1200
    for r in range(len(REGIONES)):
        demora = az.uniform(4, 22)              # la firma de demora de la SEREMI
        for _ in range(az.randint(8, 16)):
            folio += 1
            antiguedad = az.randint(5, 240)
            envio = HOY - timedelta(days=antiguedad)
            dias = max(1, int(az.gauss(demora, demora / 3)))
            resp = envio + timedelta(days=dias)
            # Un oficio de hace ocho meses sin responder no es lo normal: los
            # pendientes al azar salen solo de los últimos tres meses.
            pendiente = resp > HOY or (antiguedad < 90 and az.random() < 0.12)
            items.append({
                "r": r, "folio": "ORD %d" % folio,
                "envio": envio.isoformat(),
                "materia": az.choice(MATERIAS),
                "respuesta": None if pendiente else resp.isoformat(),
            })
    items.sort(key=lambda o: o["envio"])

    # --- §2.3 catastro: valores[region][trimestre][indicador]
    valores = []
    for r in range(len(REGIONES)):
        adm, ter, par = az.randint(150, 3000), az.randint(150, 2800), az.randint(5, 120)
        sup = az.uniform(2e4, 6e6)
        serie = []
        for _ in range(len(tris)):
            adm = round(adm * az.uniform(0.97, 1.04))
            ter = round(ter * az.uniform(0.97, 1.05))
            par = round(par * az.uniform(0.95, 1.05))
            sup *= az.uniform(0.99, 1.01)
            # El total sale de las partes: así cuadra igual que en el informe.
            serie.append([adm + ter + par, round(sup), adm, ter, par])
        valores.append(serie)

    # --- §2.5 gobierno en terreno: quincenas, comunas y minutas
    quincenas = []
    for m in meses("2026-06", CORTE):
        quincenas.extend([m + "-Q1", m + "-Q2"])
    salidas = []
    for q in range(len(quincenas)):
        for r, (cod, _) in enumerate(REGIONES):
            if az.random() < 0.18:              # esa quincena no reportó
                continue
            for comuna in az.sample(COMUNAS[cod], az.randint(1, 3)):
                salidas.append({
                    "r": r, "q": q, "comuna": comuna,
                    "actores": az.sample(ACTORES, az.randint(1, 3)),
                    "temas": az.choice(TEMAS),
                })

    return {
        "corte": CORTE,
        "hoy": HOY.isoformat(),
        "oficios": {"origen": "demo", "items": items},
        "catastro": {"origen": "demo", "trimestres": tris,
                     "indicadores": [{"nombre": n, "unidad": u, "compara": c}
                                     for n, u, c in CATASTRO],
                     "valores": valores},
        "terreno": {"origen": "demo", "quincenas": quincenas, "salidas": salidas},
    }


# ------------------------------------------------------------- comprobaciones
def comprobar(p):
    """Se niega a escribir si algo no cuadra. Vale más un datos.js viejo que
    uno que el panel dibuja sin quejarse y que nadie puede reproducir."""
    def exigir(ok, msg):
        if not ok:
            raise ValueError(msg)

    nr = len(p["regiones"])
    exigir(nr == 16, "se esperaban 16 SEREMIs, hay %d" % nr)
    exigir(len({r["codigo"] for r in p["regiones"]}) == 16, "códigos de región repetidos")

    cdc = p["cdc"]
    exigir(len(cdc["meses"]) > 0, "el CDC no trae meses")
    for r, s in enumerate(cdc["sumas"]):
        exigir(s[-1][1] > 0, "el CDC no trae indicadores de %s en el último mes"
               % p["regiones"][r]["nombre"])
    exigir({f["r"] for f in cdc["filas"]} == set(range(nr)),
           "el detalle CDC no cubre las 16 SEREMIs")

    pr = p["presupuesto"]
    exigir(len(pr["filas"]) == nr, "presupuesto CDC sin una fila por SEREMI")
    exigir(all(f["presupuesto"] > 0 for f in pr["filas"]), "presupuesto CDC con presupuesto vigente en cero")
    exigir(sum(f["presupuesto"] for f in pr["filas"]) == pr["budget"],
           "presupuesto CDC: el total no es la suma de las SEREMIs")

    d = p["dcpr"]
    exigir(len(d["meses"]) >= 2, "el DCPR trae menos de dos meses: no hay periodo anterior")
    exigir(d["titulos"]["entregados"][0][-1] is not None, "el DCPR no trae títulos del último mes")
    exigir(d["tramitadas"]["positivo"][0][-1] is not None, "el DCPR no trae tramitadas del último mes")
    exigir(len(d["ingresos"]["porRegion"]) == nr, "ingresos (panel A) sin una fila por SEREMI")
    exigir(sum(d["ingresos"]["porRegion"]) == d["ingresos"]["total"],
           "ingresos (panel A): las 16 regiones no suman el total publicado")

    reg = p["regularizacion"]
    exigir(len(reg["filas"]) == nr, "Flujos sin una fila por SEREMI")
    for campo in ("cbr", "proceso", "positivas", "negativas", "resA", "resB", "resC"):
        exigir(all(f[campo]["actual"] is not None and f[campo]["actual"] >= 0 for f in reg["filas"]),
               "Flujos: %s con valores inválidos" % campo)
    exigir(all(f["resA"]["actual"] + f["resB"]["actual"] + f["resC"]["actual"]
               == f["positivas"]["actual"] + f["negativas"]["actual"] for f in reg["filas"]),
           "Flujos: resoluciones A+B+C no cuadra con positivas+negativas")

    for o in p["oficios"]["items"]:
        exigir(0 <= o["r"] < nr, "oficio con SEREMI fuera de rango")
        exigir(o["respuesta"] is None or o["respuesta"] >= o["envio"],
               "oficio %s respondido antes de enviarse" % o["folio"])

    cat = p["catastro"]
    exigir(len(cat["valores"]) == nr, "catastro sin una fila por SEREMI")
    for serie in cat["valores"]:
        exigir(len(serie) == len(cat["trimestres"]), "catastro con trimestres desparejos")
        exigir(all(len(v) == len(cat["indicadores"]) for v in serie),
               "catastro con indicadores desparejos")
        # Sin acto + con acto vigente + parcial = total de UC, sin duplicar.
        exigir(all(v[0] == v[2] + v[3] + v[4] for v in serie),
               "catastro: las tres categorías de tenencia no suman el total de UC")

    g = p["gestion"]
    exigir(len(g["cubo"]) % 6 == 0, "el cubo de gestión no es múltiplo de 6")
    exigir(g["mes_parcial"] in g["meses"], "gestión: mes_parcial no está en meses")
    tramites_vistos = set()
    for i in range(0, len(g["cubo"]), 6):
        m, r, t, ing, fin, baja = g["cubo"][i:i + 6]
        exigir(0 <= m < len(g["meses"]) and 0 <= r < nr and 0 <= t < len(g["tramites"]),
               "celda inválida en el cubo de gestión: %s" % g["cubo"][i:i + 6])
        exigir(ing >= 0 and fin >= 0 and baja >= 0,
               "gestión: valores negativos en %s" % g["cubo"][i:i + 6])
        tramites_vistos.add(t)
    exigir(len(tramites_vistos) == len(g["tramites"]),
           "gestión: falta al menos uno de los %d trámites en todo el cubo" % len(g["tramites"]))

    cv = p["convenios"]
    exigir(len(cv["ft"]) > 0, "Convenios FT: sin filas")
    exigir(len(cv["tramite"]) > 0, "Convenios en trámite: sin filas")
    for fila in cv["ft"] + cv["tramite"]:
        exigir(0 <= fila["r"] < nr, "Convenios: fila con región fuera de rango")
        exigir(0 <= fila["materia"] < len(cv["materias"]), "Convenios: fila con materia fuera de rango")
        exigir(fila["monto"] is None or fila["monto"] >= 0, "Convenios: monto negativo en %r" % fila["nombre"])

    ter = p["terreno"]
    for s in ter["salidas"]:
        exigir(0 <= s["r"] < nr and 0 <= s["q"] < len(ter["quincenas"]),
               "salida a terreno con índices fuera de rango")
        exigir(bool(s["comuna"]) and bool(s["actores"]),
               "salida a terreno sin comuna o sin actores")


def escribir(payload, destino=SALIDA, variable="DATOS"):
    """Escritura atómica: si algo falla a mitad de camino, el archivo anterior
    queda intacto y el panel degrada en vez de romperse."""
    tmp = destino + ".tmp"
    cuerpo = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            f.write("// Generado por extraer.py — no editar a mano.\n")
            f.write("window.%s = %s;\n" % (variable, cuerpo))
        os.replace(tmp, destino)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return os.path.getsize(destino)


def main():
    cargar_env()
    try:
        payload = construir_demo()
        payload["regiones"] = [{"codigo": c, "nombre": n} for c, n in REGIONES]
        payload["cdc"] = cdc_diplap(os.environ.get("FUENTE_CDC", URL_CDC))
        fuente_dcpr = os.environ.get("FUENTE_DCPR", URL_DCPR)
        texto_dcpr = leer(fuente_dcpr)  # una sola bajada: dcpr() y regularizacion() leen la misma página
        payload["dcpr"] = dcpr(texto_dcpr, fuente_dcpr)
        payload["regularizacion"] = regularizacion(texto_dcpr, fuente_dcpr)
        payload["presupuesto"] = presupuesto_cdc(os.environ.get("FUENTE_PRESUPUESTO", URL_PRESUPUESTO))
        payload["gestion"] = gestion_bienes(os.environ.get("FUENTE_GESTION", URL_GESTION))
        payload["convenios"] = convenios(os.environ.get("FUENTE_CONVENIOS", RUTA_CONVENIOS))
        payload["generado"] = datetime.now().replace(microsecond=0).isoformat()
        comprobar(payload)
        tam = escribir(payload)
    except Exception as e:
        # Código distinto de cero para que el Programador de tareas lo registre.
        print("ERROR: %s: %s" % (type(e).__name__, e), file=sys.stderr)
        return 1

    if _SIN_MAPEO:
        print("AVISO: regiones sin código, descartadas: %s"
              % ", ".join(sorted(_SIN_MAPEO)), file=sys.stderr)
    print("datos.js -> CDC a %s (%d indicadores), DCPR a %s, regularización a %s, presupuesto CDC a %s, gestión Bienes a %s, "
          "convenios FT %d / trámite %d, %.1f KB"
          % (payload["cdc"]["meses"][-1], len(payload["cdc"]["filas"]),
             payload["dcpr"]["meses"][-1], payload["regularizacion"]["corteResol"],
             payload["presupuesto"]["corte"], payload["gestion"]["mes_parcial"],
             len(payload["convenios"]["ft"]), len(payload["convenios"]["tramite"]), tam / 1024))
    print("            oficios, catastro y terreno: DATOS DE EJEMPLO")
    return 0


if __name__ == "__main__":
    sys.exit(main())
