import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { FIREBASE_CONFIG, REMOTE_ROOT, firebaseIsConfigured } from "./firebase-config.js";

const statusNode = document.getElementById("remoteStatus");
const LAST_COMMAND_KEY = "central-mundialista-last-command-v1";
let studioReady = Boolean(window.CentralStudio);
let pendingConfig = null;
let pendingBulletin = null;

function setStatus(label, state = "") {
  if (!statusNode) return;
  statusNode.textContent = label;
  statusNode.className = `remote-chip ${state}`.trim();
}

function getStudio() {
  return window.CentralStudio || null;
}

async function applyPending() {
  const studio = getStudio();
  if (!studio) return;
  if (pendingConfig) {
    const current = pendingConfig;
    pendingConfig = null;
    await studio.applyRemoteConfig(current.payload || {}, current);
  }
  if (pendingBulletin) {
    const current = pendingBulletin;
    pendingBulletin = null;
    await studio.applyRemoteBulletin(current);
  }
}

window.addEventListener("central-studio-ready", () => {
  studioReady = true;
  applyPending();
});

async function runCommand(command) {
  if (!command || !command.id) return;
  const lastCommand = localStorage.getItem(LAST_COMMAND_KEY);
  if (lastCommand === command.id) return;

  const studio = getStudio();
  if (!studio) return;

  try {
    switch (command.type) {
      case "next-slide":
        studio.nextSlide();
        break;
      case "show-section":
        studio.showSection(command.value || "featured");
        break;
      case "play-bulletin":
        await studio.playBulletin();
        break;
      case "music-on":
        await studio.setMusicEnabled(true);
        break;
      case "music-off":
        await studio.setMusicEnabled(false);
        break;
      default:
        return;
    }
    localStorage.setItem(LAST_COMMAND_KEY, command.id);
  } catch (error) {
    console.error("No se pudo ejecutar el comando remoto:", error);
  }
}

async function initRemoteControl() {
  if (!firebaseIsConfigured()) {
    setStatus("☁ REMOTO SIN CONFIGURAR", "warning");
    return;
  }

  try {
    setStatus("☁ CONECTANDO", "connecting");
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getDatabase(app);

    onValue(ref(db, `${REMOTE_ROOT}/live/config`), async snapshot => {
      const value = snapshot.val();
      if (!value || !value.payload) {
        setStatus("☁ REMOTO LISTO", "ready");
        return;
      }
      if (!studioReady || !getStudio()) {
        pendingConfig = value;
      } else {
        await getStudio().applyRemoteConfig(value.payload, value);
      }
      setStatus("☁ REMOTO ACTUALIZADO", "ready");
    }, error => {
      console.error("Error leyendo la configuración remota:", error);
      setStatus("☁ REMOTO SIN CONEXIÓN", "error");
    });

    onValue(ref(db, `${REMOTE_ROOT}/live/bulletin`), async snapshot => {
      const value = snapshot.val();
      if (!value || !value.dataUrl) return;
      if (!studioReady || !getStudio()) {
        pendingBulletin = value;
      } else {
        await getStudio().applyRemoteBulletin(value);
      }
    }, error => {
      console.error("Error leyendo el boletín remoto:", error);
    });

    onValue(ref(db, `${REMOTE_ROOT}/live/command`), snapshot => {
      runCommand(snapshot.val());
    }, error => {
      console.error("Error leyendo comandos remotos:", error);
    });
  } catch (error) {
    console.error("No se pudo iniciar el control remoto:", error);
    setStatus("☁ REMOTO CON ERROR", "error");
  }
}

initRemoteControl();
