# Miglioramento Descrizioni Tecniche

Applicazione per migliorare automaticamente le descrizioni tecniche nei rapportini di lavoro utilizzando l'intelligenza artificiale.

## Funzionalità

- Trasforma descrizioni tecniche grezze in testo professionale e dettagliato
- Interfaccia utente semplice e intuitiva
- Memorizzazione delle correzioni manuali per miglioramento continuo
- Riconoscimento automatico di descrizioni simili già elaborate

## Struttura del progetto

- `Deep-AI/`: Backend Node.js che gestisce la comunicazione con l'API di OpenRouter
- `frontend-riformula/`: Applicazione React con interfaccia utente moderna

## Requisiti

- Node.js 16+
- API key di OpenRouter (da configurare nel file `.env`)

## Installazione

### Backend

```bash
cd Deep-AI
npm install
# Crea un file .env con la tua API key OpenRouter
echo "OPENROUTER_API_KEY=your_api_key_here" > .env
node riformulaDescrizione.js
```

### Frontend

```bash
cd frontend-riformula
npm install
npm run dev
```

## Utilizzo

1. Incolla una descrizione tecnica grezza nel campo di input
2. Clicca su "Migliora con AI"
3. Il testo migliorato apparirà nel campo di output
4. Puoi copiare il testo o apportare correzioni manuali

## Sviluppato da

BAIT Service - 2025