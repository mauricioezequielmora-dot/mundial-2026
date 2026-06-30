/* ============================================================
   CENTRAL MUNDIALISTA 2026 - Versión resistente para transmisión
   ============================================================ */

const API = "https://worldcup26.ir/get";
const REFRESH_MS = 60000;
const LIVE_ROTATION_MS = 60000;
const REQUEST_TIMEOUT_MS = 15000;
const STALE_WARNING_MS = 3 * 60 * 1000;
const WATCHDOG_RELOAD_MS = 12 * 60 * 1000;
const CACHE_KEY = "central-mundialista-datos-v2";
const ARG_TZ = "America/Argentina/Buenos_Aires";
const ARG_TEAM_ID = "37";
const SUPPORT_ALIAS = "labamdariver.nx";

let refreshTimer = null;
let retryAttempt = 0;
let initializedScores = false;
let freshBaselineReady = false;
let reloadIssued = false;
let lastHeartbeat = Date.now();
let subscribeTimer = null;

let state = {
  games: [],
  teams: {},
  groups: {},
  stadiums: {},
  currentGroup: "A",
  groupOrder: ["A","B","C","D","E","F","G","H","I","J","K","L"],
  groupIndex: 0,
  lastUpdate: null,
  lastAttempt: null,
  liveMatchIndex: 0,
  isLoading: false,
  lastScores: {},
  usingCachedData: false,
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function endpointHasData(name, payload) {
  if (!payload || typeof payload !== "object") return false;
  if (name === "games") return Array.isArray(payload.games) && payload.games.length > 0;
  if (name === "teams") return Array.isArray(payload.teams) && payload.teams.length > 0;
  if (name === "groups") return Array.isArray(payload.groups) && payload.groups.length > 0;
  if (name === "stadiums") return Array.isArray(payload.stadiums) && payload.stadiums.length > 0;
  return false;
}

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const separator = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${separator}_=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function readCachedPayloads() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    console.warn("No se pudo leer la copia local:", error);
    return null;
  }
}

function writeCachedPayloads(payloads, savedAt = Date.now()) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ payloads, savedAt }));
  } catch (error) {
    console.warn("No se pudo guardar la copia local:", error);
  }
}

function normalizeAndApply(payloads, { fromCache = false, updateTime = null } = {}) {
  const gamesRes = payloads.games || {};
  const teamsRes = payloads.teams || {};
  const groupsRes = payloads.groups || {};
  const stadiumsRes = payloads.stadiums || {};

  const teamsMap = {};
  safeArray(teamsRes.teams).forEach(team => {
    if (!team || team.id == null) return;
    const localFlag = window.CentralFlags?.resolve?.(team) || "";
    teamsMap[String(team.id)] = {
      ...team,
      api_flag: team.flag || "",
      flag: localFlag || team.flag || ""
    };
  });

  const stadiumsMap = {};
  safeArray(stadiumsRes.stadiums).forEach(stadium => {
    if (stadium && stadium.id != null) stadiumsMap[String(stadium.id)] = stadium;
  });

  const groupsMap = {};
  safeArray(groupsRes.groups).forEach(group => {
    if (group && group.name != null) groupsMap[String(group.name)] = group;
  });

  const normalizedGames = safeArray(gamesRes.games).map(game => ({
    ...game,
    home_team_id: String(game.home_team_id ?? ""),
    away_team_id: String(game.away_team_id ?? ""),
    stadium_id: String(game.stadium_id ?? ""),
    home_score_num: Number.parseInt(game.home_score, 10) || 0,
    away_score_num: Number.parseInt(game.away_score, 10) || 0,
    date: parseGameDate(game.local_date),
    isLive: game.time_elapsed === "live" || (
      game.time_elapsed &&
      game.time_elapsed !== "finished" &&
      game.time_elapsed !== "notstarted" &&
      game.time_elapsed !== "NS" &&
      !Number.isNaN(Number.parseInt(game.time_elapsed, 10))
    ),
    isFinished: game.finished === "TRUE" || game.finished === true,
  }));

  if (normalizedGames.length === 0) {
    throw new Error("La respuesta no contiene partidos");
  }

  const previousScores = { ...state.lastScores };
  const hadPreviousGames = state.games.length > 0;

  state.games = normalizedGames;
  if (Object.keys(teamsMap).length) state.teams = teamsMap;
  if (Object.keys(groupsMap).length) state.groups = groupsMap;
  if (Object.keys(stadiumsMap).length) state.stadiums = stadiumsMap;
  state.usingCachedData = fromCache;

  if (updateTime) state.lastUpdate = new Date(updateTime);

  detectGoals(previousScores, hadPreviousGames && initializedScores && freshBaselineReady && !fromCache);
  state.lastScores = buildScoreSnapshot(state.games);
  initializedScores = true;
  if (!fromCache) freshBaselineReady = true;
  renderAll();
  window.dispatchEvent(new CustomEvent("central-data-updated"));
}

