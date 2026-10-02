// node prueba.js
//
// Dos capas, como en DASHBOARD SUBSE: primero un modelo en miniatura hecho a
// mano, donde las cifras correctas se saben de memoria y las reglas que fallan
// en silencio quedan fijadas; después el datos.js real, para comprobar que el
// payload que escribe extraer.py es el que agregar.js sabe leer.
var assert = require('assert');
var AGG = require('./agregar.js');

var n = 0;
function prueba(nombre, fn) { fn(); n++; console.log('  ok  ' + nombre); }

// ---------------------------------------------------------------- miniatura
// Dos SEREMIs, tres meses de gestión (el último parcial), dos trimestres.
var M = {
  corte: '2026-03', hoy: '2026-03-31', generado: '2026-03-31T08:00:00',
  regiones: [{ codigo: '15', nombre: 'Arica y Parinacota' }, { codigo: '12', nombre: 'Magallanes' }],
  cdc: {
    meses: ['2026-07', '2026-08'],
    indicadores: ['A', 'B'],
    // [Σ contrib. cumplimiento, Σ contrib. meta] por SEREMI y mes
    sumas: [[[0.5, 1], [0.6, 1]],        // 60 %: crítico
            [[0.9, 1], [0.95, 1]]],      // 95 %: al día
    // meta: la meta YA prorrateada al periodo (lo que usa el cumplimiento);
    // metaAnual: la meta del año completo, tal cual la trae DIPLAP.
    filas: [
      { r: 0, i: 0, pond: 0.5, meta: 0.8, metaAnual: 0.95, avance: 0.88, cumpl: 1.1 },
      { r: 0, i: 1, pond: 0.5, meta: 0.8, metaAnual: 0.95, avance: 0.32, cumpl: 0.4 },
      { r: 1, i: 0, pond: 0.5, meta: 0.9, metaAnual: 0.9, avance: 0.855, cumpl: 0.95 },
      { r: 1, i: 1, pond: 0.5, meta: 0.9, metaAnual: 0.9, avance: 0.8, cumpl: 0.89 }
    ]
  },
  dcpr: {
    meses: ['2026-06', '2026-07', '2026-08'],
    titulos: { entregados: [[10, 12, 12], [5, 5, 5]], porEntregar: [[3, 3, 3], [0, 0, 0]] },
    // junio no trae el detalle por región: null, no cero
    tramitadas: { positivo: [[null, 4, 6], [null, 1, 1]], negativo: [[null, 2, 2], [null, 0, 0]],
                  tribunales: [[null, 0, 1], [null, 0, 0]], enProceso: [[null, 9, 8], [null, 2, 2]] }
  },
  oficios: {
    items: [
      { r: 0, folio: 'A', envio: '2026-03-01', materia: 'x', respuesta: '2026-03-11' },  // 10 d
      { r: 0, folio: 'B', envio: '2026-03-01', materia: 'x', respuesta: '2026-03-05' },  //  4 d
      { r: 0, folio: 'C', envio: '2026-03-20', materia: 'x', respuesta: null },          // 11 d esperando
      { r: 1, folio: 'D', envio: '2026-01-01', materia: 'x', respuesta: null }           // 89 d esperando
    ]
  },
  catastro: {
    trimestres: ['2025-T4', '2026-T1'],
    indicadores: [{ nombre: 'Sube', unidad: 'N°', compara: true },
                  { nombre: 'Baja', unidad: 'N°', compara: true },
                  { nombre: 'Superficie', unidad: 'ha', compara: false }],
    valores: [[[100, 100, 300], [110, 50, 300]],     // +10 % y −50 %
              [[100, 100, 100], [100, 100, 50]]]     // la superficie cae, pero no compara
  },
  // 15 meses, de 2025-01 (índice 0) a 2026-03 (índice 14, el parcial). El año
  // «actual» es 2026 (solo enero a marzo, índices 12-14); el «anterior» es el
  // mismo tramo de 2025 (índices 0-2). Región 1 (Magallanes) no tiene fila de
  // «Uno» en el periodo anterior: variación null, no un error.
  gestion: {
    meses: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
             '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
             '2026-01', '2026-02', '2026-03'],
    mes_parcial: '2026-03',
    tramites: [{ nombre: 'Uno' }, { nombre: 'Dos' }],
    cubo: [
      // mes, región, trámite, ingresados, finalizados, bajas
      0, 0, 0, 10, 6, 4,     // Uno, Arica,      2025-01 (año anterior; neto +6)
      6, 0, 0, 15, 5, 5,     // Uno, Arica,      2025-07 (antes del 31-12; neto +10, para el rezago)
      12, 0, 0, 20, 12, 8,   // Uno, Arica,      2026-01 (año actual)
      12, 0, 1, 5, 1, 1,     // Dos, Arica,      2026-01 (año actual)
      12, 1, 0, 3, 3, 3,     // Uno, Magallanes, 2026-01 (año actual)
      0, 1, 1, 5, 10, 10,    // Dos, Magallanes, 2025-01 (año anterior)
      12, 1, 1, 1, 2, 2      // Dos, Magallanes, 2026-01 (año actual)
    ]
  },
  terreno: {
    // hoy es 31-03: la 2ª quincena de marzo todavía no cierra
    quincenas: ['2026-02-Q2', '2026-03-Q1', '2026-03-Q2'],
    salidas: [
      { r: 0, q: 1, comuna: 'Arica', actores: ['Alcalde'], temas: 't' },
      { r: 0, q: 2, comuna: 'Putre', actores: ['Alcalde', 'Gremio'], temas: 't' },
      { r: 1, q: 0, comuna: 'Punta Arenas', actores: ['Delegado Presidencial'], temas: 't' }
    ]
  },
  presupuesto: {
    corte: '2026-08',
    filas: [
      { r: 0, presupuesto: 100, devengado: 70, pct: 0.7, meta: 0.65 },    // cumple
      { r: 1, presupuesto: 200, devengado: 90, pct: 0.45, meta: 0.65 }    // no cumple
    ]
  },
  regularizacion: {
    corteResol: '2026-08', corteResolAnterior: '2025-08',
    corteProceso: '2026-07', corteProcesoAnterior: '2025-07',
    corteCbr: '2026-08', corteCbrAnterior: '2025-08',
    filas: [
      { r: 0,
        cbr: { actual: 20, anterior: 15 },
        proceso: { actual: 500, anterior: 480 },
        positivas: { actual: 30, anterior: 25 }, negativas: { actual: 10, anterior: 8 },
        resA: { actual: 25, anterior: 20 }, resB: { actual: 10, anterior: 8 }, resC: { actual: 5, anterior: 5 } },
      { r: 1,
        cbr: { actual: 5, anterior: 10 },
        proceso: { actual: 200, anterior: 220 },
        positivas: { actual: 12, anterior: 10 }, negativas: { actual: 4, anterior: null },  // año anterior sin dato SOLO acá
        resA: { actual: 8, anterior: 9 }, resB: { actual: 5, anterior: 4 }, resC: { actual: 3, anterior: 3 } }
    ]
  },
  // Foto sin serie mensual, como presupuesto. Materias: 0 Propiedad fiscal,
  // 1 Regularización, 2 Mixto, 3 Otro. Conv B (no vigente) prueba que
  // «vigentes» y su monto NO suman convenios vencidos.
  convenios: {
    corte: '2026-08-31',
    materias: ['Propiedad fiscal', 'Regularización', 'Mixto', 'Otro'],
    ft: [
      { r: 0, materia: 1, nombre: 'Conv A', inicio: '2020-01-01', fin: '2026-12-31',
        tipoOtorgante: 'GORE', entidadOtorgante: 'Gobierno Regional Arica', monto: 1000, vigente: true },
      { r: 0, materia: 0, nombre: 'Conv B', inicio: '2018-01-01', fin: '2024-12-31',
        tipoOtorgante: 'CONADI', entidadOtorgante: 'CONADI', monto: 500, vigente: false },
      { r: 1, materia: 1, nombre: 'Conv C', inicio: '2021-01-01', fin: '2027-12-31',
        tipoOtorgante: 'GORE', entidadOtorgante: 'Gobierno Regional Magallanes', monto: 2000, vigente: true }
    ],
    tramite: [
      { r: 0, materia: 1, nombre: 'Trm A', organismoExterno: 'IM Arica', monto: 300 },
      { r: 1, materia: 2, nombre: 'Trm B', organismoExterno: 'IM Natales', monto: 0 }
    ]
  }
};

