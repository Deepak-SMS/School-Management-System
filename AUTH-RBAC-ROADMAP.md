# Identity, Access & Integration Roadmap

**School Management System — from role-aware UI to real logins, for every role: Admin, HR, Teacher, Accountant, Parent, Student.**

This document answers one specific question: *how do I get from what's built today to a system where I can hand out a login ID and password to an employee, a teacher, or a parent, and they only ever see the slice of the system that belongs to them?*

It's written from a direct review of the codebase in `D:\Claude Project\School Management System` on 2026-08-24 — not from the original planning notes in `RESEARCH.md`, which are now a phase behind what's actually been built.

---

## 1. The headline finding

You are much further along than `CLAUDE.md` currently says. That file still describes "Phase 1, frontend only, no backend." In reality, the project already has a working Prisma + SQLite backend, real API routes, and — most relevantly to your question — **a genuinely well-designed, server-enforced role/permission system**. The exact scenario you described (an HR employee who should only see HR + Recruitment; a teacher who should only see their own classes) is not a hypothetical for this codebase. It is already the design the permission matrix was built around.

What is missing is the one piece that turns "role-aware app" into "a system where you hand out real login credentials": **authentication itself.** There is no login page, no password checking, no session. Today, "who is acting" is decided by a developer-only cookie that lets whoever is at the keyboard pretend to be any role, for testing. That mechanism is explicitly commented in the code as temporary and must be deleted the same day real auth ships.

So the honest one-line status is: *the access-control brain is already built; the login door is not.* Everything in this document is organized around closing that gap first, then building outward to the rest of the modules in a deliberate order.

---

## 2. What's actually built today (verified against the repo)

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4, Radix UI primitives, Prisma 7 on SQLite for dev (swaps to Postgres for production with no model changes — already designed for that), Zod validation, TanStack Table, react-hook-form, Recharts, pdf-lib + qrcode for ID cards.

**Multi-tenancy**: `School → Campus → Academic Year → Class → Section` hierarchy, with every tenant-scoped table carrying a `schoolId` and every query filtered through `getCurrentSchoolId()`. `User ⟷ SchoolMembership(role) ⟷ School` is already a many-to-many, so one login can belong to more than one school — the SaaS shape you want is already the shape of the data model, not something to retrofit later.

**Modules with real Prisma models, API routes, and UI** (not mock data):
- School structure: profile, campuses, academic years, classes, sections, subjects (with subject→teacher assignment), departments.
- Students: full CRUD.
- HR / Employees: complete employee master (Staff) with education, experience, documents (with verification workflow), transfers (with immutable history), activity log, deactivation/reactivation, designations, employee types, reporting-manager hierarchy.
- Recruitment: job positions, vacancies, candidates, applications (full pipeline with stage history), interviews (with panel + scorecards), demo classes (teacher-specific hiring step), offers, and candidate → employee conversion.
- ID Cards: a full drag-and-drop template designer with versioning, system vs. school-owned templates, bulk generation jobs, QR-based public verification, and card replacement workflow.
- Bulk import scaffolding (import jobs, row-level errors, photo-matching) and a storage abstraction that already supports swapping local disk for S3-compatible storage without a schema change.
- An append-only `AuditLog` table that HR actions already write to.

**The permission system already in place** — this is the part most relevant to you:
- 13 roles are already defined: `super_admin, school_admin, principal, teacher, accountant, hr, hr_staff, hod, librarian, transport_manager, hostel_manager, parent, student`.
- A single source of truth, `src/config/permissions.ts`, maps every role to exactly which modules and which actions (view/create/edit/delete/export/approve/verify/transfer/etc.) it may touch. Salary and bank/PAN data is deliberately walled off into its own permission (`employeeSalary`), granted only to HR Admin, School Admin, Super Admin, and Accountant — not even Principal or HOD get it.
- That matrix is enforced **twice, correctly**: server-side via `requirePermission()` in every mutating route (the real security boundary), and client-side via a `useCan()` hook that just hides buttons the user isn't allowed to press (a UX convenience, never trusted on its own). This is exactly the right pattern and should be the template every future module copies.
- The sidebar navigation (`src/config/navigation.ts`) already has the full information architecture you described — School Management, Admissions, Students, Parents, HR Management, Recruitment, Academics, Fees & Finance, HR & Payroll, Communication, Generate ID Card, Library, Transport, Hostel, Inventory, LMS, Reports & Analytics, AI, System — each section tagged with which roles can even see it, and it's filtered per-role automatically.
- There's already a **separate, deliberately short navigation tree for parents and students** (`portalNavigation`), distinct from the admin-side nav. That is precisely the "give parents their own scoped door" concept you asked for — the scaffolding already exists, it's just not wired to a real login yet.

