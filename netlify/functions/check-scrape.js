const { ApifyClient } = require('apify-client');
// OpenAI removed - analysis now client-side


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
        const {
            apifyApiKey,
            runId,
            aiEnabled = false,
            openaiApiKey,
            openaiModel = 'gpt-4o-mini',
            placesMetadata = []
        } = JSON.parse(event.body);

        if (!apifyApiKey || !runId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: apifyApiKey, runId' })
            };
        }

        const client = new ApifyClient({ token: apifyApiKey });
        const run = await client.run(runId).get();

        console.log('Scrape run status:', run.status);

        // Check run status
        if (run.status === 'RUNNING' || run.status === 'READY') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'RUNNING',
                    message: 'Scraping in progress...'
                })
            };
        }

        if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'FAILED',
                    error: `Scrape ${run.status.toLowerCase()}`
                })
            };
        }

        if (run.status === 'SUCCEEDED') {
            // Fetch the dataset
            const dataset = await client.dataset(run.defaultDatasetId).listItems();
            console.log(`Scrape succeeded: ${dataset.items.length} items found`);

            // compass/Google-Maps-Reviews-Scraper returns FLAT review objects
            // Each item has: text, stars, name (reviewer), publishedAtDate, 
            // responseFromOwnerText, placeId, title (place name), url, totalScore, 
            // address, reviewsCount, etc.
            //
            // Group reviews by place using placeId or url
            const placeMap = new Map();

            for (const item of dataset.items) {
                // The key identifier - use placeId, or fall back to url or title
                const placeKey = item.placeId || item.url || item.title || 'unknown';

                if (!placeMap.has(placeKey)) {
                    // Initialize place entry from the first review's place data
                    placeMap.set(placeKey, {
                        placeId: item.placeId || '',
                        title: item.title || item.name || 'Unknown Location',
                        address: item.address || '',
                        url: item.url || '',
                        rating: item.totalScore || 0,
                        totalReviews: item.reviewsCount || 0,
                        reviews: []
                    });
                }

                const place = placeMap.get(placeKey);

                // Each item IS a review (flat format from Reviews Scraper)
                const reviewText = item.text || item.reviewText || '';
                const stars = item.stars || item.rating || 0;

                // Only add if it has meaningful review data (stars > 0)
                if (stars > 0 || reviewText) {
                    place.reviews.push({
                        id: item.reviewId || item.id || `${placeKey}_${place.reviews.length}`,
                        text: reviewText,
                        stars: stars,
                        publishedAtDate: item.publishedAtDate || item.publishAt || '',
                        authorName: item.name || item.reviewerName || 'Anonymous',
                        authorUrl: item.reviewUrl || item.reviewerUrl || '',
                        likesCount: item.likesCount || item.likes || 0,
                        responseFromOwner: item.responseFromOwnerText || item.ownerResponse || null
                    });
                }
            }

            // Also try: items may have nested reviews[] array (crawler format)
            // Handle both formats for maximum compatibility
            for (const item of dataset.items) {
                if (item.reviews && Array.isArray(item.reviews)) {
                    const placeKey = item.placeId || item.url || item.title || 'unknown_nested';

                    if (!placeMap.has(placeKey)) {
                        placeMap.set(placeKey, {
                            placeId: item.placeId || '',
                            title: item.title || item.name || 'Unknown Location',
                            address: item.address || '',
                            url: item.url || '',
                            rating: item.totalScore || item.rating || 0,
                            totalReviews: item.reviewsCount || item.reviews.length,
                            reviews: []
                        });
                    }

                    const place = placeMap.get(placeKey);
                    for (const review of item.reviews) {
                        place.reviews.push({
                            id: review.reviewId || `${placeKey}_${place.reviews.length}`,
                            text: review.text || review.reviewText || '',
                            stars: review.stars || review.rating || 0,
                            publishedAtDate: review.publishedAtDate || review.publishAt || '',
                            authorName: review.name || review.reviewerName || 'Anonymous',
                            authorUrl: review.reviewUrl || review.reviewerUrl || '',
                            likesCount: review.likesCount || review.likes || 0,
                            responseFromOwner: review.responseFromOwnerText || review.ownerResponse || null
                        });
                    }
                }
            }

            const places = Array.from(placeMap.values());

            // AI analysis moved to client-side orchestration to avoid timeouts


            // Calculate aggregate statistics
            const allReviews = places.flatMap(p => p.reviews);
            const reviewsWithText = allReviews.filter(r => r.text && r.text.trim().length > 0);

            const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            const sentiment = { positive: 0, neutral: 0, negative: 0 };

            for (const review of allReviews) {
                const stars = review.stars || 0;
                if (stars >= 1 && stars <= 5) {
                    distribution[stars]++;

                    if (stars >= 4) sentiment.positive++;
                    else if (stars === 3) sentiment.neutral++;
                    else sentiment.negative++;
                }
            }

            const avgRating = allReviews.length > 0
                ? allReviews.reduce((sum, r) => sum + (r.stars || 0), 0) / allReviews.length
                : 0;

            // Extract keywords from all review texts
            const topKeywords = extractTopKeywords(reviewsWithText.map(r => r.text));

            const reviewsWithResponse = allReviews.filter(r =>
                r.responseFromOwner && r.responseFromOwner.trim().length > 0
            ).length;

            const results = {
                places,
                aggregateStats: {
                    totalPlaces: places.length,
                    totalReviews: allReviews.length,
                    reviewsWithText: reviewsWithText.length,
                    reviewsWithResponse,
                    avgRating: Math.round(avgRating * 10) / 10,
                    distribution,
                    sentiment: {
                        positive: sentiment.positive,
                        neutral: sentiment.neutral,
                        negative: sentiment.negative,
                        positivePercent: allReviews.length > 0 ? Math.round((sentiment.positive / allReviews.length) * 100) : 0,
                        neutralPercent: allReviews.length > 0 ? Math.round((sentiment.neutral / allReviews.length) * 100) : 0,
                        negativePercent: allReviews.length > 0 ? Math.round((sentiment.negative / allReviews.length) * 100) : 0
                    },
                    topKeywords
                }
            };

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'SUCCEEDED',
                    results
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: run.status,
                message: 'Unknown run status'
            })
        };

    } catch (error) {
        console.error('Error checking scrape status:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to check scrape status',
                message: error.message
            })
        };
    }
};

