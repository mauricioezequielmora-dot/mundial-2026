/* ============================================================
   CAMINO A LA COPA · RONDA DE 32
   Reemplaza la tabla de grupos por 16 cruces rotativos.
   - No inventa favoritos ni antecedentes.
   - Usa el estado de la API para marcador y datos de grupos.
   - Horarios fijos expresados en hora argentina (UTC-3).
   ============================================================ */

(() => {
  "use strict";

  const ROTATION_MS = 20000;
  let fixtureIndex = 0;
  let rotationTimer = null;

  const FIXTURES = [
    {
      id: 73,
      home: "Sudáfrica",
      away: "Canadá",
      homeAliases: ["South Africa", "Sudáfrica"],
      awayAliases: ["Canada", "Canadá"],
      dateArgentina: "2026-06-28",
      timeArgentina: "16:00",
      venue: "Inglewood, California",
      next: "Países Bajos o Marruecos"
    },
    {
      id: 76,
      home: "Brasil",
      away: "Japón",
      homeAliases: ["Brazil", "Brasil"],
      awayAliases: ["Japan", "Japón"],
      dateArgentina: "2026-06-29",
      timeArgentina: "14:00",
      venue: "Houston",
      next: "Costa de Marfil o Noruega"
    },
    {
      id: 74,
      home: "Alemania",
      away: "Paraguay",
      homeAliases: ["Germany", "Alemania"],
      awayAliases: ["Paraguay"],
      dateArgentina: "2026-06-29",
      timeArgentina: "17:30",
      venue: "Foxborough, Massachusetts",
      next: "Francia o Suecia"
    },
    {
      id: 75,
      home: "Países Bajos",
      away: "Marruecos",
      homeAliases: ["Netherlands", "Países Bajos", "Holland"],
      awayAliases: ["Morocco", "Marruecos"],
      dateArgentina: "2026-06-29",
      timeArgentina: "22:00",
      venue: "Guadalupe, México",
      next: "Sudáfrica o Canadá"
    },
    {
      id: 78,
      home: "Costa de Marfil",
      away: "Noruega",
      homeAliases: ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire", "Costa de Marfil"],
      awayAliases: ["Norway", "Noruega"],
      dateArgentina: "2026-06-30",
      timeArgentina: "14:00",
      venue: "Arlington, Texas",
      next: "Brasil o Japón"
    },
    {
      id: 77,
      home: "Francia",
      away: "Suecia",
      homeAliases: ["France", "Francia"],
      awayAliases: ["Sweden", "Suecia"],
      dateArgentina: "2026-06-30",
      timeArgentina: "18:00",
      venue: "East Rutherford, Nueva Jersey",
      next: "Alemania o Paraguay"
    },
    {
      id: 79,
      home: "México",
      away: "Ecuador",
      homeAliases: ["Mexico", "México"],
      awayAliases: ["Ecuador"],
      dateArgentina: "2026-06-30",
      timeArgentina: "22:00",
      venue: "Ciudad de México",
      next: "Inglaterra o RD Congo"
    },
    {
      id: 80,
      home: "Inglaterra",
      away: "RD Congo",
      homeAliases: ["England", "Inglaterra"],
      awayAliases: ["DR Congo", "Congo DR", "RD Congo", "Democratic Republic of the Congo"],
      dateArgentina: "2026-07-01",
      timeArgentina: "13:00",
      venue: "Atlanta",
      next: "México o Ecuador"
    },
    {
      id: 82,
      home: "Bélgica",
      away: "Senegal",
      homeAliases: ["Belgium", "Bélgica"],
      awayAliases: ["Senegal"],
      dateArgentina: "2026-07-01",
      timeArgentina: "17:00",
      venue: "Seattle",
      next: "Estados Unidos o Bosnia y Herzegovina"
    },
    {
      id: 81,
      home: "Estados Unidos",
      away: "Bosnia y Herzegovina",
      homeAliases: ["USA", "United States", "United States of America", "Estados Unidos"],
      awayAliases: ["Bosnia and Herzegovina", "Bosnia-Herzegovina", "Bosnia y Herzegovina"],
      dateArgentina: "2026-07-01",
      timeArgentina: "21:00",
      venue: "Santa Clara, California",
      next: "Bélgica o Senegal"
    },
    {
      id: 84,
      home: "España",
      away: "Austria",
      homeAliases: ["Spain", "España"],
      awayAliases: ["Austria"],
      dateArgentina: "2026-07-02",
      timeArgentina: "16:00",
      venue: "Inglewood, California",
      next: "Portugal o Croacia"
    },
    {
      id: 83,
      home: "Portugal",
      away: "Croacia",
      homeAliases: ["Portugal"],
      awayAliases: ["Croatia", "Croacia"],
      dateArgentina: "2026-07-02",
      timeArgentina: "20:00",
      venue: "Toronto",
      next: "España o Austria"
    },
    {
      id: 85,
      home: "Suiza",
      away: "Argelia",
      homeAliases: ["Switzerland", "Suiza"],
      awayAliases: ["Algeria", "Argelia"],
      dateArgentina: "2026-07-03",
      timeArgentina: "00:00",
      venue: "Vancouver",
      next: "Colombia o Ghana"
    },
    {
      id: 88,
      home: "Australia",
      away: "Egipto",
      homeAliases: ["Australia"],
      awayAliases: ["Egypt", "Egipto"],
      dateArgentina: "2026-07-03",
      timeArgentina: "15:00",
      venue: "Arlington, Texas",
      next: "Argentina o Cabo Verde"
    },
    {
      id: 86,
      home: "Argentina",
      away: "Cabo Verde",
      homeAliases: ["Argentina"],
      awayAliases: ["Cape Verde", "Cabo Verde", "Cabo Verde Islands"],
      dateArgentina: "2026-07-03",
      timeArgentina: "19:00",
      venue: "Miami Gardens, Florida",
      next: "Australia o Egipto",
      argentina: true
    },
    {
      id: 87,
      home: "Colombia",
      away: "Ghana",
      homeAliases: ["Colombia"],
      awayAliases: ["Ghana"],
      dateArgentina: "2026-07-03",
      timeArgentina: "22:30",
      venue: "Kansas City",
      next: "Suiza o Argelia"
    }
  ];

  // Las banderas de Camino a la Copa son recursos locales y fijos.
  // No se toman desde la API porque algunas respuestas pueden devolver una URL incorrecta.
  const FLAG_ASSET = {
    "Sudáfrica": "za", "Canadá": "ca", "Brasil": "br", "Japón": "jp",
    "Alemania": "de", "Paraguay": "py", "Países Bajos": "nl", "Marruecos": "ma",
    "Costa de Marfil": "ci", "Noruega": "no", "Francia": "fr", "Suecia": "se",
    "México": "mx", "Ecuador": "ec", "Inglaterra": "eng", "RD Congo": "cd",
    "Bélgica": "be", "Senegal": "sn", "Estados Unidos": "us", "Bosnia y Herzegovina": "ba",
    "España": "es", "Austria": "at", "Portugal": "pt", "Croacia": "hr",
    "Suiza": "ch", "Argelia": "dz", "Australia": "au", "Egipto": "eg",
    "Argentina": "ar", "Cabo Verde": "cv", "Colombia": "co", "Ghana": "gh"
  };

  const FLAG_FALLBACK = {
    "Sudáfrica": "🇿🇦", "Canadá": "🇨🇦", "Brasil": "🇧🇷", "Japón": "🇯🇵",
    "Alemania": "🇩🇪", "Paraguay": "🇵🇾", "Países Bajos": "🇳🇱", "Marruecos": "🇲🇦",
    "Costa de Marfil": "🇨🇮", "Noruega": "🇳🇴", "Francia": "🇫🇷", "Suecia": "🇸🇪",
    "México": "🇲🇽", "Ecuador": "🇪🇨", "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "RD Congo": "🇨🇩",
    "Bélgica": "🇧🇪", "Senegal": "🇸🇳", "Estados Unidos": "🇺🇸", "Bosnia y Herzegovina": "🇧🇦",
    "España": "🇪🇸", "Austria": "🇦🇹", "Portugal": "🇵🇹", "Croacia": "🇭🇷",
    "Suiza": "🇨🇭", "Argelia": "🇩🇿", "Australia": "🇦🇺", "Egipto": "🇪🇬",
    "Argentina": "🇦🇷", "Cabo Verde": "🇨🇻", "Colombia": "🇨🇴", "Ghana": "🇬🇭"
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function getCentralState() {
    if (window.CentralData && typeof window.CentralData.getState === "function") {
      return window.CentralData.getState();
    }
    return null;
  }

  function findTeam(aliases) {
    const current = getCentralState();
    if (!current || !current.teams) return null;
    const wanted = aliases.map(normalize);
    return Object.values(current.teams).find(team => {
      const names = [team?.name_en, team?.name_fa, team?.name, team?.code, team?.fifa_code]
        .filter(Boolean)
        .map(normalize);
      return wanted.some(alias => names.some(name => name === alias || name.includes(alias) || alias.includes(name)));
    }) || null;
  }

  function findTeamRecord(team) {
    const current = getCentralState();
    if (!current || !team || !current.groups) return null;
    const teamId = String(team.id ?? "");

    for (const [groupName, group] of Object.entries(current.groups)) {
      if (!group || !Array.isArray(group.teams)) continue;
      const sorted = [...group.teams].sort((a, b) => {
        const points = Number(b.pts || 0) - Number(a.pts || 0);
        if (points !== 0) return points;
        const goalDifference = Number(b.gd || 0) - Number(a.gd || 0);
        if (goalDifference !== 0) return goalDifference;
        return Number(b.gf || 0) - Number(a.gf || 0);
      });
      const position = sorted.findIndex(row => String(row.team_id) === teamId);
      if (position >= 0) {
        return { ...sorted[position], groupName, position: position + 1 };
      }
    }
    return null;
  }

  function findApiMatch(fixture, homeTeam, awayTeam) {
    const current = getCentralState();
    if (!current || !Array.isArray(current.games)) return null;

    const homeId = String(homeTeam?.id ?? "");
    const awayId = String(awayTeam?.id ?? "");

    if (homeId && awayId) {
      const exact = current.games.find(game => {
        const gh = String(game.home_team_id ?? "");
        const ga = String(game.away_team_id ?? "");
        return (gh === homeId && ga === awayId) || (gh === awayId && ga === homeId);
      });
      if (exact) return exact;
    }

    return null;
  }

  // Los horarios se guardan como fecha y hora de Argentina, no como hora de la sede.
  // El cálculo manual UTC-3 evita que Android, Chrome o la zona del dispositivo
  // conviertan accidentalmente el horario estadounidense como si fuera local.
  function argentinaKickoffMs(fixture) {
    const [year, month, day] = fixture.dateArgentina.split("-").map(Number);
    const [hour, minute] = fixture.timeArgentina.split(":").map(Number);
    return Date.UTC(year, month - 1, day, hour + 3, minute, 0, 0);
  }

  function formatArgentinaDate(fixture) {
    const [year, month, day] = fixture.dateArgentina.split("-").map(Number);
    const weekday = new Intl.DateTimeFormat("es-AR", {
      timeZone: "UTC",
      weekday: "short"
    }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)))
      .replace(".", "")
      .toUpperCase();
    return `${weekday} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")} · ${fixture.timeArgentina} HS`;
  }

  function countdownText(fixture) {
    const difference = argentinaKickoffMs(fixture) - Date.now();
    if (difference <= 0) return "A LA ESPERA DE ACTUALIZACIÓN";
    const days = Math.floor(difference / 86400000);
    const hours = Math.floor((difference % 86400000) / 3600000);
    const minutes = Math.floor((difference % 3600000) / 60000);
    if (days > 0) return `FALTAN ${days} D · ${hours} H · ${minutes} MIN`;
    if (hours > 0) return `FALTAN ${hours} H · ${minutes} MIN`;
    return `FALTAN ${Math.max(1, minutes)} MIN`;
  }

  function teamRecordLine(team, displayName) {
    const record = findTeamRecord(team);
    if (!record) return `${displayName}: clasificado a la ronda de 32`;
    const gf = Number(record.gf || 0);
    const ga = Number(record.ga || 0);
    return `${displayName}: ${record.pts} pts · ${gf}-${ga} goles · Grupo ${record.groupName}`;
  }

  function flagMarkup(_team, displayName) {
    const code = FLAG_ASSET[displayName];
    const fallback = FLAG_FALLBACK[displayName] || "⚽";
    if (!code) return `<span class="ko-flag-emoji">${fallback}</span>`;
    return `<img class="ko-flag" src="./flags/${code}.png" alt="Bandera de ${displayName}" onerror="this.outerHTML='<span class=\'ko-flag-emoji\'>${fallback}</span>'">`;
  }

  function scoreInFixtureOrder(apiMatch, homeTeam, awayTeam) {
    if (!apiMatch) return "VS";
    const fixtureHomeId = String(homeTeam?.id ?? "");
    const apiHomeId = String(apiMatch.home_team_id ?? "");
    const directOrder = fixtureHomeId && apiHomeId === fixtureHomeId;
    const homeScore = directOrder ? apiMatch.home_score_num : apiMatch.away_score_num;
    const awayScore = directOrder ? apiMatch.away_score_num : apiMatch.home_score_num;
    return `${homeScore ?? 0} - ${awayScore ?? 0}`;
  }

  function matchStatus(fixture, apiMatch, homeTeam, awayTeam) {
    if (apiMatch?.isLive) {
      const minute = Number.parseInt(apiMatch.time_elapsed, 10);
      return {
        className: "live",
        label: Number.isFinite(minute) ? `EN VIVO · ${minute}′` : "EN VIVO",
        score: scoreInFixtureOrder(apiMatch, homeTeam, awayTeam)
      };
    }

    if (apiMatch?.isFinished) {
      return {
        className: "finished",
        label: "FINAL",
        score: scoreInFixtureOrder(apiMatch, homeTeam, awayTeam)
      };
    }

    return {
      className: "upcoming",
      label: formatArgentinaDate(fixture),
      score: "VS"
    };
  }

  function currentPriorityIndex() {
    const enriched = FIXTURES.map((fixture, index) => {
      const homeTeam = findTeam(fixture.homeAliases);
      const awayTeam = findTeam(fixture.awayAliases);
      const game = findApiMatch(fixture, homeTeam, awayTeam);
      return { fixture, game, index };
    });

    const live = enriched.find(item => item.game?.isLive);
    if (live) return live.index;

    const upcoming = enriched
      .filter(item => !item.game?.isFinished && argentinaKickoffMs(item.fixture) > Date.now())
      .sort((a, b) => argentinaKickoffMs(a.fixture) - argentinaKickoffMs(b.fixture))[0];
    return upcoming ? upcoming.index : -1;
  }

  function renderKnockout() {
    const list = document.getElementById("standingsList");
    const nav = document.getElementById("groupNav");
    if (!list || !nav) return;

    const fixture = FIXTURES[fixtureIndex % FIXTURES.length];
    const homeTeam = findTeam(fixture.homeAliases);
    const awayTeam = findTeam(fixture.awayAliases);
    const apiMatch = findApiMatch(fixture, homeTeam, awayTeam);
    const status = matchStatus(fixture, apiMatch, homeTeam, awayTeam);
    const isFeatured = fixture.argentina || apiMatch?.isLive;

    nav.textContent = `DIECISEISAVOS · ${fixtureIndex + 1}/${FIXTURES.length}`;
    list.classList.add("knockout-list");
    list.innerHTML = `
      <article class="ko-card ${status.className} ${isFeatured ? "featured" : ""}">
        <div class="ko-topline">
          <span class="ko-stage">RONDA DE 32</span>
          <span class="ko-status">${status.label}</span>
        </div>

        <div class="ko-matchup">
          <div class="ko-team">
            ${flagMarkup(homeTeam, fixture.home)}
            <strong>${fixture.home}</strong>
          </div>
          <div class="ko-score">${status.score}</div>
          <div class="ko-team away">
            ${flagMarkup(awayTeam, fixture.away)}
            <strong>${fixture.away}</strong>
          </div>
        </div>

        <div class="ko-venue">📍 ${fixture.venue} · HORA ARGENTINA</div>
        ${status.className === "upcoming" ? `<div class="ko-countdown">${countdownText(fixture)}</div>` : ""}

        <div class="ko-data-title">DATOS DE FASE DE GRUPOS</div>
        <div class="ko-data-line">${teamRecordLine(homeTeam, fixture.home)}</div>
        <div class="ko-data-line">${teamRecordLine(awayTeam, fixture.away)}</div>

        <div class="ko-next">
          <span>SI AVANZA</span>
          <strong>Jugará en octavos ante ${fixture.next}</strong>
        </div>
      </article>
    `;
  }

  function nextFixture() {
    fixtureIndex = (fixtureIndex + 1) % FIXTURES.length;
    renderKnockout();
  }

  function startRotation() {
    if (rotationTimer) clearInterval(rotationTimer);
    rotationTimer = setInterval(nextFixture, ROTATION_MS);
  }

  function initialize() {
    const priority = currentPriorityIndex();
    if (priority >= 0) fixtureIndex = priority;
    renderKnockout();
    startRotation();

    window.addEventListener("central-data-updated", () => {
      const liveIndex = currentPriorityIndex();
      const currentFixture = FIXTURES[fixtureIndex];
      const currentHome = findTeam(currentFixture.homeAliases);
      const currentAway = findTeam(currentFixture.awayAliases);
      const currentGame = findApiMatch(currentFixture, currentHome, currentAway);
      if (liveIndex >= 0 && !currentGame?.isLive) fixtureIndex = liveIndex;
      renderKnockout();
    });

    setInterval(renderKnockout, 30000);
  }

  // app.js llama estas funciones para la antigua tabla. Se reemplazan antes de DOMContentLoaded.
  try {
    renderStandings = renderKnockout;
    rotateGroup = function knockoutLegacyRotationDisabled() {};
  } catch (error) {
    console.warn("No se pudieron reemplazar las funciones de tabla:", error);
  }

  window.CaminoCopa = {
    fixtures: FIXTURES.map(item => ({ ...item })),
    render: renderKnockout,
    next: nextFixture
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
