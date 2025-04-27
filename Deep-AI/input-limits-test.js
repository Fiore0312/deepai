const axios = require("axios");

const API_URL = "https://deepai-weem.onrender.com/api/riformula";

// Test con input di diverse lunghezze
const TEST_INPUTS = [
  {
    name: "Input Molto Breve",
    input: "test",
    length: 4,
  },
  {
    name: "Input Normale",
    input: "Installazione software antivirus su server exchange",
    length: 47,
  },
  {
    name: "Input Lungo",
    input:
      "Configurazione completa del sistema di backup con verifica delle repliche e test di ripristino dei dati più importanti secondo le policy aziendali definite".repeat(
        2
      ),
    length: 276,
  },
  {
    name: "Input Molto Lungo",
    input:
      "Implementazione e configurazione del sistema di monitoraggio della rete aziendale con installazione degli agent su tutti i server, configurazione delle soglie di allarme, setup delle notifiche email e creazione dashboard personalizzata.".repeat(
        3
      ),
    length: 507,
  },
];

async function testInputLimit(testCase) {
  console.log(`\nTestando: ${testCase.name}`);
  console.log(`Lunghezza input: ${testCase.length} caratteri`);

  const startTime = Date.now();
  try {
    const response = await axios.post(API_URL, {
      input: testCase.input,
    });
    const duration = Date.now() - startTime;

    return {
      ...testCase,
      success: true,
      duration,
      output: response.data.output,
      outputLength: response.data.output?.length || 0,
    };
  } catch (error) {
    return {
      ...testCase,
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

async function runTests() {
  console.log("🔍 Iniziando test dei limiti di input...\n");

  const results = [];
  for (const testCase of TEST_INPUTS) {
    const result = await testInputLimit(testCase);
    results.push(result);

    if (result.success) {
      console.log("✅ Test completato con successo");
      console.log(`⏱️ Durata: ${result.duration}ms`);
      console.log(`📝 Output (${result.outputLength} caratteri):`);
      console.log(result.output);
    } else {
      console.log("❌ Test fallito");
      console.log(`Errore: ${result.error}`);
    }
  }

  // Analisi dei risultati
  console.log("\n📊 Riepilogo Test:");
  console.log(`Test completati: ${results.length}`);
  console.log(`Test riusciti: ${results.filter((r) => r.success).length}`);

  const avgDuration =
    results
      .filter((r) => r.success)
      .reduce((acc, curr) => acc + curr.duration, 0) /
    results.filter((r) => r.success).length;

  console.log(`Tempo medio di risposta: ${avgDuration.toFixed(2)}ms`);
}

// Esegui i test
runTests().catch(console.error);
