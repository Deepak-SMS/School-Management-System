# Library Management System Roadmap

**School Management System — from a 5-link nav stub to a full digital library: catalogue, copies, circulation, reservations, fines, acquisition, digital resources, and reporting.**

This document turns the library feature brief (pasted into the session on 2026-08-27) into a build plan grounded in what's actually in the repo. It's written from a direct review of `prisma/schema.prisma`, `src/config/permissions.ts`, `src/config/navigation.ts`, `src/lib/storage.ts`, and the existing **Certificates** and **Fees & Finance** modules on 2026-08-27.

---

## 1. The headline finding

There is no library-related Prisma model, route, or feature code today. What exists is a **navigation stub only** — `src/config/navigation.ts:207-218` lists a "Library" section (Books, Categories, Members, Issue/Return, Fines) that points at pages which were never built — and a `librarian` role that today is granted nothing library-specific: `librarian: { ...grant(["departments"], VIEW_ONLY), expenses: ["view", "create", "edit"] }` (`src/config/permissions.ts:230`). So this is a net-new module, same starting point Certificates was in on 2026-08-26.

It is not a from-scratch design problem, though. Three already-shipped modules solve most of the hard parts of this brief in a different domain, and the right move is to clone their patterns rather than invent new ones:

- **Certificates** (`CertificateType` → `CertificateTemplate` → `Certificate`, `CertificateNumberingSequence`) is the template for a *type registry + transactional numbering* — directly reusable for accession numbers/barcodes (the brief's `LIB-2026-0001245` format is exactly what `CertificateNumberingSequence`'s `{prefix}/{year}/{00001}` pattern already produces).
- **Fees & Finance** (`Payment` → `Receipt`, `ReceiptCounter`, the `expenses` create/approve split) is the template for *a transaction ledger with a librarian-facing collect/waive workflow* — directly reusable for fines.
- **Recruitment** (`Candidate` → `Application` → `ApplicationStatusHistory`) is the template for *a multi-stage record with status history* — reusable for reservations (waiting → ready → fulfilled/expired) and stock verification (expected → found/missing/damaged).

Everything else in the codebase this module can lean on without inventing anything new:
- `Notification` (`schema.prisma:2623`) is already a generic `(schoolId, type, title, description)` row — due-soon/overdue/reservation-ready/fine notices are new `type` values on this table, not a new notification system.
- `AuditLog` (`schema.prisma:1906`) is already generic `(schoolId, userId, action, entityType, entityId, metadataJson)` — every issue/return/fine/lost/write-off event logs here.
- `Holiday` (`schema.prisma:2641`) already exists and already feeds attendance/payroll working-day math — due-date calculation should read this table too, exactly as the brief's §30 asks ("due date calculation excludes holidays").
- `src/lib/storage.ts`'s `UploadKind` union is the established place to add `library_book_cover`, `library_ebook`, `library_damage_photo` — same pattern as `news_image`/`news_attachment`.
- `Student`/`Staff`/`User` already carry everything needed to resolve a member's identity and borrowing class — no new "who is this person" model needed, only a `LibraryMember` row that *links to* them.

---

## 2. Data model (net-net)

Naming follows the existing convention of a flat `Library*` prefix (matching `Certificate*`/`IDCard*`), not a nested namespace.

