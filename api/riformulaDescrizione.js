require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { LRUCache } = require("lru-cache");
const rateLimit = require("express-rate-limit");
const learningSystem = require('./learning-system');
const inputValidator = require('./input-validator');

const app = express();
const port = 3000;

// Configurazione ottimizzata
const CONFIG = {
  MIN_INPUT_LENGTH: 5,
  MAX_INPUT_LENGTH: 500,
  MAX_OUTPUT_LENGTH: 1000,
  TIMEOUT: 45000,
  CACHE_SIZE: 1000,
};

// Prompt aggiornato per professionista IT con supporto bilingue
const SYSTEM_PROMPT = `Sei un redattore tecnico IT esperto. Trasforma descrizioni informali di attività IT in rapporti professionali italiani.

REGOLE PRECISE:
- Italiano formale e tecnico
- Terza persona impersonale ("È stata eseguita l'installazione" non "Ho installato")
- Mantieni nomi propri, software e marche esatti
- Massimo 2-3 frasi complete, termina con punto
- Non inventare dettagli non presenti nell'input
- Correggi errori di battitura automaticamente

ESEMPI CONVERSIONE:
Input: "Presidio zara"
Output: "Eseguito presidio tecnico presso il punto vendita Zara. Monitoraggio sistemi e verifica funzionalità."

Input: "ho fatto installazione ok" 
Output: "Completata l'installazione del software richiesto. Test di funzionamento eseguiti con esito positivo."

Input: "test email tutto ok"
Output: "Eseguiti test di configurazione email. Verifica invio e ricezione completata con successo."`;

// Cache LRU ottimizzata
const responseCache = new LRUCache({
  max: CONFIG.CACHE_SIZE,
  maxSize: 5000000,
  ttl: 1000 * 60 * 60 * 24,
  allowStale: false,
  updateAgeOnGet: true,
  sizeCalculation: (value, key) => {
    return JSON.stringify(value).length + key.length;
  },
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const inputLength = req.body?.input?.length || 0;
    return inputLength < 100 ? 50 : 30;
  },
  message: "Troppe richieste, riprova tra un minuto",
});

