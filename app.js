// ========================================
// Global State & Constants
// ========================================
const MOCA_HUB_URL = 'https://moca-hub.netlify.app';
const STORAGE_KEYS = {
  HISTORY: 'gmrs_history'
};

const state = {
  moca: null,
  currentMode: 'brand',
  searchResults: [],
  selectedPlaces: [],
  scrapeResults: null,
  activeTab: 'overview',
  searchRunId: null,
  scrapeRunId: null,
  placesMetadata: [] // Store metadata for check-scrape context
};

// ========================================
// Application Initialization
// ========================================
(async function init() {
  console.log('[GMRS] Initializing application...');

  // Initialize Moca SDK
  state.moca = new MocaSDK(MOCA_HUB_URL);

  const authenticated = await state.moca.init();

  if (!authenticated) {
    state.moca.showAccessDenied();
    return;
  }

  console.log('[GMRS] Authentication successful');

  // Show app
  document.getElementById('app').style.display = 'block';

  // Populate client branding
  const client = state.moca.getClient();
  const user = state.moca.getUser();

  document.getElementById('client-logo').src = client.logo_url || 'https://mocainteractive.com/assets/svg/logo.svg';
  document.getElementById('client-name').textContent = client.name;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-role').textContent = user.role;

  // Setup event listeners
  setupEventListeners();

  console.log('[GMRS] Application ready');
})();

// ========================================
// Event Listeners Setup
// ========================================
function setupEventListeners() {
  // Mode toggle
  document.getElementById('mode-brand').addEventListener('click', () => switchMode('brand'));
  document.getElementById('mode-url').addEventListener('click', () => switchMode('url'));

  // Location selector
  document.getElementById('location').addEventListener('change', (e) => {
    const customGroup = document.getElementById('custom-location-group');
    customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
  });

  // AI toggle
  document.getElementById('enable-ai').addEventListener('change', (e) => {
    document.getElementById('ai-config').style.display = e.target.checked ? 'block' : 'none';
  });

  // Main actions
  document.getElementById('btn-search').addEventListener('click', handleSearch);
  document.getElementById('btn-select-all').addEventListener('click', () => toggleAllPlaces(true));
  document.getElementById('btn-deselect-all').addEventListener('click', () => toggleAllPlaces(false));
  document.getElementById('btn-start-scrape').addEventListener('click', handleStartScrape);

  // Export actions
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

  // History modal
  document.getElementById('btn-history').addEventListener('click', openHistoryModal);
  document.getElementById('modal-close').addEventListener('click', closeHistoryModal);
  document.getElementById('btn-clear-history').addEventListener('click', clearAllHistory);

  // Close modal on outside click
  document.getElementById('history-modal').addEventListener('click', (e) => {
    if (e.target.id === 'history-modal') closeHistoryModal();
  });
}

// ========================================
// Mode Switching
// ========================================
function switchMode(mode) {
  state.currentMode = mode;

  // Update buttons
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`mode-${mode}`).classList.add('active');

  // Update content
  document.getElementById('brand-mode').style.display = mode === 'brand' ? 'block' : 'none';
  document.getElementById('url-mode').style.display = mode === 'url' ? 'block' : 'none';
}

