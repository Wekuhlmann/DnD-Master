# Relic Press

Local D&D item-card grid editor for the supplied border artwork.

## Run

Open `index.html` directly for editing and preview. For local model requests, serve this folder over HTTP. There's no build step and no dependencies — a small Node script is included:

```powershell
node server.js
```

Then open `http://localhost:4173`. Pass a different port with `node server.js 5000`. (Requires only Node.js, which you already have — no Python needed.)

## Local models

Use **Settings** to set the Ollama URL/model and paste an API-format ComfyUI workflow JSON. Ollama refines the selected card into structured JSON. The ComfyUI button replaces `{{prompt}}` in the workflow, submits it to `/prompt`, polls `/history/{prompt_id}`, and attaches the first returned image to the selected card.

Start Ollama with `ollama serve` and make it reachable from the browser. On Windows, set `OLLAMA_ORIGINS=http://localhost:4173` before starting Ollama if browser requests are blocked by CORS. The editor defaults to the existing `gemmae4b` model. ComfyUI must be running with its HTTP API enabled; SwarmUI should point to its ComfyUI API endpoint.

### Generating items from a prompt

Type a description in the **Describe the items** box in the sidebar (e.g. "a cursed blade, a potion of healing, a pair of stealthy boots" — split items with commas, semicolons, or new lines) and click **Generate full sheet**. Ollama designs one card per item you described (up to 8) and fills the grid. The request automatically tries both Ollama's `/api/generate` and `/api/chat` endpoints, so it works regardless of which one your model supports.

Per card, use **Refine card** to polish the existing text, or **Regenerate** to have Ollama design a completely fresh alternative based on the same idea. You can also edit any field directly on the card (name, category, rarity, attune, effect, damage).

The back sheet order is mirrored row by row: front `1 2 3 4 / 5 6 7 8` becomes back `4 3 2 1 / 8 7 6 5`, which keeps duplex prints aligned.