prueba('dia() resta en UTC, sin corrimiento por huso', function () {
  assert.strictEqual(AGG.dia('2026-03-11') - AGG.dia('2026-03-01'), 10);
  assert.strictEqual(AGG.dia('2026-01-01') - AGG.dia('2025-12-31'), 1);
});

prueba('mediana() con largo par promedia los dos del medio', function () {
  assert.strictEqual(AGG.mediana([1, 2, 3, 4]), 2.5);
  assert.strictEqual(AGG.mediana([3, 1, 2]), 2);
  assert.strictEqual(AGG.mediana([]), null);
});

prueba('variacion() devuelve null si la base es cero, no +Infinity', function () {
  assert.strictEqual(AGG.variacion(5, 0), null);
  assert.strictEqual(AGG.variacion(5, null), null);
  assert.strictEqual(AGG.variacion(110, 100), 0.1);
});

prueba('CDC global = Σ contrib. cumplimiento ÷ Σ contrib. meta, como DIPLAP', function () {
  var c = AGG.cdc(M, 0);
  assert.ok(Math.abs(c.global - 0.6) < 1e-9);
  assert.deepStrictEqual(c.serie.map(function (v) { return +v.toFixed(4); }), [0.5, 0.6]);
  // Con todas: se suman contribuciones, no se promedian porcentajes.
  assert.ok(Math.abs(AGG.cdc(M, null).global - 1.55 / 2) < 1e-9);
});

