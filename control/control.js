import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { FIREBASE_CONFIG, REMOTE_ROOT, firebaseIsConfigured } from "../firebase-config.js";

const $ = id => document.getElementById(id);
const MAX_BULLETIN_BYTES = 1_500_000;
const DEFAULT_PAYLOAD = {
  featuredMatch: "Partido destacado de la jornada",
  dailyQuestion: "¿Quién gana el partido más importante de hoy?",
  news: [
    { text: "", source: "", time: "" },
    { text: "", source: "", time: "" },
    { text: "", source: "", time: "" }
  ],
  trends: ["Resultados en vivo", "Camino a la Copa", "Mundial 2026"],
  musicEnabled: true,
  musicVolume: 0.10,
  musicUrl: "",
  bulletinEnabled: true,
  bulletinIntervalMin: 10,
  bulletinVolume: 0.85,
  slideSeconds: 30,
  aliasEnabled: true
};

let app;
let auth;
let db;
let currentUser = null;
let lastLiveSnapshot = null;
let isDirty = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showAction(message, type = "") {
  const node = $("actionMessage");
  node.textContent = message;
  node.className = `action-message ${type}`.trim();
}

function setConnection(online, text) {
  $("connectionDot").className = `connection-dot ${online ? "online" : "offline"}`;
  $("connectionText").textContent = text;
}