**Catalogue**
- **`LibraryCategory`** — school-scoped, optional `parentId` for hierarchy (Academic → Mathematics, etc.), `isSystemCategory` for the seeded defaults in brief §18, same shape as `ExpenseCategory`.
- **`LibraryBook`** — the *title*, not a physical item: title, subtitle, author, isbn10/isbn13, publisher, publicationYear, edition, language, pageCount, categoryId, subjectId? (FK to existing `Subject`), classRelevanceJson (class IDs it's relevant to), description, coverImageUrl, deweyDecimal. No shelf/barcode fields here — those belong to the copy, per the brief's own §3 distinction.
- **`LibraryBookCopy`** — one row per physical item: bookId, accessionNumber, barcode, rfidTag? (nullable, integration-ready per §6 — no RFID hardware integration in this codebase, just the column), status (`available/issued/reserved/lost/damaged/under_maintenance/removed`), condition (`excellent/good/fair/damaged/severely_damaged`), shelf/rack/row (override; falls back to the book's default location if unset), purchaseDate, price, acquisitionId? (FK, see below).
- **`LibraryAccessionCounter`** — one row per `(schoolId, year)`, `next: Int` — same transactional-increment pattern as `ReceiptCounter`/`CertificateNumberingSequence`, producing the `LIB-{year}-{00001}` barcode format from the brief's §5 example.

**Membership & circulation**
- **`LibrarySettings`** — one row per school: per-role borrowing rules (`studentMaxBooks`, `studentIssueDays`, `teacherMaxBooks`, `teacherIssueDays`, `staffMaxBooks`, `staffIssueDays`), `maxRenewals`, `finePerDay`, `maxFine`, reminder-day thresholds. The School Admin/Super Admin config surface from brief §30.
- **`LibraryMember`** — links a `Student` or `Staff` to library privileges: `studentId?`/`staffId?`, `membershipStatus` (`active/suspended`), effective limits resolved from `LibrarySettings` at issue time (not copied — always looked up live, so a settings change applies immediately, matching how `FeeStructure` rules are resolved rather than snapshotted at assignment time).
- **`LibraryIssue`** — the circulation transaction: copyId, memberId, issueDate, dueDate, returnDate?, status (`issued/returned/overdue/lost`), renewalCount, issuedById, returnedById, returnCondition?. Due date computed against `Holiday`, same working-day logic as attendance.
- **`LibraryReservation`** — bookId (not copyId — you reserve a title, any copy fills it), memberId, status (`waiting/ready/fulfilled/cancelled/expired`), queue position derived from `createdAt` ordering (no stored rank column, same reasoning `ApplicationStatusHistory` uses an append-only history instead of a mutable stage field), readyAt?, collectByDate?.
- **`LibraryFine`** — issueId, memberId, amount, reason (`overdue/lost/damaged`), status (`pending/paid/waived`), paidOn?, method?, referenceNo?, waivedById?, waivedReason?, collectedById. Mirrors `Payment`'s shape closely enough that the Fees module's collect-money UI patterns transfer directly; deliberately **not** reusing the `Payment`/`Receipt` tables themselves, since those are hard-wired to `studentId` + fee charges and a staff member can owe a library fine too.

**Acquisition**
- **`LibraryVendor`** — name, contactPerson, phone, email, gstNumber, address. No existing analog in the schema; genuinely new.
- **`LibraryAcquisition`** — a purchase/donation/grant record: source (`purchased/donated/government/publisher/grant/other`), vendorId?, purchaseOrderNumber?, invoiceNumber?, quantity, unitPrice, discount, totalCost, receivedDate. Receiving an acquisition is what generates the `LibraryBookCopy` rows (with `acquisitionId` set on each), so purchase history and copy provenance are never two disconnected facts.

**Inventory**
- **`LibraryStockVerification`** — a session: startedAt, completedAt?, expectedCount, status (`in_progress/completed`).
- **`LibraryStockVerificationItem`** — one row per copy scanned/checked during that session: copyId, result (`found/missing/damaged`). Same header+rows shape as `ImportJob`/`ImportError`.

**Digital & engagement (later phases)**
- **`LibraryDigitalResource`** — title, type (`ebook/pdf/audio/notes/research_paper`), fileUrl (via `UploadedFile`), visibilityJson (class/role allowlist, same shape as `NewsAudienceTarget`), viewCount, downloadCount.
- **`LibraryReview`** — bookId, memberId, rating (1-5), comment?, isApproved (moderation flag, matching `NewsComment`'s moderation pattern).
- **`ReadingChallenge`** / **`ReadingChallengeProgress`** — explicitly last (§24), no dependency the rest of the module needs.

**School relation list** — every model above gets a back-relation on `School`, following the exhaustive list already at `schema.prisma:88-155`.

---

## 3. Permissions & navigation

**Permissions** — add a `LIBRARY_MODULES` group to `src/config/permissions.ts`, following the exact `FEES_MODULES`/`CERTIFICATE_MODULES` precedent:

```
libraryCatalogue    // books, copies, categories
libraryCirculation  // issue, return, renew
libraryReservations
libraryFines
libraryMembers
libraryAcquisition  // + vendors
libraryDigitalResources
libraryInventory    // stock verification
librarySettings
```

Default grants:
- `librarian` gets full CRUD across all nine — this is the actual unlock the brief is asking for; today's `librarian: { ...grant(["departments"], VIEW_ONLY), expenses: [...] }` grant has nothing library-specific at all.
- `school_admin`/`super_admin` — full access (existing pattern: they get everything).
- `principal` — view + reports, no circulation/fine actions (matches how principal sits above HR: informed, not operating).
- `teacher` — `view` + `create` on `libraryCirculation`/`libraryReservations` for themselves only (elevated borrowing, no catalogue edit rights) — same row-level-on-top-of-role-grant pattern the HOD department-scope already establishes (`AUTH-RBAC-ROADMAP.md` §5).
- `parent`/`student` — `view` only, row-scoped to their own/their child's records, once the portal phase lands (Phase 11).

**Navigation** — replace the 5-item stub at `navigation.ts:207-218` with a consolidated set (12 items, not the brief's 17 — same collapse-into-tabs approach `CERTIFICATES-ROADMAP.md` §5 used for ID cards/certificates):

`Dashboard · Catalogue (+ Categories tab) · Book Copies · Issue & Return · Reservations · Members · Overdue · Fines · Acquisition (+ Vendors tab) · Digital Library · Stock Verification · Reports · Settings`

`portalNavigation` (`navigation.ts:312-331`) has no Library entry today — add one under "My School" once Phase 11 (portal self-service) lands, alongside the not-yet-built Timetable/Results/Assignments it already links to.

---

## 4. Phased build order

### Phase 1 — Foundation
`LibrarySettings`, `LibraryCategory` (+ seed the brief's §18 default set), the permission-matrix unlock above, and the nav restructure. Nothing user-facing yet beyond a settings page — everything after this depends on it.

### Phase 2 — Catalogue & copies
`LibraryBook`, `LibraryBookCopy`, `LibraryAccessionCounter`. Add-book form, cover image upload (`library_book_cover` upload kind), shelf/rack/row location, barcode generation on copy creation (bulk-generate for a batch of copies). This is the first phase that produces something searchable.

### Phase 3 — Search
Advanced search/filter (brief §4) across title/author/ISBN/subject/category/publisher/language/class/keyword, with availability status per copy. Depends only on Phase 2's data existing.

### Phase 4 — Membership
`LibraryMember`, auto-provisioned from `Student`/`Staff` (same "resolve from an existing record" pattern the ID card/certificate field-resolvers already use for `student.name` etc.), limits resolved live from `LibrarySettings` by role.

### Phase 5 — Issue & return, overdue
`LibraryIssue`. Search-or-scan member → scan/select copy → system checks (membership active, limit reached, fine pending, copy available, reserved-for-someone-else) → issue. Return flow with due-date/fine calculation and condition capture. Overdue dashboard with the 1-7/8-30/30+ day buckets from brief §12. This is the core loop — the module should be usable end-to-end after this phase even without renewals/reservations/fines yet wired.

### Phase 6 — Renewals & reservations
Renewal against `maxRenewals`, blocked by a pending reservation on the title. `LibraryReservation` with queue-position-by-`createdAt`, `Notification` (`type: "library_reservation_ready"`) firing when a copy frees up, auto-advance to the next member if uncollected within the configured window.

### Phase 7 — Fines
`LibraryFine`, calculated from `LibrarySettings.finePerDay`/`maxFine` on return, librarian collect/waive/custom-fine actions with reason capture, tied into `Notification` (`type: "library_fine"`).

### Phase 8 — Lost & damaged
Condition capture on return (excellent/good/fair/damaged/severely damaged) with photo upload (`library_damage_photo`), lost-book replacement-cost calculation (price + processing fee, per brief §14's worked example), copy status transitions to `lost`/`damaged`/`under_maintenance`.

### Phase 9 — Acquisition & vendors
`LibraryVendor`, `LibraryAcquisition`. Receiving an acquisition generates `LibraryBookCopy` rows with `acquisitionId` set — this is what makes "purchase history" and "which copies came from this order" the same fact rather than two things that can drift apart.

### Phase 10 — Dashboard & reports
The stats in brief §1 (total/available/issued/overdue/lost/damaged/reserved book counts, active readers) and the report categories in §28 — a straightforward aggregation once Phases 2-9 have real data to count. Ship last among the "core" phases on purpose, same reasoning as `CERTIFICATES-ROADMAP.md` Phase 10.

### Phase 11 — Student/Parent/Teacher portals
Self-service search/reserve/renew/view-fines/view-history in `portalNavigation`. Depends on the parent/student login identity work tracked in `AUTH-RBAC-ROADMAP.md` Phase 4 — don't build a parallel identity resolution here.

### Phase 12 — Digital library
`LibraryDigitalResource`, `library_ebook` upload kind, class/role visibility gating (same shape as `NewsAudienceTarget`), view/download tracking.

### Phase 13 — Stock verification
`LibraryStockVerification`/`Item`, scan-or-manual reconciliation session, found/missing/damaged summary.

### Phase 14 — Premium/AI tier
Book recommendations, reading challenges, reviews & ratings (`LibraryReview`). Explicitly last, matching the brief's own three-tier recommendation — nothing in Phases 1-13 depends on this, and it needs real circulation history to be worth building at all.

**Deliberately out of scope for this roadmap**: actual RFID/barcode-scanner hardware integration and a self-service kiosk UI. The schema is kept integration-ready (`rfidTag` column, barcode values that any USB scanner's keyboard-emulation input already satisfies since it just types the barcode string into a focused text field), but wiring real hardware is a separate, later effort.

---

## 5. Immediate next steps

1. Build Phase 1 and Phase 2 together on a branch — the catalogue is meaningless without settings/categories to attach it to, and vice versa.
2. Seed `LibraryCategory` with the brief's §18 default list and confirm the accession-number format (`LIB-{year}-{00001}`) against what the school actually wants printed on physical barcode labels before Phase 2's bulk-generate ships.
3. Prove the core loop (Phase 5: issue → overdue → return) end-to-end with a handful of real books and one test member before adding renewals, reservations, or fines around it — same "prove the loop, then add process" sequencing `CERTIFICATES-ROADMAP.md` used.
4. Defer Phase 11 (portals) until parent/student login is real, same dependency `CERTIFICATES-ROADMAP.md` Phase 9 already flagged for certificate requests — don't build a second one-off identity resolution here.
5. Revisit `CLAUDE.md`'s module list once Phase 5 lands — it still doesn't mention Certificates or ID Cards either, so it's already behind shipped modules.

---

*Compiled from a direct review of the codebase (schema, permission matrix, navigation config, storage layer, Certificates and Fees modules) on 2026-08-27. Treat the pasted library feature brief as superseded by this document wherever the two disagree on how a feature should be built — the brief describes desired behavior; this document maps it onto what already exists in the repo.*
