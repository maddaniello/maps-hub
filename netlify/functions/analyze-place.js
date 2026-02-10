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
            openaiModel = 'gpt-4-turbo-preview',
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

        // Limit to 50 most recent reviews with text
        const reviewsWithText = reviews
            .filter(r => r.text && r.text.trim().length > 0)
            .slice(0, 50);

        if (reviewsWithText.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    analysis: {
                        strengths: ['Insufficient review data'],
                        weaknesses: ['No text reviews available for analysis'],
                        priorities: ['Encourage customers to leave detailed reviews'],
                        recommendations: ['Focus on improving review quantity and quality'],
                        suggestions: ['Implement review request campaigns']
                    }
                })
            };
        }

        // Construct review text for analysis
        const reviewTexts = reviewsWithText.map((r, i) =>
            `Review ${i + 1} (${r.stars} stars): ${r.text}`
        ).join('\n\n');

        const prompt = `Analyze the following Google Maps reviews for "${placeName}".

Provide a structured JSON response with:
{
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "priorities": ["top priority 1", "top priority 2", "top priority 3"],
  "recommendations": ["strategic recommendation 1", "strategic recommendation 2", ...],
  "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2", ...]
}

IMPORTANT GUIDELINES:
- Identify 3-5 key strengths mentioned repeatedly in positive reviews
- Identify 3-5 key weaknesses mentioned in negative reviews
- Provide EXACTLY 3 top priorities (most urgent issues to address)
- Give 3-5 strategic recommendations for improvement
- Provide 5-7 concrete, actionable suggestions
- Focus on patterns and recurring themes
- Be specific and data-driven
- Write in Italian if reviews are in Italian, otherwise in English

Reviews (${reviewTexts.length} total):

${reviewTexts}`;

        console.log(`Analyzing ${reviewsWithText.length} reviews for ${placeName}`);

        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert business analyst specializing in customer feedback analysis. Provide structured, actionable insights from Google Maps reviews.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 2000
        });

        const analysisText = completion.choices[0].message.content;
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
