// El historial persistente contiene una entrada por pregunta, con todos sus intentos.
function nombreEquipoSheets(esquina) {
  return esquina === 'ROJA' ? 'Las Indestructibles Leyendas del Ahorro'
    : esquina === 'AZUL' ? 'Los Hermanos Dinamita del Retiro' : 'Nadie';
}
function otraEsquina(esquina) { return esquina === 'ROJA' ? 'AZUL' : esquina === 'AZUL' ? 'ROJA' : null; }
function claveRegistro(state) { return 'p' + ((state.caidaActual - 1) * 6 + state.preguntaIndex); }
function construirHistorialSheets(state) {
  return Array.from({ length: 18 }, (_, i) => {
    const registro = state.historialPreguntas['p' + i];
    if (!registro) return null;
    return {
      equipoTurno: registro.intentos.map(item => nombreEquipoSheets(item.equipo)).join(' → '),
      pregunta: registro.pregunta,
      respuestaElegida: registro.intentos.map((item, index) =>
        (index + 1) + '. ' + nombreEquipoSheets(item.equipo) + ': ' +
        (item.opcion >= 0 ? String.fromCharCode(65 + item.opcion) + ' · ' : '') + item.respuesta +
        (item.correcta ? ' ✅' : ' ❌')
      ).join(' / '),
      puntoPara: nombreEquipoSheets(registro.puntoPara)
    };
  });
}
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgIUeddDRPQy4yLL9Ndv-cEdF5jlf_m4MZh3w8oDJxcN9pCvfLob_fkDWPM5dY02yb/exec';
function enviarPartidaAGoogleSheets(state) {
  const numPartida = (parseInt(localStorage.getItem('trivia_num_partida') || '0', 10) || 0) + 1;
  localStorage.setItem('trivia_num_partida', numPartida);
  const payload = {
    numeroPartida: numPartida,
    ganador: nombreEquipoSheets(state.ganadorCombate),
    marcadorFinal: `${nombreEquipoSheets('ROJA')}: ${state.caidasGanadas.roja} | ${nombreEquipoSheets('AZUL')}: ${state.caidasGanadas.azul}`,
    historial: construirHistorialSheets(state)
  };
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(() => {
    console.warn('Petición enviada; la respuesta opaca no confirma el guardado en Sheets. El historial se conserva en Firebase.');
  }).catch(error => console.error('Error al registrar en Google Sheets:', error));
}

// Credenciales oficiales. Se conservan sin cambios.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkKAiVlq_th7eXqb_5F6f25uFO4ZliYIk",
  authDomain: "quizz-consar.firebaseapp.com",
  databaseURL: "https://quizz-consar-default-rtdb.firebaseio.com",
  projectId: "quizz-consar",
  storageBucket: "quizz-consar.firebasestorage.app",
  messagingSenderId: "676594424004",
  appId: "1:676594424004:web:ce949462ddae2e80545191"
};

// Única ruta autorizada para leer, escuchar y escribir en Realtime Database.
const DB_NAMESPACE = 'trivia_b/';
const DB_STATE_PATH = `${DB_NAMESPACE}estado_trivia`;
const CAIDAS = [1, 2, 3];
const MAX_PREGUNTAS_POR_CAIDA = 6;
const META_ACIERTOS = 3;
const MAX_VIDAS = 3;
const crearMarcador = () => ({
  esquinaRoja: { vidas: MAX_VIDAS, aciertos: 0 },
  esquinaAzul: { vidas: MAX_VIDAS, aciertos: 0 }
});

function ganadorPorVidas(state) {
  if (state.preguntaIndex !== obtenerTotalPreguntasCaida(state.caidaActual) - 1 || !state.puntoPregunta) return null;
  if (state.marcador.esquinaRoja.vidas > state.marcador.esquinaAzul.vidas) return 'ROJA';
  if (state.marcador.esquinaAzul.vidas > state.marcador.esquinaRoja.vidas) return 'AZUL';
  return null;
}

// Adaptador onValue para el SDK compat que ya utiliza el proyecto.
function onValue(reference, callback, onError) {
  reference.on('value', callback, onError);
  return () => reference.off('value', callback);
}
const impactBannerTimeouts = new Map();

function hideImpactBanner(targetId) {
  const banner = document.getElementById(targetId);
  if (!banner) return;
  clearTimeout(impactBannerTimeouts.get(targetId));
  impactBannerTimeouts.delete(targetId);
  banner.classList.remove('is-active', 'is-fading');
}

function showImpactBanner(type, targetId, alTerminar) {
  if (document.body.classList.contains('moderator-shell')) return;
  const banner = document.getElementById(targetId);
  const variantes = {
    correct: { clase: 'banner-correct', texto: '✅ ¡RESPUESTA CORRECTA!' },
    incorrect: { clase: 'banner-incorrect', texto: '❌ ¡RESPUESTA INCORRECTA!' }
  };
  const variante = variantes[type];
  if (!banner || !variante) return;

  clearTimeout(impactBannerTimeouts.get(targetId));
  banner.classList.remove('is-active', 'is-fading', 'banner-correct', 'banner-incorrect');
  banner.classList.add(variante.clase);
  banner.textContent = variante.texto;
  void banner.offsetWidth;
  banner.classList.add('is-active');

  const timeout = setTimeout(() => {
    banner.classList.remove('is-active');
    banner.classList.add('is-fading');
    const desvanecimiento = setTimeout(() => {
      banner.classList.remove('is-fading');
      impactBannerTimeouts.delete(targetId);
      if (alTerminar) alTerminar();
    }, 260);
    impactBannerTimeouts.set(targetId, desvanecimiento);
  }, 1300);
  impactBannerTimeouts.set(targetId, timeout);
}

