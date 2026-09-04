# Examination Management Roadmap

**School Management System — from a 4-link nav stub under Academics to a full Fedena-style exam lifecycle: exam creation, planner, scheduling, subject-wise marks setup, marks entry, verification/locking, result calculation, grading, report cards, ranking, and publishing.**

This document turns the pasted exam feature brief (2026-08-27) into a build plan grounded in what's actually in the repo. It's written from a direct review of `prisma/schema.prisma`, `src/config/permissions.ts`, `src/config/navigation.ts`, and the existing **Certificates**, **Attendance**, **News** (audience targeting), and **HR/Recruitment** modules on 2026-08-27.

---

## 1. The headline finding

There is no exam-related Prisma model, route, or feature code today. What exists is a **navigation stub only** — `src/config/navigation.ts` lists "Examinations", "Gradebook", "Results" and "Report Cards" under the **Academics** section, all pointing at pages that were never built. There is also no `academics/` route directory at all — the stub links 404.

Two extra placeholders exist that matter for design:
- **`Class.gradingSystem` and `Subject.gradingSystem` are free-text `String?` columns** (`schema.prisma`) already surfaced in the Class/Subject forms as a plain dropdown of `GRADING_SYSTEMS = ["Percentage", "GPA", "CGPA", "Letter Grade"]` (`src/lib/constants/school.ts`). This is a label, not a configured grade scale — no grade bands, no percentage cutoffs. The exam module's own Grading System (§11 of the brief) supersedes this the same way `StudentTransport` superseded `Student.busNumber`/`route`/`pickupPoint` in `TRANSPORT-ROADMAP.md` — the two free-text fields stay as-is (still meaningful as a class/subject-level default label) but are not the source of truth once a real `GradingSystem`/`GradeBand` pair exists.
- **`src/config/navigation.ts`'s "Reports & Analytics" section already links `/reports/examinations`**, and `portalNavigation` already links `/portal/results` — both unbuilt today. Neither needs touching now; they're natural landing spots for Phase 10/13 of this roadmap.

Everything else in the codebase this module can lean on without inventing anything new:
- **`CertificateType`** (`schema.prisma:1649`, a per-school master with a code/key, category, and active flag) is the template for **`ExamType`** — Unit Test, Quarterly, Half-Yearly, Annual, Practical, Internal Assessment, etc., exactly the brief's own recommendation ("don't hard-code Quarterly/Term Exam as separate modules — build one configurable Exam Type feeding one Exam Creation flow").
- **`NewsAudienceTarget`** (`schema.prisma:2575`, `newsId`/`classId`/`sectionId?` where a null section means "whole class") is the exact shape for **`ExamClass`** — an exam's applicable classes/sections — and the news feature's audience-picker UI (`src/features/news/news-form.tsx:330-386`: pick a class, optionally a section, Add, removable chips) is the exact UI pattern this module's "Applicable Classes & Sections" step reuses.
- **`SubjectAssignment`** (`schema.prisma:406`, subject × class × section × teacher, with `sectionId = null` meaning "every section") is the template for **`ExamSubject`** — the brief's §5 subject-wise max/pass marks setup — once that phase lands.
- **`AttendancePeriodLock`** (`schema.prisma:2757`, `lockedById`/`lockedAt`/`reopenedById`/`reopenedAt`/`reopenReason`/`isLocked`, one row per `(schoolId, year, month)`) is the exact shape for **`ExamMarksLock`** — the brief's §9 marks-verification workflow ("teacher enters → class teacher verifies → controller locks → nobody edits until an authorized reopen"). Same "reopening is recorded, never silent" discipline.
- **`Attendance`** (`schema.prisma:1954`, one row per student × date × subject, with `markedById`) is the template for **`ExamMark`** — one row per student × exam × subject, with `enteredById`.
- **`src/lib/teacher-scope.ts`** (`getTeacherScope`, `canMarkSubject`) already resolves "which class/section/subject combinations does this teacher hold a `SubjectAssignment` for" and is reused as-is to scope marks entry — a teacher can only enter marks for the subjects they actually teach, the same row-level check `studentAttendance` already applies.
- **`Notification`** (`schema.prisma:2637`) and **`AuditLog`** (`schema.prisma:1920`) are already generic — exam-published/result-published notices and every create/edit/lock/publish action are new rows on these existing tables, not new mechanisms.
- **`src/lib/pdf/render-card-pdf.ts`** (element-tree → PDF renderer already used for ID cards/certificates, keyed by `DesignElement`-shaped rows with `fieldKey` dynamic-field resolution) is the direct template for the Report Card Designer (brief §14) — a `ReportCardTemplate`/`ReportCardElement` pair shaped exactly like `IDCardTemplate`/`DesignElement`, rendered through the same PDF pipeline with new field keys (`student.examTotal`, `student.rank`, ...).
- **`AcademicYear`** already carries `promotionDate`/`resultPublicationDate` (`schema.prisma:248`) — the exam module's result-date concept is a per-exam refinement of a pattern the schema already models at the year level.

