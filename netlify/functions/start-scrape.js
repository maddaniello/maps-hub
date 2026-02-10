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

        // Construct startUrls for Apify actor
        const startUrls = places.map(place => ({
            url: place.url || `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${place.placeId}`
        }));

        const input = {
            startUrls,
            maxReviews: parseInt(maxReviews),
            language: 'it',
            personalData: true, // Include author names
            scrapeReviewId: true,
            scrapeReviewUrl: true,
            scrapeReviewerId: true,
            scrapeReviewerUrl: true,
            scrapeReviewerNumberOfReviews: false,
            scrapeResponseFromOwnerText: true
        };

        console.log('Starting scrape for', places.length, 'places with max', maxReviews, 'reviews each');

        // Start the actor run
        const run = await client.actor('compass/crawler-google-places').call(input, {
            waitForFinish: 0 // Return immediately, we'll poll
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                runId: run.id,
                statusUrl: `https://api.apify.com/v2/acts/compass~crawler-google-places/runs/${run.id}`
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
