/**
 * LLM Classification Service
 *
 * Uses Groq (Llama 3.3 70B) for structured requirement classification.
 * Groq free tier: 30 RPM, 14,400 RPD — no more rate-limit pain.
 *
 * The public API (initGemini, classifyRequirement) is kept unchanged
 * so no other files need modification.
 */

import Groq from 'groq-sdk';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Retry config for transient errors (429/503)
const MAX_CLASSIFY_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 3000; // 3s, then 6s, then 12s

// ---------------------------------------------------------------------------
// Classification prompt template
// ---------------------------------------------------------------------------

const CLASSIFICATION_PROMPT = `
You are a Microsoft Dynamics 365 Finance & Operations Solution Architect with deep expertise across all D365FO modules.

Given a business requirement and relevant D365 Business Process Catalog documentation (provided as context), analyze and classify the requirement.

CONTEXT FROM D365 BUSINESS PROCESS CATALOG:
{CONTEXT}

BUSINESS REQUIREMENT:
{REQUIREMENT}

Respond with a JSON object (no markdown fencing):
{
  "module": "Primary D365FO module name (e.g., General Ledger, Accounts Payable, etc.)",
  "subProcess": "Specific sub-process or feature area within the module",
  "gapType": "Standard Fit | Configuration Gap | Development Gap | Out of Scope",
  "recommendation": "Concise recommendation on how to address this requirement in D365FO (2-3 sentences)",
  "configSteps": ["Step 1...", "Step 2...", "Step 3..."],
  "workaround": "Standard workaround if this is a gap (null if Standard Fit)",
  "isvSuggestion": "Known ISV solution name if applicable (null if not needed)",
  "effort": "S | M | L",
  "priority": "High | Medium | Low",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this classification was chosen"
}

CLASSIFICATION RULES:
- Standard Fit: Feature exists out-of-the-box in D365FO, needs only standard configuration
- Configuration Gap: Feature exists but requires significant configuration, setup, or parameter tuning beyond defaults
- Development Gap: Feature requires X++ customization, extension development, or Power Platform integration
- Out of Scope: Not addressable within the D365FO ecosystem

EFFORT ESTIMATION:
- S (Small): < 3 person-days, standard config or minor adjustment
- M (Medium): 3-10 person-days, significant configuration or moderate customization
- L (Large): > 10 person-days, major development or complex integration

IMPORTANT: Base your classification primarily on the provided D365 documentation context. If the context doesn't cover the requirement well, use your training knowledge but lower the confidence score.

You MUST respond with ONLY the JSON object. No explanation, no markdown, no code fences.
`.trim();

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Initialise the LLM service. Returns an object with helper methods.
 * Function name kept as initGemini for backward compatibility.
 */
export function initGemini() {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY (or GEMINI_API_KEY) is not set. Add it to .env in the project root.'
    );
  }

  const groq = new Groq({ apiKey });

  // -------------------------------------------------------------------------
  // embedText / embedBatch — stubs (not used with TF-IDF vector store)
  // -------------------------------------------------------------------------

  async function embedText() {
    throw new Error('Embedding not available via Groq. Use the TF-IDF vector store instead.');
  }

  async function embedBatch() {
    throw new Error('Embedding not available via Groq. Use the TF-IDF vector store instead.');
  }

  // -------------------------------------------------------------------------
  // classifyRequirement
  // -------------------------------------------------------------------------

  /**
   * Classify a business requirement using Groq (Llama 3.3 70B), enriched with
   * RAG context chunks from the BPC vector store.
   *
   * @param {string}   requirement   — raw requirement text
   * @param {object[]} contextChunks — retrieved BPC chunks ({ content, metadata })
   * @returns {Promise<object>}       — parsed classification JSON
   */
  async function classifyRequirement(requirement, contextChunks = []) {
    const contextBlock = contextChunks.length
      ? contextChunks
          .map(
            (c, i) =>
              `--- Chunk ${i + 1} (${c.metadata?.title || 'Untitled'} › ${c.metadata?.section || 'N/A'}) ---\n${c.content}`
          )
          .join('\n\n')
      : '(No specific documentation context available — rely on training knowledge and lower confidence.)';

    const prompt = CLASSIFICATION_PROMPT
      .replace('{CONTEXT}', contextBlock)
      .replace('{REQUIREMENT}', requirement);

    for (let attempt = 1; attempt <= MAX_CLASSIFY_RETRIES; attempt++) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a JSON-only assistant. Respond with valid JSON, no markdown, no explanation.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        });

        const responseText = chatCompletion.choices[0]?.message?.content?.trim();

        if (!responseText) {
          throw new Error('Empty response from Groq');
        }

        // Strip markdown fences if the model adds them anyway
        const cleaned = responseText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '');

        return JSON.parse(cleaned);
      } catch (err) {
        const status = err?.status || err?.statusCode;
        const isRetryable = status === 429 || status === 503 ||
          err?.message?.includes('429') || err?.message?.includes('503') ||
          err?.message?.includes('rate_limit') || err?.message?.includes('overloaded');

        if (isRetryable && attempt < MAX_CLASSIFY_RETRIES) {
          const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[llm] Retryable error (${status || 'unknown'}). Retry ${attempt}/${MAX_CLASSIFY_RETRIES} in ${delayMs / 1000}s…`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        console.error('[llm] classifyRequirement error:', err.message);
        throw err;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    embedText,
    embedBatch,
    classifyRequirement,
  };
}