---

## 2. Data model (net-new)

Naming follows the existing convention of a flat prefix (`Exam*`), not a nested namespace.

**Foundation (Phase 1 — shipped in this pass)**
- **`ExamType`** — schoolId, name, code, `examCategory` (`summative`/`formative`), sortOrder, status (`active`/`inactive`). Per-school master, same shape as `EmployeeType`; no system-shared registry (unlike `CertificateType`) since exam types are entirely school-specific vocabulary.
- **`Exam`** — the Exam Creation entity itself: schoolId, academicYearId, examTypeId, name, code, `term` (free-text for now — see Phase 3), startDate, endDate, resultDate?, `resultType` (`marks`/`grades`/`marks_and_grades`), `status` (`draft`/`scheduled`/`ongoing`/`completed`/`results_pending`/`published`/`archived`). Unique on `(schoolId, academicYearId, code)`, same collision shape `Class` already uses.
- **`ExamClass`** — join table: examId, classId, sectionId? (null = every section of the class). Directly mirrors `NewsAudienceTarget`.

**Subject setup & marks distribution (Phase 2)**
- **`ExamSubject`** — examId, classId, sectionId?, subjectId, maxMarks, passingMarks, weightagePercent?, examDurationMinutes?. The brief's §5/§6 table (max/pass marks per subject, optionally split into theory/internal/practical components via a `marksComponents` sub-table if a school needs it — deferred until a school actually asks, per the "don't design for hypothetical requirements" discipline).

**Schedule (Phase 3)**
- **`ExamSchedule`** — examSubjectId, examDate, startTime, endTime, roomId? (free-text room for now, no room-booking model exists), invigilatorStaffId?. One row per subject per exam, replacing the brief's flat date/subject/time table.
- **`term` on `Exam` graduates into an `ExamTerm`** master (Term 1/Term 2/Final Term, ordered) only once a school actually asks for the Exam Planner's grouped view (brief §3) — kept a free-text field until then, exactly the same restraint the roadmap gives grading components above.

**Marks entry & verification (Phase 4)**
- **`ExamMark`** — examSubjectId, studentId, marksObtained?, grade?, `attendanceStatus` (`present`/`absent`/`medical_leave`/`exempted`/`malpractice`), remarks?, enteredById, enteredAt. One row per student per exam-subject, same cardinality as `Attendance`.
- **`ExamMarksLock`** — one row per `(examSubjectId)` or per `(examId, classId, sectionId)` depending on how granularly a school wants to lock (default: lock per exam-subject, matching how a subject teacher submits their own marks independently) — `lockedById`/`lockedAt`/`reopenedById`/`reopenedAt`/`reopenReason`/`isLocked`, directly cloned from `AttendancePeriodLock`.

**Grading (Phase 5)**
- **`GradingSystem`** — schoolId, name, isDefault. A school can define more than one (e.g., one for junior classes, one for senior CGPA).
- **`GradeBand`** — gradingSystemId, minPercent, maxPercent, grade, gradePoint?, remark?. The brief's §11 table (91-100 → A1, etc.).
- **`Exam.gradingSystemId`** (nullable FK, added in this phase, not Phase 1) — falls back to the school's default `GradingSystem` when unset, same "resolved live, not snapshotted" reasoning `LIBRARY-ROADMAP.md` used for member borrowing limits.

**Results & ranking (Phase 6)**
- **`ExamResult`** — examId, studentId, totalMarks, percentage, grade?, rank?, sectionRank?, status (`pass`/`fail`/`pending`). Calculated, not entered — a materialized rollup of `ExamMark` rows, recomputed whenever marks change until the exam is locked/published, then frozen.
- **`ExamWeightage`** — for combining multiple exams into a term/annual result (brief §12): examId, weightPercent, groupedUnder (a term or the academic year). Only needed once a school actually asks for a computed Term/Annual result rather than viewing each exam's result independently — sequenced after the per-exam loop is solid, same "prove the loop, then add process" discipline the other roadmaps followed.

**Report cards (Phase 7)**
- **`ReportCardTemplate`** / **`ReportCardElement`** — `IDCardTemplate`/`DesignElement`-shaped, rendered through `render-card-pdf.ts` with new field keys resolving from `ExamResult`/`ExamMark`.
- **`RemarkBankEntry`** — schoolId, category (`academic`/`behaviour`), text. Backs the brief's §15 predefined-remark picker on the marks-entry and report-card screens.