function buildScoreSnapshot(games) {
  const snapshot = {};
  games.forEach(game => {
    snapshot[String(game.id)] = {
      home: game.home_score_num,
      away: game.away_score_num,
    };
  });
  return snapshot;
}

function detectGoals(previousScores, allowAlert) {
  if (!allowAlert) return;

  for (const game of state.games) {
    if (!game.isLive) continue;
    const previous = previousScores[String(game.id)];
    if (!previous) continue;

    const homeDelta = game.home_score_num - previous.home;
    const awayDelta = game.away_score_num - previous.away;
    if (homeDelta <= 0 && awayDelta <= 0) continue;

    const scoringTeamId = homeDelta > 0 ? game.home_team_id : game.away_team_id;
    const scoringTeam = state.teams[scoringTeamId];
    showGoalAlert(
      scoringTeam?.name_en || "Nuevo gol",
      `${game.home_score_num} - ${game.away_score_num}`
    );
    break;
  }
}

async function loadData() {
  if (state.isLoading) return;
  state.isLoading = true;
  state.lastAttempt = new Date();
  lastHeartbeat = Date.now();

  const names = ["games", "teams", "groups", "stadiums"];
  const requests = names.map(name => fetchJSON(`${API}/${name}`));
  const cachedContainer = readCachedPayloads();
  const cachedPayloads = cachedContainer?.payloads || {};

  try {
    const results = await Promise.allSettled(requests);
    const merged = {};
    let freshCount = 0;

    results.forEach((result, index) => {
      const name = names[index];
      if (result.status === "fulfilled" && endpointHasData(name, result.value)) {
        merged[name] = result.value;
        freshCount += 1;
      } else if (endpointHasData(name, cachedPayloads[name])) {
        merged[name] = cachedPayloads[name];
      }
    });

    if (!endpointHasData("games", merged.games)) {
      throw new Error("No hay datos de partidos disponibles");
    }

    const now = Date.now();
    const completelyFresh = freshCount === names.length;
    const hasFreshGames = results[0].status === "fulfilled" && endpointHasData("games", results[0].value);
    const effectiveUpdateTime = hasFreshGames ? now : (cachedContainer?.savedAt || state.lastUpdate?.getTime() || now);

    normalizeAndApply(merged, {
      fromCache: !hasFreshGames,
      updateTime: effectiveUpdateTime,
    });

    if (freshCount > 0) {
      writeCachedPayloads(merged, effectiveUpdateTime);
    }

    retryAttempt = 0;
    updateConnectionStatus(completelyFresh ? "fresh" : (hasFreshGames ? "partial" : "cached"));
    scheduleNextLoad(REFRESH_MS);
  } catch (error) {
    console.error("Error cargando datos:", error);

    if (state.games.length === 0 && endpointHasData("games", cachedPayloads.games)) {
      try {
        normalizeAndApply(cachedPayloads, {
          fromCache: true,
          updateTime: cachedContainer?.savedAt || Date.now(),
        });
      } catch (cacheError) {
        console.error("La copia local también falló:", cacheError);
      }
    }

    retryAttempt += 1;
    updateConnectionStatus(state.games.length ? "cached" : "offline");
    const retryDelay = Math.min(REFRESH_MS, 10000 * Math.pow(2, Math.min(retryAttempt - 1, 3)));
    scheduleNextLoad(retryDelay);
  } finally {
    state.isLoading = false;
    lastHeartbeat = Date.now();
  }
}

function scheduleNextLoad(delay) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(loadData, delay);
}

