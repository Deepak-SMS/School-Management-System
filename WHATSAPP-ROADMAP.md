# WhatsApp Communication & Bulk Messaging

What actually ships today at `/communication/whatsapp` vs. what the full 66-section product spec describes, and why the gap is where it is.

## 1. The headline finding

Before this build, `/communication/whatsapp` was a dead nav stub (`src/config/navigation.ts`) pointing at a route that didn't exist — no schema, no service, no page, nothing. `CLAUDE.md` still describes the whole project as "Phase 1, frontend only, no backend" (stale, ignore it — see the other `*-ROADMAP.md` files for the real state of every other module).

As of this build, WhatsApp is a **real, working, end-to-end bulk-messaging module** — a school admin can connect a real WhatsApp number, build an address book (manually, via Excel import, or from the existing student/guardian roster), write personalized templates, and run a full campaign through a background worker with live progress, retry, and history.

The connection itself started as a `MockWhatsAppProvider` (simulated QR, no real traffic) and was then upgraded, at the user's explicit request, to a real `BaileysWhatsAppProvider` — genuine WhatsApp Web protocol automation via the unofficial `baileys` library. **This is verified working against a real phone**, not just typechecked: a real QR code was scanned with an actual WhatsApp app, the connection reached `connected` with the real linked phone number and display name, and the connection survived a full server restart by resuming from saved credentials with no new QR needed. See §3 for the real risk this carries and why it's not Meta's official API, and §2 for how the provider seam made this a clean swap.

## 2. Architecture

- **Multi-tenancy**: every new table (`WhatsAppAccount`, `WhatsAppContact`, `WhatsAppTemplate`, `WhatsAppCampaign`, `WhatsAppMessageJob`) carries `schoolId`, queried through it exactly like every other tenant-scoped model. No cross-school leakage — same discipline as the rest of the app.
- **Provider abstraction** (`src/lib/whatsapp/provider.ts`): a `WhatsAppProvider` interface (`connect`, `disconnect`, `logout`, `getConnectionStatus`, `getQRCode`, `getAccountInfo`, `sendTextMessage`) that the campaign engine and every route code against — never a specific implementation. `src/lib/whatsapp/registry.ts::getWhatsAppProviderForSchool(schoolId)` resolves which one from `WhatsAppAccount.provider`, defaulting to `"baileys"` for a school with no account row yet. Adding a Meta Cloud API (official) provider later is: implement the interface, register it, let a school opt in — **zero changes to campaigns, templates, contacts, or the worker**, exactly what happened when `baileys` itself was added this way after the mock.
- **Baileys provider** (`src/lib/whatsapp/baileys-provider.ts`) — the real, default connection: genuine WhatsApp Web protocol automation, not an API call to Meta. A live `WASocket` per school is held in a `globalThis`-guarded in-memory map (same survive-Fast-Refresh idiom as `src/lib/db.ts`'s Prisma singleton) — this is why the module requires a persistent Node process (true for `next start` today; would need rework for a serverless target). Session credentials persist to `.data/whatsapp-auth/<schoolId>/` on disk via Baileys' `useMultiFileAuthState` (gitignored, never committed — this is real per-school login state). `connection.update` events drive `WhatsAppAccount.status` in real time (`connecting` while a QR is showing, `connected` once WhatsApp confirms the pairing); an unexpected drop auto-reconnects from saved creds, a real `loggedOut` reason clears them and requires a fresh QR. `src/instrumentation.ts::resumeBaileysConnections()` reconnects every previously-connected school on server boot using saved credentials — **verified**: a real connection survived a full dev-server restart with no new QR prompt.
  - **Next.js build note**: `baileys` is listed in `next.config.ts`'s `serverExternalPackages` — it dynamically imports optional media libraries (`jimp`/`sharp`, for image/voice-note processing this module doesn't use) inside its own try/catch, and Turbopack would otherwise try to statically resolve those and fail the build since neither is installed. Externalizing lets Node's own `require` handle it at runtime, where Baileys' own fallback already does the right thing.
  - **Dependency note**: pinned to `baileys@7.0.0-rc14`, not the latest stable `6.17.16` — `6.17.16` (and everything ≤6.7.18) carries a critical message-spoofing vulnerability (GHSA-qvv5-jq5g-4cgg) with no stable patched release; the 7.0.0 release-candidate line is the only fix. Revisit the pin once a stable 7.x lands.