In short: the "can an HR person only see HR, can a teacher only see their class" problem you're describing has already been solved in code for the modules that exist. What's not solved is *how someone proves who they are* in the first place.

---

## 3. The actual gap: Identity & Access

Three concrete things are missing, and they block everything else you asked for:

**3.1 — No authentication.** `User.passwordHash` exists as a column but nothing ever sets or checks it. There is no login page, no session cookie, no middleware guarding routes. The only reason the app is usable at all right now is a `dev-role` cookie/header that any developer can set to pretend to be any role — this is explicitly commented in `src/lib/current-user.ts` as a placeholder that self-disables in production and must be deleted the moment real auth exists.

**3.2 — No link between a login and a person's actual record.** `User` (the login identity) and `Staff` (the HR employee master) are two separate tables today with no relationship between them. So even once login exists, there's no way to say "this login *is* teacher Priya Sharma, employee EMP-0042" — which is what lets a teacher's login automatically resolve to "my classes," "my subjects," "my students," pulled from the `Class.classTeacherId`, `Section.classTeacherId`, and `SubjectAssignment.teacherId` relations that **already exist** in the schema. Those relations are the reason the teacher-scoping part of your ask is closer than it looks — once the link exists, "which class do I teach and how many students are in it" is a query away, not a new feature.

**3.3 — No Parent/Guardian identity at all.** `Student` currently stores `guardianName`/`guardianPhone` as plain text fields, not a real linked record. There is no `Guardian` model, no way for one parent to be linked to multiple children, and no way to issue a parent a login that resolves to "the students I'm a parent of." This needs a small, deliberate data-model addition before parent logins mean anything.

Everything else — fees, attendance, timetable, communication, and so on — is a *feature* gap. These three are a *foundation* gap, and they're what your request is actually asking to unblock.

---

## 4. How this should be built: Phase 3 (Identity & Access) first

Numbering picks up where the project's own implicit phases left off — Phase 1 was the shell/design system, Phase 2 is everything already shipped (Core School, HR, Recruitment, ID Cards). What follows is Phase 3 onward.

### Phase 3 — Identity & Access (the unblocking phase)

This is the one phase that should happen before any other module work, regardless of which module is "next" on the product roadmap, because nothing else can be handed to a real person without it.

1. **Password auth + sessions.** Add password hashing (bcrypt/argon2) and a session mechanism — either a lightweight custom implementation (iron-session or a signed httpOnly cookie backed by a `Session` table) or Auth.js (NextAuth) with the Credentials provider pointed at the existing `User`/`SchoolMembership` tables. Given the multi-school membership model already in place, a custom session that stores `{ userId, activeSchoolId }` and re-derives role from `SchoolMembership` on every request is the closest fit to what's already built — it avoids fighting a library's assumptions about single-tenant roles.
2. **Login page + route protection.** A real `/login` page, plus middleware that redirects unauthenticated requests away from `(admin)` and `portal` route groups. `getCurrentUser()` and `getCurrentSchoolId()` already exist as the single choke point every route calls through — this phase replaces their bodies with real session lookups, which is by design a small, contained change (the comments in both files were written anticipating exactly this).
3. **Delete the dev-role override** from `current-user.ts` and the cookie-based role switcher in `user-provider.tsx` the same day real sessions land — leaving both in place alongside real auth would be a privilege-escalation hole.
4. **Link logins to people.** Add `Staff.userId` (nullable, unique) so an employee/teacher login resolves to their HR record, and add the `Guardian` model described in Phase 4 below with its own `userId` link. `Student` gets an optional `userId` too, for student self-login where the school wants it.
5. **Admin "create login" workflow.** Build out the already-stubbed `/settings/users` and `/settings/roles` nav items into: create a `User`, assign a `SchoolMembership` + role, optionally attach it to an existing `Staff` or `Guardian`/`Student` record, and issue credentials — either a temporary password shown once to the admin, or an emailed/SMS'd invite link that lets the person set their own password. This is the literal "give the HR person their login ID and password" screen you described.
6. **Forced password change on first login**, password reset flow, and account deactivation tied to the existing `Staff.employmentStatus` (so marking an employee "resigned" or "terminated" can optionally disable their login in the same action).
7. **Wire the audit log** to real `userId` values now that they're real — every `AuditLog.userId` write becomes meaningful instead of a placeholder.