function restoreLocalData() {
  const cached = readCachedPayloads();
  if (!cached?.payloads || !endpointHasData("games", cached.payloads.games)) return false;
  try {
    normalizeAndApply(cached.payloads, {
      fromCache: true,
      updateTime: cached.savedAt || Date.now(),
    });
    updateConnectionStatus("cached");
    return true;
  } catch (error) {
    console.warn("No se pudo restaurar la copia local:", error);
    return false;
  }
}

function showGoalAlert(teamName, score) {
  const overlay = document.getElementById("goalAlert");
  const team = document.getElementById("goalTeam");
  const scoreEl = document.getElementById("goalScore");
  if (!overlay || !team || !scoreEl) return;

  team.textContent = teamName;
  scoreEl.textContent = score;
  overlay.classList.add("show");
  clearTimeout(showGoalAlert.timer);
  showGoalAlert.timer = setTimeout(() => overlay.classList.remove("show"), 8000);
}

function showSubscribeAlert() {
  const overlay = document.getElementById("subscribeAlert");
  if (!overlay) return;
  overlay.classList.add("show");
  clearTimeout(showSubscribeAlert.timer);
  showSubscribeAlert.timer = setTimeout(() => overlay.classList.remove("show"), 12000);
}

// La API da fechas tipo "06/11/2026 13:00" (MM/DD/YYYY HH:MM)
// Horario local de la sede. Lo tratamos como tal.
function parseGameDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, min] = m;
  // Las fechas de la API son horario de la sede. Para mostrar
  // "próximo partido" usamos diferencia relativa al reloj del dispositivo.
  // Asumimos MM/DD/YYYY como da la API (formato US).
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
}

// ============================================================
// DETECCIÓN DE PARTIDO EN VIVO / PRÓXIMO
// ============================================================
function getLiveMatches() {
  return state.games
    .filter(g => g.isLive)
    .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
}

function getLiveMatch() {
  const liveMatches = getLiveMatches();
  if (liveMatches.length === 0) return null;
  state.liveMatchIndex = state.liveMatchIndex % liveMatches.length;
  return liveMatches[state.liveMatchIndex];
}

function rotateLiveMatch() {
  const liveMatches = getLiveMatches();
  if (liveMatches.length <= 1) {
    state.liveMatchIndex = 0;
    return;
  }
  state.liveMatchIndex = (state.liveMatchIndex + 1) % liveMatches.length;
  renderMatch();
}

function getNextMatch() {
  const now = Date.now();
  // Primero: partidos no empezados (notstarted), ordenados por ID (secuencia del torneo)
  const notStarted = state.games
    .filter(g => !g.isFinished && !g.isLive && (g.time_elapsed === "notstarted" || g.time_elapsed === "NS" || !g.time_elapsed))
    .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  if (notStarted.length > 0) return notStarted[0];
  // Fallback: usar fecha (menos fiable por timezone de sedes)
  const upcoming = state.games
    .filter(g => !g.isFinished && !g.isLive && g.date && g.date.getTime() > now)
    .sort((a, b) => a.date - b.date);
  return upcoming[0] || null;
}

function getRecentMatches() {
  return state.games
    .filter(g => g.isFinished)
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, 3);
}

// ============================================================
// RENDER PARTIDO EN VIVO / PRÓXIMO
// ============================================================
function renderMatch() {
  const live = getLiveMatch();
  const next = getNextMatch();
  const card = document.getElementById("matchCard");
  const header = document.getElementById("matchCardHeader");
  const body = document.getElementById("matchBody");

  if (live) {
    renderLiveMatch(live, header, body, card);
  } else if (next) {
    renderNextMatch(next, header, body, card);
  } else {
    header.innerHTML = `<span>SIN PARTIDOS</span><span></span>`;
    body.innerHTML = `<div class="match-meta">No hay partidos programados.<br>Revisa el calendario.</div>`;
  }
}

