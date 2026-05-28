# Student Helper

## Safer local startup

Opening the frontend used to immediately call the backend warmup route, which could force Ollama to load a model into memory before you even sent a message. If that model is large, running the frontend, backend, and Ollama together can overwhelm a laptop.

The app now starts in a safer mode by default:

- Startup warmup is off unless you explicitly enable it.
- Ollama model keep-alive defaults to `5m` instead of `30m`.
- Chat history is not re-saved to `localStorage` on every streaming paint.

## Optional environment variables

Backend (`backend/.env`):

```env
PORT=5050
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_KEEP_ALIVE=5m
OLLAMA_ENABLE_WARMUP=false
OLLAMA_CHAT_MODEL=llama3
OLLAMA_FAST_MODEL=llama3
OLLAMA_PRO_MODEL=llama3
OLLAMA_VISION_MODEL=llava
```

Frontend (`frontend/.env`):

```env
REACT_APP_API_BASE_URL=http://localhost:5050
REACT_APP_ENABLE_WARMUP=false
```
