# Attendance Module Roadmap

**Giving Attendance its own dedicated section — Dashboard, Mark Attendance (admin-facing), Calendar, Student profile, Class Reports, Defaulters, and Settings — on top of the marking/lock/scoping infrastructure that already exists and already works.**

This document answers: *what would it take to turn Attendance from "a dead nav link plus a slice of the general Dashboard" into the full module described, without rebuilding what's already real?*

Compiled from a direct review of the codebase (schema, permission matrix, navigation config, `src/lib/teacher-scope.ts`, `TEACHER-PORTAL-ROADMAP.md` Phase 1) on 2026-09-03.

---

## 1. The headline finding

More of this already works than it looks like from the sidebar. `Attendance` (`prisma/schema.prisma`) already supports both daily and period-wise marking (`subjectId` nullable — spec §14's "Daily / Period-wise / Both" is already the actual behavior, not a setting to add), `AttendanceLock` (just shipped, `TEACHER-PORTAL-ROADMAP.md` Phase 1) already enforces lock-after-submission with an audited admin override, and the general admin Dashboard (`src/features/dashboard/dashboard-overview.tsx`) already renders today's present/absent/not-marked split, a weekly trend chart, and a class-wise breakdown table — just inside `/admin`, not a dedicated Attendance section.

What's actually missing is **surface area for the admin side**: `{ label: "Attendance", href: "/academics/attendance" }` in `navigation.ts` has pointed at nothing since the sidebar was scaffolded, so today only teachers can mark attendance at all (`/students/my-classes`) — an admin can only do it by calling the API directly. `/reports/attendance` is the same kind of dead link. There is no Calendar view, no per-student attendance history on the student profile, no Defaulters feature, and no settings screen.

**Confirmed with the user**: the admin override built in Phase 1 (edit directly through a lock, auto-logged) stays as-is — no separate `AttendanceCorrectionRequest` approve/reject queue. That simplifies this roadmap: no new workflow model, no review UI, just direct-edit-with-audit-trail everywhere admin correction comes up below.

---

## 2. What already exists (don't rebuild this)

| Spec section | Status |
|---|---|
| §2 Attendance Dashboard (today's %, present/absent/not-marked, weekly trend, class-wise table) | **Shipped**, on `/admin` — `dashboard-overview.tsx` + `AttendanceTrendChart` + `AttendanceByClass`. §3 needs a dedicated page; the aggregation logic already exists and should be reused, not rewritten. |
| §3/§5 Mark Attendance, "Mark all present" default | **Shipped for teachers** — `/students/my-classes`, `GET /api/my/students`, `POST /api/attendance`. **Missing for admins** — no page lets a school_admin/principal browse *any* class/section and mark, only their own via `getTeacherScope()`. |
| §4 Attendance statuses (Present/Absent/Late/Half Day/Leave) | **Shipped** — `ATTENDANCE_STATUSES` (`src/lib/constants/attendance.ts`). Per-school configurable statuses (spec's "you can also allow...") is a bigger schema change or none of the five real schools this app will onboard first are likely to need it — deferred, not core. |
| §6 Lock after submission, admin override with audit trail | **Shipped** — `AttendanceLock`, Phase 1. |
| §9 Student attendance profile | **Missing.** No attendance section anywhere on the student detail page (`src/app/(admin)/students/[id]/page.tsx`) today. |
| §10 Class attendance report, export | **Missing** as a page. Data (`Attendance` rows) is all there; `/reports/attendance` is a dead link. Export follows the same `toCsv`/`downloadCsv` pattern already used everywhere (e.g. `class-table.tsx`). |
| §11 Defaulters | **Missing.** No threshold concept exists anywhere yet. |
| §8 Calendar | **Missing.** Pure read/render over existing `Attendance` rows — no new model. |
| §12 Automatic notifications (absent → parent) | **Missing**, and bigger than it looks: the `Notification` model today is school-wide/news-shaped (no recipient field at all — see `prisma/schema.prisma` model `Notification`). Real per-recipient delivery already exists, just not wired to attendance: `whatsappCampaigns`/`emailTemplates`. Treat as its own phase, reusing those channels rather than inventing a new notification-recipient system. |
| §13 Analytics beyond what the Dashboard shows (highest/lowest class, most-absent students, day-of-week) | **Missing** as a page; same "aggregation query, no new model" shape as everything else here. |
| §15 Data model (`AttendanceSession`/`AttendanceRecord` split) | **Not adopted as proposed.** `Attendance` already *is* one row per student per date(+subject) — splitting into a `AttendanceSession` (the roster-level "this class was marked on this date") + `AttendanceRecord` (per-student) pair is a real normalization improvement (today "was this class marked today" is inferred by counting rows, not a first-class fact), but it's a migration touching the module's most heavily-used table for a benefit (mostly query convenience) that doesn't block anything below. Deferred — flagged, not scheduled. |

---

## 3. Net-new data model

Only one thing here actually needs a new model — everything else in §2's "Missing" column is a new page over existing data, not new storage.

```
AttendanceSettings {
  id, schoolId (unique)
  mode                 String  @default("both")   // daily | period | both — descriptive only; both are already supported regardless
  warningThreshold      Float  @default(90)
  criticalThreshold     Float  @default(75)
  allowHalfDay          Boolean @default(true)
  allowLate             Boolean @default(true)
  allowLeave            Boolean @default(true)
}
```

One row per school, same shape as `LibrarySettings`. `lockAfterSubmission` from spec §14 is **not** a toggle — Phase 1 already made this unconditional (a teacher's submission always locks; that's the whole point), and making it optional would mean re-adding the exact silent-re-edit hole Phase 1 closed. If a school genuinely doesn't want it, that's a policy conversation, not a checkbox.

---

## 4. Navigation

Replace the single dead `Attendance` link under Academics with a real section (mirrors how `EXAM-ROADMAP.md` gave Examinations its own top-level section rather than nesting it):

```
Attendance
├── Dashboard        /academics/attendance
├── Mark Attendance  /academics/attendance/mark        (admin/principal — teachers keep using /students/my-classes)
├── Calendar         /academics/attendance/calendar
├── Reports          /academics/attendance/reports     (fills the existing dead /reports/attendance link — redirect, don't duplicate)
├── Defaulters        /academics/attendance/defaulters
└── Settings          /academics/attendance/settings   (school_admin/principal only)
```

Student attendance profile is a tab on the existing student detail page, not a new route. Staff attendance already has its own real section under HR — untouched.

---

## 5. Permissions

No new `PermissionModule` needed — everything here reads/writes `studentAttendance`, already real. `AttendanceSettings` maps onto the existing `view`/`edit` split (view: anyone who can already view attendance; edit: same admin-tier roles that can already bypass a lock, per Phase 1).

---

## 6. Phased build order

1. ✅ **Student attendance profile tab** — smallest, no new model, immediately useful (this is the "parents/teachers find this very useful" item from spec §9). Ships as a collapsible section on the student detail page (`GET /api/students/[id]/attendance`).
2. ✅ **Admin Mark Attendance page** (`/academics/attendance/mark`) — reuses a `RosterView` extracted from `my-classes/page.tsx`, swapping `getTeacherScope()`-derived class list for the admin's full class/section list (`classService`/`sectionService`). `canBypassLock` prop threads the Phase 1 lock-override through to the admin path.
3. ✅ **Dedicated Attendance Dashboard page** (`/academics/attendance`) — `getAttendanceOverview()` in `src/lib/attendance-dashboard.ts` shared with the general `/admin` Dashboard's attendance widget; the dedicated page's `byClass` additionally covers every active class (`includeUnmarkedClasses: true`), including ones nobody's marked yet, with a "Mark now"/"Review" deep link into the mark page.
4. ✅ **Class Reports + export** (`/academics/attendance/reports`) — date-range/class/section/subject picker, per-student status breakdown, CSV export (`toCsv`/`downloadCsv`). `/reports/attendance` now redirects here instead of dead-ending.
5. ✅ **Calendar view** (`/academics/attendance/calendar`) — per-student month grid (`GET /api/students/[id]/attendance/calendar`), class/section/student picker, status legend.
6. ✅ **Defaulters + `AttendanceSettings`** (`/academics/attendance/defaulters`, `/academics/attendance/settings`) — one row per school (`warningThreshold`/`criticalThreshold`/`allowHalfDay`/`allowLate`/`allowLeave`/`mode`); Defaulters lists every active student below `warningThreshold` over a date range (default: active academic year to date), worst first, tiered by `criticalThreshold`. The `allow*` toggles are wired live into `RosterView`'s status picker — turning one off actually removes it from the marking screen, not just from storage.
7. ⏸ **Notifications** (absent → parent via WhatsApp/email) — still deferred: depends on deciding how attendance events plug into the Communication module, which is its own separate, not-yet-scoped piece of work.

Analytics beyond what the Dashboard page (step 3) already covers — day-of-week patterns, most-absent students — folded into steps 3/4 rather than a separate phase; no new data or UI pattern was needed once those two existed.