// === PARTIDO EN VIVO === (vista detallada para mantener a la gente mirando)
function renderLiveMatch(live, header, body, card) {
  const home = state.teams[live.home_team_id];
  const away = state.teams[live.away_team_id];
  const stadium = state.stadiums[live.stadium_id];

  const liveMatches = getLiveMatches();
  const rotationLabel = liveMatches.length > 1
    ? ` · ${state.liveMatchIndex + 1}/${liveMatches.length}`
    : "";

  header.innerHTML = `
    <span>${live.group ? "GRUPO " + live.group : (live.type || "").toUpperCase()}</span>
    <span class="live-min live-blink">● EN VIVO${rotationLabel}</span>
  `;

  const stadiumInfo = stadium ? `
    <div class="match-stadium">
      📍 ${stadium.name_en} · ${stadium.city_en} · ${stadium.capacity.toLocaleString()} personas
    </div>` : "";

  body.innerHTML = `
    <div class="live-wrap fade-update">
      <div class="live-banner">
        <span class="live-pulse"></span> CENTRAL DE RESULTADOS · ${live.group ? "GRUPO " + live.group : escapeForDisplay(live.type || "MUNDIAL")}
      </div>

      <div class="live-scoreboard">
        <div class="live-team ${live.home_team_id === ARG_TEAM_ID ? "arg-highlight" : ""}">
          <img src="${home?.flag}" onerror="this.style.display='none'">
          <div class="lt-name">${home?.name_en || "?"}</div>
        </div>
        <div class="live-score">
          <span class="ls-home">${live.home_score_num}</span>
          <span class="ls-sep">:</span>
          <span class="ls-away">${live.away_score_num}</span>
        </div>
        <div class="live-team ${live.away_team_id === ARG_TEAM_ID ? "arg-highlight" : ""}">
          <img src="${away?.flag}" onerror="this.style.display='none'">
          <div class="lt-name">${away?.name_en || "?"}</div>
        </div>
      </div>

      ${renderLiveScorers(live, home, away)}

      ${stadiumInfo}

      <div class="live-stats-mini">
        <div class="stat-pill">⚽ ${parseInt(live.home_score_num) + parseInt(live.away_score_num)} goles</div>
        <div class="stat-pill">🏆 ${live.group ? "Grupo " + live.group : "Mundial"}</div>
      </div>
    </div>
  `;
  card.classList.add("live-border");
}