**What this phase unlocks, concretely, using your own examples:**
- The HR person: admin creates their `User`, links it to their `Staff` record, assigns `SchoolMembership.role = "hr"` (or `hr_staff` if they should be limited to daily operations without salary/deletion rights — that distinction already exists in the permission matrix today). They log in, and the nav + every server route already restrict them to HR Management and Recruitment, with School Management as view-only and salary data invisible — all of that logic already exists, it just starts being enforced against a real identity instead of a dev cookie.
- The teacher: admin creates their `User`, links it to their `Staff` record, role `teacher`. Once logged in, "my classes" is `Staff.classesAsTeacher` + `sectionsAsTeacher` + `subjectAssignments` — relations that already exist — filtered to their own `staffId`. Student counts per class/section are a `count()` on `Student.classId`/`sectionId`, both of which already exist. The only genuinely new feature required here is the timetable itself (Phase 6), because there is no timetable model yet — everything else "teacher sees their own classes" needs is already sitting in the schema.

### Phase 4 — Parent/Guardian identity & Admissions

- New `Guardian` model (name, phone, email, relationship, optional `userId`) and a `GuardianStudent` join table (supports multiple children per parent and, where needed, multiple guardians per child, each flagged as primary/secondary and with independent portal visibility).
- Migrate the existing flat `guardianName`/`guardianPhone` fields on `Student` into real `Guardian` rows as part of the migration, rather than leaving two competing sources of truth.
- Admissions module: a real `Admission`/`Application` funnel distinct from the recruitment `Application` model (that one is for hiring candidates, not enrolling students) — enquiry → entrance test → offer → enrollment, ending in a `Student` row, mirroring how the recruitment pipeline already converts a `Candidate` into `Staff`. This is also the natural point to let a parent self-register for an enquiry, which is the first time a "parent" identity exists in the system before they're formally linked to an enrolled student.
- Parent portal: once `Guardian.userId` exists, `portalNavigation` already filters to "My School" (timetable, attendance, results) plus a parent-only "Fees" item — the IA is ready, it just needs the linkage and the underlying modules (Phases 6–7) to have real data to show.

### Phase 5 — Extend the permission matrix as a standing discipline, not a one-off

`src/config/permissions.ts` today only covers School Management + HR + Recruitment. Every module below must add its own module keys to `PermissionModule`, its own row-level rules to `ROLE_PERMISSIONS`, and — critically — its own `requirePermission()` calls in every mutating route, following the exact pattern already established. Two scoping rules should be written down now, before more modules get built, so they're applied consistently rather than invented per-module:
- **Role-based scoping** (what a role can do at all) stays in `permissions.ts`, unchanged in shape.
- **Row-level / ownership scoping** (a teacher may edit attendance only for *their own* class; a parent may view fees only for *their own* child; an HOD may see performance data only for *their own* department) is applied inside the route handler on top of the role check — the HOD role already does exactly this today ("row-level scoping to that department is applied in the route on top of this grant" per the code comments) and is the template to copy for teacher/parent scoping everywhere else.

### Phase 6 — Academic operations
Attendance (daily, with parent notification), timetable (the prerequisite for "teacher sees their schedule"), examinations, gradebook, report cards, assignments/homework. This is the highest-value phase for both teacher and parent portals, since it's what actually populates the screens those roles were designed to see.

### Phase 7 — Fees & Finance
Fee heads/structures, discounts/scholarships, invoicing, payment gateway integration (Razorpay for India), receipts, expense/income ledger. Unlocks the parent-portal "Fees" nav item and the Accountant role's real workload.

### Phase 8 — HR & Payroll completion
The permission matrix already reserves `employeeAttendance` and `employeePerformance` keys for this — the models don't exist yet. Employee attendance/leave, payroll (salary computation, PF/ESIC/TDS, payslips). This is where `employeeSalary`'s existing strict access control starts protecting real payroll data instead of just Staff bank fields.