// ========================================
// Helper: Extract top keywords (with extended Italian stopwords)
// ========================================
function extractTopKeywords(texts) {
    const stopwords = new Set([
        // Articoli
        'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'l',
        // Preposizioni
        'di', 'da', 'a', 'in', 'su', 'per', 'con', 'tra', 'fra',
        'al', 'allo', 'alla', 'agli', 'alle',
        'del', 'dello', 'della', 'dei', 'degli', 'delle',
        'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
        'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
        'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
        // Congiunzioni e pronomi
        'e', 'ed', 'o', 'od', 'ma', 'però', 'anche', 'se', 'che', 'chi', 'cui',
        'quale', 'quali', 'quando', 'dove', 'come', 'perché', 'perchè',
        'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle',
        // Pronomi personali
        'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro',
        'mi', 'ti', 'si', 'ci', 'vi', 'ne', 'me', 'te', 'se', 'ce', 've',
        // Quantificatori e avverbi
        'molto', 'poco', 'più', 'meno', 'tanto', 'troppo', 'tutto', 'tutti', 'tutta', 'tutte',
        'ogni', 'ciascuno', 'alcuni', 'alcune', 'non', 'mai', 'sempre', 'già', 'ancora',
        'solo', 'proprio', 'quasi', 'circa', 'davvero', 'veramente',
        // Verbi ausiliari
        'essere', 'avere', 'fare', 'stare', 'andare', 'venire', 'dovere', 'potere', 'volere', 'sapere',
        'sono', 'è', 'ho', 'ha', 'hanno', 'era', 'erano', 'stato', 'stati', 'stata', 'state', 'fatto',
        'sia', 'siamo', 'siano', 'abbia', 'abbiano',
        // Contesto comune
        'cosa', 'cose', 'volta', 'volte', 'modo', 'parte', 'caso', 'momento',
        'punto', 'nome', 'anno', 'anni', 'giorno', 'giorni', 'ora', 'ore',
        'stesso', 'stessa', 'stessi', 'stesse',
        // English stopwords (for mixed reviews)
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can',
        'this', 'that', 'these', 'those', 'it', 'its', 'my', 'your', 'his', 'her', 'their', 'our',
        'me', 'you', 'him', 'she', 'them', 'us', 'not', 'very', 'really', 'just', 'also'
    ]);

    const wordCounts = new Map();

    for (const text of texts) {
        if (!text) continue;

        const words = text.toLowerCase()
            .replace(/[^\w\sàèéìòùáíóú]/g, ' ')
            .split(/\s+/)
            .filter(word =>
                word.length >= 4 &&
                !stopwords.has(word) &&
                !/^\d+$/.test(word) &&
                !/(.)\1{2,}/.test(word)  // Skip repeated chars
            );

        for (const word of words) {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
    }

    // Remove words appearing only once (noise)
    const filtered = Array.from(wordCounts.entries()).filter(([, count]) => count > 1);

    return filtered
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([word, count]) => ({ word, count }));
}
