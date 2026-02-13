# Maps Hub - Documentazione Tecnica e Funzionale

## Come Funziona l'App

Maps Hub è un'applicazione web progettata per **trovare**, **analizzare** e **monitorare** la reputazione online di brand e luoghi su Google Maps. Utilizza tecnologie avanzate (Apify per lo scraping, OpenAI per l'analisi) per fornire insight dettagliati a partire dalle recensioni pubbliche.

### Flusso di Lavoro Ottimizzato (v2.0)
1.  **Configurazione**: L'utente inserisce le chiavi API (Apify e OpenAI) e definisce i parametri di ricerca.
2.  **Ricerca Schede (Search)**: L'app interroga Google Maps (tramite Apify) per trovare le schede pertinenti.
3.  **Selezione**: L'utente sceglie quali schede analizzare.
4.  **Scraping Recensioni**: L'app scarica le recensioni dettagliate per le schede selezionate (testo, voto, data).
    *   *Miglioramento*: Il server (Netlify Function `check-scrape`) ora restituisce i dati **immediatamente** dopo il completamento dello scraping, senza attendere l'analisi AI.
5.  **Analisi AI Progressiva (Client-Side)**:
    *   L'app nel browser avvia l'analisi AI per ogni scheda individualmente (tramite `analyze-place`).
    *   L'utente vede i risultati apparire man mano che vengono completati, senza blocchi o timeout.
    *   Alla fine, viene generata un'analisi aggregata del brand (tramite `analyze-aggregated`).
6.  **Report**: I risultati vengono presentati in una dashboard con statistiche aggregate ed esportabili.

---

## Logica di Ricerca e Selezione Schede

### 1. Come vengono selezionate le schede?
L'app utilizza un **"Browser simulato"** (Apify *Google Maps Scraper*) che replica la navigazione umana.
*   **Query**: Es. "McDonald's" in "Italia" -> cerca su Maps con `countryCode: 'it'`.
*   **Ranking**: Rispetta l'ordine di Google (Rilevanza, Prominenza, Distanza).
*   **Limite**: Si ferma esattamente al numero di schede richiesto (`maxCrawledPlacesPerSearch`), garantendo velocità.

### 2. Ricerca Bilanciata ed Efficiente
L'app usa una modalità "Balanced" ottimizzata:
*   **Stop Immediato**: Usa parametri precisi per fermare il bot appena raggiunto l'obiettivo.
*   **No Autoscroll Infinito**: Previene lo spreco di tempo e crediti su pagine inutili.
*   **Download Differito**: Le recensioni vengono scaricate solo *dopo* la conferma dell'utente.

### 3. Gestione della Location
*   **"Solo Italia"**: Imposta `countryCode: 'it'`.
*   **"Custom Location"**: Aggiunge la città alla query (es. "Brand Milano").
*   **"Tutto il Mondo"**: Nessun filtro geografico.

---

## Ottimizzazioni Performance e AI

### Problema Risolto: "Lentezza e Timeout"
Precedentemente, l'analisi AI avveniva tutta insieme sul server. Se l'analisi richiedeva >10 secondi (comune con molte recensioni), la richiesta andava in timeout (errore 504) e l'app sembrava bloccata.

### Soluzione: Architettura Asincrona
Ora l'architettura è **de-coppiata**:
1.  **Scraping Veloce**: Il server si occupa solo di scaricare i dati e restituirli.
2.  **Analisi Distribuita**: Il browser "orchestra" l'analisi AI, chiamando l'API per ogni scheda separatamente.
    *   **Vantaggio 1**: Risultati visibili subito.
    *   **Vantaggio 2**: Nessun rischio di timeout del server per operazioni lunghe.
    *   **Vantaggio 3**: Feedback visuale (barra di avanzamento) preciso.

### Strategia AI (Costi e Qualità)
Per massimizzare la qualità riducendo i costi:
1.  **Campionamento**: Analizziamo un campione rappresentativo (20 Positive + 20 Negative).
2.  **Troncamento**: Testi limitati a 200 caratteri per risparmiare token.
3.  **Analisi Aggregata**: Una funzione dedicata (`analyze-aggregated`) sintetizza i trend di tutto il brand in una sola chiamata finale.
