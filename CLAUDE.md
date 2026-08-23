# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phase 1 (application shell + design system) is scaffolded. Frontend only — no backend/database yet. A reference PDF (`A to Z Ebook Optimized Updated.pdf`) and `RESEARCH.md` remain as planning material.

## Intent

This directory is the home of a multi-tenant School Management System SaaS (one platform serving multiple schools, each with roughly 1,000 students). It is a modern, purpose-built system inspired by the feature set of [Fedena](https://github.com/projectfedena/fedena/) (an old single-tenant Ruby on Rails school ERP) — not a fork or port of that codebase. Visual design, branding, and code are original.

## Stack

- **Framework**: Next.js (App Router) + React + TypeScript
- **Styling**: Tailwind CSS v4 (CSS-first `@theme` tokens in `src/app/globals.css`)
- **UI primitives**: Radix UI (unstyled, accessible) wrapped in `src/components/ui/*`
- **Icons**: lucide-react
- **Forms**: react-hook-form + zod (wired per-form as modules are built)
- **Tables**: TanStack Table (wired per-module as needed)
- **Charts**: Recharts (arrives with the Phase 2 dashboard)

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build (also type-checks)
npm run lint     # eslint
```

## Architecture

- `src/app/` — Next.js routes. Only `/` (the Phase 1 design-system preview page) exists so far.
- `src/components/ui/` — design-system primitives (Button, Card, Modal, Table, Toast, etc.). Reused by every future module — never duplicate one of these inside a feature.
- `src/layouts/` — the app shell itself: Sidebar, TopNav, tenant switcher, search, notifications, user menu.
- `src/config/navigation.ts` — single source of truth for the sidebar nav tree, filtered per-role via `getNavigationForRole()`.
- `src/providers/` — React context providers (theme, current user, current tenant/school/campus/academic year, sidebar collapse state), composed in `AppProviders`.
- `src/services/` — the API-ready boundary. UI code calls `*Service` interfaces, never mock data directly, so swapping in a real backend later is a one-file change per service.
- `src/lib/mock-data/` — realistic placeholder data behind those services until a backend exists.
- `src/types/` — shared TypeScript types (tenant, user, navigation).
- Business modules (`students/`, `admissions/`, `attendance/`, `fees/`, etc.) are intentionally **not** scaffolded yet — they land phase by phase per the roadmap in `RESEARCH.md`, each reusing the `components/ui` primitives rather than inventing new ones.

## Conventions

- Every data view must handle loading / empty / error states — use `LoadingState`/`TableSkeleton`, `EmptyState`, and `ErrorState` from `components/ui`, not ad-hoc markup.
- Don't hardcode business logic in components — read/write through a `*Service` so the mock-data-to-API swap stays a one-file change.
- Nav items, role gating, and tenant context all flow through `config/navigation.ts` and the providers — don't duplicate role-check logic inline in a page.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
