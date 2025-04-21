let isProcessing = false;
const FIXED_MODEL = "deepseek/deepseek-r1:free"; // Definisco una costante per il modello fisso
let currentDescription = ""; // Per memorizzare la descrizione originale
let currentEnhancedOutput = ""; // Per memorizzare l'output migliorato

document.addEventListener("DOMContentLoaded", function () {
  const descriptionField = document.getElementById("description");
  const enhanceBtn = document.getElementById("enhanceBtn");
  const copyBtn = document.getElementById("copyBtn");
  const resetBtn = document.getElementById("resetBtn");
  const charCount = document.getElementById("charCount");
  const loadingIndicator = document.getElementById("loading");
  const errorMessage = document.getElementById("errorMessage");

  // Elementi per il feedback
  const feedbackContainer = document.getElementById("feedbackContainer");
  const thumbsUpBtn = document.getElementById("thumbsUpBtn");
  const thumbsDownBtn = document.getElementById("thumbsDownBtn");
  const feedbackMessage = document.getElementById("feedbackMessage");

  // Debug - controllo se gli elementi sono stati trovati correttamente
  console.log("Elementi feedback:", {
    feedbackContainer: !!feedbackContainer,
    thumbsUpBtn: !!thumbsUpBtn,
    thumbsDownBtn: !!thumbsDownBtn,
  });

  // Aggiornamento contatore caratteri e abilita/disabilita pulsante
  descriptionField.addEventListener("input", function () {
    const length = this.value.length;
    charCount.textContent = length;

    if (length >= 40) {
      enhanceBtn.disabled = false;
      this.style.borderColor = "#4CAF50";
    } else {
      enhanceBtn.disabled = true;
      this.style.borderColor = length > 0 ? "#ff9800" : "#ddd";
    }

    // Abilita/disabilita pulsante copia
    copyBtn.disabled = length === 0;

    // Nasconde il feedback se l'utente modifica il testo
    if (feedbackContainer) {
      feedbackContainer.style.display = "none";
    }

    errorMessage.textContent = "";
  });

  // Miglioramento con AI
  enhanceBtn.addEventListener("click", enhanceWithAI);

  // Gestione dei pulsanti di feedback
  if (thumbsUpBtn) {
    thumbsUpBtn.addEventListener("click", function () {
      // Rimuove selezione dal pulsante pollice giù se era selezionato
      thumbsDownBtn.classList.remove("selected");

      // Gestisce la selezione/deselezione del pollice su
      if (thumbsUpBtn.classList.contains("selected")) {
        thumbsUpBtn.classList.remove("selected");
        feedbackMessage.textContent = "";
      } else {
        thumbsUpBtn.classList.add("selected");
        feedbackMessage.textContent = "Grazie per il feedback positivo!";

        // Salva la risposta positiva
        if (currentDescription && currentEnhancedOutput) {
          saveFeedback(currentDescription, currentEnhancedOutput, true);
        }
      }
    });
  }

  if (thumbsDownBtn) {
    thumbsDownBtn.addEventListener("click", function () {
      // Rimuove selezione dal pulsante pollice su se era selezionato
      thumbsUpBtn.classList.remove("selected");

      // Gestisce la selezione/deselezione del pollice giù
      if (thumbsDownBtn.classList.contains("selected")) {
        thumbsDownBtn.classList.remove("selected");
        feedbackMessage.textContent = "";
      } else {
        thumbsDownBtn.classList.add("selected");
        feedbackMessage.textContent =
          "Mi dispiace. Sto generando una risposta migliore...";

        // Salva il feedback negativo e rigenera
        if (currentDescription) {
          saveFeedback(currentDescription, currentEnhancedOutput, false);

          // Attesa breve prima di rigenerare
          setTimeout(() => {
            // Rigenera con apprendimento dal feedback negativo
            enhanceWithAI(true);
          }, 1000);
        }
      }
    });
  }

  // Funzione copia negli appunti
  copyBtn.addEventListener("click", function () {
    if (descriptionField.value.length === 0) return;

    descriptionField.select();
    document.execCommand("copy");

    // Feedback visivo
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copiato!';

    setTimeout(() => {
      copyBtn.innerHTML = originalText;
    }, 2000);
  });

  // Funzione reset campo
  resetBtn.addEventListener("click", function () {
    descriptionField.value = "";
    charCount.textContent = "0";
    enhanceBtn.disabled = true;
    copyBtn.disabled = true;
    errorMessage.textContent = "";
    descriptionField.style.borderColor = "#ddd";

    // Reset anche del feedback
    if (feedbackContainer) {
      feedbackContainer.style.display = "none";
    }
    if (thumbsUpBtn) {
      thumbsUpBtn.classList.remove("selected");
    }
    if (thumbsDownBtn) {
      thumbsDownBtn.classList.remove("selected");
    }
    if (feedbackMessage) {
      feedbackMessage.textContent = "";
    }
    currentDescription = "";
    currentEnhancedOutput = "";
  });

  async function enhanceWithAI(isRegeneration = false) {
    if (isProcessing || (!isRegeneration && descriptionField.value.length < 40))
      return;

    isProcessing = true;
    loadingIndicator.style.display = "flex";
    enhanceBtn.disabled = true;
    errorMessage.textContent = "";

    // Nascondiamo il container di feedback durante l'elaborazione
    if (feedbackContainer) {
      feedbackContainer.style.display = "none";
    }
    if (thumbsUpBtn) {
      thumbsUpBtn.classList.remove("selected");
    }
    if (thumbsDownBtn) {
      thumbsDownBtn.classList.remove("selected");
    }
    if (feedbackMessage) {
      feedbackMessage.textContent = "";
    }

    try {
      // Salva la descrizione originale per riferimento
      currentDescription = descriptionField.value;

      console.log("Inviando richiesta al server:", currentDescription);

      const response = await fetch("http://localhost:3000/api/riformula", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: currentDescription,
          model: FIXED_MODEL,
          isRegeneration: isRegeneration, // Passiamo al backend se è una rigenerazione
          previousOutput: isRegeneration ? currentEnhancedOutput : null, // Passiamo l'output precedente negativo
        }),
      });

      const data = await response.json();
      console.log("Risposta dal server:", data);

      if (data.error) {
        throw new Error(data.error);
      }

      // Salva l'output migliorato per riferimento
      currentEnhancedOutput = data.output;

      // Aggiorna il campo con l'output
      descriptionField.value = currentEnhancedOutput;
      descriptionField.style.borderColor = "#4CAF50";
      copyBtn.disabled = false;

      // Mostra il container di feedback
      console.log("Visualizzazione feedback dopo risposta positiva");
      if (feedbackContainer) {
        feedbackContainer.style.display = "flex";
        // Forza il rendering
        setTimeout(() => {
          feedbackContainer.style.opacity = "0";
          setTimeout(() => {
            feedbackContainer.style.opacity = "1";
          }, 50);
        }, 0);
      }
    } catch (error) {
      console.error("Errore API:", error);
      errorMessage.textContent = `Errore: ${
        error.message || "Problema durante la comunicazione con il server"
      }`;
    } finally {
      isProcessing = false;
      loadingIndicator.style.display = "none";
      enhanceBtn.disabled = false;
    }
  }

  async function saveFeedback(originalText, enhancedText, isPositive) {
    try {
      await fetch("http://localhost:3000/api/save-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          original: originalText,
          enhanced: enhancedText,
          isPositive: isPositive,
        }),
      });

      console.log(`Feedback ${isPositive ? "positivo" : "negativo"} salvato`);
    } catch (error) {
      console.error("Errore nel salvataggio del feedback:", error);
    }
  }
});
