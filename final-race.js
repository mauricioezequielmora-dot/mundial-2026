/* ============================================================
   CARRERA A LA FINAL · Señal visual automática
   - Usa datos confirmados por la API o por la última copia local.
   - No inventa clasificados: si no puede confirmar, muestra estado pendiente.
   - Mantiene los carriles y marca eliminados cuando el resultado lo permite.
   ============================================================ */

(() => {
  "use strict";

  const MAX_LANES = 8;
  const RENDER_MS = 12000;
  const ARG_TZ = "America/Argentina/Buenos_Aires";

  let frame = 0;
  let lastStableLaneKeys = [];
  let timer = null;
  let motionFrame = null;

  const FLAG_ASSET = {
    "Sudáfrica": "za", "South Africa": "za",
    "Canadá": "ca", "Canada": "ca",
    "Brasil": "br", "Brazil": "br",
    "Japón": "jp", "Japan": "jp",
    "Alemania": "de", "Germany": "de",
    "Paraguay": "py",
    "Países Bajos": "nl", "Netherlands": "nl", "Holland": "nl",
    "Marruecos": "ma", "Morocco": "ma",
    "Costa de Marfil": "ci", "Ivory Coast": "ci", "Côte d'Ivoire": "ci", "Cote d'Ivoire": "ci",
    "Noruega": "no", "Norway": "no",
    "Francia": "fr", "France": "fr",
    "Suecia": "se", "Sweden": "se",
    "México": "mx", "Mexico": "mx",
    "Ecuador": "ec",
    "Inglaterra": "eng", "England": "eng",
    "RD Congo": "cd", "DR Congo": "cd", "Congo DR": "cd", "Democratic Republic of the Congo": "cd",
    "Bélgica": "be", "Belgium": "be",
    "Senegal": "sn",
    "Estados Unidos": "us", "United States": "us", "USA": "us", "United States of America": "us",
    "Bosnia y Herzegovina": "ba", "Bosnia and Herzegovina": "ba", "Bosnia-Herzegovina": "ba",
    "España": "es", "Spain": "es",
    "Austria": "at",
    "Portugal": "pt",
    "Croacia": "hr", "Croatia": "hr",
    "Suiza": "ch", "Switzerland": "ch",
    "Argelia": "dz", "Algeria": "dz",
    "Australia": "au",
    "Egipto": "eg", "Egypt": "eg",
    "Argentina": "ar",
    "Cabo Verde": "cv", "Cape Verde": "cv", "Cabo Verde Islands": "cv",
    "Colombia": "co",
    "Ghana": "gh"
  };

  const NAME_ES = {
    "South Africa": "Sudáfrica",
    "Canada": "Canadá",
    "Brazil": "Brasil",
    "Japan": "Japón",
    "Germany": "Alemania",
    "Paraguay": "Paraguay",
    "Netherlands": "Países Bajos",
    "Holland": "Países Bajos",
    "Morocco": "Marruecos",
    "Ivory Coast": "Costa de Marfil",
    "Côte d'Ivoire": "Costa de Marfil",
    "Cote d'Ivoire": "Costa de Marfil",
    "Norway": "Noruega",
    "France": "Francia",
    "Sweden": "Suecia",
    "Mexico": "México",
    "Ecuador": "Ecuador",
    "England": "Inglaterra",
    "DR Congo": "RD Congo",
    "Congo DR": "RD Congo",
    "Democratic Republic of the Congo": "RD Congo",
    "Belgium": "Bélgica",
    "Senegal": "Senegal",
    "United States": "Estados Unidos",
    "USA": "Estados Unidos",
    "United States of America": "Estados Unidos",
    "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Bosnia-Herzegovina": "Bosnia y Herzegovina",
    "Spain": "España",
    "Austria": "Austria",
    "Portugal": "Portugal",
    "Croatia": "Croacia",
    "Switzerland": "Suiza",
    "Algeria": "Argelia",
    "Australia": "Australia",
    "Egypt": "Egipto",
    "Argentina": "Argentina",
    "Cape Verde": "Cabo Verde",
    "Cabo Verde Islands": "Cabo Verde",
    "Colombia": "Colombia",
    "Ghana": "Ghana"
  };

  const EVENTS = [
    "acelera por la banda",
    "salta el obstáculo",
    "rueda con efecto",
    "pisa césped rápido",
    "esquiva la pelota",
    "gira y sigue",
    "toma impulso",
    "mantiene el carril"
  ];

  const OBSTACLES = ["valla", "cono", "barro", "pelota", "viento"];

  const KIT_COLORS = {
    ar: ["#75aadb", "#ffffff", "#f6c34a"],
    ch: ["#e30613", "#ffffff", "#ffffff"],
    eng: ["#ffffff", "#c8102e", "#1f4fa3"],
    no: ["#ba0c2f", "#ffffff", "#00205b"],
    be: ["#111111", "#fdda24", "#ef3340"],
    es: ["#c60b1e", "#ffc400", "#ffc400"],
    fr: ["#1d4ed8", "#ffffff", "#ef4444"],
    ma: ["#c1272d", "#006233", "#006233"],
    br: ["#f7d117", "#009739", "#002776"],
    jp: ["#ffffff", "#bc002d", "#bc002d"],
    de: ["#ffffff", "#111111", "#dd0000"],
    py: ["#d52b1e", "#ffffff", "#0038a8"],
    nl: ["#f36c21", "#ffffff", "#21468b"],
    ci: ["#f77f00", "#ffffff", "#009e60"],
    mx: ["#006847", "#ffffff", "#ce1126"],
    ec: ["#ffd100", "#003893", "#ce1126"],
    us: ["#3c3b6e", "#ffffff", "#b22234"],
    pt: ["#006600", "#ff0000", "#ffcc00"],
    co: ["#fcd116", "#003893", "#ce1126"],
    gh: ["#fcd116", "#006b3f", "#ce1126"],
    sn: ["#00853f", "#fdef42", "#e31b23"],
    za: ["#007a4d", "#ffb612", "#de3831"],
    ca: ["#ff0000", "#ffffff", "#ffffff"],
    se: ["#006aa7", "#fecc00", "#fecc00"],
    hr: ["#ffffff", "#171796", "#ff0000"],
    au: ["#00247d", "#ffffff", "#ffcd00"],
    eg: ["#ce1126", "#ffffff", "#000000"],
    dz: ["#006233", "#ffffff", "#d21034"],
    at: ["#ed2939", "#ffffff", "#ffffff"],
    ba: ["#002395", "#fecb00", "#ffffff"],
    cd: ["#007fff", "#f7d618", "#ce1021"],
    cv: ["#003893", "#ffffff", "#cf2027"]
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function decodeApiText(value) {
    return String(value ?? "")
      .replace(/Ã¡/g, "á").replace(/Ã©/g, "é").replace(/Ã­/g, "í")
      .replace(/Ã³/g, "ó").replace(/Ãº/g, "ú").replace(/Ã±/g, "ñ")
      .replace(/Ã‘/g, "Ñ").replace(/Ã/g, "");
  }

  function normalize(value) {
    return decodeApiText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function getState() {
    try {
      if (window.CentralData && typeof window.CentralData.getState === "function") {
        return window.CentralData.getState();
      }
    } catch (error) {
      console.warn("No se pudo leer CentralData:", error);
    }
    return null;
  }

  function readTeam(id, state) {
    const team = state?.teams?.[String(id)];
    if (!team) return null;
    return team;
  }

  function displayName(team) {
    if (!team) return "Equipo por confirmar";
    const raw = decodeApiText(team.name_en || team.name || team.name_fa || team.code || "Equipo");
    return NAME_ES[raw] || raw;
  }

  function teamKey(team, fallbackId) {
    if (team?.id != null) return `id:${team.id}`;
    return `name:${normalize(displayName(team) || fallbackId || "equipo")}`;
  }

  function getFlagCode(team) {
    const name = displayName(team);
    const raw = decodeApiText(team?.name_en || team?.name || "");
    return FLAG_ASSET[name] || FLAG_ASSET[raw] || null;
  }

  function flagMarkup(team) {
    const name = displayName(team);
    const code = getFlagCode(team);
    if (code) {
      return `<img src="./flags/${code}.png" alt="${escapeHtml(name)}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${escapeHtml(name.slice(0, 3).toUpperCase())}'))">`;
    }
    return `<span class="race-flag-fallback">${escapeHtml(name.slice(0, 3).toUpperCase())}</span>`;
  }

  function isKnockoutGame(game) {
    const id = Number.parseInt(game?.id, 10);
    const type = normalize(game?.type || "");
    return id >= 73 || /ronda|round|dieciseisavos|octavos|cuartos|quarter|semi|final|knockout/.test(type);
  }

  function isFinished(game) {
    return game?.isFinished || game?.finished === true || game?.finished === "TRUE" || normalize(game?.time_elapsed) === "finished";
  }

  function winnerId(game) {
    const possibleWinner = game?.winner_team_id || game?.winner_id || game?.winner;
    if (possibleWinner && String(possibleWinner) !== "0" && String(possibleWinner).toLowerCase() !== "null") {
      const winnerText = String(possibleWinner);
      if (winnerText === String(game.home_team_id) || winnerText === String(game.away_team_id)) {
        return winnerText;
      }

      const state = getState();
      const homeTeam = readTeam(game.home_team_id, state);
      const awayTeam = readTeam(game.away_team_id, state);
      const normalizedWinner = normalize(winnerText);
      if (homeTeam && normalize(displayName(homeTeam)) === normalizedWinner) return String(game.home_team_id);
      if (awayTeam && normalize(displayName(awayTeam)) === normalizedWinner) return String(game.away_team_id);
    }

    if (!isFinished(game)) return null;

    const homeScore = Number.parseInt(game?.home_score_num ?? game?.home_score, 10);
    const awayScore = Number.parseInt(game?.away_score_num ?? game?.away_score, 10);

    if (Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore) {
      return homeScore > awayScore ? String(game.home_team_id) : String(game.away_team_id);
    }

    const homePens = Number.parseInt(game?.home_penalties ?? game?.home_penalty ?? game?.home_penalty_score, 10);
    const awayPens = Number.parseInt(game?.away_penalties ?? game?.away_penalty ?? game?.away_penalty_score, 10);
    if (Number.isFinite(homePens) && Number.isFinite(awayPens) && homePens !== awayPens) {
      return homePens > awayPens ? String(game.home_team_id) : String(game.away_team_id);
    }

    return null;
  }

  function gameScore(game) {
    const homeScore = Number.parseInt(game?.home_score_num ?? game?.home_score, 10);
    const awayScore = Number.parseInt(game?.away_score_num ?? game?.away_score, 10);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return "";
    return `${homeScore}-${awayScore}`;
  }

  function parseGameDate(game) {
    const raw = game?.local_date;
    if (!raw) return null;
    const match = String(raw).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, mm, dd, yyyy, hh, min] = match;
    const date = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatShortDate(date) {
    if (!date) return "";
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ARG_TZ,
      hour12: false
    }).replace(",", " ·");
  }

  function buildEntriesFromApi(state) {
    const games = Array.isArray(state?.games) ? state.games.filter(isKnockoutGame) : [];
    const entries = new Map();

    function ensureEntry(teamId) {
      const team = readTeam(teamId, state);
      if (!team) return null;
      const key = teamKey(team, teamId);
      if (!entries.has(key)) {
        entries.set(key, {
          key,
          id: String(teamId),
          team,
          name: displayName(team),
          eliminated: false,
          confirmed: true,
          lastGameId: 0,
          lastGameLabel: "",
          lastScore: "",
          live: false,
          upcoming: false
        });
      }
      return entries.get(key);
    }

    games.forEach(game => {
      const home = ensureEntry(game.home_team_id);
      const away = ensureEntry(game.away_team_id);
      const id = Number.parseInt(game.id, 10) || 0;
      const score = gameScore(game);
      const typeLabel = decodeApiText(game.type || "Eliminatoria");
      [home, away].forEach(entry => {
        if (!entry) return;
        if (id >= entry.lastGameId) {
          entry.lastGameId = id;
          entry.lastGameLabel = typeLabel || "Eliminatoria";
          entry.lastScore = score;
        }
        if (game.isLive) entry.live = true;
        if (!isFinished(game) && !game.isLive) entry.upcoming = true;
      });

      const winner = winnerId(game);
      if (!winner || !home || !away) return;

      const loserId = String(winner) === String(game.home_team_id) ? String(game.away_team_id) : String(game.home_team_id);
      const loser = String(loserId) === String(game.home_team_id) ? home : away;
      const winnerEntry = String(winner) === String(game.home_team_id) ? home : away;

      if (winnerEntry) {
        winnerEntry.eliminated = false;
        winnerEntry.winner = true;
        winnerEntry.lastScore = score;
      }
      if (loser) {
        loser.eliminated = true;
        loser.eliminatedGameId = id;
        loser.lastScore = score;
        loser.live = false;
        loser.upcoming = false;
      }
    });

    return Array.from(entries.values()).filter(entry => entry.confirmed);
  }

  function buildFallbackFromCamino() {
    const fixtures = Array.isArray(window.CaminoCopa?.fixtures) ? window.CaminoCopa.fixtures : [];
    return fixtures.slice(0, MAX_LANES).map((fixture, index) => {
      const name = fixture.home || `Carril ${index + 1}`;
      const pseudoTeam = { id: `fixture-${index}`, name_en: name };
      return {
        key: `fixture-${index}`,
        id: `fixture-${index}`,
        team: pseudoTeam,
        name,
        eliminated: false,
        confirmed: false,
        lastGameId: Number.parseInt(fixture.id, 10) || 0,
        lastGameLabel: "",
        lastScore: "",
        live: false,
        upcoming: true
      };
    });
  }

  function selectRaceLanes(entries) {
    const alive = entries
      .filter(entry => !entry.eliminated)
      .sort((a, b) => {
        if (a.live !== b.live) return a.live ? -1 : 1;
        if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
        return b.lastGameId - a.lastGameId || a.name.localeCompare(b.name, "es");
      });

    const eliminated = entries
      .filter(entry => entry.eliminated)
      .sort((a, b) => b.eliminatedGameId - a.eliminatedGameId || a.name.localeCompare(b.name, "es"));

    const lanes = alive.slice(0, MAX_LANES);
    for (const entry of eliminated) {
      if (lanes.length >= MAX_LANES) break;
      lanes.push(entry);
    }

    const currentKeys = lanes.map(entry => entry.key);
    const stable = [];
    lastStableLaneKeys.forEach(key => {
      const found = lanes.find(entry => entry.key === key);
      if (found) stable.push(found);
    });
    lanes.forEach(entry => {
      if (!stable.some(item => item.key === entry.key)) stable.push(entry);
    });

    lastStableLaneKeys = stable.slice(0, MAX_LANES).map(entry => entry.key);
    return stable.slice(0, MAX_LANES);
  }

  function raceStatusText(count) {
    if (count <= 0) return "Carrera pendiente";
    return `${Math.min(count, MAX_LANES)} en carrera`;
  }

  function lanePosition(entry, index, aliveCount) {
    if (entry.eliminated) return 34 + ((index * 9) % 24);
    const stageBias = aliveCount <= 2 ? 72 : aliveCount <= 4 ? 58 : aliveCount <= 8 ? 42 : 24;
    const speed = 3 + (index % 4);
    const drift = (frame * speed + index * 11) % 30;
    return Math.min(88, stageBias + drift);
  }

  function kitStyle(entry, index) {
    const code = getFlagCode(entry.team);
    const palette = KIT_COLORS[code] || [
      `hsl(${(index * 47 + 42) % 360} 78% 48%)`,
      "#ffffff",
      `hsl(${(index * 47 + 170) % 360} 80% 52%)`
    ];
    return `--kit-main:${palette[0]}; --kit-accent:${palette[1]}; --kit-trim:${palette[2]};`;
  }

  function obstacleClass(index) {
    return OBSTACLES[(frame + index) % OBSTACLES.length];
  }

  function runnerMarkup(entry, index, obstacle) {
    const number = ((index + 1) % 9) + 1;
    return `
      <span class="runner-token effect-${obstacle}" aria-label="${escapeHtml(entry.name)}">
        <span class="runner-shadow"></span>
        <span class="runner-player" aria-hidden="true">
          <span class="player-head"></span>
          <span class="player-arm player-arm-left"></span>
          <span class="player-arm player-arm-right"></span>
          <span class="player-body"><span>${number}</span></span>
          <span class="player-leg player-leg-left"></span>
          <span class="player-leg player-leg-right"></span>
        </span>
        <span class="runner-ball"></span>
      </span>
    `;
  }

  function renderLane(entry, index, aliveCount) {
    const basePos = lanePosition(entry, index, aliveCount);
    const pos = basePos.toFixed(1);
    const liveClass = entry.live ? " is-live" : "";
    const eliminatedClass = entry.eliminated ? " is-eliminated" : "";
    const unconfirmedClass = entry.confirmed ? "" : " is-unconfirmed";
    const obstacle = obstacleClass(index);
    const kitVars = kitStyle(entry, index);
    const obstaclePos = Math.max(18, Math.min(82, 28 + ((frame * 7 + index * 13) % 48)));
    const motionRange = entry.eliminated ? 0 : Math.max(5, Math.min(15, 9 + (index % 4) * 1.8 + (entry.live ? 3 : 0)));
    const motionSpeed = entry.live ? 1.35 : 0.82 + (index % 5) * 0.09;
    const motionPhase = index * 1.37 + frame * 0.4;

    return `
      <div class="race-lane effect-${obstacle}${liveClass}${eliminatedClass}${unconfirmedClass}" data-base-pos="${pos}" data-motion-range="${motionRange.toFixed(1)}" data-motion-speed="${motionSpeed.toFixed(2)}" data-motion-phase="${motionPhase.toFixed(2)}" style="--runner-pos:${pos}%; --obstacle-pos:${obstaclePos}%; --obstacle-delay:${-(index * 0.55)}s; --lane-delay:${index * 110}ms; ${kitVars}">
        <div class="lane-nameplate">
          <span class="lane-number">${index + 1}</span>
          <span class="lane-flag">${flagMarkup(entry.team)}</span>
          <strong>${escapeHtml(entry.name)}</strong>
        </div>
        <div class="lane-track">
          <span class="lane-grass-line"></span>
          <span class="lane-obstacle ${obstacle}" aria-hidden="true"></span>
          ${runnerMarkup(entry, index, obstacle)}
          <span class="eliminated-stamp">ELIMINADO</span>
        </div>
      </div>
    `;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function startMotionLoop() {
    if (motionFrame) return;

    const tick = (now) => {
      document.querySelectorAll(".race-lane:not(.is-eliminated)").forEach((lane) => {
        const base = Number.parseFloat(lane.dataset.basePos || "45");
        const range = Number.parseFloat(lane.dataset.motionRange || "8");
        const speed = Number.parseFloat(lane.dataset.motionSpeed || "1");
        const phase = Number.parseFloat(lane.dataset.motionPhase || "0");
        const wave = (Math.sin((now / 1000) * speed + phase) + 1) / 2;
        const micro = Math.sin((now / 1000) * (speed * 2.7) + phase) * 1.2;
        const pos = clamp(base + wave * range + micro, 8, 90);
        lane.style.setProperty("--runner-pos", `${pos.toFixed(2)}%`);
      });
      motionFrame = requestAnimationFrame(tick);
    };

    motionFrame = requestAnimationFrame(tick);
  }

  function renderEmpty(message) {
    const race = $("finalRace");
    const pill = $("raceStatusPill");
    if (pill) pill.textContent = "Datos pendientes";
    if (race) {
      race.innerHTML = `
        <div class="race-empty">
          <strong>Carrera pausada</strong>
          <span>${escapeHtml(message)}</span>
        </div>
      `;
    }
  }

  function renderRace() {
    const race = $("finalRace");
    const pill = $("raceStatusPill");
    if (!race) return;

    const state = getState();
    const entries = buildEntriesFromApi(state);

    if (entries.length === 0) {
      renderEmpty("Esperando clasificados confirmados para activar la carrera automática.");
      return;
    }

    const confirmedCount = entries.filter(entry => entry.confirmed).length;
    const aliveCount = entries.filter(entry => !entry.eliminated && entry.confirmed).length;
    const lanes = selectRaceLanes(entries);

    if (pill) {
      pill.textContent = raceStatusText(aliveCount || lanes.length);
    }

    race.innerHTML = `
      <div class="race-field-lines" aria-hidden="true"></div>
      <div class="race-finish" aria-hidden="true"><span>FINAL</span></div>
      <div class="race-lanes">
        ${lanes.map((entry, index) => renderLane(entry, index, aliveCount || lanes.length)).join("")}
      </div>
      <div class="race-motion-belt" aria-hidden="true">
        <div class="race-motion-strip">
          <span>CAMINO A LA FINAL</span><span>OBSTÁCULOS</span><span>CARRERA</span><span>FINAL</span><span>EN VIVO</span>
          <span>CAMINO A LA FINAL</span><span>OBSTÁCULOS</span><span>CARRERA</span><span>FINAL</span><span>EN VIVO</span>
        </div>
      </div>
    `;

    frame += 1;
    startMotionLoop();
  }

  function start() {
    renderRace();
    clearInterval(timer);
    timer = setInterval(renderRace, RENDER_MS);
    window.addEventListener("central-data-updated", renderRace);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") renderRace();
    });
  }

  window.FinalRace = {
    render: renderRace
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
