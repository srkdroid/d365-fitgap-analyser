/**
 * BPC Ingestion Pipeline
 *
 * Fetches Microsoft's D365 Business Process Catalog from GitHub,
 * chunks the Markdown documents by heading, and populates the
 * TF-IDF vector store. Results are cached to disk so subsequent
 * starts are instant.
 *
 * NO embedding API calls needed — uses TF-IDF for retrieval.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_PATH = path.resolve(__dirname, '../data/bpc-cache.json');

// ---------------------------------------------------------------------------
// GitHub URLs
// ---------------------------------------------------------------------------

const TREE_URL =
  'https://api.github.com/repos/MicrosoftDocs/dynamics365-guidance/git/trees/main?recursive=1';
const RAW_BASE =
  'https://raw.githubusercontent.com/MicrosoftDocs/dynamics365-guidance/main/';

// ---------------------------------------------------------------------------
// E2E Process → Module mapping
// ---------------------------------------------------------------------------

const MODULE_MAP = {
  'record-to-report': ['General Ledger', 'Financial Reporting'],
  'order-to-cash': ['Accounts Receivable', 'Sales'],
  'procure-to-pay': ['Accounts Payable', 'Procurement'],
  'source-to-pay': ['Accounts Payable', 'Procurement'],
  'plan-to-produce': ['Production Control', 'MRP'],
  'inventory-to-deliver': ['Warehouse Management', 'Inventory Management'],
  'acquire-to-dispose': ['Fixed Assets', 'Asset Leasing'],
  'hire-to-retire': ['Human Resources', 'Payroll'],
  'project-to-profit': ['Project Operations', 'Project Accounting'],
  'case-to-resolution': ['Customer Service'],
  'prospect-to-quote': ['Sales', 'CRM'],
  'concept-to-market': ['Product Information Management'],
  'forecast-to-plan': ['Master Planning', 'Demand Forecasting'],
  'design-to-retire': ['Engineering Change Management'],
  'service-to-cash': ['Field Service'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractE2EProcess(filePath) {
  const filename = path.basename(filePath, '.md');
  for (const key of Object.keys(MODULE_MAP)) {
    if (filename.startsWith(key) || filePath.includes(`/${key}`)) {
      return key;
    }
  }
  return filename;
}

function parseFrontmatter(md) {
  const fm = { title: '', description: '', body: md };
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return fm;

  const yaml = match[1];
  fm.body = match[2];

  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  if (titleMatch) fm.title = titleMatch[1].trim().replace(/^["']|["']$/g, '');

  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) fm.description = descMatch[1].trim().replace(/^["']|["']$/g, '');

  return fm;
}

function chunkByHeading(body) {
  const chunks = [];
  const lines = body.split(/\r?\n/);
  let currentHeading = 'Introduction';
  let currentContent = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text.length > 30) {
          chunks.push({ heading: currentHeading, content: text });
        }
      }
      currentHeading = line.replace(/^##\s+/, '').trim();
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    const text = currentContent.join('\n').trim();
    if (text.length > 30) {
      chunks.push({ heading: currentHeading, content: text });
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Main ingestion function
// ---------------------------------------------------------------------------

/**
 * Ingest the D365 Business Process Catalog into the TF-IDF vector store.
 *
 * On first run, fetches from GitHub, chunks, and caches to disk.
 * On subsequent runs, loads instantly from the cache.
 *
 * NO Gemini API calls are made — TF-IDF handles retrieval locally.
 *
 * @param {import('./vectorStore.js').VectorStore} vectorStore
 */
export async function ingestBPC(vectorStore) {
  const dataDir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // ------------------------------------------------------------------
  // 1. Check cache
  // ------------------------------------------------------------------
  if (fs.existsSync(CACHE_PATH)) {
    console.log('[bpcIngest] Loading from cache…');
    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    vectorStore.addDocuments(cached);
    console.log(`[bpcIngest] Loaded ${cached.length} chunks from cache.`);
    return;
  }

  // ------------------------------------------------------------------
  // 2. Fetch from GitHub and chunk
  // ------------------------------------------------------------------
  console.log('[bpcIngest] Fetching file tree from GitHub…');
  const treeRes = await fetch(TREE_URL, {
    headers: { 'User-Agent': 'd365-fitgap-server' },
  });

  if (!treeRes.ok) {
    throw new Error(`GitHub tree API returned ${treeRes.status}`);
  }

  const treeData = await treeRes.json();

  const mdPaths = treeData.tree
    .filter(
      (node) =>
        node.type === 'blob' &&
        node.path.startsWith('guidance/business-processes/') &&
        node.path.endsWith('.md') &&
        !node.path.includes('/media/')
    )
    .map((n) => n.path);

  console.log(`[bpcIngest] Found ${mdPaths.length} BPC markdown files.`);

  const allChunks = [];
  const FILE_BATCH_SIZE = 5;
  const FETCH_DELAY_MS = 500;

  for (let i = 0; i < mdPaths.length; i += FILE_BATCH_SIZE) {
    const batch = mdPaths.slice(i, i + FILE_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        try {
          await sleep(FETCH_DELAY_MS);
          const rawUrl = RAW_BASE + filePath;
          const res = await fetch(rawUrl, {
            headers: { 'User-Agent': 'd365-fitgap-server' },
          });
          if (!res.ok) {
            console.warn(`[bpcIngest] Skipping ${filePath} — HTTP ${res.status}`);
            return [];
          }
          const md = await res.text();
          const { title, description, body } = parseFrontmatter(md);
          const e2eProcess = extractE2EProcess(filePath);
          const modules = MODULE_MAP[e2eProcess] || [];

          const chunks = chunkByHeading(body);
          return chunks.map((chunk, idx) => ({
            id: `${filePath}#${idx}`,
            content: `${title ? `# ${title}\n` : ''}${description ? `> ${description}\n\n` : ''}${chunk.content}`,
            metadata: {
              title: title || path.basename(filePath, '.md'),
              e2eProcess,
              modules,
              section: chunk.heading,
              sourceUrl: `https://github.com/MicrosoftDocs/dynamics365-guidance/blob/main/${filePath}`,
            },
          }));
        } catch (err) {
          console.warn(`[bpcIngest] Error fetching ${filePath}:`, err.message);
          return [];
        }
      })
    );

    allChunks.push(...batchResults.flat());

    const processed = Math.min(i + FILE_BATCH_SIZE, mdPaths.length);
    console.log(
      `[bpcIngest] Ingesting BPC: ${processed}/${mdPaths.length} files processed, ${allChunks.length} chunks created`
    );
  }

  if (allChunks.length === 0) {
    console.warn('[bpcIngest] No chunks created — vector store will be empty.');
    return;
  }

  // ------------------------------------------------------------------
  // 3. Populate vector store (TF-IDF indexing happens automatically)
  // ------------------------------------------------------------------
  vectorStore.addDocuments(allChunks);
  console.log(`[bpcIngest] Vector store populated with ${vectorStore.size} chunks.`);

  // ------------------------------------------------------------------
  // 4. Save cache (text-only, no embeddings needed)
  // ------------------------------------------------------------------
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(allChunks));
    console.log('[bpcIngest] Cache saved to disk.');
  } catch (err) {
    console.warn('[bpcIngest] Could not save cache:', err.message);
  }
}
