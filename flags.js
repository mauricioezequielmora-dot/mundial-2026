(() => {
  "use strict";

  const FLAGS = {
    "sudafrica": "za", "south africa": "za", "rsa": "za", "za": "za",
    "canada": "ca", "can": "ca", "ca": "ca",
    "brasil": "br", "brazil": "br", "bra": "br", "br": "br",
    "japon": "jp", "japan": "jp", "jpn": "jp", "jp": "jp",
    "alemania": "de", "germany": "de", "ger": "de", "de": "de",
    "paraguay": "py", "par": "py", "py": "py",
    "paises bajos": "nl", "netherlands": "nl", "holland": "nl", "ned": "nl", "nl": "nl",
    "marruecos": "ma", "morocco": "ma", "mar": "ma", "ma": "ma",
    "costa de marfil": "ci", "ivory coast": "ci", "cote d ivoire": "ci", "civ": "ci", "ci": "ci",
    "noruega": "no", "norway": "no", "nor": "no", "no": "no",
    "francia": "fr", "france": "fr", "fra": "fr", "fr": "fr",
    "suecia": "se", "sweden": "se", "swe": "se", "se": "se",
    "mexico": "mx", "mex": "mx", "mx": "mx",
    "ecuador": "ec", "ecu": "ec", "ec": "ec",
    "inglaterra": "eng", "england": "eng", "eng": "eng",
    "rd congo": "cd", "dr congo": "cd", "congo dr": "cd", "democratic republic of the congo": "cd", "cod": "cd", "cd": "cd",
    "belgica": "be", "belgium": "be", "bel": "be", "be": "be",
    "senegal": "sn", "sen": "sn", "sn": "sn",
    "estados unidos": "us", "united states": "us", "united states of america": "us", "usa": "us", "us": "us",
    "bosnia y herzegovina": "ba", "bosnia and herzegovina": "ba", "bosnia herzegovina": "ba", "bih": "ba", "ba": "ba",
    "espana": "es", "spain": "es", "esp": "es", "es": "es",
    "austria": "at", "aut": "at", "at": "at",
    "portugal": "pt", "por": "pt", "pt": "pt",
    "croacia": "hr", "croatia": "hr", "cro": "hr", "hr": "hr",
    "suiza": "ch", "switzerland": "ch", "sui": "ch", "ch": "ch",
    "argelia": "dz", "algeria": "dz", "alg": "dz", "dz": "dz",
    "australia": "au", "aus": "au", "au": "au",
    "egipto": "eg", "egypt": "eg", "egy": "eg", "eg": "eg",
    "argentina": "ar", "arg": "ar", "ar": "ar",
    "cabo verde": "cv", "cape verde": "cv", "cabo verde islands": "cv", "cpv": "cv", "cv": "cv",
    "colombia": "co", "col": "co", "co": "co",
    "ghana": "gh", "gha": "gh", "gh": "gh"
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function resolveCode(teamOrName) {
    const candidates = typeof teamOrName === "string"
      ? [teamOrName]
      : [
          teamOrName?.name_en,
          teamOrName?.name_fa,
          teamOrName?.name,
          teamOrName?.code,
          teamOrName?.fifa_code,
          teamOrName?.short_name
        ];

    for (const candidate of candidates) {
      const key = normalize(candidate);
      if (key && FLAGS[key]) return FLAGS[key];
    }
    return "";
  }

  function resolve(teamOrName) {
    const code = resolveCode(teamOrName);
    return code ? `./flags/${code}.png` : "";
  }

  window.CentralFlags = { resolve, resolveCode, normalize };
})();
