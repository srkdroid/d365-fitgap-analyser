/**
 * TF-IDF Vector Store
 *
 * Lightweight text search engine using TF-IDF (Term Frequency–Inverse Document
 * Frequency) scoring. Zero external dependencies, zero API calls.
 *
 * This replaces the embedding-based vector store to avoid Gemini embedding
 * quota issues. For our use case (matching business requirements against
 * ~1,500 BPC documentation chunks), TF-IDF provides excellent retrieval
 * quality without any API costs.
 */

export class VectorStore {
  constructor() {
    /** @type {Array<{id: string, content: string, metadata: object, tfidf: Map<string, number>}>} */
    this.documents = [];

    /** @type {Map<string, number>} — document frequency: how many docs contain each term */
    this.df = new Map();

    /** @type {number} */
    this._totalDocs = 0;

    /** @type {Set<string>} — stopwords to ignore */
    this.stopwords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
      'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
      'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
      'our', 'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
      'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too',
      'very', 'just', 'about', 'above', 'after', 'again', 'also', 'any',
      'because', 'before', 'between', 'during', 'if', 'into', 'out', 'over',
      'then', 'there', 'through', 'under', 'up', 'down',
      // markdown artifacts
      'md', 'http', 'https', 'www', 'com', 'image', 'alt', 'text', 'content',
    ]);
  }

  /**
   * Tokenize and normalize a text string.
   * @param {string} text
   * @returns {string[]}
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')  // strip punctuation
      .split(/\s+/)
      .filter(t => t.length > 2 && !this.stopwords.has(t));
  }

  /**
   * Compute term frequency map for a token array.
   * @param {string[]} tokens
   * @returns {Map<string, number>}
   */
  computeTF(tokens) {
    const tf = new Map();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    // Normalize by document length
    const len = tokens.length || 1;
    for (const [term, count] of tf) {
      tf.set(term, count / len);
    }
    return tf;
  }

  /**
   * Add documents to the store and rebuild IDF.
   * Each document should have: { id, content, metadata }
   * The 'embedding' field is ignored (kept for interface compatibility).
   *
   * @param {Array<{id: string, content: string, metadata: object}>} chunks
   */
  addDocuments(chunks) {
    // First pass: tokenize and compute TF for each document
    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.content);
      const tf = this.computeTF(tokens);
      const uniqueTerms = new Set(tokens);

      this.documents.push({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata,
        tfidf: tf,
        terms: uniqueTerms,
      });

      // Update document frequency
      for (const term of uniqueTerms) {
        this.df.set(term, (this.df.get(term) || 0) + 1);
      }
    }

    this._totalDocs = this.documents.length;
    console.log(`[vectorStore] Indexed ${this._totalDocs} documents with ${this.df.size} unique terms.`);
  }

  /**
   * Search for the most relevant documents given a query string.
   *
   * @param {string} query — raw text query (NOT an embedding vector)
   * @param {number} topK — number of results to return
   * @returns {Array<{id: string, content: string, metadata: object, score: number}>}
   */
  search(query, topK = 5) {
    const queryTokens = this.tokenize(query);
    const queryTF = this.computeTF(queryTokens);

    const scores = [];

    for (const doc of this.documents) {
      let score = 0;

      for (const [term, queryWeight] of queryTF) {
        if (!doc.terms.has(term)) continue;

        const docTF = doc.tfidf.get(term) || 0;
        const docFreq = this.df.get(term) || 1;
        const idf = Math.log(1 + this._totalDocs / docFreq);

        // TF-IDF score: query TF * doc TF * IDF²
        score += queryWeight * docTF * idf * idf;
      }

      if (score > 0) {
        scores.push({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          score,
        });
      }
    }

    // Sort by score descending, return top-K
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  /**
   * Search by text query (convenience alias matching the old embedding interface).
   * The ragPipeline calls vectorStore.search(queryEmbedding, 5) — we now
   * accept a string directly.
   */

  /** @returns {number} */
  get size() {
    return this.documents.length;
  }
}
