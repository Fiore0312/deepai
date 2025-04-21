# Applicazione per il Miglioramento delle Descrizioni Tecniche

Questa applicazione web permette di migliorare automaticamente descrizioni tecniche grezze, trasformandole in testo professionale utilizzando l'API di OpenRouter con il modello DeepSeek R1.

## Funzionalità

- Miglioramento automatico di descrizioni tecniche utilizzando AI
- Database di correzioni per riutilizzare descrizioni simili
- Possibilità di correggere manualmente le descrizioni generate
- Interfaccia utente reattiva e moderna

## Struttura del Progetto

- **frontend-riformula**: Frontend React con Vite e Tailwind CSS
- **Deep-AI**: Backend Node.js con Express che gestisce le chiamate all'API OpenRouter

## Setup Locale

### Backend (Deep-AI)

1. Entra nella cartella Deep-AI:

   ```
   cd Deep-AI
   ```

2. Installa le dipendenze:

   ```
   npm install
   ```

3. Crea un file `.env` basato su `.env.example` e inserisci la tua chiave API di OpenRouter:

   ```
   OPENROUTER_API_KEY=your_api_key_here
   ```

4. Avvia il server:
   ```
   npm start
   ```

### Frontend (frontend-riformula)

1. Entra nella cartella frontend-riformula:

   ```
   cd frontend-riformula
   ```

2. Installa le dipendenze:

   ```
   npm install
   ```

3. Avvia il server di sviluppo:
   ```
   npm run dev
   ```

## Deployment

L'applicazione è configurata per essere pubblicata su GitHub Pages con un backend ospitato su un servizio come Render o Railway.

### Backend

Il backend è pubblicato su Render.com:

- URL: https://riformulatore-api.onrender.com

### Frontend

Il frontend è pubblicato su GitHub Pages:

- Automaticamente tramite GitHub Actions quando viene effettuato un push sul branch `main`
- La configurazione del workflow si trova in `.github/workflows/deploy.yml`

## Note per lo Sviluppo

- Per utilizzare l'applicazione in ambiente di sviluppo, assicurati che sia il backend che il frontend siano avviati
- Per modificare l'URL del backend in produzione, aggiorna la variabile `API_BASE_URL` nel file `frontend-riformula/src/App.jsx`

## Sviluppato da

BAIT Service - 2025
