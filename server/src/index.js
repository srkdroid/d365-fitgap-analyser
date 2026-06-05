/**
 * D365 Fit-Gap Analyser — Express Server Entry Point
 *
 * Boots up the Express server, loads the BPC vector store on startup,
 * and mounts all API routes.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initGemini } from './services/gemini.js';
import { VectorStore } from './services/vectorStore.js';
import { ingestBPC } from './services/bpcIngest.js';
import { initRAGPipeline } from './services/ragPipeline.js';
import analyzeRouter from './routes/analyze.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (one level above /server)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const app = express();

// Middleware
const isProduction = process.env.NODE_ENV === 'production';
app.use(cors(isProduction ? {} : { origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

// Shared instances
const vectorStore = new VectorStore();
let geminiService;

/**
 * Initialise all services and start listening.
 */
async function boot() {
  try {
    console.log('============================================');
    console.log('  D365 Fit-Gap Analyser — Server Starting');
    console.log('============================================');

    // 1. Gemini SDK
    console.log('[boot] Initialising Gemini SDK…');
    geminiService = initGemini();
    console.log('[boot] Gemini SDK ready.');

    // 2. BPC ingestion → vector store
    console.log('[boot] Ingesting D365 Business Process Catalog…');
    await ingestBPC(vectorStore);
    console.log(`[boot] Vector store populated — ${vectorStore.size} chunks loaded.`);

    // 3. RAG pipeline
    initRAGPipeline(vectorStore, geminiService);
    console.log('[boot] RAG pipeline initialised.');

    // -----------------------------------------------------------------------
    // Routes
    // -----------------------------------------------------------------------

    // Health check
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', chunksLoaded: vectorStore.size });
    });

    // Analysis / export routes
    app.use('/api', analyzeRouter);

    // -----------------------------------------------------------------------
    // Serve React static build in production
    // -----------------------------------------------------------------------
    if (isProduction) {
      const clientDist = path.resolve(__dirname, '../../client/dist');
      app.use(express.static(clientDist));

      // SPA fallback — serve index.html for any non-API route
      app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
      });
      console.log('[boot] Serving React build from', clientDist);
    }

    // -----------------------------------------------------------------------
    // Global error handler
    // -----------------------------------------------------------------------

    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => {
      console.error('[error]', err.stack || err.message || err);
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
      });
    });

    // -----------------------------------------------------------------------
    // Listen
    // -----------------------------------------------------------------------

    app.listen(PORT, () => {
      console.log('--------------------------------------------');
      console.log(`  Server listening on http://localhost:${PORT}`);
      console.log(`  Health check:  GET /api/health`);
      console.log(`  Chunks loaded: ${vectorStore.size}`);
      console.log('--------------------------------------------');
    });
  } catch (err) {
    console.error('[boot] Fatal error during startup:', err);
    process.exit(1);
  }
}

boot();
