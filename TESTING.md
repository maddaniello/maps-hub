# Guida al Testing Locale - Maps Hub

Questa guida spiega come eseguire l'applicazione in locale per testare le modifiche senza fare deploy e risparmiare build minutes di Netlify.

## Prerequisiti

Assicurati di avere installato:
- **Node.js** (v18 o superiore)

> **Nota**: L'applicazione è stata aggiornata per rilevare automaticamente l'ambiente locale (`localhost`) e bypassare il blocco di sicurezza di Moca Hub.

> **⚠️ IMPORTANTE**: Per far funzionare lo scraper e l'AI in locale, devi aprire il file `app.js` (riga ~38) e inserire le tue chiavi API in `configurations`:
> ```javascript
> configurations: {
>   'OPENAI_API_KEY': 'la-tua-chiave-openai',
>   'APIFY_API_KEY': 'la-tua-chiave-apify'
> }
> ```


## Avvio in Locale

1.  **Apri il terminale** nella cartella del progetto:
    ```bash
    cd /Users/danielepisciottano/Desktop/maps-hub
    ```

2.  **Installa le dipendenze**:
    Questo installerà anche `netlify-cli` necessario per l'ambiente locale.
    ```bash
    npm install
    ```

3.  **Avvia l'App**:
    Usa il comando configurato nel `package.json`:
    ```bash
    npm run dev
    ```

4.  **Accedi all'App**:
    Il terminale mostrerà un URL locale, solitamente:
    `http://localhost:8888`

## Cosa Testare

### 1. Interfaccia & Branding
- Verifica che i colori siano **Rosso (#E52217)**, Nero e Grigio.
- Assicurati che non ci siano sfumature viola o blu.

### 2. Flusso di Analisi
1.  Fai una ricerca (es. "Bar" a "Roma").
2.  Seleziona 2-3 schede.
3.  Clicca **"Avvia Scraping"**.
4.  Osserva la **Barra di Progresso**:
    - Dovrebbe mostrare messaggi specifici ("Analisi in corso: Bar X...").
    - Non dovrebbe "saltare" o mostrare risultati parziali.
5.  Attendi il completamento ("✅ Analisi AI Completata!").
6.  Verifica che i risultati appaiano **solo alla fine**.

### 3. Dettagli Scheda
- Clicca sul tab di una scheda specifica.
- Verifica la presenza di:
    - **Indirizzo / Città** in alto.
    - **Link "Apri su Google Maps"**.
    - Sezione **"Analisi AI"** (se abilitata).
    - **Esempi Recensioni** (Positivi e Negativi) con le stelline.

### 4. Sampling Toggle
- Prova con la spunta "Campionamento" attiva e disattiva per vedere la differenza nei tempi e nella profondità dell'analisi.
