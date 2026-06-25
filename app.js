/* ============================================================
   CENTRAL MUNDIALISTA 2026 - Lógica principal
   ============================================================ */

const API = "https://worldcup26.ir/get";
const REFRESH_MS = 60000;       // refresca datos cada 60s
const LIVE_ROTATION_MS = 60000; // cambia de partido en vivo cada 60s
const ARG_TZ = "America/Argentina/Buenos_Aires";
const ARG_TEAM_ID = "37";

// Estado global
let state = {
  games: [],
  teams: {},          // id -> team
  groups: {},         // nombre -> standings
  currentGroup: "A",
  groupOrder: ["A","B","C","D","E","F","G","H","I","J","K","L"],
  groupIndex: 0,
  lastUpdate: null,
  liveMatchIndex: 0,  // partido en vivo que se muestra cuando hay varios
};

// ============================================================
// CARGA DE DATOS DE LA API
// ============================================================
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

async function loadData() {
  try {
    const [gamesRes, teamsRes, groupsRes, stadiumsRes] = await Promise.all([
      fetchJSON(`${API}/games`),
      fetchJSON(`${API}/teams`),
      fetchJSON(`${API}/groups`),
      fetchJSON(`${API}/stadiums`),
    ]);

    // Indexar equipos por id
    const teamsMap = {};
    (teamsRes.teams || []).forEach(t => { teamsMap[t.id] = t; });
    state.teams = teamsMap;

    // Indexar estadios por id
    const stadiumsMap = {};
    (stadiumsRes.stadiums || []).forEach(s => { stadiumsMap[s.id] = s; });
    state.stadiums = stadiumsMap;

    // Indexar grupos por nombre
    const groupsMap = {};
    (groupsRes.groups || []).forEach(g => { groupsMap[g.name] = g; });
    state.groups = groupsMap;

    // Normalizar juegos
    state.games = (gamesRes.games || []).map(g => ({
      ...g,
      home_score_num: parseInt(g.home_score, 10) || 0,
      away_score_num: parseInt(g.away_score, 10) || 0,
      date: parseGameDate(g.local_date),
      isLive: g.time_elapsed === "live" || (g.time_elapsed && g.time_elapsed !== "finished" && g.time_elapsed !== "notstarted" && g.time_elapsed !== "NS" && !isNaN(parseInt(g.time_elapsed, 10))),
      isFinished: g.finished === "TRUE" || g.finished === true,
    }));

    state.lastUpdate = new Date();
    setLiveStatus("ok", "ACTUALIZADO");
    renderAll();
  } catch (err) {
    console.error("Error cargando datos:", err);
    setLiveStatus("error", "SIN CONEXIÓN");
    // reintentamos rápido
  }
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
        <span class="live-pulse"></span> TRANSMISIÓN EN VIVO · FASE DE GRUPOS
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
      <div class="countdown">QUEDATE QUE EMPIEZA PRONTO</div>
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
    `;
    return;
  }

  // Tomar el titular más reciente (último del array)
  const t = window.TITULARES[window.TITULARES.length - 1];
  el.innerHTML = `
    <span class="h-date">${t.fecha || formatDateLong(new Date())}</span>
    ${t.texto}
    <span class="h-source">${t.fuente || "Central Mundialista"}</span>
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
  const t = now.toLocaleTimeString("es-AR", opts);
  const dOpts = { weekday: "short", day: "numeric", month: "short", timeZone: ARG_TZ };
  const d = now.toLocaleDateString("es-AR", dOpts);
  document.getElementById("clock").textContent = `${d.toUpperCase()} ${t}`;
}

function setLiveStatus(type, text) {
  const badge = document.getElementById("liveStatus");
  const txt = document.getElementById("liveText");
  txt.textContent = text;
  if (type === "live") {
    badge.classList.add("live");
  } else if (type === "error") {
    badge.classList.remove("live");
  } else {
    badge.classList.remove("live");
  }
}

function formatDateLong(date) {
  if (!date) return "";
  const opts = { weekday: "long", day: "numeric", month: "long", timeZone: ARG_TZ };
  return date.toLocaleDateString("es-AR", opts);
}

// ============================================================
// RENDER GLOBAL
// ============================================================
function renderAll() {
  renderMatch();
  renderRecent();
  renderStandings();
  renderHeadline();
  renderTrivia();
  renderTicker();
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
async function init() {
  renderClock();
  setLiveStatus("loading", "CONECTANDO");
  await loadData();
  // Bucle de actualización
  setInterval(renderClock, 1000);          // reloj cada segundo
  setInterval(loadData, REFRESH_MS);       // datos cada 60s
  setInterval(rotateLiveMatch, LIVE_ROTATION_MS); // alternar partidos en vivo cada 60s
  setInterval(rotateGroup, 8000);          // rotar grupo cada 8s
  setInterval(renderTrivia, 45000);        // rotar adivinanza cada 45s
  setInterval(() => {
    // Re-render del partido cada 5s para refrescar el marcador
    renderMatch();
  }, 5000);
  // Setear a "EN VIVO" si hay partido live
  setInterval(() => {
    setLiveStatus(getLiveMatch() ? "live" : "ok",
                  getLiveMatch() ? "EN VIVO" : "ACTUALIZADO");
  }, 5000);
}

window.addEventListener("DOMContentLoaded", init);
