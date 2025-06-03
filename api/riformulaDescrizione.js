require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { LRUCache } = require("lru-cache");
const rateLimit = require("express-rate-limit");
const learningSystem = require('./learning-system');

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

// Nuovo prompt ottimizzato per descrizioni tecniche IT
const SYSTEM_PROMPT = `Sei un tecnico IT esperto. Riformula direttamente l'input in rapportino tecnico professionale italiano seguendo queste regole:
1. Usa SEMPRE italiano tecnico formale
2. Forma impersonale (terza persona)
3. Massimo 2 frasi complete
4. Termina con punto
5. Mantieni nomi propri e termini tecnici
6. Non aggiungere dettagli non presenti nell'input
7. Riconosci il tipo di attività: [installazione|riparazione|test|configurazione|manutenzione]

Esempi:
- "instllazione e test computer" → "Installazione e configurazione sistema operativo. Personalizzazione setup software, test e collaudo periferiche."
- "ho acceso pc ok" → "Test di accensione dispositivo, nessun malfunzionamento rilevato. Collaudo generale ok."`;

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
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
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

function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));
  let common = 0;
  for (const word of words1) if (words2.has(word)) common++;
  return common / Math.max(words1.size, words2.size);
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
  headers: { "Content-Type": "application/json", "X-Title": "Riformulatore Descrizioni Tecniche" }
};

app.post("/api/riformula", async (req, res) => {
  const startTime = Date.now();
  try {
    const { input } = req.body;
    const model = "deepseek/deepseek-r1-0528:free";

    if (!input?.trim()) return res.status(400).json({ error: "Input non valido" });
    const trimmedInput = input.trim();

    if (trimmedInput.length > 400) {
      return res.status(400).json({ error: "Descrizione troppo lunga. Massimo 400 caratteri" });
    }

    if (trimmedInput.length < 10) {
      return res.status(400).json({ error: "Descrizione troppo breve. Minimo 10 caratteri" });
    }

    const cacheKey = trimmedInput.toLowerCase();
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      return res.json({ output: cachedResponse, fromCache: true, duration: Date.now() - startTime });
    }

    // Controlla se esiste un esempio simile nel sistema di apprendimento
    const similarPattern = learningSystem.findSimilar(trimmedInput);
    if (similarPattern) {
      return res.json({ 
        output: similarPattern.output, 
        fromLearning: true,
        similarity: similarPattern.similarity,
        duration: Date.now() - startTime 
      });
    }

    const response = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      {
        model,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: `Riformula: ${trimmedInput}`
          }
        ],
        temperature: 0.3,
        max_tokens: 250,
        top_p: 0.9,
        frequency_penalty: 0.6,
        presence_penalty: 0.2
      },
      {
        ...openRouterConfig,
        headers: {
          ...openRouterConfig.headers,
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://riformulatore-api.onrender.com"
        }
      }
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
    
    // Salva l'esempio nel sistema di apprendimento (in background)
    learningSystem.addExample(trimmedInput, output)
      .catch(err => console.error('Errore salvataggio esempio:', err));
    
    return res.json({ 
      output, 
      fromCache: false, 
      duration: Date.now() - startTime 
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Errore critico:`, error);
    return res.status(500).json({ 
      error: "Errore nel servizio di riformulazione",
      details: "Si prega di riprovare più tardi o contattare il supporto tecnico"
    });
  }
});

// Funzione di fallback al modello precedente
async function callFallbackModel(input) {
  try {
    const fallbackResponse = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      {
        model: "deepseek/deepseek-chat-v3-0324:free",
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
        ...openRouterConfig,
        headers: {
          ...openRouterConfig.headers,
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
        }
      }
    );
    
    return fallbackResponse.data.choices[0].message.content.trim();
  } catch (e) {
    console.error("Errore nel fallback model:", e);
    return "Descrizione non disponibile";
  }
}

// Endpoint per test connessione API OpenRouter
app.get("/api/test-openrouter", async (req, res) => {
  try {
    const testResponse = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      {
        model: "deepseek/deepseek-r1-0528:free",
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
        ...openRouterConfig,
        headers: {
          ...openRouterConfig.headers,
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
        }
      }
    );

    const output = testResponse.data.choices[0].message.content.trim();
    res.json({ status: "success", message: output });
  } catch (error) {
    console.error("Errore test API OpenRouter:", error);
    res.status(500).json({ 
      status: "error",
      message: "Connessione API OpenRouter fallita",
      details: error.message 
    });
  }
});

app.post("/api/save-feedback", async (req, res) => {
  // Implementazione semplificata
});

app.post("/api/save-correction", async (req, res) => {
  // Implementazione semplificata
});

// Altri endpoint semplificati

app.listen(port, () => {
  console.log("\x1b[32m%s\x1b[0m", `Server in ascolto su porta ${port}`);
});
