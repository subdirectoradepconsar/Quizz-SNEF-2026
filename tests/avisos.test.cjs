const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function pantalla() {
  const timers = new Map();
  let nextTimer = 0;
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, dataset: {},
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      setAttribute() {}
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    console, setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    document: { body: element('body'), getElementById: element },
    triviaApp: { reproducirEfecto() {} },
    soluciones: []
  });
  for (const file of ['questions.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(require.resolve('../' + file), 'utf8'), context);
  }
  context.window = { addEventListener() {} };
  const html = fs.readFileSync(require.resolve('../screen.html'), 'utf8');
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(script[1], context);
  }
  vm.runInContext(`
    actualizarMicroensenanza = state => soluciones.push(Boolean(state.mostrarSolucion));
    var prueba = normalizarEstado({ ...estadoInicial, fase: 'PREGUNTA' });
    renderScreen(prueba);
    prueba = { ...prueba, fase: 'REVELACION', mostrarSolucion: true,
      puntoPregunta: 'NINGUNO', tipoImpacto: 'incorrect', secuenciaImpacto: 1 };
    renderScreen(prueba);
  `, context);
  return {
    context, timers,
    visible: () => context.soluciones.at(-1),
    tick() {
      const [id, fn] = timers.entries().next().value;
      timers.delete(id);
      fn();
    }
  };
}

test('error finishes fading before teaching appears, even with repeated state updates', () => {
  const p = pantalla();
  assert.equal(p.visible(), false);
  vm.runInContext('renderScreen(prueba)', p.context);
  assert.equal(p.visible(), false);
  p.tick();
  assert.equal(p.visible(), false);
  p.tick();
  assert.equal(p.visible(), true);
  assert.equal(p.timers.size, 0);
});

test('manual next during the fade cancels pending teaching', () => {
  const p = pantalla();
  p.tick();
  vm.runInContext(`renderScreen({ ...prueba, preguntaIndex: 1,
    fase: 'PREGUNTA', mostrarSolucion: false, puntoPregunta: null })`, p.context);
  assert.equal(p.visible(), false);
  assert.equal(p.timers.size, 0);
});
