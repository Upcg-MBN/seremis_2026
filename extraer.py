#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Arma datos.js para el panel de seguimiento de SEREMIs.

    python extraer.py

Fuentes:

    §2.1 CDC                  Panel de Gestión Institucional de DIPLAP (real)
    §2.4b Gestión DCPR        Panel de Gestión Mensual del DCPR (real)
    §2.2 Oficios              plantillas/oficios.csv              (ejemplo)
    §2.3 Catastro             plantillas/catastro.csv             (ejemplo)
    §2.4a Gestión Bienes      por definir, ver README             (ejemplo)
    §2.5 Gobierno en terreno  plantillas/gobierno_en_terreno.csv  (ejemplo)

Las dos fuentes reales se leen de los paneles publicados, así las cifras son
las mismas que ve todo el Ministerio. FUENTE_CDC y FUENTE_DCPR (en el entorno
o en .env) aceptan otra URL o una ruta local, para correr sin internet.

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

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "datos.js")

URL_CDC = "https://upcg-mbn.github.io/panel_gestion_2026/"
URL_DCPR = "https://bienesnacionales.github.io/mbn-dcpr-reportes/"

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
_POR_NOMBRE.update({"arica": "15", "araucania": "09"})
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


def dcpr(fuente):
    texto = leer(fuente)
    m = re.search(r"const DATA = \{([^}]*)\}", texto)
    if not m:
        raise ValueError("el panel DCPR ya no trae `const DATA = {...}`")
    pares = sorted(("%s-%02d" % (anio, MESES_ES.index(mes.lower()) + 1), var)
                   for mes, anio, var in re.findall(r'"(\w+) (\d{4})":\s*(\w+)', m.group(1)))
    ms = [p[0] for p in pares]
    vacio = lambda: [[None] * len(ms) for _ in REGIONES]
    tit = {"entregados": vacio(), "porEntregar": vacio()}
    tra = {k: vacio() for k in ESTADOS_TRAMITE.values()}

    for k, (mes, var) in enumerate(pares):
        obj = json.loads(re.search(r"^const %s = (\{.*\});\s*$" % var, texto, re.M).group(1))

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

    return {"origen": "dcpr", "fuente": fuente, "meses": ms,
            "titulos": tit, "tramitadas": tra}


def _cuadra(mes, que, serie, k, publicado):
    """La suma de las regiones tiene que dar el total que publica el DCPR. Si
    no da, algo cambió en la fuente y es mejor no escribir que publicar otra
    cifra que la oficial."""
    suma = sum(fila[k] for fila in serie)
    if suma != publicado:
        raise ValueError("DCPR %s, %s: las regiones suman %s y el informe publica %s"
                         % (mes, que, suma, publicado))


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

# ------------------------------------------------- §2.4a gestión de Bienes
# De ejemplo. Falta decidir qué es «gestión»: actos dictados (planilla manual
# de DBN) o casos finalizados en el sistema (base GXP). Ver README.
TRAMITES = ["Arriendo", "Venta", "Transferencia Gratuita", "Destinaciones",
            "Concesión GCP", "Concesión OLP", "Desafectaciones", "Servidumbres"]

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
    ms_ges = meses("2025-09", CORTE)
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

    # --- §2.4a cubo plano [mes, región, trámite, n], como el cubo de SUBSE
    # Cada par región-trámite sigue un nivel con deriva suave y ruido chico, no
    # un sorteo independiente por mes: con valores al azar la variación mes a
    # mes es enorme y todas las SEREMIs saldrían en rojo por ruido del demo.
    cubo = []
    for r in range(len(REGIONES)):
        escala = az.uniform(0.4, 3.0)           # la Metropolitana pesa más
        for t in range(len(TRAMITES)):
            nivel = az.uniform(1, 40) * escala
            deriva = az.uniform(0.97, 1.03)     # la tendencia propia del par
            for m in range(len(ms_ges)):
                nivel *= deriva * az.uniform(0.95, 1.05)
                # El mes de corte va a la mitad: el panel lo marca como parcial.
                parcial = 0.6 if m == len(ms_ges) - 1 else 1.0
                n = int(round(nivel * parcial))
                if n:
                    cubo.extend([m, r, t, n])

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
        "gestion": {"origen": "demo", "meses": ms_ges,
                    "tramites": [{"nombre": n} for n in TRAMITES],
                    "cubo": cubo},
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

    d = p["dcpr"]
    exigir(len(d["meses"]) >= 2, "el DCPR trae menos de dos meses: no hay periodo anterior")
    exigir(d["titulos"]["entregados"][0][-1] is not None, "el DCPR no trae títulos del último mes")
    exigir(d["tramitadas"]["positivo"][0][-1] is not None, "el DCPR no trae tramitadas del último mes")

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
    exigir(len(g["cubo"]) % 4 == 0, "el cubo de gestión no es múltiplo de 4")
    for i in range(0, len(g["cubo"]), 4):
        m, r, t, n = g["cubo"][i:i + 4]
        exigir(0 <= m < len(g["meses"]) and 0 <= r < nr
               and 0 <= t < len(g["tramites"]) and n > 0,
               "celda inválida en el cubo de gestión: %s" % g["cubo"][i:i + 4])
    exigir(g["meses"][-1] == p["corte"], "el último mes de gestión no es el corte")

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
        payload["dcpr"] = dcpr(os.environ.get("FUENTE_DCPR", URL_DCPR))
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
    print("datos.js -> CDC a %s (%d indicadores), DCPR a %s, %.1f KB"
          % (payload["cdc"]["meses"][-1], len(payload["cdc"]["filas"]),
             payload["dcpr"]["meses"][-1], tam / 1024))
    print("            oficios, catastro, gestión de Bienes y terreno: DATOS DE EJEMPLO")
    return 0


if __name__ == "__main__":
    sys.exit(main())