function crearMascaraLuchador(color, activa, numero = null) {
  const paleta = color === 'blue' ? 'blue' : 'red';
  const estado = activa ? 'is-active' : 'is-lost';
  const numerada = numero === null ? '' : ' is-numbered';
  const placaNumero = numero === null ? '' : `<b class="mask-number">${numero}</b>`;

  return `
    <span class="lucha-mask ${paleta} ${estado}${numerada}" aria-hidden="true">
      <svg viewBox="0 0 64 72" focusable="false">
        <path class="mask-shell" d="M32 3C18.1 3 9 13.4 8.1 28.1L10.9 50c1.4 11 9.9 18.8 21.1 19 11.2-.2 19.7-8 21.1-19l2.8-21.9C55 13.4 45.9 3 32 3Z"/>
        <path class="mask-crown" d="m32 5 9.7 13.2-5.8 8.1-3.9-8.1-3.9 8.1-5.8-8.1L32 5Z"/>
        <path class="mask-wing" d="M11.3 27.8c5.4-7.2 11-9.8 17.1-7.7l-3.6 14.2-11.6 2.9-1.9-9.4Zm41.4 0c-5.4-7.2-11-9.8-17.1-7.7l3.6 14.2 11.6 2.9 1.9-9.4Z"/>
        <path class="mask-eye" d="M15.4 28.4c3.8-3.9 7.7-4.8 11.6-2.8l-2.4 5.8c-3.5 1.2-6.6.2-9.2-3Zm33.2 0c-3.8-3.9-7.7-4.8-11.6-2.8l2.4 5.8c3.5 1.2 6.6.2 9.2-3Z"/>
        <path class="mask-nose" d="m32 24 4.5 18-4.5 4.3-4.5-4.3L32 24Z"/>
        <path class="mask-jaw" d="M16.4 43.6 25.8 49l6.2-2.7 6.2 2.7 9.4-5.4-2.3 13.6L38 64.1l-6-3.5-6 3.5-7.3-6.9-2.3-13.6Z"/>
        <path class="mask-mouth" d="M24.6 52.2h14.8L37.2 59 32 61.7 26.8 59l-2.2-6.8Z"/>
        <path class="mask-stitch" d="M28 54.4v5m4-5v6.7m4-6.7v5"/>
        <path class="mask-shine" d="M16.2 20.5C19.7 12.8 25 9.2 32 9"/>
      </svg>
      ${placaNumero}
    </span>`;
}

function renderMascarasLucha(targetId, cantidadActiva, total, color, opciones = {}) {
  const contenedor = document.getElementById(targetId);
  if (!contenedor) return;
  const totalSeguro = Math.max(0, Math.trunc(Number(total) || 0));
  const activas = Math.min(totalSeguro, Math.max(0, Math.trunc(Number(cantidadActiva) || 0)));
  const { numeradas = false, etiqueta = `${activas} de ${totalSeguro} indicadores activos` } = opciones;
  contenedor.setAttribute('aria-label', etiqueta);
  contenedor.innerHTML = Array.from({ length: totalSeguro }, (_, indice) => (
    crearMascaraLuchador(color, indice < activas, numeradas ? indice + 1 : null)
  )).join('');
}

function inicializarModalMicroensenanza(prefijo) {
  // Los avisos emergentes pertenecen exclusivamente a la pantalla del auditorio.
  if (!document.documentElement.classList.contains('screen-page')) return () => {};
  const modal = document.getElementById(`${prefijo}MicroteachingModal`);
  const texto = document.getElementById(`${prefijo}MicroteachingText`);
  const respuesta = document.getElementById(`${prefijo}CorrectAnswer`);
  const fondo = [...document.querySelectorAll('body > header, body > main')];
  let focoAnterior = null;

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
    }
  });

  return (state, pregunta) => {
    const visible = state.mostrarSolucion === true;
    const estabaOculto = modal.hidden;
    respuesta.textContent = `${String.fromCharCode(65 + pregunta.correcta)}. ${pregunta.opciones[pregunta.correcta]}`;
    texto.textContent = pregunta.reflexion;
    if (visible && estabaOculto) focoAnterior = document.activeElement;
    modal.hidden = !visible;
    fondo.forEach((elemento) => { elemento.inert = visible; });
    document.body.classList.toggle('modal-open', visible);
    if (visible && (estabaOculto || document.activeElement === modal || document.activeElement.closest('[hidden]'))) {
      modal.focus({ preventScroll: true });
    } else if (!visible && !estabaOculto) {
      if (focoAnterior?.isConnected && !focoAnterior.disabled) focoAnterior.focus({ preventScroll: true });
      else {
        const principal = document.querySelector('main');
        principal.tabIndex = -1;
        principal.focus({ preventScroll: true });
      }
    }
  };
}

function obtenerRangosBanco(bancoPreguntas = BANCO_PREGUNTAS) {
  let inicio = 0;
  return CAIDAS.map((caida) => {
    const total = bancoPreguntas[caida].preguntas.length;
    const rango = { caida, inicio, fin: inicio + total, total };
    inicio += total;
    return rango;
  });
}

function crearOrdenPreguntas(aleatorio = Math.random, bancoPreguntas = BANCO_PREGUNTAS) {
  const orden = [];
  obtenerRangosBanco(bancoPreguntas).forEach(({ inicio, fin, total }) => {
    const candidatas = Array.from({ length: fin - inicio }, (_, indice) => inicio + indice);
    for (let indice = candidatas.length - 1; indice > 0; indice -= 1) {
      const destino = Math.floor(aleatorio() * (indice + 1));
      [candidatas[indice], candidatas[destino]] = [candidatas[destino], candidatas[indice]];
    }
    orden.push(...candidatas.slice(0, Math.min(total, MAX_PREGUNTAS_POR_CAIDA)));
  });
  return orden;
}

