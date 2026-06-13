export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: 'Gemini API key is not configured.'
    });
  }

  try {
    const { prompt, json, temperature, maxOutputTokens } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Missing prompt.'
      });
    }

    const model = 'gemini-2.5-flash';
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: typeof temperature === 'number' ? temperature : 0.45,
          topP: 0.85,
          topK: 40,
          maxOutputTokens: maxOutputTokens || 1200,
          responseMimeType: json ? 'application/json' : 'text/plain'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: 'Gemini request failed.',
        details: data
      });
    }

    return res.status(200).json({
      ok: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Server error while calling Gemini.'
    });
  }
}