prueba('CDC lista los indicadores bajo 90 % aunque el global esté al día', function () {
  assert.deepStrictEqual(AGG.cdc(M, 0).bajo.map(function (f) { return f.indicador; }), ['B']);
  var c1 = AGG.cdc(M, 1);
  assert.strictEqual(AGG.estadoCumpl(c1.global), 'bueno');
  assert.deepStrictEqual(c1.bajo.map(function (f) { return f.cumpl; }), [0.89]);
});

prueba('CDC: metaAnual viaja junto a meta (al periodo), no se mezclan', function () {
  var f = AGG.cdc(M, 0).indicadores[0];
  assert.strictEqual(f.meta, 0.8);
  assert.strictEqual(f.metaAnual, 0.95);
});

prueba('DCPR: la variación es cuánto creció el acumulado desde el informe anterior', function () {
  var d = AGG.dcpr(M, null);
  assert.strictEqual(d.tramitadas.actual, 10);     // 6+2+1 + 1+0+0; «en proceso» no cuenta
  assert.strictEqual(d.tramitadas.anterior, 7);
  assert.strictEqual(d.tramitadas.delta, 3);
  assert.strictEqual(d.titulos.delta, 0);
  assert.strictEqual(d.enProceso, 10);
});

prueba('DCPR: un mes sin detalle por región queda null, no cero', function () {
  var sinJulio = JSON.parse(JSON.stringify(M));
  sinJulio.dcpr.meses.pop();                        // el «anterior» pasa a ser junio
  Object.keys(sinJulio.dcpr.tramitadas).forEach(function (k) {
    sinJulio.dcpr.tramitadas[k].forEach(function (f) { f.pop(); });
  });
  ['entregados', 'porEntregar'].forEach(function (k) {
    sinJulio.dcpr.titulos[k].forEach(function (f) { f.pop(); });
  });
  var d = AGG.dcpr(sinJulio, 0);
  assert.strictEqual(d.tramitadas.anterior, null);
  assert.strictEqual(d.tramitadas.delta, null);
  assert.strictEqual(d.sinAvanceTramitadas, false); // sin base no hay alerta
  assert.strictEqual(d.titulos.delta, 2);           // títulos sí vienen en junio
});

prueba('DCPR: sin títulos entregados solo alerta si había títulos por entregar', function () {
  var d0 = AGG.dcpr(M, 0), d1 = AGG.dcpr(M, 1);
  assert.strictEqual(d0.sinAvanceTitulos, true);    // 3 disponibles, ninguno entregado
  assert.strictEqual(d1.sinAvanceTitulos, false);   // 0 disponibles
  assert.strictEqual(d1.sinAvanceTramitadas, true); // 1 -> 1
});

prueba('catastro: la superficie regional se lee como parte del total nacional', function () {
  assert.ok(Math.abs(AGG.participacion(M, 0) - 300 / 350) < 1e-9);
  assert.strictEqual(AGG.participacion(M, null), 1);
});

