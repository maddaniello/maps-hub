# Maps Hub - Documentazione Tecnica e Funzionale

## Come Funziona l'App

Maps Hub è un'applicazione web progettata per **trovare**, **analizzare** e **monitorare** la reputazione online di brand e luoghi su Google Maps. Utilizza tecnologie avanzate (Apify per lo scraping, OpenAI per l'analisi) per fornire insight dettagliati a partire dalle recensioni pubbliche.

### Flusso di Lavoro
1.  **Configurazione**: L'utente inserisce le chiavi API (Apify e OpenAI) e definisce i parametri di ricerca (brand, location, limiti).
2.  **Ricerca Schede (Search)**: L'app interroga Google Maps (tramite Apify) per trovare le schede pertinenti.
3.  **Selezione**: L'utente sceglie quali schede analizzare tra i risultati trovati.
4.  **Scraping Recensioni**: L'app scarica le recensioni dettagliate (testo, voto, data, risposta proprietario) per le schede selezionate.
5.  **Analisi AI**: Le recensioni vengono elaborate da GPT-4o-mini per estrarre punti di forza, debolezza e suggerimenti strategici.
6.  **Report**: I risultati vengono presentati in una dashboard con statistiche aggregate ed esportabili in PDF/CSV.

---

## Logica di Ricerca e Selezione Schede

### 1. Come vengono selezionate le schede?
L'app utilizza un **"Browser simulato"** (tramite l'actor *Google Maps Scraper* di Apify) che si comporta esattamente come un utente umano che naviga su Google Maps.

*   **Query**: Se cerchi "McDonald's" in "Italia", l'app esegue letteralmente la ricerca `McDonald's` su Google Maps impostando la regione di ricerca sull'Italia (`countryCode: 'it'`).
*   **Ranking**: Le schede vengono restituite nell'ordine esatto in cui Google le mostra per quella ricerca. Google ordina i risultati in base a **Rilevanza** (pertinenza col brand), **Prominenza** (popolarità, recensioni) e **Distanza** (se implicita).
*   **Limite (Max Schede)**: Se imposti "Max 10 schede", l'app prenderà le **prime 10 schede** restituite da Google.
    *   *Nota*: Non vengono selezionate "le 10 più vicine a un centro" geometrico specifico, ma le 10 che Google ritiene più rilevanti per la query "Brand in Italia". Spesso queste coincidono con le sedi più importanti o popolari a livello nazionale, oppure sono distribuite geograficamente se Google 'diversifica' i risultati.

### 2. Cosa significa "Ricerca Bilanciata"?
Attualmente, abbiamo ottimizzato l'app per utilizzare una modalità di ricerca unificata ed efficiente ("Balanced"), che ignora le vecchie distinzioni per garantire velocità e risparmio di crediti.

*   **Balanced (Default)**: Esegue una ricerca standard ottimizzata.
    *   Imposta un limite preciso (`maxCrawledPlacesPerSearch`) per fermare lo scraping appena raggiunto il numero richiesto.
    *   Usa parametri di "autoscroll" limitati per evitare che il bot continui a scorrere pagine inutilmente (causa della lentezza precedente).
    *   Esclude il download delle recensioni in questa fase (vengono scaricate solo dopo la selezione confermata dall'utente), risparmiando tempo e costi.

### 3. Gestione della Location
*   **"Solo Italia"**: Imposta il parametro tecnico `countryCode: 'it'`. Questo dice a Google di privilegiare e cercare risultati nel territorio italiano.
*   **"Custom Location"** (es. "Milano"): Aggiunge esplicitamente la località alla query di ricerca (es. "McDonald's Milano") per restringere il campo.
*   **"Tutto il Mondo"**: Rimuove i filtri geografici.

---

## Ottimizzazioni Recenti (Perché ora è veloce?)

Abbiamo risolto un problema critico che rendeva la ricerca lenta:
*   **Prima**: L'app usava un parametro sbagliato (`maxCrawledPlaces`) che veniva ignorato dall'actor, portandolo a scansionare centinaia di pagine (es. 259 pagine per trovare 2 schede).
*   **Ora**: Usa `maxCrawledPlacesPerSearch`, che è il comando corretto per dire al bot: *"Fermati appena hai trovato X schede"*.
*   Inoltre, abbiamo impostato `maxAutoscrolledPlaces` per impedire lo scrolling infinito.

Questo garantisce che se chiedi 10 schede, il bot farà il lavoro minimo indispensabile per trovarle, riducendo i tempi da minuti a pochi secondi.

---

## Analisi AI (Costi e Performance)

Per l'analisi qualitativa, abbiamo adottato la strategia dell'app di riferimento per massimizzare la qualità riducendo i costi:
1.  **Campionamento Intelligente**: Invece di inviare tutte le recensioni, analizziamo un campione rappresentativo:
    *   20 Recensioni Positive (4-5 stelle)
    *   20 Recensioni Negative (1-2 stelle)
2.  **Troncamento**: Ogni recensione viene troncata a 200 caratteri per evitare di sprecare token su testi lunghissimi non necessari.
3.  **Modello**: Usiamo `gpt-4o-mini` di default, che è molto più veloce ed economico di GPT-4, mantenendo un'ottima capacità di analisi in italiano.