function formatDate(timestamp) {
  const number = Number(timestamp);
  if (!Number.isFinite(number) || number <= 0) return "Fecha no disponible";
  return new Date(number).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function renderNewsEditors() {
  const root = $("newsEditors");
  root.innerHTML = "";
  for (let index = 0; index < 3; index += 1) {
    const item = document.createElement("div");
    item.className = "news-item";
    item.innerHTML = `
      <label>Noticia ${index + 1}
        <textarea id="newsText${index}" maxlength="190" rows="3" placeholder="Resumen verificable de la noticia"></textarea>
      </label>
      <div class="row">
        <label>Fuente<input id="newsSource${index}" maxlength="50" placeholder="FIFA, AFA, Reuters..."></label>
        <label>Hora<input id="newsTime${index}" maxlength="12" placeholder="18:30"></label>
      </div>`;
    root.appendChild(item);
  }
}

function normalizePayload(input = {}) {
  const value = input && typeof input === "object" ? input : {};
  return {
    ...clone(DEFAULT_PAYLOAD),
    ...value,
    news: DEFAULT_PAYLOAD.news.map((item, index) => ({ ...item, ...(value.news?.[index] || {}) })),
    trends: DEFAULT_PAYLOAD.trends.map((item, index) => value.trends?.[index] ?? item),
    musicEnabled: value.musicEnabled === undefined ? DEFAULT_PAYLOAD.musicEnabled : Boolean(value.musicEnabled),
    bulletinEnabled: value.bulletinEnabled === undefined ? DEFAULT_PAYLOAD.bulletinEnabled : Boolean(value.bulletinEnabled),
    aliasEnabled: value.aliasEnabled === undefined ? DEFAULT_PAYLOAD.aliasEnabled : Boolean(value.aliasEnabled),
    musicVolume: clamp(value.musicVolume ?? DEFAULT_PAYLOAD.musicVolume, 0, 0.3),
    bulletinVolume: clamp(value.bulletinVolume ?? DEFAULT_PAYLOAD.bulletinVolume, 0.2, 1),
    bulletinIntervalMin: clamp(value.bulletinIntervalMin ?? DEFAULT_PAYLOAD.bulletinIntervalMin, 5, 20),
    slideSeconds: clamp(value.slideSeconds ?? DEFAULT_PAYLOAD.slideSeconds, 20, 40)
  };
}

function fillForm(input) {
  const payload = normalizePayload(input);
  $("featuredMatch").value = payload.featuredMatch || "";
  $("dailyQuestion").value = payload.dailyQuestion || "";
  payload.news.forEach((item, index) => {
    $(`newsText${index}`).value = item.text || "";
    $(`newsSource${index}`).value = item.source || "";
    $(`newsTime${index}`).value = item.time || "";
  });
  payload.trends.forEach((item, index) => {
    $(`trend${index}`).value = item || "";
  });
  $("musicEnabled").checked = payload.musicEnabled;
  $("musicVolume").value = Math.round(payload.musicVolume * 100);
  $("musicVolumeOutput").textContent = `${Math.round(payload.musicVolume * 100)}%`;
  $("musicUrl").value = payload.musicUrl || "";
  $("bulletinEnabled").checked = payload.bulletinEnabled;
  $("bulletinInterval").value = String(payload.bulletinIntervalMin);
  $("bulletinVolume").value = Math.round(payload.bulletinVolume * 100);
  $("bulletinVolumeOutput").textContent = `${Math.round(payload.bulletinVolume * 100)}%`;
  $("slideSeconds").value = String(payload.slideSeconds);
  $("aliasEnabled").checked = payload.aliasEnabled;
  isDirty = false;
  updatePreview();
}

function readForm() {
  return normalizePayload({
    featuredMatch: $("featuredMatch").value.trim(),
    dailyQuestion: $("dailyQuestion").value.trim(),
    news: [0, 1, 2].map(index => ({
      text: $(`newsText${index}`).value.trim(),
      source: $(`newsSource${index}`).value.trim(),
      time: $(`newsTime${index}`).value.trim()
    })),
    trends: [0, 1, 2].map(index => $(`trend${index}`).value.trim()),
    musicEnabled: $("musicEnabled").checked,
    musicVolume: Number($("musicVolume").value) / 100,
    musicUrl: $("musicUrl").value.trim(),
    bulletinEnabled: $("bulletinEnabled").checked,
    bulletinIntervalMin: Number($("bulletinInterval").value),
    bulletinVolume: Number($("bulletinVolume").value) / 100,
    slideSeconds: Number($("slideSeconds").value),
    aliasEnabled: $("aliasEnabled").checked
  });
}

function validatePayload(payload) {
  if (!payload.featuredMatch && !payload.news.some(item => item.text) && !payload.dailyQuestion) {
    throw new Error("Completá al menos el partido, una noticia o la pregunta del día.");
  }
  if (payload.musicUrl && !/^https:\/\//i.test(payload.musicUrl)) {
    throw new Error("La URL de música debe comenzar con https://");
  }
  payload.news.forEach((item, index) => {
    if (item.text && !item.source) {
      throw new Error(`Agregá una fuente para la noticia ${index + 1}.`);
    }
  });
}

function updatePreview() {
  const payload = readForm();
  const firstNews = payload.news.find(item => item.text);
  const preview = $("preview");
  if (payload.featuredMatch) {
    preview.innerHTML = `
      <span>PARTIDO DESTACADO</span>
      <strong>${escapeHtml(payload.featuredMatch)}</strong>
      <small>${escapeHtml(payload.dailyQuestion || "Resultados, noticias y Camino a la Copa")}</small>`;
  } else if (firstNews) {
    preview.innerHTML = `
      <span>ÚLTIMO MOMENTO</span>
      <strong>${escapeHtml(firstNews.text)}</strong>
      <small>Fuente: ${escapeHtml(firstNews.source || "Sin fuente")}</small>`;
  } else {
    preview.innerHTML = `
      <span>CENTRAL MUNDIALISTA</span>
      <strong>Completá el contenido</strong>
      <small>La vista previa no modifica el vivo.</small>`;
  }
}

function markDirty() {
  isDirty = true;
}

async function login(event) {
  event.preventDefault();
  $("loginStatus").textContent = "Ingresando...";
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value);
    $("loginPassword").value = "";
  } catch (error) {
    console.error(error);
    $("loginStatus").textContent = "Acceso rechazado";
  }
}

function toggleSession(user) {
  currentUser = user;
  $("loginCard").classList.toggle("hidden", Boolean(user));
  $("editor").classList.toggle("hidden", !user);
  if (!user) {
    $("loginStatus").textContent = "Sin iniciar sesión";
    return;
  }
  $("sessionEmail").textContent = user.email || "Administrador";
  $("sessionUid").textContent = user.uid;
  subscribeLive();
  loadDraft(false);
  refreshHistory();
}

function subscribeLive() {
  onValue(ref(db, `${REMOTE_ROOT}/live/config`), snapshot => {
    lastLiveSnapshot = snapshot.val();
    const value = lastLiveSnapshot;
    if (!value?.payload) {
      $("liveStateText").textContent = "Panel conectado · sin publicación inicial";
      $("liveUpdatedAt").textContent = "Publicá la primera configuración";
      setConnection(true, "En línea");
      return;
    }
    $("liveStateText").textContent = value.payload.featuredMatch || "Configuración publicada";
    $("liveUpdatedAt").textContent = `Actualizado: ${formatDate(value.clientUpdatedAt || value.updatedAt)}`;
    setConnection(true, "En línea");
  }, error => {
    console.error(error);
    setConnection(false, "Sin conexión o sin permiso");
  });

  onValue(ref(db, `${REMOTE_ROOT}/live/bulletin`), snapshot => {
    const value = snapshot.val();
    $("bulletinRemoteStatus").textContent = value?.name ? `Remoto: ${value.name}` : "Sin archivo remoto";
  });
}

