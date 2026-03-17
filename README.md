# Ankoryn POC (OpenAI + Gemini)

This is a minimal proof-of-concept for **persistent memory across models**:
- Uses **OpenAI** for chat + embeddings (semantic memory)
- Uses **Gemini** for chat via a **server-side API route** (so the key is not exposed)
- Stores memory locally in the browser via **IndexedDB**

## 1) Requirements
- Node.js 18+

## 2) Install
```bash
npm install
```

## 3) Add Gemini Key (server-side)
Create a file called `.env.local` in the project root:

```bash
GEMINI_API_KEY=PASTE_YOUR_GEMINI_KEY
```

Then restart the dev server if it was running.

## 4) Run
```bash
npm run dev
```
Open:
http://localhost:3000

## 5) Add OpenAI Key (client-side BYOL)
In the app UI, paste your OpenAI API key into the "OpenAI Key" field and click **Save Key**.
This stores the key in your browser's localStorage for this POC.

## 6) How to test cross-model continuity
1. Choose **OpenAI** model in dropdown
2. Provide project context (e.g., product name + pricing + target market)
3. Ask 1–2 unrelated questions
4. Switch dropdown to **Gemini**
5. Ask: "What was my pricing model again?"

If Gemini answers correctly, you've proven **cross-model context continuity**.

## Notes
- This is a POC. Do not use this key storage approach for production.
- For production: encrypted storage, optional backend sync, and key vault patterns.
