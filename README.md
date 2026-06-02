# Operator AI

## Groq backend

The app now talks to Groq instead of Ollama. That moves model inference off your computer, which usually makes the site feel much lighter and faster on laptops.

The backend keeps the same routes:

- `POST /chat` for streamed text chat
- `POST /vision` for image analysis
- `POST /warmup` for an optional one-token health check

By default, the backend uses fast Groq models for normal chat and a Groq vision model for image questions.

## Setup

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
```

Frontend `frontend/.env`:

```env
REACT_APP_API_BASE_URL=http://localhost:5050
REACT_APP_ENABLE_WARMUP=false
```

## Speed tips

If you want the fastest feel with Groq, these changes usually help the most:

- Keep `GROQ_FAST_MODEL` on a smaller, faster model like `llama-3.1-8b-instant`.
- Use `GROQ_PRO_MODEL` only when you actually want heavier reasoning.
- Use `Chat` unless you specifically need `Computer Control`.
- Keep prompts shorter when you want the fastest reply.
- Leave warmup off unless you specifically want a startup connectivity check.
- Avoid image analysis unless you need it, because multimodal requests are still heavier than plain chat.