### Phase 9 — Communication
Central notification engine, SMS/email/WhatsApp/push, internal messaging (admin↔teacher↔parent), circulars/announcements. This is also naturally where the account-invite emails from Phase 3 get a proper delivery mechanism instead of a one-off implementation.

### Phase 10 — Supporting modules
Library, Transport (with the GPS tracking noted in your research), Hostel, Inventory — each already has a nav section and roles assigned (`librarian`, `transport_manager`, `hostel_manager` already exist as roles with placeholder view-only grants), so each is mostly "add the module, extend its slice of the permission matrix, build the CRUD."

### Phase 11 — Reports & Analytics, AI features
Reusable reporting engine, role-scoped dashboards (Principal sees school-wide; HOD sees department-only; Teacher sees class-only — same row-level pattern from Phase 5), then the AI-native differentiators from `RESEARCH.md` (attendance summaries, question-paper generation, fee-defaulter prediction, natural-language querying).

### Phase 12 — Production hardening
Security review of the permission matrix end-to-end (a checklist pass confirming every mutating route actually calls `requirePermission()` — not just the HR ones), rate limiting on login, audit-log UI (the data's been collected since Phase 2; it has no viewer yet), backup strategy, and a real look at India-specific compliance (DPDP Act) given the student/guardian PII involved. Also the point to revisit SQLite → Postgres, since the schema was deliberately kept portable for this.

---

## 5. Role → access, in plain terms (what already exists vs. what Phase 3 unlocks)

| Role | Sees today (once logged in) | Still needed |
|---|---|---|
| `super_admin` / `school_admin` | Everything — matrix already grants all modules, all actions | Login itself (Phase 3) |
| `principal` | School Management (edit), Students, HR people (view + approve), Recruitment (evaluate/select/approve) — no salary | Login; department/campus-wide reporting (Phase 11) |
| `hr` | Full HR + Recruitment including salary; School Management view-only | Login; payroll module (Phase 8) |
| `hr_staff` | HR + Recruitment day-to-day, no salary, no delete, can't convert candidate → employee | Login |
| `hod` | Own department's staff, attendance approval, performance evaluation — row-level scoped to their department already | Login |
| `accountant` | Employee list + salary/bank data only | Login; Fees & Finance module (Phase 7) |
| `teacher` | Classes/sections/subjects/departments (view + export) | Login; `Staff.userId` link; own-class scoping (Phase 5); timetable data (Phase 6) |
| `librarian` / `transport_manager` / `hostel_manager` | View-only on departments (placeholder grant) | Login; their actual module (Phase 10) |
| `parent` | Portal nav exists (Timetable, Attendance, Results, Fees) | `Guardian` model + login (Phase 4); underlying data (Phases 6–7) |
| `student` | Portal nav exists (Timetable, Attendance, Results, Assignments) | `Student.userId` + login (Phase 4); underlying data (Phase 6) |

---

## 6. Immediate next steps (what to actually do first)

1. Decide the auth approach: custom session (recommended, given the multi-school `SchoolMembership` model already in place) vs. Auth.js. This is a one-way door worth deciding deliberately rather than defaulting.
2. Implement Phase 3 end-to-end on a branch: password hashing, session, login page, middleware guard, `Staff.userId` link, and the admin "create user + assign role" screen — before touching any other module. Everything else in this roadmap is genuinely blocked on it.
3. Delete the `dev-role` cookie override the same day real sessions ship, and update `CLAUDE.md`'s "Project status" section, which is currently stale (it undersells everything built in Phase 2).
4. Write a `Guardian` model and migration alongside Phase 3 if at all possible — it's small, and it means Phase 4 doesn't need a second migration pass over `Student` data later.
5. Only after logins are real and demonstrable with at least two roles (e.g., `hr` and `teacher`) end-to-end, move to Phase 6 (Academics) — it's the highest-leverage next module because it's what both the teacher and parent portals are actually waiting to display.

---

*Compiled from a direct review of the codebase (schema, permission matrix, navigation config, auth placeholders) on 2026-08-24. Treat `RESEARCH.md`'s two competing roadmap options as superseded by this document for anything already built — Option A/B's phase numbering doesn't reflect what actually shipped.*
