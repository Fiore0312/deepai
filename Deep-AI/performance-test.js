const axios = require("axios");
const fs = require("fs").promises;

const API_URL = "https://deepai-weem.onrender.com/api/riformula";

// Funzione per misurare il tempo di risposta del server
async function pingServer() {
  const start = Date.now();
  try {
    await axios.get(API_URL.replace("/riformula", "/ping"));
    return Date.now() - start;
  } catch (error) {
    return null;
  }
}

async function logPerformance(description, duration, response, input) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    description,
    input_length: input?.length || 0,
    duration,
    status: response?.status,
    error: response?.error,
  };

  try {
    await fs.appendFile(
      "detailed-performance-logs.json",
      JSON.stringify(logEntry) + "\n"
    );
  } catch (error) {
    console.error("Errore nel salvare i log:", error);
  }
}

// Test con diversi payload
const testCases = [
  {
    name: "Test Breve",
    input: "Installazione software",
  },
  {
    name: "Test Medio",
    input: "Configurazione server e installazione aggiornamenti di sicurezza",
  },
  {
    name: "Test Lungo",
    input:
      "Implementazione completa dell'infrastruttura di rete con configurazione dei firewall e ottimizzazione delle performance di sistema",
  },
  {
    name: "Test con Caratteri Speciali",
    input:
      "Test dell'applicazione con input è già formattato correttamente, include àèìòù",
  },
];

// Test di concorrenza
async function runConcurrentTests(numRequests = 3) {
  console.log(
    `\nTest di concorrenza con ${numRequests} richieste simultanee...`
  );
  const start = Date.now();

  const promises = Array(numRequests)
    .fill(testCases[0])
    .map(async (testCase, index) => {
      try {
        const response = await axios.post(API_URL, { input: testCase.input });
        return {
          index,
          duration: Date.now() - start,
          status: response.status,
        };
      } catch (error) {
        return {
          index,
          error: error.message,
        };
      }
    });

  const results = await Promise.all(promises);
  console.log("\nRisultati test concorrenza:");
  results.forEach((result) => {
    if (result.error) {
      console.log(`Richiesta ${result.index}: Errore - ${result.error}`);
    } else {
      console.log(
        `Richiesta ${result.index}: ${result.duration}ms (Status: ${result.status})`
      );
    }
  });
}

// Test sequenziali
async function runSequentialTests() {
  console.log("\nInizio test sequenziali...");

  for (const testCase of testCases) {
    const start = Date.now();
    try {
      console.log(`\nEsecuzione ${testCase.name}...`);
      const response = await axios.post(API_URL, { input: testCase.input });
      const duration = Date.now() - start;

      await logPerformance(testCase.name, duration, response, testCase.input);

      console.log(`Durata: ${duration}ms`);
      console.log(`Status: ${response.status}`);
      console.log(`Output: ${response.data.output}`);
    } catch (error) {
      console.error(`Errore in ${testCase.name}:`, error.message);
      await logPerformance(
        testCase.name,
        Date.now() - start,
        { error: error.message },
        testCase.input
      );
    }
  }
}

// Esegui tutti i test
async function runAllTests() {
  console.log("🔍 Iniziando la suite completa di test...\n");

  // Test di latenza base
  const pingTime = await pingServer();
  console.log(`Latenza base del server: ${pingTime}ms`);

  // Test sequenziali
  await runSequentialTests();

  // Test di concorrenza
  await runConcurrentTests(3);

  console.log("\n✅ Test completati!");
}

runAllTests();
