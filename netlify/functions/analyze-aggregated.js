const { OpenAI } = require('openai');

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
            openaiApiKey,
            openaiModel = 'gpt-4o',
            reviews,
            brandName,
            totalPlaces,
            samplingEnabled = true // Default to true
        } = JSON.parse(event.body);

        if (!openaiApiKey || !reviews || !brandName) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: openaiApiKey, reviews, brandName' })
            };
        }

        const openai = new OpenAI({ apiKey: openaiApiKey });

        // Filter reviews with text
        const reviewsWithText = reviews.filter(r => r.text && r.text.trim().length > 0);

        if (reviewsWithText.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    analysis: {
                        strengths: ['Dati insufficienti'],
                        weaknesses: ['Nessuna recensione con testo'],
                        priorities: [],
                        recommendations: ['Incoraggiare recensioni testuali'],
                        suggestions: []
                    }
                })
            };
        }

        let positiveReviews, negativeReviews;
        let charLimit = 150;
        let analysisType = 'CAMPIONAMENTO (Presale)';

        if (samplingEnabled) {
            // MATCHES PYTHON APP: Sample 30 positive + 30 negative, truncate to 150 chars
            positiveReviews = reviewsWithText.filter(r => (r.stars || 0) >= 4).slice(0, 30);
            negativeReviews = reviewsWithText.filter(r => (r.stars || 0) <= 2).slice(0, 30);
        } else {
            // FULL ANALYSIS
            positiveReviews = reviewsWithText.filter(r => (r.stars || 0) >= 4);
            negativeReviews = reviewsWithText.filter(r => (r.stars || 0) <= 2);
            charLimit = 1000;
            analysisType = 'ANALISI COMPLETA';
        }

        const positiveTexts = positiveReviews.map(r => `- ${(r.text || '').substring(0, charLimit)}`).join('\n');
        const negativeTexts = negativeReviews.map(r => `- ${(r.text || '').substring(0, charLimit)}`).join('\n');

        const prompt = `Analizza queste recensioni AGGREGATE di ${totalPlaces || 'diverse'} schede Google Maps del brand "${brandName}".
MODALITÀ: ${analysisType}

Totale recensioni analizzate: ${reviews.length}
- Positive (4-5 stelle): ${reviews.filter(r => (r.stars || 0) >= 4).length}
- Negative (1-2 stelle): ${reviews.filter(r => (r.stars || 0) <= 2).length}

CAMPIONE RECENSIONI POSITIVE:
${positiveTexts || '(Nessuna recensione positiva con testo)'}

CAMPIONE RECENSIONI NEGATIVE:
${negativeTexts || '(Nessuna recensione negativa con testo)'}

Fornisci un'analisi STRATEGICA a livello BRAND in formato JSON con questi esatti campi:
1. "strengths": array di 5-8 punti di forza COMUNI a livello brand
2. "weaknesses": array di 5-8 punti di debolezza RICORRENTI a livello brand
3. "priorities": array di 3 priorità assolute da affrontare subito
4. "recommendations": array di 5-7 azioni strategiche per il brand
5. "suggestions": array di 3-5 suggerimenti tattici immediati

Concentrati su PATTERN RICORRENTI e INSIGHT STRATEGICI, non su casi singoli.
Scrivi in ITALIANO.
Rispondi SOLO con JSON valido, senza testo aggiuntivo.`;

        console.log(`Starting aggregated analysis for ${brandName} with ${reviews.length} total reviews`);

        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                {
                    role: 'system',
                    content: 'Sei un consulente strategico esperto in brand reputation e customer experience. Rispondi sempre in formato JSON valido.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2500
        });

        const analysisText = completion.choices[0].message.content.trim()
            .replace(/```json/g, '').replace(/```/g, '').trim();

        let analysis;
        try {
            analysis = JSON.parse(analysisText);
        } catch (e) {
            console.error('Failed to parse OpenAI response:', analysisText);
            throw new Error('Invalid JSON response from OpenAI');
        }

        console.log('Aggregated analysis completed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                analysis
            })
        };

    } catch (error) {
        console.error('Error in aggregated analysis:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to perform aggregated analysis',
                message: error.message
            })
        };
    }
};
