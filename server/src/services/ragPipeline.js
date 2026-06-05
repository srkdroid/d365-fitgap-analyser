/**
 * RAG Pipeline — Orchestrates retrieval-augmented generation
 *
 * 1. Embeds the user's requirement
 * 2. Retrieves the top-K most relevant BPC chunks from the vector store
 * 3. Calls Gemini for classification
 * 4. Enriches the result with source references and ISV suggestions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Module-scoped references (set via initRAGPipeline)
// ---------------------------------------------------------------------------

/** @type {import('./vectorStore.js').VectorStore} */
let _vectorStore;

/** @type {ReturnType<import('./gemini.js').initGemini>} */
let _gemini;

/** ISV catalog loaded once at init time */
let _isvCatalog = [];

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise the RAG pipeline with shared service references.
 *
 * @param {import('./vectorStore.js').VectorStore} vectorStore
 * @param {ReturnType<import('./gemini.js').initGemini>} geminiService
 */
export function initRAGPipeline(vectorStore, geminiService) {
  _vectorStore = vectorStore;
  _gemini = geminiService;

  // Load ISV catalog
  try {
    const catalogPath = path.resolve(__dirname, '../data/isv-catalog.json');
    _isvCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    console.log(`[ragPipeline] Loaded ${_isvCatalog.length} ISV entries.`);
  } catch (err) {
    console.warn('[ragPipeline] Could not load ISV catalog:', err.message);
    _isvCatalog = [];
  }
}

// ---------------------------------------------------------------------------
// ISV matching helper
// ---------------------------------------------------------------------------

/**
 * Search the ISV catalog for entries whose area or modules overlap with the
 * classification result.
 */
function findRelevantISVs(classification) {
  if (!_isvCatalog.length) return [];

  const moduleLower = (classification.module || '').toLowerCase();
  const subProcessLower = (classification.subProcess || '').toLowerCase();
  const recommendationLower = (classification.recommendation || '').toLowerCase();

  return _isvCatalog.filter((isv) => {
    const areaLower = isv.area.toLowerCase();
    const modulesLower = isv.modules.map((m) => m.toLowerCase());
    const descLower = (isv.description || '').toLowerCase();

    // Check if the ISV's area/modules overlap with the classification
    const areaMatch =
      moduleLower.includes(areaLower) ||
      subProcessLower.includes(areaLower) ||
      recommendationLower.includes(areaLower);

    const moduleMatch = modulesLower.some(
      (m) =>
        moduleLower.includes(m) ||
        subProcessLower.includes(m) ||
        recommendationLower.includes(m)
    );

    // Also check reverse: ISV description mentions the classified module
    const descMatch =
      descLower.includes(moduleLower) || descLower.includes(subProcessLower);

    return areaMatch || moduleMatch || descMatch;
  });
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyse a single business requirement through the full RAG pipeline.
 *
 * @param {string} requirementText
 * @returns {Promise<object>} — enriched classification result
 */
export async function analyzeRequirement(requirementText) {
  if (!_vectorStore || !_gemini) {
    throw new Error('RAG pipeline not initialised. Call initRAGPipeline() first.');
  }

  // 1. Retrieve top-5 relevant BPC chunks via TF-IDF text search
  const topChunks = _vectorStore.search(requirementText, 5);

  // 3. Classify via Gemini with context
  const contextChunks = topChunks.map((c) => ({
    content: c.content,
    metadata: c.metadata,
  }));

  const classification = await _gemini.classifyRequirement(
    requirementText,
    contextChunks
  );

  // 4. Build source references from retrieved chunks
  const sources = topChunks.map((c) => ({
    title: c.metadata?.title || 'Unknown',
    section: c.metadata?.section || '',
    e2eProcess: c.metadata?.e2eProcess || '',
    sourceUrl: c.metadata?.sourceUrl || '',
    relevanceScore: Math.round(c.score * 100) / 100,
  }));

  // 5. Enrich with ISV suggestions
  const relevantISVs = findRelevantISVs(classification);
  const isvSuggestions = relevantISVs.map((isv) => ({
    name: isv.name,
    area: isv.area,
    description: isv.description,
  }));

  // If Gemini didn't suggest an ISV but we found relevant ones, add the top match
  if (!classification.isvSuggestion && isvSuggestions.length > 0) {
    classification.isvSuggestion = isvSuggestions[0].name;
  }

  // 6. Return enriched result
  return {
    requirement: requirementText,
    ...classification,
    sources,
    isvSuggestions,
  };
}