app.use(limiter);
// Configurazione CORS sicura
const allowedOrigins = [
  "https://fiore0312.github.io",           // Frontend GitHub Pages
  "https://deepai-weem.onrender.com",      // Backend Render
  "https://deepai-gamma.vercel.app",       // Frontend Vercel
  "http://localhost:3000",                 // Sviluppo locale backend
  "http://localhost:5173",                 // Sviluppo locale Vite
  "http://127.0.0.1:5173",                 // Sviluppo locale alternativo
  "https://localhost:3000",                // HTTPS locale
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Consenti richieste senza origin (es. Postman, app mobile)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS bloccato per origine: ${origin}`);
        callback(new Error('CORS: Origine non autorizzata'), false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Origin", "Accept"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Inizio`);
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Completata in ${duration}ms`);
  });
  next();
});

const CORRECTIONS_DB_PATH = path.join(__dirname, "corrections_db.json");
const FEEDBACK_DB_PATH = path.join(__dirname, "feedback_db.json");

if (!fs.existsSync(CORRECTIONS_DB_PATH)) {
  fs.writeFileSync(CORRECTIONS_DB_PATH, JSON.stringify({
    corrections: [],
    statistics: { totalRequests: 0, totalCorrections: 0, lastUpdated: new Date().toISOString() }
  }, null, 2));
}

if (!fs.existsSync(FEEDBACK_DB_PATH)) {
  fs.writeFileSync(FEEDBACK_DB_PATH, JSON.stringify({
    positiveFeedbacks: [],
    negativeFeedbacks: [],
    statistics: { totalPositiveFeedbacks: 0, totalNegativeFeedbacks: 0, lastUpdated: new Date().toISOString() }
  }, null, 2));
}

function loadCorrectionsDB() {
  try {
    return JSON.parse(fs.readFileSync(CORRECTIONS_DB_PATH, "utf8"));
  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", `Errore caricamento correzioni: ${error.message}`);
    return { corrections: [], statistics: { totalRequests: 0, totalCorrections: 0, lastUpdated: new Date().toISOString() }};
  }
}

function saveCorrectionsDB(data) {
  try {
    fs.writeFileSync(CORRECTIONS_DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
console.error("\x1b[31m%s\x1b[0m", `Errore salvataggio correzioni: ${error.message}`);
  }
}

function loadFeedbackDB() {
  try {
    return JSON.parse(fs.readFileSync(FEEDBACK_DB_PATH, "utf8"));
  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", `Errore caricamento feedback: ${error.message}`);
    return { positiveFeedbacks: [], negativeFeedbacks: [], statistics: { totalPositiveFeedbacks: 0, totalNegativeFeedbacks: 0, lastUpdated: new Date().toISOString() }};
  }
}

function saveFeedbackDB(data) {
  try {
    fs.writeFileSync(FEEDBACK_DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", `Errore salvataggio feedback: ${error.message}`);
  }
}

// Ottimizzazione algoritmo similarity matching
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/).filter(w => w.length > 3);
  const words2 = str2.split(/\s+/).filter(w => w.length > 3);
  
  // Utilizzo di un Set per ricerca più efficiente
  const set2 = new Set(words2);
  let common = 0;
  
  // Conta le parole in comune
  for (const word of words1) {
    if (set2.has(word)) common++;
  }
  
  // Calcola la similarità
  return common / Math.max(words1.length, words2.length);
}

const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error("\x1b[31m%s\x1b[0m", "ERRORE: File .env non trovato!");
  console.log("\x1b[33m%s\x1b[0m", "Creazione file .env di esempio...");
  fs.writeFileSync(envPath, "OPENROUTER_API_KEY=inserisci_qui_la_tua_chiave_api\n");
}

const openRouterConfig = {
  baseURL: "https://openrouter.ai/api/v1",
  timeout: CONFIG.TIMEOUT,
  headers: { 
    "Content-Type": "application/json", 
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": "https://github.com/Fiore0312/deepai",
    "X-Title": "Riformulatore Descrizioni Tecniche" 
  }
};

// Nuovo endpoint per comportamento generico da professionista IT
app.post("/api/professional-response", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt?.trim()) {
      return res.status(400).json({ 
        error: "Prompt richiesto", 
        code: "MISSING_PROMPT",
        timestamp: new Date().toISOString() 
      });
    }
    
    const response = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      {
        model: "google/gemini-pro-1.5",
        messages: [
          {
            role: "system",
            content: `Sei un professionista IT senior. Rispondi in modo:
            1. Tecnicamente accurato
            2. Conciso (max 3 frasi)
            3. Con linguaggio formale
            4. Nella stessa lingua della richiesta`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 300
      },
      {
        headers: openRouterConfig.headers,
        timeout: openRouterConfig.timeout
      }
    );
    
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error("Risposta API non valida");
    }
    
    res.json({ 
      response: response.data.choices[0].message.content.trim(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Errore API professional-response:", error.message);
    res.status(500).json({ 
      error: "Errore durante l'elaborazione della richiesta", 
      code: "API_ERROR",
      details: error.response?.data?.error || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post("/api/riformula", async (req, res) => {
  const startTime = Date.now();
  try {
    // Supporto sia 'input' che 'descrizione' per compatibilità
    const { input, descrizione } = req.body;
    const rawInput = input || descrizione;
    const model = "google/gemini-pro-1.5";

    if (!rawInput?.trim()) return res.status(400).json({ error: "Input non valido" });
    const trimmedInput = rawInput.trim();

    if (trimmedInput.length > 400) {
      return res.status(400).json({ error: "Descrizione troppo lunga. Massimo 400 caratteri" });
    }

    // Preprocess input con validatore
    const validationResult = inputValidator.preprocessInput(trimmedInput);
    if (validationResult.error) {
      return res.status(400).json({ error: validationResult.error });
    }
    
    const processedInput = validationResult.processedInput;
    
    if (processedInput.length < 10) {
      return res.status(400).json({ 
        error: "Descrizione troppo breve. Minimo 10 caratteri",
        suggestions: validationResult.suggestions
      });
    }
    
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: "Input non valido semanticamente",
        details: validationResult.suggestions
      });
    }

    // Controlla se esiste un esempio simile nel learning system
    let similarExample = null;
    try {
      similarExample = learningSystem.findSimilar(processedInput);
    } catch (e) {
      console.error("Errore ricerca esempio simile:", e);
    }
    
    const cacheKey = processedInput.toLowerCase();
    
    if (similarExample) {
      const output = similarExample.output;
      responseCache.set(cacheKey, output);
      return res.json({ output, fromCache: false, fromLearning: true, duration: Date.now() - startTime });
    }
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      return res.json({ output: cachedResponse, fromCache: true, duration: Date.now() - startTime });
    }
    const requestData = {
      model: "google/gemini-pro-1.5",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Riformula: ${processedInput}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1200,
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.1
    };

    const requestConfig = {
      timeout: 30000,
      headers: {
        ...openRouterConfig.headers,
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://deepai-gamma.vercel.app",
        "X-Title": "DeepAI-Rapportini"
      }
    };

    const response = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      requestData,
      requestConfig
    );

    // Gestione robusta delle risposte API
    let output = "";
    try {
      if (response.data?.choices?.[0]?.message?.content) {
        output = response.data.choices[0].message.content.trim();
      } else if (response.data?.choices?.[0]?.message?.reasoning) {
        const reasoning = response.data.choices[0].message.reasoning;
        // Estrai l'ultima frase italiana come fallback
        const italianSentence = reasoning.match(/([^.!?]+[.!?])(?=[^.!?]*$)/);
        output = italianSentence ? italianSentence[1].trim() : reasoning;
      } else {
        // Fallback al modello precedente se la risposta è vuota
        console.warn("Risposta API vuota - Ripristino modello precedente");
        output = "[FALLBACK] " + await callFallbackModel(trimmedInput);
      }
    } catch (e) {
      console.error("Errore elaborazione risposta:", e);
      output = "[ERRORE] Impossibile generare la descrizione";
    }

    // Pulizia minima
    output = output.replace(/"/g, '').trim().replace(/\s{2,}/g, ' ');

    if (output.length > 0) output = output.charAt(0).toUpperCase() + output.slice(1);
    if (output.length > 0 && !/[\.!?]$/.test(output)) output += '.';

    const sentences = output.split(/(?<=[\.!?])\s+/).filter(s => s.trim().length > 3);
    if (sentences.length > 2) output = sentences.slice(0, 2).join(' ').trim() + '.';

    // Gestione errori migliorata
    if (output.length < 10 || output.includes("ERRORE") || output.includes("FALLBACK")) {
      // Registra l'errore per debugging
      console.error(`Output problematico: ${output}`);
      output = "Descrizione non disponibile. Si prega di riprovare con un input diverso.";
    }
    if (output.length > 300) {
      // Troncamento intelligente mantenendo la frase completa
      const lastValidEnd = output.lastIndexOf('.', 300);
      output = lastValidEnd > 50 ? output.substring(0, lastValidEnd+1) : output.substring(0, 300) + '...';
    }

    responseCache.set(cacheKey, output);
    
    try {
      learningSystem.addExample(processedInput, output);
    } catch (e) {
      console.error("Errore salvataggio esempio nel learning system:", e);
    }
    
    return res.json({ 
      output, 
      fromCache: false, 
      duration: Date.now() - startTime 
    });

  } catch (error) {
    console.error('Errore API riformula:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    // Gestione errori specifici
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit raggiunto. Riprova tra qualche minuto.',
        code: 'RATE_LIMIT',
        retryAfter: 60,
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: 'Chiave API non valida o scaduta.',
        code: 'INVALID_API_KEY',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Timeout della richiesta. Riprova.',
        code: 'TIMEOUT',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(500).json({ 
      error: 'Errore durante la riformulazione.',
      code: 'INTERNAL_ERROR',
      details: error.response?.data?.error || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Funzione di fallback al modello precedente
async function callFallbackModel(input) {
  try {
    console.log('Utilizzando modello fallback:', 'anthropic/claude-3-haiku:beta');
    
    const fallbackResponse = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      {
        model: "anthropic/claude-3-haiku:beta",
        messages: [
          {
            role: "system",
            content: "Sei un tecnico IT. Riformula in italiano formale in massimo 2 frasi."
          },
          {
            role: "user",
            content: `Riformula: ${input}`
          }
        ],
        temperature: 0.2,
        max_tokens: 100
      },
      {
        headers: openRouterConfig.headers,
        timeout: openRouterConfig.timeout
      }
    );
    
    if (!fallbackResponse.data?.choices?.[0]?.message?.content) {
      throw new Error('Risposta fallback non valida');
    }
    
    return fallbackResponse.data.choices[0].message.content.trim();
  } catch (e) {
    console.error("Errore nel fallback model:", {
      message: e.message,
      status: e.response?.status,
      timestamp: new Date().toISOString()
    });
    return "Descrizione non disponibile a causa di errore tecnico";
  }
}

// Endpoint per test connessione API OpenRouter
app.get("/api/test-openrouter", async (req, res) => {
  try {
    const testResponse = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      {
        model: "google/gemini-pro-1.5",
        messages: [
          {
            role: "system",
            content: "Sei un assistente IT. Rispondi SOLO in italiano. Conferma la connessione all'API OpenRouter con un messaggio breve e chiaro."
          },
          {
            role: "user",
            content: "Test di connessione all'API OpenRouter"
          }
        ],
        temperature: 0.1,
        max_tokens: 50
      },
      {
        headers: openRouterConfig.headers,
        timeout: openRouterConfig.timeout
      }
    );

    if (!testResponse.data?.choices?.[0]?.message?.content) {
      throw new Error('Risposta test API non valida');
    }

    const output = testResponse.data.choices[0].message.content.trim();
    res.json({ 
      status: "success", 
      message: output,
      timestamp: new Date().toISOString(),
      model: "google/gemini-pro-1.5"
    });
    
  } catch (error) {
    console.error("Errore test API OpenRouter:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      status: "error",
      message: "Connessione API OpenRouter fallita",
      code: error.response?.status || 'UNKNOWN_ERROR',
      details: error.response?.data?.error || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post("/api/save-feedback", async (req, res) => {
  try {
    const { input, output, feedback, timestamp } = req.body;
    
    if (!feedback || !['positive', 'negative'].includes(feedback)) {
      return res.status(400).json({ 
        error: "Feedback richiesto (positive/negative)",
        code: "INVALID_FEEDBACK"
      });
    }
    
    const feedbackData = {
      input: input || '',
      output: output || '',
      feedback,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown'
    };
    
    // Salva in database (implementazione semplificata)
    const db = loadFeedbackDB();
    if (feedback === 'positive') {
      db.positiveFeedbacks.push(feedbackData);
      db.statistics.totalPositiveFeedbacks++;
    } else {
      db.negativeFeedbacks.push(feedbackData);
      db.statistics.totalNegativeFeedbacks++;
    }
    db.statistics.lastUpdated = new Date().toISOString();
    saveFeedbackDB(db);
    
    res.json({ 
      success: true, 
      message: "Feedback salvato",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore save-feedback:', error);
    res.status(500).json({ 
      error: "Errore nel salvataggio del feedback",
      code: "SAVE_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

app.post("/api/save-correction", async (req, res) => {
  try {
    const { originalInput, originalOutput, correctedOutput, timestamp } = req.body;
    
    if (!originalInput || !correctedOutput) {
      return res.status(400).json({ 
        error: "Input originale e correzione richiesti",
        code: "MISSING_DATA"
      });
    }
    
    const correctionData = {
      originalInput,
      originalOutput: originalOutput || '',
      correctedOutput,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown'
    };
    
    // Salva in database
    const db = loadCorrectionsDB();
    db.corrections.push(correctionData);
    db.statistics.totalCorrections++;
    db.statistics.lastUpdated = new Date().toISOString();
    saveCorrectionsDB(db);
    
    res.json({ 
      success: true, 
      message: "Correzione salvata",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore save-correction:', error);
    res.status(500).json({ 
      error: "Errore nel salvataggio della correzione",
      code: "SAVE_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint per validazione input (richiesto dal frontend)
app.post("/api/validate-input", async (req, res) => {
  try {
    const { input } = req.body;
    
    if (!input) {
      return res.status(400).json({ 
        valid: false, 
        error: "Input richiesto",
        code: "MISSING_INPUT"
      });
    }
    
    // Validazione lunghezza
    if (input.length < 5) {
      return res.json({ 
        valid: false, 
        error: "Descrizione troppo breve. Minimo 5 caratteri",
        suggestions: ["Aggiungi più dettagli", "Specifica l'attività svolta"]
      });
    }
    
    if (input.length > 500) {
      return res.json({ 
        valid: false, 
        error: "Descrizione troppo lunga. Massimo 500 caratteri",
        suggestions: ["Riassumi il contenuto", "Rimuovi dettagli non necessari"]
      });
    }
    
    // Input valido
    res.json({ 
      valid: true, 
      message: "Input valido",
      characterCount: input.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore validate-input:', error);
    res.status(500).json({ 
      valid: false,
      error: "Errore interno del server",
      code: "VALIDATION_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(port, () => {
  console.log("\x1b[32m%s\x1b[0m", `Server in ascolto su porta ${port}`);
});
