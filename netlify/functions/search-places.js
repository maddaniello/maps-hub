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

    // Prepare actor input
    const input = {
      searchQuery,
      maxPlaces,
      language: 'it',
      skipClosedPlaces: skipClosed
    };

    // Add search mode parameters
    if (searchMode === 'aggressive') {
      input.maxPlaces = maxPlaces * 1.5; // Request more to filter later
    } else if (searchMode === 'strict') {
      input.exactMatch = true;
    }

    console.log('Starting Apify search:', { searchQuery, maxPlaces, searchMode });

    // Start the actor run (use .start() to return immediately, we'll poll for status)
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
