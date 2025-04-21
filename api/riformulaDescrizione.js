require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

// Configura CORS per accettare richieste da qualsiasi origine
app.use(
  cors({
    origin: "*", // Accetta richieste da qualsiasi dominio
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

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

app.post("/api/riformula", async (req, res) => {
  try {
    // Estrai i dati della richiesta
    const { input, model, isRegeneration, previousOutput } = req.body;
    const selectedModel = model || "deepseek/deepseek-r1:free";

    // Valida l'input
    if (!input || typeof input !== "string") {
      return res.status(400).json({
        error: "Input non valido. Fornire una descrizione da riformulare.",
      });
    }

    console.log(`Richiesta di riformulazione ricevuta per: "${input}"`);

    // Se è una rigenerazione, aggiungiamo un log
    if (isRegeneration) {
      console.log("Questa è una rigenerazione a seguito di feedback negativo.");
      if (previousOutput) {
        console.log(`Output precedente: "${previousOutput}"`);
      }
    }

    // Prima di tutto, proviamo a vedere se abbiamo un feedback positivo simile
    const similarPositiveFeedback = findSimilarPositiveFeedback(input);
    if (similarPositiveFeedback) {
      console.log("Trovato feedback positivo simile nel database.");
      return res.json({
        output: similarPositiveFeedback,
        fromDatabase: true,
        source: "positive-feedback",
      });
    }

    // Prepara i dati per la richiesta a OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Chiave API non configurata. Controlla il file .env",
      });
    }

    // URL dell'API OpenRouter
    const url = "https://openrouter.ai/api/v1/chat/completions";

    // Ottieni il referer dalla richiesta, usa un fallback se non disponibile
    const referer =
      req.get("HTTP-Referer") ||
      req.get("Referer") ||
      req.get("Origin") ||
      "https://riformulatore-api.onrender.com";

    // Headers della richiesta
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
      "HTTP-Referer": referer, // Usa il referer dalla richiesta
      "X-Title": "Riformulatore Descrizioni Tecniche",
    };

    console.log("Utilizzando HTTP-Referer:", referer);

    // Prompt di sistema con istruzioni più precise e vincolanti
    let systemMessage =
      "Sei un esperto sistemista IT con oltre 10 anni di esperienza nella redazione tecnica professionale. " +
      "Il tuo compito è riformulare la descrizione tecnica che riceverai in una versione professionale. " +
      "Segui scrupolosamente queste regole:" +
      "\n1. Mantieni il significato originale della frase" +
      "\n2. Usa un linguaggio tecnico corretto, formale e conciso" +
      "\n3. Elimina abbreviazioni e frasi colloquiali" +
      "\n4. Rendi chiaro cosa è stato fatto, su quale sistema, e con quale risultato" +
      "\n5. IMPORTANTE: Rispondi ESCLUSIVAMENTE con la descrizione riformulata, senza spiegazioni, commenti o ragionamenti" +
      "\n6. Non aggiungere mai frasi introduttive o conclusive" +
      "\n7. Non includere il tuo processo di ragionamento nella risposta" +
      "\n8. Non iniziare mai con 'Ecco la versione riformulata:' o frasi simili";

    // Se è una rigenerazione, aggiungiamo istruzioni specifiche
    if (isRegeneration && previousOutput) {
      systemMessage +=
        "\n\nIMPORTANTE: La seguente è una rigenerazione. " +
        'Un utente ha dato un feedback negativo alla risposta precedente: \n\n"' +
        previousOutput +
        '"\n\n' +
        "Genera una risposta DIVERSA e MIGLIORE dalla precedente, evitando gli stessi pattern e formulazioni.";
    }

    // Esempi per migliorare l'output (tecniche few-shot)
    const exampleMessages = [
      {
        role: "user",
        content: "creazione utente richiesto + settaggio impostazioni rds",
      },
      {
        role: "assistant",
        content:
          "Creazione dell'utenza richiesta con configurazione dei parametri RDS.",
      },
      { role: "user", content: "presidio zara" },
      {
        role: "assistant",
        content: "Presidio tecnico presso il punto vendita Zara.",
      },
      { role: "user", content: "supporto outlook + ticket aperto" },
      {
        role: "assistant",
        content:
          "Fornito supporto per Outlook e apertura del ticket di assistenza.",
      },
    ];

    // Dati della richiesta con esempi few-shot
    const data = {
      model: selectedModel,
      messages: [
        { role: "system", content: systemMessage },
        ...exampleMessages,
        { role: "user", content: input },
      ],
      temperature: isRegeneration ? 0.7 : 0.3, // Aumenta la temperatura se è una rigenerazione
      max_tokens: 500,
      top_p: 0.9, // Aggiunto per migliorare la qualità della risposta
      frequency_penalty: isRegeneration ? 0.3 : 0.1, // Aumenta la penalità se è una rigenerazione
      presence_penalty: isRegeneration ? 0.3 : 0.1, // Aumenta la penalità se è una rigenerazione
      stop: ["User:", "System:"], // Evita che continui con altro testo
    };

    console.log(
      `Invio richiesta a OpenRouter usando il modello: ${selectedModel}...`
    );
    console.log("URL:", url);
    console.log("Headers:", { ...headers, Authorization: "Bearer ***" }); // Nascondi la chiave API nei log
    console.log("Dati richiesta:", {
      model: data.model,
      temperature: data.temperature,
      max_tokens: data.max_tokens,
    });

    // Invia la richiesta a OpenRouter
    const response = await axios.post(url, data, { headers, timeout: 60000 }); // Aumentato timeout a 60 secondi

    console.log("Risposta ricevuta da OpenRouter");
    console.log("Status:", response.status);

    // Debug della risposta completa (opzionale, per diagnostica)
    console.log("Struttura risposta:", JSON.stringify(response.data, null, 2));

    // Estrai il testo dalla risposta con una gestione errori migliorata
    let output = "";

    try {
      // Verifica se la risposta ha la struttura attesa
      if (
        response.data &&
        response.data.choices &&
        response.data.choices.length > 0
      ) {
        const firstChoice = response.data.choices[0];

        // Controlla i vari formati possibili della risposta
        if (firstChoice.message && firstChoice.message.content) {
          output = firstChoice.message.content.trim();
        } else if (firstChoice.text) {
          output = firstChoice.text.trim();
        } else if (firstChoice.content) {
          output = firstChoice.content.trim();
        } else if (typeof firstChoice === "string") {
          output = firstChoice.trim();
        } else {
          // Fallback se la struttura è completamente diversa - debug
          output = JSON.stringify(firstChoice);
          console.log("Struttura di risposta non standard:", output);
        }
      } else {
        console.error("Struttura di risposta non valida:", response.data);
        // Se non riusciamo a trovare il contenuto nella risposta standard
        if (response.data && typeof response.data === "object") {
          output = JSON.stringify(response.data);
        }
      }
    } catch (parseError) {
      console.error("Errore nell'elaborazione della risposta:", parseError);
    }

    // Verifica che l'output non sia vuoto e sia una risposta sensata
    if (
      !output ||
      output.trim() === "" ||
      output.includes("undefined") ||
      output.length < 5
    ) {
      console.error(
        "Output vuoto o non valido ricevuto da OpenRouter:",
        output
      );

      // Fallback: utilizzare l'input originale con miglioramenti minimi
      let fallbackOutput = input.charAt(0).toUpperCase() + input.slice(1);
      if (!fallbackOutput.endsWith(".")) {
        fallbackOutput += ".";
      }

      return res.json({
        output: fallbackOutput,
        fromDatabase: false,
        warning:
          "Si è verificato un problema con la risposta dell'AI. È stata applicata una formattazione di base.",
      });
    }

    // Se è una rigenerazione, verifica che il nuovo output non sia simile
    // ad altri feedback negativi precedenti
    if (isRegeneration && previousOutput) {
      // Se il nuovo output è troppo simile al precedente, rigeneralo
      const similarityWithPrevious = calculateSimilarity(
        output.toLowerCase(),
        previousOutput.toLowerCase()
      );
      if (similarityWithPrevious > 0.7) {
        console.log(
          "Output rigenerato troppo simile al precedente. Riprovo..."
        );

        // Aumentiamo ulteriormente la temperatura e la penalità per ottenere più variabilità
        data.temperature = 0.9;
        data.frequency_penalty = 0.5;
        data.presence_penalty = 0.5;

        // Modifichiamo leggermente il prompt
        data.messages[0].content +=
          "\n\nÈ CRUCIALE generare una risposta COMPLETAMENTE DIVERSA dalla precedente.";

        // Riprova
        const retryResponse = await axios.post(url, data, {
          headers,
          timeout: 60000,
        });
        if (
          retryResponse.data &&
          retryResponse.data.choices &&
          retryResponse.data.choices.length > 0 &&
          retryResponse.data.choices[0].message &&
          retryResponse.data.choices[0].message.content
        ) {
          output = retryResponse.data.choices[0].message.content.trim();
        }
      }
    }

    // Verifica che l'output generato non sia simile a risposte negative precedenti
    if (isSimilarToNegativeFeedback(input, output)) {
      console.log(
        "Output simile a feedback negativi precedenti. Riprovo con parametri diversi..."
      );

      // Modifichiamo i parametri per ottenere una risposta più diversificata
      data.temperature = 0.8;
      data.frequency_penalty = 0.4;
      data.presence_penalty = 0.4;

      // Riprova
      const retryResponse = await axios.post(url, data, {
        headers,
        timeout: 60000,
      });
      if (
        retryResponse.data &&
        retryResponse.data.choices &&
        retryResponse.data.choices.length > 0 &&
        retryResponse.data.choices[0].message &&
        retryResponse.data.choices[0].message.content
      ) {
        output = retryResponse.data.choices[0].message.content.trim();
      }
    }

    // Log dell'output generato
    console.log("Output generato:", output);

    // Aggiorna le statistiche (opzionale)
    try {
      const db = loadCorrectionsDB();
      db.statistics.totalRequests++;
      db.statistics.lastUpdated = new Date().toISOString();
      saveCorrectionsDB(db);
    } catch (dbError) {
      console.warn("Impossibile aggiornare le statistiche:", dbError);
    }

    // Assicura che la prima lettera sia maiuscola
    if (output && output.length > 0) {
      output = output.charAt(0).toUpperCase() + output.slice(1);

      // Assicura che ci sia un punto alla fine se non c'è già una punteggiatura
      if (!/[.?!]$/.test(output)) {
        output += ".";
      }
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

      // Messaggio di errore specifico in base al codice di stato
      if (error.response.status === 401) {
        return res.status(500).json({
          error: "Chiave API di OpenRouter non valida. Controlla il file .env",
          details: error.response.data?.error?.message || error.message,
        });
      } else if (error.response.status === 404) {
        return res.status(500).json({
          error: `Il modello specificato non è stato trovato o non è disponibile`,
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
