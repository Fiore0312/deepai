let isProcessing = false;

document.addEventListener('DOMContentLoaded', function() {
    const descriptionField = document.getElementById('description');
    const enhanceBtn = document.getElementById('enhanceBtn');
    const copyBtn = document.getElementById('copyBtn');
    const resetBtn = document.getElementById('resetBtn');
    const charCount = document.getElementById('charCount');
    const loadingIndicator = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');
    const modelSelector = document.getElementById('modelSelector');
    const loadingModels = document.getElementById('loadingModels');
    
    // Aggiornamento contatore caratteri e abilita/disabilita pulsante
    descriptionField.addEventListener('input', function() {
        const length = this.value.length;
        charCount.textContent = length;
        
        if (length >= 40) {
            enhanceBtn.disabled = false;
            this.style.borderColor = '#4CAF50';
        } else {
            enhanceBtn.disabled = true;
            this.style.borderColor = length > 0 ? '#ff9800' : '#ddd';
        }
        
        // Abilita/disabilita pulsante copia
        copyBtn.disabled = length === 0;
        
        errorMessage.textContent = '';
    });
    
    // Miglioramento con AI
    enhanceBtn.addEventListener('click', enhanceWithAI);
    
    // Funzione copia negli appunti
    copyBtn.addEventListener('click', function() {
        if (descriptionField.value.length === 0) return;
        
        descriptionField.select();
        document.execCommand('copy');
        
        // Feedback visivo
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copiato!';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    });
    
    // Funzione reset campo
    resetBtn.addEventListener('click', function() {
        descriptionField.value = '';
        charCount.textContent = '0';
        enhanceBtn.disabled = true;
        copyBtn.disabled = true;
        errorMessage.textContent = '';
        descriptionField.style.borderColor = '#ddd';
    });
    
    // Caricamento modelli disponibili
    async function loadModels() {
        try {
            loadingModels.style.display = 'flex';
            
            const response = await fetch('http://localhost:3000/api/models');
            const data = await response.json();
            
            // Pulisci le opzioni esistenti
            modelSelector.innerHTML = '';
            
            // Aggiungi le opzioni dai dati del server
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                // Seleziona per default il modello deepseek
                if (model.id === 'deepseek/deepseek-r1:free') {
                    option.selected = true;
                }
                modelSelector.appendChild(option);
            });
            
        } catch (error) {
            console.error('Errore caricamento modelli:', error);
            // Se c'è un errore, le opzioni predefinite rimangono
        } finally {
            loadingModels.style.display = 'none';
        }
    }
    
    // Carica i modelli all'avvio se il server è disponibile
    // Se il server non è disponibile, i modelli predefiniti nell'HTML rimarranno
    loadModels();
    
    async function enhanceWithAI() {
        if (isProcessing || descriptionField.value.length < 40) return;
        
        isProcessing = true;
        loadingIndicator.style.display = 'flex';
        enhanceBtn.disabled = true;
        errorMessage.textContent = '';
        
        try {
            const selectedModel = modelSelector.value;
            console.log(`Utilizzo del modello: ${selectedModel}`);
            
            const response = await fetch('http://localhost:3000/api/riformula', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: descriptionField.value,
                    model: selectedModel
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            descriptionField.value = data.output;
            descriptionField.style.borderColor = '#4CAF50';
            copyBtn.disabled = false;
            
        } catch (error) {
            console.error('Errore API:', error);
            errorMessage.textContent = `Errore: ${error.message || 'Problema durante la comunicazione con il server'}`;
        } finally {
            isProcessing = false;
            loadingIndicator.style.display = 'none';
            enhanceBtn.disabled = false;
        }
    }
});
