# Operator AI

Operator AI has two main modes:

- `Search` for regular AI chat, writing help, and guidance
- `Computer Control` for browser tasks in Google Chrome

## Computer Control architecture

The recommended Computer Control setup is the `Conductor` Chrome extension in [computer-control-extension](/Users/seana/Desktop/Coding/OperatorAI/computer-control-extension).

That extension gives you the behavior most people want:

- same normal Chrome window
- same signed-in Chrome profile
- open the requested site in a new normal tab
- follow-up actions stay in that remembered workspace tab
- no incognito
- no Apple Events JavaScript toggle

The extension uses the local backend only as the planning layer. It asks the backend to break a natural-language request into simple chronological browser steps, then executes those steps inside your real Chrome window.

The website and extension can now share the same Computer Control session:

- the website can send a task into the shared session
- Conductor can pick it up and execute it in Chrome
- Conductor can open its side panel as the mini-chat worker on the target tab
- follow-up commands from either side stay linked to the same workspace tab

## Example commands

- `Open youtube.com and search up flight reacts`
- `Open Google Classroom`
- `Continue and click Precalculus Honors`
- `Scroll down`
- `Summarize this page`
- `Search this page for due dates`
- `Fill email with sean@gmail.com`
- `Open Amazon then look at ipads then scroll down`
- `Head over to YouTube and look up Dhar Mann`

## Chrome extension setup

1. Start the backend with `cd backend && npm start`
2. Open Chrome
3. Go to `chrome://extensions`
4. Turn on `Developer mode`
5. Click `Load unpacked`
6. Select [computer-control-extension](/Users/seana/Desktop/Coding/OperatorAI/computer-control-extension)
7. Pin `Conductor`
8. Open any normal tab in Chrome
9. Click the extension icon and type a task

## Web app setup

### Backend env

Create `backend/.env`:

```env
PORT=5050
GROQ_API_KEY=your_groq_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_ENABLE_WARMUP=false
GROQ_CHAT_MODEL=llama-3.1-8b-instant
GROQ_FAST_MODEL=llama-3.1-8b-instant
GROQ_PRO_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# Optional remote fallback
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_FAST_MODEL=gpt-4o-mini
OPENAI_PRO_MODEL=gpt-4o

# Optional local model fallback
AI_AUTO_FALLBACK=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3:latest
OLLAMA_VISION_MODEL=llava:latest

# Optional: enable AI planning for Computer Control
COMPUTER_MODE_USE_AI_PLANNER=false
```

### Frontend env

Create `frontend/.env`:

```env
REACT_APP_API_BASE_URL=http://localhost:5050
REACT_APP_ENABLE_WARMUP=false
```

## Install

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

## Run

Backend:

```bash
cd backend
npm start
```

Frontend:

```bash
cd frontend
npm start
```

## VPN notes

- Regular AI chat still depends on whichever remote or local model provider is active
- If a VPN blocks Groq, the backend can fall back to OpenAI if `OPENAI_API_KEY` is configured
- Computer Control planning runs locally through your backend, so it is much less dependent on the AI provider path than the regular chat mode
- By default, Computer Control uses the reliable local chronological planner first
- If you want Computer Control to ask an AI model to build the browser-action plan before execution, set `COMPUTER_MODE_USE_AI_PLANNER=true`
