# 🧠 Web App Compilazione Rapportini – DeepAI

Un'app React + Express per migliorare automaticamente descrizioni tecniche e generare rapportini professionali.
Utilizza OpenRouter con modello AI gratuito ottimizzato per l'italiano.

> ✅ Frontend con Vite + Tailwind  
> ✅ Backend Node.js + Express su Render  
> ✅ Deploy automatico su Vercel

---

![Deploy Vercel](https://img.shields.io/badge/Deploy-Vercel-000?style=for-the-badge&logo=vercel&logoColor=white)
[![Live Site](https://img.shields.io/badge/🟢%20Vedi%20Online-deepai--gamma.vercel.app-success?style=for-the-badge)](https://deepai-gamma.vercel.app)

---

## 🚀 URL pubblici

- **App online** 👉 [https://deepai-gamma.vercel.app](https://deepai-gamma.vercel.app)
- **API backend** 👉 [https://deepai-weem.onrender.com/api/riformula](https://deepai-weem.onrender.com/api/riformula)

---

## 🧠 Come funziona la riformulazione

- Il backend usa il modello **deepseek/deepseek-chat-v3-0324:free** tramite OpenRouter.
- Il prompt è ottimizzato per:
  - Risposte in italiano formale, tecnico e senza errori di battitura.
  - Forma impersonale/passiva (mai la prima persona).
  - Nomi propri solo se presenti nell'input.
  - Nessuna aggiunta di dettagli tecnici, marche, software o ambienti non forniti.
  - Massimo 2 frasi, concise e professionali, senza elenchi o titoli.
- Ideale per rapportini IT, ticket, note di intervento.

---

## 🧩 Struttura del progetto

```
📦 deepai
├── Deep-AI/              # Backend Express
│   └── .env              # Chiave OpenRouter privata
├── frontend-riformula/   # Frontend React + Vite
│   └── .env.production   # VITE_API_URL verso backend
```

---

## ▶️ Avvio in locale

### 1️⃣ Avvia il backend

```bash
cd Deep-AI
npm install
npm start
```

📍Server su `http://localhost:3000`

---

### 2️⃣ Avvia il frontend

```bash
cd frontend-riformula
npm install
npm run dev
```

🌐 Aperto su `http://localhost:5173`

---

## 🛠️ Modifiche e deploy

### 🔧 Modifiche al **backend** (`Deep-AI`)

```bash
git add .
git commit -m "fix: logica riformulazione professionale"
git push origin main
```

- Render ricompila e riavvia il server automaticamente ✅

---

### 🎨 Modifiche al **frontend** (`frontend-riformula`)

```bash
npm run build
git add .
git commit -m "update: UI migliorata"
git push origin main
```

- Vercel redeploya automaticamente ✅

---

## 🔐 Protezione chiavi API

- Non inserire mai chiavi in file frontend
- `.env` nel backend è ignorato da Git
- Vercel gestisce `VITE_API_URL` come variabile privata

---

## 🧪 Test API manuale

### `POST /api/riformula`

URL:

```
https://deepai-weem.onrender.com/api/riformula
```

Body:

```json
{
  "input": "installazione computer Mario Rossi, test e collaudo ok"
}
```

Risposta:

```json
{
  "output": "È stato installato il computer di Mario Rossi, eseguiti test e collaudo con esito positivo."
}
```

---

## ✍️ Autore

🧑‍💻 Fiore0312  
📦 Progetto assistito da [GitHub Copilot]

---

## 📌 TODO (opzionale)

- [ ] Aggiungere screenshot UI
- [ ] Configurare dominio personalizzato su Vercel
- [ ] Attivare badge "deploy success" dinamico
