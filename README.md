# Brainstorm Studio

A brainstorming board for workshops, product discussions, travel planning, learning plans, event preparation, everyday decisions, and early-stage idea exploration. This is not the default Vite starter anymore. It is a working React app designed to turn vague thoughts into concrete directions.

Brainstorm Studio is built for people who know they need to think through a topic, but get stuck when they try to expand it on their own. Most brainstorming sessions do not need more noise; they need better prompts, better structure, and a way to keep pushing past the first obvious thought. This project uses local AI to help users branch out and keep exploring different directions instead of staring at a blank page.

Instead of replacing the user's thinking, the AI works like a brainstorming partner. It can react to the notes already on the board, follow weighted ideas more closely, and generate either more focused or more divergent suggestions depending on the slider in the UI. The goal is not to output one perfect answer. The goal is to help users discover directions they would not have reached by thinking alone.

## Features

- Auto-save to `localStorage`
- Cross-tab sync for the same board
- Manual note creation with tags, pinning, archiving, deletion, and voting
- Separate AI note weighting, so some notes can influence generation more than others
- Built-in prompt cards plus local AI generation through Ollama
- Adjustable AI divergence, from more focused to more exploratory
- AI model settings in the UI for Ollama model, base URL, generation count, and output language
- Undo for note deletion, note archiving, and import overwrite
- Adjustable note font size in the board UI
- Direct note editing without an edit mode button
- Filter and sort by scope, tag, keyword, recency, votes, and tag
- Export and import board data as JSON

## Development

```bash
npm install
ollama serve
npm run dev
```

`npm run dev` starts both:

- The Vite frontend dev server
- A local Node API server, listening on `http://127.0.0.1:8787` by default

The frontend calls `/api/ai/ideas`, and that API server forwards requests to your local Ollama instance.

If port `8787` is already in use, start with another API port. The Vite dev proxy follows `PORT` automatically:

```bash
PORT=8788 npm run dev
```

## Ollama Configuration

The default model is `gemma4:e4b-it-q4_K_M`, assuming it already exists on your machine. You can change the Ollama model, base URL, generation count, and output language from the board UI through **AI Settings**.

Environment variables still provide the server defaults:

```bash
export OLLAMA_MODEL=gemma4:e4b-it-q4_K_M
export OLLAMA_BASE_URL=http://127.0.0.1:11434
npm run dev
```

## Production Mode

Build the frontend first, then run the local server to serve both the static site and the AI API:

```bash
npm run build
npm run start
```

## Verification

```bash
npm run test
npm run lint
npm run build
```

## Data Format

Boards are stored in the browser and exported as JSON using the same underlying structure, so they can be imported again later or reused for further processing.
