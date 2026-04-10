# HireMind

AI-powered career preparation for students: resume analysis (PDF + Gemini), voice mock interviews (Web Speech API + speech synthesis), interview question banks, and an application tracker.

**Stack:** React (Vite), Tailwind CSS, Axios, React Router · Express.js, MongoDB (Mongoose), JWT · Google Gemini REST API.

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- **Gemini API key** — create one in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` in `server/.env`. The server uses the official [`@google/genai`](https://www.npmjs.com/package/@google/genai) package, as described in the [Gemini API quickstart](https://ai.google.dev/gemini-api/docs/quickstart). Optional: set `GEMINI_MODEL` (e.g. `gemini-2.5-flash` or `gemini-3-flash-preview`) if the default model is unavailable in your region.

## Environment variables

### Server (`server/.env`)

Copy `server/.env.example` to `server/.env` and set:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `MONGO_URI` | MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/hiremind`) |
| `JWT_SECRET` | Long random string for signing JWTs |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Frontend origin for CORS (default `http://localhost:5173`) |
| `CLIENT_URLS` | Optional comma-separated extra frontend origins for CORS |
| `GEMINI_MODEL` | Optional; default `gemini-2.0-flash` |

### Client (`client/.env` — recommended in dev)

- **`VITE_API_PROXY`** — Where Vite should forward `/api` in development. **Must match the Express `PORT` in `server/.env`.** Example: if the API runs on port `5001`, set `VITE_API_PROXY=http://127.0.0.1:5001`. If you omit this, the proxy defaults to port `5000`.
- **`VITE_API_URL`** — Optional; full API base URL ending in `/api` for production builds when the app does not use the dev proxy.

## Install and run (development)

**1. MongoDB**  
Start MongoDB locally or use Atlas and put the URI in `MONGO_URI`.

**2. Backend**

```bash
cd server
cp .env.example .env
# Edit .env with your keys and MONGO_URI

npm install
npm run dev
```

**3. Frontend** (new terminal)

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. Register a user, then use the sidebar: Resume Analyzer, Interview Simulator, Question Generator, Application Tracker.

## Production build

```bash
cd client && npm run build
```

Serve `client/dist` as static files (e.g. nginx) or use a host that serves the SPA. Point `VITE_API_URL` (build-time) or your reverse proxy so browser requests hit `/api` on the same host as the API. Set `CLIENT_URL` on the server to your public site URL for CORS.

## API overview

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` (Bearer JWT)
- `POST /api/resumes/analyze` — multipart field `resume` (PDF)
- `POST /api/interviews/start` · `POST /api/interviews/answer`
- `POST /api/questions/generate`
- `GET|POST|PATCH|DELETE /api/applications` …
- `GET /api/analytics`

## Voice interview

Use **Chrome** or **Edge** for best Web Speech API support. The interviewer’s questions are read with **speech synthesis**; you answer with the microphone (or type in the fallback box). HTTPS may be required for microphone access when not on `localhost`.

## Project layout

```
server/   — Express API, Mongoose models, `services/geminiService.js`, Multer uploads
client/   — React app (`components/`, `pages/`, `services/`, `hooks/`)
```

## License

**rachit-yadav148**
