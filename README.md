# Central Mundialista 2026 — banderas locales, radar automático y señal visual

Versión completa para emitir desde un Samsung A04s en horizontal con la computadora apagada.

## Incluye

- resultados, partidos simultáneos y recuperación automática;
- banderas locales para evitar imágenes erróneas entregadas por la API;
- Camino a la Copa con los 16 cruces;
- radar automático de titulares recientes del Mundial, con dominio de la fuente y copia local de respaldo;
- señal visual original animada, sin imágenes de transmisiones deportivas;
- noticias manuales, tendencias, trivias y preguntas;
- música instrumental, boletines MP3 y alias `labamdariver.nx`;
- PWA horizontal y Wake Lock cuando Android lo permite.

## Panel remoto eliminado

Esta versión no incluye `/control/`, Firebase ni el control remoto. Se conserva el panel local oculto, accesible manteniendo presionado `CENTRAL MUNDIALISTA` durante 3 segundos, porque permite probar la música o cargar un MP3 directamente en el teléfono.

## Audio del vivo

La página reproduce música después de tocar `TOCÁ PARA INICIAR`. Para que el sonido llegue a YouTube, la aplicación usada para transmitir la pantalla debe capturar `audio interno`, `audio del dispositivo` o `sonidos multimedia`. Desactivar solamente el micrófono evita el sonido ambiente, pero no activa por sí solo la captura interna.

## Noticias automáticas

El radar consulta titulares recientes mediante la API pública GDELT y solo admite una lista de dominios periodísticos identificados. Muestra el título, el dominio y la hora detectada. Si la consulta falla, conserva la última copia válida; no inventa una noticia para rellenar el espacio.

## Horarios

- Horarios eliminatorios fijados en hora argentina UTC-3.
- Contador independiente de la zona horaria configurada en el teléfono.
- Caché PWA renovada para sustituir versiones anteriores.
