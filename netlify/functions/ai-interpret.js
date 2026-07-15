// netlify/functions/ai-interpret.js
//
// This runs on Netlify's server, not in the browser. The Gemini key(s) live
// only here, as environment variables you set in the Netlify dashboard —
// they are never sent to the client and never appear in index.html.
//
// Uses Google's Gemini API free tier — no credit card, no billing required.
// Get a free key at: https://aistudio.google.com/apikey
//
// Env var: GEMINI_API_KEYS
//   Either a single key, or several comma-separated keys for simple rotation
//   (spreads calls across accounts, useful if you ever hit the free daily cap).
//   Example value:
//   AIzaSy-aaa...,AIzaSy-bbb...

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const raw = process.env.GEMINI_API_KEYS || '';
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);

  if (!keys.length) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No GEMINI_API_KEYS configured in Netlify environment variables.' })
    };
  }

  const key = keys[Math.floor(Math.random() * keys.length)];

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { prompt } = body;
  if (!prompt || typeof prompt !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing "prompt" string in request body' }) };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini API error (status ${response.status}):`, errText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Gemini API error: ${errText}` })
      };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Proxy request failed: ${e.message}` })
    };
  }
};
