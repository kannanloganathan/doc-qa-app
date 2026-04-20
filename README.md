# Document Q&A — AI-powered document assistant

Upload any PDF or text file and ask questions about it in plain English. 
Answers are grounded in the document with section citations.

**Live demo:** https://doc-qa-app-murex.vercel.app/

## Tech stack
- React + Vite (frontend)
- Vercel serverless functions (backend proxy)
- Anthropic Claude API (AI)
- PDF.js (PDF parsing)

## How it works
1. User uploads a PDF or .txt file
2. The document is split into chunks in the browser
3. Chunks are sent with the question to Claude via a serverless proxy
4. Claude returns a cited answer grounded in the document

## Running locally

1. Clone the repo
```bash
   git clone https://github.com/kannanloganathan/doc-qa-app
   cd doc-qa-app
```

2. Install dependencies
```bash
   npm install
```

3. Add your Anthropic API key
```bash
   cp .env.example .env
   # edit .env and add your key
```

4. Start the proxy and dev server (two terminals)
```bash
   node proxy.js        # terminal 1
   npm run dev          # terminal 2
```

5. Open http://localhost:5173