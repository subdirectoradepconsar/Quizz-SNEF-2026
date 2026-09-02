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
const impactBannerTimeouts = new Map();

function showImpactBanner(type, targetId) {
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
    setTimeout(() => {
      banner.classList.remove('is-fading');
      impactBannerTimeouts.delete(targetId);
    }, 260);
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
  caidaActual: 1,
  preguntaIndex: 0,
  ordenPreguntas: [...ORDEN_PREDETERMINADO],
  fase: 'CARTEL_CAIDA',
  caidasGanadas: { roja: 0, azul: 0 },
  puntosRonda: { roja: 0, azul: 0 },
  ganadorCombate: null,
  efectoSonido: null,
  // Campos internos para sincronizar la evaluación y señalar empates al panel.
  puntoPregunta: null,
  opcionesIncorrectas: [],
  tipoImpacto: null,
  secuenciaImpacto: 0,
  requiereDesempate: false
};

const FASES = ['INTRO', 'CARTEL_CAIDA', 'PREGUNTA', 'REVELACION', 'MASCARA_VS_MASCARA', 'PODIO'];
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

function normalizarEstado(valor) {
  const origen = valor && typeof valor === 'object' ? valor : {};
  const caidaActual = enteroAcotado(origen.caidaActual, 1, 3, 1);
  const fase = FASES.includes(origen.fase) ? origen.fase : 'CARTEL_CAIDA';
  const ganador = ESQUINAS.includes(origen.ganadorCombate) ? origen.ganadorCombate : null;
  const puntoPregunta = RESULTADOS_PREGUNTA.includes(origen.puntoPregunta) ? origen.puntoPregunta : null;
  const tipoImpacto = TIPOS_IMPACTO.includes(origen.tipoImpacto)
    ? origen.tipoImpacto
    : (enteroAcotado(origen.secuenciaError, 0, Number.MAX_SAFE_INTEGER, 0) > 0 ? 'incorrect' : null);

  return {
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
    ganadorCombate: ganador,
    efectoSonido: typeof origen.efectoSonido === 'string' ? origen.efectoSonido : null,
    puntoPregunta,
    opcionesIncorrectas: normalizarOpcionesIncorrectas(origen.opcionesIncorrectas),
    tipoImpacto,
    secuenciaImpacto: enteroAcotado(origen.secuenciaImpacto ?? origen.secuenciaError, 0, Number.MAX_SAFE_INTEGER, 0),
    requiereDesempate: Boolean(origen.requiereDesempate)
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
        if (data) this.recibirEstado(data);
      };
    }

    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        try { this.recibirEstado(JSON.parse(event.newValue)); } catch (_) { /* respaldo inválido */ }
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
      this.dbRef.on('value', (snapshot) => {
        if (snapshot.exists()) this.recibirEstado(snapshot.val());
        else this.publicar();
      });
      console.log(`Firebase conectado exclusivamente en '${DB_STATE_PATH}'.`);
    } catch (error) {
      console.warn('Error de Firebase Realtime Database:', error);
    }
  }

  recibirEstado(nuevoEstado) {
    this.state = normalizarEstado(nuevoEstado);
    this.guardarLocal();
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

  nadieAcerto() {
    if (this.combateTerminado() || this.state.fase !== 'PREGUNTA' || this.state.puntoPregunta) return false;
    this.state.fase = 'REVELACION';
    this.state.puntoPregunta = 'NINGUNO';
    this.state.efectoSonido = null;
    this.publicar();
    return true;
  }

  registrarImpacto(tipo) {
    if (!TIPOS_IMPACTO.includes(tipo)) return;
    this.state.tipoImpacto = tipo;
    this.state.secuenciaImpacto = this.state.secuenciaImpacto >= Number.MAX_SAFE_INTEGER ? 1 : this.state.secuenciaImpacto + 1;
  }

  seleccionarOpcion(indiceOpcion) {
    const faseInteractiva = ['INTRO', 'CARTEL_CAIDA', 'PREGUNTA'].includes(this.state.fase);
    if (this.combateTerminado() || !faseInteractiva || this.state.puntoPregunta) return false;
    const { pregunta } = obtenerPreguntaActual(this.state);
    const indice = Number(indiceOpcion);
    if (!Number.isInteger(indice) || indice < 0 || indice >= pregunta.opciones.length) return false;

    if (indice === pregunta.correcta) {
      this.state.fase = 'REVELACION';
      this.state.efectoSonido = null;
      this.registrarImpacto('correct');
    } else if (!this.state.opcionesIncorrectas.includes(indice)) {
      this.state.fase = 'PREGUNTA';
      this.state.opcionesIncorrectas.push(indice);
      this.state.efectoSonido = null;
    }

    if (indice !== pregunta.correcta) {
      this.registrarImpacto('incorrect');
    }

    this.publicar();
    return true;
  }

  anotarAcierto(esquina) {
    const esquinaNormalizada = String(esquina || '').toUpperCase();
    const metaAlcanzada = Object.values(this.state.puntosRonda).some((puntos) => puntos >= META_ACIERTOS);
    if (this.combateTerminado() || metaAlcanzada || !ESQUINAS.includes(esquinaNormalizada) || this.state.puntoPregunta) return false;
    const respuestaYaRevelada = this.state.fase === 'REVELACION';
    const clave = esquinaNormalizada.toLowerCase();
    this.state.puntosRonda[clave] = Math.min(META_ACIERTOS, this.state.puntosRonda[clave] + 1);
    this.state.puntoPregunta = esquinaNormalizada;
    this.state.fase = 'REVELACION';
    this.state.efectoSonido = 'ACIERTO';
    if (!respuestaYaRevelada) this.registrarImpacto('correct');
    this.publicar();
    return true;
  }

  siguientePregunta() {
    if (this.combateTerminado()) return false;
    const { roja, azul } = this.state.puntosRonda;
    if (roja >= META_ACIERTOS && azul < META_ACIERTOS) return this.otorgarCaida('ROJA');
    if (azul >= META_ACIERTOS && roja < META_ACIERTOS) return this.otorgarCaida('AZUL');

    const totalPreguntas = obtenerTotalPreguntasCaida(this.state.caidaActual);
    if (this.state.preguntaIndex < totalPreguntas - 1) {
      this.state.preguntaIndex += 1;
      this.state.fase = 'PREGUNTA';
      this.state.puntoPregunta = null;
      this.state.opcionesIncorrectas = [];
      this.state.requiereDesempate = false;
      this.state.efectoSonido = null;
      this.publicar();
      return true;
    }

    this.state.requiereDesempate = true;
    this.state.fase = 'REVELACION';
    this.state.efectoSonido = null;
    this.publicar();
    return false;
  }

  otorgarCaida(esquinaGanadora) {
    const esquina = String(esquinaGanadora || '').toUpperCase();
    if (this.combateTerminado() || !ESQUINAS.includes(esquina)) return false;
    const clave = esquina.toLowerCase();
    this.state.caidasGanadas[clave] = Math.min(2, this.state.caidasGanadas[clave] + 1);
    this.state.puntosRonda = { roja: 0, azul: 0 };
    this.state.preguntaIndex = 0;
    this.state.puntoPregunta = null;
    this.state.opcionesIncorrectas = [];
    this.state.requiereDesempate = false;

    if (this.state.caidasGanadas[clave] >= 2) {
      this.state.ganadorCombate = esquina;
      this.state.fase = 'MASCARA_VS_MASCARA';
      this.state.efectoSonido = 'VICTORIA';
    } else {
      this.state.caidaActual = Math.min(3, this.state.caidaActual + 1);
      this.state.fase = 'CARTEL_CAIDA';
      this.state.efectoSonido = 'CAMPANA';
    }

    this.publicar();
    return true;
  }

  cambiarFase(fase) {
    const nuevaFase = String(fase || '').toUpperCase();
    if (!FASES.includes(nuevaFase)) return false;
    if (this.combateTerminado() && !['MASCARA_VS_MASCARA', 'PODIO'].includes(nuevaFase)) return false;
    this.state.fase = nuevaFase;
    this.state.efectoSonido = nuevaFase === 'CARTEL_CAIDA' ? 'CAMPANA' : null;
    this.publicar();
    return true;
  }

  irAlPodio() {
    if (!this.combateTerminado() || this.state.fase !== 'MASCARA_VS_MASCARA') return false;
    this.state.fase = 'PODIO';
    this.state.efectoSonido = null;
    this.publicar();
    return true;
  }

  reiniciarCombate() {
    this.state = clonar(estadoInicial);
    this.state.ordenPreguntas = crearOrdenPreguntas();
    this.publicar();
    return true;
  }

  initAudio() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.audioContext = new AudioContextClass();
    }
    if (this.audioContext?.state === 'suspended') this.audioContext.resume();
  }

  reproducirEfecto(efecto) {
    if (!efecto) return;
    if (efecto === 'CAMPANA') {
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
  window.triviaApp = new TriviaApp();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TriviaApp, estadoInicial, normalizarEstado, crearOrdenPreguntas, obtenerPreguntaActual, obtenerTotalPreguntasCaida, META_ACIERTOS, DB_NAMESPACE, DB_STATE_PATH };
}
