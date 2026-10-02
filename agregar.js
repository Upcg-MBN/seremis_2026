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
    // Gestión de Bienes: finalizados del año a la fecha contra el mismo tramo
    // del año anterior (no mes contra mes: con datos reales el conteo mensual
    // por trámite es demasiado ruidoso, casi toda SEREMI salía en alerta).
    // Ahora sí son datos reales (Panel-Autoridades); provisional igual,
    // porque el umbral en sí no lo fija el documento y hay que acordarlo.
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
                 metaAnual: f.metaAnual, avance: f.avance, cumpl: f.cumpl, num: f.num, den: f.den, causa: f.causa };
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
  // Cubo real de Panel-Autoridades: [mes, región, trámite, ingresados,
  // finalizados, bajas], con la semántica de su propio agregar.js:
  //   Ingresados y Finalizados son FLUJO del periodo: se suman.
  //   Stock (mochila) es SALDO: ingresados menos bajas acumulado desde el
  //   inicio de la serie (1998), nunca solo del año en curso — si se
  //   recortara al año, el stock no cuadraría con nada.
  // El año «actual» es siempre el de D.gestion.mes_parcial, así que esto no
  // hay que tocarlo cuando extraer.py traiga un mes nuevo. f = { region:
  // '13'|null, tramites: [nombre,...]|null }: tramites admite varios, null
  // o vacío = todos. porRegion respeta solo el filtro de trámites (para que
  // el gráfico muestre las 16 con la elegida resaltada, como el resto del
  // panel); porTramite respeta solo el de región.
  function bienes(D, f) {
    var g = D.gestion, ms = g.meses, cubo = g.cubo;
    var nM = ms.length, nR = D.regiones.length, nT = g.tramites.length;
    var anioActual = g.mes_parcial.slice(0, 4), mesNum = g.mes_parcial.slice(5, 7);
    var anioAnterior = String(+anioActual - 1);
    var hastaActual = ms.indexOf(g.mes_parcial), desdeActual = ms.indexOf(anioActual + '-01');
    var hastaAnterior = ms.indexOf(anioAnterior + '-' + mesNum), desdeAnterior = ms.indexOf(anioAnterior + '-01');

    // Rezago: casos que ya estaban en trámite al 31-12-2025 y que al corte
    // siguen sin resolver. El cubo no trae el caso a caso, así que no hay
    // cómo saber si una baja de 2026 cerró un caso viejo o uno nuevo del
    // mismo año: se asume que las bajas cierran primero lo más antiguo
    // (FIFO), que es la lectura habitual de un «rezago» sin seguimiento por
    // expediente. Es una cota: el stock de diciembre de 2025 menos todas las
    // bajas desde enero de 2026, nunca bajo cero. 2025-12 es una fecha fija
    // (no «el año anterior»): es el corte con que arrancó el seguimiento 2026.
    var idxBase = ms.indexOf('2025-12');
    var bajasPost = 0;

    var fr = f.region == null ? -1 : D.regiones.map(function (x) { return x.codigo; }).indexOf(f.region);
    var ft = null;
    if (f.tramites && f.tramites.length) {
      ft = {};
      f.tramites.forEach(function (nombre) {
        var j = g.tramites.map(function (x) { return x.nombre; }).indexOf(nombre);
        if (j >= 0) ft[j] = true;
      });
    }

    var netoTotal = new Float64Array(nM), netoPorTramite = [], netoPorRegion = [];
    for (var t = 0; t < nT; t++) netoPorTramite.push(new Float64Array(nM));
    for (var r = 0; r < nR; r++) netoPorRegion.push(new Float64Array(nM));
    var ingA = 0, finA = 0, ingP = 0, finP = 0;
    var tIngA = new Float64Array(nT), tFinA = new Float64Array(nT);
    var tIngP = new Float64Array(nT), tFinP = new Float64Array(nT);
    var rIngA = new Float64Array(nR), rFinA = new Float64Array(nR);
    var rIngP = new Float64Array(nR), rFinP = new Float64Array(nR);
    var tBajasPost = new Float64Array(nT);   // bajas posteriores a idxBase, por trámite (respeta solo región)

    for (var i = 0; i < cubo.length; i += 6) {
      var m = cubo[i], reg = cubo[i + 1], tr = cubo[i + 2];
      var ing = cubo[i + 3], fin = cubo[i + 4], baja = cubo[i + 5], n = ing - baja;
      var okT = !ft || ft[tr] === true, okR = fr === -1 || reg === fr;
      if (okT) netoPorRegion[reg][m] += n;
      if (okR) netoPorTramite[tr][m] += n;
      if (okT && okR) netoTotal[m] += n;

      var enActual = m >= desdeActual && m <= hastaActual;
      var enAnterior = hastaAnterior >= 0 && m >= desdeAnterior && m <= hastaAnterior;
      if (okT && okR && enActual) { ingA += ing; finA += fin; }
      if (okT && okR && enAnterior) { ingP += ing; finP += fin; }
      if (okR && enActual) { tIngA[tr] += ing; tFinA[tr] += fin; }
      if (okR && enAnterior) { tIngP[tr] += ing; tFinP[tr] += fin; }
      if (okT && enActual) { rIngA[reg] += ing; rFinA[reg] += fin; }
      if (okT && enAnterior) { rIngP[reg] += ing; rFinP[reg] += fin; }
      if (idxBase >= 0 && m > idxBase && m <= hastaActual) {
        if (okT && okR) bajasPost += baja;
        if (okR) tBajasPost[tr] += baja;
      }
    }

    function acumHasta(serie, hasta) {
      var s = 0;
      for (var k = 0; k <= hasta; k++) s += serie[k];
      return s;
    }
    function medida(actual, anterior) {
      return { actual: actual, anterior: anterior, variacion: variacion(actual, anterior) };
    }

    var stockBase = idxBase >= 0 ? acumHasta(netoTotal, idxBase) : null;
    var rezago = stockBase === null ? null : Math.max(0, stockBase - bajasPost);

    return {
      anioActual: anioActual, anioAnterior: anioAnterior,
      corte: g.mes_parcial, corteAnterior: hastaAnterior >= 0 ? ms[hastaAnterior] : null,
      kpi: {
        ing: medida(ingA, ingP), fin: medida(finA, finP),
        moc: medida(acumHasta(netoTotal, hastaActual), hastaAnterior >= 0 ? acumHasta(netoTotal, hastaAnterior) : null),
        rezago: { actual: rezago, base: stockBase }
      },
      porTramite: g.tramites.map(function (x, j) {
        var baseT = idxBase >= 0 ? acumHasta(netoPorTramite[j], idxBase) : null;
        return {
          nombre: x.nombre, ing: medida(tIngA[j], tIngP[j]), fin: medida(tFinA[j], tFinP[j]),
          moc: medida(acumHasta(netoPorTramite[j], hastaActual),
                      hastaAnterior >= 0 ? acumHasta(netoPorTramite[j], hastaAnterior) : null),
          rezago: { actual: baseT === null ? null : Math.max(0, baseT - tBajasPost[j]), base: baseT }
        };
      }).filter(function (x, j) { return !ft || ft[j]; }),
      porRegion: D.regiones.map(function (x, j) {
        return {
          codigo: x.codigo, nombre: x.nombre, ing: medida(rIngA[j], rIngP[j]), fin: medida(rFinA[j], rFinP[j]),
          moc: medida(acumHasta(netoPorRegion[j], hastaActual),
                      hastaAnterior >= 0 ? acumHasta(netoPorRegion[j], hastaAnterior) : null)
        };
      })
    };
  }

  // Estado de la SEREMI: finalizados del año a la fecha contra el mismo tramo
  // del año anterior, con todos los trámites de D.gestion.tramites siempre
  // completos (el filtro de trámites de la página es solo para mirar, no
  // cambia el semáforo). Se usa
  // finalizados y no el stock porque un stock que sube es ambiguo (puede ser
  // más ingreso, que es bueno) mientras que menos finalizados que el año
  // pasado es una señal más directa de que se está gestionando menos.
  function estadoGestion(x) {
    var v = x.kpi.fin.variacion;
    if (v === null) return 'bueno';
    return v < REGLAS.caidaMesFuerte ? 'critico' : v < REGLAS.caidaMes ? 'alerta' : 'bueno';
  }

  // ---------------------------------------------------------- presupuesto CDC
  // Sección aparte, fuera de las cinco dimensiones del documento y del
  // semáforo: el Panel Presupuestario solo publica el corte vigente, sin
  // serie mensual, así que aquí no hay variación contra el periodo anterior
  // ni estado de alerta que acordar con Gabinete. Con r null suma las 16.
  function presupuesto(D, r) {
    var todas = r === null || r === undefined;
    var filas = D.presupuesto.filas.filter(function (f) { return todas || f.r === r; });
    var budget = filas.reduce(function (a, f) { return a + f.presupuesto; }, 0);
    var dev = filas.reduce(function (a, f) { return a + f.devengado; }, 0);
    var enMeta = filas.filter(function (f) { return f.pct >= f.meta; }).length;
    return {
      budget: budget, dev: dev, pct: budget ? dev / budget : null,
      enMeta: enMeta, total: filas.length, filas: filas
    };
  }

  // --------------------------------------------------------- gestión de Convenios
  // Aparte de las cinco dimensiones del documento, igual que Presupuesto: no
  // hay serie mensual, es una foto del estado de los convenios a la fecha de
  // la planilla. Dos filtros propios de la página, región (f.region, mismo
  // código que usa el resto del panel) y materia (f.materias, lista de
  // nombres, mismo patrón que f.tramites en Gestión de Bienes): ambos se
  // aplican a las dos hojas por igual. «Convenios vigentes» y su monto salen
  // solo de «Convenios FT» con Estado = Vigente; «Convenios en trámite» es el
  // total de filas de la hoja «En trámite» tras el filtro.
  function convenios(D, f) {
    var c = D.convenios;
    var fr = f.region == null ? -1 : D.regiones.map(function (x) { return x.codigo; }).indexOf(f.region);
    var fm = null;
    if (f.materias && f.materias.length) {
      fm = {};
      f.materias.forEach(function (nombre) {
        var j = c.materias.indexOf(nombre);
        if (j >= 0) fm[j] = true;
      });
    }
    function pasa(fila) {
      return (fr === -1 || fila.r === fr) && (!fm || fm[fila.materia] === true);
    }
    var ft = c.ft.filter(pasa);
    var tramite = c.tramite.filter(pasa);
    var ftVigentes = ft.filter(function (x) { return x.vigente; });
    var montoVigentes = ftVigentes.reduce(function (a, x) { return a + (x.monto || 0); }, 0);
    return {
      corte: c.corte, materias: c.materias,
      kpi: { vigentes: ftVigentes.length, monto: montoVigentes, tramite: tramite.length },
      ft: ft, ftVigentes: ftVigentes, tramite: tramite
    };
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

  // --------------------------------------- Gestión Regularización («Flujos»)
  // extraer.py ya entrega cada campo acumulado por región, año a la fecha
  // contra el mismo tramo del año anterior — salvo «proceso», que es una foto
  // al corte (casos abiertos), no algo que tenga sentido sumar mes a mes dos
  // veces. Con r null suma las 16 SEREMIs; si alguna fila no tiene anterior
  // (fuente sin ese mes el año pasado), la variación del total queda null en
  // vez de una cifra a medias.
  function regularizacion(D, r) {
    var filas = D.regularizacion.filas;
    var todas = r === null || r === undefined;
    function medida(campo) {
      var actual = 0, anterior = 0, hayAnterior = true;
      filas.forEach(function (f) {
        if (!todas && f.r !== r) return;
        actual += f[campo].actual;
        if (f[campo].anterior === null) hayAnterior = false;
        else anterior += f[campo].anterior;
      });
      return { actual: actual, anterior: hayAnterior ? anterior : null,
               variacion: hayAnterior ? variacion(actual, anterior) : null };
    }
    return {
      cbr: medida('cbr'), proceso: medida('proceso'),
      positivas: medida('positivas'), negativas: medida('negativas'),
      resA: medida('resA'), resB: medida('resB'), resC: medida('resC')
    };
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
      var fg = bienes(D, { region: reg.codigo, tramites: null }), fd = dcpr(D, r), ft = terreno(D, r);
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
      // Catastro no genera alertas: sigue con datos de ejemplo y sin umbral
      // acordado con Gabinete (ver Resumen, tabla «Estado por SEREMI y
      // dimensión», donde va marcado «informativo»). `celdas.catastro` se
      // sigue calculando (lo usa `peor`), solo no alimenta esta lista.
      f.detalle.gestion.porTramite.forEach(function (g) {
        if (g.fin.variacion !== null && g.fin.variacion < REGLAS.caidaMes) {
          out.push({ r: f.r, seremi: f.nombre, estado: f.celdas.gestion, dimension: 'Bienes',
                     texto: g.nombre + ': finalizados bajaron ' + cl(Math.abs(g.fin.variacion) * 100, 1) +
                            ' % respecto al mismo periodo de ' + f.detalle.gestion.anioAnterior });
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
    participacion: participacion, bienes: bienes, dcpr: dcpr, terreno: terreno,
    presupuesto: presupuesto, regularizacion: regularizacion, convenios: convenios,
    semaforo: semaforo, alertas: alertas, cortes: cortes
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AGG = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