**School relation list** — every model above gets a back-relation on `School`, following the exhaustive list already at `schema.prisma:88-166`; `AcademicYear` gets `exams Exam[]`; `Class`/`Section` get `examClasses ExamClass[]`.

---

## 3. Permissions & navigation

**Permissions** — add an `EXAM_MODULES` group to `src/config/permissions.ts`, following the exact `LIBRARY_MODULES`/`TRANSPORT_MODULES` precedent: declare the full matrix now even though only `examTypes`/`exams` have real routes in this pass, so later phases don't need to reshape it.

```
examTypes         // Unit Test, Quarterly, Half-Yearly... master list
exams             // Exam Creation — dates, applicable classes/sections, result type
examSchedule      // per-subject date/time/room/invigilator
examMarks         // entering marks — teacher grant is scoped via src/lib/teacher-scope.ts, same as studentAttendance
examVerification  // locking/reopening entered marks
examResults       // calculated totals/rank/pass-fail, and publishing them
examReportCards   // report card templates and generation
gradingSystem     // grade bands and percentage cutoffs
```

Default grants (Phase 1 — only `examTypes`/`exams` are meaningfully exercised by real routes today; the rest are forward-declared):
- `school_admin`/`super_admin` — full access (existing pattern, via `ALL_MODULES`).
- `principal` — `view`/`create`/`edit`/`export` on `examTypes`/`exams`, the same `VIEW_EXPORT_EDIT` tier `SCHOOL_MODULES` already gets them, since exam setup is an academic-configuration activity, not a teacher's day-to-day. `approve` on `examResults` and `verify` on `examVerification` are the natural additions once those phases ship — the exam controller / sign-off role the brief describes.
- `hod` — `view` only on `examTypes`/`exams`, matching their existing read-only oversight of `classes`/`sections`/`subjects`.
- `teacher` — `view` only on `examTypes`/`exams` for now (need to see what's scheduled). `examMarks: ["view", "create"]` scoped through `src/lib/teacher-scope.ts` arrives with Phase 4, the same row-level-on-top-of-role-grant pattern `studentAttendance` already establishes.
- Everyone else (`accountant`, `hr`, `hr_staff`, `librarian`, `transport_manager`, `hostel_manager`, `parent`, `student`) — no grant; `parent`/`student` gain `examResults: ["view"]` row-scoped to their own child once portal identity (`AUTH-RBAC-ROADMAP.md` Phase 4) exists, same dependency Library/Transport/Certificates all deferred their portal phases on.

**Navigation** — the brief's own §20 recommendation is explicit: *don't* nest "Examinations" as one more link under Academics; give it a dedicated section, because it is the one area with the deepest sub-flow (creation → schedule → marks → verification → results → report cards) of anything in the sidebar.

This directly resolves the placement you flagged ("exam creation section below academic section"): a new **"Examination"** top-level section is inserted **immediately below "School Management"** (`navigation.ts` index 1, right after Academic Years/Classes/Subjects and before Admissions) — not nested under the existing "Academics" section (Attendance/Timetable/Subjects/Assignments/Homework, which stays as-is), and not left where the dead stub links currently sit. The four dead links currently under Academics (`Examinations`, `Gradebook`, `Results`, `Report Cards`) are removed — they superseded nothing real and pointed at pages that never existed — and their eventual functionality lands as new items in the Examination section itself as each phase ships:

`Dashboard (Phase 8) · All Exams · Exam Types · Exam Schedule (Phase 3) · Marks Entry (Phase 4) · Verification (Phase 4) · Results (Phase 6) · Report Cards (Phase 7) · Grading System (Phase 5) · Reports (Phase 9)`

Phase 1 ships only the two that are real: **All Exams**, **Exam Types**. Same "a link to a page that doesn't exist is worse than no link" discipline the HR & Payroll section comment in `navigation.ts` already states, and the same incremental-nav-growth pattern Library's nav shows today (3 real items, not the roadmap's eventual 12).

---

## 4. Phased build order

### Phase 1 — Foundation (shipped in this pass)
`ExamType`, `Exam`, `ExamClass`; the permission-matrix unlock above; the nav restructure. Exam Types management (add/edit/deactivate, same modal-manager pattern as `CertificateTypeManager`) and Exam Creation (list + create/edit form, same page shape as Classes) are both fully usable end-to-end after this phase — a school can define its exam calendar for the year even before scheduling/marks exist.

### Phase 2 — Subject-wise setup
`ExamSubject`. Once a class is selected on an exam, show its assigned subjects (from `SubjectAssignment`) with editable max/pass marks and optional weightage — the brief's §5/§6. This is the first phase that makes an exam's marks entry screen meaningful, since marks entry needs a max mark to validate against.

