# Google Maps Reviews Scraper

**Applicazione integrata con Moca Hub** per estrarre e analizzare recensioni da Google Maps utilizzando Apify e OpenAI GPT-4.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Panoramica

Google Maps Reviews Scraper è un'applicazione web completa che permette di:

- 🔍 **Ricercare brand su Google Maps** con filtri geografici avanzati
- 🔗 **Inserire URL manuali** di schede Google Maps specifiche
- 📊 **Estrarre recensioni** complete con metadati
- 🤖 **Analizzare con AI** (OpenAI GPT-4) per insight strategici
- 📈 **Visualizzare statistiche** aggregate e per singola location
- 💾 **Esportare dati** in formato JSON, CSV, e PDF
- 📚 **Salvare ricerche** in uno storico locale (max 20)

---

## 🎯 Caratteristiche Principali

### Ricerca Flessibile
- **Modalità Brand**: Ricerca per nome (es. "McDonald's") con filtri:
  - Solo Italia / Location specifica / Tutto il mondo
  - Search mode: Balanced, Aggressive, Strict
  - Opzione per escludere schede chiuse
- **Modalità URL**: Incolla URL diretti di schede Google Maps

### Scraping Avanzato
- Estrazione completa di:
  - Testo recensione, rating, data
  - Autore e URL profilo
  - Numero likes
  - Risposta del proprietario
- Configurabile: numero massimo recensioni per scheda

### Analisi AI (OpenAI GPT-4)
- Punti di forza identificati
- Aree di miglioramento
- Top 3 priorità strategiche
- Raccomandazioni azionabili
- Wordcloud parole chiave (con filtro stopwords italiane)

### Visualizzazione Dati
- **Tab Panoramica**: Statistiche aggregate, distribuzione stelle, sentiment
- **Tab per Scheda**: Analisi specifiche per location
- Grafici interattivi e colori Moca brand

### Export Multi-formato
- **JSON**: Dataset completo strutturato
- **CSV**: Excel-compatible con tutti i campi
- **PDF**: Report brandizzato Moca Interactive

---

## 🔌 Prerequisiti

### Account Necessari
1. **Moca Hub**: Account con client configurato
2. **Apify**: API Key con accesso agli actor:
   - `nwua9Gu5YrADL7ZDj` (ricerca schede)
   - `compass/crawler-google-places` (scraping recensioni)
3. **OpenAI** (opzionale): API Key per analisi AI

### Configurazione API Keys in Moca Hub
1. Accedi a **Moca Hub**
2. Vai su **Configurations**
3. Seleziona il tuo client
4. Aggiungi le seguenti chiavi:
   - `APIFY_API_KEY` (obbligatoria)
   - `OPENAI_API_KEY` (opzionale, per analisi AI)

---

## 🚀 Utilizzo

### 1. Avvia da Moca Hub
- Accedi a Moca Hub
- Seleziona il client
- Clicca su "Google Maps Reviews Scraper"
- L'app si aprirà con il contesto cliente già caricato

### 2. Configura la Ricerca

#### Modalità Brand
1. Seleziona **🔍 Brand Search**
2. Inserisci il nome brand (es. "Starbucks")
3. Scegli location: Italia / Custom / Mondo
4. Imposta max schede da trovare (default: 20)
5. Imposta max recensioni per scheda (default: 100)
6. Scegli search mode (balanced consigliato)
7. (Opzionale) Abilita "Skip Schede Chiuse"

#### Modalità URL
1. Seleziona **🔗 URL Manuale**
2. Incolla URL Google Maps (uno per riga)
   - Supporta: `?query_place_id=ChIJ...`, `/place/Nome/...`, `ChIJxxx` diretto
3. Imposta max recensioni per scheda

### 3. Abilita Analisi AI (Opzionale)
- Spunta **🤖 Abilita Analisi AI**
- Seleziona il modello OpenAI (GPT-4 Turbo consigliato)
- ⚠️ Attenzione: l'analisi AI ha un costo per chiamata OpenAI

### 4. Avvia
- Clicca **🔍 Cerca Schede**
- Attendi il caricamento delle schede
- Seleziona le schede da analizzare
- Clicca **🚀 Avvia Scraping**
- Attendi il completamento (da 2 a 10 minuti)

### 5. Visualizza Risultati
- **Tab Panoramica**: Visione aggregata di tutte le schede
- **Tab Individuali**: Analisi dettagliata per location
- Wordcloud, priorità, raccomandazioni (se AI abilitata)

### 6. Esporta Dati
- **💾 Export JSON**: Per analisi programmatiche
- **📄 Export CSV**: Per Excel/Google Sheets
- **📄 Export PDF**: Report brandizzato completo

---

## 📊 Formati Export

### JSON
Struttura completa con:
```json
{
  "places": [...],
  "aggregateStats": {
    "totalPlaces": 15,
    "totalReviews": 1350,
    "avgRating": 4.1,
    "distribution": {...},
    "sentiment": {...},
    "topKeywords": [...]
  }
}
```