// ========================================
// Search Places
// ========================================
async function handleSearch() {
  const btn = document.getElementById('btn-search');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Ricerca in corso...';

  try {
    // Get API keys from Moca SDK
    const apifyKey = state.moca.getConfig('APIFY_API_KEY');

    if (!apifyKey) {
      alert('⚠️ Apify API Key non configurata. Vai su Moca Hub → Configurations');
      return;
    }

    // Show progress
    showStep(3);
    updateProgress(10, 'Avvio ricerca...');

    let response;

    if (state.currentMode === 'brand') {
      // Brand search mode
      const brandName = document.getElementById('brand-name').value.trim();
      if (!brandName) {
        alert('Inserisci un nome brand');
        return;
      }

      const location = document.getElementById('location').value;
      const customLocation = document.getElementById('custom-location').value.trim();
      const maxPlaces = parseInt(document.getElementById('max-places').value);
      const searchMode = document.getElementById('search-mode').value;
      const skipClosed = document.getElementById('skip-closed').checked;

      let locationValue = location === 'custom' ? customLocation : location;

      response = await fetch('/.netlify/functions/search-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apifyApiKey: apifyKey,
          brandName,
          location: locationValue,
          maxPlaces,
          searchMode,
          skipClosed
        })
      });
    } else {
      // URL mode
      const urls = document.getElementById('manual-urls').value
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (urls.length === 0) {
        alert('Inserisci almeno un URL');
        return;
      }

      response = await fetch('/.netlify/functions/parse-manual-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Search failed');
    }

    if (state.currentMode === 'brand') {
      // Start polling for brand search
      state.searchRunId = data.runId;
      await pollSearchStatus();
    } else {
      // URL mode returns places directly
      state.searchResults = data.places;
      displayPlaces();
    }

  } catch (error) {
    console.error('Search error:', error);
    alert(`❌ Errore durante la ricerca: ${error.message}`);
    showStep(1);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 Cerca Schede';
  }
}

// ========================================
// Poll Search Status
// ========================================
async function pollSearchStatus() {
  const apifyKey = state.moca.getConfig('APIFY_API_KEY');
  const maxAttempts = 150; // ~5 minutes max (2s interval)
  let attempts = 0;

  const poll = async () => {
    attempts++;
    const elapsed = Math.round(attempts * 2);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    updateProgress(Math.min(45, 10 + (attempts / maxAttempts) * 40), `Ricerca in corso... ${timeStr}`);

    const response = await fetch('/.netlify/functions/check-search-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apifyApiKey: apifyKey,
        runId: state.searchRunId
      })
    });

    const data = await response.json();

    if (data.status === 'SUCCEEDED') {
      updateProgress(50, 'Ricerca completata!');
      state.searchResults = data.places;
      displayPlaces();
      return;
    }

    if (data.status === 'FAILED') {
      throw new Error(data.error || 'Search failed');
    }

    if (attempts >= maxAttempts) {
      throw new Error('Search timeout');
    }

    setTimeout(poll, 2000);
  };

  await poll();
}

