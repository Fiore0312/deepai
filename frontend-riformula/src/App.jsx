import { useState, useEffect } from "react";

// URL base dell'API: usa un URL di produzione quando è in produzione, altrimenti usa localhost
const API_BASE_URL = import.meta.env.PROD
  ? "https://riformulatore-api.onrender.com" // Sostituisci con l'URL del tuo backend in produzione
  : "http://localhost:3000";

function App() {
  const [rawDescription, setRawDescription] = useState("");
  const [enhancedDescription, setEnhancedDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [charCount, setCharCount] = useState(0);
  const [isFromDatabase, setIsFromDatabase] = useState(false);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [originalAIOutput, setOriginalAIOutput] = useState("");
  const [stats, setStats] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Aggiorna il conteggio caratteri quando cambia la descrizione
  useEffect(() => {
    setCharCount(rawDescription.length);
  }, [rawDescription]);

  // Carica le statistiche all'avvio
  useEffect(() => {
    fetchStats();
  }, []);

  // Funzione per recuperare le statistiche
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/correction-stats`);

      // Verifica se la risposta è OK prima di tentare di estrarre il JSON
      if (!response.ok) {
        throw new Error(
          `Errore del server: ${response.status} ${response.statusText}`
        );
      }

      // Controllo del Content-Type per assicurarsi che sia JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Risposta non è in formato JSON:", contentType);
        throw new Error(
          "Il server non ha restituito JSON. Il server backend è in esecuzione?"
        );
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Errore nel recupero delle statistiche:", error);
      // Non mostrare l'errore all'utente all'avvio per non disturbarlo
      // ma loggarlo nella console per debug
    }
  };

  const handleRiformula = async () => {
    // Resetta eventuali errori precedenti
    setError("");
    setDebugInfo(null);
    setSaveSuccess(false);
    setIsCorrectionMode(false);

    // Verifica che ci sia del testo da elaborare
    if (!rawDescription.trim()) {
      setError("Inserisci una descrizione da migliorare");
      return;
    }

    // Verifica lunghezza minima
    if (rawDescription.trim().length < 40) {
      setError(
        "La descrizione deve essere di almeno 40 caratteri per essere elaborata correttamente."
      );
      return;
    }

    setIsLoading(true);

    try {
      console.log("Inviando richiesta a:", `${API_BASE_URL}/api/riformula`);
      console.log("Dati inviati:", {
        input: rawDescription,
        model: "deepseek/deepseek-r1:free",
      });

      const response = await fetch(`${API_BASE_URL}/api/riformula`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: rawDescription,
          model: "deepseek/deepseek-r1:free", // Usiamo il modello gratuito di default
        }),
      });

      console.log(
        "Risposta HTTP ricevuta:",
        response.status,
        response.statusText
      );

      // Verifica se la risposta è OK prima di tentare di estrarre il JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Risposta di errore dal server:", errorText);

        // Prova a convertire in JSON se possibile
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Se non è JSON, crea un oggetto con il testo
          errorData = { errorDetail: errorText.substring(0, 200) + "..." };
        }

        setDebugInfo({
          status: response.status,
          statusText: response.statusText,
          errorData,
        });

        throw new Error(
          `Errore del server: ${response.status} ${response.statusText}`
        );
      }

      // Controllo del Content-Type
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Risposta non è in formato JSON:", contentType);
        setDebugInfo({
          contentType,
          responseText: text.substring(0, 200) + "...",
        });
        throw new Error(
          "Il server non ha restituito JSON. Il server backend è in esecuzione?"
        );
      }

      const data = await response.json();
      console.log("Dati risposta:", data);

      if (data.output) {
        setEnhancedDescription(data.output);
        setOriginalAIOutput(data.output); // Salva l'output originale dell'AI
        setIsFromDatabase(data.fromDatabase || false);

        // Se la risposta proviene dal database, mostra un messaggio
        if (data.fromDatabase) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 5000);
        }

        console.log("Output impostato:", data.output);
      } else {
        console.error('Risposta API mancante di "output":', data);
        setError('Risposta API non valida: manca il campo "output"');
        setDebugInfo({ responseData: data });
      }
    } catch (err) {
      console.error("Errore completo:", err);
      setError(
        `Errore: ${
          err.message ||
          "Si è verificato un problema durante la comunicazione con il server"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione per salvare una correzione
  const handleSaveCorrection = async () => {
    if (enhancedDescription === originalAIOutput) {
      setError("Non hai apportato modifiche alla risposta dell'AI");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/save-correction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalDescription: rawDescription,
          aiGenerated: originalAIOutput,
          userCorrected: enhancedDescription,
        }),
      });

      // Verifica se la risposta è OK prima di tentare di estrarre il JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Risposta di errore dal server:", errorText);

        // Prova a convertire in JSON se possibile
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Se non è JSON, crea un oggetto con il testo
          errorData = { errorDetail: errorText.substring(0, 200) + "..." };
        }

        setDebugInfo({
          status: response.status,
          statusText: response.statusText,
          errorData,
        });

        throw new Error(
          `Errore del server: ${response.status} ${response.statusText}`
        );
      }

      // Controllo del Content-Type
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Risposta non è in formato JSON:", contentType);
        setDebugInfo({
          contentType,
          responseText: text.substring(0, 200) + "...",
        });
        throw new Error(
          "Il server non ha restituito JSON. Il server backend è in esecuzione?"
        );
      }

      const data = await response.json();

      if (response.ok) {
        setSaveSuccess(true);
        fetchStats(); // Aggiorna le statistiche

        // Reset dopo 5 secondi
        setTimeout(() => {
          setSaveSuccess(false);
        }, 5000);
      } else {
        setError(data.error || "Errore nel salvataggio della correzione");
      }
    } catch (err) {
      console.error("Errore completo:", err);
      setError(
        `Errore: ${
          err.message ||
          "Si è verificato un problema durante il salvataggio della correzione"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Funzione per abilitare la modalità correzione
  const enableCorrectionMode = () => {
    setIsCorrectionMode(true);
  };

  // Funzione per annullare le modifiche
  const resetCorrection = () => {
    setEnhancedDescription(originalAIOutput);
    setIsCorrectionMode(false);
  };

  const handleCopy = () => {
    if (!enhancedDescription) return;

    navigator.clipboard
      .writeText(enhancedDescription)
      .then(() => {
        // Feedback visivo temporaneo che è stato copiato
        const copyButton = document.getElementById("copyButton");
        if (copyButton) {
          const originalText = copyButton.innerText;
          copyButton.innerText = "✓ Copiato!";

          setTimeout(() => {
            copyButton.innerText = originalText;
          }, 2000);
        }
      })
      .catch((err) => {
        console.error("Errore durante la copia:", err);
        setError(
          "Impossibile copiare il testo. Prova a selezionarlo manualmente."
        );
      });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-blue-700 mb-2">
          Miglioramento Descrizioni Tecniche
        </h1>
        <p className="text-gray-600">
          Trasforma le tue descrizioni tecniche in testo professionale e
          dettagliato
        </p>

        {stats && (
          <div className="mt-2 text-sm text-gray-500">
            <p>
              Database: {stats.totalCorrections} correzioni salvate |{" "}
              {stats.totalRequests} richieste totali
            </p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Colonna descrizione grezza */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-gray-800">
              Descrizione Grezza
            </h2>
            <span
              className={`text-sm ${
                charCount < 40 ? "text-red-500" : "text-green-600"
              }`}
            >
              {charCount}/40 caratteri
            </span>
          </div>
          <textarea
            className={`w-full h-48 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 
              ${
                charCount < 40 && charCount > 0
                  ? "border-yellow-500"
                  : charCount >= 40
                  ? "border-green-500"
                  : "border-gray-300"
              }`}
            placeholder="Incolla qui la descrizione grezza"
            value={rawDescription}
            onChange={(e) => setRawDescription(e.target.value)}
            disabled={isLoading}
          ></textarea>

          <button
            onClick={handleRiformula}
            disabled={isLoading || charCount < 40}
            className={`mt-4 w-full py-2 px-4 rounded-md font-medium transition duration-200 
              ${
                isLoading || charCount < 40
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Elaborazione...
              </span>
            ) : (
              "Migliora con AI"
            )}
          </button>
        </div>

        {/* Colonna descrizione migliorata */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-gray-800">
              Descrizione Migliorata
            </h2>

            {isFromDatabase && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Da database
              </span>
            )}
          </div>

          {isCorrectionMode ? (
            <textarea
              className="w-full h-48 p-3 border border-blue-400 rounded-md overflow-auto bg-white"
              value={enhancedDescription}
              onChange={(e) => setEnhancedDescription(e.target.value)}
              placeholder="Modifica la descrizione migliorata qui..."
            />
          ) : (
            <div
              className={`w-full h-48 p-3 border border-gray-300 rounded-md overflow-auto ${
                enhancedDescription
                  ? "bg-white text-gray-800"
                  : "bg-gray-50 text-gray-400 italic"
              }`}
            >
              {enhancedDescription || "La descrizione migliorata apparirà qui"}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {enhancedDescription && !isCorrectionMode && (
              <>
                <button
                  onClick={handleCopy}
                  id="copyButton"
                  className="flex-1 py-2 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition duration-200"
                >
                  Copia testo
                </button>

                <button
                  onClick={enableCorrectionMode}
                  className="flex-1 py-2 px-4 bg-yellow-500 text-white rounded-md font-medium hover:bg-yellow-600 transition duration-200"
                >
                  Correggi
                </button>
              </>
            )}

            {isCorrectionMode && (
              <>
                <button
                  onClick={handleSaveCorrection}
                  disabled={
                    isSaving || enhancedDescription === originalAIOutput
                  }
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition duration-200 ${
                    isSaving || enhancedDescription === originalAIOutput
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {isSaving ? "Salvando..." : "Salva correzione"}
                </button>

                <button
                  onClick={resetCorrection}
                  className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-md font-medium hover:bg-gray-600 transition duration-200"
                >
                  Annulla
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messaggio di successo */}
      {saveSuccess && (
        <div className="mt-6 p-3 bg-green-100 text-green-700 border-l-4 border-green-500 rounded">
          {isFromDatabase
            ? "Questa descrizione è stata recuperata dal database delle correzioni grazie alla sua somiglianza con descrizioni precedenti."
            : "Correzione salvata con successo! Questa versione sarà utilizzata automaticamente per descrizioni simili in futuro."}
        </div>
      )}

      {/* Messaggio di errore */}
      {error && (
        <div className="mt-6 p-3 bg-red-100 text-red-700 border-l-4 border-red-500 rounded">
          <p className="font-semibold">{error}</p>
          {debugInfo && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-medium">
                Dettagli tecnici (per debug)
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 overflow-auto rounded text-xs">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Link per testare la connessione */}
      <div className="mt-6 text-center">
        <a
          href={`${API_BASE_URL}/api/test-openrouter`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Testa connessione API OpenRouter
        </a>
      </div>
    </div>
  );
}

export default App;
