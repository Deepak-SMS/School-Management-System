# HR & Payroll Completion Roadmap

**School Management System — from a working Employee/Recruitment/Attendance/Leave core to a complete HR product: payroll, salary slips, advances, reimbursements, overtime, shifts, staff assets, performance appraisal, employee self-service, and exit/offboarding.**

This document turns the pasted 48-section HR feature brief (2026-08-31) into a build plan grounded in what's actually in the repo. It supersedes `AUTH-RBAC-ROADMAP.md` §Phase 8 ("HR & Payroll completion... the models don't exist yet"), which is now half-true: attendance and leave shipped since that line was written; payroll and everything downstream of it still has not.

---

## 1. The headline finding

**This is not a blank slate.** A direct audit of the repo (schema, permissions, navigation, pages, features, services, API routes) found a substantially built HR core:

- **Employee Management** — `Staff` with education/experience/documents (verification workflow)/activity timeline/transfers (immutable history)/deactivation, full CRUD at `/employees`, bulk import.
- **Recruitment** — the complete `JobPosition → Vacancy → Candidate → Application → Interview (+panel scoring) → DemoClass → Offer → convert-to-Staff` pipeline, all with real pages under `/hr/vacancies`, `/hr/candidates`, `/hr/interviews`, `/hr/offers`.
- **Staff Attendance** — bulk day-sheet marking, monthly summary, `AttendancePeriodLock` (freeze a month, authorized reopen with a recorded reason).
- **Leave Management** — `LeaveType`/`LeaveBalance`/`LeaveRequest`, approval writes `StaffAttendance` rows and updates balances.
- **Holiday & Work Calendar** — `Holiday`, feeds attendance's working-day math already.
- **Employee Certificates** — genuinely production-ready, not a stub: `CertificateType(category: "staff")` seed rows already include experience/employment/service/salary/bonafide certificates, and the generator UI already has a staff-vs-student toggle. This directly satisfies the brief's §23 "Employee Certificates" ask today.

**What the brief asks for that is completely absent** (confirmed by a full schema grep — zero matches, not even a stub model): **Payroll Engine, Salary Structure/Components, Salary Slips, Salary Advances, Reimbursements, Overtime, Shifts, Staff Assets, Employee Self-Service, and a formal Exit/Offboarding workflow.** `employeePerformance` is the one permission module granted real actions (`view/create/edit/evaluate` to `hod`) with **nothing behind it** — no model, route, or page anywhere.

One more thing worth knowing before designing payroll: **`AttendanceSummary` (the response shape from `GET /hr/attendance/summary`) already carries a `payableDays` field and a `readyForPayroll` boolean.** Someone already staged attendance to be payroll's input — the payroll engine should consume that shape, not recompute working-day math a second time.

---

## 2. Reconciling the brief's suggestions against what already exists

