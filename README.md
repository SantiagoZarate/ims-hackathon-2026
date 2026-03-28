# ims-hackathon-2

Turborepo monorepo: Next.js frontend and Python (FastAPI) service.

## Structure

- `apps/web` — Next.js 16 (App Router), shadcn/ui, Tailwind v4
- `apps/python-service` — FastAPI + uv

## Prerequisites

- [pnpm](https://pnpm.io)
- [uv](https://docs.astral.sh/uv/) (Python 3.12+)

## Web app

From the repository root:

```bash
pnpm install
pnpm dev
```

Or filter to the web package:

```bash
pnpm --filter web dev
```

Build, lint, and typecheck (via Turborepo):

```bash
pnpm build
pnpm lint
pnpm typecheck
```

### shadcn components

Run from `apps/web`:

```bash
cd apps/web && pnpm exec shadcn@latest add button
```

## Python service

```bash
cd apps/python-service
uv sync
uv run fastapi dev src/main.py --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`
