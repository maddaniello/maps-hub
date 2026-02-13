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
            openaiModel = 'gpt-4o-mini',
            placeName,
            reviews
        } = JSON.parse(event.body);

        if (!openaiApiKey || !placeName || !reviews) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: openaiApiKey, placeName, reviews' })
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
                        strengths: ['Dati insufficienti per l\'analisi'],
                        weaknesses: ['Nessuna recensione con testo disponibile'],
                        priorities: ['Incoraggiare i clienti a lasciare recensioni dettagliate'],
                        recommendations: ['Migliorare la quantità e qualità delle recensioni'],
                        suggestions: ['Implementare campagne di richiesta recensioni']
                    }
                })
            };
        }

        // OPTIMIZATION: Sample 20 positive + 20 negative, truncate to 200 chars
        // (Same approach as working reference app - saves tokens!)
        const positiveReviews = reviewsWithText.filter(r => (r.stars || 0) >= 4).slice(0, 20);
        const negativeReviews = reviewsWithText.filter(r => (r.stars || 0) <= 2).slice(0, 20);

        const positiveTexts = positiveReviews.map(r => `- ${(r.text || '').substring(0, 200)}`).join('\n');
        const negativeTexts = negativeReviews.map(r => `- ${(r.text || '').substring(0, 200)}`).join('\n');

        const prompt = `Analizza le seguenti recensioni di Google Maps per "${placeName}".

RECENSIONI POSITIVE (${positiveReviews.length} campioni):
${positiveTexts || '- Nessuna recensione positiva con testo'}

RECENSIONI NEGATIVE (${negativeReviews.length} campioni):
${negativeTexts || '- Nessuna recensione negativa con testo'}

Totale recensioni: ${reviewsWithText.length}

Fornisci un'analisi strutturata in formato JSON con:
{
  "strengths": ["3-5 punti di forza emersi dalle recensioni positive"],
  "weaknesses": ["3-5 aree di miglioramento dalle recensioni negative"],
  "priorities": ["3 priorità urgenti da affrontare"],
  "recommendations": ["3-5 raccomandazioni strategiche"],
  "suggestions": ["5-7 suggerimenti concreti e actionable"]
}

Concentrati su pattern ricorrenti. Scrivi in italiano. Rispondi SOLO con JSON valido.`;

        console.log(`Analyzing ${reviewsWithText.length} reviews for ${placeName} (${positiveReviews.length} pos, ${negativeReviews.length} neg samples)`);

        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                {
                    role: 'system',
                    content: 'Sei un esperto di analisi del sentiment e customer experience. Rispondi sempre in formato JSON valido.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1500
        });

        const analysisText = completion.choices[0].message.content.trim()
            .replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(analysisText);

        console.log('Analysis completed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                analysis
            })
        };

    } catch (error) {
        console.error('Error analyzing place:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to analyze place',
                message: error.message
            })
        };
    }
};