### Phase 3 — Schedule & Exam Planner
`ExamSchedule` (per-subject date/time/room/invigilator, bulk-create and copy-from-previous-exam actions). Graduate `Exam.term` into a real `ExamTerm` master only if a school asks for the grouped Planner view — otherwise the free-text field already ships in Phase 1 is sufficient. Add "Publish Schedule" (flips exam `status` to `scheduled`) with a `Notification` row.

### Phase 4 — Marks entry & verification
`ExamMark`, `ExamMarksLock`. Marks-entry screen scoped through `getTeacherScope`/`canMarkSubject` exactly as `studentAttendance` already is — a teacher only sees the exam-subjects they hold a `SubjectAssignment` for. Submit → class-teacher verify → controller lock, cloning `AttendancePeriodLock`'s reopen-is-recorded discipline. This is the core loop — the module should be usable end-to-end for "record what every student scored" after this phase even before automatic result calculation exists.

### Phase 5 — Grading system
`GradingSystem`, `GradeBand`, `Exam.gradingSystemId`. A settings-level configuration screen (brief §11) — percentage-to-grade bands, more than one scale per school. Ships after Phase 4 so there's real mark data to grade against when testing it.

### Phase 6 — Result calculation & ranking
`ExamResult`, `ExamWeightage` (deferred sub-part — see §2). Automatic total/percentage/grade/pass-fail/rank computation once marks are locked, plus the "don't display rank" toggle the brief calls out (a boolean on `Exam`, not a new model). Class/section rank computed from `ExamResult` rows scoped to that class/section.

### Phase 7 — Report cards
`ReportCardTemplate`, `ReportCardElement`, `RemarkBankEntry`. Drag-and-drop designer cloned from the ID card/certificate designer, rendered through `render-card-pdf.ts` with exam-specific field keys. Exam Report / Term Report / (eventual) Annual Report per brief §13 — Exam Report is a direct read of one `Exam`'s `ExamResult` rows; Term/Annual reports depend on Phase 6's `ExamWeightage`.

### Phase 8 — Result publishing & dashboard
Publish action flips `Exam.status` to `published`, fires a `Notification`, and (once parent/student portal identity exists — `AUTH-RBAC-ROADMAP.md` Phase 4) surfaces on `/portal/results`. The Exam Dashboard (brief §18: upcoming/completed counts, per-exam schedule/marks/verification/result progress bars) is a straightforward aggregation once Phases 1-6 have real data to count — ship last among the "core" phases, same reasoning `LIBRARY-ROADMAP.md`/`TRANSPORT-ROADMAP.md` used for their own dashboards.

### Phase 9 — Reports
The report categories in brief §19 (pass/fail, grade distribution, top performers, marks-pending, teacher entry status, class/subject averages) feeding the already-linked-but-unbuilt `/reports/examinations` page in the existing "Reports & Analytics" nav section — no new nav section needed, that link is already in place.

### Phase 10 — Student/Parent portal
Read-only results/report-card view in `portalNavigation` (the existing but unbuilt `/portal/results` link). Depends on parent/student portal identity (`AUTH-RBAC-ROADMAP.md` Phase 4) — same dependency Library, Transport, and Certificates all deferred their own portal phases on; don't build a parallel identity resolution here.

**Deliberately out of scope for this roadmap**: exam-weightage-driven annual results and the multi-exam Planner UI beyond a free-text term label, until a school actually exercises them — both are called out above as graduate-when-asked, not build-now, per the same restraint `LIBRARY-ROADMAP.md` applied to its own Phase 14 "premium tier."

---

## 5. Immediate next steps

1. Phase 1 (this pass): `ExamType`/`Exam`/`ExamClass` schema, permission grants, nav restructure, Exam Types manager, and the Exam Creation list/form — proven end-to-end by creating a real exam against a real academic year and class before anything else is layered on.
2. Confirm the marks-locking granularity for Phase 4 with the school before building it — per-exam-subject (a teacher locks their own subject independently) vs. per-exam-class (the whole class's marks lock together). The `AttendancePeriodLock` clone works either way; the roadmap defaults to per-exam-subject but this is a real product decision, not an implementation detail.
3. Don't build `ExamWeightage`/annual results or the grouped Exam Planner UI until Phase 1-4 are proven with one exam type end-to-end — same "prove the loop, then add process" sequencing every other module roadmap in this repo has followed.
4. Revisit `CLAUDE.md`'s module list once Phase 4 lands — it doesn't yet mention Certificates, ID Cards, Library, or Transport either, so it's already behind shipped modules.

---

*Compiled from a direct review of the codebase (schema, permission matrix, navigation config, PDF renderer, and the Certificates/Attendance/News/HR modules) on 2026-08-27. Treat the pasted exam feature brief as superseded by this document wherever the two disagree on how a feature should be built — the brief describes desired behavior; this document maps it onto what already exists in the repo.*