async function loadLiveIntoForm() {
  if (isDirty && !confirm("Hay cambios sin publicar. ¿Querés reemplazarlos por la versión del vivo?")) return;
  const snapshot = await get(ref(db, `${REMOTE_ROOT}/live/config`));
  const value = snapshot.val();
  fillForm(value?.payload || DEFAULT_PAYLOAD);
  showAction("Configuración publicada cargada.", "ok");
}

async function saveDraft() {
  try {
    const payload = readForm();
    validatePayload(payload);
    await set(ref(db, `${REMOTE_ROOT}/drafts/${currentUser.uid}`), {
      payload,
      clientSavedAt: Date.now(),
      savedAt: serverTimestamp()
    });
    showAction("Borrador guardado. Todavía no cambió el vivo.", "ok");
  } catch (error) {
    showAction(error.message || "No se pudo guardar el borrador.", "error");
  }
}

async function loadDraft(showMessage = true) {
  if (!currentUser) return;
  try {
    const snapshot = await get(ref(db, `${REMOTE_ROOT}/drafts/${currentUser.uid}`));
    const value = snapshot.val();
    if (!value?.payload) {
      if (showMessage) showAction("No hay un borrador guardado.");
      return;
    }
    if (showMessage && isDirty && !confirm("¿Reemplazar los cambios actuales por el borrador?")) return;
    fillForm(value.payload);
    if (showMessage) showAction("Borrador recuperado.", "ok");
  } catch (error) {
    if (showMessage) showAction("No se pudo recuperar el borrador.", "error");
  }
}

async function archiveCurrent(current) {
  if (!current?.payload) return;
  const historyRef = push(ref(db, `${REMOTE_ROOT}/history`));
  await set(historyRef, {
    ...current,
    archivedAt: serverTimestamp(),
    clientArchivedAt: Date.now()
  });
}

async function publishPayload(payload, message = "Cambios publicados en el vivo.") {
  validatePayload(payload);
  const liveRef = ref(db, `${REMOTE_ROOT}/live/config`);
  const previous = (await get(liveRef)).val();
  await archiveCurrent(previous);
  const version = Date.now();
  await set(liveRef, {
    payload,
    version,
    clientUpdatedAt: version,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid
  });
  isDirty = false;
  showAction(message, "ok");
  refreshHistory();
}

async function publishLive() {
  const button = $("publishLive");
  button.disabled = true;
  showAction("Publicando...");
  try {
    await publishPayload(readForm());
  } catch (error) {
    console.error(error);
    showAction(error.message || "No se pudo publicar.", "error");
  } finally {
    button.disabled = false;
  }
}

function fileToDataUrl(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 70));
    };
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function uploadBulletin() {
  const file = $("bulletinFile").files?.[0];
  if (!file) {
    showAction("Elegí primero un archivo de audio.", "error");
    return;
  }
  if (file.size > MAX_BULLETIN_BYTES) {
    showAction(`El archivo pesa ${(file.size / 1_000_000).toFixed(2)} MB. Usá uno de hasta 1,5 MB.`, "error");
    return;
  }
  if (!file.type.startsWith("audio/")) {
    showAction("El archivo seleccionado no parece ser audio.", "error");
    return;
  }
  const button = $("uploadBulletin");
  button.disabled = true;
  $("bulletinProgress").value = 5;
  try {
    const dataUrl = await fileToDataUrl(file, value => { $("bulletinProgress").value = value; });
    const version = Date.now();
    await set(ref(db, `${REMOTE_ROOT}/live/bulletin`), {
      dataUrl,
      name: file.name.slice(0, 120),
      mimeType: file.type,
      size: file.size,
      enabled: true,
      version,
      clientUpdatedAt: version,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    });
    $("bulletinProgress").value = 100;
    $("bulletinEnabled").checked = true;
    markDirty();
    showAction("Boletín subido. Publicá la configuración para activar su repetición.", "ok");
  } catch (error) {
    console.error(error);
    showAction("No se pudo subir el boletín.", "error");
  } finally {
    button.disabled = false;
    setTimeout(() => { $("bulletinProgress").value = 0; }, 1500);
  }
}

