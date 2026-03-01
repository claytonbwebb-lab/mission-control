# Bright Stack Labs — Mission Control

A private operations dashboard for Bright Stack Labs.

## Architecture

- **Frontend**: React + Vite + TailwindCSS + shadcn/ui components (wouter routing)
- **Backend**: Express.js serving frontend + AI usage proxy routes
- **Theme**: Dark mode by default, toggleable light/dark

## Features

### Authentication
- Single-user password login via `POST {VITE_API_URL}/auth/login`
- Token stored in `localStorage` as `bsl_mc_token`
- All external API calls include `Authorization: Bearer {token}` header
- Protected routes redirect to `/login` if unauthenticated

### Section 1 — Mission Board (`/`)
- Kanban board with drag-and-drop (`@hello-pangea/dnd`)
- Columns: Ideas, In Progress, Review, Complete
- Task cards with: title, description, project label, priority badge, assignee chip, date
- Add card button per column, click-to-edit modal with activity log
- Activity log: chronological entries (comments, status changes, field changes) from `GET /tasks/:id`
- Comment posting via `POST /tasks/:id/activity` with `{ author: "steve", content }`
- All saves (modal + drag-drop) include `author: "steve"` for attribution
- Filter bar by project label
- API: `GET/POST/PATCH/DELETE {VITE_API_URL}/tasks`, `GET /tasks/:id` (with activity), `POST /tasks/:id/activity`

### Section 2 — Social Media (`/social`)
- **Accounts tab**: Connected social pages table (`GET {VITE_API_URL}/pages`)
- **Calendar tab**: Weekly grid with posts as platform-coloured chips
- **Queue tab**: Grouped list of posts by status (Draft/Approved/Scheduled/Published/Failed)
- **Generate tab**: AI content generator with project/theme/format selectors
- Post detail modal with edit/approve/reject/publish/delete actions
- API: Various `/posts`, `/pages`, `/generate` endpoints on `VITE_API_URL`

### Section 3 — AI Usage (`/ai-usage`)
- Credit balance panel
- 7-day token usage bar chart (Recharts)
- Recent API calls table
- API: Local Express proxy routes at `/api/ai/usage*` → Anthropic API

## Environment Variables

- `VITE_API_URL`: External backend base URL (e.g. `https://api.mybackend.com`)
- `ANTHROPIC_API_KEY`: For AI usage proxy (server-side only)

## Key Files

- `client/src/lib/auth.ts` — Auth utilities (token management, authenticated API requests)
- `client/src/App.tsx` — App layout, routing, theme toggle
- `client/src/components/app-sidebar.tsx` — Navigation sidebar
- `client/src/components/theme-provider.tsx` — Dark/light mode ThemeProvider
- `client/src/pages/mission-board.tsx` — Kanban board with DnD
- `client/src/pages/social-media.tsx` — Social media scheduler
- `client/src/pages/ai-usage.tsx` — Anthropic billing dashboard
- `server/routes.ts` — Express routes (AI usage proxy)
- `shared/schema.ts` — TypeScript types for all data models

## Design System

- Inter font, dark sidebar aesthetic ("command centre" feel)
- Dark mode by default, stored in `localStorage` as `bsl_theme`
- Color palette: blue primary, semantic tokens throughout
- shadcn/ui components used throughout
