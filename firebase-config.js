// Configuración pública de Firebase para la Central Mundialista.
// Pegá aquí el objeto que Firebase muestra al registrar una aplicación web.
// Esta configuración NO contiene tu contraseña. La seguridad real depende de
// Firebase Authentication y de las reglas incluidas en firebase-rules.json.

export const FIREBASE_CONFIG = {
  apiKey: "PEGAR_API_KEY",
  authDomain: "PEGAR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://PEGAR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "PEGAR_PROJECT_ID",
  storageBucket: "PEGAR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PEGAR_MESSAGING_SENDER_ID",
  appId: "PEGAR_APP_ID"
};

// Ruta interna de la base. No hace falta cambiarla.
export const REMOTE_ROOT = "centralMundialista";

export function firebaseIsConfigured() {
  const values = Object.values(FIREBASE_CONFIG);
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.databaseURL &&
    FIREBASE_CONFIG.projectId &&
    !values.some(value => String(value).includes("PEGAR_"))
  );
}
