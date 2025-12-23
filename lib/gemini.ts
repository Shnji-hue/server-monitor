// lib/gemini.ts (server-only wrapper using official SDK)
import { GoogleGenerativeAI } from '@google/generative-ai';

const KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!KEY) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY');

const genAI = new GoogleGenerativeAI(KEY);

// configurable model - allow override via env for testing/fallback
const DEFAULT_MODEL = process.env.GOOGLE_GENERATIVE_AI_MODEL || 'text-bison-001';

export async function generateResponseFromGemini(systemPrompt: string, userMessage: string) {
  const modelName = process.env.GOOGLE_GENERATIVE_AI_MODEL || DEFAULT_MODEL;
  // Use the SDK's model accessor (may differ across versions)
  // Wrap in try/catch below if SDK doesn't expose specified model
  let model: any;
  try {
    model = genAI.getGenerativeModel({ model: modelName });
  } catch (err) {
    // if SDK fails to get the model, set model undefined and fall back to REST
    model = undefined;
  }

  const prompt = `${systemPrompt}\nUser: ${userMessage}`;
  // log which model we're attempting
  // eslint-disable-next-line no-console
  console.info('[gemini] using model:', modelName);

  // Helper to normalize various SDK responses
  function extractText(result: any) {
    if (!result) return '';

    // Common nested shapes we've observed (probe all):
    // 1) result.response.candidates[0].content.parts[0].text
    // 2) result.candidates[0].content.parts[0].text
    // 3) result.output[0].content[0].parts[0].text or similar
    // 4) result.response.text
    // 5) result.candidates[0].content (string)
    // 6) result.output[0].content (string)
    // 7) result.result (string)

    const nestedPaths = [
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text,
      result?.candidates?.[0]?.content?.parts?.[0]?.text,
      result?.output?.[0]?.content?.[0]?.parts?.[0]?.text,
      result?.response?.text,
      result?.candidates?.[0]?.content,
      result?.output?.[0]?.content,
      result?.result,
    ];

    for (const t of nestedPaths) if (typeof t === 'string' && t.length) return t.trim();

    // Sometimes SDK returns content as array of parts (no deep nesting)
    const tryParts = (obj: any) => {
      if (!obj) return null;
      if (Array.isArray(obj?.parts) && obj.parts[0]?.text) return obj.parts[0].text;
      if (Array.isArray(obj) && obj[0]?.parts && obj[0].parts[0]?.text) return obj[0].parts[0].text;
      return null;
    };

    const candidates = [
      tryParts(result?.response?.candidates?.[0]?.content),
      tryParts(result?.candidates?.[0]?.content),
      tryParts(result?.output?.[0]?.content?.[0]),
    ];
    for (const t of candidates) if (typeof t === 'string' && t.length) return t.trim();

    // If result is plain string, return it
    if (typeof result === 'string' && result.length) return result.trim();

    // Last resort: if object contains only a text-ish property anywhere, try to find it
    try {
      const jsonText = JSON.stringify(result);
      return jsonText;
    } catch (e) {
      return '';
    }
  }

  // Discover available methods on the model (if SDK returned one)
  const methodNames = model ? Object.keys(model).filter((k) => typeof (model as any)[k] === 'function') : [];
  // Log methods for debugging (server-side only)
  // eslint-disable-next-line no-console
  console.info('[gemini] model methods available:', methodNames);

  // Prioritized list of method names to try, supplemented by discovered methods
  const preferred = ['generateContent', 'generateText', 'generate', 'predict', 'invoke', 'call'];
  const toTry = Array.from(new Set([...preferred, ...methodNames]));

  // Candidate argument shapes to try for each method
  const argShapes = [
    { prompt },
    { prompt: { text: prompt } },
    prompt,
    { input: prompt },
    [{ prompt }],
  ];

  let lastErr: any = null;

  for (const method of toTry) {
    for (const args of argShapes) {
      try {
        const fn = (model as any)[method];
        if (typeof fn !== 'function') continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await fn.call(model, args as any);
        const resolved = await res;
        const text = extractText(resolved);
        if (text) {
          // eslint-disable-next-line no-console
          console.info('[gemini] success using method:', method);
          return text;
        }
      } catch (err) {
        lastErr = err;
        // continue trying other shapes/methods
      }
    }
  }

  const methodsMsg = JSON.stringify(methodNames.slice(0, 10));
  const errMsg = lastErr ? String(lastErr?.message ?? lastErr) : 'No compatible SDK method succeeded';

  // REST fallback: try v1 generateContent with several valid payload shapes
  try {
    // eslint-disable-next-line no-console
    console.info('[gemini] attempting REST fallback to v1 generateContent with multiple payload shapes using model:', modelName);
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent`;

    const tries = [
      // common content/parts with type
      { contents: [{ mime_type: 'text/plain', parts: [{ type: 'text', text: prompt }] }], temperature: 0.2, max_output_tokens: 300 },
      // alternative shape: content array
      { content: [{ type: 'text', text: prompt }], temperature: 0.2, max_output_tokens: 300 },
      // another alternative: input.text
      { input: { text: prompt }, temperature: 0.2, max_output_tokens: 300 },
      // minimal flat content
      { contents: [{ mime_type: 'text/plain', parts: [{ text: prompt }] }], temperature: 0.2, max_output_tokens: 300 },
    ];

    let lastBody: any = null;
    for (const body of tries) {
      try {
        lastBody = body;

        // Try with Authorization Bearer header
        let res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        let j = await res.json().catch(() => null);

        if (!res.ok) {
          // If header auth failed, try with ?key=APIKEY as query param
          // eslint-disable-next-line no-console
          console.warn('[gemini] REST attempt with Bearer failed', { status: res.status, body: j });
          const urlWithKey = `${url}?key=${KEY}`;
          res = await fetch(urlWithKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          j = await res.json().catch(() => null);
        }

        if (res.ok) {
          // Try different response shapes
          const outText = j?.candidates?.[0]?.output?.content?.[0]?.parts?.[0]?.text || j?.output?.[0]?.content?.[0]?.parts?.[0]?.text || j?.candidates?.[0]?.content || j?.output?.[0]?.content || j?.result || (typeof j === 'string' ? j : null);
          if (outText && typeof outText === 'string') return outText.trim();
          // If no text but ok, return full JSON as fallback
          return JSON.stringify(j);
        } else {
          // Log and try next shape
          // eslint-disable-next-line no-console
          console.warn('[gemini] REST attempt failed', { status: res.status, body: j });
          if (res.status === 401) throw new Error('Unauthorized: check GOOGLE_GENERATIVE_AI_API_KEY permissions and billing.');
          if (res.status === 404) throw new Error(`Model not found: ${modelName}. Check whether the model name is correct and your API key has access.`);
          // continue to next attempt for other 4xx/5xx
        }
      } catch (e) {
        lastErr = e;
        // continue to next body
      }
    }

    // If no REST attempt succeeded
    throw new Error(`REST fallback error: all payload attempts failed. lastBody: ${JSON.stringify(lastBody)}, lastErr: ${String(lastErr?.message ?? lastErr)}`);
  } catch (restErr) {
    // If both SDK attempts and REST fallback failed, add dev-friendly canned response option
    const finalMsg = `Gemini SDK error (all attempts failed). Methods: ${methodsMsg}; lastError: ${errMsg}; REST fallback: ${String(
      restErr?.message ?? restErr
    )}`;
    // eslint-disable-next-line no-console
    console.error('[gemini] final error:', finalMsg);

    // Dev fallback: return canned response when no API access (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[gemini] returning dev canned response due to failed AI calls');
      return 'Demo: Server adalah kumpulan perangkat keras dan perangkat lunak yang menyediakan layanan kepada klien.';
    }

    throw new Error(finalMsg);
  }
}
