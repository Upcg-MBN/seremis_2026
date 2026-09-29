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
    filas: [
      { r: 0, i: 0, pond: 0.5, meta: 0.8, avance: 0.88, cumpl: 1.1 },
      { r: 0, i: 1, pond: 0.5, meta: 0.8, avance: 0.32, cumpl: 0.4 },
      { r: 1, i: 0, pond: 0.5, meta: 0.9, avance: 0.855, cumpl: 0.95 },
      { r: 1, i: 1, pond: 0.5, meta: 0.9, avance: 0.8, cumpl: 0.89 }
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
  gestion: {
    meses: ['2026-01', '2026-02', '2026-03'],   // 2026-03 es el parcial
    tramites: [{ nombre: 'Uno' }, { nombre: 'Dos' }, { nombre: 'Tres' }],
    cubo: [
      // mes, región, trámite, n
      0, 0, 0, 100, 1, 0, 0, 90,  2, 0, 0, 10,
      0, 0, 1, 50,  1, 0, 1, 60,  2, 0, 1, 5,
      0, 0, 2, 10,  1, 0, 2, 10,
      0, 1, 0, 7,   1, 1, 0, 7,   2, 1, 0, 3
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

prueba('gestión compara los dos últimos meses COMPLETOS, nunca el parcial', function () {
  var g = AGG.gestion(M, 0, 4);
  assert.strictEqual(g[0].tramite, 'Uno');
  assert.strictEqual(g[0].actual, 90);            // 2026-02, no el parcial 2026-03
  assert.strictEqual(g[0].anterior, 100);         // 2026-01
  assert.strictEqual(g[0].parcial, 10);
  assert.ok(Math.abs(g[0].variacion + 0.1) < 1e-9);
  assert.strictEqual(g[0].total, 200);            // el total sí incluye el parcial
});

prueba('gestión ordena por total y corta en el top pedido', function () {
  assert.deepStrictEqual(AGG.gestion(M, 0, 4).map(function (x) { return x.tramite; }), ['Uno', 'Dos', 'Tres']);
  assert.strictEqual(AGG.gestion(M, 0, 2).length, 2);
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

  prueba('datos.js: están los seis bloques y cada uno declara su origen', function () {
    ['cdc', 'oficios', 'catastro', 'gestion', 'dcpr', 'terreno'].forEach(function (k) {
      assert.ok(D[k], 'falta el bloque ' + k);
      assert.ok(D[k].origen, k + ' sin origen: el panel no sabría si marcarlo como ejemplo');
    });
    assert.strictEqual(D.cdc.origen, 'diplap');
    assert.strictEqual(D.dcpr.origen, 'dcpr');
    assert.ok(D.generado && D.corte && D.hoy);
  });

  prueba('datos.js: CDC y DCPR comparan con un informe anterior real', function () {
    assert.ok(AGG.cdc(D, null).global > 0);
    var d = AGG.dcpr(D, null);
    assert.ok(d.titulos.delta !== null && d.tramitadas.delta !== null,
              'el último informe DCPR no tiene uno anterior con qué comparar');
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
    assert.strictEqual(c.length % 4, 0);
    for (var i = 0; i < c.length; i += 4) {
      assert.ok(c[i] < D.gestion.meses.length && c[i + 1] < 16
                && c[i + 2] < D.gestion.tramites.length && c[i + 3] > 0);
    }
  });

  prueba('datos.js: presupuesto CDC trae las 16 SEREMIs y cuadra con el total', function () {
    assert.strictEqual(D.presupuesto.origen, 'presupuesto');
    assert.strictEqual(D.presupuesto.filas.length, 16);
    var x = AGG.presupuesto(D, null);
    assert.strictEqual(x.budget, D.presupuesto.budget);
    assert.strictEqual(x.dev, D.presupuesto.dev);
    assert.ok(x.enMeta >= 0 && x.enMeta <= 16);
  });

  prueba('datos.js: el mes de corte es el último y va marcado como parcial', function () {
    assert.strictEqual(D.gestion.meses[D.gestion.meses.length - 1], D.corte);
    // El parcial no puede entrar en la comparación mes a mes: si entrara,
    // todas las SEREMIs aparecerían cayendo.
    var g = AGG.gestion(D, 0, 4);
    assert.ok(g.length > 0);
    assert.ok(g[0].parcial >= 0);
  });
}

console.log('\n' + n + ' comprobaciones, todas pasan.');
