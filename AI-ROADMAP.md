# AI Module Roadmap

**Local, Ollama-powered AI for the School Management System — School Assistant, Analytics, Report Generator, Communication Assistant — built on top of the existing tenant/RBAC foundation rather than beside it.**

This document answers: *how do we get from "AI" being four dead links in the sidebar to a working, secure, multi-tenant AI module that never invents data and never leaks one school's information into another's?*

Compiled from a direct review of the codebase (schema, permission matrix, navigation config, existing service/route patterns) on 2026-08-28.

---

## 1. The headline finding

The sidebar is already ahead of the backend: **`src/config/navigation.ts:297-307`** already has the "AI" section with all four sub-items (`AI School Assistant`, `AI Analytics`, `AI Report Generator`, `AI Communication Assistant`), gated to `super_admin, school_admin, principal, teacher`. Nothing behind those four links exists yet — no `/ai/*` pages, no `ai*` permission module, no Prisma models, no Ollama integration, no dependencies installed. This is genuinely a from-scratch build, not a partial one.

Two things about the existing codebase directly shape how this should be built, and both are good news:

- **The tenant/RBAC substrate this module needs already exists and is solid.** `getCurrentSchoolId()` / `getCurrentUser()` (`src/lib/tenant.ts`, `src/lib/current-user.ts`) and `requirePermission(module, action)` (`src/lib/authorize.ts`) are the same choke points every other module routes through. The AI module's "never let a school see another school's data, never bypass RBAC" requirement is satisfied by **using these exact functions**, not by building a parallel security layer. Every AI tool call and every AI API route must go through them like any other route does.
- **This project already has the "swap the provider later without touching schema" pattern**, twice: `src/lib/storage.ts` (local disk today, S3-compatible later) and the SQLite→Postgres datasource swap noted in `prisma/schema.prisma:1-11` and `src/lib/db.ts`. `AIProvider` (Ollama today, OpenAI/Claude/Gemini later) is the same shape of problem and should copy that pattern exactly rather than inventing a new one.

One real constraint the spec doesn't account for: **dev runs on SQLite, not Postgres** (`prisma/schema.prisma:19`). Section 10 of the original spec calls for pgvector, which requires Postgres. Since the schema is already designed to swap to Postgres in production with no model changes, the fix is to keep RAG's storage provider-agnostic too — store embeddings as JSON in dev (SQLite has no vector type) and do cosine similarity in application code, with a documented seam to switch to native pgvector once production is on Postgres. This is Phase 9's problem specifically; it doesn't block anything else.

A second constraint worth naming honestly: **authentication itself doesn't fully exist yet** (see `AUTH-RBAC-ROADMAP.md` — sessions are currently a dev-only role cookie). This isn't the AI module's problem to solve. `requirePermission()` already sits in front of every route regardless of how identity got resolved, and the AI module inherits that boundary automatically — it becomes exactly as secure as the rest of the app the day real auth ships, with zero AI-specific changes required.

---

## 2. Which parts of the original spec have no data to work with yet

The spec (sections 4-9) lists AI tools and analytics across students, attendance, academics, exams, fees, and HR. Checked against the current schema:

