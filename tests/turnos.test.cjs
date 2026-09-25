const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
vm.runInThisContext(fs.readFileSync(require.resolve('../questions.js'), 'utf8'));
const { TriviaApp, estadoInicial, normalizarEstado, obtenerPreguntaActual, construirHistorialSheets } = require('../app.js');
const copy = value => JSON.parse(JSON.stringify(value));
test('prepared boo starts immediately and repeated errors restart without overlap', () => {
  const a = Object.create(TriviaApp.prototype);
  const sources = [];
  a.abucheoBuffer = {};
  a.audioContext = {
    state: 'running', destination: {},
    createBufferSource() {
      const source = {
        connect() {}, disconnect() {},
        start() { this.started = true; },
        stop() { this.stopped = true; }
      };
      sources.push(source);
      return source;
    }
  };
  a.reproducirEfecto('ABUCHEO');
  assert.equal(sources[0].started, true);
  assert.equal(sources[0].buffer, a.abucheoBuffer);
  a.reproducirEfecto('ABUCHEO');
  assert.equal(sources[0].stopped, true);
  assert.equal(sources[1].started, true);
  sources[0].onended();
  assert.equal(a.abucheoSource, sources[1]);
  sources[1].onended();
  assert.equal(a.abucheoSource, null);
});
const storage = new Map();
global.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
let sent = [];
global.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return {}; };
function app(state = { ...estadoInicial, fase: 'CARTEL_CAIDA' }) {
  const instance = Object.create(TriviaApp.prototype);
  Object.assign(instance, { state: normalizarEstado(state), listeners: [], storageKey: 'test', dbRef: null, broadcast: null });
  return instance;
}
function answers(a) {
  const question = obtenerPreguntaActual(a.state).pregunta;
  return { correct: question.correcta, wrong: (question.correcta + 1) % 4 };
}
function database(state) {
  return {
    value: copy(state),
    async transaction(transform) {
      // Firebase may retry the updater; neither pass may emit side effects.
      transform(copy(this.value));
      const next = transform(copy(this.value));
      if (next === undefined) return { committed: false, snapshot: { val: () => copy(this.value) } };
      this.value = copy(next);
      return { committed: true, snapshot: { val: () => copy(this.value) } };
    }
  };
}

