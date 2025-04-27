const axios = require("axios");
const fs = require("fs").promises;

const API_URL = "https://deepai-weem.onrender.com";
const TIMEOUT = 30000; // 30 secondi

const TEST_CASES = [
  {
    name: "Input Breve",
    input: "configurazione rds",
    expectedTime: 10000, // 10 secondi
  },
  {
    name: "Input Medio",
    input:
      "Installazione software antivirus e configurazione policy di sicurezza",
    expectedTime: 15000, // 15 secondi
  },
  {
    name: "Input Lungo",
    input:
      "Implementazione e configurazione completa del sistema di backup con verifica delle repliche e test di ripristino dati",
    expectedTime: 20000, // 20 secondi
  },
];

async function measureResponseTime(testCase) {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${API_URL}/api/riformula`,
      {
        input: testCase.input,
        model: "deepseek/deepseek-r1:free",
      },
      {
        timeout: TIMEOUT,
        headers: {
          "Content-Type": "application/json",
          "Accept-Charset": "utf-8",
        },
      }
    );
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      ...testCase,
      duration,
      success: true,
      output: response.data.output,
      isSlowerThanExpected: duration > testCase.expectedTime,
      statusCode: response.status,
      headers: response.headers,
    };
  } catch (error) {
    return {
      ...testCase,
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
      errorDetail: error.response?.data || error.code,
    };
  }
}

async function testServerConnection() {
  try {
    console.log("🔍 Test connessione al server...");
    const testResponse = await axios.get(`${API_URL}/api/test-openrouter`, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "Accept-Charset": "utf-8",
      },
    });

    console.log("✅ Server raggiungibile");
    console.log("📊 Dettagli connessione:", testResponse.data);
    return true;
  } catch (error) {
    console.error("❌ Server non raggiungibile:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Risposta:", error.response.data);
    }
    return false;
  }
}

async function testServerResponse() {
  console.log("🔍 Inizia test del server...\n");

  // Test connessione base
  const isServerReachable = await testServerConnection();
  if (!isServerReachable) {
    return;
  }

  // Test dei casi
  const results = [];
  for (const testCase of TEST_CASES) {
    console.log(`\n🔄 Esecuzione test: ${testCase.name}`);
    const result = await measureResponseTime(testCase);
    results.push(result);

    if (result.success) {
      console.log(`✅ Completato in ${result.duration}ms`);
      if (result.isSlowerThanExpected) {
        console.log(
          `⚠️ Attenzione: Risposta più lenta del previsto (${result.duration}ms > ${testCase.expectedTime}ms)`
        );
      }
      console.log(`📝 Output: ${result.output}`);
    } else {
      console.log(`❌ Errore: ${result.error}`);
    }
  }

  // Analisi finale
  const successfulTests = results.filter((r) => r.success);
  const averageTime =
    successfulTests.reduce((acc, curr) => acc + curr.duration, 0) /
    successfulTests.length;
  const slowTests = results.filter((r) => r.isSlowerThanExpected);

  console.log("\n📊 Riepilogo Test:");
  console.log(`- Test completati: ${results.length}`);
  console.log(`- Test riusciti: ${successfulTests.length}`);
  console.log(`- Tempo medio di risposta: ${averageTime.toFixed(2)}ms`);
  console.log(`- Test lenti: ${slowTests.length}`);

  // Salva i risultati
  const testReport = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalTests: results.length,
      successfulTests: successfulTests.length,
      averageTime,
      slowTests: slowTests.length,
    },
  };

  await fs.writeFile(
    "performance-report.json",
    JSON.stringify(testReport, null, 2)
  );
  console.log("\n📝 Report salvato in performance-report.json");
}

// Esegui i test
testServerResponse().catch(console.error);
