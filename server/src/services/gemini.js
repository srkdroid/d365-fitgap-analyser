/**
 * Gemini API Wrapper
 *
 * Provides embedding generation and structured requirement classification
 * via the Google Generative AI SDK.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENERATION_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'gemini-embedding-001';

// Delay between embedding batches to respect rate limits (ms)
const BATCH_DELAY_MS = 2000;

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
`.trim();

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Initialise the Gemini service. Returns an object with helper methods.
 */
export function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to .env in the project root.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const generationModel = genAI.getGenerativeModel({ model: GENERATION_MODEL });
  const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  // -------------------------------------------------------------------------
  // embedText
  // -------------------------------------------------------------------------

  /**
   * Embed a single text string and return the embedding vector.
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async function embedText(text, retries = 10) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
      } catch (err) {
        const is429 = err?.status === 429 || err?.message?.includes('429');
        if (is429 && attempt < retries) {
          // Google's free tier quota limit requires a long wait (often 30s-60s)
          const waitMs = 60000;
          console.warn(`[gemini] Quota limited (429). Retry ${attempt}/${retries} in 60s…`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        console.error('[gemini] embedText error:', err.message);
        throw err;
      }
    }
  }

  // -------------------------------------------------------------------------
  // embedBatch
  // -------------------------------------------------------------------------

  /**
   * Embed an array of texts in small sequential batches with generous delays
   * to stay within Gemini API rate limits.
   *
   * @param {string[]} texts
   * @param {number}   batchSize  — texts per batch (default 5)
   * @returns {Promise<number[][]>}
   */
  async function embedBatch(texts, batchSize = 5) {
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Process sequentially within each batch to avoid concurrent 429s
      const batchResults = [];
      for (const t of batch) {
        const emb = await embedText(t);
        batchResults.push(emb);
      }
      allEmbeddings.push(...batchResults);

      const processed = Math.min(i + batchSize, texts.length);
      console.log(`[gemini] Embedded ${processed}/${texts.length} texts`);

      // Delay before next batch (skip after last batch)
      if (i + batchSize < texts.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    return allEmbeddings;
  }

  // -------------------------------------------------------------------------
  // classifyRequirement
  // -------------------------------------------------------------------------

  /**
   * Classify a business requirement using Gemini generation, enriched with
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

    try {
      const result = await generationModel.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Strip markdown fences if the model adds them anyway
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');

      return JSON.parse(cleaned);
    } catch (err) {
      console.error('[gemini] classifyRequirement error:', err.message);
      throw err;
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