function crearOrdenPredeterminado(bancoPreguntas = BANCO_PREGUNTAS) {
  return obtenerRangosBanco(bancoPreguntas).flatMap(({ inicio, total }) => (
    Array.from({ length: Math.min(total, MAX_PREGUNTAS_POR_CAIDA) }, (_, indice) => inicio + indice)
  ));
}

const ORDEN_PREDETERMINADO = crearOrdenPredeterminado();

function normalizarOrdenPreguntas(valor, bancoPreguntas = BANCO_PREGUNTAS) {
  const rangos = obtenerRangosBanco(bancoPreguntas);
  const totalJugable = rangos.reduce((suma, { total }) => suma + Math.min(total, MAX_PREGUNTAS_POR_CAIDA), 0);
  if (!Array.isArray(valor) || valor.length !== totalJugable) {
    return crearOrdenPredeterminado(bancoPreguntas);
  }
  const orden = valor.map(Number);
  let posicion = 0;
  const valido = rangos.every(({ inicio, fin }, indiceCaida) => {
    const cantidad = Math.min(rangos[indiceCaida].total, MAX_PREGUNTAS_POR_CAIDA);
    const seleccion = orden.slice(posicion, posicion + cantidad);
    posicion += cantidad;
    return seleccion.length === cantidad
      && new Set(seleccion).size === cantidad
      && seleccion.every((numero) => Number.isInteger(numero) && numero >= inicio && numero < fin);
  });
  return valido ? orden : crearOrdenPredeterminado(bancoPreguntas);
}

function obtenerTotalPreguntasCaida(caida, bancoPreguntas = BANCO_PREGUNTAS) {
  return Math.min(bancoPreguntas[caida].preguntas.length, MAX_PREGUNTAS_POR_CAIDA);
}

function obtenerPosicionInicialCaida(caida, bancoPreguntas = BANCO_PREGUNTAS) {
  return CAIDAS
    .filter((numeroCaida) => numeroCaida < caida)
    .reduce((suma, numeroCaida) => suma + obtenerTotalPreguntasCaida(numeroCaida, bancoPreguntas), 0);
}

const estadoInicial = {
  revision: 0,
  partidaId: null,
  turnoActual: null,
  inicioTurnoPregunta: null,
  equipoInicialCaida: null,
  avanceAutomaticoEn: null,
  historialPreguntas: {},
  ultimoIntento: null,
  caidaActual: 1,
  preguntaIndex: 0,
  ordenPreguntas: [...ORDEN_PREDETERMINADO],
  fase: 'PRESENTACION',
  caidasGanadas: { roja: 0, azul: 0 },
  puntosRonda: { roja: 0, azul: 0 },
  marcador: crearMarcador(),
  ganadorCombate: null,
  efectoSonido: null,
  // Campos internos para sincronizar la evaluación y señalar empates al panel.
  puntoPregunta: null,
  opcionesIncorrectas: [],
  tipoImpacto: null,
  secuenciaImpacto: 0,
  requiereDesempate: false,
  ganadorDesempate: null,
  mostrarSolucion: false,
  inicioCartelCaida: null
};

const FASES = ['VIDEO_ESPERA', 'PRESENTACION', 'INTRO', 'CARTEL_CAIDA', 'PREGUNTA', 'REVELACION', 'MASCARA_VS_MASCARA', 'PODIO'];
const ESQUINAS = ['ROJA', 'AZUL'];
const RESULTADOS_PREGUNTA = [...ESQUINAS, 'NINGUNO'];
const TIPOS_IMPACTO = ['correct', 'incorrect'];

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function enteroAcotado(valor, minimo, maximo, respaldo) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.min(maximo, Math.max(minimo, Math.trunc(numero))) : respaldo;
}

function normalizarOpcionesIncorrectas(valor) {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.map(Number).filter((indice) => Number.isInteger(indice) && indice >= 0 && indice <= 3))];
}

function normalizarHistorial(valor) {
  const historial = {};
  for (let i = 0; i < 18; i++) {
    const item = valor?.['p' + i];
    if (!item || typeof item.pregunta !== 'string') continue;
    historial['p' + i] = {
      pregunta: item.pregunta,
      intentos: (Array.isArray(item.intentos) ? item.intentos : []).filter(intento =>
        intento && ESQUINAS.includes(intento.equipo) && Number.isInteger(intento.opcion) &&
        intento.opcion >= -1 && intento.opcion <= 3 && typeof intento.respuesta === 'string'
      ).map(intento => ({ equipo: intento.equipo, opcion: intento.opcion, respuesta: intento.respuesta, correcta: intento.correcta === true })),
      puntoPara: ESQUINAS.includes(item.puntoPara) ? item.puntoPara : null
    };
  }
  return historial;
}