prueba('los oficios pendientes cuentan su espera hasta hoy y NO se descartan', function () {
  var o = AGG.oficios(M, 0);
  assert.strictEqual(o.total, 3);
  assert.strictEqual(o.respondidos, 2);
  assert.strictEqual(o.pendientes.length, 1);
  assert.strictEqual(o.mediana, 7);               // (4 + 10) / 2
  assert.strictEqual(o.esperaMaxima, 11);         // 20-03 a 31-03
  assert.strictEqual(o.viejos, 0);                // 11 < 30
  var o1 = AGG.oficios(M, 1);
  assert.strictEqual(o1.mediana, null);           // ninguno respondido
  assert.strictEqual(o1.esperaMaxima, 89);
  assert.strictEqual(o1.viejos, 1);
});

prueba('catastro compara cada SEREMI con su trimestre anterior', function () {
  var c = AGG.catastro(M, 0);
  assert.ok(Math.abs(c[0].variacion - 0.1) < 1e-9);
  assert.ok(Math.abs(c[1].variacion + 0.5) < 1e-9);
  assert.deepStrictEqual(c[0].serie, [100, 110]);
  assert.strictEqual(AGG.catastro(M, 1)[0].variacion, 0);
});

prueba('gestión de Bienes: ingresados/finalizados del año a la fecha contra el mismo tramo del año anterior', function () {
  var x = AGG.bienes(M, { region: null, tramites: ['Uno'] });
  assert.strictEqual(x.anioActual, '2026');
  assert.strictEqual(x.anioAnterior, '2025');
  assert.strictEqual(x.kpi.ing.actual, 23);       // Arica 20 + Magallanes 3, año actual
  assert.strictEqual(x.kpi.ing.anterior, 10);     // solo Arica tiene fila anterior
  assert.ok(Math.abs(x.kpi.ing.variacion - 1.3) < 1e-9);
  assert.strictEqual(x.kpi.fin.actual, 15);
  assert.strictEqual(x.kpi.fin.anterior, 6);
});

prueba('gestión de Bienes: el stock es un acumulado desde el inicio, no solo del año elegido', function () {
  var x = AGG.bienes(M, { region: null, tramites: ['Uno'] });
  // Arica: el neto es ingresados-BAJAS, no ingresados-finalizados:
  // 2025-01 neto 10-4=6; 2025-07 neto 15-5=10; 2026-01 neto 20-8=12.
  // Magallanes 2026-01 neto 3-3=0.
  assert.strictEqual(x.kpi.moc.actual, 28);       // 6 + 10 + 12 + 0, acumulado hasta 2026-03
  assert.strictEqual(x.kpi.moc.anterior, 6);      // solo lo acumulado hasta 2025-03
});

prueba('gestión de Bienes: rezago es el stock a dic-2025 menos las bajas posteriores, nunca bajo cero', function () {
  var x = AGG.bienes(M, { region: null, tramites: ['Uno'] });
  // Stock a 2025-12 (antes del año actual): 6 (2025-01) + 10 (2025-07) = 16.
  // Bajas desde 2026-01 al corte: 8 (Arica) + 3 (Magallanes) = 11.
  assert.strictEqual(x.kpi.rezago.base, 16);
  assert.strictEqual(x.kpi.rezago.actual, 5);     // 16 - 11

  // Con más bajas que rezago disponible, no debe dar negativo.
  var soloMagallanes = AGG.bienes(M, { region: '12', tramites: ['Uno'] });
  assert.strictEqual(soloMagallanes.kpi.rezago.base, 0);   // sin movimientos antes de 2026
  assert.strictEqual(soloMagallanes.kpi.rezago.actual, 0); // max(0, 0 - 3), no -3
});

prueba('gestión de Bienes: el rezago también se calcula por trámite, no solo el total', function () {
  var x = AGG.bienes(M, { region: null, tramites: null });   // todos los trámites, todas las regiones
  var uno = x.porTramite.filter(function (t) { return t.nombre === 'Uno'; })[0];
  var dos = x.porTramite.filter(function (t) { return t.nombre === 'Dos'; })[0];
  assert.strictEqual(uno.rezago.base, 16);     // igual que el total filtrado a «Uno» solo
  assert.strictEqual(uno.rezago.actual, 5);
  // «Dos» en Magallanes: 2025-01 neto 5-10=-5 (dic-2025: -5, nunca bajo 0 en el total,
  // pero aquí se mira antes del max del total) + Arica no tiene «Dos» antes de dic-2025.
  assert.strictEqual(dos.rezago.base, -5);
  assert.strictEqual(dos.rezago.actual, 0);    // max(0, -5 - bajas) sigue en 0
});

