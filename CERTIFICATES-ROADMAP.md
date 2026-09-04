# Certificate Generator Roadmap

**School Management System — from "no certificate module exists" to a full certificate management system: types, templates, numbering, approvals, QR verification, bulk generation, records, and parent-facing requests.**

This document turns the certificate-generator feature brief into a build plan grounded in what's actually in the repo today. It's written from a direct review of `prisma/schema.prisma`, `src/config/permissions.ts`, `src/config/navigation.ts`, `src/lib/storage.ts`, and the existing **ID Card** module on 2026-08-26.

---

## 1. The headline finding

There is no certificate-related Prisma model, route, or UI in the codebase today — this is a net-new module. But it is **not a from-scratch design problem**, because the ID Card module (`prisma/schema.prisma:1368-1573`, `src/features/id-cards/`, `src/app/api/id-card-templates/`, `src/app/api/id-cards/`) already solves almost every hard part of this brief in a different domain:

- A **canvas template designer** with positioned, styled elements bound to dynamic field keys → `IDCardTemplate` + `DesignElement` (`type: text/image/photo/logo/shape/qrcode/barcode/signature/dynamic_field`, `fieldKey: "student.name"`, x/y/width/height/rotation/font/color).
- **Template versioning** on publish → `TemplateVersion` (serialized snapshot + version number).
- **Bulk generation as a trackable job** → `IDCardGenerationJob` + `IDCardGenerationItem` (scope: single/class/section/staff/school/custom_selection; per-person status/error tracking).
- **Public QR verification that doesn't leak PII** → `QRVerification` (opaque `code`, `visibleFieldsJson` allowlist), served from a real public route: `src/app/verify/[code]/page.tsx`.
- **Reissue/replacement without silently overwriting history** → `CardReplacement` (original → new, linked).
- A **PDF renderer** that resolves dynamic fields, embeds QR + signatures/photos, and handles mm→pt layout → `src/lib/pdf/render-card-pdf.ts`, using `pdf-lib` + `qrcode` (both already dependencies).

**The right approach is to clone this pattern into a parallel `Certificate*` model family, not invent a second designer engine.** Certificates need a few things ID cards don't (certificate-type registry, per-type numbering schemes, an approval workflow, and a parent-facing request flow) — those are the genuinely new pieces this roadmap is organized around.

---

## 2. What's already there to build on

**Source data for dynamic fields** — already real Prisma columns, not placeholders:
- `School` (`:30`) — `name`, `logoUrl`, `principalName`, `principalSignatureUrl`, `schoolSealUrl`, `address/city/state/country/pinCode`, `affiliationBoard`, `schoolCode`, `udisePlusCode`, `udiseSchoolId`, `boardAffiliationNumber`, `recognitionNumber`, `rteRegistrationNumber`, `registrationNumber`. This is essentially every field section 13 of the brief asks for — the certificate module should read these, never re-enter them.
- `Student` (`:436`) — `admissionNumber`, `enrollmentNumber`, full name fields, `photoUrl`, `dateOfBirth`, `gender`, `bloodGroup`, `academicYearId/classId/sectionId`, `rollNumber`, `previousSchool/previousClass`, `admissionDate/admissionType`, address fields. Guardian data lives in a separate `Guardian`/`StudentGuardian` join, already linked.
- `Staff` (`:771`) — `employeeId`, name fields, `photoUrl`, `designationId`, `departmentId`, `joiningDate`, `employmentStatus`, with qualifications/experience in `StaffEducation`/`StaffExperience` relations.
- `AcademicYear`, `Class`, `Section` — already carry the labels/codes needed for `{{academic_year}}`, `{{class}}`, `{{section}}`.

**Infrastructure already wired**:
- `src/lib/storage.ts` — local-disk storage with an `UploadKind` union that already includes `"generated_pdf"` (50MB cap, `application/pdf`); certificates can reuse this kind or add `"certificate_pdf"` alongside it. Swap-to-S3 is a one-file change per the existing design.
- `pdf-lib` + `qrcode` already in `package.json`; `src/lib/pdf/render-receipt-pdf.ts` and `merge-pdfs.ts` show the established patterns for single-document and batched PDF output.
- `AuditLog` (`:1672`) — generic `(schoolId, userId, action, entityType, entityId, metadataJson)` — certificate issue/revoke/reissue events log here with no new model.
- The permission system: `src/config/permissions.ts` maps `PermissionModule → ROLE_PERMISSIONS` and is enforced both server-side (`requirePermission()` in routes) and client-side (`useCan()`). No `certificates` module key exists yet — this module must add one (or several, mirroring how ID cards got their own `idCards` key) and follow the identical enforcement pattern.
- `src/config/navigation.ts` has no certificate entry yet; the ID Card section (`:178-192`) is the direct template to clone for a new "Certificate Management" `NavSection`.