function renderLiveScorers(match, home, away) {
  const parseList = (s) => {
    if (!s || s === "null") return [];
    try {
      const cleaned = s.replace(/[{}"]/g, "").split(",").map(x => x.trim()).filter(Boolean);
      return cleaned;
    } catch { return []; }
  };
  const homeScorers = parseList(match.home_scorers);
  const awayScorers = parseList(match.away_scorers);
  if (homeScorers.length === 0 && awayScorers.length === 0) return "";

  return `
    <div class="live-scorers">
      <div class="scorer-col">
        <div class="scorer-team">${home?.name_en || "Local"}</div>
        ${homeScorers.map(s => `<div class="scorer-item">⚽ ${decodeEntities(s)}</div>`).join("") || '<div class="scorer-item empty">Sin goles</div>'}
      </div>
      <div class="scorer-col">
        <div class="scorer-team">${away?.name_en || "Visitante"}</div>
        ${awayScorers.map(s => `<div class="scorer-item">⚽ ${decodeEntities(s)}</div>`).join("") || '<div class="scorer-item empty">Sin goles</div>'}
      </div>
    </div>
  `;
}

// === PRÓXIMO PARTIDO === (solo cuando no hay vivo)
function renderNextMatch(next, header, body, card) {
  const home = state.teams[next.home_team_id];
  const away = state.teams[next.away_team_id];
  const stadium = state.stadiums[next.stadium_id];

  header.innerHTML = `
    <span>${next.group ? "GRUPO " + next.group : (next.type || "PRÓXIMO").toUpperCase()}</span>
    <span class="live-min">PRÓXIMO</span>
  `;
  const matchDate = next.local_date || (next.date ? formatDateLong(next.date) : "Fecha por confirmar");
  const stadiumInfo = stadium ? `
    <div class="match-stadium">
      📍 ${stadium.name_en} · ${stadium.city_en} · ${stadium.capacity.toLocaleString()} personas
    </div>` : "";

  body.innerHTML = `
    <div class="fade-update">
      <div class="next-banner">⏰ PRÓXIMO PARTIDO</div>
      <div class="match-teams">
        ${renderTeam(home, next.home_team_id === ARG_TEAM_ID ? "arg" : "")}
        <div class="score">
          <span style="color:var(--text-dim)">VS</span>
        </div>
        ${renderTeam(away, next.away_team_id === ARG_TEAM_ID ? "arg" : "")}
      </div>
      <div class="match-meta">
        <span class="stage">${matchDate}</span>
      </div>
      ${stadiumInfo}
      <div class="countdown" id="nextCountdown">${next.date ? renderCountdown(next.date) : "QUEDATE QUE EMPIEZA PRONTO"}</div>
    </div>
  `;
  card.classList.remove("live-border");
}

function renderTeam(team, extra) {
  if (!team) return `<div class="team"><div class="team-name">?</div></div>`;
  return `
    <div class="team ${extra}">
      <img src="${team.flag}" alt="${team.name_en}" onerror="this.style.display='none'">
      <div class="team-name">${team.name_en}</div>
    </div>
  `;
}

function renderScorers(match) {
  const parseList = (s) => {
    if (!s || s === "null") return [];
    try {
      const cleaned = s.replace(/[{}"]/g, "").split(",").map(x => x.trim()).filter(Boolean);
      return cleaned;
    } catch { return []; }
  };
  const home = parseList(match.home_scorers);
  const away = parseList(match.away_scorers);
  if (home.length === 0 && away.length === 0) return "";
  const fmt = (list) => list.map(s => `⚽ ${decodeEntities(s)}`).join("<br>");
  return `
    <div class="scorers">
      ${fmt(home)}
      ${away.length ? (home.length ? "<br>" : "") + fmt(away) : ""}
    </div>
  `;
}

// Fix encoding roto que viene en la API (caracteres raros)
function escapeForDisplay(value) {
  return String(value ?? "").replace(/[<>&"']/g, "");
}

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/Ã¡/g, "á").replace(/Ã©/g, "é").replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó").replace(/Ãº/g, "ú").replace(/Ã±/g, "ñ")
    .replace(/Ã'/g, "Ñ").replace(/â??/g, "").replace(/â?o/g, "")
    .replace(/Ã/g, "").replace(/Ä/g, "");
}

function renderCountdown(date) {
  if (!date) return "";
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "Comenzando...";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `Faltan ${d}d ${h}h ${m}m`;
  if (h > 0) return `Empieza en ${h}h ${m}m ${s}s`;
  return `Empieza en ${m}m ${s}s`;
}

// ============================================================
// RENDER RESULTADOS RECIENTES
// ============================================================
function renderRecent() {
  const list = getRecentMatches();
  const el = document.getElementById("recentList");
  if (list.length === 0) {
    el.innerHTML = `<div class="loading-small">Aún no hay resultados.</div>`;
    return;
  }
  el.innerHTML = list.map(g => {
    const home = state.teams[g.home_team_id];
    const away = state.teams[g.away_team_id];
    return `
      <div class="recent-item">
        <div class="r-team home">
          <span>${home?.name_en || "?"}</span>
          <img src="${home?.flag || ''}" onerror="this.style.display='none'">
        </div>
        <div class="r-score">${g.home_score_num} - ${g.away_score_num}</div>
        <div class="r-team">
          <img src="${away?.flag || ''}" onerror="this.style.display='none'">
          <span>${away?.name_en || "?"}</span>
        </div>
      </div>
    `;
  }).join("");
}

// ============================================================
// RENDER TABLA DE GRUPOS (rota cada 8s)
// ============================================================
function renderStandings() {
  const groupName = state.currentGroup;
  const group = state.groups[groupName];
  const el = document.getElementById("standingsList");
  const nav = document.getElementById("groupNav");
  nav.textContent = `GRUPO ${groupName} · ${state.groupIndex + 1}/${state.groupOrder.length}`;

  if (!group || !group.teams) {
    el.innerHTML = `<div class="loading-small">Sin datos del grupo ${groupName}</div>`;
    return;
  }

  // Ordenar: pts desc, gd desc, gf desc
  const sorted = [...group.teams].sort((a, b) => {
    const pa = parseInt(a.pts), pb = parseInt(b.pts);
    if (pb !== pa) return pb - pa;
    const gda = parseInt(a.gd), gdb = parseInt(b.gd);
    if (gdb !== gda) return gdb - gda;
    return parseInt(b.gf) - parseInt(a.gf);
  });

  const header = `
    <div class="stand-row stand-header">
      <span class="pos">#</span>
      <span></span>
      <span class="name">EQUIPO</span>
      <span>PJ</span>
      <span>DG</span>
      <span>PTS</span>
    </div>
  `;

  el.innerHTML = header + sorted.map((t, i) => {
    const team = state.teams[t.team_id];
    const cls = i < 2 ? "q1" : (i < 4 ? "" : "elim");
    const argHi = (t.team_id === ARG_TEAM_ID) ? "arg-highlight" : "";
    return `
      <div class="stand-row ${cls} ${argHi}">
        <span class="pos">${i + 1}</span>
        <img src="${team?.flag || ''}" onerror="this.style.display='none'">
        <span class="name">${team?.name_en || "?"}</span>
        <span>${t.mp}</span>
        <span class="gd">${parseInt(t.gd) > 0 ? '+' : ''}${t.gd}</span>
        <span class="pts">${t.pts}</span>
      </div>
    `;
  }).join("");
}

function rotateGroup() {
  state.groupIndex = (state.groupIndex + 1) % state.groupOrder.length;
  state.currentGroup = state.groupOrder[state.groupIndex];
  renderStandings();
}

// ============================================================
// TITULARES (lo edita el usuario en titulares.js)
// ============================================================
// En GitHub Pages (estático) el titular sale directo del archivo
// titulares.js. Para cambiarlo, editás el archivo y subís el cambio
// a GitHub. Se ve en el stream en 1-2 minutos.

function renderHeadline() {
  const el = document.getElementById("headlineContent");

  if (typeof window.TITULARES === "undefined" || !window.TITULARES.length) {
    // Vacío: mostrar cuadro limpio esperando contenido
    el.innerHTML = `
      <span class="h-date">${formatDateLong(new Date())}</span>
      <span class="h-placeholder">Editá titulares.js y subí el cambio a GitHub</span>
      <span class="support-alias"><span>APOYÁ ESTE PROYECTO</span><strong>Alias: ${SUPPORT_ALIAS}</strong><small>Aporte voluntario</small></span>
    `;
    return;
  }

  // Tomar el titular más reciente (último del array)
  const t = window.TITULARES[window.TITULARES.length - 1];
  el.innerHTML = `
    <span class="h-date">${t.fecha || formatDateLong(new Date())}</span>
    ${t.texto}
    <span class="h-source">${t.fuente || "Central Mundialista"}</span>
    <span class="support-alias"><span>APOYÁ ESTE PROYECTO</span><strong>Alias: ${SUPPORT_ALIAS}</strong><small>Aporte voluntario</small></span>
  `;
}

// ============================================================
// ADIVINANZAS (rotan cada 45s)
// ============================================================
let triviaIdx = 0;
function renderTrivia() {
  const el = document.getElementById("triviaContent");
  if (typeof window.PREGUNTAS === "undefined" || !window.PREGUNTAS.length) {
    el.innerHTML = `<div class="loading-small">Editá preguntas.js</div>`;
    return;
  }
  const q = window.PREGUNTAS[triviaIdx % window.PREGUNTAS.length];
  el.innerHTML = `
    <div class="trivia-question">${q.pregunta}</div>
    <div class="trivia-options">
      ${q.opciones.map((o, i) => `
        <div class="trivia-opt">
          <span class="letter">${String.fromCharCode(65 + i)}</span>
          <span>${o}</span>
        </div>
      `).join("")}
    </div>
    <div class="trivia-hint">Respondé en el chat · Respuesta en el próximo cambio</div>
  `;
  triviaIdx++;
}

// ============================================================
// TICKER DE CURIOSIDADES (barra inferior)
// ============================================================
function renderTicker() {
  const el = document.getElementById("tickerContent");
  if (typeof window.CURIOSIDADES === "undefined" || !window.CURIOSIDADES.length) {
    el.textContent = "Editá curiosidades.js para agregar datos curiosos del Mundial.  ·  ¡Suscribite al canal!  ·  ";
    return;
  }
  // Separamos con un separador visible
  const sep = "   ★   ";
  el.textContent = window.CURIOSIDADES.join(sep) + sep;
}

// ============================================================
// RELOJ Y ESTADO
// ============================================================
function renderClock() {
  const now = new Date();
  const opts = { hour: "2-digit", minute: "2-digit", timeZone: ARG_TZ, hour12: false };
  const time = now.toLocaleTimeString("es-AR", opts);
  const dateOpts = { weekday: "short", day: "numeric", month: "short", timeZone: ARG_TZ };
  const date = now.toLocaleDateString("es-AR", dateOpts);
  const clock = document.getElementById("clock");
  if (clock) clock.textContent = `${date.toUpperCase()} ${time}`;
}

function formatUpdateTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ARG_TZ,
    hour12: false,
  });
}

function setLiveStatus(type, text) {
  const badge = document.getElementById("liveStatus");
  const txt = document.getElementById("liveText");
  if (!badge || !txt) return;

  txt.textContent = text;
  badge.classList.remove("live", "warning", "error", "loading");
  badge.classList.add(type);
}

function updateConnectionStatus(mode = null) {
  const age = state.lastUpdate ? Date.now() - state.lastUpdate.getTime() : Infinity;
  const live = getLiveMatches().length > 0;

  if (!navigator.onLine || mode === "offline") {
    const suffix = state.lastUpdate ? ` · ${formatUpdateTime(state.lastUpdate)}` : "";
    setLiveStatus("error", `SIN CONEXIÓN${suffix}`);
    return;
  }

  if (state.isLoading && !state.lastUpdate) {
    setLiveStatus("loading", "CONECTANDO");
    return;
  }

  if (mode === "cached" || age > STALE_WARNING_MS) {
    const minutes = Number.isFinite(age) ? Math.max(1, Math.floor(age / 60000)) : 0;
    setLiveStatus("warning", minutes ? `DATOS ${minutes} MIN` : "REINTENTANDO");
    return;
  }

  if (mode === "partial") {
    setLiveStatus("warning", `ACTUALIZACIÓN PARCIAL · ${formatUpdateTime(state.lastUpdate)}`);
    return;
  }

  if (live) {
    setLiveStatus("live", `EN VIVO · ${formatUpdateTime(state.lastUpdate)}`);
  } else {
    setLiveStatus("ok", `ACTUALIZADO · ${formatUpdateTime(state.lastUpdate)}`);
  }
}

function formatDateLong(date) {
  if (!date) return "";
  const opts = { weekday: "long", day: "numeric", month: "long", timeZone: ARG_TZ };
  return date.toLocaleDateString("es-AR", opts);
}

function renderAll() {
  renderMatch();
  renderRecent();
  renderStandings();
  renderHeadline();
  renderTrivia();
  renderTicker();
}

function watchdogTick() {
  lastHeartbeat = Date.now();
  updateConnectionStatus();

  if (document.visibilityState !== "visible") return;
  if (!state.lastAttempt) return;

  const sinceSuccess = state.lastUpdate ? Date.now() - state.lastUpdate.getTime() : Infinity;
  const shouldReload = sinceSuccess > WATCHDOG_RELOAD_MS && retryAttempt >= 4;

  if (shouldReload && !reloadIssued) {
    reloadIssued = true;
    location.reload();
  }
}

async function init() {
  renderClock();
  setLiveStatus("loading", "CONECTANDO");
  restoreLocalData();
  await loadData();

  setInterval(renderClock, 1000);
  setInterval(rotateLiveMatch, LIVE_ROTATION_MS);
  setInterval(rotateGroup, 8000);
  setInterval(renderTrivia, 45000);
  setInterval(() => {
    renderMatch();
    const countdown = document.getElementById("nextCountdown");
    const next = getNextMatch();
    if (countdown && next?.date) countdown.textContent = renderCountdown(next.date);
  }, 5000);
  setInterval(watchdogTick, 30000);

  subscribeTimer = setInterval(showSubscribeAlert, 10 * 60 * 1000);
  setTimeout(showSubscribeAlert, 4 * 60 * 1000);

  window.addEventListener("online", () => {
    retryAttempt = 0;
    setLiveStatus("loading", "RECONECTANDO");
    loadData();
  });

  window.addEventListener("offline", () => updateConnectionStatus("offline"));

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      reloadIssued = false;
      loadData();
    }
  });
}


window.CentralData = {
  getState: () => state,
  forceRefresh: () => loadData(),
};

window.addEventListener("error", event => {
  console.error("Error global:", event.error || event.message);
  updateConnectionStatus(state.games.length ? "cached" : "offline");
});

window.addEventListener("unhandledrejection", event => {
  console.error("Promesa rechazada:", event.reason);
  updateConnectionStatus(state.games.length ? "cached" : "offline");
});

window.addEventListener("DOMContentLoaded", init);