prueba('gestión de Bienes: el filtro de trámites recorta porTramite y los totales', function () {
  var x = AGG.bienes(M, { region: '15', tramites: null });
  assert.strictEqual(x.porTramite.length, 2);
  var uno = x.porTramite.filter(function (t) { return t.nombre === 'Uno'; })[0];
  var dos = x.porTramite.filter(function (t) { return t.nombre === 'Dos'; })[0];
  assert.strictEqual(uno.ing.actual, 20);
  assert.strictEqual(dos.ing.actual, 5);
  assert.strictEqual(dos.ing.anterior, 0);
  assert.strictEqual(dos.ing.variacion, null);    // sin base el año anterior: null, no +Infinity

  var soloUno = AGG.bienes(M, { region: '15', tramites: ['Uno'] });
  assert.strictEqual(soloUno.porTramite.length, 1);
  assert.strictEqual(soloUno.kpi.ing.actual, 20); // ya no suma el «Dos»
});

prueba('gestión de Bienes: porRegion respeta solo el filtro de trámites, nunca el de región', function () {
  var x = AGG.bienes(M, { region: '15', tramites: null });   // filtrado a Arica
  assert.strictEqual(x.porRegion.length, 2);                 // las 2 igual salen
  var magallanes = x.porRegion.filter(function (r) { return r.codigo === '12'; })[0];
  assert.strictEqual(magallanes.ing.actual, 4);              // 3 (Uno) + 1 (Dos)
});

prueba('terreno cuenta quincenas sin reportar desde la última CERRADA hacia atrás', function () {
  assert.strictEqual(AGG.terreno(M, 0).sinReportar, 0);
  assert.strictEqual(AGG.terreno(M, 1).sinReportar, 1);   // no reportó la 1ª de marzo
  assert.strictEqual(AGG.terreno(M, 0).nComunas, 2);
});

prueba('terreno: la quincena en curso no cuenta como sin reportar', function () {
  var sinPutre = JSON.parse(JSON.stringify(M));
  sinPutre.terreno.salidas = sinPutre.terreno.salidas.filter(function (s) { return s.q !== 2; });
  var t = AGG.terreno(sinPutre, 0);
  assert.strictEqual(t.enCurso, true);
  assert.strictEqual(t.sinReportar, 0);           // la 2ª de marzo cierra hoy, no antes
});

prueba('el semáforo toma el peor estado de cada dimensión', function () {
  var s = AGG.semaforo(M);
  assert.strictEqual(s.length, 2);
  assert.strictEqual(s[0].celdas.cdc, 'critico');        // 60 % global
  assert.strictEqual(s[0].celdas.catastro, 'critico');   // −50 %
  assert.strictEqual(s[0].celdas.dcpr, 'alerta');        // títulos detenidos
  assert.strictEqual(s[0].celdas.terreno, 'bueno');
  assert.strictEqual(s[0].peor, 'critico');
  assert.strictEqual(s[1].celdas.cdc, 'bueno');          // 95 %, aunque un indicador esté en 89 %
  assert.strictEqual(s[1].celdas.catastro, 'bueno');     // la superficie cayó, pero no compara
  assert.strictEqual(s[1].celdas.oficios, 'critico');    // 89 días de espera
  assert.strictEqual(s[1].celdas.terreno, 'alerta');
  assert.strictEqual(s[0].celdas.gestion, 'bueno');       // finalizados subieron vs 2025
  assert.strictEqual(s[1].celdas.gestion, 'critico');     // finalizados cayeron 50 % vs 2025
});

prueba('catastro no genera alertas (sigue con datos de ejemplo, sin umbral acordado)', function () {
  // Arica (r=0) cae 50 % en «Sube», que de por sí dispara alerta crítica por
  // REGLAS.caidaFuerte: la celda del semáforo SÍ queda en «critico» (se sigue
  // calculando), pero no debe aparecer como alerta en la lista.
  assert.strictEqual(AGG.semaforo(M)[0].celdas.catastro, 'critico');
  var a = AGG.alertas(AGG.semaforo(M));
  assert.ok(a.every(function (x) { return x.dimension !== 'Catastro'; }), 'catastro no debe generar alertas');
});

