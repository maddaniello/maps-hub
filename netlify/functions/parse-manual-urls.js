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
        const { urls } = JSON.parse(event.body);

        if (!urls || !Array.isArray(urls)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing or invalid urls array' })
            };
        }

        const places = [];

        for (const url of urls) {
            const trimmedUrl = url.trim();
            if (!trimmedUrl) continue;

            let placeId = null;
            let title = 'Unknown Location';

            // Pattern 1: ?query_place_id=ChIJ...
            const queryPlaceIdMatch = trimmedUrl.match(/query_place_id=([a-zA-Z0-9_-]+)/);
            if (queryPlaceIdMatch) {
                placeId = queryPlaceIdMatch[1];
            }

            // Pattern 2: place_id:ChIJ... or place_id=ChIJ...
            const placeIdMatch = trimmedUrl.match(/place_id[=:]([a-zA-Z0-9_-]+)/);
            if (!placeId && placeIdMatch) {
                placeId = placeIdMatch[1];
            }

            // Pattern 3: /place/Name+Location/data=...!1sChIJ...
            const dataPlaceIdMatch = trimmedUrl.match(/\/place\/([^\/]+)\/.*!1s([a-zA-Z0-9_-]+)/);
            if (!placeId && dataPlaceIdMatch) {
                placeId = dataPlaceIdMatch[2];
                title = decodeURIComponent(dataPlaceIdMatch[1].replace(/\+/g, ' '));
            }

            // Pattern 4: Direct ChIJ... string
            const directPlaceIdMatch = trimmedUrl.match(/^(ChIJ[a-zA-Z0-9_-]+)$/);
            if (!placeId && directPlaceIdMatch) {
                placeId = directPlaceIdMatch[1];
            }

            // Pattern 5: /place/Name+Location without place ID (try to extract name)
            const placeNameMatch = trimmedUrl.match(/\/place\/([^\/\?]+)/);
            if (!placeId && placeNameMatch) {
                title = decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '));
                // We'll create a search URL instead
            }

            if (placeId || title !== 'Unknown Location') {
                const placeUrl = placeId
                    ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${placeId}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`;

                places.push({
                    placeId: placeId || `search:${title}`,
                    title,
                    url: placeUrl,
                    originalUrl: trimmedUrl
                });
            } else {
                console.warn('Could not parse URL:', trimmedUrl);
            }
        }

        console.log(`Parsed ${places.length} places from ${urls.length} URLs`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                places
            })
        };

    } catch (error) {
        console.error('Error parsing URLs:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to parse URLs',
                message: error.message
            })
        };
    }
};
