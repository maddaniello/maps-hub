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

    // Construct search query - keep it simple, let countryCode handle location
    // Reference app uses just the brand name + countryCode
    let searchQuery = brandName;

    // Only append location for custom locations (not Italy/world)
    if (location && location !== 'world' && location !== 'italy') {
      searchQuery = `${brandName} ${location}`;
    }

    // Max places - keep it reasonable to save credits
    const maxPlacesInt = Math.min(parseInt(maxPlaces), 100);

    // Prepare actor input - use EXACT same parameters as reference app
    const input = {
      searchStringsArray: [searchQuery],
      maxCrawledPlacesPerSearch: maxPlacesInt, // Correct param name (reference app)
      language: 'it',
      countryCode: location === 'italy' ? 'it' : '',
      includeWebsiteUrl: true,
      includeReviews: false, // Don't scrape reviews yet - saves credits!
      skipClosedPlaces: skipClosed,
      // Speed optimizations
      maxAutoscrolledPlaces: maxPlacesInt, // Stop scrolling once we have enough
    };

    console.log('Starting Apify search:', { searchQuery, maxPlacesInt, searchMode });

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
