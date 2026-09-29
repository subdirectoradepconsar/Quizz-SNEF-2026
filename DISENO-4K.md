# Especificaciones de diseño para pantalla de 80 pulgadas

Referencia: panel UHD 3840 × 2160, proporción 16:9, diagonal visible de
80 pulgadas. Usar pantalla completa, sin overscan, con viewport del navegador
de 3840 × 2160 píxeles CSS; comprobar el escalado del sistema y el zoom.
La resolución física del panel por sí sola no garantiza ese viewport.

## Medidas finales

| Elemento | Ancho × alto (px) | Ancho × alto aproximado (cm) | Proporción |
| --- | --- | --- | --- |
| Caja Esquina Roja | 960 × 400 | 44.28 × 18.45 | 12:5 |
| Caja Esquina Azul | 960 × 400 | 44.28 × 18.45 | 12:5 |
| Pantalla completa de espera o presentación | 3840 × 2160 | 177.10 × 99.62 | 16:9 |
| Cada máscara de vida (caja SVG, antes de rotación) | 134.4 × 150 | 6.20 × 6.92 | 112:125 |

Las cajas incluyen padding y borde de 1 px (`border-box`). El contorno de
turno activo sobresale 6 px por lado y no modifica el layout: su envolvente
visual es 972 × 412 px. Los brillos de las máscaras no forman parte de sus cajas.

Texto de esquina: Outfit, peso 900, tamaño 48 px, interlínea 57.6 px,
tracking 5.76 px. Separación entre máscaras: 38.4 px. Numeración de vidas:
32.64 px dentro de círculos de 53.76 × 53.76 px. Padding de tarjeta:
34.56 px vertical y 48 px horizontal. Radio de esquina: 42.24 px.

Conversión física: diagonal = 80 × 2.54 = 203.2 cm;
ancho = 203.2 × 16 / √337; alto = 203.2 × 9 / √337.
Cada píxel equivale aproximadamente a 0.04612087 cm. Valores nominales,
sin contar el marco del equipo.

## Imágenes actuales

La presentación usa `assets/presentacion-dinamita-vs-leyendas.png` y la espera
usa `assets/logo_animado_chispas_llamas_4k_v2.mp4`. Ambos contenedores ocupan
el viewport completo, sin encabezado ni marcador. La imagen de presentación
mide 1942 × 809 px y usa `object-fit: contain` para conservar su proporción;
el fondo desenfocado llena el espacio sobrante en pantallas 16:9.

El podio elige `assets/leyendas.png` o `assets/dinamita.png` según el ganador.
Cada logo mide 1942 × 809 px. Los tres PNG conservan su resolución original;
ampliarlos no recuperaría detalle adicional.

## Implementación y comprobación

En `styles.css`, la ampliación está limitada a `.screen-page` y viewports
desde 1600 px. Se mantiene la escala raíz existente: a 4K, 1 rem = 38.4 px.
Cada tarjeta usa `width: min(100%, 25rem)` y `height: calc(125rem / 12)`.
El margen inferior `calc(-125rem / 48)` compensa los 100 px adicionales a 4K:
la tarjeta mantiene una contribución de 300 px a la altura del grid y crece
hacia abajo sobre el espacio libre, sin desplazar el centro ni las preguntas.
Ambas columnas laterales conservan sus anclajes y crecen simétricamente.
No se modifica el grid del encabezado, el centro ni el área de preguntas.
En pantallas menores de 1600 px se conserva el diseño anterior.

Se compararon los rectángulos del DOM antes y después en Chrome headless,
con las fuentes cargadas, a 3840 × 2160, 2560 × 1440, 1920 × 1080,
1600 × 900 y 1280 × 720. En cada resolución se comprobaron los estados
“Esperando equipo”, turno rojo y turno azul: sin cambios de posición ni
tamaño del encabezado, marcador general, etiqueta de caída, texto de turno,
main, panel de pregunta, enunciado y opciones. Tarjetas sin desbordamiento
horizontal ni solapamiento del centro. También se revisó una captura 4K.

Las 14 pruebas existentes de `tests/turnos.test.cjs` y `tests/avisos.test.cjs`
pasan. La comprobación visual utilizó contenido local de prueba, sin
conectarse al estado de la partida en Firebase.