// ========================================
// Display Places for Selection
// ========================================
function displayPlaces() {
  const list = document.getElementById('places-list');
  list.innerHTML = '';

  if (state.searchResults.length === 0) {
    list.innerHTML = '<p class="empty-state">Nessuna scheda trovata</p>';
    showStep(1);
    return;
  }

  state.searchResults.forEach((place, index) => {
    const item = document.createElement('div');
    item.className = 'place-item';
    item.innerHTML = `
      <input type="checkbox" id="place-${index}" checked>
      <div class="place-info">
        <div class="place-title">${place.title}</div>
        <div class="place-details">
          ${place.address ? place.address + ' • ' : ''}
          ${place.rating ? '⭐ ' + place.rating : ''} 
          ${place.reviewsCount ? '(' + place.reviewsCount + ' recensioni)' : ''}
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  showStep(2);
}

// ========================================
// Toggle All Places
// ========================================
function toggleAllPlaces(checked) {
  document.querySelectorAll('.place-item input[type="checkbox"]').forEach(cb => {
    cb.checked = checked;
  });
}

// ========================================
// Start Scraping
// ========================================
async function handleStartScrape() {
  // Get selected places
  const selectedIndices = [];
  document.querySelectorAll('.place-item input[type="checkbox"]').forEach((cb, idx) => {
    if (cb.checked) selectedIndices.push(idx);
  });

  if (selectedIndices.length === 0) {
    alert('Seleziona almeno una scheda');
    return;
  }

  state.selectedPlaces = selectedIndices.map(i => state.searchResults[i]);

  showStep(3);
  updateProgress(0, 'Avvio scraping...');

  try {
    const apifyKey = state.moca.getConfig('APIFY_API_KEY');
    const maxReviews = state.currentMode === 'brand'
      ? parseInt(document.getElementById('max-reviews').value)
      : parseInt(document.getElementById('max-reviews-url').value);

    // Start scrape - pass places with their original URLs
    const response = await fetch('/.netlify/functions/start-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apifyApiKey: apifyKey,
        places: state.selectedPlaces,
        maxReviews
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to start scrape');
    }

    state.scrapeRunId = data.runId;
    state.placesMetadata = data.placesMetadata || state.selectedPlaces;
    await pollScrapeStatus();

  } catch (error) {
    console.error('Scrape error:', error);
    alert(`❌ Errore durante lo scraping: ${error.message}`);
    showStep(2);
  }
}

// ========================================
// Poll Scrape Status
// ========================================
async function pollScrapeStatus() {
  const apifyKey = state.moca.getConfig('APIFY_API_KEY');
  const aiEnabled = document.getElementById('enable-ai').checked;
  const openaiKey = aiEnabled ? state.moca.getConfig('OPENAI_API_KEY') : null;
  const openaiModel = document.getElementById('openai-model').value;

  if (aiEnabled && !openaiKey) {
    alert('⚠️ OpenAI API Key non configurata. Vai su Moca Hub → Configurations');
    return;
  }

  const maxAttempts = 200; // ~10 minutes max (3s interval)
  let attempts = 0;

  const poll = async () => {
    attempts++;
    const elapsed = Math.round(attempts * 3);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    updateProgress(
      Math.min(90, 10 + (attempts / maxAttempts) * 80),
      `Scraping in corso... ${timeStr} trascorsi`
    );

    const response = await fetch('/.netlify/functions/check-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apifyApiKey: apifyKey,
        runId: state.scrapeRunId,
        // AI params removed from here - handled client side now
      })
    });

    const data = await response.json();

    if (data.status === 'SUCCEEDED') {
      updateProgress(100, '✅ Scraping Completato!');
      state.scrapeResults = data.results;

      // Display initial results immediately (without AI)
      displayResults();

      // Start AI analysis if enabled
      if (aiEnabled) {
        await performAIAnalysis(openaiKey, openaiModel);
      }

      saveToHistory();
      return;
    }

    if (data.status === 'FAILED') {
      throw new Error(data.error || 'Scrape failed');
    }

    if (attempts >= maxAttempts) {
      throw new Error('Scrape timeout - troppo tempo trascorso (10 min)');
    }

    setTimeout(poll, 3000);
  };

  await poll();
}

// ========================================
// Client-Side AI Analysis Orchestration
// ========================================
async function performAIAnalysis(openaiKey, openaiModel) {
  const { places } = state.scrapeResults;
  const total = places.length;
  // Get sampling state (default to true if element missing for safety)
  const samplingElement = document.getElementById('ai-sampling');
  const samplingEnabled = samplingElement ? samplingElement.checked : true;

  // Show analysis progress bar
  const progressContainer = document.querySelector('.progress-container');
  if (progressContainer) progressContainer.style.display = 'block';

  updateProgress(0, `Avvio analisi AI su ${total} schede (${samplingEnabled ? 'Campionamento' : 'Full'})...`);

  // Analyze each place sequentially (or small batch) to avoid browser network limit
  // Parallelizing 3 at a time is usually safe
  const batchSize = 3;

  for (let i = 0; i < total; i += batchSize) {
    const batch = places.slice(i, i + batchSize);
    const promises = batch.map(async (place) => {
      // Skip if no reviews or already analyzed
      if (!place.reviews || place.reviews.length === 0 || place.analysis) return;

      try {
        // Update UI placeholder? (Optional)

        const response = await fetch('/.netlify/functions/analyze-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            openaiApiKey: openaiKey,
            openaiModel: openaiModel,
            placeName: place.title,
            reviews: place.reviews,
            samplingEnabled: samplingEnabled // Pass sampling preference
          })
        });

        const data = await response.json();

        if (data.success && data.analysis) {
          place.analysis = data.analysis;
          // Refresh specific place tab if it's currently open (optimization) or just refresh all
          // simpler to just refresh the UI for that place if possible, but full redraw is safer
        }
      } catch (e) {
        console.error(`AI analysis failed for ${place.title}`, e);
      }
    });

    await Promise.all(promises);

    const percent = Math.round(((i + batch.length) / total) * 90);
    updateProgress(percent, `Analisi AI: ${Math.min(i + batch.length, total)}/${total} schede completate`);

    // Progressive update of UI - redraw to show new analysis
    displayResults();
  }

  // After all individual places, do aggregated analysis
  updateProgress(90, 'Analisi aggregata Brand...');

  try {
    // Prepare ALL reviews flat list
    const allReviews = places.flatMap(p => p.reviews);
    const brandName = places[0]?.title?.split('-')[0]?.trim() || 'Brand'; // Heuristic

    const response = await fetch('/.netlify/functions/analyze-aggregated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openaiApiKey: openaiKey,
        openaiModel: openaiModel,
        reviews: allReviews,
        brandName: brandName,
        totalPlaces: total,
        samplingEnabled: samplingEnabled // Pass sampling preference
      })
    });

    const data = await response.json();
    if (data.success && data.analysis) {
      // Attach to aggregateStats or root
      if (!state.scrapeResults.aggregateStats.aiStats) {
        state.scrapeResults.aggregateStats.aiStats = {};
      }
      state.scrapeResults.aggregateStats.aiStats.analysis = data.analysis;
    }

  } catch (e) {
    console.error('Aggregated analysis failed', e);
  }

  updateProgress(100, '✅ Analisi AI Completata!');
  displayResults(); // Final redraw

  // Hide progress after a delay
  setTimeout(() => {
    if (progressContainer) progressContainer.style.display = 'none';
  }, 3000);
}

// ========================================
// Display Results
// ========================================
function displayResults() {
  const { places, aggregateStats } = state.scrapeResults;

  // Create tabs
  const tabsNav = document.getElementById('tabs-nav');
  const tabsContent = document.getElementById('tabs-content');

  tabsNav.innerHTML = '';
  tabsContent.innerHTML = '';

  // Overview tab
  const overviewTab = createTabButton('overview', '📊 Panoramica', true);
  tabsNav.appendChild(overviewTab);

  const overviewContent = createOverviewTab(aggregateStats, places);
  tabsContent.appendChild(overviewContent);

  // Individual place tabs
  places.forEach((place, idx) => {
    const placeTab = createTabButton(`place-${idx}`, `📍 ${place.title}`);
    tabsNav.appendChild(placeTab);

    const placeContent = createPlaceTab(place, idx);
    tabsContent.appendChild(placeContent);
  });

  showStep(4);
}

// ========================================
// Create Tab Button
// ========================================
function createTabButton(id, label, active = false) {
  const btn = document.createElement('button');
  btn.className = `tab-btn ${active ? 'active' : ''}`;
  btn.textContent = label;
  btn.onclick = () => switchTab(id);
  return btn;
}

// ========================================
// Switch Tab
// ========================================
function switchTab(tabId) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
}

// ========================================
// Create Overview Tab
// ========================================
function createOverviewTab(stats, places) {
  const div = document.createElement('div');
  div.id = 'tab-overview';
  div.className = 'tab-content active';

  // Statistics grid
  div.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalPlaces}</div>
        <div class="stat-label">Schede Analizzate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalReviews}</div>
        <div class="stat-label">Totale Recensioni</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgRating}</div>
        <div class="stat-label">Rating Medio</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.reviewsWithText}</div>
        <div class="stat-label">Con Testo</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.reviewsWithResponse}</div>
        <div class="stat-label">Con Risposta</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.sentiment.positivePercent}%</div>
        <div class="stat-label">Positive</div>
      </div>
    </div>
    
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">Distribuzione Stelle</div>
        <div class="chart-bars">
          ${[5, 4, 3, 2, 1].map(stars => {
    const count = stats.distribution[stars] || 0;
    const percent = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
    return `
              <div class="chart-bar-row">
                <div class="chart-bar-label">${stars} ⭐</div>
                <div class="chart-bar-container">
                  <div class="chart-bar-fill" style="width: ${percent}%">
                    <span class="chart-bar-value">${count}</span>
                  </div>
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
      
      <div class="chart-container">
        <div class="chart-title">Sentiment</div>
        <div class="chart-bars">
          <div class="chart-bar-row">
            <div class="chart-bar-label">Positive</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${stats.sentiment.positivePercent}%; background: #22c55e;">
                <span class="chart-bar-value">${stats.sentiment.positive}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Neutre</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${stats.sentiment.neutralPercent}%; background: #f59e0b;">
                <span class="chart-bar-value">${stats.sentiment.neutral}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Negative</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${stats.sentiment.negativePercent}%; background: #ef4444;">
                <span class="chart-bar-value">${stats.sentiment.negative}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add AI section if available (Updated for new Client-Side AI)
  if (stats.aiStats && stats.aiStats.analysis) {
    const aiSection = createAISection(stats.topKeywords, stats.aiStats.analysis, true);
    div.appendChild(aiSection);
  } else if (places.some(p => p.analysis)) {
    // Fallback if partial analysis exists but not aggregated yet
    const aiSection = createAISection(stats.topKeywords, null, true);
    div.appendChild(aiSection);
  }

  return div;
}

// ========================================
// Create Place Tab
// ========================================
function createPlaceTab(place, index) {
  const div = document.createElement('div');
  div.id = `tab-place-${index}`;
  div.className = 'tab-content';

  // Calculate place-specific stats
  const reviews = place.reviews || [];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const sentiment = { positive: 0, neutral: 0, negative: 0 };

  reviews.forEach(r => {
    const stars = r.stars || 0;
    if (stars >= 1 && stars <= 5) {
      distribution[stars]++;
      if (stars >= 4) sentiment.positive++;
      else if (stars === 3) sentiment.neutral++;
      else sentiment.negative++;
    }
  });

  const reviewsWithText = reviews.filter(r => r.text && r.text.trim().length > 0).length;
  const reviewsWithResponse = reviews.filter(r => r.responseFromOwner && r.responseFromOwner.trim().length > 0).length;

  const totalReviews = reviews.length;
  const positivePercent = totalReviews > 0 ? Math.round((sentiment.positive / totalReviews) * 100) : 0;
  const neutralPercent = totalReviews > 0 ? Math.round((sentiment.neutral / totalReviews) * 100) : 0;
  const negativePercent = totalReviews > 0 ? Math.round((sentiment.negative / totalReviews) * 100) : 0;

  div.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${place.rating || 'N/A'}</div>
        <div class="stat-label">Rating</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalReviews}</div>
        <div class="stat-label">Recensioni</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${reviewsWithText}</div>
        <div class="stat-label">Con Testo</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${reviewsWithResponse}</div>
        <div class="stat-label">Con Risposta</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${positivePercent}%</div>
        <div class="stat-label">Positive</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${negativePercent}%</div>
        <div class="stat-label">Negative</div>
      </div>
    </div>
    
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">Distribuzione Stelle</div>
        <div class="chart-bars">
          ${[5, 4, 3, 2, 1].map(stars => {
    const count = distribution[stars] || 0;
    const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return `
              <div class="chart-bar-row">
                <div class="chart-bar-label">${stars} ⭐</div>
                <div class="chart-bar-container">
                  <div class="chart-bar-fill" style="width: ${percent}%">
                    <span class="chart-bar-value">${count}</span>
                  </div>
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
      
      <div class="chart-container">
        <div class="chart-title">Sentiment</div>
        <div class="chart-bars">
          <div class="chart-bar-row">
            <div class="chart-bar-label">Positive</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${positivePercent}%; background: #22c55e;">
                <span class="chart-bar-value">${sentiment.positive}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Neutre</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${neutralPercent}%; background: #f59e0b;">
                <span class="chart-bar-value">${sentiment.neutral}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Negative</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${negativePercent}%; background: #ef4444;">
                <span class="chart-bar-value">${sentiment.negative}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add AI section if available
  if (place.analysis) {
    const keywords = extractKeywordsFromReviews(reviews.filter(r => r.text));
    const aiSection = createAISection(keywords, place.analysis, false);
    div.appendChild(aiSection);
  }

  return div;
}

// ========================================
// Create AI Section
// ========================================
function createAISection(keywords, analysis, isOverview) {
  const section = document.createElement('div');
  section.className = 'ai-section-results';

  let html = '<h3>🤖 Analisi AI</h3>';

  // Wordcloud
  html += '<div class="wordcloud">';
  keywords.slice(0, 30).forEach(item => {
    const size = Math.max(0.8, Math.min(2, item.count / 10));
    html += `<span class="wordcloud-item" style="font-size: ${size}rem">${item.word} (${item.count})</span>`;
  });
  html += '</div>';

  // Analysis (if available for individual place)
  if (analysis) {
    html += `
      <div class="priorities-list">
        <h4>🎯 Top 3 Priorità</h4>
        <ol>
          ${analysis.priorities.map(p => `<li>${p}</li>`).join('')}
        </ol>
      </div>
      
      <div class="analysis-grid">
        <div class="analysis-section">
          <h4>✅ Punti di Forza</h4>
          <ul>
            ${analysis.strengths.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        
        <div class="analysis-section">
          <h4>⚠️ Aree di Miglioramento</h4>
          <ul>
            ${analysis.weaknesses.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>
      </div>
      
      <div class="analysis-section">
        <h4>💡 Raccomandazioni Strategiche</h4>
        <ul>
          ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      
      <div class="analysis-section">
        <h4>🚀 Suggerimenti Azionabili</h4>
        <ul>
          ${analysis.suggestions.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  section.innerHTML = html;
  return section;
}

// ========================================
// Extract Keywords from Reviews
// ========================================
function extractKeywordsFromReviews(reviews) {
  const stopwords = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per',
    'tra', 'fra', 'e', 'ed', 'anche', 'se', 'ma', 'però', 'che', 'chi', 'cui', 'quale', 'quando',
    'dove', 'come', 'perché', 'perchè', 'questo', 'quello', 'questi', 'quelli', 'questa', 'quella',
    'molto', 'poco', 'più', 'meno', 'tanto', 'troppo', 'tutto', 'ogni', 'ciascuno', 'alcuni',
    'essere', 'avere', 'fare', 'stare', 'andare', 'venire', 'dovere', 'potere', 'volere', 'sapere',
    'sono', 'è', 'ho', 'ha', 'hanno', 'era', 'erano', 'stato', 'stati', 'stata', 'state', 'fatto',
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are',
    'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'it', 'its', 'my',
    'your', 'his', 'her', 'their', 'our', 'me', 'you', 'him', 'she', 'them', 'us', 'non', 'mi'
  ]);

  const wordCounts = new Map();

  reviews.forEach(review => {
    if (!review.text) return;

    const words = review.text.toLowerCase()
      .replace(/[^\w\sàèéìòù]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 4 && !stopwords.has(word) && !/^\d+$/.test(word));

    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));
}

// ========================================
// Export Functions
// ========================================
function exportJSON() {
  const data = JSON.stringify(state.scrapeResults, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gmrs-results-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const { places } = state.scrapeResults;

  const headers = [
    'Place Name', 'Address', 'Total Rating', 'Reviews Count', 'URL',
    'Review ID', 'Author Name', 'Author URL', 'Review Text',
    'Stars', 'Published Date', 'Response Text', 'Likes Count'
  ];

  let csv = headers.join(',') + '\n';

  places.forEach(place => {
    place.reviews.forEach(review => {
      const row = [
        escapeCSV(place.title),
        escapeCSV(place.address),
        place.rating || '',
        place.totalReviews || '',
        escapeCSV(place.url),
        escapeCSV(review.id),
        escapeCSV(review.authorName),
        escapeCSV(review.authorUrl),
        escapeCSV(review.text),
        review.stars || '',
        review.publishedAtDate || '',
        escapeCSV(review.responseFromOwner),
        review.likesCount || ''
      ];
      csv += row.join(',') + '\n';
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gmrs-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(str) {
  if (!str) return '';
  str = str.toString().replace(/"/g, '""');
  return `"${str}"`;
}

async function exportPDF() {
  alert('📄 Generazione PDF in corso... Questa operazione potrebbe richiedere alcuni secondi.');

  // Note: Full PDF generation with jsPDF would be implemented here
  // For brevity, showing the structure
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Add branding
  doc.setFontSize(20);
  doc.setTextColor(229, 34, 23);
  doc.text('Google Maps Reviews Scraper', 20, 20);

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Cliente: ${state.moca.getClient().name}`, 20, 30);
  doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 20, 37);

  // Add statistics
  const stats = state.scrapeResults.aggregateStats;
  doc.text(`Schede Analizzate: ${stats.totalPlaces}`, 20, 50);
  doc.text(`Totale Recensioni: ${stats.totalReviews}`, 20, 57);
  doc.text(`Rating Medio: ${stats.avgRating}`, 20, 64);

  // Save
  doc.save(`gmrs-report-${Date.now()}.pdf`);
}

// ========================================
// History Management
// ========================================
function saveToHistory() {
  const history = getHistory();

  // Prevent duplicates (same brand/mode within 1 minute)
  const now = Date.now();
  const isDuplicate = history.some(h => {
    const timeDiff = now - h.timestamp;
    const sameMode = h.mode === state.currentMode;
    const sameBrand = state.currentMode === 'brand' && h.brandName === document.getElementById('brand-name').value.trim();
    return timeDiff < 60000 && sameMode && (state.currentMode === 'url' || sameBrand);
  });

  if (isDuplicate) {
    console.log('[GMRS] Duplicate search, not saving to history');
    return;
  }

  const entry = {
    id: Date.now(),
    timestamp: now,
    mode: state.currentMode,
    brandName: state.currentMode === 'brand' ? document.getElementById('brand-name').value.trim() : null,
    placesCount: state.scrapeResults.places.length,
    reviewsCount: state.scrapeResults.aggregateStats.totalReviews,
    aiEnabled: document.getElementById('enable-ai').checked,
    results: state.scrapeResults
  };

  history.unshift(entry);

  // Keep max 20
  if (history.length > 20) {
    history.splice(20);
  }

  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  console.log('[GMRS] Saved to history');
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  } catch {
    return [];
  }
}

function openHistoryModal() {
  const history = getHistory();
  const list = document.getElementById('history-list');

  if (history.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Nessuna ricerca salvata</p></div>';
  } else {
    list.innerHTML = history.map(entry => `
      <div class="history-item">
        <div class="history-icon">${entry.mode === 'brand' ? '🔍' : '🔗'}</div>
        <div class="history-info">
          <div class="history-title">${entry.brandName || 'URL Manuali'}</div>
          <div class="history-meta">
            ${new Date(entry.timestamp).toLocaleString('it-IT')} • 
            ${entry.placesCount} schede • ${entry.reviewsCount} recensioni
            ${entry.aiEnabled ? ' • 🤖 AI' : ''}
          </div>
        </div>
        <div class="history-actions">
          <button class="btn-load" onclick="loadFromHistory(${entry.id})">Carica</button>
          <button class="btn-delete" onclick="deleteFromHistory(${entry.id})">Elimina</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('history-modal').classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('history-modal').classList.remove('active');
}

function loadFromHistory(id) {
  const history = getHistory();
  const entry = history.find(h => h.id === id);

  if (!entry) return;

  state.scrapeResults = entry.results;
  displayResults();
  closeHistoryModal();
}

function deleteFromHistory(id) {
  let history = getHistory();
  history = history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  openHistoryModal(); // Refresh
}

function clearAllHistory() {
  if (!confirm('Sei sicuro di voler cancellare tutto lo storico?')) return;
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
  openHistoryModal(); // Refresh
}

// Make functions global for onclick handlers
window.loadFromHistory = loadFromHistory;
window.deleteFromHistory = deleteFromHistory;

// ========================================
// UI Utilities
// ========================================
function showStep(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.style.display = i === step ? 'block' : 'none';
  }
}

function updateProgress(percent, text) {
  document.getElementById('progress-fill').style.width = `${percent}%`;
  document.getElementById('progress-text').textContent = text;
}
