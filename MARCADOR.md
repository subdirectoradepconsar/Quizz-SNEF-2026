# Marcador, bloques de preguntas y registro

Cada combate nuevo o reiniciado muestra Presentación. El moderador abre Caída o
Mostrar preguntas y toca la esquina del equipo que ganó el derecho a iniciar.
La primera selección confirmada queda bloqueada para esa caída.

- Preguntas 1–3: equipo seleccionado inicialmente.
- Preguntas 4–6: equipo contrario, con cambio automático al comenzar la cuarta.
- Un intento por pregunta. Error o Sin respuesta: resta una vida, sin bajar de cero.
- Acierto: conserva vidas y suma un acierto para el registro.
- Cada respuesta muestra su explicación y programa el avance en ocho segundos.
  Siguiente pregunta permite adelantar; Ocultar solución pausa el avance.
- Deshacer último intento cancela el avance, revierte el punto o devuelve la vida
  descontada por ese intento. No elimina penalizaciones manuales posteriores.
- Ambos equipos completan sus tres preguntas, incluso cuando uno llega a cero.
- Después de la sexta respuesta gana quien conserva más vidas. Un empate en vidas
  habilita Asignar caída a Roja/Azul, y después Cerrar caída confirma la decisión.
- La siguiente caída restaura tres vidas y permite seleccionar de nuevo quién inicia.
  Dos caídas ganadas terminan el combate y disparan el envío a Sheets.

## Persistencia

Ruta conservada: `trivia_b/estado_trivia`. `marcador` mantiene `esquinaRoja` y
`esquinaAzul`, cada una con `vidas` y `aciertos`. `equipoInicialCaida` y
`turnoActual` conservan la selección. `avanceAutomaticoEn` guarda la fecha límite
para avanzar; el control ejecuta el avance si permanece abierto, o al recuperarse
tras una recarga. La pantalla del público no ejecuta avances.

Las transacciones usan `revision` y `partidaId` para rechazar acciones simultáneas
obsoletas. Cada temporizador verifica además que su fecha siga vigente.
`ultimoIntento` permite deshacer después de una recarga. Los ajustes manuales de
vidas siguen disponibles. La pantalla escucha el estado completo en Firebase.

## Google Sheets

`historialPreguntas` usa p0–p17. El envío al terminar conserva 18 posiciones:
P1–P6 primera caída, P7–P12 segunda, P13–P18 tercera. Las preguntas no jugadas son
null. Se envían equipo, pregunta, respuesta y punto para cada posición; más los
cuatro datos generales, son 76 columnas (A–BX). Sin respuesta queda registrado
como tal, con Punto Para = Nadie.

El Apps Script debe admitir null y escribir cuatro celdas vacías en esas posiciones.
El envío no-cors no confirma el guardado y no tiene reintento automático. El historial
permanece guardado hasta reiniciar. No se generan filas de prueba en la hoja real.

Al actualizar desde la dinámica anterior, recargar ambas pantallas y reiniciar el
combate para iniciar bloques de tres con un historial coherente.

Validación: `node --test tests/turnos.test.cjs`.
