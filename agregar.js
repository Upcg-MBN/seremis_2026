// Agregaciones puras del panel de SEREMIs: sin DOM, para poder probarlas con
// `node prueba.js`. Aquí va la lógica que se equivoca en silencio —los días de
// respuesta, las variaciones contra el periodo anterior, el top de trámites y
// las reglas del semáforo—; el dibujo queda en index.html.
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- umbrales
  // El documento pide «alerta temprana» pero no fija los cortes. Estos son la
  // regla declarada del panel, no un criterio a ojo: están en el glosario y se
  // cambian en un solo lugar. Cualquier cambio hay que acordarlo con Gabinete.
  var REGLAS = {
    // §2.1 CDC: los mismos cortes que usa el panel de DIPLAP para colorear el
    // cumplimiento, para que una SEREMI no salga verde allá y ámbar aquí.
    cdcAlerta: 0.90,        // cumplimiento global bajo 90 %, alerta; y el
                            // corte bajo el cual se listan sus indicadores
    cdcCritico: 0.75,       // bajo 75 %, crítico
    // §2.2 oficios: el documento NO define plazo de respuesta. Esto no mide
    // cumplimiento: marca oficios que llevan demasiado tiempo sin contestar.
    oficioViejo: 30,        // días sin respuesta que encienden la alerta
    oficioCritico: 60,
    // §2.3 y §2.4: comparación de cada SEREMI consigo misma, nunca entre ellas.
    // Trimestral (catastro): la serie es suave, una caída chica ya es señal.
    caida: -0.02,
    caidaFuerte: -0.10,
    // Mensual (gestión): los conteos de trámites oscilan varios puntos por mes
    // sin que pase nada. Con el umbral trimestral, casi toda SEREMI aparecía
    // en alerta por ruido. Estos dos hay que recalibrarlos con datos reales.
    caidaMes: -0.10,
    caidaMesFuerte: -0.25,
    // §2.5: reporte quincenal.
    quincenasSinReportar: 1
  };

  var ESTADOS = ['bueno', 'alerta', 'critico'];
  function peor(a, b) {
    return ESTADOS.indexOf(a) >= ESTADOS.indexOf(b) ? a : b;
  }

  // ------------------------------------------------------------------ fechas
  // Las fechas vienen como 'AAAA-MM-DD'. Se restan como días UTC para que el
  // huso no corra un día: con Date local, un 01-01 puede dar 31-12.
  function dia(iso) {
    return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
  }

  function mediana(v) {
    if (!v.length) return null;
    var s = v.slice().sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Variación relativa contra el periodo anterior. Devuelve null si no hay
  // periodo anterior o si la base es cero: un 0 → 5 no es «+500 %», es nuevo.
  function variacion(actual, anterior) {
    if (anterior === null || anterior === undefined || !anterior) return null;
    return (actual - anterior) / anterior;
  }

  // ----------------------------------------------------------------- §2.1 CDC
  // Misma fórmula que el panel de DIPLAP: el cumplimiento global es la suma de
  // las contribuciones ponderadas al cumplimiento dividida por la suma de las
  // contribuciones ponderadas a la meta. Con r null suma todas las SEREMIs.
  // La meta viaja en cada fila: hay metas compartidas y diferenciadas.
  function cdc(D, r) {
    var todas = r === null || r === undefined;
    var serie = D.cdc.meses.map(function (_, k) {
      var a = 0, m = 0;
      D.cdc.sumas.forEach(function (s, i) {
        if (todas || i === r) { a += s[k][0]; m += s[k][1]; }
      });
      return m ? a / m : null;
    });
    var indicadores = D.cdc.filas.filter(function (f) { return todas || f.r === r; })
      .map(function (f) {
        return { r: f.r, indicador: D.cdc.indicadores[f.i], pond: f.pond, meta: f.meta,
                 avance: f.avance, cumpl: f.cumpl, num: f.num, den: f.den, causa: f.causa };
      });
    return {
      global: serie[serie.length - 1], serie: serie, indicadores: indicadores,
      bajo: indicadores.filter(function (f) { return f.cumpl !== null && f.cumpl < REGLAS.cdcAlerta; })
    };
  }

  function estadoCumpl(v) {
    return v < REGLAS.cdcCritico ? 'critico' : v < REGLAS.cdcAlerta ? 'alerta' : 'bueno';
  }
  function estadoCdc(c) {
    return c.global === null ? 'bueno' : estadoCumpl(c.global);
  }

  // ------------------------------------------------------------- §2.2 oficios
  // Sin plazo estándar: se mide el patrón de demora de cada SEREMI. Los días de
  // los pendientes se cuentan hasta `hoy`, no se descartan: dejar fuera lo no
  // respondido es justamente lo que esconde a la SEREMI que no contesta.
  function oficios(D, r) {
    var hoy = dia(D.hoy), dias = [], pend = [];
    D.oficios.items.forEach(function (o) {
      if (r !== null && r !== undefined && o.r !== r) return;
      if (o.respuesta) {
        dias.push(dia(o.respuesta) - dia(o.envio));
      } else {
        pend.push({ folio: o.folio, r: o.r, materia: o.materia, envio: o.envio,
                    espera: hoy - dia(o.envio) });
      }
    });
    pend.sort(function (a, b) { return b.espera - a.espera; });
    return {
      total: dias.length + pend.length,
      respondidos: dias.length,
      pendientes: pend,
      viejos: pend.filter(function (o) { return o.espera >= REGLAS.oficioViejo; }).length,
      dias: dias,
      mediana: mediana(dias),
      esperaMaxima: pend.length ? pend[0].espera : 0
    };
  }

  function estadoOficios(o) {
    if (o.esperaMaxima >= REGLAS.oficioCritico) return 'critico';
    if (o.viejos > 0) return 'alerta';
    return 'bueno';
  }

  // ------------------------------------------------------------ §2.3 catastro
  // «El análisis se orienta a medir el progreso respecto al período anterior,
  // no a establecer comparaciones entre SEREMIs» (documento §2.3). Por eso esto
  // devuelve variación propia y nunca un ranking.
  function catastro(D, r) {
    var serie = D.catastro.valores[r], u = serie.length - 1;
    return D.catastro.indicadores.map(function (ind, k) {
      var actual = serie[u][k];
      var anterior = u > 0 ? serie[u - 1][k] : null;
      return {
        indicador: ind.nombre, unidad: ind.unidad, compara: ind.compara,
        actual: actual, anterior: anterior,
        variacion: variacion(actual, anterior),
        serie: serie.map(function (t) { return t[k]; })
      };
    });
  }

  // Superficie fiscal de la SEREMI sobre la del país, en el último trimestre.
  // Es composición, no ranking: con todas las SEREMIs da 1.
  function participacion(D, r) {
    var u = D.catastro.trimestres.length - 1;
    var k = D.catastro.indicadores.map(function (i) { return i.unidad; }).indexOf('ha');
    if (k < 0) return null;
    var total = D.catastro.valores.reduce(function (a, s) { return a + s[u][k]; }, 0);
    if (!total) return null;
    return r === null || r === undefined ? 1 : D.catastro.valores[r][u][k] / total;
  }

  function estadoCatastro(filas) {
    return filas.reduce(function (e, f) {
      if (!f.compara || f.variacion === null) return e;
      return peor(e, f.variacion < REGLAS.caidaFuerte ? 'critico'
                   : f.variacion < REGLAS.caida ? 'alerta' : 'bueno');
    }, 'bueno');
  }

  // ------------------------------------------------------ §2.4a gestión Bienes
  // «Especificar qué trámites más gestiona cada región, los 4 más gestionados
  // por cada una y ver cómo avanzan respecto a ellos mismos el mes anterior».
  // El mes de corte es parcial, así que la comparación válida es entre los dos
  // últimos meses COMPLETOS; el parcial se informa aparte.
  function gestion(D, r, cuantos) {
    var ms = D.gestion.meses, cubo = D.gestion.cubo;
    var iParcial = ms.length - 1, iActual = ms.length - 2, iPrevio = ms.length - 3;
    var acum = {}, act = {}, prev = {}, parc = {};
    for (var i = 0; i < cubo.length; i += 4) {
      var m = cubo[i], reg = cubo[i + 1], t = cubo[i + 2], n = cubo[i + 3];
      if (reg !== r) continue;
      acum[t] = (acum[t] || 0) + n;
      if (m === iActual) act[t] = (act[t] || 0) + n;
      else if (m === iPrevio) prev[t] = (prev[t] || 0) + n;
      else if (m === iParcial) parc[t] = (parc[t] || 0) + n;
    }
    var filas = Object.keys(acum).map(function (t) {
      var actual = act[t] || 0, anterior = prev[t] || 0;
      return {
        tramite: D.gestion.tramites[t].nombre,
        total: acum[t], actual: actual, anterior: anterior,
        parcial: parc[t] || 0,
        variacion: variacion(actual, anterior)
      };
    });
    // Desempate por nombre: sin esto el orden depende del de las claves y dos
    // trámites empatados cambian de puesto entre recargas.
    filas.sort(function (a, b) {
      return b.total - a.total || a.tramite.localeCompare(b.tramite, 'es');
    });
    return cuantos ? filas.slice(0, cuantos) : filas;
  }

  function estadoGestion(filas) {
    return filas.reduce(function (e, f) {
      if (f.variacion === null) return e;
      return peor(e, f.variacion < REGLAS.caidaMesFuerte ? 'critico'
                   : f.variacion < REGLAS.caidaMes ? 'alerta' : 'bueno');
    }, 'bueno');
  }

  // -------------------------------------------------------- §2.4b gestión DCPR
  // El informe del DCPR publica cifras acumuladas en el año, así que la
  // variación respecto al periodo anterior es cuánto creció el acumulado desde
  // el informe previo. Un mes que el DCPR no publicó por región (null) no se
  // rellena: su variación queda en null. Con r null suma todas las SEREMIs.
  function dcpr(D, r) {
    var d = D.dcpr, u = d.meses.length - 1, t = d.tramitadas;
    function suma(tablas, k) {
      var s = 0;
      for (var j = 0; j < tablas.length; j++) {
        for (var i = 0; i < tablas[j].length; i++) {
          if (r !== null && r !== undefined && i !== r) continue;
          if (tablas[j][i][k] === null) return null;
          s += tablas[j][i][k];
        }
      }
      return s;
    }
    function kpi(tablas) {
      var actual = suma(tablas, u), anterior = u > 0 ? suma(tablas, u - 1) : null;
      return { actual: actual, anterior: anterior,
               delta: actual === null || anterior === null ? null : actual - anterior,
               variacion: variacion(actual, anterior) };
    }
    var x = {
      titulos: kpi([d.titulos.entregados]),
      porEntregar: suma([d.titulos.porEntregar], u),
      tramitadas: kpi([t.positivo, t.negativo, t.tribunales]),
      positivo: kpi([t.positivo]), negativo: kpi([t.negativo]), tribunales: kpi([t.tribunales]),
      enProceso: suma([t.enProceso], u)
    };
    // Sin avance: el acumulado no creció desde el informe anterior. En títulos
    // solo cuenta si había títulos disponibles para entregar; una SEREMI sin
    // títulos listos no tiene nada que entregar.
    x.sinAvanceTramitadas = x.tramitadas.delta !== null && x.tramitadas.delta <= 0;
    x.sinAvanceTitulos = x.titulos.delta !== null && x.titulos.delta <= 0 && x.porEntregar > 0;
    return x;
  }

  function estadoDcpr(x) {
    var n = (x.sinAvanceTramitadas ? 1 : 0) + (x.sinAvanceTitulos ? 1 : 0);
    return n === 2 ? 'critico' : n ? 'alerta' : 'bueno';
  }

  // -------------------------------------------------- §2.5 gobierno en terreno
  // Una quincena cierra el día 15 (Q1) o el último del mes (Q2). La que no ha
  // cerrado a `hoy` no cuenta como «sin reportar»: es la trampa 1 de CLAUDE.md,
  // el periodo en curso nunca entra en el semáforo.
  function finQuincena(q) {
    var a = +q.slice(0, 4), m = +q.slice(5, 7);
    return q.slice(-1) === '1' ? Date.UTC(a, m - 1, 15) / 864e5 : Date.UTC(a, m, 0) / 864e5;
  }

  function terreno(D, r) {
    var ultima = D.terreno.quincenas.length - 1, hoy = dia(D.hoy);
    var cerrada = ultima;
    while (cerrada >= 0 && finQuincena(D.terreno.quincenas[cerrada]) >= hoy) cerrada--;
    var salidas = D.terreno.salidas.filter(function (s) {
      return r === null || r === undefined || s.r === r;
    });
    var comunas = {}, actores = {}, reportadas = {};
    salidas.forEach(function (s) {
      comunas[s.comuna] = (comunas[s.comuna] || 0) + 1;
      s.actores.forEach(function (a) { actores[a] = (actores[a] || 0) + 1; });
      reportadas[s.q] = true;
    });
    var sinReportar = 0;
    for (var q = cerrada; q >= 0 && !reportadas[q]; q--) sinReportar++;
    return {
      salidas: salidas,
      comunas: comunas,
      nComunas: Object.keys(comunas).length,
      actores: actores,
      sinReportar: sinReportar,
      enCurso: cerrada < ultima,
      ultima: salidas.filter(function (s) { return s.q === ultima; })
    };
  }

  function estadoTerreno(t) {
    if (t.sinReportar > REGLAS.quincenasSinReportar) return 'critico';
    if (t.sinReportar > 0) return 'alerta';
    return 'bueno';
  }

  // -------------------------------------------------------------- semáforo
  // Una fila por SEREMI con el estado de las cinco dimensiones. Cada celda
  // compara a la SEREMI con su meta o consigo misma en el periodo anterior:
  // ninguna sale de comparar SEREMIs entre sí.
  function semaforo(D) {
    return D.regiones.map(function (reg, r) {
      var fc = cdc(D, r), fo = oficios(D, r), fk = catastro(D, r);
      var fg = gestion(D, r, 4), fd = dcpr(D, r), ft = terreno(D, r);
      var celdas = {
        cdc: estadoCdc(fc), oficios: estadoOficios(fo),
        catastro: estadoCatastro(fk), gestion: estadoGestion(fg),
        dcpr: estadoDcpr(fd), terreno: estadoTerreno(ft)
      };
      var peorEstado = 'bueno';
      Object.keys(celdas).forEach(function (k) { peorEstado = peor(peorEstado, celdas[k]); });
      return {
        r: r, codigo: reg.codigo, nombre: reg.nombre,
        celdas: celdas, peor: peorEstado,
        detalle: { cdc: fc, oficios: fo, catastro: fk, gestion: fg, dcpr: fd, terreno: ft }
      };
    });
  }

  // Las alertas que el Gabinete tiene que mirar primero, con su motivo escrito.
  // El texto sale armado de aquí porque es parte de la regla, no del dibujo: si
  // una alerta no puede explicarse en una línea, el umbral está mal puesto.
  function cl(n, d) {
    return Number(n).toLocaleString('es-CL', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function alertas(filas) {
    var out = [];
    filas.forEach(function (f) {
      var c = f.detalle.cdc;
      if (f.celdas.cdc !== 'bueno') {
        out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.cdc, dimension: 'CDC',
                   texto: 'Cumplimiento global ' + cl(c.global * 100, 1) + ' %; ' + c.bajo.length +
                          ' de ' + c.indicadores.length + ' indicadores bajo ' +
                          cl(REGLAS.cdcAlerta * 100) + ' %' });
      }
      var d = f.detalle.dcpr;
      if (d.sinAvanceTramitadas) {
        out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.dcpr, dimension: 'DCPR',
                   texto: 'Ninguna solicitud tramitada desde el informe anterior' });
      }
      if (d.sinAvanceTitulos) {
        out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.dcpr, dimension: 'DCPR',
                   texto: 'Ningún título entregado desde el informe anterior, con ' +
                          cl(d.porEntregar) + ' disponible(s) para entregar' });
      }
      if (f.detalle.oficios.viejos) {
        out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.oficios, dimension: 'Oficios',
                   texto: f.detalle.oficios.viejos + ' oficio(s) sin responder hace ' +
                          REGLAS.oficioViejo + ' días o más; el más antiguo lleva ' +
                          cl(f.detalle.oficios.esperaMaxima, 0) + ' días' });
      }
      f.detalle.catastro.forEach(function (c) {
        if (c.compara && c.variacion !== null && c.variacion < REGLAS.caida) {
          out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.catastro, dimension: 'Catastro',
                     texto: c.indicador + ' cayó ' + cl(Math.abs(c.variacion) * 100, 1) +
                            ' % respecto al trimestre anterior' });
        }
      });
      f.detalle.gestion.forEach(function (g) {
        if (g.variacion !== null && g.variacion < REGLAS.caidaMes) {
          out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.gestion, dimension: 'Bienes',
                     texto: g.tramite + ' bajó ' + cl(Math.abs(g.variacion) * 100, 1) +
                            ' % respecto al mes anterior' });
        }
      });
      if (f.detalle.terreno.sinReportar) {
        out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.terreno, dimension: 'Terreno',
                   texto: f.detalle.terreno.sinReportar + ' quincena(s) sin reportar gobierno en terreno' });
      }
    });
    var orden = { critico: 0, alerta: 1, bueno: 2 };
    out.sort(function (a, b) {
      // Desempate de norte a sur, como todo el panel: el orden alfabético
      // parecía un criterio más.
      return orden[a.estado] - orden[b.estado] || a.r - b.r;
    });
    return out;
  }

  // ------------------------------------------------------------------ mapa
  // Cortes naturales de Fisher-Jenks, copiados de DASHBOARD SUBSE/agregar.js:
  // los quintiles dejan a la Metropolitana en la misma clase que regiones muy
  // menores. Con 16 valores el cálculo exacto es instantáneo.
  function cortes(valores, k) {
    var v = valores.filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    var n = v.length, i, j, c;
    k = Math.min(k, n);
    if (k < 2) return [];
    var s = [0], s2 = [0];
    for (i = 0; i < n; i++) { s.push(s[i] + v[i]); s2.push(s2[i] + v[i] * v[i]); }
    var dispersion = function (a, b) {
      var t = s[b + 1] - s[a];
      return s2[b + 1] - s2[a] - t * t / (b - a + 1);
    };
    var costo = [[]], inicio = [[]];
    for (j = 0; j < n; j++) { costo[0][j] = dispersion(0, j); inicio[0][j] = 0; }
    for (c = 1; c < k; c++) {
      costo[c] = []; inicio[c] = [];
      for (j = c; j < n; j++) {
        costo[c][j] = Infinity;
        for (i = c; i <= j; i++) {
          var x = costo[c - 1][i - 1] + dispersion(i, j);
          if (x < costo[c][j]) { costo[c][j] = x; inicio[c][j] = i; }
        }
      }
    }
    var comienzos = [];
    for (c = k - 1, j = n - 1; c > 0; c--) { comienzos.unshift(inicio[c][j]); j = inicio[c][j] - 1; }
    return comienzos.map(function (a) { return redondo(v[a - 1], v[a]); });
  }
  // La cifra con menos dígitos significativos en [a, b): 697 y 755 dan 700.
  function redondo(a, b) {
    for (var d = 1; d < 10; d++) {
      var e = Math.pow(10, Math.floor(Math.log(b) / Math.LN10) - d + 1);
      var x = Math.ceil(a / e) * e;
      if (x < b) return x;
    }
    return a;
  }

  var api = {
    REGLAS: REGLAS, dia: dia, mediana: mediana, variacion: variacion,
    cdc: cdc, estadoCumpl: estadoCumpl, oficios: oficios, catastro: catastro,
    participacion: participacion, gestion: gestion, dcpr: dcpr, terreno: terreno,
    semaforo: semaforo, alertas: alertas, cortes: cortes
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AGG = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
