require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { LRUCache } = require("lru-cache");
const rateLimit = require("express-rate-limit");

const app = express();
const port = 3000;

// Configurazione ottimizzata
const CONFIG = {
  MIN_INPUT_LENGTH: 5,
  MAX_INPUT_LENGTH: 500,
  MAX_OUTPUT_LENGTH: 1000,
  TIMEOUT: 30000,
  CACHE_SIZE: 1000,
};

// Cache LRU ottimizzata
const responseCache = new LRUCache({
  max: CONFIG.CACHE_SIZE,
  maxSize: 5000000, // ~5MB in caratteri
  ttl: 1000 * 60 * 60 * 24, // 24 ore
  allowStale: false,
  updateAgeOnGet: true,
  sizeCalculation: (value, key) => {
    return JSON.stringify(value).length + key.length;
  },
});

// Rate limiter più permissivo per richieste brevi
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const inputLength = req.body?.input?.length || 0;
    return inputLength < 100 ? 50 : 30; // Più richieste permesse per input brevi
  },
  message: "Troppe richieste, riprova tra un minuto",
});

// Applica rate limiting a tutti gli endpoint
app.use(limiter);

// Configura CORS prima di qualsiasi altro middleware
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json());

// Middleware per logging e monitoraggio
app.use((req, res, next) => {
  const start = Date.now();

  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} - Inizio richiesta`
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${
        req.url
      } - Completata in ${duration}ms (Status: ${res.statusCode})`
    );
  });

  next();
});

// Percorso del file di database delle correzioni
const CORRECTIONS_DB_PATH = path.join(__dirname, "corrections_db.json");

// Percorso del file di database dei feedback
const FEEDBACK_DB_PATH = path.join(__dirname, "feedback_db.json");

// Inizializza il database delle correzioni se non esiste
if (!fs.existsSync(CORRECTIONS_DB_PATH)) {
  fs.writeFileSync(
    CORRECTIONS_DB_PATH,
    JSON.stringify(
      {
        corrections: [],
        statistics: {
          totalRequests: 0,
          totalCorrections: 0,
          lastUpdated: new Date().toISOString(),
        },
      },
      null,
      2
    )
  );
  console.log(
    "\x1b[32m%s\x1b[0m",
    `Database delle correzioni creato in ${CORRECTIONS_DB_PATH}`
  );
}

// Inizializza il database dei feedback se non esiste
if (!fs.existsSync(FEEDBACK_DB_PATH)) {
  fs.writeFileSync(
    FEEDBACK_DB_PATH,
    JSON.stringify(
      {
        positiveFeedbacks: [],
        negativeFeedbacks: [],
        statistics: {
          totalPositiveFeedbacks: 0,
          totalNegativeFeedbacks: 0,
          lastUpdated: new Date().toISOString(),
        },
      },
      null,
      2
    )
  );
  console.log(
    "\x1b[32m%s\x1b[0m",
    `Database dei feedback creato in ${FEEDBACK_DB_PATH}`
  );
}

