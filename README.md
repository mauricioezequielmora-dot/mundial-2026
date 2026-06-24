# 🏆 Central Mundialista 2026

App web para stream 24/7 con datos en vivo del Mundial 2026.
Pensada para transmitirse desde un celular a YouTube.

## Cómo funciona

- Lee datos de la API gratuita `worldcup26.ir` (partidos, scores, tabla, estadios)
- Se actualiza sola cada 60 segundos
- 100% estática (HTML + CSS + JS), no necesita servidor
- Hosteada gratis en GitHub Pages → nunca se cae

## Estructura

```
index.html        ← la página principal (NO editar)
style.css         ← el diseño (NO editar)
app.js            ← la lógica (NO editar)
titulares.js      ← TUS titulares (EDITÁS acá)
preguntas.js      ← adivinanzas (editás cuando quieras)
curiosidades.js   ← datos curiosos (editás cuando quieras)
.nojekyll         ← archivo vacío, necesario para GitHub Pages
```

## Subir a GitHub Pages (una sola vez)

1. Entrá a https://github.com/new
2. Repository name: `mundial-2026`
3. Elegí **Public**
4. Tildá **"Add a README file"**
5. Click **Create repository**
6. En el repo, hacé click en **"Add file"** → **"Upload files"**
7. Arrastrá TODOS los archivos de esta carpeta
8. Click **"Commit changes"**
9. Andá a **Settings** → **Pages** (menú izquierdo)
10. En "Source", elegí **Deploy from a branch**
11. Branch: `main` / Folder: `/ (root)`
12. Click **Save**
13. Esperá 1-2 minutos
14. Tu URL será: `https://TU-USUARIO.github.io/mundial-2026/`

## Cambiar el titular (cuando quieras)

1. Entrá a tu repo en GitHub
2. Hacé click en `titulares.js`
3. Click en el lápiz ✏️ (arriba a la derecha del archivo)
4. Agregá un titular así (manteniendo la coma):

```javascript
,{
  fecha: "Lunes 23 de Junio",
  texto: "Argentina le ganó 3-1 a Chile...",
  fuente: "Central Mundialista"
}
```

5. Click **"Commit changes"** (verde, abajo)
6. En 1-2 minutos aparece en el stream

## Editar adivinanzas / curiosidades

Igual que titulares, pero en `preguntas.js` o `curiosidades.js`.

## Abrir desde el celu

Una vez publicado, abrí en el celu:
```
https://TU-USUARIO.github.io/mundial-2026/
```

Agregalo a la pantalla principal del celu para acceder rápido.
