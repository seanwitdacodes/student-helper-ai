# Operator AI

Operator AI has two main modes:

- `Search` for regular AI chat and writing help
- `Computer Control` for local browser automation

`Computer Control` is command-based and uses Playwright locally, so supported browser commands can still work even when a VPN blocks Groq or OpenAI.

## Supported Computer Control commands

Try prompts like:

- `Open YouTube`
- `Search AP Calculus derivative rules`
- `Open Google and search AP Calculus derivative rules`
- `Open 3 tabs: Gmail, Google Docs, and ESPN`
- `Go to Amazon and search running spikes`
- `Close browser`

## Safety rules

Computer Control is intentionally limited:

- It will not enter passwords or sign in for you
- It will not make purchases or complete checkout
- It will not submit forms, emails, or messages automatically

## Setup

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

# Optional local browser-control / local AI behavior
AI_AUTO_FALLBACK=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3:latest
OLLAMA_VISION_MODEL=llava:latest

# Playwright browser visibility
PLAYWRIGHT_HEADLESS=false
```

### Frontend env

Create `frontend/.env`:

```env
REACT_APP_API_BASE_URL=http://localhost:5050
REACT_APP_ENABLE_WARMUP=false
```

## Install

From `backend/`:

```bash
npm install
npm run install:browsers
```

From `frontend/`:

```bash
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

- Regular AI chat still depends on whichever model provider is selected
- If a VPN blocks Groq, the backend can fall back to OpenAI if `OPENAI_API_KEY` is configured
- If you want the most VPN-resistant setup, run Ollama locally and keep using `Computer Control` for browser commands
