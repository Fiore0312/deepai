import { useState, useEffect } from "react";
import TemplateSelector from './components/TemplateSelector';
import HistoryPanel from './components/HistoryPanel';

// URL base dell'API: usa un URL di produzione quando è in produzione, altrimenti usa localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
  const [likes, setLikes] = useState(0);
  const [validation, setValidation] = useState({ 
    isValid: true, 
    activityType: '', 
    suggestions: [] 
  });

  // Nuovi stati per Task 4 - Miglioramenti UX/UI
  const [history, setHistory] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('installazione');
  const [livePreview, setLivePreview] = useState('');

  // Aggiorna il conteggio caratteri e la validazione quando cambia la descrizione
  useEffect(() => {
    setCharCount(rawDescription.length);
    
    // Effettua la validazione in tempo reale solo se l'input è abbastanza lungo
    if (rawDescription.length > 3) {
      const validate = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/validate-input`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ input: rawDescription }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setValidation(data);
          }
        } catch (error) {
          console.error("Errore nella validazione:", error);
        }
      };
      
      // Debounce per evitare troppe richieste
      const timeoutId = setTimeout(validate, 500);
      return () => clearTimeout(timeoutId);
    } else {
      // Reset della validazione per input troppo corti
      setValidation({ isValid: true, activityType: '', suggestions: [] });
    }
  }, [rawDescription]);

  // Carica le statistiche all'avvio
  useEffect(() => {
    fetchStats();
  }, []);

  // Aggiorna l'anteprima in tempo reale
  useEffect(() => {
    if (rawDescription.length > 5) {
      // Simulazione anteprima basata sul template selezionato
      const preview = `Anteprima per ${selectedTemplate}: ${rawDescription.substring(0, 50)}...`;
      setLivePreview(preview);
    } else {
      setLivePreview('');
    }
  }, [rawDescription, selectedTemplate]);

  // Funzione per recuperare le statistiche
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/correction-stats`, {
        headers: {
          "HTTP-Referer": window.location.origin,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

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
      const response = await fetch(`${API_BASE_URL}/api/riformula`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Requested-With": "XMLHttpRequest",
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          input: rawDescription,
          model: "deepseek/deepseek-r1:free",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Risposta di errore dal server:", errorText);

        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
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
        setOriginalAIOutput(data.output);
        setIsFromDatabase(data.fromDatabase || false);
        setLikes(data.likes || 0);

        // Aggiungi alla cronologia
        setHistory(prev => [
          { input: rawDescription, output: data.output },
          ...prev.slice(0, 9)
        ]);

        if (data.fromDatabase) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 5000);
        }
      } else {
        setError('Risposta API non valida: manca il campo "output"');
        setDebugInfo({ responseData: data });
      }
    } catch (err) {
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
          "HTTP-Referer": window.location.origin,
          "X-Requested-With": "XMLHttpRequest",
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          originalDescription: rawDescription,
          aiGenerated: originalAIOutput,
          userCorrected: enhancedDescription,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
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

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
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
        fetchStats();
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        setError(data.error || "Errore nel salvataggio della correzione");
      }
    } catch (err) {
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
        setError(
          "Impossibile copiare il testo. Prova a selezionarlo manualmente."
        );
      });
  };

  const handleLike = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: rawDescription,
          output: enhancedDescription,
        }),
      });

      setLikes((prev) => prev + 1);
    } catch (err) {
      console.error("Errore nel salvare il feedback:", err);
    }
  };

  return (
    <div className="container max-w-4xl px-4 py-8 mx-auto">
      <header className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-blue-700">
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

      {/* Template selector - Task 4 */}
      <div className="mb-6">
        <TemplateSelector 
          selectedTemplate={selectedTemplate} 
          onTemplateChange={setSelectedTemplate} 
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Colonna descrizione grezza */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-gray-800">
                Descrizione Grezza
              </h2>
              {validation.activityType && (
                <span className="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded">
                  Tipo: {validation.activityType}
                </span>
              )}
            </div>
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
                  className="w-4 h-4 mr-2 -ml-1 text-white animate-spin"
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
          
          {validation.suggestions.length > 0 && (
            <div className="p-3 mt-4 text-sm border-l-4 border-yellow-400 bg-yellow-50">
              <p className="font-medium text-yellow-800">Suggerimenti:</p>
              <ul className="pl-5 mt-1 list-disc">
                {validation.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-yellow-700">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Colonna descrizione migliorata */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-3">
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
              className="w-full h-48 p-3 overflow-auto bg-white border border-blue-400 rounded-md"
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
                  className="flex-1 px-4 py-2 font-medium text-white transition duration-200 bg-green-600 rounded-md hover:bg-green-700"
                >
                  Copia testo
                </button>

                <button
                  onClick={enableCorrectionMode}
                  className="flex-1 px-4 py-2 font-medium text-white transition duration-200 bg-yellow-500 rounded-md hover:bg-yellow-600"
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
                  className="flex-1 px-4 py-2 font-medium text-white transition duration-200 bg-gray-500 rounded-md hover:bg-gray-600"
                >
                  Annulla
                </button>
              </>
            )}
          </div>

          {enhancedDescription && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleLike}
                className="flex items-center gap-1 text-gray-600 hover:text-blue-500"
              >
                <span role="img" aria-label="like">
                  👍
                </span>
                <span>{likes > 0 ? likes : ""}</span>
              </button>

              {isFromDatabase && (
                <span className="text-sm text-gray-500">
                  (Risposta preferita dagli utenti)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nuova colonna: Anteprima in tempo reale - Task 4 */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-3 text-xl font-semibold text-gray-800">
            Anteprima in tempo reale
          </h2>
          <div className="w-full h-48 p-3 overflow-auto border border-gray-300 rounded-md bg-gray-50">
            {livePreview || "L'anteprima apparirà qui mentre digiti..."}
          </div>
        </div>
      </div>

      {/* History panel - Task 4 */}
      <div className="mt-6">
        <HistoryPanel 
          history={history} 
          onSelectHistoryItem={(item) => {
            setRawDescription(item.input);
            setEnhancedDescription(item.output);
          }} 
        />
      </div>

      {/* Messaggio di successo */}
      {saveSuccess && (
        <div className="p-3 mt-6 text-green-700 bg-green-100 border-l-4 border-green-500 rounded">
          {isFromDatabase
            ? "Questa descrizione è stata recuperata dal database delle correzioni grazie alla sua somiglianza con descrizioni precedenti."
            : "Correzione salvata con successo! Questa versione sarà utilizzata automaticamente per descrizioni simili in futuro."}
        </div>
      )}

      {/* Messaggio di errore */}
      {error && (
        <div className="p-3 mt-6 text-red-700 bg-red-100 border-l-4 border-red-500 rounded">
          <p className="font-semibold">{error}</p>
          {debugInfo && (
            <details className="mt-2 text-sm">
              <summary className="font-medium cursor-pointer">
                Dettagli tecnici (per debug)
              </summary>
              <pre className="p-2 mt-2 overflow-auto text-xs bg-gray-100 rounded">
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