- **Roles** — the brief's `SUPER_ADMIN/SCHOOL_ADMIN/HR_MANAGER/PRINCIPAL/HOD/ACCOUNTANT/TEACHER` map directly onto existing roles (`super_admin/school_admin/hr/principal/hod/accountant/teacher`) — no new roles needed. **"EMPLOYEE" is not a role** in this system; a staff member's access is whatever role their `SchoolMembership` holds (often `teacher`, sometimes `hr_staff`). Self-service (§21) is therefore **not a new role or a new `/portal` branch** — `portalNavigation` is architecturally reserved for parent/student external access. Self-service is new pages inside the admin app, row-scoped to `Staff.userId === currentUser`, the same pattern `teacher-scope.ts` already establishes for a teacher's own classes.
- **Employee Certificates (§23)** — already built. Nothing to do here except add any missing letter *types* (e.g. "Promotion Letter", "Appointment Letter" — check against the seeded `CertificateType` list and add rows, not new code) if a phase below needs one that doesn't exist yet (exit/offboarding needs "Relieving Letter", which the seed data's `documentType` enum on `StaffDocument` already anticipates: `resignation_letter`, `relieving_letter`).
- **Audit Log (§26)** — `AuditLog` already exists and is already written to by every mutating route in this codebase (matches `src/lib/audit.ts`'s `recordAudit()`, used throughout). It has no *viewer* UI yet — that's `AUTH-RBAC-ROADMAP.md` §Phase 12, a cross-cutting concern, not HR-specific. Don't build a second HR-only audit system; a shared viewer benefits every module at once.
- **AI HR Assistant (§36)** — the AI module is real (`src/lib/ai/`), but tool-calling doesn't exist yet anywhere in it (`AI-ROADMAP.md` explicitly defers this as "Phase 5", and explicitly lists payroll as out of scope "until the underlying modules ship real data"). The right extension point, once that phase lands, is `narrateStats()` (server computes real HR numbers first, LLM narrates them — "never invent a number") — not a HR-specific chat feature built in isolation.
- **Notifications (§24)** — the generic `Notification(schoolId, type, title, description)` model already powers News' in-app bell. HR notifications are new `type` values on that same table (`leave_approved`, `payslip_generated`, `document_expiring`, `birthday`, ...), not a new notification system.

---

## 3. Data model for the real gaps

Naming follows the existing flat-prefix convention. Every model gets a `schoolId` and a `School` back-relation, per the exhaustive list already at `schema.prisma:88-166`.

**Shifts** (small, feeds payroll's hours math later — not blocking)
- **`Shift`** — name, startTime, endTime, gracePeriodMinutes, breakMinutes, status.
- **`ShiftAssignment`** — staffId, shiftId, effectiveFrom, effectiveTo? — same versioned-assignment shape `SalaryStructureAssignment` below uses.

**Payroll engine**
- **`SalaryComponent`** — name, code, componentType (`earning`/`deduction`), calculationType (`fixed`/`percentage_of_basic`/`formula`), amount?, percentage?, formula?, isTaxable, sortOrder, status. A per-school master, same pattern `FeeCategory`/`EmployeeType` already establish for "school defines its own list."
- **`SalaryStructure`** + **`SalaryStructureItem`** (structureId, componentId, amount/percentage override) — a named bundle of components ("Teacher Grade I").
- **`SalaryStructureAssignment`** — staffId, structureId, effectiveFrom, effectiveTo? (null = current) — the exact `StaffTransfer`/`TransportRouteAssignment` "history via a new row with an effective date," not a mutable pointer.
- **`PayrollRule`** — ruleType (`pf`/`esi`/`professional_tax`/`tds`), effectiveDate, rate/threshold/employeeContribution/employerContribution, applicableEmployeeGroup — versioned by effective date exactly as the brief's §13 asks; this is what keeps changing government rates out of application code.
- **`PayrollPeriod`** — month, year, status (`draft`/`processing`/`approved`/`locked`), lockedById/lockedAt/reopenedById/reopenedAt/reopenReason — **directly clones `AttendancePeriodLock`**, the one piece of prior art in this codebase for "freeze a month, no edits until an authorized reopen."
- **`PayrollEntry`** — periodId, staffId, structureId (snapshotted), payableDays (read from `AttendanceSummary`), earningsJson, deductionsJson, grossSalary, totalDeductions, netSalary, status. One row per staff per period — the reviewable, lockable unit.
- **`SalarySlip`** — entryId, slipNumber (via a `PayrollNumberingSequence`, the exact transactional-increment shape `CertificateNumberingSequence`/`ReceiptCounter` already use), pdfFileId, generatedAt.

**Salary advance & reimbursement** (both mirror the Finance module's existing create/approve split — `expenses:create` widely granted, `expenses:approve` narrow — rather than inventing a new authorization shape)
- **`SalaryAdvance`** — staffId, amount, requestDate, reason, installments, monthlyDeduction, status (`pending`/`approved`/`rejected`/`disbursed`/`completed`), approvedById, disbursedAt. Each `PayrollEntry` for a staff member with an active advance reads its `monthlyDeduction` into that period's deductions — advances don't need their own installment-ledger table; the payroll entries *are* the ledger.
- **`StaffReimbursement`** — staffId, category, amount, expenseDate, description, receiptFileId, status (`pending`/`approved`/`rejected`/`paid`), approvedById, paidAt. Deliberately **not** the existing `Expense` model — `Expense` is school expenditure raised by staff on the school's behalf; this is the school reimbursing a staff member's own money, a different direction of payment with a different owner (the employee, not a cost center).

**Overtime**
- **`StaffOvertime`** — staffId, date, hours, reason (`exam_duty`/`school_event`/`annual_function`/`sports_event`/`extra_class`/`admission_duty`/`weekend_duty`/`holiday_duty`/`other`), rate, amount, approvedById, status. Approved rows feed the same period's `PayrollEntry.earningsJson`.

**Staff assets**
- **`Asset`** — assetType, name, serialNumber, status (`available`/`assigned`/`maintenance`/`retired`).
- **`AssetAssignment`** — assetId, staffId, issueDate, conditionAtIssue, returnDate?, conditionAtReturn?. Same immutable-history shape as `StaffTransfer` — "who has what, and who had what before them" is a row, not a mutable pointer on `Asset`.

**Performance & appraisal**
- **`AppraisalCycle`** — name, startDate, endDate, status.
- **`KRA`** — cycleId, name, description, weight (per-cycle, so a school can change what it measures each year — not a fixed hardcoded list, per the brief's own "configurable KRAs" ask).
- **`PerformanceReview`** — cycleId, staffId, selfScore?, hodScore?, principalScore?, finalScore?, status (`self_pending`/`hod_pending`/`principal_pending`/`completed`).
- **`PerformanceReviewItem`** — reviewId, kraId, target, actual, score, comments.

**Exit & offboarding**
- **`ExitRequest`** — staffId, resignationDate, lastWorkingDate, reason, status (`submitted`/`manager_review`/`approved`/`processing`/`completed`), approvedById.
- **`ExitClearance`** — exitRequestId, department (`hr`/`finance`/`it`/`library`/`administration`), clearedById?, clearedAt?, remarks, status (`pending`/`cleared`). `Staff.employmentStatus` flips to `resigned`/`terminated` (both values **already exist** on the enum) only once every required `ExitClearance` row clears, unless `school_admin` overrides — matching the brief's §22 exactly. The relieving letter this phase needs to generate already has a home: the Certificates module, `CertificateType` category `staff`.

---

## 4. Permissions & navigation

New permission modules (`src/types/permissions.ts`), following the `EXAM_MODULES`/`LIBRARY_MODULES` precedent of declaring the full set now even though phases ship incrementally: `shifts`, `payroll`, `salaryAdvances`, `staffReimbursements`, `overtime`, `staffAssets`, `exitOffboarding`. **`employeePerformance` already exists in the union** — no new key needed, just the models/routes to back the grant that's been sitting unused.

Default grants (mirroring what each role already holds elsewhere): `accountant` gets full `payroll`/`salaryAdvances`/`staffReimbursements` (they already hold `employeeSalary`); `hr`/`hr_staff` get `shifts`/`overtime`/`staffAssets`/`exitOffboarding` at their existing HR tier; `hod` gets `view`+`approve` on the things they already approve (leave, attendance) extended to overtime/reimbursement requests from their own department (row-scoped, same as today); `principal` gets view+approve oversight, no edit — same tier as their existing HR grants.

**Navigation** — extend the existing "HR & Payroll" section (`navigation.ts:113-128`) rather than creating a new one; the brief's `/HR/payroll`, `/HR/advances`, etc. become new items in that same section as each phase ships, following the section's own stated discipline ("no link to a page that doesn't exist"). Employee self-service becomes a new **"My HR"** section, visible to every role, scoped server-side to the signed-in user's own `Staff` row — not a new top-level portal.

---

## 5. Phased build order

### Phase 1 — Shifts
`Shift`, `ShiftAssignment`, permission unlock, nav item. Small and low-risk; ships first only because payroll's hourly/overtime math is cleaner once shift start/end times exist to compare against, not because anything blocks on it.

### Phase 2 — Payroll foundation
`SalaryComponent`, `SalaryStructure`/`SalaryStructureItem`, `SalaryStructureAssignment`, `PayrollRule`. Settings-level configuration screens only — nothing generates a payslip yet. This is the phase that makes "define what a paycheck is made of" a real, school-configurable thing instead of a hardcoded assumption.

### Phase 3 — Payroll processing & salary slips
`PayrollPeriod`, `PayrollEntry`, `SalarySlip` + numbering sequence. The `PayrollPeriod → select employees → fetch AttendanceSummary → calculate → review → approve → lock → generate slips` workflow from the brief's §14, built on the `AttendancePeriodLock`-cloned locking discipline. This is the core loop — payroll should be usable end-to-end for "pay everyone this month" after this phase, even before advances/reimbursements/overtime feed into it.

### Phase 4 — Advances, reimbursements, overtime
`SalaryAdvance`, `StaffReimbursement`, `StaffOvertime`, each with the create/approve split the Finance module already established. Ships after Phase 3 on purpose — these all need a real `PayrollEntry` to deduct into or add onto.

### Phase 5 — Staff assets
`Asset`, `AssetAssignment`. Independent of payroll; sequenced here mainly because it's needed before Phase 7 (exit clearance checks for unreturned assets).

### Phase 6 — Performance & appraisal
`AppraisalCycle`, `KRA`, `PerformanceReview`, `PerformanceReviewItem`. Unlocks the `employeePerformance` permission that's already been granted to three roles with nothing behind it.

### Phase 7 — Exit & offboarding
`ExitRequest`, `ExitClearance`, wired to existing `Staff.employmentStatus`, existing `AssetAssignment` (unreturned-asset check), and the existing Certificates module (relieving letter generation — no new code needed there, just use it).

### Phase 8 — Employee self-service ("My HR")
Read-mostly views of a staff member's own attendance, leave, salary slips, reimbursements, assets, documents inside the admin app, scoped by `Staff.userId`. Deliberately last among the "core" phases — every other phase needs to exist first for there to be anything to show.

### Phase 9 — HR Reports
Fills the one dead nav link found in the audit (`/reports/hr`). A straightforward aggregation once Phases 1-7 have real data to report on — same "ship the dashboard/reports phase last" sequencing every other module roadmap in this repo has used.

**Deliberately out of scope for this roadmap**: an HR-specific notification delivery mechanism (ride the existing generic `Notification` table with new `type` values instead) and an HR-specific AI assistant (blocked on the whole AI module's own tool-calling phase, tracked in `AI-ROADMAP.md`, not HR-specific work).

---

## 6. Immediate next steps

1. Pick a starting phase — see the question posed alongside this document. Payroll (Phases 2-3) is the recommended default: it's the one piece every other missing area (advances, reimbursements, overtime, self-service) either feeds into or displays, the same "foundation everything else depends on" reasoning Exam Creation had in `EXAM-ROADMAP.md`.
2. Whichever phase starts, prove it end-to-end for one real staff member before adding process around it — same "prove the loop, then add process" sequencing every roadmap in this repo has followed.
3. Confirm with the school which statutory deductions (`PayrollRule` types) actually apply before Phase 2 ships its settings screen — PF/ESI eligibility and Professional Tax slabs vary by state, and getting the configuration shape right the first time avoids a schema change later.
4. Update `AUTH-RBAC-ROADMAP.md` §Phase 8 to point at this document once Phase 1 here starts, so the two roadmaps don't drift back out of sync with each other the way §Phase 8 already has with reality.

---

*Compiled from a direct review of the codebase (schema, permission matrix, navigation config, HR/attendance/leave/recruitment/certificates features, and `AUTH-RBAC-ROADMAP.md`/`AI-ROADMAP.md`) on 2026-08-31. Treat the pasted HR feature brief as superseded by this document wherever the two disagree on how a feature should be built — the brief describes desired behavior; this document maps it onto what already exists in the repo.*
