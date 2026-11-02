# Neon Snake — Serpiente-Juego

Una reinterpretación moderna del clásico Snake, construida con JavaScript vanilla, Canvas 2D y CSS. Sin frameworks, sin dependencias de runtime y sin proceso de compilación.

## Ejecutar

Abre `index.html` en un navegador moderno o sirve la carpeta con cualquier servidor estático.

## Controles

- **Flechas / WASD:** cambiar de dirección.
- **Espacio / Escape:** pausar o continuar.
- **R:** preparar una nueva partida.
- **Móvil:** deslizar sobre el tablero o usar el pad táctil.

## Características

- Renderizado Canvas 2D con escalado de alta densidad y bucle `requestAnimationFrame`.
- Simulación por pasos con interpolación visual para un movimiento suave.
- Controles con prevención de giros de 180 grados.
- Modos Clásico y Sin límites; velocidades Tranquila, Normal y Turbo.
- Partículas ligeras, brillo sutil y efectos de sonido sintetizados con Web Audio.
- Récord persistente en `localStorage`, estadísticas de sesión y pausa automática al cambiar de pestaña.
- Diseño adaptable, controles táctiles y respeto por `prefers-reduced-motion`.

## Rendimiento

No se cargan bibliotecas externas. El tablero se dibuja en un único canvas, la resolución interna se limita a 2× DPR y las partículas están acotadas. La fuente web es progresiva y el juego funciona sin ella gracias a las fuentes del sistema.

## Estructura

- `index.html`: estructura y accesibilidad.
- `styles.css`: interfaz responsive.
- `game.js`: motor, controles, renderizado y audio.