**One dependency worth flagging**: the approval workflow (section 7 of the brief — "who approved and when") is only meaningful once approvals are tied to a real logged-in user. A `passwordHash`/session migration (`prisma/migrations/20260824190621_add_sessions_and_password_auth/`) already exists in the tree, so real authentication may already be landing in parallel — confirm its status before building `approvedBy`/`generatedBy` as real `userId` foreign keys rather than free-text.

---

## 3. Data model (net-new)

Mirroring the ID card family, with the extra pieces the brief specifically calls for:

- **`CertificateType`** — school-scoped (nullable `schoolId` for system-provided defaults, same pattern as `IDCardTemplate.schoolId`), `key` (e.g. `transfer_certificate`), `name`, `category` (`student`/`staff`), `numberingPrefix` (e.g. `TC`), `requiresApproval` (bool), `isActive`. Seed the ~35 types listed in the brief as system rows, editable per school.
- **`CertificateTemplate`** + **`CertificateDesignElement`** — same shape as `IDCardTemplate`/`DesignElement`, scoped to a `CertificateType` instead of a card category. Reuse `DesignElement`'s element types (text/image/qrcode/barcode/signature/dynamic_field) directly; add `fieldKey` values for the certificate-specific fields in section 3 of the brief (`student.previousSchool`, `staff.designation`, etc.) in `src/lib/certificates/resolve-fields.ts`, following `src/lib/id-cards/resolve-fields.ts`.
- **`CertificateTemplateVersion`** — same as `TemplateVersion`.
- **`CertificateNumberingSequence`** — one row per `(schoolId, certificateTypeId, academicYearId)`, holding `prefix`, `nextNumber`, `padding`. Generation increments this transactionally — this is the piece with no ID-card analog, since cards don't need year-scoped sequential numbers.
- **`Certificate`** — the issued record: `certificateNumber` (formatted from the sequence), `status` (`draft/submitted/pending_approval/approved/rejected/generated/issued/revoked/cancelled`), `studentId?`/`staffId?`, `certificateTypeId`, `templateId`, `academicYearId`, `issueDate`, `pdfUrl`, `generatedByUserId`, `approvedByUserId?`, `approvedAt?`, `fieldValuesJson` (frozen snapshot of resolved field values at issue time, so later edits to the student/staff record don't retroactively change an already-issued certificate).
- **`CertificateApprovalStep`** — ordered approval chain per `CertificateType` (e.g. class-teacher → admin → principal), plus a per-`Certificate` `CertificateApproval` history row (who, when, decision, comment) — same shape as the ID-card-adjacent recruitment module's interview/offer approval trail already in the schema.
- **`CertificateVerification`** — same shape as `QRVerification`: opaque `code`, `visibleFieldsJson` allowlist (certificate number, name, type, school, issue date, status — explicitly not marks/address/contact per the brief's "don't expose unnecessary information" rule), served from a new public route `src/app/verify-certificate/[code]/page.tsx` (kept distinct from `verify/[code]` so ID-card and certificate codes don't collide).
- **`CertificateReissue`** — same shape as `CardReplacement`: original certificate → cancelled, new certificate issued, reason, approver, timestamp — never overwrites the original row.
- **`CertificateRequest`** — the section-15 addition: a parent/student self-service request (`certificateTypeId`, `requestedByUserId`, `studentId`, `reason`, `status: pending/approved/rejected/fulfilled`, resulting `certificateId` once fulfilled).

---

## 4. Phased build order

### Phase 1 — Certificate types & numbering (foundation)
`CertificateType` model + seed data for the ~35 student/staff types in the brief, `CertificateNumberingSequence`, and a settings page (`/certificates/types`) to let a school edit prefixes, toggle types on/off, and mark which types `requiresApproval`. No PDF generation yet — this phase just gets the registry and numbering right, since every later phase depends on it.

### Phase 2 — Template designer
Clone the ID card designer UI/canvas (`src/features/id-cards/` → `src/features/certificates/`) onto `CertificateTemplate`/`CertificateDesignElement`. Reuse the same drag-position-style-bind interaction; the main new work is the certificate-specific field-code palette (`resolve-fields.ts`) and portrait/A4-oriented page sizing instead of card-sized artboards. Ship with a handful of pre-built templates (Bonafide, TC, Character, Study Certificate) as system templates, same as ID cards ship system templates today.

### Phase 3 — Individual generation
`Certificate` model, the search-student-or-staff → pick type → pick template → generate flow, PDF rendering via a `render-certificate-pdf.ts` built on `render-card-pdf.ts`'s pattern, field-value snapshotting into `fieldValuesJson`. This is the first phase that produces a real downloadable certificate and should ship before bulk/approval so there's an end-to-end path to test against.

### Phase 4 — Approval workflow
`CertificateApprovalStep` + `CertificateApproval`, gated per `CertificateType.requiresApproval`. Status transitions (`draft → submitted → pending_approval → approved/rejected → generated → issued`) enforced server-side. Depends on real `userId`s existing (see the auth-migration note in section 2) for `approvedByUserId` to be meaningful rather than free text.

### Phase 5 — Bulk generation
`CertificateGenerationJob`/`Item` (same shape as `IDCardGenerationJob`/`Item`), scoped by class/section/multi-select, reusing `merge-pdfs.ts` for combined output. Runs through the same approval gate per-item if the selected type requires it.

### Phase 6 — QR verification, revoke & reissue
`CertificateVerification` + public verify route, `CertificateReissue`, admin actions to revoke/cancel. Copy the "don't expose more than an allowlist" pattern from `QRVerification.visibleFieldsJson` directly — do not build a second, looser verification path.

### Phase 7 — Records, search, and student/staff profile integration
The centralized "Generated Certificates" list (table 8 of the brief) with the filters in section 9, plus a "Certificates" tab on the student profile page and the staff profile page (student documents already have a precedent tab pattern to copy — `StudentDocument` and the school-documents card in `src/features/school-profile/`).

### Phase 8 — Delivery
Download/print (immediate, PDF already exists by Phase 3), email — depends on whichever notification/email mechanism the Communication phase of the master roadmap (`AUTH-RBAC-ROADMAP.md` Phase 9) lands; don't build a one-off mailer here if that's imminent. WhatsApp/SMS delivery is explicitly out of scope until that shared mechanism exists.

### Phase 9 — Certificate Requests (parent/student self-service)
`CertificateRequest` model + a portal-side "Request a Certificate" screen (depends on the parent/student portal identity work in `AUTH-RBAC-ROADMAP.md` Phase 4) and an admin-side "Certificate Requests" queue that resolves into Phase 3/4's generate+approve flow.

### Phase 10 — Dashboard & reports
The metrics in section 14 of the brief (total/this-year/pending/issued/revoked/verification-attempts) plus most-generated-types and monthly trend — a straightforward aggregation dashboard once Phases 1–7 have real data to count.

### Phase 11 — Digital signatures & seals settings
A `/settings/certificate-signatures` page storing principal/VP/class-teacher signature images and school seal, reusing `School.principalSignatureUrl`/`schoolSealUrl` where the certificate is school-wide and extending with a small `CertificateSignatory` model only where per-role signatures beyond what's already on `School` are needed (e.g. a specific class teacher's signature). This can land as early as Phase 2 in parallel, since templates need to reference it.

---

## 5. Permissions & navigation additions

- Add `PermissionModule` keys: `certificateTypes`, `certificateTemplates`, `certificates`, `certificateApprovals`, `certificateRequests` — following the exact `idCards` precedent in `src/config/permissions.ts`. Suggested default grants: `school_admin`/`principal` get full access including approve; `teacher` gets `create`+`view` on student certificates for their own class (row-level, same pattern as the HOD department-scoping already documented in `AUTH-RBAC-ROADMAP.md` §5); `hr` gets the staff-certificate equivalent; `parent`/`student` get `create` only on `certificateRequests` (they request, never generate directly).
- Add a new `NavSection` "Certificate Management" cloning the ID Card section's shape (`src/config/navigation.ts:178-192`), with the menu structure from section 15 of the brief (Dashboard, Certificate Types, Templates, Designer, Generate, Bulk Generate, Pending Approvals, Generated Certificates, Verification, Requests, Revoked/Cancelled, Settings, Signatures, Reports, Audit Logs) — collapse several of these into tabs within fewer top-level routes rather than 16 separate pages, matching how the ID Card module already consolidates dashboard/generate/templates under `/id-cards`.

---

## 6. Immediate next steps

1. Confirm whether the `add_sessions_and_password_auth` migration means real login/session is already usable — if so, Phase 4's approval workflow can use real `userId`s from day one; if not, stub `approvedByUserId` as nullable and backfill once auth lands, rather than blocking this whole module on it.
2. Build Phase 1 (types + numbering) and Phase 2 (designer, cloned from `src/features/id-cards/`) together on a branch — the designer is meaningless without a type/numbering registry to attach templates to, and vice versa.
3. Seed system `CertificateType` rows and 3-4 system `CertificateTemplate`s (Bonafide, TC, Character, Study Certificate) so Phase 3's generate flow has something real to test against immediately.
4. Defer the approval workflow (Phase 4) and bulk generation (Phase 5) until a single certificate type can be designed, generated, downloaded, and verified end-to-end — prove the core loop before adding process around it.
5. Revisit `CLAUDE.md`'s module list once this lands; it currently doesn't mention ID Cards either, so it's already behind actual shipped modules.

---

*Compiled from a direct review of the codebase (schema, ID Card module, permission matrix, navigation config, storage layer) on 2026-08-26. Treat the certificate-generator feature brief as superseded by this document wherever the two disagree on how a feature should be built — the brief describes desired behavior; this document maps it onto what already exists in the repo.*
