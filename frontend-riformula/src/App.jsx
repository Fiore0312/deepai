import { useState } from "react";
import { Send, RefreshCw, ThumbsUp, ThumbsDown, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";

// URL base dell'API: auto-detect environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? "http://localhost:3000" 
    : "https://deepai-weem.onrender.com");

function App() {
  const [rawDescription, setRawDescription] = useState("");
  const [enhancedDescription, setEnhancedDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Esempi di input/output per mostrare agli utenti
  const examples = [
    {
      input: "installazione software",
      output: "Completata l'installazione del software richiesto. Test di funzionamento eseguiti con esito positivo."
    },
    {
      input: "test email tutto ok",
      output: "Eseguiti test di configurazione email. Verifica invio e ricezione completata con successo."
    },
    {
      input: "ripristino backup server",
      output: "Eseguito ripristino completo del backup server. Verificata integrità dei dati e funzionalità del sistema."
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rawDescription.trim() || isLoading) return;

    setIsLoading(true);
    setError("");
    setEnhancedDescription("");
    setFeedback(null);
    setRetryAttempt(0);
    setLoadingMessage("Elaborazione in corso...");

    const makeRequest = async (retryCount = 0) => {
      try {
        if (retryCount > 0) {
          setRetryAttempt(retryCount);
          setLoadingMessage(`Tentativo ${retryCount + 1}/3...`);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(`${API_BASE_URL}/api/riformula`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: rawDescription.trim() }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Retry automatico per errori di rete o server temporanei
          if ((response.status >= 500 || response.status === 429) && retryCount < 2) {
            console.log(`Retry ${retryCount + 1}/2 dopo errore ${response.status}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            return makeRequest(retryCount + 1);
          }
          
          throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }

        const data = await response.json();
        const result = data.output || data.reformulatedDescription || data.result || "";
        
        if (!result.trim()) {
          throw new Error("Risposta vuota dal server");
        }
        
        setEnhancedDescription(result);
        
      } catch (err) {
        console.error("Errore richiesta:", err);
        
        if (err.name === 'AbortError') {
          throw new Error("Richiesta scaduta. Riprova con un input più breve.");
        }
        
        if (err.message.includes('fetch')) {
          throw new Error("Errore di connessione. Verifica la tua connessione internet.");
        }
        
        throw err;
      }
    };

    try {
      await makeRequest();
    } catch (err) {
      setError(err.message || "Errore durante l'elaborazione della richiesta");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
      setRetryAttempt(0);
    }
  };

  const handleFeedback = async (isPositive) => {
    if (!enhancedDescription.trim() || feedback !== null) return;

    console.log('🔄 Invio feedback:', { isPositive, API_BASE_URL });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per feedback

      const requestData = {
        input: rawDescription.trim(),
        output: enhancedDescription.trim(),
        isPositive: isPositive,
        timestamp: new Date().toISOString()
      };

      console.log('📤 Dati feedback:', requestData);

      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📥 Risposta feedback:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore feedback API:', {
          status: response.status,
          error: errorData.error || 'Errore sconosciuto',
          details: errorData
        });
        // Mostra feedback negativo se il salvataggio fallisce
        setFeedback('error');
        setTimeout(() => setFeedback(null), 3000);
        return;
      }

      const responseData = await response.json();
      console.log('✅ Feedback salvato:', responseData);
      
      // Solo ora imposta il feedback visuale positivo
      setFeedback(isPositive ? 'positive' : 'negative');
      setTimeout(() => setFeedback(null), 3000);
      
    } catch (err) {
      console.error("❌ Errore invio feedback:", err);
      if (err.name === 'AbortError') {
        console.error('⏰ Timeout feedback dopo 10s');
      }
      // Mostra feedback di errore
      setFeedback('error');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setRawDescription(value);
      setCharCount(value.length);
    }
  };

  const handleClear = () => {
    setRawDescription("");
    setEnhancedDescription("");
    setError("");
    setCharCount(0);
    setFeedback(null);
    setRetryAttempt(0);
    setLoadingMessage("");
  };

  const useExample = (example) => {
    setRawDescription(example.input);
    setCharCount(example.input.length);
    setEnhancedDescription("");
    setError("");
    setFeedback(null);
    setRetryAttempt(0);
    setLoadingMessage("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🤖 DeepAI - Riformulatore Professionale
          </h1>
          <p className="text-gray-600">
            Trasforma descrizioni informali in rapporti professionali IT
          </p>
        </div>

        {/* Main Interface */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input Section */}
            <div>
              <label htmlFor="input" className="block text-sm font-medium text-gray-700 mb-2">
                Descrizione da migliorare
              </label>
              <div className="relative">
                <textarea
                  id="input"
                  value={rawDescription}
                  onChange={handleInputChange}
                  placeholder="Inserisci la tua descrizione qui... (es: installazione software)"
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  disabled={isLoading}
                />
                <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                  {charCount}/500
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!rawDescription.trim() || isLoading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {loadingMessage || "Elaborazione..."}
                    {retryAttempt > 0 && (
                      <span className="text-xs opacity-75">
                        (Retry {retryAttempt}/2)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Migliora Descrizione
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Errore</p>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Output Section */}
          {enhancedDescription && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-green-800">Descrizione Migliorata</h3>
              </div>
              <p className="text-gray-800 leading-relaxed mb-4">
                {enhancedDescription}
              </p>
              
              {/* Feedback Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 mr-2">Questo risultato è utile?</span>
                <button
                  onClick={() => handleFeedback(true)}
                  disabled={feedback !== null}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                    feedback === 'positive'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600'
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                  Sì
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  disabled={feedback !== null}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                    feedback === 'negative'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <ThumbsDown className="w-3 h-3" />
                  No
                </button>
                {feedback === 'error' && (
                  <span className="text-xs text-red-600 ml-2">
                    ⚠ Errore salvataggio
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Examples Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-800">Esempi di Trasformazione</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-1">
            {examples.map((example, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">Input</span>
                  <p className="text-gray-700">{example.input}</p>
                </div>
                <div className="mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase">Output</span>
                  <p className="text-gray-800 font-medium">{example.output}</p>
                </div>
                <button
                  onClick={() => useExample(example)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Usa questo esempio →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>🤖 Powered by DeepAI - Trasformazione automatica di descrizioni IT</p>
        </div>
      </div>
    </div>
  );
}

export default App;