prueba('cada alerta trae su motivo escrito, las críticas primero y luego norte a sur', function () {
  var a = AGG.alertas(AGG.semaforo(M));
  assert.ok(a.length >= 4);
  assert.strictEqual(a[0].estado, 'critico');
  for (var i = 1; i < a.length; i++) {
    if (a[i].estado === a[i - 1].estado) assert.ok(a[i].r >= a[i - 1].r, 'desempate fuera del orden norte a sur');
  }
  a.forEach(function (x) {
    assert.ok(x.texto && x.texto.length > 10, 'alerta sin motivo: ' + JSON.stringify(x));
    assert.ok(x.seremi && x.dimension);
  });
});

prueba('presupuesto: con todas suma montos y cuenta regiones en meta', function () {
  var x = AGG.presupuesto(M, null);
  assert.strictEqual(x.budget, 300);
  assert.strictEqual(x.dev, 160);
  assert.ok(Math.abs(x.pct - 160 / 300) < 1e-9);
  assert.strictEqual(x.enMeta, 1);      // solo Arica y Parinacota cumple su meta
  assert.strictEqual(x.total, 2);
});

prueba('presupuesto: filtrado por SEREMI trae solo su propia fila', function () {
  var x0 = AGG.presupuesto(M, 0), x1 = AGG.presupuesto(M, 1);
  assert.strictEqual(x0.budget, 100);
  assert.strictEqual(x0.enMeta, 1);
  assert.strictEqual(x1.enMeta, 0);     // 45 % < 65 % de meta
});

prueba('regularización: con todas suma los campos y respeta el año anterior null', function () {
  var y = AGG.regularizacion(M, null);
  assert.strictEqual(y.cbr.actual, 25);
  assert.strictEqual(y.cbr.anterior, 25);
  assert.strictEqual(y.proceso.actual, 700);
  assert.strictEqual(y.proceso.anterior, 700);
  assert.strictEqual(y.positivas.actual, 42);
  assert.strictEqual(y.positivas.anterior, 35);
});

prueba('regularización: si UNA SEREMI no trae año anterior, el total queda null (no a medias)', function () {
  var y = AGG.regularizacion(M, null);
  // región 1 no trae año anterior de negativas; aunque la región 0 sí, el
  // total no puede ser una suma a medias que parezca una cifra real.
  assert.strictEqual(y.negativas.actual, 14);
  assert.strictEqual(y.negativas.anterior, null);
  assert.strictEqual(y.negativas.variacion, null);
});

prueba('regularización: filtrado por SEREMI trae solo su propia fila, con su propio A+B+C', function () {
  var y0 = AGG.regularizacion(M, 0);
  assert.strictEqual(y0.resA.actual, 25);
  assert.strictEqual(y0.resB.actual, 10);
  assert.strictEqual(y0.resC.actual, 5);
  assert.ok(Math.abs(y0.positivas.variacion - (30 - 25) / 25) < 1e-9);
});

prueba('convenios: con todas cuenta solo vigentes y suma su monto, no el de los vencidos', function () {
  var x = AGG.convenios(M, { region: null, materias: null });
  assert.strictEqual(x.ft.length, 3);
  assert.strictEqual(x.kpi.vigentes, 2);           // Conv A y Conv C; Conv B no está vigente
  assert.strictEqual(x.kpi.monto, 3000);           // 1000 + 2000, sin el 500 de Conv B
  assert.strictEqual(x.kpi.tramite, 2);
});

prueba('convenios: filtrado por SEREMI trae solo sus propias filas en ambas hojas', function () {
  var x = AGG.convenios(M, { region: '15', materias: null });
  assert.strictEqual(x.ft.length, 2);              // Conv A y Conv B, ambas de Arica
  assert.strictEqual(x.kpi.vigentes, 1);           // solo Conv A
  assert.strictEqual(x.kpi.monto, 1000);
  assert.strictEqual(x.kpi.tramite, 1);            // solo Trm A
});