// Carica il database delle correzioni
function loadCorrectionsDB() {
  try {
    const data = fs.readFileSync(CORRECTIONS_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      `Errore nel caricamento del database delle correzioni: ${error.message}`
    );
    return {
      corrections: [],
      statistics: {
        totalRequests: 0,
        totalCorrections: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

// Salva il database delle correzioni
function saveCorrectionsDB(data) {
  try {
    fs.writeFileSync(CORRECTIONS_DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      `Errore nel salvataggio del database delle correzioni: ${error.message}`
    );
  }
}

// Carica il database dei feedback
function loadFeedbackDB() {
  try {
    const data = fs.readFileSync(FEEDBACK_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      `Errore nel caricamento del database dei feedback: ${error.message}`
    );
    return {
      positiveFeedbacks: [],
      negativeFeedbacks: [],
      statistics: {
        totalPositiveFeedbacks: 0,
        totalNegativeFeedbacks: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

// Salva il database dei feedback
function saveFeedbackDB(data) {
  try {
    fs.writeFileSync(FEEDBACK_DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      `Errore nel salvataggio del database dei feedback: ${error.message}`
    );
  }
}

// Funzione per trovare una descrizione simile nel database
function findSimilarDescription(input, db) {
  // Algoritmo semplice: cerca corrispondenze parziali
  // In una versione più avanzata si potrebbe usare un algoritmo di similarità più sofisticato
  const inputLower = input.toLowerCase();

  for (const correction of db.corrections) {
    const originalLower = correction.original.toLowerCase();

    // Se la descrizione originale è molto simile, restituisci la versione corretta
    if (
      originalLower.includes(inputLower) ||
      inputLower.includes(originalLower)
    ) {
      // Se le stringhe sono simili per più del 70% delle parole
      const similarityScore = calculateSimilarity(inputLower, originalLower);
      if (similarityScore > 0.7) {
        return correction;
      }
    }
  }

  return null;
}

// Funzione per trovare una descrizione simile nel database dei feedback positivi
function findSimilarPositiveFeedback(input) {
  const db = loadFeedbackDB();
  const inputLower = input.toLowerCase();

  for (const feedback of db.positiveFeedbacks) {
    const originalLower = feedback.original.toLowerCase();

    // Se la descrizione originale è molto simile, restituisci la versione migliorata
    if (
      originalLower.includes(inputLower) ||
      inputLower.includes(originalLower)
    ) {
      // Se le stringhe sono simili per più del 70% delle parole
      const similarityScore = calculateSimilarity(inputLower, originalLower);
      if (similarityScore > 0.7) {
        return feedback.enhanced;
      }
    }
  }

  return null;
}

// Funzione per verificare se una risposta è simile ad un feedback negativo precedente
function isSimilarToNegativeFeedback(input, output) {
  const db = loadFeedbackDB();

  for (const feedback of db.negativeFeedbacks) {
    // Verifica se l'input è simile e l'output proposto è simile a quello già valutato negativamente
    if (
      calculateSimilarity(
        input.toLowerCase(),
        feedback.original.toLowerCase()
      ) > 0.7 &&
      calculateSimilarity(
        output.toLowerCase(),
        feedback.enhanced.toLowerCase()
      ) > 0.7
    ) {
      return true;
    }
  }

  return false;
}

// Funzione per calcolare la similarità tra due stringhe (algoritmo semplice)
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/).filter((word) => word.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter((word) => word.length > 3));

  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      commonWords++;
    }
  }

  return commonWords / Math.max(words1.size, words2.size);
}

// Verifica della configurazione
const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error("\x1b[31m%s\x1b[0m", "ERRORE: File .env non trovato!");
  console.log("\x1b[33m%s\x1b[0m", "Creazione di un file .env di esempio...");

  fs.writeFileSync(
    envPath,
    "OPENROUTER_API_KEY=inserisci_qui_la_tua_chiave_api\n"
  );
  console.log("\x1b[32m%s\x1b[0m", `File .env creato in ${envPath}`);
  console.log(
    "\x1b[33m%s\x1b[0m",
    "Per favore, inserisci la tua chiave API di OpenRouter nel file .env e riavvia il server"
  );
}

// Funzione migliorata per pulire l'output dell'API
function cleanApiResponse(response) {
  if (!response) return "";

  try {
    // Se è una stringa, prova a parsarla come JSON
    if (typeof response === "string") {
      try {
        const parsed = JSON.parse(response);
        return extractContent(parsed);
      } catch {
        // Se non è JSON valido, usa la stringa come è
        return response.trim();
      }
    }

    // Se è già un oggetto
    return extractContent(response);
  } catch (error) {
    console.error("Errore nella pulizia della risposta:", error);
    return String(response).trim();
  }
}

// Funzione helper per estrarre il contenuto dalla risposta
function extractContent(response) {
  // Controlla vari formati di risposta possibili
  if (response.choices?.[0]?.message?.content) {
    return response.choices[0].message.content.trim();
  }
  if (response.message?.content) {
    return response.message.content.trim();
  }
  if (response.message?.reasoning) {
    const match = response.message.reasoning.match(
      /Risposta:\s*([^"]+?)(?:\.)?$/
    );
    if (match) return match[1].trim() + ".";
  }
  if (response.output) {
    return response.output.trim();
  }

  // Se non troviamo il contenuto nei formati previsti, converti l'oggetto in stringa JSON
  if (typeof response === "object") {
    console.warn(
      "Formato risposta non riconosciuto:",
      JSON.stringify(response, null, 2)
    );
    return JSON.stringify(response);
  }

  // Ultima risorsa: converti in stringa
  const output = String(response).trim();
  return output.endsWith(".") ? output : output + ".";
}

// Funzione ottimizzata per controllare il database dei feedback
async function checkFeedbackDB(input) {
  try {
    const normalizedInput = input.toLowerCase().trim();

    // Carica il database dei feedback
    const db = await fs.promises.readFile(FEEDBACK_DB_PATH, "utf8");
    const feedbackData = JSON.parse(db);

    // Cerca una corrispondenza diretta
    if (feedbackData[normalizedInput]) {
      return {
        output: feedbackData[normalizedInput].output,
        likes: feedbackData[normalizedInput].likes,
        fromFeedback: true,
      };
    }

    // Cerca corrispondenze simili
    for (const [key, value] of Object.entries(feedbackData)) {
      if (typeof value === "object" && value.input && value.output) {
        if (calculateSimilarity(normalizedInput, key) > 0.8) {
          return {
            output: value.output,
            likes: value.likes,
            fromFeedback: true,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Errore nel controllo del database feedback:", error);
    return null;
  }
}

// Configurazione ottimizzata per OpenRouter
const openRouterConfig = {
  baseURL: "https://openrouter.ai/api/v1",
  timeout: CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    "X-Title": "Riformulatore Descrizioni Tecniche",
  },
};

// Modifica della funzione principale
app.post("/api/riformula", async (req, res) => {
  const startTime = Date.now();
  try {
    const { input } = req.body;

    // Forza sempre il modello corretto, ignorando quello passato dal client
    const model = "deepseek/deepseek-chat-v3-0324:free";

    // Validazione input
    if (!input?.trim()) {
      return res.status(400).json({
        error: "Input non valido",
      });
    }

    const trimmedInput = input.trim();

    // Log della richiesta
    console.log(
      `[${new Date().toISOString()}] Nuova richiesta di riformulazione:`,
      {
        input: trimmedInput,
        model: model,
      }
    );

    // Check cache
    const cacheKey = trimmedInput.toLowerCase();
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[${new Date().toISOString()}] Risposta trovata in cache`);
      return res.json({
        output: cachedResponse,
        fromCache: true,
        duration: Date.now() - startTime,
      });
    }

    console.log(`[${new Date().toISOString()}] Chiamata API OpenRouter...`);

    // Prompt aggiornato: consenti fino a 4 frasi se necessario
    const response = await axios.post(
      `${openRouterConfig.baseURL}/chat/completions`,
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "Sei un tecnico IT e devi scrivere un breve rapportino di attività per un cliente. Riformula l'input come una relazione tecnica professionale, in italiano formale e corretto. Non usare mai la prima persona singolare o plurale (es: 'ho fatto', 'abbiamo eseguito'). Usa sempre una forma impersonale, passiva o tecnica, come da prassi nei rapportini IT. Puoi mantenere nomi propri solo se già presenti nell'input, ma non aggiungere mai nomi, dettagli tecnici, marche, modelli, software, ambienti o informazioni che non siano già presenti. Non inventare nulla. La risposta deve essere priva di errori ortografici e di battitura. Limita la risposta a massimo 4 frasi, chiare, professionali e concise, senza elenchi, titoli o punti elenco. Usa più frasi solo se necessario per descrivere tutte le attività svolte. Scrivi solo la relazione, senza commenti aggiuntivi.",
          },
          {
            role: "user",
            content: `Riformula in modo professionale, impersonale e conciso, mantenendo eventuali nomi propri presenti nell'input e senza aggiungere dettagli non forniti: ${trimmedInput}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 180,
        top_p: 0.7,
        frequency_penalty: 0.4,
        presence_penalty: 0.1,
        stream: false,
      },
      {
        ...openRouterConfig,
        headers: {
          ...openRouterConfig.headers,
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://riformulatore-api.onrender.com",
        },
      }
    );

    // Validazione iniziale della risposta
    if (!response.data) {
      throw new Error("Nessuna risposta dall'API");
    }

    // Estrazione e validazione del contenuto
    const choices = response.data.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error("Nessuna scelta disponibile nella risposta");
    }

    const firstChoice = choices[0];
    if (
      !firstChoice.message ||
      typeof firstChoice.message.content !== "string"
    ) {
      throw new Error("Formato messaggio non valido nella risposta");
    }

    let output = firstChoice.message.content.trim();

    // Pulizia output: rimuovi elenchi, numeri, punti elenco, titoli
    output = output
      .replace(/[#\-*\d\.]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Tronca a una sola frase (fino al primo punto)
    const punto = output.indexOf(".");
    if (punto > 0) output = output.slice(0, punto + 1);

    // Tronca la risposta al quarto punto fermo per evitare prolissità
    let punti = 0;
    let idx = 0;
    for (let i = 0; i < output.length; i++) {
      if (output[i] === ".") {
        punti++;
        if (punti === 4) {
          idx = i + 1;
          break;
        }
      }
    }
    if (punti >= 4) {
      output = output.slice(0, idx).trim();
    }

    // Formattazione finale
    output = output.charAt(0).toUpperCase() + output.slice(1);
    if (!/[.!?]$/.test(output)) {
      output += ".";
    }

    // Log dell'output finale
    console.log("Output finale:", output);

    // Salva in cache
    responseCache.set(cacheKey, output);

    return res.json({
      output,
      fromCache: false,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Errore:`, error);
    console.error("Stack trace:", error.stack);

    // Log dettagliato dell'errore API
    if (error.response) {
      console.error("Dettagli errore API:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    }

    return res.status(500).json({
      error: "Errore durante l'elaborazione della richiesta",
      details: error.message,
    });
  }
});

// Endpoint per salvare un feedback
app.post("/api/save-feedback", async (req, res) => {
  const { original, enhanced, isPositive } = req.body;

  if (!original || !enhanced || isPositive === undefined) {
    return res.status(400).json({
      error:
        "Informazioni mancanti. Sono richiesti: testo originale, testo migliorato e indicazione se il feedback è positivo",
    });
  }

  try {
    const db = loadFeedbackDB();

    const feedbackEntry = {
      original,
      enhanced,
      timestamp: new Date().toISOString(),
    };

    if (isPositive) {
      // Controlla se esiste già un feedback simile positivo
      const existingIndex = db.positiveFeedbacks.findIndex(
        (f) =>
          calculateSimilarity(
            f.original.toLowerCase(),
            original.toLowerCase()
          ) > 0.9
      );

      if (existingIndex !== -1) {
        // Aggiorna un feedback esistente
        db.positiveFeedbacks[existingIndex] = feedbackEntry;
      } else {
        // Aggiungi un nuovo feedback
        db.positiveFeedbacks.push(feedbackEntry);
      }
      db.statistics.totalPositiveFeedbacks++;
    } else {
      // Gestione feedback negativo
      // Controlla se esiste già un feedback simile negativo
      const existingIndex = db.negativeFeedbacks.findIndex(
        (f) =>
          calculateSimilarity(
            f.original.toLowerCase(),
            original.toLowerCase()
          ) > 0.9 &&
          calculateSimilarity(
            f.enhanced.toLowerCase(),
            enhanced.toLowerCase()
          ) > 0.8
      );

      if (existingIndex !== -1) {
        // Aggiorna un feedback esistente
        db.negativeFeedbacks[existingIndex] = feedbackEntry;
      } else {
        // Aggiungi un nuovo feedback
        db.negativeFeedbacks.push(feedbackEntry);
      }
      db.statistics.totalNegativeFeedbacks++;
    }

    // Aggiorna le statistiche
    db.statistics.lastUpdated = new Date().toISOString();
    saveFeedbackDB(db);

    res.json({ success: true, message: "Feedback salvato con successo" });
  } catch (error) {
    console.error("Errore nel salvataggio del feedback:", error);
    res.status(500).json({ error: "Errore nel salvataggio del feedback" });
  }
});

app.post("/api/save-correction", async (req, res) => {
  const { originalDescription, aiGenerated, userCorrected } = req.body;

  if (!originalDescription || !aiGenerated || !userCorrected) {
    return res.status(400).json({
      error:
        "Informazioni mancanti. Sono richieste: descrizione originale, versione AI e correzione utente",
    });
  }

  try {
    const db = loadCorrectionsDB();

    // Controlla se esiste già una correzione simile
    const existingIndex = db.corrections.findIndex(
      (c) =>
        calculateSimilarity(
          c.original.toLowerCase(),
          originalDescription.toLowerCase()
        ) > 0.9
    );

    if (existingIndex !== -1) {
      // Aggiorna una correzione esistente
      db.corrections[existingIndex] = {
        original: originalDescription,
        aiGenerated,
        userCorrected,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Aggiungi una nuova correzione
      db.corrections.push({
        original: originalDescription,
        aiGenerated,
        userCorrected,
        timestamp: new Date().toISOString(),
      });
    }

    // Aggiorna le statistiche
    db.statistics.totalCorrections++;
    db.statistics.lastUpdated = new Date().toISOString();

    saveCorrectionsDB(db);

    res.json({ success: true, message: "Correzione salvata con successo" });
  } catch (error) {
    console.error("Errore nel salvataggio della correzione:", error);
    res.status(500).json({ error: "Errore nel salvataggio della correzione" });
  }
});

app.get("/api/correction-stats", (req, res) => {
  try {
    const db = loadCorrectionsDB();
    res.json({
      totalCorrections: db.statistics.totalCorrections,
      lastUpdated: db.statistics.lastUpdated,
      totalRequests: db.statistics.totalRequests,
    });
  } catch (error) {
    console.error("Errore nel recupero delle statistiche:", error);
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

// Endpoint per ottenere statistiche sui feedback
app.get("/api/feedback-stats", (req, res) => {
  try {
    const db = loadFeedbackDB();
    res.json({
      totalPositiveFeedbacks: db.statistics.totalPositiveFeedbacks,
      totalNegativeFeedbacks: db.statistics.totalNegativeFeedbacks,
      lastUpdated: db.statistics.lastUpdated,
    });
  } catch (error) {
    console.error("Errore nel recupero delle statistiche:", error);
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

// Endpoint per testare la connessione a OpenRouter
app.get("/api/test-openrouter", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === "inserisci_qui_la_tua_chiave_api") {
    return res.status(500).json({
      success: false,
      message: "Chiave API mancante o non configurata. Controlla il file .env",
    });
  }

  // Ottieni il referer dalla richiesta, usa un fallback se non disponibile
  const referer =
    req.get("HTTP-Referer") ||
    req.get("Referer") ||
    req.get("Origin") ||
    "https://riformulatore-api.onrender.com";
  console.log("Test OpenRouter - Utilizzando HTTP-Referer:", referer);

  try {
    // Testa prima l'endpoint di autenticazione
    console.log("Testando autenticazione OpenRouter...");
    await axios.get("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      timeout: 5000,
    });

    // Poi testa una richiesta semplice con il modello specificato
    console.log(
      "Testando richiesta chat completions con modello deepseek/deepseek-r1:free..."
    );
    const chatResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-r1:free",
        messages: [
          { role: "system", content: "Sei un assistente utile." },
          { role: "user", content: "Ciao!" },
        ],
        max_tokens: 10,
        stream: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
          "HTTP-Referer": referer,
          "X-Title": "Test OpenRouter API",
        },
      }
    );

    console.log("Risposta modello:", chatResponse.data);

    return res.json({
      success: true,
      message: "Connessione a OpenRouter riuscita",
      modelWorks: true,
      response: chatResponse.data.choices[0].message.content,
    });
  } catch (error) {
    console.error("Errore OpenRouter:", error.message);

    // Log dettagliato dell'errore
    let errorDetails = { message: error.message };

    if (error.response) {
      console.error("Dati errore:", error.response.data);
      console.error("Status:", error.response.status);
      errorDetails = {
        ...errorDetails,
        status: error.response.status,
        data: error.response.data,
      };
    }

    return res.status(500).json({
      success: false,
      message: "Errore di connessione a OpenRouter",
      error: errorDetails,
    });
  }
});

// Endpoint per testare la connessione a OpenRouter
app.get("/api/test-connection", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === "inserisci_qui_la_tua_chiave_api") {
    return res.status(500).json({
      success: false,
      message: "Chiave API mancante o non configurata. Controlla il file .env",
    });
  }

  try {
    const response = await axios.get("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      timeout: 5000,
    });

    return res.json({
      success: true,
      message: "Connessione a OpenRouter riuscita",
      data: response.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Errore di connessione a OpenRouter",
      error: error.response?.data?.error?.message || error.message,
    });
  }
});

// Endpoint per ottenere i modelli disponibili
app.get("/api/models", (req, res) => {
  // Lista di modelli disponibili - puoi espandere questa lista secondo necessità
  const models = [
    {
      id: "deepseek/deepseek-r1:free",
      name: "DeepSeek R1 (Gratuito)",
      free: true,
    },
    {
      id: "meta-llama/llama-3-8b:free",
      name: "Llama 3 8B (Gratuito)",
      free: true,
    },
    { id: "google/gemma-7b-it:free", name: "Gemma 7B (Gratuito)", free: true },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", free: false },
  ];

  res.json({ models });
});

// Endpoint per gestire i like
app.post("/api/feedback", (req, res) => {
  try {
    const { input, output } = req.body;

    if (!input || !output) {
      return res.status(400).json({ error: "Input e output sono richiesti" });
    }

    const db = loadFeedbackDB();
    const normalizedInput = input.toLowerCase().trim();

    db[normalizedInput] = {
      input: input.trim(),
      output: output.trim(),
      likes: (db[normalizedInput]?.likes || 0) + 1,
      lastUsed: Date.now(),
    };

    saveFeedbackDB(db);

    return res.json({ success: true });
  } catch (error) {
    console.error("Errore nella gestione del feedback:", error);
    return res
      .status(500)
      .json({ error: "Errore nel salvataggio del feedback" });
  }
});

app.get("/ping", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

app.listen(port, () => {
  console.log("\x1b[32m%s\x1b[0m", `Server in ascolto sulla porta ${port}`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log(
      "\x1b[31m%s\x1b[0m",
      "Chiave API non configurata nel file .env!"
    );
  } else if (apiKey === "inserisci_qui_la_tua_chiave_api") {
    console.log(
      "\x1b[31m%s\x1b[0m",
      "Chiave API predefinita trovata nel file .env. Modificala con la tua chiave API di OpenRouter"
    );
  } else {
    console.log("\x1b[32m%s\x1b[0m", "Chiave API configurata nel file .env");
  }
});
