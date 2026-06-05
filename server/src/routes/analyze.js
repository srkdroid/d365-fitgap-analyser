/**
 * API Routes — /api/analyze, /api/analyze/batch, /api/export
 *
 * Handles single-requirement analysis, streamed batch analysis (SSE),
 * and Excel FDD export.
 */

import { Router } from 'express';
import { analyzeRequirement } from '../services/ragPipeline.js';
import { generateFDDExcel } from '../services/excelExport.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/analyze — single requirement
// ---------------------------------------------------------------------------

router.post('/analyze', async (req, res, next) => {
  try {
    const { requirement } = req.body;

    if (!requirement || typeof requirement !== 'string' || !requirement.trim()) {
      return res.status(400).json({ error: 'requirement is required and must be a non-empty string.' });
    }

    console.log(`[analyze] Analysing: "${requirement.slice(0, 80)}…"`);

    const result = await analyzeRequirement(requirement.trim());

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/analyze/batch — batch analysis with SSE streaming
// ---------------------------------------------------------------------------

router.post('/analyze/batch', async (req, res) => {
  const { requirements } = req.body;

  if (!Array.isArray(requirements) || requirements.length === 0) {
    return res.status(400).json({ error: 'requirements must be a non-empty array of strings.' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx proxy support
  res.flushHeaders();

  console.log(`[analyze/batch] Starting batch of ${requirements.length} requirements…`);

  for (let i = 0; i < requirements.length; i++) {
    const req_text = requirements[i];

    try {
      if (!req_text || typeof req_text !== 'string' || !req_text.trim()) {
        const errorPayload = {
          index: i,
          error: 'Empty or invalid requirement — skipped.',
          requirement: req_text,
        };
        res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        continue;
      }

      console.log(`[analyze/batch] ${i + 1}/${requirements.length}: "${req_text.slice(0, 60)}…"`);

      const result = await analyzeRequirement(req_text.trim());

      const payload = { index: i, ...result };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      console.error(`[analyze/batch] Error on requirement ${i + 1}:`, err.message);
      const errorPayload = {
        index: i,
        requirement: req_text,
        error: err.message,
      };
      res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
    }
  }

  // Signal completion
  res.write('event: done\ndata: {}\n\n');
  res.end();
});

// ---------------------------------------------------------------------------
// POST /api/export — generate & download FDD Excel
// ---------------------------------------------------------------------------

router.post('/export', async (req, res, next) => {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array.' });
    }

    console.log(`[export] Generating FDD Excel for ${rows.length} rows…`);

    const buffer = await generateFDDExcel(rows);

    const filename = `D365_FitGap_Analysis_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
