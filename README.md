# Q Intelligence

Q is a privacy-conscious LGBTQ+ wellbeing, life-guidance, and personal-reflection application built with React, TypeScript, Express, and Supabase.

## Key features

- **Private local AI:** WebLLM runs Llama 3.2 1B in a Web Worker using WebGPU. After the initial model download, generation can run without sending prompts to an AI API.
- **Optional hosted AI:** Users can explicitly select the server-hosted OpenAI provider when local WebGPU is unavailable or unsuitable. Client-side PII masking is applied before hosted requests.
- **Per-user memory:** User-approved memories are stored in Supabase and protected by Row Level Security. Relevant memories are retrieved only for the authenticated user.
- **Crisis support:** A static, offline-capable country directory provides one-tap emergency, phone, text, and chat actions. Crisis intent is checked before model inference.
- **Safety controls:** Quick Exit, cross-tab exit, camouflage mode, privacy lock, and local-data deletion are built into the application.
- **Journaling and mood tracking:** Private local/cloud-backed reflection tools with user controls.
- **Operations:** PayPal subscriptions, staff access controls, and optional Zoho Bigin CRM synchronization.

See [Local AI, memory, and safety](docs/local-ai-memory-safety.md) and the [user, staff, and admin guide](docs/q-user-staff-admin-guide.md) for operational details.

## Requirements

- Node.js 20 or later
- A WebGPU-capable browser for local AI
- Supabase credentials for authentication and cloud memory
- An OpenAI API key only if hosted AI is enabled

## Local development

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the displayed local URL and use `/app` for the authenticated application.

## Environment variables

Copy `.env.example` and configure only the integrations in use. Never expose server secrets through a `VITE_` variable.

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
AI_FREE_MODEL=gpt-5-nano
AI_PAID_MODEL=gpt-5-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
```

`OPENAI_API_KEY` is not required for WebLLM. It is required for explicitly selected hosted AI and server-side vetted-knowledge embeddings.

## WebLLM behavior

The first local-AI request downloads and caches approximately 900 MB of model assets. Actual storage and memory requirements vary by browser and device. Local AI requires WebGPU and may be unavailable on older devices, private browsing configurations, or browsers that disable hardware acceleration.

The model is loaded in a dedicated worker from `src/workers/webllm.worker.ts`. Provider orchestration is in `src/services/webLlm.ts`.

## Validation

```powershell
npm run lint
npm run build
git diff --check
```

The production build currently emits a large-chunk warning because the WebLLM runtime and worker are substantial. This warning does not indicate a failed build.

## Technical stack

- Frontend: React 19, TypeScript, Tailwind CSS, Motion
- Local AI: `@mlc-ai/web-llm`, WebGPU, Web Workers
- Hosted AI: OpenAI Responses API through the Express server
- Data: Supabase Auth, PostgreSQL, pgvector, and RLS
- Backend: Node.js and Express
- Deployment: Vercel-compatible and conventional Node hosting
