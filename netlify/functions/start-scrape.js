const { ApifyClient } = require('apify-client');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

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
        const { apifyApiKey, places, maxReviews = 100 } = JSON.parse(event.body);

        if (!apifyApiKey || !places || !Array.isArray(places)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: apifyApiKey, places (array)' })
            };
        }

        const client = new ApifyClient({ token: apifyApiKey });

        // Build startUrls - use original Google Maps URLs directly
        // The Reviews Scraper works best with original /maps/place/ URLs
        const startUrls = places.map(place => ({
            url: place.url || place.originalUrl || `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
        }));

        // Use compass/Google-Maps-Reviews-Scraper (same as working reference app)
        // This actor returns flat review objects, NOT nested reviews in place data
        const input = {
            startUrls,
            maxReviews: parseInt(maxReviews),
            reviewsSort: 'newest',
            language: 'it'
        };

        console.log('Starting review scrape for', places.length, 'places with max', maxReviews, 'reviews each');
        console.log('startUrls:', JSON.stringify(startUrls));

        // Start the actor run asynchronously (we poll for status via check-scrape)
        const run = await client.actor('compass/Google-Maps-Reviews-Scraper').start(input);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                runId: run.id,
                placesMetadata: places.map(p => ({
                    placeId: p.placeId,
                    title: p.title,
                    address: p.address,
                    rating: p.rating,
                    reviewsCount: p.reviewsCount,
                    url: p.url
                }))
            })
        };

    } catch (error) {
        console.error('Error starting scrape:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to start scrape',
                message: error.message
            })
        };
    }
};