function normalizarEstado(valor) {
  const origen = valor && typeof valor === 'object' ? valor : {};
  const caidaActual = enteroAcotado(origen.caidaActual, 1, 3, 1);
  const fase = FASES.includes(origen.fase) ? origen.fase : 'PRESENTACION';
  const ganador = ESQUINAS.includes(origen.ganadorCombate) ? origen.ganadorCombate : null;
  const puntoPregunta = RESULTADOS_PREGUNTA.includes(origen.puntoPregunta) ? origen.puntoPregunta : null;
  const tipoImpacto = TIPOS_IMPACTO.includes(origen.tipoImpacto)
    ? origen.tipoImpacto
    : (enteroAcotado(origen.secuenciaError, 0, Number.MAX_SAFE_INTEGER, 0) > 0 ? 'incorrect' : null);
  // `microensenanzaVisible` se acepta solo para migrar estados guardados antes
  // de que `mostrarSolucion` se convirtiera en la señal visual canónica.
  const mostrarSolucion = typeof origen.mostrarSolucion === 'boolean'
    ? origen.mostrarSolucion
    : Boolean(origen.microensenanzaVisible);

  return {
    revision: enteroAcotado(origen.revision, 0, Number.MAX_SAFE_INTEGER, 0),
    partidaId: typeof origen.partidaId === 'string' ? origen.partidaId : null,
    turnoActual: ESQUINAS.includes(origen.turnoActual) ? origen.turnoActual : null,
    inicioTurnoPregunta: ESQUINAS.includes(origen.inicioTurnoPregunta) ? origen.inicioTurnoPregunta : null,
    equipoInicialCaida: ESQUINAS.includes(origen.equipoInicialCaida) ? origen.equipoInicialCaida : null,
    historialPreguntas: normalizarHistorial(origen.historialPreguntas),
    ultimoIntento: origen.ultimoIntento && typeof origen.ultimoIntento === 'object' ? clonar(origen.ultimoIntento) : null,
    avanceAutomaticoEn: null,
    caidaActual,
    preguntaIndex: enteroAcotado(origen.preguntaIndex, 0, obtenerTotalPreguntasCaida(caidaActual) - 1, 0),
    ordenPreguntas: normalizarOrdenPreguntas(origen.ordenPreguntas),
    fase,
    caidasGanadas: {
      roja: enteroAcotado(origen.caidasGanadas?.roja, 0, 2, 0),
      azul: enteroAcotado(origen.caidasGanadas?.azul, 0, 2, 0)
    },
    puntosRonda: {
      roja: enteroAcotado(origen.puntosRonda?.roja, 0, META_ACIERTOS, 0),
      azul: enteroAcotado(origen.puntosRonda?.azul, 0, META_ACIERTOS, 0)
    },
    // Los estados antiguos comienzan con tres vidas: los aciertos no son castigos.
    marcador: Object.fromEntries(['Roja', 'Azul'].map((color) => [
      `esquina${color}`, {
        vidas: enteroAcotado(origen.marcador?.[`esquina${color}`]?.vidas ?? MAX_VIDAS, 0, MAX_VIDAS, MAX_VIDAS),
        aciertos: enteroAcotado(origen.marcador?.[`esquina${color}`]?.aciertos ?? origen.puntosRonda?.[color.toLowerCase()] ?? 0, 0, Number.MAX_SAFE_INTEGER, 0)
      }
    ])),
    ganadorCombate: ganador,
    efectoSonido: typeof origen.efectoSonido === 'string' ? origen.efectoSonido : null,
    puntoPregunta,
    opcionesIncorrectas: normalizarOpcionesIncorrectas(origen.opcionesIncorrectas),
    tipoImpacto,
    secuenciaImpacto: enteroAcotado(origen.secuenciaImpacto ?? origen.secuenciaError, 0, Number.MAX_SAFE_INTEGER, 0),
    requiereDesempate: Boolean(origen.requiereDesempate),
    ganadorDesempate: origen.requiereDesempate && ESQUINAS.includes(origen.ganadorDesempate) ? origen.ganadorDesempate : null,
    mostrarSolucion: fase === 'REVELACION' && !ganador && mostrarSolucion,
    inicioCartelCaida: Number.isFinite(Number(origen.inicioCartelCaida)) && Number(origen.inicioCartelCaida) > 0
      ? Number(origen.inicioCartelCaida)
      : null
  };
}

class TriviaApp {
  constructor() {
    this.channelName = 'trivia_b_snef_2026_sync';
    this.storageKey = 'trivia_b_estado_trivia';
    this.broadcast = null;
    this.firebaseDb = null;
    this.dbRef = null;
    this.listeners = [];
    this.state = this.cargarLocal();
    this.audioContext = null;
    this.initSync();
  }

  cargarLocal() {
    try {
      const guardado = localStorage.getItem(this.storageKey);
      return guardado ? normalizarEstado(JSON.parse(guardado)) : clonar(estadoInicial);
    } catch (error) {
      console.warn('No se pudo recuperar el respaldo local:', error);
      return clonar(estadoInicial);
    }
  }

  initSync() {
    if ('BroadcastChannel' in window) {
      this.broadcast = new BroadcastChannel(this.channelName);
      this.broadcast.onmessage = ({ data }) => {
        if (data) this.recibirEstado(data, false);
      };
    }

    window.addEventListener('storage', (event) => {
      // BroadcastChannel es el canal principal; storage queda como respaldo.
      if (!this.broadcast && event.key === this.storageKey && event.newValue) {
        try { this.recibirEstado(JSON.parse(event.newValue), false); } catch (_) { /* respaldo inválido */ }
      }
    });

    this.initFirebaseRealtime();
  }

  initFirebaseRealtime() {
    if (!window.firebase) {
      console.warn('Firebase no está disponible; se mantiene la sincronización local.');
      return;
    }

    try {
      if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
      this.firebaseDb = window.firebase.database();
      this.dbRef = this.firebaseDb.ref(DB_STATE_PATH);
      // Un listener en el padre recibe también cada cambio en
      // marcador/esquinaRoja/vidas y marcador/esquinaAzul/vidas,
      // junto con la caída correspondiente, sin renders parciales.
      onValue(this.dbRef, (snapshot) => {
        if (snapshot.exists()) this.recibirEstado(snapshot.val());
        else if (document.body.classList.contains('moderator-shell')) this.publicar();
      });
      console.log(`Firebase conectado exclusivamente en '${DB_STATE_PATH}'.`);
    } catch (error) {
      console.warn('Error de Firebase Realtime Database:', error);
    }
  }

  recibirEstado(nuevoEstado, guardarRespaldo = true) {
    const estadoNormalizado = normalizarEstado(nuevoEstado);
    if (JSON.stringify(estadoNormalizado) === JSON.stringify(this.state)) return;
    this.state = estadoNormalizado;
    // Las otras pestañas ya comparten este respaldo; no volver a emitir eventos storage.
    if (guardarRespaldo) this.guardarLocal();
    this.notificar();
  }

