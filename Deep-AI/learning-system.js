const fs = require('fs');
const path = require('path');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

// Percorso del database degli esempi
const DB_PATH = path.join(__dirname, 'patterns-db.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Carica il database degli esempi
function loadPatternsDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Errore nel caricamento del database:', error);
    return [];
  }
}

// Salva il database degli esempi
function savePatternsDB(patterns) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(patterns, null, 2), 'utf8');
  } catch (error) {
    console.error('Errore nel salvataggio del database:', error);
  }
}

// Calcola la cosine similarity tra due stringhe
function cosineSimilarity(text1, text2) {
  const tokens1 = tokenizer.tokenize(text1.toLowerCase());
  const tokens2 = tokenizer.tokenize(text2.toLowerCase());
  
  const allTokens = [...new Set([...tokens1, ...tokens2])];
  const vec1 = allTokens.map(token => tokens1.filter(t => t === token).length);
  const vec2 = allTokens.map(token => tokens2.filter(t => t === token).length);
  
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
}

// Trova esempi simili nel database
function findSimilar(input, threshold = 0.6) {
  const patterns = loadPatternsDB();
  let bestMatch = null;
  let highestSimilarity = 0;
  
  patterns.forEach(pattern => {
    const similarity = cosineSimilarity(input, pattern.input);
    if (similarity > highestSimilarity && similarity >= threshold) {
      highestSimilarity = similarity;
      bestMatch = pattern;
    }
  });
  
  return bestMatch;
}

// Aggiunge un nuovo esempio o aggiorna un esistente
function addExample(input, output) {
  const patterns = loadPatternsDB();
  const existingIndex = patterns.findIndex(p => p.input === input);
  
  if (existingIndex !== -1) {
    // Aggiorna esempio esistente
    patterns[existingIndex].output = output;
    patterns[existingIndex].count++;
    patterns[existingIndex].lastUpdated = new Date();
  } else {
    // Aggiunge nuovo esempio
    patterns.push({
      input,
      output,
      count: 1,
      score: 1.0,
      createdAt: new Date(),
      lastUpdated: new Date()
    });
  }
  
  savePatternsDB(patterns);
  updateScores();
  return patterns;
}

// Calcola e aggiorna gli score di qualità
function updateScores() {
  const patterns = loadPatternsDB();
  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  
  patterns.forEach(pattern => {
    // Calcola score basato su:
    // 1. Numero di utilizzi (40%)
    // 2. Recentezza (40%)
    // 3. Lunghezza output (20%)
    const recency = Math.max(0, 1 - (now - new Date(pattern.lastUpdated)) / (30 * DAY_MS));
    const usage = 1 - 1 / (pattern.count + 1);
    const lengthScore = 0.2 + Math.min(0.8, pattern.output.length / 100);
    
    pattern.score = (usage * 0.4) + (recency * 0.4) + (lengthScore * 0.2);
  });
  
  savePatternsDB(patterns);
}

// Esegue il backup del database
function backupDatabase() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    fs.copyFileSync(DB_PATH, backupPath);
    
    console.log(`Backup creato: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('Errore nel backup:', error);
    return null;
  }
}

// Configura backup orario
setInterval(() => {
  backupDatabase();
}, 60 * 60 * 1000); // Ogni ora

// Esegue immediatamente un backup all'avvio
backupDatabase();

module.exports = {
  loadPatternsDB,
  savePatternsDB,
  findSimilar,
  addExample,
  updateScores,
  backupDatabase,
  cosineSimilarity
};
