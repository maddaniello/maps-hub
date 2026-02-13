const { ApifyClient } = require('apify-client');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const {
      apifyApiKey,
      brandName,
      location,
      maxPlaces = 50,
      searchMode = 'balanced',
      skipClosed = false
    } = JSON.parse(event.body);

    // Validate required fields
    if (!apifyApiKey || !brandName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: apifyApiKey, brandName' })
      };
    }

    // Initialize Apify client
    const client = new ApifyClient({ token: apifyApiKey });

    // Construct search query
    let searchQuery = brandName;

    // Build location-specific query
    if (location && location !== 'world') {
      if (location === 'italy') {
        searchQuery = `${brandName} in Italy`;
      } else {
        searchQuery = `${brandName} in ${location}`;
      }
    }

    // Determine max places based on search mode
    let maxCrawledPlaces = parseInt(maxPlaces);
    if (searchMode === 'aggressive') {
      maxCrawledPlaces = Math.round(maxCrawledPlaces * 1.5);
    }

    // Prepare actor input matching compass/crawler-google-places schema
    const input = {
      searchStringsArray: [searchQuery],
      maxCrawledPlaces,
      language: 'it',
      countryCode: location === 'italy' || !location || location === 'world' ? '' : '',
      maxReviews: 0, // Don't scrape reviews yet, just find places
      includeWebsiteUrl: true,
      includeReviews: false, // Save Apify credits - reviews scraped separately
      skipClosedPlaces: skipClosed
    };

    // Add countryCode for Italy-specific searches (like reference app)
    if (location === 'italy') {
      input.countryCode = 'it';
    }

    console.log('Starting Apify search:', { searchQuery, maxCrawledPlaces, searchMode });

    // Start the actor run (returns immediately, we poll for status)
    const run = await client.actor('nwua9Gu5YrADL7ZDj').start(input);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        runId: run.id,
        statusUrl: `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs/${run.id}`
      })
    };

  } catch (error) {
    console.error('Error starting search:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to start search',
        message: error.message
      })
    };
  }
};