  guardarLocal() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); } catch (_) { /* sin cuota */ }
  }

  publicar() {
    this.state = normalizarEstado(this.state);
    this.guardarLocal();
    if (this.broadcast) this.broadcast.postMessage(this.state);
    if (this.dbRef) this.dbRef.set(this.state).catch((error) => console.error('No se pudo sincronizar:', error));
    this.notificar();
  }

  notificar() {
    const copia = clonar(this.state);
    this.listeners.forEach((listener) => listener(copia));
  }

  subscribe(listener) {
    this.listeners.push(listener);
    listener(clonar(this.state));
    return () => { this.listeners = this.listeners.filter((item) => item !== listener); };
  }

  combateTerminado() {
    return Boolean(this.state.ganadorCombate);
  }

  async modificarVida(esquina, cambio) {
    if (this.operacionPendiente) return false;
    const color = String(esquina).toLowerCase();
    if (!['roja', 'azul'].includes(color) || ![-1, 1].includes(cambio)) return false;
    const caida = this.state.caidaActual;
    const inicio = this.state.inicioCartelCaida;
    const clave = color === 'roja' ? 'esquinaRoja' : 'esquinaAzul';
    const transformar = (valor) => {
      if (!valor) return; // Firebase puede reintentar con el estado remoto.
      const state = normalizarEstado(valor);
      if (state.caidaActual !== caida || state.inicioCartelCaida !== inicio || state.ganadorCombate) return;

      const anterior = state.marcador[clave].vidas;
      const vidas = Math.max(0, Math.min(MAX_VIDAS, anterior + cambio));
      if (vidas === anterior) return;
      state.marcador[clave].vidas = vidas;
      state.revision += 1;
      // El aviso de fin tiene prioridad sobre el modal de solución.
      if (ganadorPorVidas(state)) state.mostrarSolucion = false;
      return { ...valor, ...state };
    };
    if (this.dbRef) {
      // Se comprueban ambas esquinas y el fin del combate en una transacción.
      const resultado = await this.dbRef.transaction(transformar, undefined, false);
      if (resultado.committed) this.recibirEstado(resultado.snapshot.val());
      return resultado.committed;
    }
    const siguiente = transformar(this.state);
    if (!siguiente) return false;
    this.state = siguiente;
    this.publicar();
    return true;
  }

  quitarVida(esquina) { return this.modificarVida(esquina, -1); }
  restaurarVida(esquina) { return this.modificarVida(esquina, 1); }

  actualizarVisibilidadSolucion(visible) {
    this.state.mostrarSolucion = Boolean(visible);
  }

  ocultarSolucion() {
    if (!this.state.mostrarSolucion) return false;
    this.state.avanceAutomaticoEn = null;

    this.actualizarVisibilidadSolucion(false);
    this.state.efectoSonido = null;

    // La revelación visual vuelve a la pregunta sin modificar puntos ni vidas.
    if (this.state.fase === 'REVELACION') this.state.fase = 'PREGUNTA';
    // "Nadie acertó" bloquea la pregunta; al revertirlo debe poder responderse otra vez.
    // Ocultar la explicación no reabre un intento: para corregirlo se usa Deshacer.

    this.publicar();
    return true;
  }

  nadieAcerto() {
    return this.seleccionarOpcion(null);
  }

  registrarImpacto(tipo) {
    if (!TIPOS_IMPACTO.includes(tipo)) return;
    this.state.tipoImpacto = tipo;
    this.state.secuenciaImpacto = this.state.secuenciaImpacto >= Number.MAX_SAFE_INTEGER ? 1 : this.state.secuenciaImpacto + 1;
  }

  seleccionarTurno(esquina) {
    const equipo = String(esquina).toUpperCase();
    if (this.state.historialPreguntas[claveRegistro(this.state)]?.intentos.length || this.state.preguntaIndex !== 0 || !ESQUINAS.includes(equipo) || this.combateTerminado() || ganadorPorVidas(this.state) ||
        this.state.puntoPregunta || !['INTRO', 'CARTEL_CAIDA', 'PREGUNTA'].includes(this.state.fase)) return false;
    this.state.equipoInicialCaida = equipo;
    this.state.turnoActual = equipo;
    if (!this.state.historialPreguntas[claveRegistro(this.state)]?.intentos.length) this.state.inicioTurnoPregunta = equipo;
    this.publicar();
    return true;
  }

  registrarPregunta() {
    const clave = claveRegistro(this.state);
    if (!this.state.historialPreguntas[clave]) {
      this.state.historialPreguntas[clave] = { pregunta: obtenerPreguntaActual(this.state).pregunta.pregunta, intentos: [], puntoPara: null };
    }
    return this.state.historialPreguntas[clave];
  }

  seleccionarOpcion(indiceOpcion) {
    const faseInteractiva = ['INTRO', 'CARTEL_CAIDA', 'PREGUNTA'].includes(this.state.fase);
    if (this.combateTerminado() || ganadorPorVidas(this.state) || !faseInteractiva || this.state.puntoPregunta || !this.state.turnoActual) return false;
    const { pregunta } = obtenerPreguntaActual(this.state);
    const indice = indiceOpcion === null ? -1 : Number(indiceOpcion);
    if (!Number.isInteger(indice) || (indice < 0 && indiceOpcion !== null) || indice >= pregunta.opciones.length || this.state.opcionesIncorrectas.includes(indice)) return false;
    const equipo = this.state.turnoActual;
    this.state.avanceAutomaticoEn = null;
    const correcta = indice === pregunta.correcta;
    const clave = claveRegistro(this.state);
    this.state.ultimoIntento = {
      clave, equipo, correcta,
      vidasDescontadas: !correcta && this.state.marcador[equipo === 'ROJA' ? 'esquinaRoja' : 'esquinaAzul'].vidas > 0 ? 1 : 0,
      fase: this.state.fase,
      puntosRonda: clonar(this.state.puntosRonda),
      aciertos: this.state.marcador[equipo === 'ROJA' ? 'esquinaRoja' : 'esquinaAzul'].aciertos,
      opcionesIncorrectas: [...this.state.opcionesIncorrectas],
      registro: this.state.historialPreguntas[clave] ? clonar(this.state.historialPreguntas[clave]) : null
    };
    const registro = this.registrarPregunta();
    registro.intentos.push({ equipo, opcion: indice, respuesta: indice === -1 ? 'Sin respuesta' : pregunta.opciones[indice], correcta });
    if (correcta) {
      this.state.marcador[equipo === 'ROJA' ? 'esquinaRoja' : 'esquinaAzul'].aciertos += 1;
      const color = equipo.toLowerCase();
      this.state.puntosRonda[color] = Math.min(META_ACIERTOS, this.state.puntosRonda[color] + 1);
      this.state.puntoPregunta = equipo;
      registro.puntoPara = equipo;
      this.state.fase = 'REVELACION';
      this.state.efectoSonido = 'ACIERTO';
      this.actualizarVisibilidadSolucion(true);
      this.registrarImpacto('correct');
    } else {
      this.state.fase = 'REVELACION';
      if (indice >= 0) this.state.opcionesIncorrectas.push(indice);
      this.state.efectoSonido = null;
      this.state.puntoPregunta = 'NINGUNO';
      const marcador = this.state.marcador[equipo === 'ROJA' ? 'esquinaRoja' : 'esquinaAzul'];
      marcador.vidas = Math.max(0, marcador.vidas - 1);
      this.actualizarVisibilidadSolucion(true);
      this.registrarImpacto('incorrect');
    }
    this.publicar();
    return true;
  }

  deshacerUltimoIntento() {
    const anterior = this.state.ultimoIntento;
    if (!anterior || anterior.clave !== claveRegistro(this.state) || this.combateTerminado() || this.state.requiereDesempate) return false;
    const marcador = this.state.marcador[anterior.equipo === 'ROJA' ? 'esquinaRoja' : 'esquinaAzul'];
    marcador.vidas = Math.min(MAX_VIDAS, marcador.vidas + (anterior.vidasDescontadas || 0));
    this.state.avanceAutomaticoEn = null;
    this.state.turnoActual = anterior.equipo;
    this.state.fase = anterior.fase;
    this.state.puntosRonda = clonar(anterior.puntosRonda);
    this.state.marcador[anterior.equipo === 'ROJA' ? 'esquinaRoja' : 'esquinaAzul'].aciertos = anterior.aciertos;
    this.state.opcionesIncorrectas = anterior.opcionesIncorrectas || [];
    if (anterior.registro) this.state.historialPreguntas[anterior.clave] = anterior.registro;
    else delete this.state.historialPreguntas[anterior.clave];
    this.state.puntoPregunta = null;
    this.state.mostrarSolucion = false;
    this.state.tipoImpacto = null;
    this.state.efectoSonido = null;
    this.state.ultimoIntento = null;
    this.publicar();
    return true;
  }

  prepararSiguienteTurno() {
    this.state.turnoActual = this.state.preguntaIndex < 3 ? this.state.equipoInicialCaida : otraEsquina(this.state.equipoInicialCaida);
    this.state.inicioTurnoPregunta = this.state.turnoActual;
    this.state.ultimoIntento = null;
  }

  asignarDesempate(esquina) {
    const equipo = String(esquina).toUpperCase();
    if (!this.state.requiereDesempate || this.combateTerminado() || ganadorPorVidas(this.state) ||
        this.state.preguntaIndex !== obtenerTotalPreguntasCaida(this.state.caidaActual) - 1 || !ESQUINAS.includes(equipo)) return false;
    this.state.ganadorDesempate = equipo;
    this.publicar();
    return true;
  }

  avanzarAutomaticamente() {
    // Ignorar llamadas pendientes de versiones anteriores: el avance es manual.
    return false;
  }

  siguientePregunta() {
    if (this.state.fase === 'PRESENTACION') return false;
    if (this.combateTerminado() || !this.state.puntoPregunta) return false;
    this.state.avanceAutomaticoEn = null;
    this.actualizarVisibilidadSolucion(false);
    const ganador = ganadorPorVidas(this.state);
    if (ganador) return this.otorgarCaida(ganador);
    if (this.state.requiereDesempate) {
      return this.state.ganadorDesempate ? this.otorgarCaida(this.state.ganadorDesempate) : false;
    }

    const totalPreguntas = obtenerTotalPreguntasCaida(this.state.caidaActual);
    if (this.state.preguntaIndex < totalPreguntas - 1) {
      this.state.preguntaIndex += 1;
      this.prepararSiguienteTurno();
      this.state.fase = 'PREGUNTA';
      this.state.puntoPregunta = null;
      this.state.opcionesIncorrectas = [];
      this.state.requiereDesempate = false;
      this.state.ganadorDesempate = null;
      this.state.efectoSonido = null;
      this.publicar();
      return true;
    }

    this.state.ultimoIntento = null;
    this.state.requiereDesempate = true;
    this.state.ganadorDesempate = null;
    this.state.fase = 'REVELACION';
    this.state.efectoSonido = null;
    this.publicar();
    return true;
  }

  otorgarCaida(esquinaGanadora) {
    const esquina = String(esquinaGanadora || '').toUpperCase();
    if (this.combateTerminado() || !ESQUINAS.includes(esquina)) return false;
    this.state.avanceAutomaticoEn = null;
    this.state.equipoInicialCaida = null;
    this.state.turnoActual = null;
    this.state.inicioTurnoPregunta = null;
    this.state.ultimoIntento = null;
    const clave = esquina.toLowerCase();
    this.state.caidasGanadas[clave] = Math.min(2, this.state.caidasGanadas[clave] + 1);
    this.state.puntosRonda = { roja: 0, azul: 0 };
    this.state.marcador = crearMarcador();
    this.state.preguntaIndex = 0;
    this.state.puntoPregunta = null;
    this.state.opcionesIncorrectas = [];
    this.state.requiereDesempate = false;
    this.state.ganadorDesempate = null;
    this.actualizarVisibilidadSolucion(false);

    if (this.state.caidasGanadas[clave] >= 2) {
      this.state.ganadorCombate = esquina;
      this.state.fase = 'MASCARA_VS_MASCARA';
      this.state.efectoSonido = 'VICTORIA';
      this.state.inicioCartelCaida = null;
    } else {
      this.state.caidaActual = Math.min(3, this.state.caidaActual + 1);
      this.state.fase = 'CARTEL_CAIDA';
      this.state.efectoSonido = 'CAMPANA';
      this.state.inicioCartelCaida = Date.now();
    }

    this.publicar();
    return true;
  }

  cambiarFase(fase) {
    const nuevaFase = String(fase || '').toUpperCase();
    if (!FASES.includes(nuevaFase)) return false;
    if (this.combateTerminado() && !['VIDEO_ESPERA', 'PRESENTACION', 'MASCARA_VS_MASCARA', 'PODIO'].includes(nuevaFase)) return false;
    this.state.avanceAutomaticoEn = null;
    this.state.fase = nuevaFase;
    this.state.efectoSonido = nuevaFase === 'PODIO' ? 'ACIERTO' : null;
    this.actualizarVisibilidadSolucion(false);
    this.state.inicioCartelCaida = nuevaFase === 'CARTEL_CAIDA' ? Date.now() : null;
    this.publicar();
    return true;
  }

  irAlPodio() {
    if (!this.combateTerminado() || this.state.fase !== 'MASCARA_VS_MASCARA') return false;
    this.state.fase = 'PODIO';
    this.state.efectoSonido = 'ACIERTO';
    this.actualizarVisibilidadSolucion(false);
    this.publicar();
    return true;
  }

  reiniciarCombate() {
    this.state = clonar(estadoInicial);
    this.state.fase = 'VIDEO_ESPERA';
    this.state.partidaId = globalThis.crypto.randomUUID();
    this.state.ordenPreguntas = crearOrdenPreguntas();
    this.state.inicioCartelCaida = null;
    this.publicar();
    return true;
  }

  initAudio() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.audioContext = new AudioContextClass();
    }
    if (this.audioContext?.state === 'suspended') this.audioContext.resume().catch(() => {});
    this.prepararAbucheo();
    this.prepararSonido('correctAnswerAudio', 'gritosBuffer', 'gritosPreparacion');
    this.prepararSonido('boxingBellAudio', 'campanaBuffer', 'campanaPreparacion');
  }

  prepararAbucheo() {
    this.prepararSonido('incorrectAnswerAudio', 'abucheoBuffer', 'abucheoPreparacion');
  }

  prepararSonido(audioId, bufferKey, preparacionKey) {
    const audio = document.getElementById(audioId);
    if (!audio || !this.audioContext || this[bufferKey] || this[preparacionKey]) return;
    // Decodificar antes del primer uso evita el retraso del MP3 al iniciar o buscar.
    this[preparacionKey] = fetch(audio.src)
      .then(respuesta => {
        if (!respuesta.ok) throw new Error('No se pudo cargar el sonido');
        return respuesta.arrayBuffer();
      })
      .then(datos => this.audioContext.decodeAudioData(datos))
      .then(buffer => { this[bufferKey] = buffer; })
      .catch(() => {
        // El elemento de audio precargado sigue disponible como respaldo.
        this[preparacionKey] = null;
      });
  }

  reproducirBuffer(buffer, sourceKey, offset = 0, duracion = null, desvanecer = false) {
    const contexto = this.audioContext;
    if (!buffer || contexto?.state !== 'running') return false;
    if (this[sourceKey]) this[sourceKey].stop();
    const source = contexto.createBufferSource();
    source.buffer = buffer;
    let ganancia = null;
    if (desvanecer) {
      ganancia = contexto.createGain();
      const inicio = contexto.currentTime;
      ganancia.gain.setValueAtTime(1, inicio);
      ganancia.gain.setValueAtTime(1, inicio + Math.max(0, duracion - 0.5));
      ganancia.gain.linearRampToValueAtTime(0, inicio + duracion);
      source.connect(ganancia).connect(contexto.destination);
    } else source.connect(contexto.destination);
    source.onended = () => {
      source.disconnect();
      if (ganancia) ganancia.disconnect();
      if (this[sourceKey] === source) this[sourceKey] = null;
    };
    this[sourceKey] = source;
    if (duracion === null) source.start(contexto.currentTime, offset);
    else source.start(contexto.currentTime, offset, duracion);
    return true;
  }

  reproducirEfecto(efecto) {
    if (!efecto) return;
    if (efecto === 'ABUCHEO') {
      if (this.reproducirBuffer(this.abucheoBuffer, 'abucheoSource')) return;
      const abucheo = document.getElementById('incorrectAnswerAudio');
      if (abucheo) { abucheo.currentTime = 0; abucheo.play().catch(() => {}); }
      return;
    }
    if (efecto === 'ACIERTO') {
      // Saltar los primeros dos segundos y reproducir del segundo 2 al 4.
      const duracion = Math.min(2, (this.gritosBuffer?.duration || 0) - 2);
      if (duracion > 0 && this.reproducirBuffer(this.gritosBuffer, 'gritosSource', 2, duracion, true)) return;
      const gritos = document.getElementById('correctAnswerAudio');
      if (gritos) {
        clearInterval(this.gritosFadeInterval);
        const actualizarVolumen = () => {
          // Desvanecer durante los últimos 500 ms del fragmento.
          gritos.volume = Math.max(0, Math.min(1, (4 - gritos.currentTime) / 0.5));
          if (gritos.currentTime >= 4) {
            gritos.pause();
            clearInterval(this.gritosFadeInterval);
          }
        };
        gritos.ontimeupdate = actualizarVolumen;
        gritos.onpause = gritos.onended = () => clearInterval(this.gritosFadeInterval);
        gritos.currentTime = 2;
        gritos.volume = 1;
        this.gritosFadeInterval = setInterval(actualizarVolumen, 30);
        gritos.play().catch(() => clearInterval(this.gritosFadeInterval));
      }
      return;
    }
    if (efecto === 'CAMPANA') {
      if (this.reproducirBuffer(this.campanaBuffer, 'campanaSource')) return;
      const campana = document.getElementById('boxingBellAudio');
      if (campana) { campana.currentTime = 0; campana.play().catch(() => {}); }
      return;
    }
    this.initAudio();
    if (!this.audioContext) return;
    const tonos = efecto === 'VICTORIA' ? [392, 523, 659, 784] : [440, 660];
    tonos.forEach((frecuencia, indice) => {
      const inicio = this.audioContext.currentTime + indice * 0.16;
      const oscilador = this.audioContext.createOscillator();
      const ganancia = this.audioContext.createGain();
      oscilador.type = efecto === 'VICTORIA' ? 'triangle' : 'square';
      oscilador.frequency.setValueAtTime(frecuencia, inicio);
      ganancia.gain.setValueAtTime(0.18, inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.001, inicio + 0.13);
      oscilador.connect(ganancia).connect(this.audioContext.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.14);
    });
  }
}

