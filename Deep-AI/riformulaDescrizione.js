require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Percorso del file di database delle correzioni
const CORRECTIONS_DB_PATH = path.join(__dirname, "corrections_db.json");

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

app.post("/api/riformula", async (req, res) => {
  const { input, model = "deepseek/deepseek-r1:free" } = req.body;

  // Validazione input
  if (!input || input.length < 40) {
    return res
      .status(400)
      .json({ error: "Il testo deve essere di almeno 40 caratteri" });
  }

  // Aggiorna le statistiche
  const db = loadCorrectionsDB();
  db.statistics.totalRequests++;
  saveCorrectionsDB(db);

  // Verifica se esiste una descrizione simile nel database
  const similarCorrection = findSimilarDescription(input, db);

  // Se esiste una correzione simile, restituiscila subito
  if (similarCorrection) {
    console.log("Trovata descrizione simile nel database delle correzioni");
    return res.json({
      output: similarCorrection.userCorrected,
      fromDatabase: true,
      similarity: calculateSimilarity(
        input.toLowerCase(),
        similarCorrection.original.toLowerCase()
      ),
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === "inserisci_qui_la_tua_chiave_api") {
    console.error(
      "\x1b[31m%s\x1b[0m",
      "Chiave API mancante o non configurata nel file .env"
    );
    return res
      .status(500)
      .json({
        error: "Chiave API mancante o non configurata. Controlla il file .env",
      });
  }

  const url = "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey.trim()}`,
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Miglioramento Descrizioni Tecniche",
    "User-Agent": "BAIT Service Technical Description Enhancer/1.0.0",
  };

  // Utilizziamo il modello specificato dall'utente, con deepseek/deepseek-r1:free come default
  const data = {
    model: model,
    messages: [
      {
        role: "system",
        content:
          "Sei un assistente specializzato nel migliorare descrizioni tecniche in modo professionale.",
      },
      {
        role: "user",
        content: `Migliora questa descrizione tecnica in modo chiaro, completo e professionale, mantenendo tutti i dettagli tecnici importanti: ${input}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
    route: "fallback", // Aggiunto per migliorare la stabilità
  };

  try {
    console.log(`Invio richiesta a OpenRouter usando il modello: ${model}...`);
    console.log("URL:", url);
    console.log("Headers:", { ...headers, Authorization: "Bearer ***" }); // Nascondi la chiave API nei log
    console.log("Dati richiesta:", {
      model: data.model,
      messages: data.messages.map((m) => ({
        role: m.role,
        contentLength: m.content.length,
      })),
      temperature: data.temperature,
      max_tokens: data.max_tokens,
    });

    const response = await axios.post(url, data, { headers, timeout: 60000 }); // Aumentato il timeout a 60 secondi
    console.log("Risposta ricevuta da OpenRouter");
    console.log("Status:", response.status);
    console.log("Headers:", response.headers);
    console.log("Response data structure:", Object.keys(response.data));

    // Log completo della risposta per debug
    console.log("Risposta completa:", JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      console.error("Risposta non valida da OpenRouter:", response.data);
      return res.status(500).json({
        error: "Risposta non valida da OpenRouter",
        responseData: response.data || "Nessun dato",
      });
    }

    // Controlla se la risposta ha la struttura prevista
    if (
      !response.data.choices[0].message ||
      typeof response.data.choices[0].message.content !== "string"
    ) {
      console.error(
        "Formato risposta non valido da OpenRouter:",
        response.data.choices[0]
      );

      // Tenta di estrarre il contenuto in modo alternativo
      let output = "";

      if (response.data.choices[0].text) {
        // Alcuni modelli potrebbero utilizzare 'text' invece di 'message.content'
        output = response.data.choices[0].text;
      } else if (response.data.choices[0].message) {
        // Se message esiste ma content è undefined, prova a convertire in stringa
        output = String(response.data.choices[0].message.content || "");
      } else {
        // Fallback: usa la rappresentazione JSON della risposta
        output = JSON.stringify(response.data.choices[0]);
      }

      console.log("Output estratto con metodo alternativo:", output);

      return res.json({
        output: output || "Non è stato possibile generare un output valido",
        fromDatabase: false,
        warning: "Formato risposta inatteso",
      });
    }

    const output = response.data.choices[0].message.content;
    console.log(
      "Output generato:",
      output ? `${output.substring(0, 50)}...` : "Output vuoto!"
    );

    // Verifica che l'output non sia vuoto
    if (!output || output.trim() === "") {
      console.error("Output vuoto ricevuto da OpenRouter");
      return res.json({
        output: "Errore: La risposta generata è vuota. Riprova.",
        fromDatabase: false,
        warning: "Output vuoto",
      });
    }

    return res.json({ output, fromDatabase: false });
  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", "Errore OpenRouter:", error.message);

    // Log dettagliato dell'errore
    if (error.response) {
      // La richiesta è stata effettuata e il server ha risposto con un codice di stato
      // che esce dall'intervallo 2xx
      console.error(
        "\x1b[31m%s\x1b[0m",
        "Dati errore:",
        JSON.stringify(error.response.data, null, 2)
      );
      console.error(
        "\x1b[31m%s\x1b[0m",
        "Status errore:",
        error.response.status
      );
      console.error(
        "\x1b[31m%s\x1b[0m",
        "Headers errore:",
        JSON.stringify(error.response.headers, null, 2)
      );

      // Messaggio di errore specifico in base al codice di stato
      if (error.response.status === 401) {
        return res.status(500).json({
          error: "Chiave API di OpenRouter non valida. Controlla il file .env",
          details: error.response.data?.error?.message || error.message,
        });
      } else if (error.response.status === 404) {
        return res.status(500).json({
          error: `Il modello "${model}" non è stato trovato o non è disponibile`,
          details: error.response.data?.error?.message || error.message,
        });
      } else if (error.response.status === 429) {
        return res.status(500).json({
          error: "Limite di richieste OpenRouter raggiunto. Riprova più tardi",
          details: error.response.data?.error?.message || error.message,
        });
      }
    } else if (error.request) {
      // La richiesta è stata effettuata ma non è stata ricevuta alcuna risposta
      console.error(
        "\x1b[31m%s\x1b[0m",
        "Richiesta senza risposta:",
        error.request
      );
      return res.status(500).json({
        error:
          "Nessuna risposta dal server OpenRouter. Controlla la tua connessione internet",
        details: error.message,
      });
    } else {
      // Si è verificato un errore durante l'impostazione della richiesta
      console.error(
        "\x1b[31m%s\x1b[0m",
        "Errore di configurazione richiesta:",
        error.message
      );
    }

    res.status(500).json({
      error: "Errore nella richiesta all'API di OpenRouter",
      details: error.response?.data?.error?.message || error.message,
      output:
        "Si è verificato un errore nel miglioramento della descrizione. Riprova più tardi.",
    });
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
          "HTTP-Referer": "http://localhost:3000",
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
