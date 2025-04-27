const axios = require("axios");

const TEST_CASES = [
  {
    name: "Test Presidio Zara",
    input: "Presidio Zara",
    expectedFromFeedback: true,
  },
  {
    name: "Test variante Presidio Zara",
    input: "presidio zara",
    expectedFromFeedback: true,
  },
  {
    name: "Test Manutenzione Programmata",
    input: "Manutenzione programmata",
    expectedFromFeedback: true,
  },
  {
    name: "Test input non in database",
    input: "Configurazione nuovo server",
    expectedFromFeedback: false,
  },
];

async function runTest(testCase) {
  console.log(`\n🔍 Esecuzione ${testCase.name}`);
  console.log(`Input: "${testCase.input}"`);

  try {
    const startTime = Date.now();
    const response = await axios.post(
      "https://deepai-weem.onrender.com/api/riformula",
      {
        input: testCase.input,
      }
    );
    const duration = Date.now() - startTime;

    console.log(`✅ Test completato in ${duration}ms`);
    console.log(`📝 Output: ${response.data.output}`);
    console.log(`👍 Likes: ${response.data.likes || 0}`);
    console.log(`🔄 From feedback: ${response.data.fromFeedback || false}`);

    // Verifica se il comportamento è quello atteso
    if (response.data.fromFeedback === testCase.expectedFromFeedback) {
      console.log("✅ Comportamento corretto");
    } else {
      console.log("❌ Comportamento non corretto");
      console.log(`Atteso: fromFeedback=${testCase.expectedFromFeedback}`);
      console.log(`Ricevuto: fromFeedback=${response.data.fromFeedback}`);
    }

    return response.data;
  } catch (error) {
    console.error("❌ Errore:", error.message);
    if (error.response) {
      console.error("Dettagli:", error.response.data);
    }
    return null;
  }
}

async function runAllTests() {
  console.log("🚀 Inizio test del sistema di feedback\n");

  for (const testCase of TEST_CASES) {
    await runTest(testCase);
  }

  console.log("\n✨ Test completati");
}

runAllTests();
