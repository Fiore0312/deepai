const axios = require("axios");

const BACKEND_URLS = [
  "http://localhost:3000",
  "https://deepai-weem.onrender.com",
];

async function testEndpoint(url) {
  const startTime = Date.now();
  try {
    const response = await axios.get(`${url}/ping`);
    const endTime = Date.now();
    return {
      url,
      status: "success",
      responseTime: endTime - startTime,
      statusCode: response.status,
      data: response.data,
    };
  } catch (error) {
    return {
      url,
      status: "error",
      error: error.message,
      errorCode: error.response?.status,
    };
  }
}

async function runDiagnostics() {
  console.log("🔍 Iniziando diagnostica server...\n");

  for (const url of BACKEND_URLS) {
    console.log(`Testing ${url}...`);
    const result = await testEndpoint(url);

    if (result.status === "success") {
      console.log(`✅ Server raggiungibile`);
      console.log(`Tempo di risposta: ${result.responseTime}ms`);
      console.log(`Status: ${result.statusCode}`);
      console.log(`Data: ${JSON.stringify(result.data)}\n`);
    } else {
      console.log(`❌ Server non raggiungibile`);
      console.log(`Errore: ${result.error}`);
      console.log(`Codice errore: ${result.errorCode || "N/A"}\n`);
    }
  }
}

runDiagnostics();
