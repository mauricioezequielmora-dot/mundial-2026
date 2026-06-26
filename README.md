# Central Mundialista 2026

Panel web horizontal pensado para transmitir resultados, grupos, titulares, curiosidades y preguntas del Mundial 2026 desde un teléfono.

## Características

- PWA instalable y preparada para orientación horizontal.
- Alterna partidos simultáneos cada 60 segundos.
- Actualiza los datos cada 60 segundos.
- Conserva la última información válida en el teléfono.
- Reintenta automáticamente si la API o la conexión fallan.
- Muestra el estado de actualización y la hora del último dato válido.
- Alerta visual de gol cuando detecta un cambio nuevo en un partido en vivo.
- Mensaje discreto de suscripción cada 10 minutos.
- Caché controlada para recibir versiones nuevas sin quedar atrapado en archivos antiguos.

## Límites

El panel depende de la conexión a internet, GitHub Pages y la API externa `worldcup26.ir`. Si una fuente externa deja de funcionar o cambia su formato, el panel puede conservar el último dato válido, pero no puede inventar información ni reparar esa fuente por sí solo.

## Archivos editables

- `titulares.js`: titulares manuales.
- `preguntas.js`: preguntas y opciones.
- `curiosidades.js`: datos del ticker inferior.

No edites `app.js`, `pwa.js`, `sw.js`, `index.html` ni `style.css` salvo que vayas a actualizar el sistema completo.
