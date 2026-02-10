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
        const { apifyApiKey, runId } = JSON.parse(event.body);

        if (!apifyApiKey || !runId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: apifyApiKey, runId' })
            };
        }

        const client = new ApifyClient({ token: apifyApiKey });
        const run = await client.run(runId).get();

        console.log('Search run status:', run.status);

        // Check run status
        if (run.status === 'RUNNING' || run.status === 'READY') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'RUNNING',
                    message: 'Search in progress...'
                })
            };
        }

        if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'FAILED',
                    error: `Search ${run.status.toLowerCase()}`
                })
            };
        }

        if (run.status === 'SUCCEEDED') {
            // Fetch the dataset
            const dataset = await client.dataset(run.defaultDatasetId).listItems();

            // Transform results to our format
            const places = dataset.items.map(item => ({
                placeId: item.placeId || item.url?.match(/ChIJ[a-zA-Z0-9_-]+/)?.[0] || '',
                title: item.title || item.name || 'Unknown',
                address: item.address || '',
                rating: item.rating || 0,
                reviewsCount: item.reviewsCount || item.totalScore || 0,
                url: item.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.title || '')}&query_place_id=${item.placeId || ''}`
            })).filter(place => place.placeId); // Only include places with valid placeId

            console.log(`Search succeeded: ${places.length} places found`);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'SUCCEEDED',
                    places
                })
            };
        }

        // Unknown status
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: run.status,
                message: 'Unknown run status'
            })
        };

    } catch (error) {
        console.error('Error checking search status:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to check search status',
                message: error.message
            })
        };
    }
};
