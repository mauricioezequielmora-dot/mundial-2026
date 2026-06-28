// Configuración pública de Firebase para la Central Mundialista.
// Pegá aquí el objeto que Firebase muestra al registrar una aplicación web.
// Esta configuración NO contiene tu contraseña. La seguridad real depende de
// Firebase Authentication y de las reglas incluidas en firebase-rules.json.

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB2lgq8EjEQC5meAkmFEO6CD4Ihk_VgCrM",
  authDomain: "central-mundialista-2026.firebaseapp.com",
  databaseURL: "https://central-mundialista-2026-default-rtdb.firebaseio.com/",
  projectId: "central-mundialista-2026",
  storageBucket: "central-mundialista-2026.firebasestorage.app",
  messagingSenderId: "48166428481",
  appId: "1:48166428481:web:a22c7a2ece147bcd17cbc0"
};

// Ruta interna de la base. No hace falta cambiarla.
export const REMOTE_ROOT = "centralMundialista";

export function firebaseIsConfigured() {
  const values = Object.values(FIREBASE_CONFIG);
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.databaseURL &&
    FIREBASE_CONFIG.projectId &&
    !values.some(value => String(value).includes("{
  apiKey: "AIzaSyB2lgq8EjEQC5meAkmFEO6CD4Ihk_VgCrM",
  authDomain: "central-mundialista-2026.firebaseapp.com",
  projectId: "central-mundialista-2026",
  storageBucket: "central-mundialista-2026.firebasestorage.app",
  messagingSenderId: "48166428481",
  appId: "1:48166428481:web:a22c7a2ece147bcd17cbc0"
};"))
  );
}