### CSV
Campi inclusi:
- Place Name, Address, Total Rating, Reviews Count, URL
- Review ID, Author Name, Author URL
- Review Text, Stars, Published Date
- Response Text, Likes Count

### PDF
Report professionale con:
- Header cliente e data
- Statistiche aggregate
- Grafici distribuzione
- Analisi AI completa (se abilitata)

---

## 📚 Storico Ricerche

- Salvataggio automatico delle ricerche completate
- Max 20 ricerche salvate (FIFO)
- Prevenzione duplicati (stesso brand entro 1 minuto)
- Pulsante **📚 Storico** in header
- Azioni: Carica risultati, Elimina singola, Elimina tutto

---

## 🛠️ Stack Tecnologico

### Frontend
- **HTML5 + CSS3 + Vanilla JavaScript** (no framework)
- **Font**: Figtree (Google Fonts)
- **Librerie**:
  - jsPDF v2.5.1 (generazione PDF)
  - html2canvas v1.4.1 (rendering grafici)

### Backend
- **Netlify Serverless Functions** (Node.js 18)
- **Dependencies**:
  - `apify-client@^2.9.3`
  - `node-fetch@^2.7.0`
  - `openai@^4.28.0`

### Design System
- **Moca Interactive Brand**:
  - Primary: `#E52217` (Moca Red)
  - Light: `#FFE7E6`
  - Black: `#191919`
  - Gray: `#8A8A8A`

---

## 🔧 Sviluppo Locale

### Setup
```bash
# Clone repository
git clone <repo-url>
cd maps-hub

# Install dependencies
npm install

# Run locally with Netlify Dev
npx netlify dev
```

### Environment Variables
Non necessarie! Le API keys vengono recuperate da Moca Hub tramite SDK.

---

## 🚀 Deploy

### Netlify
1. **Push su GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Crea sito Netlify**:
   - Vai su [Netlify Dashboard](https://app.netlify.com)
   - "New site from Git"
   - Connetti repository
   - Build settings: (lascia vuoto per static site)
   - Deploy

3. **Registra in Moca Hub**:
   - Vai su Moca Hub → Applications → Add
   - Name: "Google Maps Reviews Scraper"
   - URL: `https://your-app.netlify.app`
   - Status: Active
   - Configura access permissions

---

## ⚠️ Limitazioni & Note

### Performance
- **Timeout Netlify**: 26 secondi per function
- **Polling**: Ricerca max 10 min, scraping max 5 min
- **LocalStorage**: Max 5-10 MB (sufficiente per 20 ricerche)

### Costi
- **Apify**: Pay-per-run (varia per actor e volumi)
- **OpenAI**: ~$0.01-0.05 per place analizzato (GPT-4 Turbo)
- Consiglio: testa con poche schede prima di lanciare grandi volumi

### Browser Compatibility
- Chrome/Edge/Firefox moderni (ES6+, LocalStorage required)
- Safari 14+

---

## 📖 API Esterne Utilizzate

### Apify
- **Actor Search**: `nwua9Gu5YrADL7ZDj`
- **Actor Scraper**: `compass/crawler-google-places`
- [Documentazione Apify](https://docs.apify.com)

### OpenAI
- **Modelli supportati**: GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
- **Endpoint**: `chat.completions.create`
- [Documentazione OpenAI](https://platform.openai.com/docs)

---

## 🆘 Troubleshooting

### "Access Denied" quando apri l'app
- ✅ Assicurati di aprire l'app da Moca Hub
- ✅ Verifica che l'app sia registrata in Moca Hub
- ✅ Controlla che Moca Hub URL sia corretto

### "API Key non configurata"
- ✅ Vai su Moca Hub → Configurations
- ✅ Seleziona il client corretto
- ✅ Aggiungi `APIFY_API_KEY` e `OPENAI_API_KEY`
- ✅ Usa il nome chiave esatto (case-sensitive)

### Nessuna scheda trovata
- ✅ Prova search mode "Aggressive"
- ✅ Verifica che il brand esista su Google Maps
- ✅ Prova senza filtri location (seleziona "Mondo")

### Scraping timeout
- ✅ Riduci "Max Recensioni per Scheda"
- ✅ Seleziona meno schede alla volta
- ✅ Controlla crediti Apify disponibili

### AI non disponibile
- ✅ Verifica che `OPENAI_API_KEY` sia configurata
- ✅ Controlla saldo account OpenAI
- ✅ Prova modello GPT-3.5 Turbo (più economico)

---

## 📄 Licenza

MIT License - Libero per uso commerciale e personale

---

## 👥 Support

Per supporto tecnico:
- **Moca Hub Admin**: Contatta il tuo amministratore
- **Issues**: [GitHub Issues](link-to-repo/issues)
- **Email**: support@mocainteractive.com

---

**Developed with ❤️ by Moca Interactive**