const ACCIONES_TRANSACCIONALES = ['seleccionarTurno', 'seleccionarOpcion', 'deshacerUltimoIntento',
  'nadieAcerto', 'ocultarSolucion', 'asignarDesempate', 'avanzarAutomaticamente', 'siguientePregunta', 'otorgarCaida', 'cambiarFase', 'irAlPodio', 'reiniciarCombate'];
const ACCIONES_ORIGINALES = Object.fromEntries(ACCIONES_TRANSACCIONALES.map(nombre => [nombre, TriviaApp.prototype[nombre]]));
for (const nombre of ACCIONES_TRANSACCIONALES) {
  const ejecutar = TriviaApp.prototype[nombre];
  TriviaApp.prototype[nombre] = async function(...args) {
    if (this.operacionPendiente) return false;
    this.operacionPendiente = true;
    this.notificar();
    const esperado = this.state;
    const transformar = valor => {
      if (!valor) return;
      const estado = normalizarEstado(valor);
      if (estado.revision !== esperado.revision || estado.partidaId !== esperado.partidaId) return;
      const borrador = Object.create(TriviaApp.prototype);
      borrador.state = estado;
      borrador.publicar = () => {};
      // Las acciones internas operan sobre el mismo borrador sin otra transacción.
      for (const [metodo, original] of Object.entries(ACCIONES_ORIGINALES)) borrador[metodo] = original;
      if (!ejecutar.apply(borrador, args)) return;
      borrador.state.revision = estado.revision + 1;
      return normalizarEstado(borrador.state);
    };
    try {
      let siguiente;
      if (this.dbRef) {
        const resultado = await this.dbRef.transaction(transformar, undefined, false);
        if (!resultado.committed) return false;
        siguiente = normalizarEstado(resultado.snapshot.val());
        this.recibirEstado(siguiente);
      } else {
        siguiente = transformar(this.state);
        if (!siguiente) return false;
        this.state = siguiente;
        this.publicar();
      }
      if (!esperado.ganadorCombate && siguiente.ganadorCombate) {
        try { enviarPartidaAGoogleSheets(siguiente); }
        catch (error) { console.error('La partida terminó, pero no se pudo enviar a Sheets:', error); }
      }
      return true;
    } finally {
      this.operacionPendiente = false;
      this.notificar();
    }
  };
}