prueba('convenios: filtrado por Materia recorta las dos hojas por igual', function () {
  var x = AGG.convenios(M, { region: null, materias: ['Regularización'] });
  assert.strictEqual(x.ft.length, 2);              // Conv A y Conv C (Conv B es Propiedad fiscal)
  assert.strictEqual(x.kpi.vigentes, 2);
  assert.strictEqual(x.kpi.monto, 3000);
  assert.strictEqual(x.kpi.tramite, 1);            // Trm A (Regularización); Trm B es Mixto
});

prueba('cortes() separa un valor muy grande en vez de repartir por cuantiles', function () {
  var c = AGG.cortes([1, 2, 3, 4, 5, 100], 3);
  assert.strictEqual(c.length, 2);
  assert.ok(c[c.length - 1] < 100, 'el máximo debe quedar solo en la última clase');
});

// ------------------------------------------------------------- datos.js real
var fs = require('fs');
if (!fs.existsSync(__dirname + '/datos.js')) {
  console.log('\n  (datos.js no existe: corre `python extraer.py` primero)');
} else {
  global.window = {};
  require('./datos.js');
  var D = global.window.DATOS;

  prueba('datos.js: 16 SEREMIs, sin códigos repetidos', function () {
    assert.strictEqual(D.regiones.length, 16);
    var cods = D.regiones.map(function (r) { return r.codigo; });
    assert.strictEqual(new Set(cods).size, 16);
  });

  prueba('datos.js: están los siete bloques y cada uno declara su origen', function () {
    ['cdc', 'oficios', 'catastro', 'gestion', 'dcpr', 'terreno', 'convenios'].forEach(function (k) {
      assert.ok(D[k], 'falta el bloque ' + k);
      assert.ok(D[k].origen, k + ' sin origen: el panel no sabría si marcarlo como ejemplo');
    });
    assert.strictEqual(D.cdc.origen, 'diplap');
    assert.strictEqual(D.dcpr.origen, 'dcpr');
    assert.strictEqual(D.gestion.origen, 'panel-autoridades');
    assert.strictEqual(D.convenios.origen, 'excel-local');
    assert.ok(D.generado && D.corte && D.hoy);
  });

  prueba('datos.js: CDC y DCPR comparan con un informe anterior real', function () {
    assert.ok(AGG.cdc(D, null).global > 0);
    var d = AGG.dcpr(D, null);
    assert.ok(d.titulos.delta !== null && d.tramitadas.delta !== null,
              'el último informe DCPR no tiene uno anterior con qué comparar');
  });

  prueba('datos.js: cada indicador del CDC trae su Meta anual', function () {
    D.cdc.filas.forEach(function (f) {
      assert.ok(f.metaAnual !== undefined, 'falta metaAnual en indicador ' + D.cdc.indicadores[f.i]);
    });
  });

  prueba('datos.js: el semáforo se calcula para las 16 sin reventar', function () {
    var s = AGG.semaforo(D);
    assert.strictEqual(s.length, 16);
    s.forEach(function (f) {
      assert.ok(['bueno', 'alerta', 'critico'].indexOf(f.peor) >= 0);
      Object.keys(f.celdas).forEach(function (k) {
        assert.ok(['bueno', 'alerta', 'critico'].indexOf(f.celdas[k]) >= 0,
                  f.nombre + '.' + k + ' = ' + f.celdas[k]);
      });
    });
  });

  prueba('datos.js: catastro sin acto + con acto vigente + parcial = total de UC', function () {
    var nombres = D.catastro.indicadores.map(function (i) { return i.nombre; });
    assert.deepStrictEqual(nombres.slice(2), ['UC administradas por el Ministerio',
      'UC con acto de administración vigente', 'UC parcialmente administradas']);
    D.catastro.valores.forEach(function (serie) {
      serie.forEach(function (v) { assert.strictEqual(v[0], v[2] + v[3] + v[4]); });
    });
  });

  prueba('datos.js: ningún oficio respondido antes de enviarse', function () {
    D.oficios.items.forEach(function (o) {
      if (o.respuesta) assert.ok(AGG.dia(o.respuesta) >= AGG.dia(o.envio), o.folio);
    });
  });

  prueba('datos.js: el cubo de gestión no apunta fuera de rango', function () {
    var c = D.gestion.cubo;
    assert.strictEqual(c.length % 6, 0);
    for (var i = 0; i < c.length; i += 6) {
      assert.ok(c[i] < D.gestion.meses.length && c[i + 1] < 16 && c[i + 2] < D.gestion.tramites.length
                && c[i + 3] >= 0 && c[i + 4] >= 0 && c[i + 5] >= 0);
    }
    assert.strictEqual(D.gestion.tramites.length, 6);
    assert.deepStrictEqual(D.gestion.tramites.map(function (t) { return t.nombre; }),
      ['Concesión OLP', 'Servidumbres', 'Arriendo', 'Aprovechamiento de Aguas', 'Venta', 'Ventas por Propuesta Pública']);
  });

  prueba('datos.js: gestión de Bienes calcula sin reventar y compara con el año anterior', function () {
    var todos = D.gestion.tramites.map(function (t) { return t.nombre; });
    var x = AGG.bienes(D, { region: null, tramites: todos });
    assert.strictEqual(x.anioActual, D.gestion.mes_parcial.slice(0, 4));
    assert.ok(x.kpi.ing.actual >= 0 && x.kpi.fin.actual >= 0);
    assert.ok(x.kpi.ing.anterior > 0, 'sin año anterior con qué comparar: revisar el historial de la fuente');
    assert.strictEqual(x.porTramite.length, 6);
    assert.strictEqual(x.porRegion.length, 16);
  });

  prueba('datos.js: presupuesto CDC trae las 16 SEREMIs y cuadra con el total', function () {
    assert.strictEqual(D.presupuesto.origen, 'presupuesto');
    assert.strictEqual(D.presupuesto.filas.length, 16);
    var x = AGG.presupuesto(D, null);
    assert.strictEqual(x.budget, D.presupuesto.budget);
    assert.strictEqual(x.dev, D.presupuesto.dev);
    assert.ok(x.enMeta >= 0 && x.enMeta <= 16);
  });

  prueba('datos.js: el mes_parcial de gestión es el último mes de su propia serie', function () {
    assert.strictEqual(D.gestion.meses[D.gestion.meses.length - 1], D.gestion.mes_parcial);
  });

  prueba('datos.js: Gestión Regularización (Flujos) trae las 16 SEREMIs y A+B+C cuadra con positivas+negativas', function () {
    assert.strictEqual(D.regularizacion.origen, 'dcpr-flujos');
    assert.strictEqual(D.regularizacion.filas.length, 16);
    D.regularizacion.filas.forEach(function (f) {
      assert.strictEqual(f.resA.actual + f.resB.actual + f.resC.actual,
        f.positivas.actual + f.negativas.actual, 'SEREMI ' + f.r);
    });
    var y = AGG.regularizacion(D, null);
    assert.ok(y.cbr.actual > 0 && y.proceso.actual > 0);
  });

  prueba('datos.js: ingresos (panel A · Nuevos ingresos) trae las 16 SEREMIs y cuadra con el total', function () {
    assert.strictEqual(D.dcpr.ingresos.porRegion.length, 16);
    var suma = D.dcpr.ingresos.porRegion.reduce(function (a, v) { return a + v; }, 0);
    assert.strictEqual(suma, D.dcpr.ingresos.total);
    assert.ok(D.dcpr.ingresos.total > 0);
  });

  prueba('datos.js: Gestión de Convenios trae las 4 materias y filas con índices válidos', function () {
    assert.deepStrictEqual(D.convenios.materias, ['Propiedad fiscal', 'Regularización', 'Mixto', 'Otro']);
    assert.ok(D.convenios.ft.length > 0 && D.convenios.tramite.length > 0);
    D.convenios.ft.concat(D.convenios.tramite).forEach(function (f) {
      assert.ok(f.r >= 0 && f.r < 16, 'fila con región fuera de rango: ' + f.nombre);
      assert.ok(f.materia >= 0 && f.materia < 4, 'fila con materia fuera de rango: ' + f.nombre);
      assert.ok(f.monto === null || f.monto >= 0, 'monto negativo: ' + f.nombre);
    });
    var x = AGG.convenios(D, { region: null, materias: D.convenios.materias });
    assert.strictEqual(x.kpi.vigentes, D.convenios.ft.filter(function (f) { return f.vigente; }).length);
    assert.strictEqual(x.kpi.tramite, D.convenios.tramite.length);
  });
}

console.log('\n' + n + ' comprobaciones, todas pasan.');
