# Parent & Student Access Portal Roadmap

**How to get from "auth exists and modules have real data" to parents and students logging in and seeing their own information — securely, tenant-isolated, and without inventing a second system next to the admin ERP.**

This document was prompted by a comprehensive 56-section product brief for a Parent & Student Portal (login, credential management, dashboards, fees, attendance, exams, homework, requests, certificates, communication, transport, library, security, AI). Rather than treat that brief as a spec to implement literally end-to-end, this doc checks it against what's actually in the codebase today and turns it into a phased plan scoped to what's real. It supersedes the brief's own phase numbering.

---

## 1. The headline finding

You are much closer to a working portal than the brief assumes, and further away than it hopes, in two different dimensions.

**Closer than assumed**: `AUTH-RBAC-ROADMAP.md`'s Phase 3 (real login, password hashing, sessions) has fully shipped since it was written — scrypt password hashing, httpOnly session cookies, a real `/login` page, and the dev-role cookie override is completely gone. The `Guardian` and `StudentGuardian` models already exist, including a `canAccessPortal` boolean and a `Guardian.userId` field explicitly reserved for "once a portal login exists for this guardian." A parent identity that can be linked to multiple children is not a design problem here — it's already the shape of the schema. On top of that, most of the modules the brief wants the portal to *display* — attendance, timetable, fees (structures/charges/payments/receipts), transport, library catalogue, certificates — already have real Prisma models and admin-side CRUD, not mock data. That's a very different starting position than a green-field build.

**Further away than hoped**: none of that data has ever been rendered for a parent or student. There is no `/portal` route (only a navigation stub pointing at pages that 404), `permissions.ts` grants `parent: {}` and `student: {}` — literally nothing — and `Student` has no `userId`, so a student can't log in at all today (only guardians can, once wired). Several modules the brief leans on heavily don't exist yet at any layer: homework/assignments, exam results/report cards (only exam *type* and *schedule* exist), a parent request/workflow system, per-user notification addressing and read state, and internal messaging. Building the portal "UI" for those would mean wiring real screens to data that doesn't exist — the same trap `EXAM-ROADMAP.md` and `CERTIFICATES-ROADMAP.md` both flagged and avoided.

So: **the identity/data foundation for a parent portal is unusually solid; the portal itself — UI, permissions, and a handful of missing models — is unbuilt.** This doc phases the buildout so the earliest phases only touch data that's already real.

---

## 2. Data model gaps

**Small additions needed immediately (Phase A):**
- `Student.userId String? @unique` — for student self-login. Doesn't exist today; only `Guardian.userId` and `Staff.userId` do.
- Nothing else — `Guardian.userId`, `StudentGuardian.canAccessPortal`, `SchoolMembership` all already support a `parent`/`student` login once populated.

**Net-new models needed for later phases (not before the modules they describe have admin-side data worth showing):**
- `ExamResult` / marks / report-card tables — `Exam`/`ExamType`/`ExamClass` exist (schedule + type registry only); no marks entry or results model exists yet. Portal "Results" waits on this regardless of portal work.
- `Homework` / `Assignment` — doesn't exist at all, admin or portal side.
- `ParentRequest` (certificate requests, leave requests, correction requests, etc.) with a status workflow (submitted → under review → approved/rejected → completed) and admin assignment/notes.
- `NotificationRecipient` (or equivalent) — today's `Notification` model is broadcast-only with no per-user read state, by design, "because there is no honest way to track individual read state" without real portal logins. Once logins exist, this is the natural next step, plus a way to target a notification at a student/class/section/guardian rather than the whole school.
- `Message` / `MessageThread` — parent↔teacher/admin communication, doesn't exist.
- A library circulation/loan model (`LibraryBookCopy` exists — catalogue only, no issue/return/fine tracking) — needed before a "My Issued Books" portal widget means anything.

---

## 3. Permissions & navigation impact

