const { ApifyClient } = require('apify-client');
const fetch = require('node-fetch');

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
            openaiModel = 'gpt-4-turbo-preview'
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

            // Group reviews by place
            const placeMap = new Map();

            for (const item of dataset.items) {
                if (!item.reviews || !Array.isArray(item.reviews)) continue;

                const placeId = item.placeId || item.url?.match(/ChIJ[a-zA-Z0-9_-]+/)?.[0] || 'unknown';

                if (!placeMap.has(placeId)) {
                    placeMap.set(placeId, {
                        placeId,
                        title: item.title || item.name || 'Unknown Location',
                        address: item.address || '',
                        url: item.url || '',
                        rating: item.totalScore || item.rating || 0,
                        totalReviews: item.reviewsCount || item.reviews.length,
                        reviews: []
                    });
                }

                const place = placeMap.get(placeId);

                // Add reviews
                for (const review of item.reviews) {
                    place.reviews.push({
                        id: review.reviewId || `${placeId}_${place.reviews.length}`,
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

            const places = Array.from(placeMap.values());

            // Perform AI analysis if enabled
            if (aiEnabled && openaiApiKey && places.length > 0) {
                console.log(`Starting AI analysis for ${places.length} places...`);

                const analyzeUrl = `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers.host}/.netlify/functions/analyze-place`;

                // Parallel AI analysis for all places
                const analysisPromises = places.map(async (place) => {
                    try {
                        const response = await fetch(analyzeUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                openaiApiKey,
                                openaiModel,
                                placeName: place.title,
                                reviews: place.reviews
                            })
                        });

                        const result = await response.json();
                        if (result.success && result.analysis) {
                            place.analysis = result.analysis;
                        }
                    } catch (error) {
                        console.error(`Failed to analyze ${place.title}:`, error.message);
                        place.analysis = null;
                    }
                });

                await Promise.all(analysisPromises);
                console.log('AI analysis completed');
            }

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
                        positivePercent: Math.round((sentiment.positive / allReviews.length) * 100) || 0,
                        neutralPercent: Math.round((sentiment.neutral / allReviews.length) * 100) || 0,
                        negativePercent: Math.round((sentiment.negative / allReviews.length) * 100) || 0
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

// Helper function to extract top keywords
function extractTopKeywords(texts) {
    // Italian stopwords
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
        'your', 'his', 'her', 'their', 'our', 'me', 'you', 'him', 'she', 'them', 'us', 'non', 'mi',
        'ti', 'ci', 'vi', 'si', 'ne', 'del', 'della', 'dei', 'delle', 'dal', 'dalla', 'dai', 'dalle',
        'nel', 'nella', 'nei', 'nelle', 'sul', 'sulla', 'sui', 'sulle', 'al', 'alla', 'ai', 'alle'
    ]);

    const wordCounts = new Map();

    for (const text of texts) {
        if (!text) continue;

        const words = text.toLowerCase()
            .replace(/[^\w\sàèéìòù]/g, ' ')
            .split(/\s+/)
            .filter(word =>
                word.length >= 4 &&
                !stopwords.has(word) &&
                !/^\d+$/.test(word)
            );

        for (const word of words) {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
    }

    return Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([word, count]) => ({ word, count }));
}
