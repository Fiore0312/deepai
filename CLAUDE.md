# PROGETTO DEEPAI - DOCUMENTAZIONE COMPLETA

## 📍 **INFORMAZIONI PROGETTO**
- **Repository**: https://github.com/Fiore0312/deepai
- **Directory Lavoro**: /home/franco/deepai (WSL)

## 🌐 **DEPLOY URLs**
- **Backend (Render)**: https://deepai-weem.onrender.com
- **Frontend (GitHub Pages)**: https://fiore0312.github.io/deepai/
- **Frontend (Vercel)**: https://deepai-gamma.vercel.app

## 🏗️ **ARCHITETTURA PROGETTO**
```
deepai/
├── Deep-AI/                    # 🖥️ Backend (Node.js + Express)
│   ├── riformulaDescrizione.js # File principale backend
│   ├── input-validator.js     # Validazione input (sempre valid=true)
│   ├── package.json
│   └── .env                   # Chiavi API (NON TOCCARE)
├── frontend-riformula/         # 🌐 Frontend (React + Vite)
│   ├── src/App.jsx            # Interfaccia semplificata
│   ├── package.json           # Con lucide-react dependency
│   └── dist/                  # Build files
└── index.html                 # Entry point per GitHub Pages
```

## ✅ **ULTIME MODIFICHE COMPLETATE (Luglio 2025)**

### **Backend Fixes**:
- **Limite caratteri**: 400 → 500 caratteri ✅
- **Validazione semplificata**: Rimossa validazione semantica restrittiva ✅
- **input-validator.js**: Sempre restituisce `isValid: true` ✅
- **API Response**: Restituisce `{"output": "..."}` ✅

### **Frontend Fixes**:
- **Interfaccia pulita**: Rimossi batch, cronologia, template selector ✅
- **Design moderno**: Tailwind CSS + Lucide React icons ✅
- **Response parsing**: Legge correttamente `data.output` dall'API ✅
- **Esempi integrati**: Guide per l'utente ✅
- **Feedback system**: Rating 👍/👎 ✅

## 🧪 **TEST FUNZIONAMENTO**

### **Test Backend**:
```bash
curl -X POST https://deepai-weem.onrender.com/api/riformula \
  -H "Content-Type: application/json" \
  -d '{"input":"installazione software"}'
```
**Risposta attesa**: `{"output":"Eseguita l'installazione del software. Verifica del corretto funzionamento completata."}`

### **Test Frontend**:
1. Vai su: https://fiore0312.github.io/deepai/
2. Input: "installazione software"
3. Risultato: Dovrebbe mostrare output migliorato

## 🚨 **PROBLEMI RISOLTI**

### **Problema 1**: "Input non valido semanticamente"
- **Causa**: Validazione semantica troppo restrittiva
- **Fix**: `input-validator.js` sempre restituisce `isValid: true`

### **Problema 2**: Deploy Vercel fallito
- **Causa**: Branch gh-pages non aveva `frontend-riformula/` directory
- **Fix**: Deploy su GitHub Pages + aggiornamento index.html

### **Problema 3**: Frontend non mostra output
- **Causa**: Frontend leggeva `data.reformulatedDescription` ma API restituisce `data.output`
- **Fix**: Aggiornato parsing: `data.output || data.reformulatedDescription || data.result`

## 🔄 **WORKFLOW DEPLOY**

### **Per modifiche Frontend**:
```bash
cd frontend-riformula
npm run build
# Aggiorna index.html nella root con nuovi asset hash
git add . && git commit -m "fix: ..."
git push origin main
```

### **Per modifiche Backend**:
```bash
# Modifiche auto-deployate su Render da branch main
git add . && git commit -m "fix: ..."
git push origin main
```

## 📋 **CONFIGURAZIONI IMPORTANTI**

### **File .env (Deep-AI/.env)**:
- Contiene chiavi API OpenRouter
- **NON MODIFICARE SENZA NECESSITÀ**

### **CORS Settings**:
- Frontend autorizzato: `fiore0312.github.io`
- Backend auto-accetta richieste da domini Vercel

### **Build Assets**:
- CSS: `frontend-riformula/dist/assets/index-[hash].css`
- JS: `frontend-riformula/dist/assets/index-[hash].js`
- **IMPORTANTE**: Aggiornare hash in index.html dopo ogni build

## 🎯 **STATO ATTUALE**
- ✅ Backend: Funzionante, validazione semplificata
- ✅ Frontend: Interfaccia pulita e funzionante  
- ✅ Deploy: Attivo su GitHub Pages
- ✅ Test: "installazione software" funziona correttamente

## 💡 **PER CLAUDE FUTURO**
Questo progetto è completamente funzionante. Se ci sono problemi:
1. Controlla che l'API risponda con `{"output": "..."}`
2. Verifica che il frontend legga `data.output`
3. Assicurati che index.html punti ai file build corretti
4. Il backend su Render si auto-deploya dal branch main
5. Il frontend è deployato su GitHub Pages

**IMPORTANTE**: Non modificare .env o le chiavi API senza necessità assoluta.