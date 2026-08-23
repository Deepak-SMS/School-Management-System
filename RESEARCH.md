# School Management System — Research Notes

Compiled from prior research: two ChatGPT conversations (2026-08-12 "School Management System Guide" and 2026-07-16 "AI School Management System"), the [Fedena](https://fedena.com/) product, and its [GitHub repo](https://github.com/projectfedena/fedena/). This is a planning reference, not an architecture decision — nothing here is final.

## Vision

Build an AI-native, multi-tenant School Management SaaS — not a clone of Fedena's code, but a modern replacement for what it and similar ERPs do. Target: simplicity, AI-assisted workflows, and mobile-first UX, in a market where most incumbent school ERPs are 10–15 years old with dated interfaces and low AI adoption.

Scale target: many schools on one platform, each with ~1,000 students.

## Market context (from research)

- Large addressable market (India: 1.5M+ schools, plus colleges and coaching institutes cited as reference point).
- Many institutions still run on Excel, paper registers, WhatsApp, or Tally instead of an integrated system.
- Recurring complaints about incumbents: outdated UI, too many clicks per task, poor mobile apps, no AI, poor customization (every school has different fee structures, grading, report cards).
- Competitors named for gap analysis: Fedena, MyClassCampus, CampusCare, Campus 365.

## Reference: Fedena (github.com/projectfedena/fedena)

- Ruby on Rails, Apache 2.0 license, single-tenant architecture, ~546 stars / 1,472 commits.
- Useful as a **feature/functional reference only** — its stack and single-tenant design don't fit a modern multi-school SaaS, so it should not be forked directly.

## Feature module list (combined from both research sessions)

**Core school setup**: School/campus profile, academic years, terms/semesters, classes, sections, subjects, departments.

**Admissions**: Lead tracking, enquiries (website/WhatsApp), counselling, entrance tests, application → approval → enrollment workflow, waiting list, conversion analytics.

**People**: Student profiles (documents, medical info, ID/QR/RFID), parents/guardians (multi-child support), teachers/employees (qualifications, documents, performance).

**Academic operations**: Attendance (daily/biometric/RFID/QR/face recognition/GPS, leave, late/early tracking, parent notification), timetable (incl. AI auto-generation, conflict detection, substitutions), examinations (question bank, scheduling, hall tickets, marks, AI grade analysis), gradebook/report cards, assignments/homework.

**Finance & HR**: Fee heads/structures, discounts/scholarships, payment gateway + reconciliation, income/expense ledger, payroll (salary, PF, ESIC, TDS, payslips), employee attendance/leave.

**Communication**: Central notification engine, SMS/email/WhatsApp/push, internal messaging (admin↔teacher↔parent), circulars.

**Supporting modules**: Library, transport (GPS/live tracking), hostel, inventory/asset management.

**Portals/apps**: Parent portal, student app, teacher app, principal dashboard (revenue, admissions, attendance, AI insights).

**Reports & integrations**: Reusable report engine, analytics dashboards, REST API/webhooks, payment/SMS/WhatsApp/email/accounting integrations.

**AI features** (flagged as the main differentiator): AI attendance summaries, homework/question-paper/lesson-plan generation, AI report/circular drafting, AI timetable generation, fee-defaulter and dropout prediction, student risk scoring, AI parent-reply assistant, AI voice assistant / natural-language querying (e.g. "which students may fail Maths?").

## Tech stack recommended in research

- **Frontend**: Next.js, React, Tailwind CSS, shadcn/ui
- **Backend**: NestJS or Next.js API routes (early stage), PostgreSQL
- **Database/BaaS**: Supabase (fast MVP path) or plain PostgreSQL
- **Auth**: Clerk, Auth.js, or Supabase Auth
- **Storage**: Supabase Storage or Cloudflare R2
- **AI**: Claude / OpenAI / Gemini
- **Payments**: Razorpay (India), Stripe (international)
- **Notifications**: WhatsApp Business API, email, SMS gateway, push

## Multi-tenancy model (proposed)

Tenant → School → Campus hierarchy, with per-school data isolation. Needs: tenant filters / row-level security, authorization layer, audit logs, data-access rules enforced at the database layer, not just the application layer.

## Two roadmap approaches surfaced in research

**Option A — 12-phase / 48-part Fedena-replication roadmap** (from the Aug-12 conversation): Requirements → Architecture → Database/SaaS → Auth/RBAC → Core School → People/Admission → Academic Operations → Finance/HR → Communication → Supporting Modules → Reports/Integrations → Mobile/AI → Production. Phases 0–3 are planning-only (no code); real coding starts at Phase 4. Each part follows: Requirements → Design → Code → Test → Review → Security → Document → Commit.

**Option B — Lean MVP-first roadmap** (from the Jul-16 conversation), 12-month plan:

| Month | Goal |
|---|---|
| 1 | Market research, interviews, competitor analysis |
| 2 | PRD, workflows, database design, UI mockups |
| 3 | Auth and core architecture |
| 4 | Student & Admission modules |
| 5 | Attendance & Fees |
| 6 | Timetable & Academics |
| 7 | Examination & Reports |
| 8 | Parent & Teacher mobile apps |
| 9 | AI features |
| 10 | Pilot with real schools |
| 11 | Improvements and security |
| 12 | Commercial launch |

MVP scope suggested: Login, Student, Teacher, Attendance, Fees, Timetable, Dashboard — everything else comes after a pilot with 3–5 real schools.

**Tension between the two**: Option A defers all coding until an extensive architecture/PRD phase is done; Option B pushes for a working pilot in real schools within ~3 months. Worth resolving explicitly before committing engineering time.

## Business model (from research)

SaaS pricing, either:
- Per-student: e.g. ₹15–50/student/month, or
- Flat monthly tiers (small / medium / enterprise school)

## Open decisions (not yet answered)

- Target market first (India-specific payment/communication integrations vs. global from day one).
- Hosting approach (managed platform like Vercel + Supabase vs. self-hosted).
- Which roadmap to follow — full architecture-first (Option A) or MVP-first (Option B).
