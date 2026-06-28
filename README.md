# Central Mundialista 2026 — Camino a la Copa + panel remoto

Versión completa para emitir desde un Samsung en horizontal y administrar el contenido desde otro teléfono o una computadora, sin abrir la configuración en la pantalla transmitida.

## Incluye

- resultados, partidos simultáneos y recuperación automática;
- Camino a la Copa con los 16 cruces;
- señal automática de noticias, tendencias, trivias y preguntas;
- música, boletines MP3 y alias `labamdariver.nx`;
- PWA horizontal;
- panel remoto en `/control/`;
- Firebase Authentication con correo y contraseña;
- Realtime Database para aplicar cambios sin recargar;
- borradores, historial y restauración;
- comandos inmediatos para cambiar de placa o reproducir el boletín.

## Configuración obligatoria

El panel remoto necesita un proyecto Firebase propio. Seguí `INSTRUCCIONES-PANEL-REMOTO.txt`, completá `firebase-config.js` y publicá las reglas de `firebase-rules.json`.

La señal principal continúa funcionando aunque Firebase todavía no esté configurado; en ese caso conserva el panel local anterior.