function obtenerPreguntaActual(state, bancoPreguntas = BANCO_PREGUNTAS) {
  const estado = normalizarEstado(state);
  const totalPreguntasCaida = obtenerTotalPreguntasCaida(estado.caidaActual, bancoPreguntas);
  const posicion = obtenerPosicionInicialCaida(estado.caidaActual, bancoPreguntas) + estado.preguntaIndex;
  const numeroPregunta = estado.ordenPreguntas[posicion];
  const rango = obtenerRangosBanco(bancoPreguntas)[estado.caidaActual - 1];
  const bloque = bancoPreguntas[estado.caidaActual];
  const indiceOrigen = numeroPregunta - rango.inicio;

  return { bloque, pregunta: bloque.preguntas[indiceOrigen], numeroPregunta: indiceOrigen + 1, totalPreguntasCaida };
}

if (typeof window !== 'undefined') {
  window.DB_NAMESPACE = DB_NAMESPACE;
  window.DB_STATE_PATH = DB_STATE_PATH;
  window.estadoInicial = estadoInicial;
  window.META_ACIERTOS = META_ACIERTOS;
  window.obtenerTotalPreguntasCaida = obtenerTotalPreguntasCaida;
  window.obtenerPreguntaActual = obtenerPreguntaActual;
  window.hideImpactBanner = hideImpactBanner;
  window.triviaApp = new TriviaApp();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { construirHistorialSheets, TriviaApp, estadoInicial, normalizarEstado, crearOrdenPreguntas, obtenerPreguntaActual, obtenerTotalPreguntasCaida, META_ACIERTOS, DB_NAMESPACE, DB_STATE_PATH };
}