- **Mock provider** (`src/lib/whatsapp/mock-provider.ts`) — kept as a `provider: "mock"` opt-in (e.g. for future automated tests), not the default anymore. Simulates a QR and sending (a configurable random failure rate) with zero real traffic and an explicit "Simulation Mode" badge. An earlier version auto-connected on a timer a few seconds after `connect()` regardless of any scan — that read as a bug ("I logged out and it logged itself back in"), not a convenience, and was removed; the only way out of "connecting" is now the explicit "Simulate Scan Now" button.
- **Queue**: no Redis/BullMQ. `WhatsAppMessageJob` is a DB-backed job table (`PENDING → PROCESSING → SENT | FAILED | RETRYING | CANCELLED | SKIPPED | INVALID_NUMBER | OPTED_OUT`), polled by an in-process worker (`src/lib/whatsapp/worker.ts`) started from `src/instrumentation.ts` (Next's stable server-boot hook). Idempotent by design: every claim is a conditional `updateMany({ where: { status: <status just read> } })`, so even concurrent ticks can't double-send. **Documented limitation**: this is a single-process scheduler — fine for `next start`'s one long-running Node process today, but a future horizontally-scaled or serverless deployment would need either a real queue (Redis/BullMQ) or an external cron hitting `POST /api/whatsapp/worker/tick` (already built as the manual fallback).
- **Personalization** (`src/lib/whatsapp/personalize.ts` + `variables.ts`): `{{school.name}}`-style dot-path tokens, same naming convention `src/lib/certificates/resolve-fields.ts` already established, extended with a genuinely new free-text token-replacement engine (the certificate/ID-card resolvers only ever fed a bound canvas element, never freeform text). Built-in variables cover School/Student/Guardian/Fee/Attendance, plus `contact.custom.*` for Excel-imported columns that don't map to a known field.
- **Audience resolution** (`src/lib/whatsapp/audience.ts`): mirrors `src/lib/ai/communication/audience.ts` (the AI Communication Assistant's proven pattern) — always re-resolved server-side from `schoolId`, never trusts a client-supplied recipient list. Reuses `getFeeDefaulters()`/`getLowAttendanceStudents()` as-is. Seven audience modes: `class_parents`, `fee_defaulters`, `low_attendance_parents`, `all_guardians`, `manual_contacts`, `tag`, `imported_list`.
- **Opt-out/consent**: centralized on `WhatsAppContact.optedOut`, not per-audience-mode — a parent who opts out from a Fee Defaulters campaign is also skipped by a future Class Parents campaign, because every send path resolves/creates the same contact row keyed by phone number.
- **Safety net before sending**: a raw unresolved `{{token}}` is never sent — `enqueue.ts` classifies every recipient at confirmed-send time (invalid phone → `INVALID_NUMBER`, opted out → `OPTED_OUT`, unresolved variable → `SKIPPED`), and the campaign wizard's Review step warns about all three before the explicit Confirm & Send click.

## 3. Provider history, and the real risk that comes with Baileys

Architecture decisions made explicitly with the user, in order:

1. **Provider, round 1 — mock first.** No WhatsApp Business credentials were available to wire up at the start, and the two real options carry real tradeoffs (see below). Building the full product against a mock first meant the entire user-facing flow — connect, contacts, import, templates, campaigns, queue, tracking — was real and working immediately, with the provider seam ready for either real option later.
2. **Provider, round 2 — upgraded to Baileys at the user's explicit request.** The user asked directly for a real, scannable WhatsApp Web QR, not a simulated one. **This carries a real, ongoing product risk, not just an engineering one, and it was flagged to the user in those terms before building it**: Baileys re-implements WhatsApp Web's protocol without Meta's authorization. Automating a personal/business WhatsApp account this way is against WhatsApp's Terms of Service, and WhatsApp can rate-limit or permanently ban the linked number for exactly the bulk/automated sending this module exists to do — there is no technical safeguard against that here, only sending discipline (real consent, real opt-out, reasonable volume) on the user's side. The official, ToS-compliant alternative is the Meta Cloud API — no QR, no persistent process, but it requires a Meta Business Account, a registered phone number, and pre-approved message templates for business-initiated conversations, none of which were available either. If this module is ever used for real, high-volume parent communication rather than testing, revisit that tradeoff before relying on the linked number for anything the school can't afford to lose.
3. **Queue**: DB-backed worker, not Redis/BullMQ. No queue infrastructure existed in this project at all before this build; introducing Redis is a real new deployment dependency that isn't justified before there's proven send volume.
4. **Scope**: this build stops at "a school admin can create and send a real bulk campaign end-to-end" (schema → provider → connect → contacts → templates → campaigns → worker → history/retry). Scheduling, analytics, ERP-triggered automation, AI drafting, and the official API are Milestone 2 (§5) — deliberately not attempted in the same pass, per this project's own convention of scoping large features to a named first milestone (see `AI-ROADMAP.md`).

## 4. Data model gaps closed

`Student.whatsappNumber`, `Student.commChannelsJson`, `Student.preferredChannel`, and `Guardian.mobile` already existed on the schema, unread by any code before this build — clearly pre-designed for this module. They're the real send-to source for `class_parents`/`fee_defaulters`/`low_attendance_parents` audiences now (`student.whatsappNumber` preferred, falling back to the primary guardian's `mobile`; `commChannelsJson` respected — a student explicitly missing `"whatsapp"` from their channel list is excluded).

Five new models: `WhatsAppAccount` (one per school), `WhatsAppContact` (the address book — manual/imported/roster-derived, one row per phone number so opt-out is centrally enforced), `WhatsAppTemplate`, `WhatsAppCampaign`, `WhatsAppMessageJob` (doubles as the live queue row and the permanent history row — never deleted after sending).

## 5. Permissions & navigation impact

Four new `PermissionModule` keys: `whatsappAccount` (connect/disconnect — kept separate from everyday use, same split `database`/`aiDocuments` use), `whatsappContacts`, `whatsappTemplates`, `whatsappCampaigns` (covers both drafting and the confirmed send step, same one-grant precedent `aiCommunication` uses). `super_admin`/`school_admin` get full control via the existing blanket grant. `principal` gets broad access minus account setup. `teacher` gets template viewing + campaign creation restricted in-route to `class_parents` for their own homeroom (reusing `src/lib/teacher-scope.ts`). `accountant` gets template editing + campaign creation restricted to `fee_defaulters`. No other role gets any WhatsApp grant.

Navigation: the existing "Communication" section's dead `WhatsApp` link now resolves; four sibling items added (`Contacts`, `Templates`, `Campaigns`, `History`) the same way Library/Fees list multiple destinations rather than nesting (no `NavItem` children support exists anywhere in this codebase).

## 6. Phase status

### Phase 1 — Architecture ✅ shipped
Schema, provider abstraction + mock provider, permission modules, tenant scoping discipline throughout.

### Phase 2 — WhatsApp connection ✅ shipped (real, verified live)
QR-code connect flow, live status, disconnect/logout, resume-on-restart. Upgraded from the mock to a real `baileys` WhatsApp Web connection at the user's request — verified against an actual phone: real QR scanned, real phone number and display name connected, survived a full server restart with no new QR. See §3 for the ToS/ban-risk tradeoff that comes with this being real. The official Meta Cloud API path remains unbuilt (Phase 12).

### Phase 3 — Contacts ✅ shipped
Manual add/edit, opt-out, Excel import with a genuinely new column-mapping step (no other importer in this codebase does flexible mapping — they all strict-match a fixed template), phone normalization (India-first E.164), duplicate detection by phone, and a "Download Sample Template" button (`GET /api/whatsapp/contacts/import/template`) — a plain example workbook, not tied to the `src/lib/database/workbook.ts` Dataset registry, since this import accepts any column layout via the mapping step.

**Fixed post-ship** (found while verifying the Email Campaigns module, which shares this import path): `src/lib/database/workbook.ts::readWorkbook()` only ever parsed `.xlsx`, even though this wizard's own copy advertises `.csv` support — a real `.csv` upload failed. Now falls back to a CSV parse when the `.xlsx` parse fails, so `.csv` genuinely works, same as the UI always claimed. See `EMAIL-ROADMAP.md` §1 for how this was found.

### Phase 4 — Templates ✅ shipped
Variable-insertion editor (click-to-insert `{{token}}` chips), live client-side preview against sample data, categories.

### Phase 5 — Campaigns ✅ shipped
Four-step wizard (Message → Audience → Review → Confirm & Send), seven audience modes, missing-variable warning before send, explicit separate confirm step (never auto-sent after drafting). The Audience step also shows a live, real recipient preview (`POST /api/whatsapp/campaigns/preview-audience`) — actual student names, their class/section, parent name and phone, and the class teacher (`src/lib/whatsapp/audience.ts::getClassTeacherName()`) — as soon as a class/section/tag/contact selection resolves to real people, not just a count.

### Phase 6 — Queue ✅ shipped
DB-backed `WhatsAppMessageJob`, in-process worker via `src/instrumentation.ts`, idempotent claiming, auto-retry with backoff, manual retry (single message or bulk), cancel.

### Phase 7 — Tracking ✅ shipped
Live Message Queue tab (polls while sending), History tab per campaign, cross-campaign History page with search/filter/CSV export.

### Real Inbox ✅ shipped — not in the original 12-phase spec, added at the user's request
A genuine two-way chat view (`/communication/whatsapp/inbox`), distinct from the campaign-send log (`WhatsAppMessageJob`/History). New models `WhatsAppChat`/`WhatsAppChatMessage`; `src/lib/whatsapp/baileys-provider.ts` listens to Baileys' `messages.upsert` event (`type: "notify"` only — no history backfill, the inbox starts from "now") and records both directions through one function, `src/lib/whatsapp/chats.ts::recordChatMessage()` — an outbound send isn't written where it's sent from, it's picked up from Baileys' own echo of it (`emitOwnEvents`), so a reply typed from this inbox and a message sent directly from the connected phone both land in the same thread with no double-recording. Scoped to 1:1 phone conversations only — WhatsApp groups, broadcast lists, and the newer `@lid`-identified chats (not reliably resolvable to a phone number without an extra lookup) are skipped. Text-only: a non-text incoming message (image, voice note, document) is silently not rendered, not stored as a broken row. Two-pane UI (`src/features/whatsapp/inbox-panel.tsx`) polls the chat list and open thread client-side (no websocket infra exists in this project — same polling pattern every other live view here uses). Gated behind `whatsappCampaigns:edit` (school_admin/principal/super_admin only) rather than `:view`, since an inbox shows every conversation on the number at once — a materially bigger grant than a teacher's own scoped campaign audience.

### Phase 8 — Scheduling — not built
Send-later with timezone handling needs a `scheduledAt` field and a worker check for `status:"scheduled"` campaigns whose time has come — deferred because it interacts with the worker's restart-resume behavior and deserves its own review, not because it's hard. Pause/resume of a *scheduled* campaign is meaningless without this; cancel of an *in-flight* (`sending`) campaign already works today.

### Phase 9 — Analytics — not built
`WhatsAppCampaign`'s counter fields (`sentCount`/`failedCount`/etc.) exist and back the per-campaign progress view; a dedicated analytics dashboard (trends, best-time-to-send, engagement) does not.

### Phase 10 — ERP-triggered automation — not built
Auto-firing a campaign on a fee-due date, an attendance threshold, a birthday, etc. would reuse `src/lib/whatsapp/audience.ts` and `enqueue.ts` directly once a trigger/scheduler concept exists in the app — no new resolution logic needed, just a new caller. Not built because that trigger concept doesn't exist yet anywhere in the codebase.

### Phase 11 — AI-assisted drafting — not built
Would call the existing `src/lib/ai/providers` layer to draft `WhatsAppTemplate.bodyText`, the same shape `src/lib/ai/communication/generate.ts` already does for the AI Communication Assistant. Straightforward to add later; not attempted in this pass.

### Phase 12 — Official WhatsApp Business API provider — not built
The unofficial route (Baileys) shipped in Phase 2 instead, at the user's request — see §3 for the ToS/ban-risk that comes with that choice. The seam is ready for the official alternative too; implementing `MetaCloudApiProvider` is real work — Meta Business verification, template pre-approval, webhooks for delivery/read receipts — and would be the ToS-compliant path if this module is ever used for real, sustained parent communication rather than testing.

Also not built, staying nav stubs only: media/attachment messages, multi-language templates, SMS/Email/Push channels (`/communication/sms`, `/communication/email`, `/communication/push` remain dead links, untouched by this build).

## 7. Role → access, in plain terms

| Role | Gets today |
|---|---|
| `super_admin` / `school_admin` | Full control: connect/disconnect, contacts, templates, campaigns (create/edit/delete/send/cancel/retry) |
| `principal` | Everything except connecting/disconnecting the WhatsApp account itself (view only) |
| `teacher` | View templates; create/send campaigns restricted to `class_parents` for their own homeroom section(s) |
| `accountant` | Edit (not delete) templates; create/send campaigns restricted to `fee_defaulters` |
| Everyone else (`hr`, `hr_staff`, `hod`, `librarian`, `transport_manager`, `hostel_manager`, `parent`, `student`) | No WhatsApp access — not implicitly granted |

No role, ever, sees another school's data through this module — `schoolId` scoping on every query, no exceptions.

## 8. Immediate next steps

1. **Decide how much real sending this account should actually do.** It's now a real, connected WhatsApp number (verified live) — every message sent through a campaign now genuinely reaches a real phone, and every send is bulk/automated in a way that's against WhatsApp's ToS (see §3). Before running a real campaign at any real volume, decide who this number belongs to, whether that's acceptable risk for it, and keep volumes modest until that's settled.
2. **Send an actual test campaign or inbox reply** to confirm `sendTextMessage` end-to-end, and **message the connected number from another phone** to confirm an inbound message really shows up in the Inbox — only the connect flow has been verified live so far, deliberately: sending a real message, and receiving one, both need the user's own hand on it, not mine.
3. Phase 8 (scheduling) is the most natural next slice now that a real provider exists, since a scheduled send benefits most from knowing which provider will actually process it.
4. Revisit Phase 10 (ERP-triggered automation) once any other module introduces a trigger/scheduler concept the campaign engine can hook into — don't build one just for this module.
5. **Unrelated pre-existing finding, not from this module**: `npm audit` currently flags a critical vulnerability in `tar` (via `@mapbox/node-pre-gyp`, pulled in by `fabric`'s optional `canvas` dependency — the ID-card/certificate designer's library, untouched by this build). Install-time risk only, not runtime, and `npm audit fix --force` would apply a breaking change to an unrelated module — worth its own look rather than a blind force-fix.

*Compiled from a direct review of the codebase and this build's implementation, 2026-09-01.*