async function disableBulletin() {
  try {
    $("bulletinEnabled").checked = false;
    markDirty();
    await set(ref(db, `${REMOTE_ROOT}/live/bulletin`), null);
    showAction("Archivo remoto quitado. Publicá para desactivar la repetición.", "ok");
  } catch (error) {
    showAction("No se pudo quitar el boletín remoto.", "error");
  }
}

async function sendCommand(type, value = "") {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await set(ref(db, `${REMOTE_ROOT}/live/command`), {
      id,
      type,
      value,
      clientCreatedAt: Date.now(),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    showAction("Comando enviado al teléfono del vivo.", "ok");
  } catch (error) {
    showAction("No se pudo enviar el comando.", "error");
  }
}

async function refreshHistory() {
  if (!currentUser) return;
  const root = $("historyList");
  root.innerHTML = `<span class="help">Cargando versiones...</span>`;
  try {
    const historyQuery = query(
      ref(db, `${REMOTE_ROOT}/history`),
      orderByChild("clientUpdatedAt"),
      limitToLast(8)
    );
    const snapshot = await get(historyQuery);
    const items = [];
    snapshot.forEach(child => items.push({ key: child.key, ...child.val() }));
    items.sort((a, b) => Number(b.clientUpdatedAt || 0) - Number(a.clientUpdatedAt || 0));
    if (!items.length) {
      root.innerHTML = `<span class="help">Todavía no hay versiones anteriores.</span>`;
      return;
    }
    root.innerHTML = "";
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "history-item";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(item.payload?.featuredMatch || "Versión anterior")}</strong>
          <small>${escapeHtml(formatDate(item.clientUpdatedAt || item.clientArchivedAt))}</small>
        </div>
        <button type="button">Restaurar</button>`;
      row.querySelector("button").addEventListener("click", async () => {
        if (!confirm("¿Publicar esta versión anterior en el vivo?")) return;
        try {
          await publishPayload(normalizePayload(item.payload), "Versión anterior restaurada en el vivo.");
          fillForm(item.payload);
        } catch (error) {
          showAction("No se pudo restaurar la versión.", "error");
        }
      });
      root.appendChild(row);
    });
  } catch (error) {
    console.error(error);
    root.innerHTML = `<span class="help">No se pudo cargar el historial.</span>`;
  }
}

function bindEvents() {
  $("loginForm").addEventListener("submit", login);
  $("logoutButton").addEventListener("click", () => signOut(auth));
  $("copyUid").addEventListener("click", async () => {
    await navigator.clipboard.writeText(currentUser.uid);
    showAction("UID copiado.", "ok");
  });
  $("loadLive").addEventListener("click", loadLiveIntoForm);
  $("saveDraft").addEventListener("click", saveDraft);
  $("loadDraft").addEventListener("click", () => loadDraft(true));
  $("publishLive").addEventListener("click", publishLive);
  $("refreshPreview").addEventListener("click", updatePreview);
  $("uploadBulletin").addEventListener("click", uploadBulletin);
  $("disableBulletin").addEventListener("click", disableBulletin);
  $("refreshHistory").addEventListener("click", refreshHistory);
  $("musicVolume").addEventListener("input", event => {
    $("musicVolumeOutput").textContent = `${event.target.value}%`;
    updatePreview();
  });
  $("bulletinVolume").addEventListener("input", event => {
    $("bulletinVolumeOutput").textContent = `${event.target.value}%`;
  });
  document.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("click", () => sendCommand(button.dataset.command, button.dataset.value || ""));
  });
  $("editor").addEventListener("input", event => {
    if (event.target.closest("input, textarea, select")) {
      markDirty();
      updatePreview();
    }
  });
  window.addEventListener("beforeunload", event => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function init() {
  renderNewsEditors();
  fillForm(DEFAULT_PAYLOAD);
  bindEvents();

  if (!firebaseIsConfigured()) {
    $("setupNotice").classList.remove("hidden");
    $("loginForm").querySelectorAll("input,button").forEach(node => { node.disabled = true; });
    return;
  }

  try {
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getDatabase(app);
    onAuthStateChanged(auth, toggleSession);
  } catch (error) {
    console.error(error);
    $("setupNotice").classList.remove("hidden");
    $("setupNotice").querySelector("span").textContent = "La configuración de Firebase no es válida. Revisá firebase-config.js.";
  }
}

init();
