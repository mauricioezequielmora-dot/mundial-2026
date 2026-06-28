# Central Mundialista 2026

PWA horizontal para transmitir desde un teléfono una central de resultados del Mundial.

## Incluye

- Resultados desde la API configurada en `app.js` y panel rotativo **Camino a la Copa** con los 16 cruces de dieciseisavos.
- Alternancia de partidos simultáneos cada 60 segundos.
- Recuperación con últimos datos válidos y reintentos automáticos.
- Señal central rotativa: partido destacado, noticias, tendencias, clasificación, trivia, chat y alias.
- Panel local accesible manteniendo presionado el nombre de la central durante 3 segundos.
- Música instrumental original incluida.
- Carga local de música propia y boletín MP3 generado mediante texto a voz.
- Configuración y audios persistentes en el teléfono.
- Alias de apoyo: `labamdariver.nx`.

## Archivos diarios

No es necesario modificar GitHub todos los días. El partido destacado, noticias, tendencias, pregunta y audios se cargan desde el panel del teléfono.

## Aclaración

La central muestra resultados y estadísticas. No transmite imágenes ni audio de los partidos.


## Camino a la Copa

La antigua tabla de grupos fue reemplazada por tarjetas rotativas de los 16 cruces de la ronda de 32. Cada tarjeta muestra horario argentino, estado del partido, datos de fase de grupos y el posible cruce de octavos. Los resultados en vivo se toman de la misma API del tablero cuando están disponibles.
