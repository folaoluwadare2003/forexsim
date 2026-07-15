// netlify/functions/ai-interpret.js
//
// This runs on Netlify's server, not in the browser. The OpenAI key(s) live
// only here, as environment variables you set in the Netlify dashboard —
// they are never sent to the client and never appear in index.html.
//
// Env var: OPENAI_API_KEYS
//   Either a single key, or several comma-separated keys for simple rotation
//   (spreads calls across accounts so no single key's per-minute limit gets hit
//   as fast). Example value:
//   sk-proj-aaa...,sk-proj-bbb...,sk-proj-ccc...

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const raw = process.env.OPENAI_API_KEYS || '';
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);

  if (!keys.length) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No OPENAI_API_KEYS configured in Netlify environment variables.' })
    };
  }

  // Simple rotation: pick a random key from the pool each call. Spreads load
  // across accounts; doesn't need any shared state between invocations.
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `OpenAI API error: ${errText}` })
      };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

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