- `src/config/permissions.ts`: `parent` and `student` need real `ROLE_PERMISSIONS` entries. These should stay *role*-scoped only (can this role ever see the "fees" module at all) — the *row*-level rule ("only this parent's own linked children," "only this student's own record") is enforced in the route handler on top of that, exactly the pattern `AUTH-RBAC-ROADMAP.md` §5 already established for HOD-style department scoping. This is the one place the brief's instinct ("never trust the frontend, verify server-side, never let a parent manipulate a student ID in the URL") is non-negotiable and needs to be the first thing written, not a hardening pass at the end.
- `src/config/navigation.ts`: `portalNavigation` already exists as a short, deliberate IA (Dashboard, Timetable, Attendance, Results, Assignments [student-only], Fees [parent-only], Messages) and already routes `parent`/`student` roles away from `adminNavigation`. It needs new entries added phase-by-phase (Certificates, Transport, Library, Requests) but the routing mechanism itself needs no rework.
- New route group: `src/app/(portal)/` (or `src/app/portal/`, matching the nav config's existing `/portal/*` paths) — doesn't exist yet at all.
- New resolver: something analogous to `getCurrentUser()`/`getCurrentSchoolId()` — e.g. `getCurrentGuardian()` returning the `Guardian` row + its linked, portal-visible students (`StudentGuardian.canAccessPortal = true`), and `getCurrentStudentSelf()` for student logins. This is the choke point every portal route calls through, same as the admin side.

---

## 4. Phases

### Phase A — Student login + credential management (admin side)
*Ships first because nothing else is reachable without it, and it needs no new modules beyond `Student.userId`.*

- `Student.userId` migration.
- Admin UI: **Student Accounts** and **Parent/Guardian Accounts** management — create login, view status (active/inactive/never logged in), reset password, force password change, activate/deactivate, generate a temporary password. This is the literal "give a parent their login ID and password" workflow (brief §4–7), scoped down: single-record creation and reset first, bulk generation deferred to Phase A2 since it's a UX layer on the same underlying calls, not a new capability.
- Admin UI: manage `StudentGuardian` links (which guardian ↔ which student, `canAccessPortal`, `isPrimary`) — today this join table is populated but there's no dedicated screen to review/edit portal access per relationship.
- `permissions.ts` grants for `parent`/`student` (role-scoped) + the row-level guardian→student and student→self resolvers described above.
- **Deferred to Phase A2**: bulk account generation for a whole class/section, credential PDF export/print, "send credentials via configured channel." These are real value but layer cleanly on top of A's single-record primitives once those are proven, and require deciding a delivery channel (email exists via school SMTP config from other modules; SMS/WhatsApp do not, see Phase E).

### Phase B — Portal shell
*Purely structural — no new business data.*

- `(portal)` route group + layout: header, child switcher for guardians with `>1` portal-visible student (desktop sidebar / mobile bottom nav per the brief's responsive direction — this project already has both patterns in the admin shell to draw from), using existing `LoadingState`/`EmptyState`/`ErrorState` primitives per `CLAUDE.md` conventions.
- Auth guard middleware extended to the new route group, same mechanism already protecting `(admin)`.
- Dashboard page skeleton with widget slots, populated in Phase C.

### Phase C — Dashboard widgets backed by already-real data
*Every widget in this phase reads a model that already has admin-side data — no new schema.*

- Attendance widget + full history/calendar view (`Attendance` model — exists).
- Timetable widget (`Timetable`/`TimetableSlot` — exists).
- Fees widget: structure, charges, payment history, receipt download (`FeeStructure`, `StudentFeeCharge`, `Payment`, `Receipt` — exist). **"Pay Now" (online payment) is out of scope here** — no payment gateway is wired anywhere in the codebase yet; today's `Payment` model reflects admin-recorded payments. Gateway integration is Phase E.
- Transport widget: assigned route/stop/driver/vehicle, read-only (`StudentTransport` + route models — exist). No GPS tracking exists anywhere in the codebase; that's a hardware/telemetry project, not a portal-UI one, and stays out of scope.
- Certificates widget: view/download certificates already issued to this student (`Certificate` — exists, verification QR already public). Requesting a *new* certificate is Phase D (needs `ParentRequest`).
- Notices/News widget, read-only, from the existing broadcast `Notification`/News model (no per-user read state yet — that's Phase D).
- **Explicitly deferred, no model exists**: Results (no `ExamResult`), Homework/Assignments (no model), Library "issued books" (catalogue only, no circulation model), Messages (no model).

### Phase D — New models: results, homework, requests, notifications, messaging
*Each sub-item is independent and can ship in any order; grouped here because each pairs an admin-side authoring screen with the matching portal-read screen.*

- `ExamResult`/marks entry (admin) → Results + report-card download (portal).
- `Homework`/`Assignment` (admin, teacher-authored) → Homework/Assignments list + submission status (portal).
- `ParentRequest` model + workflow (submit → review → approve/reject → complete), starting with certificate requests since `Certificate` generation already exists as the fulfillment step — this is the shortest path to the brief's §15 "Certificate Request" flow working end-to-end.
- `NotificationRecipient`-style per-user addressing + read/unread state, replacing today's broadcast-only model; admin "compose notification" UI targeting class/section/student/guardian.
- `Message`/`MessageThread` for parent↔teacher/admin communication, with school-level control over who parents can message (mirrors the brief §22).

### Phase E — Delivery channels & payments
- Online fee payment (Razorpay, per the brief's stack recommendation — no gateway is integrated anywhere in the codebase today).
- Email delivery for notifications/credentials (school SMTP exists for other modules — confirm reuse) — SMS/WhatsApp require a new provider integration and are genuinely net-new infrastructure, not a portal-scoped task.

### Phase F — Security & audit hardening pass
- Confirm every portal route enforces row-level scoping server-side (a parent must never reach another family's student by editing an ID in the URL) — a dedicated review pass, same discipline as `AUTH-RBAC-ROADMAP.md` §12's planned permission-matrix audit.
- Wire portal-relevant actions (login, password reset, request submitted/approved, payment recorded, document downloaded) into the existing `AuditLog` model.
- Admin "view as parent" impersonation, if wanted at all: explicit opt-in, audited, time-boxed, clearly bannered — treat as a distinct, reviewable feature, not a Phase A/B default.

### Phase G — AI assistant for parents/students
Out of scope for this doc — `AI-ROADMAP.md` already tracks the AI module's status and explicitly defers exam-results and other tool-backed AI features until their underlying data exists (see memory `project_ai_module`). Once Phase D's `ExamResult`/homework models land, revisit that roadmap rather than duplicating it here.

---

## 5. Role → access, in plain terms

| Role | Sees today | Phase that unlocks it |
|---|---|---|
| `parent` (Guardian) | Nothing — no login possible (`Guardian.userId` unpopulated, no UI to set it), `permissions.ts` grants nothing | Phase A (login) → Phase B (shell) → Phase C (real widgets) |
| `student` | Nothing — `Student.userId` doesn't exist yet, so no login is possible at all | Phase A (schema + login) → Phase B → Phase C |
| `school_admin`/`principal` (managing accounts) | Can already manage every other user type's data; no screen to create/manage parent or student logins | Phase A |
| `teacher` (authoring homework/marks for the portal to display) | No homework/results authoring exists at all today | Phase D |

---

## 6. Immediate next steps

1. Confirm scope for the first implementation pass — this doc's Phase A + B + C is a coherent, demoable milestone (a parent can log in, switch between children, and see real attendance/timetable/fees/transport/certificates/notices) without inventing any module that doesn't already have admin-side data. Phases D onward each depend on a new model that doesn't exist yet and should be scoped separately.
2. `Student.userId` migration, alongside the Phase A admin UI — smallest schema change, largest unlock.
3. Write the `getCurrentGuardian()`/student-self resolver and the row-level scoping helper *before* any dashboard widget, not after — this is the one piece of the brief's security section (§29–31) that must be foundational, not retrofitted.
4. Update `CLAUDE.md`'s "Project status" section once Phase A/B/C land — it's already stale relative to everything shipped since Phase 1, and this portal work will make that gap wider.

---

*Compiled from a direct review of the codebase (schema, permissions config, navigation config, existing route groups) on 2026-08-29, cross-referenced against `AUTH-RBAC-ROADMAP.md`, `EXAM-ROADMAP.md`, `CERTIFICATES-ROADMAP.md`, and `LIBRARY-ROADMAP.md`. Treat the 56-section Parent & Student Portal brief as the aspirational end-state; treat this document as the sequencing of it against what's actually real.*
