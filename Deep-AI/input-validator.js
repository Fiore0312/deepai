// Validatore e preprocessore per input utente
const typoCorrections = {
  "pc": "computer",
  "nottebook": "notebook",
  "config": "configurazione",
  "sw": "software",
  "hw": "hardware",
  "ripristin": "ripristino",
  "aggiorn": "aggiornamento"
};

const activityTypes = {
  "installaz": "installazione",
  "riparaz": "riparazione",
  "manutenz": "manutenzione",
  "configur": "configurazione",
  "collaud": "test"
};

const commonAbbreviations = {
  "s.o.": "sistema operativo",
  "ram": "RAM",
  "ssd": "SSD",
  "cpu": "CPU",
  "gpu": "GPU",
  "os": "sistema operativo"
};

/**
 * Corregge gli errori di battitura comuni
 * @param {string} input 
 * @returns {string}
 */
function correctTypos(input) {
  return input.split(/\s+/).map(word => {
    const lowerWord = word.toLowerCase();
    return typoCorrections[lowerWord] || word;
  }).join(' ');
}

/**
 * Normalizza le abbreviazioni comuni
 * @param {string} input 
 * @returns {string}
 */
function normalizeAbbreviations(input) {
  return input.replace(
    new RegExp(Object.keys(commonAbbreviations).join('|'), 'gi'), 
    match => commonAbbreviations[match.toLowerCase()]
  );
}

/**
 * Riconosce il tipo di attività dall'input
 * @param {string} input 
 * @returns {string}
 */
function detectActivityType(input) {
  const lowerInput = input.toLowerCase();
  for (const [prefix, activity] of Object.entries(activityTypes)) {
    if (lowerInput.includes(prefix)) return activity;
  }
  return "attività generica";
}

/**
 * Esegue la validazione semantica dell'input
 * @param {string} input 
 * @returns {boolean}
 */
function validateSemantics(input) {
  const verbs = ["installato", "riparato", "configurato", "testato", "sostituito"];
  return verbs.some(verb => input.includes(verb));
}

/**
 * Preprocessa l'input utente
 * @param {string} rawInput 
 * @returns {object}
 */
module.exports.preprocessInput = function(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { error: "Input non valido" };
  }

  // Esegue tutte le trasformazioni
  const corrected = correctTypos(rawInput);
  const normalized = normalizeAbbreviations(corrected);
  const activityType = detectActivityType(normalized);
  const isValid = validateSemantics(normalized);

  return {
    processedInput: normalized,
    originalInput: rawInput,
    activityType,
    isValid,
    suggestions: isValid ? [] : ["Aggiungi verbi d'azione (es: installato, configurato)"]
  };
};