test('selection can be corrected before answering; teams still play blocks of three', async () => {
  const a=app();
  await a.seleccionarTurno('ROJA');
  assert.equal(await a.seleccionarTurno('AZUL'),true);
  assert.equal(a.state.turnoActual,'AZUL');
  assert.equal(a.state.inicioTurnoPregunta,'AZUL');
  assert.equal(await a.seleccionarTurno('ROJA'),true);
  for(let i=0;i<6;i++) {
    const team=i<3?'ROJA':'AZUL';
    assert.equal(a.state.turnoActual,team);
    await a.seleccionarOpcion(answers(a).correct);
    assert.equal(a.state.turnoActual,team);
    assert.equal(await a.seleccionarOpcion(answers(a).wrong),false);
    await a.siguientePregunta();
  }
  assert.equal(a.state.marcador.esquinaRoja.vidas,3);
  assert.equal(a.state.marcador.esquinaAzul.vidas,3);
  assert.equal(a.state.requiereDesempate,true);
  assert.equal(await a.siguientePregunta(),false);
  await a.asignarDesempate('ROJA');
  assert.equal(a.state.caidasGanadas.roja,0);
  await a.siguientePregunta();
  assert.equal(a.state.caidasGanadas.roja,1);
  assert.equal(a.state.equipoInicialCaida,null);
});
test('three errors cost three lives but rival must still play; more lives wins at the end', async () => {
  const a=app();await a.seleccionarTurno('ROJA');
  for(let i=0;i<3;i++) {
    await a.seleccionarOpcion(answers(a).wrong);
    assert.equal(a.state.turnoActual,'ROJA');
    assert.equal(a.state.marcador.esquinaRoja.vidas,2-i);
    assert.equal(a.state.puntoPregunta,'NINGUNO');
    await a.siguientePregunta();
  }
  assert.equal(a.state.caidaActual,1);
  assert.equal(a.state.turnoActual,'AZUL');
  for(let i=0;i<3;i++) {await a.seleccionarOpcion(answers(a).correct);await a.siguientePregunta();}
  assert.equal(a.state.caidaActual,2);
  assert.equal(a.state.caidasGanadas.azul,1);
  assert.equal(a.state.marcador.esquinaRoja.vidas,3);
  assert.equal(a.state.turnoActual,null);
});
test('undo restores automatic life penalty, preserves manual penalties and cancels timer', async () => {
  const a=app();await a.seleccionarTurno('AZUL');
  await a.seleccionarOpcion(answers(a).wrong);
  await a.modificarVida('azul',-1);
  const restored=app(a.state);
  await restored.deshacerUltimoIntento();
  assert.equal(restored.state.marcador.esquinaAzul.vidas,2);
  assert.equal(restored.state.turnoActual,'AZUL');
  assert.equal(restored.state.avanceAutomaticoEn,null);
  assert.deepEqual(restored.state.historialPreguntas,{});
  await restored.seleccionarOpcion(answers(restored).correct);
  await restored.deshacerUltimoIntento();
  assert.equal(restored.state.marcador.esquinaAzul.aciertos,0);
  assert.equal(restored.state.marcador.esquinaAzul.vidas,2);
});
test('six failures produce a zero-zero tie rather than premature victory',async()=>{
 const a=app();await a.seleccionarTurno('ROJA');
 for(let i=0;i<6;i++){await a.nadieAcerto();await a.siguientePregunta();}
 assert.equal(a.state.requiereDesempate,true);
 assert.equal(a.state.marcador.esquinaRoja.vidas,0);
 assert.equal(a.state.marcador.esquinaAzul.vidas,0);
 assert.equal(await a.asignarDesempate('AZUL'),true);
 await a.siguientePregunta();assert.equal(a.state.caidasGanadas.azul,1);
});
test('simultaneous first selections and answers commit only once',async()=>{
 const a=app(),b=app();a.dbRef=b.dbRef=database(a.state);
 assert.deepEqual(await Promise.all([a.seleccionarTurno('ROJA'),b.seleccionarTurno('AZUL')]),[true,false]);
 b.state=normalizarEstado(a.dbRef.value);
 const wrong=answers(a).wrong;
 assert.deepEqual(await Promise.all([a.seleccionarOpcion(wrong),b.seleccionarOpcion(wrong)]),[true,false]);
 assert.equal(a.dbRef.value.marcador.esquinaRoja.vidas,2);
 assert.equal(a.dbRef.value.historialPreguntas.p0.intentos.length,1);
});
test('correct, incorrect and unanswered questions wait for manual advance after reload',async()=>{
 for(const answer of ['correct','wrong',null]) {
  const a=app();await a.seleccionarTurno('ROJA');
  await a.seleccionarOpcion(answer === null ? null : answers(a)[answer]);
  assert.equal(a.state.avanceAutomaticoEn,null);
  assert.equal(a.state.preguntaIndex,0);
  assert.equal(a.state.mostrarSolucion,true);
  const deadline=Date.now()-1000;
  const restored=app({...a.state,avanceAutomaticoEn:deadline});
  assert.equal(restored.state.avanceAutomaticoEn,null);
  assert.equal(await restored.avanzarAutomaticamente(deadline),false);
  assert.equal(restored.state.preguntaIndex,0);
  assert.equal(restored.state.mostrarSolucion,true);
  assert.equal(await restored.siguientePregunta(),true);
  assert.equal(restored.state.preguntaIndex,1);
  assert.equal(restored.state.mostrarSolucion,false);
  assert.equal(restored.state.turnoActual,'ROJA');
  await restored.seleccionarOpcion(answers(restored).correct);
  await restored.cambiarFase('PRESENTACION');
  assert.equal(await restored.siguientePregunta(),false);
 }
});
test('Sheets contains 18 fixed question positions and one final submission',async()=>{
 const a=app();sent=[];
 for(let round=0;round<2;round++){
  await a.seleccionarTurno('ROJA');
  for(let i=0;i<6;i++) {await a.seleccionarOpcion(i<3?answers(a).wrong:answers(a).correct);await a.siguientePregunta();}
 }
 assert.equal(a.state.ganadorCombate,'AZUL');assert.equal(sent.length,1);
 assert.equal(sent[0].historial.length,18);
 assert.equal(sent[0].historial[0].equipoTurno,'Esquina Roja');
 assert.equal(sent[0].historial[3].equipoTurno,'Esquina Azul');
 assert.equal(sent[0].historial[6].puntoPara,'Nadie');
 assert.equal(sent[0].historial[12],null);
 assert.equal(construirHistorialSheets(a.state)[11].puntoPara,'Esquina Azul');
 await a.reiniciarCombate();assert.equal(a.state.fase,'PRESENTACION');
 assert.equal(a.state.equipoInicialCaida,null);assert.equal(a.state.avanceAutomaticoEn,null);
});
test('transaction failure preserves state and releases pending flag',async()=>{
 const a=app();a.dbRef={transaction:async()=>{throw Error('offline')}};
 await assert.rejects(a.seleccionarTurno('ROJA'),/offline/);
 assert.equal(a.state.turnoActual,null);assert.equal(a.operacionPendiente,false);
});
test('inline browser scripts and handlers parse',()=>{
 for(const file of ['moderator.html','screen.html']){
  const html=fs.readFileSync(require.resolve('../'+file),'utf8');
  for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
  for(const handler of html.matchAll(/onclick="([^"]+)"/g))new vm.Script(handler[1]);
 }
});
test('last teaching has no timer and only manual close advances the fall',async()=>{
 const a=app();await a.seleccionarTurno('ROJA');
 for(let i=0;i<5;i++){
  await a.seleccionarOpcion(i<3?answers(a).correct:answers(a).wrong);
  await a.siguientePregunta();
 }
 await a.seleccionarOpcion(answers(a).correct);
 assert.equal(a.state.mostrarSolucion,true);
 assert.equal(a.state.avanceAutomaticoEn,null);
 assert.equal(a.state.caidaActual,1);
 const restored=app({...a.state,avanceAutomaticoEn:Date.now()-1000});
 assert.equal(restored.state.avanceAutomaticoEn,null);
 assert.equal(await restored.avanzarAutomaticamente(Date.now()-1000),false);
 assert.equal(restored.state.mostrarSolucion,true);
 assert.equal(restored.state.caidaActual,1);
 await restored.siguientePregunta();
 assert.equal(restored.state.caidaActual,2);
 assert.equal(restored.state.caidasGanadas.roja,1);
 assert.equal(restored.state.fase,'CARTEL_CAIDA');
});

test('undo first answer reopens initial team selection without leaving penalties',async()=>{
 const a=app();await a.seleccionarTurno('ROJA');
 await a.seleccionarOpcion(answers(a).wrong);
 assert.equal(await a.seleccionarTurno('AZUL'),false);
 await a.deshacerUltimoIntento();
 assert.equal(await a.seleccionarTurno('AZUL'),true);
 assert.equal(a.state.equipoInicialCaida,'AZUL');
 assert.equal(a.state.marcador.esquinaRoja.vidas,3);
 assert.deepEqual(a.state.historialPreguntas,{});
});
