# Teacher Portal Roadmap

**Turning the teacher role from "a filtered view of the admin app" into a genuinely teacher-first experience — a role-aware Dashboard landing page, a real Homework module, Study Materials, an attendance lock, and an expanded AI Teacher Copilot — built inside the existing `(admin)` shell rather than a second parallel portal.**

This document answers the question raised by an external reference screenshot (a competitor's dedicated Teacher Portal — separate sidebar, orange branding, "Alfalah" school, AI Assistant with Event Planner/Homework Helper/Notice Generator tools): *what would it take to reach that same functional outcome inside this codebase, and where should it live?*

Compiled from a direct review of the codebase (schema, permission matrix, navigation config, `src/lib/teacher-scope.ts`, existing `my/*` routes) on 2026-09-03.

---

## 1. The architecture decision

Two ways to get there: build a second dedicated shell for teachers (new route group, new sidebar, new dashboard-first layout — the same pattern `PARENT-STUDENT-PORTAL-ROADMAP.md` used for `/portal`), or extend the existing `(admin)` shell teachers already sign into.

**Decision: extend `(admin)`.** Unlike parents/students — who only ever needed a handful of read-mostly views and got real value from a stripped-down bottom-tab shell — teachers already have permission grants across a dozen modules that work today (Attendance, Timetable, Library, Certificates, WhatsApp, AI Assistant — see §2) and need the same depth of access an admin does, just scoped to their own classes. Rebuilding all of that inside a second shell would be pure duplication for a cosmetic difference. The one thing genuinely worth changing is what a teacher *lands on*: today `/admin` is one generic, permission-gated dashboard for every role; §4 makes it branch for `teacher` the same way `academics/timetable/page.tsx` already branches (`isTeacher ? <MyTimetableView /> : <TimetablesList />`).

Per-tenant branding (the screenshot's orange/"Alfalah" look) is a separate, unrelated feature — this app has no per-school theming today (no `primaryColor` anywhere in the schema) — and is out of scope here.

---

## 2. What already exists (don't rebuild this)

The permission matrix and teacher-scoping infrastructure are further along than the screenshot comparison suggests:

| Screenshot section | Status |
|---|---|
| Timetable — "Today's Schedule", weekly view | **Shipped.** `GET /api/my/timetable` + `MyTimetableView`, wired into `academics/timetable/page.tsx` for `role === "teacher"`. Missing only: substitute-class visibility, free-period highlighting (small addition, not a phase). |
| Attendance — mark present/absent, history | **Shipped**, minus the lock (§3.1). `POST /api/attendance` already scopes a teacher to `getTeacherScope()` — their homerooms (full roster) and subject-assignment classes (`canMarkHomeroom`/`canMarkSubject`) — via `src/lib/teacher-scope.ts`. |
| Communication — class/parent messaging | **Partially shipped.** `whatsappCampaigns: ["view","create"]` is already row-scoped to a teacher's own homerooms with `audienceMode` locked to `class_parents`. `emailTemplates`/`whatsappTemplates` are view-only (wording is a school-level task, per the existing permission comment). No SMS/push/internal-messages backend exists for anyone yet — those are dead nav links app-wide, not a teacher-specific gap. |
| Library | **Shipped.** `libraryCatalogue:view`, `libraryCirculation`/`libraryReservations: ["view","create"]` — browse and borrow for themselves. |
| Certificates | **Shipped.** `certificates: ["view","create"]` for their own students (row-level class scoping still owed — tracked in `AUTH-RBAC-ROADMAP.md`, not re-scoped here). |
| Tests & Exams | **View-only today.** `examTypes`/`exams: ["view"]`. Marks entry (`examMarks`, teacher-scoped the same way `studentAttendance` is) is explicitly `EXAM-ROADMAP.md` Phase 4 — this doc doesn't duplicate that plan, just depends on it for §7. |
| AI Assistant | **3 of ~15 tools shipped** (chat assistant, communication-assistant, report-generator — see `AI-ROADMAP.md`). None of the teacher-specific tools the screenshot shows (Event Planner, Homework Helper, Notice Generator) exist. `aiAssistant: ["view","create","delete"]` is already granted and already scoped to the signed-in user's own conversations. |
| Dashboard | **Not teacher-aware.** `dashboard-overview.tsx` is one generic, school-wide-metrics view gated per-card by `useCan` — a teacher opening it mostly sees permission-gated blanks, not "your day." |
| Homework | **Nav link only, no page, no model.** `{ label: "Homework", href: "/academics/homework" }` in `navigation.ts` has pointed at nothing since the sidebar was scaffolded. |
| Study Materials | **Doesn't exist.** Closest relative is the equally-dead "LMS" nav section (`Courses`/`Lessons`/`Assignments`/`Quizzes`/`Learning Materials`) — §5 recommends filling *that* in rather than inventing a second, overlapping "Study Materials" section. |
| Teacher Profile | **No self-service page**, though `Staff` already has everything the screenshot lists (designation, department, subjects via `SubjectAssignment`, joining date, documents via `EmployeeDocument`). Read-mostly UI over existing data — see §6. |

---

## 3. Net-new data models

### 3.1 Attendance lock
The permission grant already hints at this (`studentAttendance: ["view", "create"]` — no `"edit"`), but the route doesn't actually enforce it: `POST /api/attendance` does `existing ? update : create` under the same `create` check, so a teacher can silently re-mark any past date today. Fix, matching the `AttendancePeriodLock` pattern already used for HR staff attendance (`§3023` of `schema.prisma`) but scoped finer, since student attendance is submitted per class/section/subject/date rather than monthly:

```
AttendanceLock { id, schoolId, classId, sectionId, subjectId?, date, lockedById, lockedAt }
@@unique([schoolId, classId, sectionId, subjectId, date])
```

`POST /api/attendance` checks for a lock row before writing; a teacher hitting one gets a 409 ("Attendance for this date is locked — ask your admin to reopen it"). Reopening is a `school_admin`/`principal`-only action (new `studentAttendance:"edit"` grant maps exactly onto "can bypass or clear a lock"), audited the same way `AttendancePeriodLock` reopening already is.

### 3.2 Homework
```
Homework           { id, schoolId, classId, sectionId?, subjectId, teacherId, title, description, attachmentUrl?, dueDate, createdAt }
HomeworkSubmission { id, homeworkId, studentId, submittedAt?, attachmentUrl?, status (pending/submitted/late/graded), marks?, feedback?, gradedById?, gradedAt? }
```
`sectionId = null` = whole class, same convention `SubjectAssignment` already uses. A teacher may only create homework for class/section/subject combinations `getTeacherScope()` returns — reuses `canMarkHomeroom`/`canMarkSubject` verbatim, no new scoping logic. Students see their own via the existing parent/student portal (`PARENT-STUDENT-PORTAL-ROADMAP.md` Phase D already reserved an "Assignments" portal nav slot pending exactly this model).

### 3.3 Study Materials (fills the existing dead "LMS" nav, doesn't add a new section)
```
StudyMaterial { id, schoolId, classId, sectionId?, subjectId, chapter?, title, fileUrl, fileType, uploadedById, createdAt }
```
Uses `src/lib/storage.ts` for the file itself — same disk-today/S3-later seam every other upload (ID cards, certificates, expense attachments) already goes through, no new storage code. Organized `Class → Subject → Chapter` in the UI, filtered by `getTeacherScope()` for who can upload; visible read-only to students/parents in the portal and to other teachers of the same class.

---

## 4. Teacher Dashboard

`(admin)/admin/page.tsx` gains a role branch, same shape as the timetable page's:

```tsx
{user.role === "teacher" ? <TeacherDashboard /> : <DashboardOverview />}
```

`TeacherDashboard` (new, `src/features/dashboard/teacher-dashboard.tsx`) is a thin composition of data **already available** from existing endpoints — no new aggregation route needed for the first cut:
- Greeting + today's date
- Today's schedule → `GET /api/my/timetable`, filtered to today
- Pending attendance (sections in scope with no `Attendance` row for today) → derived client-side from `getTeacherScope()` + a same-day attendance check
- Homework due soon / pending grading → once §3.2 ships
- Quick actions: Take Attendance, Add Homework, Enter Marks (the last gated behind `examMarks:create` once that exists)
- Recent notices → existing News module, filtered to the teacher's audience

---

## 5. AI Teacher Copilot

Extends the existing `AIOrchestrator`/`ToolRegistry` architecture from `AI-ROADMAP.md` §5 — new tools, not a new system. Ship only tools with real data behind them (the same discipline `AI-ROADMAP.md` §2 already applied to exam/payroll):

| Tool | Data available now? |
|---|---|
| Notice Generator, Event Planner, Circular Generator | Yes — text generation, no data dependency. First to ship. |
| Lesson Plan / Worksheet / Question Paper / MCQ / Quiz Generator | Yes, scoped to the teacher's `SubjectAssignment` classes for context (grade level, subject). |
| Parent Message Generator | Yes — drafts into the existing `whatsappCampaigns`/`emailTemplates` send flow, doesn't add a new send path. |
| Student Performance Analyzer, Weak Student Identification, Remedial Plan Generator | **Blocked** on `ExamMark` (`EXAM-ROADMAP.md` Phase 4) — same "don't invent marks" rule `AI-ROADMAP.md` already applied. Deferred until results data is real. |

---

## 6. Teacher Profile

Read-mostly page over data that already exists: `Staff` (designation, department, joining date, contact), `SubjectAssignment` (subjects + classes taught, derived from `getTeacherScope()`), `StaffDocument`. No new model. Account settings (password change) reuses whatever the eventual self-service pattern from `AUTH-RBAC-ROADMAP.md` lands with — not duplicated here.

---

## 7. Phased build order

1. **Attendance lock** (§3.1) — smallest, highest-trust-impact gap; closes a real correctness hole (silently re-markable history) rather than adding a feature.
2. **Teacher Dashboard** (§4) — no new models, pure composition of data that already exists; immediately makes the *landing experience* match the screenshot's spirit without touching any other module.
3. **Homework** (§3.2) — the single biggest genuinely-missing feature area; unblocks the parent/student portal's already-reserved Assignments tab too.
4. **Study Materials** (§3.3) — same shape as Homework, lower urgency, fills the dead LMS nav.
5. **AI Copilot expansion** (§5) — text-generation tools first (no data dependency), analytics tools once Phase 3 of `EXAM-ROADMAP.md` ships marks.
6. **Teacher Profile** (§6) — smallest, do whenever convenient; no dependencies.

Marks entry, exam analytics, and anything else gated on `ExamMark` stay `EXAM-ROADMAP.md`'s problem, referenced here, not re-planned.
