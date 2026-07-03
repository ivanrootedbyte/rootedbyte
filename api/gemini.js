export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    const body = req.body || {};
    const prompt = body.prompt;
    const wantsJson = Boolean(body.json);
    const temperature =
      typeof body.temperature === 'number' ? body.temperature : 0.35;
    const maxOutputTokens =
      typeof body.maxOutputTokens === 'number' ? body.maxOutputTokens : 1200;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Missing prompt.'
      });
    }

    const model = 'gemini-2.5-flash';

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(geminiUrl, {
      method: 'POST',
      signal: controller.signal,
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
          temperature,
          topP: 0.85,
          topK: 40,
          maxOutputTokens,
          responseMimeType: wantsJson ? 'application/json' : 'text/plain'
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      })
    });

    clearTimeout(timeout);

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error: 'Gemini returned a non-JSON response.'
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: 'Gemini request failed.',
        details: data
      });
    }

    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text
        ? data.candidates[0].content.parts[0].text
        : '';

    if (!text) {
      return res.status(502).json({
        ok: false,
        error: 'Gemini returned an empty response.',
        details: data
      });
    }

    return res.status(200).json({
      ok: true,
      data,
      text
    });
  } catch (error) {
    const isAbort = error && error.name === 'AbortError';

    return res.status(isAbort ? 504 : 500).json({
      ok: false,
      error: isAbort
        ? 'Gemini request timed out.'
        : 'Server error while calling Gemini.'
    });
  }
}
