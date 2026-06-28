(() => {
  "use strict";

  const CONFIG_KEY = "central-mundialista-studio-v1";
  const DB_NAME = "central-mundialista-audio-v1";
  const DB_STORE = "audio";
  const DEFAULT_MUSIC = "./audio/fondo-central.mp3";
  const SUPPORT_ALIAS = "labamdariver.nx";

  const DEFAULT_CONFIG = {
    featuredMatch: "Partido destacado de la jornada",
    dailyQuestion: "¿Quién gana el partido más importante de hoy?",
    news: [
      { text: "", source: "", time: "" },
      { text: "", source: "", time: "" },
      { text: "", source: "", time: "" }
    ],
    trends: ["Resultados en vivo", "Tabla y clasificación", "Mundial 2026"],
    musicEnabled: true,
    musicVolume: 0.10,
    customMusicName: "",
    bulletinEnabled: true,
    bulletinIntervalMin: 10,
    bulletinVolume: 0.85,
    bulletinName: "",
    slideSeconds: 30,
    aliasEnabled: true
  };

  let config = loadConfig();
  let slides = [];
  let slideIndex = 0;
  let triviaIndex = 0;
  let slideTimer = null;
  let bulletinTimer = null;
  let panelOpen = false;
  let presentationStarted = false;
  let bulletinPlaying = false;
  let musicObjectUrl = "";
  let bulletinObjectUrl = "";
  let longPressTimer = null;

  const $ = (id) => document.getElementById(id);
  const backgroundMusic = $("backgroundMusic");
  const bulletinAudio = $("bulletinAudio");
  const audioChip = $("audioChip");

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function loadConfig() {
    const defaults = cloneDefaults();
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return defaults;
      return {
        ...defaults,
        ...parsed,
        news: defaults.news.map((item, index) => ({ ...item, ...(parsed.news?.[index] || {}) })),
        trends: defaults.trends.map((item, index) => parsed.trends?.[index] ?? item)
      };
    } catch (error) {
      console.warn("No se pudo leer la configuración de la central:", error);
      return defaults;
    }
  }

  function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB no está disponible"));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB"));
    });
  }

  async function setAudioBlob(key, blob) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(blob, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function getAudioBlob(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const request = tx.objectStore(DB_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
    } catch (error) {
      console.warn("No se pudo leer audio local:", error);
      return null;
    }
  }

  async function deleteAudioBlob(key) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) {
      console.warn("No se pudo borrar audio local:", error);
    }
  }

  function revokeObjectUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  async function loadAudioSources() {
    const customMusic = await getAudioBlob("music");
    revokeObjectUrl(musicObjectUrl);
    musicObjectUrl = "";
    if (customMusic) {
      musicObjectUrl = URL.createObjectURL(customMusic);
      backgroundMusic.src = musicObjectUrl;
    } else {
      backgroundMusic.src = DEFAULT_MUSIC;
    }

    const bulletin = await getAudioBlob("bulletin");
    revokeObjectUrl(bulletinObjectUrl);
    bulletinObjectUrl = "";
    if (bulletin) {
      bulletinObjectUrl = URL.createObjectURL(bulletin);
      bulletinAudio.src = bulletinObjectUrl;
    } else {
      bulletinAudio.removeAttribute("src");
      bulletinAudio.load();
    }

    backgroundMusic.volume = clamp(config.musicVolume, 0, 0.3);
    bulletinAudio.volume = clamp(config.bulletinVolume, 0.2, 1);
    updateFileStatuses(Boolean(customMusic), Boolean(bulletin));
    updateAudioChip();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function updateFileStatuses(hasCustomMusic, hasBulletin) {
    const musicStatus = $("musicFileStatus");
    const bulletinStatus = $("bulletinFileStatus");
    if (musicStatus) {
      musicStatus.textContent = hasCustomMusic
        ? `Música local: ${config.customMusicName || "archivo cargado"}`
        : "Música incluida: fondo instrumental original.";
    }
    if (bulletinStatus) {
      bulletinStatus.textContent = hasBulletin
        ? `Boletín local: ${config.bulletinName || "archivo cargado"}`
        : "No hay boletín cargado.";
    }
  }

  function updateAudioChip(label = "") {
    if (!audioChip) return;
    audioChip.classList.toggle("speaking", bulletinPlaying);
    if (label) {
      audioChip.textContent = label;
    } else if (bulletinPlaying) {
      audioChip.textContent = "🔊 BOLETÍN";
    } else if (config.musicEnabled && !backgroundMusic.paused) {
      audioChip.textContent = "♫ FONDO";
    } else {
      audioChip.textContent = "♫ SIN AUDIO";
    }
  }

  async function startPresentationAudio() {
    presentationStarted = true;
    backgroundMusic.volume = clamp(config.musicVolume, 0, 0.3);
    if (!config.musicEnabled) {
      backgroundMusic.pause();
      updateAudioChip();
      return;
    }
    try {
      await backgroundMusic.play();
    } catch (error) {
      console.warn("El navegador no permitió iniciar la música:", error);
      showToast("Tocá nuevamente la pantalla para habilitar el audio");
    }
    updateAudioChip();
  }

  function fadeAudio(audio, target, duration = 600) {
    return new Promise(resolve => {
      if (!audio) { resolve(); return; }
      const from = audio.volume;
      const to = clamp(target, 0, 1);
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        audio.volume = from + ((to - from) * progress);
        if (progress < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  async function playBulletin({ test = false } = {}) {
    if (bulletinPlaying) return;
    if (!bulletinAudio.src) {
      if (test) showToast("Primero cargá el MP3 del boletín");
      return;
    }
    if (!test && (!config.bulletinEnabled || !presentationStarted || panelOpen)) return;

    bulletinPlaying = true;
    updateAudioChip();
    const restoreVolume = clamp(config.musicVolume, 0, 0.3);
    try {
      if (!backgroundMusic.paused) await fadeAudio(backgroundMusic, Math.min(0.015, restoreVolume), 500);
      bulletinAudio.currentTime = 0;
      bulletinAudio.volume = clamp(config.bulletinVolume, 0.2, 1);
      await bulletinAudio.play();
      await new Promise(resolve => {
        const done = () => {
          bulletinAudio.removeEventListener("ended", done);
          bulletinAudio.removeEventListener("error", done);
          resolve();
        };
        bulletinAudio.addEventListener("ended", done, { once: true });
        bulletinAudio.addEventListener("error", done, { once: true });
      });
    } catch (error) {
      console.warn("No se pudo reproducir el boletín:", error);
      if (test) showToast("No se pudo reproducir ese archivo");
    } finally {
      bulletinPlaying = false;
      if (config.musicEnabled && presentationStarted) {
        try {
          if (backgroundMusic.paused) await backgroundMusic.play();
          await fadeAudio(backgroundMusic, restoreVolume, 700);
        } catch (error) {
          console.warn("No se pudo recuperar la música:", error);
        }
      }
      updateAudioChip();
    }
  }

  function scheduleBulletin() {
    clearInterval(bulletinTimer);
    const minutes = clamp(config.bulletinIntervalMin, 5, 20);
    bulletinTimer = setInterval(() => playBulletin(), minutes * 60 * 1000);
  }

  function getLatestHeadline() {
    if (!Array.isArray(window.TITULARES) || !window.TITULARES.length) return null;
    return window.TITULARES[window.TITULARES.length - 1];
  }

  function getQualifiersSlide() {
    const snapshot = window.CentralData?.getState?.();
    if (!snapshot?.groups || !snapshot.currentGroup) return null;
    const group = snapshot.groups[snapshot.currentGroup];
    if (!Array.isArray(group?.teams) || group.teams.length < 2) return null;
    const sorted = [...group.teams].sort((a, b) => {
      const pts = Number(b.pts) - Number(a.pts);
      if (pts) return pts;
      const gd = Number(b.gd) - Number(a.gd);
      if (gd) return gd;
      return Number(b.gf) - Number(a.gf);
    });
    const rows = sorted.slice(0, 2).map((team, index) => {
      const teamData = snapshot.teams?.[String(team.team_id)];
      return `<div class="qualifier-row"><span>${index + 1}</span><strong>${escapeHtml(teamData?.name_en || "Equipo")}</strong><b>${escapeHtml(team.pts)} pts</b></div>`;
    }).join("");
    return {
      section: `GRUPO ${escapeHtml(snapshot.currentGroup)}`,
      kind: "qualifiers",
      html: `<div class="broadcast-kicker">CLASIFICACIÓN DIRECTA AHORA</div><div class="qualifier-list">${rows}</div><div class="broadcast-note">Los dos primeros avanzan directamente. La tabla cambia con los resultados.</div>`
    };
  }

  function buildSlides() {
    const next = [];
    const featured = config.featuredMatch.trim();
    if (featured) {
      next.push({
        section: "PARTIDO DESTACADO",
        kind: "featured",
        html: `<div class="broadcast-kicker">HOY EN LA CENTRAL</div><div class="broadcast-main">${escapeHtml(featured)}</div><div class="broadcast-note">Resultados, tabla y novedades durante toda la jornada.</div>`
      });
    }

    const validNews = config.news.filter(item => item.text.trim());
    if (validNews.length) {
      validNews.forEach((item, index) => {
        const sourceLine = [item.source.trim(), item.time.trim()].filter(Boolean).join(" · ");
        next.push({
          section: index === 0 ? "ÚLTIMO MOMENTO" : "RADAR DE NOTICIAS",
          kind: "news",
          html: `<div class="broadcast-kicker">NOTICIA VERIFICADA</div><div class="broadcast-main news-text">${escapeHtml(item.text)}</div>${sourceLine ? `<div class="broadcast-source">Fuente: ${escapeHtml(sourceLine)}</div>` : ""}`
        });
      });
    } else {
      const headline = getLatestHeadline();
      if (headline?.texto) {
        next.push({
          section: "TITULAR DEL DÍA",
          kind: "news",
          html: `<div class="broadcast-kicker">CENTRAL MUNDIALISTA</div><div class="broadcast-main news-text">${escapeHtml(headline.texto)}</div><div class="broadcast-source">Fuente: ${escapeHtml(headline.fuente || "Central Mundialista")}</div>`
        });
      }
    }

    const trendItems = config.trends.map(value => value.trim()).filter(Boolean);
    if (trendItems.length) {
      next.push({
        section: "LO MÁS HABLADO",
        kind: "trends",
        html: `<div class="broadcast-kicker">RADAR DEL MUNDIAL</div><div class="trend-list">${trendItems.map((item, index) => `<div><span>${index + 1}</span><strong>${escapeHtml(item)}</strong></div>`).join("")}</div><div class="broadcast-note">Temas seleccionados para la jornada.</div>`
      });
    }

    const qualifiers = getQualifiersSlide();
    if (qualifiers) next.push(qualifiers);

    if (Array.isArray(window.PREGUNTAS) && window.PREGUNTAS.length) {
      const question = window.PREGUNTAS[triviaIndex % window.PREGUNTAS.length];
      const options = Array.isArray(question.opciones) ? question.opciones : [];
      const answer = options[Number(question.correcta)] || "Respuesta no disponible";
      next.push({
        section: "DESAFÍO MUNDIAL",
        kind: "trivia",
        html: `<div class="broadcast-kicker">ADIVINÁ ANTES DE QUE CAMBIE</div><div class="broadcast-main trivia-main">${escapeHtml(question.pregunta)}</div><div class="compact-options">${options.map((option, index) => `<span><b>${String.fromCharCode(65 + index)}</b>${escapeHtml(option)}</span>`).join("")}</div>`
      });
      next.push({
        section: "RESPUESTA",
        kind: "answer",
        html: `<div class="broadcast-kicker">LA RESPUESTA ERA</div><div class="broadcast-answer">${escapeHtml(answer)}</div><div class="broadcast-note">¿La acertaste? Dejalo en el chat.</div>`
      });
      triviaIndex = (triviaIndex + 1) % window.PREGUNTAS.length;
    }

    if (config.dailyQuestion.trim()) {
      next.push({
        section: "TE LEEMOS",
        kind: "chat",
        html: `<div class="broadcast-kicker">PREGUNTA PARA EL CHAT</div><div class="broadcast-main">${escapeHtml(config.dailyQuestion)}</div><div class="chat-cta">ESCRIBÍ TU RESPUESTA EN EL CHAT</div>`
      });
    }

    next.push({
      section: "SEGUÍ LA CENTRAL",
      kind: "subscribe",
      html: `<div class="broadcast-kicker">TODOS LOS RESULTADOS</div><div class="broadcast-main">Suscribite y compartí el vivo con otro fanático del Mundial.</div><div class="broadcast-note">La central se actualiza automáticamente.</div>`
    });

    if (config.aliasEnabled) {
      next.push({
        section: "APOYÁ EL PROYECTO",
        kind: "support",
        html: `<div class="broadcast-kicker">APORTE VOLUNTARIO</div><div class="alias-big">${escapeHtml(SUPPORT_ALIAS)}</div><div class="broadcast-note">Gracias por acompañar la Central Mundialista.</div>`
      });
    }

    slides = next.length ? next : [{
      section: "CENTRAL MUNDIALISTA",
      kind: "empty",
      html: `<div class="broadcast-main">Resultados y novedades del Mundial 2026.</div>`
    }];
  }

  function renderSlide(index = slideIndex) {
    if (!slides.length) buildSlides();
    const safeIndex = ((index % slides.length) + slides.length) % slides.length;
    slideIndex = safeIndex;
    const slide = slides[safeIndex];
    const content = $("broadcastContent");
    const section = $("broadcastSection");
    const counter = $("broadcastCounter");
    const progress = $("broadcastProgress");
    if (!content || !section || !counter || !progress) return;

    section.textContent = slide.section;
    counter.textContent = `${safeIndex + 1}/${slides.length}`;
    content.className = `broadcast-content kind-${slide.kind}`;
    content.innerHTML = slide.html;

    progress.style.animation = "none";
    progress.offsetHeight;
    progress.style.animation = `broadcastProgress ${config.slideSeconds}s linear forwards`;
  }

  function advanceSlide() {
    if (panelOpen) return;
    slideIndex += 1;
    if (slideIndex >= slides.length) {
      slideIndex = 0;
      buildSlides();
    }
    renderSlide(slideIndex);
  }

  function scheduleSlides() {
    clearInterval(slideTimer);
    buildSlides();
    slideIndex = 0;
    renderSlide(0);
    slideTimer = setInterval(advanceSlide, clamp(config.slideSeconds, 20, 40) * 1000);
  }

  function showToast(text) {
    const toast = $("studioToast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function populatePanel() {
    $("cfgFeaturedMatch").value = config.featuredMatch;
    $("cfgDailyQuestion").value = config.dailyQuestion;
    config.news.forEach((item, index) => {
      $(`cfgNewsText${index}`).value = item.text;
      $(`cfgNewsSource${index}`).value = item.source;
      $(`cfgNewsTime${index}`).value = item.time;
    });
    config.trends.forEach((item, index) => { $(`cfgTrend${index}`).value = item; });
    $("cfgMusicEnabled").checked = config.musicEnabled;
    $("cfgMusicVolume").value = Math.round(config.musicVolume * 100);
    $("musicVolumeOutput").textContent = `${Math.round(config.musicVolume * 100)}%`;
    $("cfgBulletinEnabled").checked = config.bulletinEnabled;
    $("cfgBulletinInterval").value = String(config.bulletinIntervalMin);
    $("cfgBulletinVolume").value = Math.round(config.bulletinVolume * 100);
    $("cfgSlideSeconds").value = String(config.slideSeconds);
    $("cfgAliasEnabled").checked = config.aliasEnabled;
  }

  function readPanel() {
    config.featuredMatch = $("cfgFeaturedMatch").value.trim();
    config.dailyQuestion = $("cfgDailyQuestion").value.trim();
    config.news = config.news.map((_, index) => ({
      text: $(`cfgNewsText${index}`).value.trim(),
      source: $(`cfgNewsSource${index}`).value.trim(),
      time: $(`cfgNewsTime${index}`).value.trim()
    }));
    config.trends = config.trends.map((_, index) => $(`cfgTrend${index}`).value.trim());
    config.musicEnabled = $("cfgMusicEnabled").checked;
    config.musicVolume = clamp(Number($("cfgMusicVolume").value) / 100, 0, 0.3);
    config.bulletinEnabled = $("cfgBulletinEnabled").checked;
    config.bulletinIntervalMin = clamp($("cfgBulletinInterval").value, 5, 20);
    config.bulletinVolume = clamp(Number($("cfgBulletinVolume").value) / 100, 0.2, 1);
    config.slideSeconds = clamp($("cfgSlideSeconds").value, 20, 40);
    config.aliasEnabled = $("cfgAliasEnabled").checked;
  }

  function openPanel() {
    panelOpen = true;
    populatePanel();
    const panel = $("studioPanel");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    showToast("Panel abierto");
  }

  function closePanel() {
    panelOpen = false;
    const panel = $("studioPanel");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  function bindLongPress() {
    const trigger = $("brandAdminTrigger");
    if (!trigger) return;
    const start = (event) => {
      if (event.type === "pointerdown" && event.button !== 0) return;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(openPanel, 3000);
    };
    const cancel = () => clearTimeout(longPressTimer);
    trigger.addEventListener("pointerdown", start);
    ["pointerup", "pointercancel", "pointerleave"].forEach(name => trigger.addEventListener(name, cancel));
  }

  async function handleMusicFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await setAudioBlob("music", file);
      config.customMusicName = file.name;
      saveConfig();
      await loadAudioSources();
      if (presentationStarted && config.musicEnabled) await startPresentationAudio();
      showToast("Música guardada en este teléfono");
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar la música");
    } finally {
      event.target.value = "";
    }
  }

  async function handleBulletinFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await setAudioBlob("bulletin", file);
      config.bulletinName = file.name;
      config.bulletinEnabled = true;
      saveConfig();
      await loadAudioSources();
      populatePanel();
      showToast("Boletín guardado en este teléfono");
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar el boletín");
    } finally {
      event.target.value = "";
    }
  }

  function bindPanel() {
    $("studioClose")?.addEventListener("click", closePanel);
    $("studioPanel")?.addEventListener("click", event => {
      if (event.target === $("studioPanel")) closePanel();
    });
    $("cfgMusicVolume")?.addEventListener("input", event => {
      const volume = Number(event.target.value) / 100;
      $("musicVolumeOutput").textContent = `${event.target.value}%`;
      if (!bulletinPlaying) backgroundMusic.volume = volume;
    });
    $("customMusicFile")?.addEventListener("change", handleMusicFile);
    $("bulletinFile")?.addEventListener("change", handleBulletinFile);

    $("useDefaultMusic")?.addEventListener("click", async () => {
      await deleteAudioBlob("music");
      config.customMusicName = "";
      saveConfig();
      await loadAudioSources();
      if (presentationStarted && config.musicEnabled) await startPresentationAudio();
      showToast("Música incluida activada");
    });

    $("testMusic")?.addEventListener("click", async () => {
      if (backgroundMusic.paused) {
        config.musicEnabled = true;
        $("cfgMusicEnabled").checked = true;
        backgroundMusic.volume = Number($("cfgMusicVolume").value) / 100;
        try { await backgroundMusic.play(); } catch (error) { showToast("El navegador bloqueó el audio"); }
      } else {
        backgroundMusic.pause();
      }
      updateAudioChip();
    });

    $("testBulletin")?.addEventListener("click", () => playBulletin({ test: true }));
    $("clearBulletin")?.addEventListener("click", async () => {
      bulletinAudio.pause();
      await deleteAudioBlob("bulletin");
      config.bulletinName = "";
      config.bulletinEnabled = false;
      saveConfig();
      await loadAudioSources();
      populatePanel();
      showToast("Boletín eliminado");
    });

    $("studioReset")?.addEventListener("click", () => {
      const keepAudioNames = {
        customMusicName: config.customMusicName,
        bulletinName: config.bulletinName
      };
      config = { ...cloneDefaults(), ...keepAudioNames };
      populatePanel();
      showToast("Contenido restablecido; tocá Guardar");
    });

    $("studioSave")?.addEventListener("click", async () => {
      readPanel();
      saveConfig();
      backgroundMusic.volume = config.musicVolume;
      bulletinAudio.volume = config.bulletinVolume;
      scheduleSlides();
      scheduleBulletin();
      closePanel();
      if (presentationStarted) await startPresentationAudio();
      showToast("Configuración guardada");
    });
  }

  async function init() {
    bindLongPress();
    bindPanel();
    populatePanel();
    await loadAudioSources();
    scheduleSlides();
    scheduleBulletin();

    window.addEventListener("central-presentation-started", startPresentationAudio);
    window.addEventListener("central-data-updated", () => {
      if (!panelOpen && slideIndex === 0) buildSlides();
    });

    document.addEventListener("pointerdown", () => {
      if (presentationStarted && config.musicEnabled && backgroundMusic.paused && !bulletinPlaying && !panelOpen) {
        startPresentationAudio();
      }
    }, { passive: true });

    if (sessionStorage.getItem("presentationStarted") === "1") {
      // Puede fallar hasta el primer toque; el listener anterior vuelve a intentarlo.
      startPresentationAudio();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