| Area | Status | Implication |
|---|---|---|
| Students, guardians, admissions | Real models | Tools buildable now |
| Class/Section/Subject/SubjectAssignment | Real models | Tools buildable now |
| Student attendance (`Attendance`) | Real model | Tools buildable now |
| Staff attendance / leave (`StaffAttendance`, `LeaveRequest`, `LeaveBalance`) | Real models | Tools buildable now |
| Fees (`FeeCategory`, `FeeStructure`, `StudentFeeCharge`, `Payment`, `Receipt`, `Expense`) | Real models | Tools buildable now |
| Exam **creation** (`ExamType`, `Exam`, `ExamClass`) | Real models | Tools buildable now |
| Exam **results/marks** | **No model** (`ExamMark`/`ExamResult` doesn't exist — matches `EXAM-ROADMAP.md`) | `getExamResults()`, `getTopPerformers()`, `getWeakSubjects()`, exam analytics, exam reports **cannot be built** without inventing numbers. Deferred until the Exam results module ships. |
| Payroll (`getPayrollSummary()`) | **No model** (no Payroll/SalaryStructure despite `employeeSalary` permission existing) | Deferred until HR Payroll (Phase 8 of the HR roadmap) ships. |
| Subscription plan / billing | **No model found** | Section 12's quota-per-plan design has no plan tier to hang off yet. Ship `ai_usage` tracking and a hardcoded default quota; wire real per-plan limits once a subscription model exists. |

Per the spec's own rule ("do NOT invent fake data" / "never invent marks... salaries"), the exam-results and payroll tools are explicitly **out of scope** for this build, not stubbed with placeholder numbers. They get added the same week their underlying modules ship real data.

---

## 3. Data model (net-new)

All new models carry `schoolId` and are queried through it exactly like every existing tenant-scoped table — no exception for AI tables.

```
AiConversation   { id, schoolId, userId, title, createdAt, updatedAt }
AiMessage        { id, conversationId, role, content, toolCalls?, createdAt }
AiRequest        { id, schoolId, userId, module, model, status, responseTimeMs, createdAt }
AiUsage          { id, schoolId, userId, model, requestCount, estimatedTokens, periodStart }
AiAuditLog       { id, schoolId, userId, action, module, metadata, createdAt }
AiDocument       { id, schoolId, filename, documentType, uploadedBy, storageKey, createdAt }
AiDocumentChunk  { id, documentId, schoolId, content, embedding (Json), chunkIndex }
```

`AiAuditLog` follows the same append-only pattern as the existing `AuditLog` (`src/lib/audit.ts`) — every AI action that touches real data gets a row, same as every HR mutation does today.

---

## 4. Permissions & navigation

- New `PermissionModule` entries in `src/types/permissions.ts`: `aiAssistant`, `aiAnalytics`, `aiReports`, `aiCommunication`, `aiDocuments` (RAG upload is its own grant — most roles that can chat shouldn't necessarily be able to upload school policy documents).
- `ROLE_PERMISSIONS` in `src/config/permissions.ts` grants these per the existing role matrix: `super_admin`/`school_admin` get everything; `principal` gets assistant + analytics (view) + reports; `teacher` gets assistant scoped to their own classes (row-level scoping in the route, same pattern HOD/teacher scoping already uses elsewhere); `accountant` gets fee-related assistant queries; `hr` gets HR-related queries once payroll data exists. No role gets cross-school access, ever — that's not a permission grant, it's `getCurrentSchoolId()` being non-negotiable in every tool.
- Navigation: the four items already exist. They just need `roles` reconciled against whatever the permission grants end up being, and each item's route needs to exist behind `requirePermission()`.

---

## 5. Architecture

```
Frontend (/ai/*)
  → AI Service (src/services/aiService.ts) — thin fetch wrapper, existing pattern
  → API routes (src/app/api/ai/*) — requirePermission() + zod, existing pattern
  → AIOrchestrator — resolves which tool(s) a question needs
  → ToolRegistry — student/attendance/academic/fees/HR tools, each individually
    permission-checked and schoolId-scoped
  → PromptBuilder — assembles system + tool-result context, no giant inline strings
  → AiProvider interface → OllamaProvider (default) or OmniRouteProvider
  → Ollama (local) or OmniRoute (local gateway → third-party providers)
  → ResponseValidator — strips anything that looks like invented data patterns,
    enforces the "say so if data is unavailable" rule
```

Directory layout under `src/lib/ai/`: `providers/`, `orchestrator/`, `tools/`, `prompts/`, `rag/`, `guards/`, `types/` — mirrors the existing `src/lib/` + `src/services/` split, not a separate app.

**AI config** (`src/lib/ai/config.ts`): reads `AI_PROVIDER` (`"ollama"` default, or `"omniroute"`) plus `OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`OLLAMA_EMBEDDING_MODEL` and `OMNIROUTE_BASE_URL`/`OMNIROUTE_API_KEY`/`OMNIROUTE_MODEL` from env, same shape as `storage.ts`'s config constants. No model names hardcoded elsewhere.

**Second provider: OmniRoute** (`src/lib/ai/providers/omniroute-provider.ts`, added 2026-08-28) — an `AiProvider` implementation for [OmniRoute](https://github.com/diegosouzapw/OmniRoute), a locally-run OpenAI-compatible gateway that itself routes to ~350 third-party providers. Selected via `AI_PROVIDER=omniroute`; Ollama stays the default. **This is not a local-only provider the way Ollama is** — once selected, prompts leave this machine through whatever upstream OmniRoute is configured with. OmniRoute's own README flags some cataloged providers as carrying an "avoid" risk and warns to check each upstream's terms before use. Treat this as a development/evaluation option, not something to point a real school's data at without deliberately re-examining that tradeoff — nothing about the tenant/permission scoping elsewhere in this module changes with the provider choice, but the "does this leave the building" answer does.

---

## 6. Phased build order

### Phase 1 — Navigation ✅ already shipped
Sidebar section exists, `roles` reconciled with the real permission grants (Phase 2).

### Phase 2 — Backend module skeleton + data model ✅ shipped 2026-08-28
`src/lib/ai/` directory structure, the five Prisma models + migration, the five `PermissionModule` entries and their `ROLE_PERMISSIONS` rows.

### Phase 3 — Ollama provider ✅ shipped 2026-08-28
`OllamaProvider` implementing the `AiProvider` interface: streaming chat, health check, timeout. `GET /api/ai/health` returns connection status, current model, model availability, response time.

### Phase 4 — AI School Assistant (chat, no tools yet) ✅ shipped 2026-08-28
`POST /api/ai/chat`, conversation CRUD endpoints, and the chat UI. Proves the full pipeline end-to-end against a plain system prompt — verified live against a local Ollama instance.

### Phase 5 — ERP tool integration (chat-side) — not built; superseded in practice
This was meant to give the **chat assistant** an LLM-driven tool-calling loop (student/attendance/fees tools the model picks from). It was skipped, and Phases 6-8 were built directly on top of Phase 4 instead of waiting on it — Analytics and Reports don't need an LLM to *decide* which data to fetch (the report type / analytics section the user picks already determines that), so they call the same real data functions (`src/lib/ai/analytics/*`) directly rather than through a chat tool-calling loop. **The AI School Assistant chat still has no ERP data access** — ask it "how many students are absent today" and it correctly says it doesn't have authorized data for that, per its system prompt. Revisit this phase specifically to give the *chat* assistant the same data access Analytics/Reports/Communication already have, reusing those same functions as its tool implementations rather than duplicating them.

### Phase 6 — AI Analytics ✅ shipped 2026-08-28
Built directly on real aggregation logic already proven elsewhere in the app — `summarizeStudentFees()` (`src/lib/student-fee-ledger.ts`) for every fee number, the same daily-attendance groupBy shape the main dashboard uses — rather than re-deriving fee/attendance math. Two sections shipped: **Attendance** (daily trend, class-wise %, students below a configurable threshold) and **Fees** (collection totals, monthly trend, defaulters), each with an AI narrative that only describes backend-computed numbers (`src/lib/ai/analytics/narrate.ts`) and degrades honestly (stats still render, narrative shows a plain error) if Ollama is unreachable. Student/Class/Exam analytics that depend on exam marks remain deferred per §2. `POST /api/ai/analytics`.

### Phase 7 — AI Report Generator ✅ shipped 2026-08-28
Four report types with real data behind them: Attendance, Fee Collection, Fee Defaulters, Teacher/Staff Attendance (`src/lib/ai/reports/`). Each report reuses the Phase 6 analytics functions for its numbers and makes exactly one LLM call for the five narrative sections (Executive Summary/Observations/Areas of Concern/Recommendations/Conclusion), parsed from a strict `## Header` format with a fallback if the local model doesn't follow it. Export as PDF (pdf-lib, a from-scratch flowing-text renderer — the existing `render-card-pdf.ts` is ID-card-specific and not reusable here) and DOCX (new `docx` dependency); Print opens a clean, app-shell-free print window. Student/Class/Exam Performance, HR/Payroll, and Monthly composite reports are deliberately **not** built — see §2. `POST /api/ai/reports/generate`, `POST /api/ai/reports/export`.

### Phase 8 — AI Communication Assistant ✅ shipped 2026-08-28
Full draft workflow (12 types × 6 tones × language) with two audience modes backed by real data (`fee_defaulters`, `low_attendance_parents` — resolved via the Phase 6 functions into actual guardian names/emails) plus `class_parents`/`all_staff`/`custom`. **Sending is real, not simulated**: every send posts an in-app `Notification` (the same mechanism News publishing already uses, works with zero configuration) and additionally emails every resolved recipient with an address on file via the existing `src/lib/mail.ts`, but only if `MAIL_HOST`/`MAIL_PORT`/`MAIL_FROM` are configured — otherwise it says so honestly rather than pretending to have sent something it didn't. The recipient list is always re-resolved server-side from `audienceMode` against this school's own data; a client can never supply its own recipient list. Confirmation is mandatory before send, per spec §9. `POST /api/ai/communication/generate`, `POST /api/ai/communication/send`.

### Phase 9 — RAG / document intelligence
Document upload → chunking → embedding (Ollama embedding model) → JSON-stored vectors in dev, app-level cosine similarity; documented seam to pgvector when production moves to Postgres. Every chunk carries `schoolId`; retrieval always filters on it.

### Phase 10 — Usage & quota tracking — core mechanism shipped 2026-08-28
`assertWithinQuota()`/`incrementUsage()` (`src/lib/ai/usage.ts`) run on every LLM-calling route (chat, analytics, reports, communication/generate — not communication/send, which makes no LLM call). Still a single hardcoded default quota, not per-plan tiers, per §2. Revisit once a subscription/plan model exists.

### Phase 11 — Audit & security hardening — ongoing discipline, not a separate pass
Every AI route built so far (Phases 2-8) calls `requirePermission()` + scopes by `schoolId` and writes `AiAuditLog`/`AiRequest` as it goes, rather than this being a separate retrofit phase. What's still owed: a dedicated pass explicitly confirming this holds for every route (same discipline as `AUTH-RBAC-ROADMAP.md` §12), the way a security review would, rather than trusting it was done correctly in the moment.

### Phase 12 — Testing & production optimization
Unit tests on tools/orchestrator, integration tests on the permission boundary (a teacher asking for salary data must get denied, not filtered client-side), Docker Compose entry for Ollama alongside the existing dev setup.

---

## 7. Role → AI access, in plain terms

| Role | Gets today |
|---|---|
| `super_admin` / `school_admin` | Full AI module: assistant, analytics, reports, communication, document upload (upload has no routes yet — Phase 9) |
| `principal` | Assistant, analytics (view/export), reports (view/create/export), communication (view/create) |
| `teacher` | Assistant only (view/create/delete, own conversations) — not analytics/reports/communication, matching the nav gate |
| `accountant` / `hr` | No AI access yet — nav doesn't grant the AI section to these roles at all today; revisit once Phase 5 (chat tools) gives the assistant something scoped to hand them |
| Everyone else | No AI access until a product decision extends it — not implicitly granted |

No role, ever, sees another school's data through the AI module. That's not a row in this table — it's `getCurrentSchoolId()` being called in every single tool, no exceptions.

---

## 8. Immediate next steps

Phases 1-4 and 6-8 are shipped and verified end-to-end against a live local Ollama instance (`llama3.2`) — real streamed chat, real attendance/fee analytics with AI narration, a generated report exported to PDF, and a communication draft actually sent (in-app notification, with real email whenever `MAIL_HOST`/`MAIL_PORT`/`MAIL_FROM` are configured).

1. **Phase 5 (chat tool-calling) is the one gap left from the original plan.** The AI School Assistant chat still can't answer real ERP questions — it correctly refuses rather than inventing an answer, but it should eventually reuse `src/lib/ai/analytics/*` as its tool implementations instead of staying text-only forever.
2. Hold every future tool/report/analytics addition to exactly what §2 above lists as "real models exist" — resist the temptation to stub exam-results or payroll with placeholder data just to match the original spec's full list.
3. Revisit this document once the Exam Results and HR Payroll modules ship real data — that's the trigger to add the deferred tools/reports, not a fixed date.
4. Phase 9 (RAG/document upload) and Phase 12 (tests, Docker) remain fully unbuilt.
5. `accountant`/`hr` have zero AI access today (see the role table) — a deliberate gap, not a bug: there was nothing scoped for them to use until Phase 5 lands.

---

*Compiled from a direct review of the codebase (schema, permission matrix, navigation config, existing AI-adjacent scaffolding) on 2026-08-28. Supersedes the tool/feature list in the original AI-module spec wherever that spec assumes data that doesn't exist yet in this schema.*
