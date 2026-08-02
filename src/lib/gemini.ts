/**
 * DARLEK CAAN — Gemini API Utility
 *
 * Shared Gemini-only LLM calling utility.
 * All external LLM calls route through this module.
 * The Dalek Brain requires nothing external. This is optional augmentation.
 * Includes automated fallback and exponential backoff retry systems.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_CANDIDATES = [
  'gemini-3.5-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.5-pro'
];

class ConcurrencyLimiter {
  private activeCount = 0;
  private queue: (() => void)[] = [];
  private maxConcurrency: number;

  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  async acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release() {
    this.activeCount--;
    if (this.queue.length > 0) {
      this.activeCount++;
      const next = this.queue.shift();
      if (next) {
        // Space out requests slightly to give the endpoint rate limit some breathing room
        setTimeout(() => next(), 250);
      }
    }
  }
}

const limiter = new ConcurrencyLimiter(1);

async function callGeminiWithRetry(
  apiKey: string,
  body: Record<string, unknown>,
  maxRetries = 2
): Promise<any> {
  await limiter.acquire();
  try {
    let lastError: Error | null = null;

    for (const model of MODEL_CANDIDATES) {
      let attempt = 0;
      const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      while (attempt <= maxRetries) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            const data = await res.json();
            if (data) {
              console.log(`[Gemini API] Successfully generated content using model: ${model}`);
              return data;
            }
          }

          const status = res.status;
          const errText = await res.text();
          const errorMsg = `Gemini API error ${status} on model ${model}: ${errText}`;
          const currentError = new Error(errorMsg);

          // If unauthorized or forbidden or invalid API key, stop the entire candidate loop immediately!
          const isAuthError =
            status === 401 ||
            status === 403 ||
            (status === 400 &&
              (errText.includes('API_KEY_INVALID') ||
                errText.includes('API key not valid') ||
                errText.includes('invalid API key') ||
                errText.includes('key is not valid') ||
                errText.includes('key is invalid')));
          if (isAuthError) {
            console.warn(`[Gemini API] Auth/Key validation error ${status} on ${model} — aborting all candidates.`);
            throw new Error(`Auth error: ${errorMsg}`);
          }

          // If location is geoblocked, stop immediately! Avoid wasting quota on other candidates.
          const isGeoblockError =
            status === 400 &&
            (errText.includes('location is not supported') ||
              errText.includes('Location is not supported') ||
              errText.includes('location') ||
              errText.includes('FAILED_PRECONDITION'));
          if (isGeoblockError) {
            console.warn(`[Gemini API] Geoblock restriction detected on ${model} — aborting all candidates.`);
            throw new Error(`Geoblock error: location is not supported`);
          }

          // If rate limited with quota exceeded, log warning and let it fall back normally to next models
          const isQuotaExceeded =
            status === 429 &&
            (errText.includes('Quota exceeded') ||
              errText.includes('quota exceeded') ||
              errText.includes('exceeded your current quota') ||
              errText.includes('limit: 0'));
          if (isQuotaExceeded) {
            console.warn(`[Gemini API] Quota/Usage exceeded on ${model} — falling back to remaining candidates.`);
          }

          // If rate limited, fall back to the next model candidate immediately without slow retries!
          if (status === 429) {
            console.log(`[Gemini API] Rate limited (429) or quota exceeded on ${model}. Falling back to next candidate model.`);
            lastError = currentError;
            break;
          }

          // If 404 (model not found/deprecated), log it and break to try the next candidate
          if (status === 404) {
            console.log(`[Gemini API] Model ${model} returned 404 (not found). Skipped.`);
            if (!lastError || !lastError.message.includes('429')) {
              lastError = currentError;
            }
            break;
          }

          // Any other error (e.g. 5xx)
          if (!lastError || lastError.message.includes('404')) {
            lastError = currentError;
          }

          if (status >= 500) {
            attempt++;
            if (attempt <= maxRetries) {
              const delay = Math.pow(2.0, attempt) * 1000 + Math.random() * 200;
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
          }
          break;
        } catch (err) {
          const caughtErr = err instanceof Error ? err : new Error(String(err));
          if (
            caughtErr.message.includes('Auth error') ||
            caughtErr.message.includes('Geoblock error')
          ) {
            throw caughtErr;
          }
          if (!lastError || lastError.message.includes('404')) {
            lastError = caughtErr;
          }
          attempt++;
          if (attempt <= maxRetries) {
            const delay = Math.pow(2.0, attempt) * 1000 + Math.random() * 200;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          break;
        }
      }

      console.log(`[Gemini API] Info: Candidate model ${model} skipped or currently busy.`);
    }

    throw lastError || new Error('All Gemini model candidates failed.');
  } finally {
    limiter.release();
  }
}

export async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  apiKey: string,
  options?: { maxTokens?: number; temperature?: number; responseMimeType?: string; responseSchema?: unknown }
): Promise<string | null> {
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: options?.temperature ?? 0.6,
      maxOutputTokens: options?.maxTokens ?? 8192,
      responseMimeType: options?.responseMimeType,
      responseSchema: options?.responseSchema,
    },
  };

  const data = await callGeminiWithRetry(apiKey, body);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export async function callGeminiMultiTurn(
  systemInstruction: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  apiKey: string,
  options?: { maxTokens?: number; temperature?: number; responseMimeType?: string; responseSchema?: unknown }
): Promise<string | null> {
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: options?.temperature ?? 0.6,
      maxOutputTokens: options?.maxTokens ?? 8192,
      responseMimeType: options?.responseMimeType,
      responseSchema: options?.responseSchema,
    },
  };

  const data = await callGeminiWithRetry(apiKey, body);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}
