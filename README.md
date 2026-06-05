# D365 Fit-Gap Analyser

AI-powered fit-gap analysis tool for Microsoft Dynamics 365 Finance & Operations.

## Quick Start

### Prerequisites
- Node.js 18+
- A Google Gemini API key ([Get one free from AI Studio](https://aistudio.google.com/))

### Setup

1. **Create your `.env` file** in the project root:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3001
   ```

2. **Install dependencies:**
   ```bash
   npm run install:all
   ```

3. **Start both servers:**
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

### First Run
On first startup, the server will:
1. Fetch ~182 markdown files from the D365 Business Process Catalog on GitHub
2. Chunk them into ~1,500 semantic sections
3. Embed all chunks via Gemini Embedding API (~2-3 minutes)
4. Cache everything to `server/src/data/bpc-cache.json` for instant subsequent starts

### Demo Scenario
Click **"🎯 Run Demo (10 Finance)"** to analyze 10 pre-built Finance requirements covering AP, AR, GL, Cash & Bank, and Project Accounting.

## Architecture

- **Frontend**: React 19 + Vite (port 5173)
- **Backend**: Express.js (port 3001)
- **LLM**: Google Gemini 2.5 Flash
- **Embeddings**: Gemini Embedding API (`gemini-embedding-001`)
- **Vector Store**: In-memory cosine similarity (~1,500 chunks)
- **Knowledge Base**: D365 Business Process Catalog (MIT licensed)
- **Excel Export**: ExcelJS with styled FDD template

## Classification Types

| Type | Description |
|------|------------|
| **Standard Fit** | Feature exists OOTB, needs standard configuration |
| **Configuration Gap** | Feature exists but needs significant config/setup |
| **Development Gap** | Requires X++ customization or extension |
| **Out of Scope** | Not addressable within D365FO |

## Legal

- D365 Business Process Catalog used under MIT licence — retrieval only
- **Disclaimer**: AI-assisted analysis — validate against your licensed D365FO environment
- Not claimed as Microsoft-endorsed
