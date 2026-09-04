# Transport Management Roadmap

**School Management System — from a 5-link nav stub and three free-text fields on `Student` to a full transport module: vehicles, drivers, stops, routes, student enrollment, attendance, and fee integration.**

This document turns the transport feature brief (pasted into the session on 2026-08-27) into a build plan grounded in what's actually in the repo. It's written from a direct review of `prisma/schema.prisma`, `src/config/permissions.ts`, `src/config/navigation.ts`, `src/lib/storage.ts`, and the existing **HR/Staff**, **Fees & Finance**, and **Certificates** modules on 2026-08-27.

---

## 1. The headline finding

There is no transport-related Prisma model, route, or feature code today. What exists is a **navigation stub only** — `src/config/navigation.ts:220-230` lists a "Transport" section (Vehicles, Routes, Stops, Drivers, Student Transport) that points at pages which were never built — and a `transport_manager` role that today is granted nothing transport-specific: `transport_manager: { ...grant(["departments"], VIEW_ONLY), expenses: ["view", "create", "edit"] }` (`src/config/permissions.ts:231`). This is the identical starting point Library and Certificates were in before their roadmaps: a placeholder role, a placeholder nav section, net-new schema required.

Two extra placeholders exist here that Library/Certificates didn't have to contend with, and both matter for design:
- **`Student` already carries three free-text transport fields**: `busNumber`, `route`, `pickupPoint` (`schema.prisma:566-568`). These are the same kind of pre-module stub as the old nav links — unstructured strings with no vehicle/route/stop backing them. This module's `StudentTransport` model supersedes all three; the migration path must backfill from them, not leave two competing sources of truth (the same warning `AUTH-RBAC-ROADMAP.md` §Phase 4 gives for `guardianName`/`guardianPhone`).
- **`FeeCategory`'s own doc comment already names "Transport Fee"** as an example fee head (`schema.prisma:1978`) — the schema already assumes transport billing rides on the existing Fees module, not a parallel ledger. Section 3 below builds on exactly that assumption.

Everything else in the codebase this module can lean on without inventing anything new:
- **Staff** (`schema.prisma:824`) + **`StaffDocument`** (`:963`, typed document + `expiryDate` + verification workflow) is the template for *driver identity and driver documents* — a school-employed driver is a `Staff` row with a designation of "Driver"; only the driving-specific fields (license, police verification, medical certificate) are genuinely new.
- **`StaffTransfer`** (`:1077`, a from/to change-log row with `effectiveDate`) is the template for *route/vehicle/driver reassignment history* — the brief's "Change vehicle" and driver-availability tracking is a StaffTransfer-shaped table, not a mutable "current assignment" foreign key that has to be kept in sync by hand.
- **`Payment` → `Receipt`** and, more specifically, **`StudentFeeCharge`'s existing `isManual: true` path** (`schema.prisma:2187`, already designed for "a fully ad-hoc charge with no backing [FeeStructure] item") is the template for *transport fee billing* — see §3.
- **`Notification`** (`:2629`) is already a generic `(schoolId, type, title, description)` row — document-expiry alerts, delay notices, and reservation-style transport alerts are new `type` values on this table, not a new notification system.
- **`AuditLog`** (`:1912`) is already generic `(schoolId, userId, action, entityType, entityId, metadataJson)` — every vehicle/driver/route/assignment change logs here.
- **`Holiday`** (`:2647`) already feeds attendance/payroll working-day math — transport attendance and route scheduling should read this table too, not reinvent "is school open today."
- `src/lib/storage.ts`'s `UploadKind` union is the established place to add `vehicle_document`/`driver_document` — same pattern as `staff_document`/`news_attachment`.
- `Department.departmentType` already includes `"transport"` as an enum value (`schema.prisma:422`) — a school can already have a Transport department with a head; this module doesn't need to invent departmental structure, only the fleet/route data underneath it.

**One deliberate non-reuse worth flagging up front**: unlike Certificates (`CertificateNumberingSequence`) and Library (`LibraryAccessionCounter`), vehicles do **not** need an internally generated sequence number. A vehicle's identity is its real-world RTO registration number, entered once, not system-generated — so no counter model is needed for §3's `TransportVehicle`.

---

## 2. Data model (net-new)

Naming follows the existing convention of a flat `Transport*` prefix (matching `Library*`/`Certificate*`), not a nested namespace.

**Fleet**
- **`TransportVehicle`** — vehicleNumber (RTO registration, unique per school), vehicleType (`bus`/`van`/`car`), make, model, manufacturingYear, seatingCapacity, standingCapacity, fuelType, color, gpsDeviceId? (nullable, integration-ready per the brief's Phase 9 — no GPS hardware/live-tracking pipeline in this codebase, just the column, same reasoning `LibraryBookCopy.rfidTag` used), status (`active/in_service/maintenance/inactive/retired`).
- **`TransportVehicleDocument`** — vehicleId, docType (`rc/insurance/fitness/pollution/permit/tax/other`), documentNumber, issueDate, expiryDate, uploadedFileId. Same shape as `StaffDocument`, just swapped onto a vehicle — reuses the identical expiry-alert + verification pattern rather than inventing a second one.
- **`TransportVehicleMaintenanceRecord`** — vehicleId, serviceDate, serviceType, odometerReading, cost, vendor, nextServiceDate, remarks, invoiceFileId. A simple chronological log, same shape as `StaffActivityLog`.

**Drivers**
- **`TransportDriver`** — `staffId?` (FK to `Staff`, set when the driver is a school employee — the common case, and the one that gets full name/photo/mobile/address/emergency-contact/joining-date/employment-status for free from the existing `Staff` row) **or**, when a school uses a third-party vendor driver who is never entered as `Staff`, a small set of fallback identity fields (`fullName`, `phone`, `photoUrl`, `address`) used only when `staffId` is null. Same dual-identity shape `LibraryMember` already uses for `studentId?`/`staffId?`. Driving-specific fields that exist regardless of which identity path is used: `licenseNumber`, `licenseType`, `licenseIssueDate`, `licenseExpiryDate`, `policeVerificationDate`, `medicalCertificateExpiryDate`, `employmentStatus` (only meaningful for the vendor-driver path; the Staff path already has one).
- **`TransportDriverDocument`** — driverId, docType (`license/id_proof/police_verification/medical_certificate/other`), documentNumber, issueDate, expiryDate, uploadedFileId. Same `StaffDocument`-shaped table as vehicle documents.

**Stops & routes**
- **`TransportStop`** — name, code, address, landmark, latitude, longitude, distanceFromSchool, status.
- **`TransportRoute`** — name, routeNumber, startingPoint, destination, totalDistance, estimatedDuration, status, morningTiming, afternoonTiming. Deliberately **no** `vehicleId`/`driverId` column here — see the next model.
- **`TransportRouteStop`** — join table: routeId, stopId, sequenceOrder, pickupTime, dropTime. Gives a route its ordered stop list without denormalizing stop data onto the route.
- **`TransportRouteAssignment`** — routeId, vehicleId, driverId, startDate, effectiveTo? (null = current). The brief's "assign vehicle/driver to route" and "change vehicle" are both just a new row here, cloning `StaffTransfer`'s from/to-with-effective-date shape — the route's *current* vehicle/driver is "the assignment row with no `effectiveTo`," never a mutable pointer that a UI bug could desync from reality.

**Student transport**
- **`StudentTransport`** — the model that finally replaces `Student.busNumber`/`route`/`pickupPoint`: studentId, routeId, pickupStopId, dropStopId?, direction (`one_way/two_way`), startDate, endDate?, status (`active/inactive`), studentFeeChargeId? (link to the `StudentFeeCharge` this enrollment generated — see §3 — so ending transport can also stop the charge instead of the two silently drifting apart).
- **`TransportAttendance`** — studentTransportId, date, session (`morning/afternoon`), event (`boarded/absent/dropped`), markedByStaffId (the driver/conductor, resolved through `Staff` the same way `Attendance.markedById` already works), timestamp. Same shape as the existing `Attendance`/`StaffAttendance` tables, just scoped to a transport session instead of a school day.

**School relation list** — every model above gets a back-relation on `School`, following the exhaustive list already at `schema.prisma:88-155`.

---

## 3. Transport fees ride on the existing Fees module — no parallel ledger

The brief's Phase 10 asks for route-based, distance-based, or stop-based transport fee rates that show up alongside a student's other fees. `StudentFeeCharge` already supports exactly this without a schema change to the Fees module: it's designed to carry `isManual: true` charges with just a `feeCategoryId` + `label` + `amount` and **no** backing `FeeStructureItem` (`schema.prisma:2176-2184`, "opting a student into an optional item... or a fully ad-hoc charge with no backing item"). So:

- A school creates one `FeeCategory` row named "Transport Fee" (already the exact example in that model's own doc comment) once, the same way any other fee head is created.
- A `TransportFeePlan`-style rate (per route or per distance slab — a small config table: `routeId`, `amount`, `frequency`) feeds a generator that writes an `isManual` `StudentFeeCharge` against that category when a `StudentTransport` row is created, labeled e.g. "Transport Fee – Route 04 (Jan 2027)".
- Payment, receipting, waivers, and the parent-portal fee view then all come from code that already exists (`Payment`/`Receipt`/`StudentFeeAdjustment`) — transport fees appear on the same ledger as tuition, not a second one.

This mirrors the reasoning `LIBRARY-ROADMAP.md` §2 used in the opposite direction: library fines got their own ledger (`LibraryFine`) *because* a staff member can owe one and `Payment`/`Receipt` are hard-wired to `studentId`. Transport fees are student-only, so the existing student ledger is the right fit and a parallel `TransportPayment` table would just be duplicated plumbing.

---

## 4. Permissions & navigation

**Permissions** — add transport module keys to `src/config/permissions.ts`, following the `LIBRARY_MODULES`/`CERTIFICATE_MODULES` precedent:

```
transportVehicles   // vehicles, documents, maintenance
transportDrivers    // drivers, documents
transportRoutes     // routes, route stops, vehicle/driver assignment
transportStops
transportStudents   // student transport enrollment
transportAttendance
transportSettings
```

Deliberately **no** `transportFees` module — per §3, transport billing is just `StudentFeeCharge` rows, so it stays governed by the existing `feeCategories`/`studentFees`/`payments` grants an accountant already has. Adding a second fee-permission key here would fork a single billing concept into two gates.

Default grants:
- `transport_manager` gets full CRUD across all seven keys above — the actual unlock this module is for; today's grant has nothing transport-specific at all, mirroring exactly what `LIBRARY-ROADMAP.md` §3 found for `librarian`.
- `school_admin`/`super_admin` — full access (existing pattern).
- `accountant` — `view` on `transportStudents`/`transportRoutes` (needs to see which route/rate a student is on to explain a charge); no new fee-permission needed since §3 rides the existing `feeCategories`/`payments` grants they already hold.
- **A `driver` role does not exist yet** (`src/types/user.ts:7-20` has `transport_manager` but no `driver`). Marking `TransportAttendance` from a bus needs one — add it the same way `hod`/`hr_staff` were added for the HR Portal's RBAC, scoped to `view`+`create` on `transportAttendance` for their own currently-assigned route only (row-level scoping applied in the route handler on top of the role grant, per the standing discipline `AUTH-RBAC-ROADMAP.md` §Phase 5 already establishes).
- `parent`/`student` — `view` only, row-scoped to their own/their child's `StudentTransport` record, once parent/student portal identity (`AUTH-RBAC-ROADMAP.md` Phase 4) exists. Both roles are `{}` (no grants at all) today.

**Navigation** — replace the 5-item stub at `navigation.ts:220-230` with a consolidated set, collapsing sub-pages into tabs rather than the brief's ~20-item mega-menu — the same collapse Library (17→12) and Certificates (16→5) already applied:

`Dashboard · Vehicles (+ Maintenance, Documents tabs) · Routes (+ Stops tab) · Drivers (+ Documents tab) · Student Transport · Attendance · Reports · Settings`

`portalNavigation` (`navigation.ts:312-331`) has no Transport entry today — add a parent-facing "My Child's Transport" item under "My School" once Phase 4 portal identity lands, alongside the not-yet-built Timetable/Results it already links to. Live GPS tracking inside that view is explicitly a later phase (§5, Phase 9 below) — don't block the basic "which bus, which stop, which driver" view on it.

---

## 5. Phased build order

### Phase 1 — Foundation
`TransportVehicle`, `TransportDriver`, `TransportStop`, the permission-matrix unlock above, and the nav restructure. No routes or student assignment yet — this phase just gets the fleet/driver/stop registries right, since everything after depends on them existing.

### Phase 2 — Documents & maintenance
`TransportVehicleDocument`, `TransportDriverDocument` (license/insurance/fitness/permit/pollution/police-verification/medical, with expiry dates), `TransportVehicleMaintenanceRecord`. Reuses the exact `StaffDocument` expiry-alert shape — a document expiring soon is a `Notification` row (`type: "transport_document_expiry"`), same mechanism Library used for due-soon books.

### Phase 3 — Routes
`TransportRoute`, `TransportRouteStop` (ordered stop sequencing with per-stop pickup/drop times), `TransportRouteAssignment` (vehicle + driver, `StaffTransfer`-shaped history). This is the first phase where "Route 04 → Stop 3 → 7:15 AM" is a real, queryable fact rather than the free-text `Student.route` string.

### Phase 4 — Student transport enrollment
`StudentTransport`, added to the student profile as a "Transport" tab (same precedent as the student-documents tab). Migration script backfills from `Student.busNumber`/`route`/`pickupPoint` where a best-effort match to a real route/stop exists, and flags the rest for manual reconciliation — the three legacy columns are then deprecated, not deleted outright, until every existing student has been reconciled. This is the phase where the module becomes usable end-to-end for "who rides what" even before fees or attendance are wired in.

### Phase 5 — Transport fees
The `TransportFeePlan` rate config + `isManual` `StudentFeeCharge` generator from §3, wired to fire when a `StudentTransport` row is created/ended. Ships after Phase 4 on purpose — a fee needs a real enrollment to attach to.

### Phase 6 — Transport attendance
`TransportAttendance`, the `driver` role addition, and a minimal mark-boarding/mark-drop screen scoped to a driver's own assigned route (from `TransportRouteAssignment`). Depends on Phase 4 (there's nothing to mark attendance against without it).

### Phase 7 — Dashboard & reports
The stats in the brief's Phase 1/Phase 12 (fleet counts, active/maintenance vehicles, students by route, today's pickup/drop status, capacity utilization, expiring documents, fee collection) — a straightforward aggregation once Phases 1–6 have real data to count. Ship last among the "core" phases on purpose, same reasoning `LIBRARY-ROADMAP.md`/`CERTIFICATES-ROADMAP.md` used for their own dashboard phases.

### Phase 8 — Parent/student portal view
Read-only "My Child's Transport" (bus, route, driver, driver phone, pickup/drop time, today's status) in `portalNavigation`. Depends on parent/student portal identity (`AUTH-RBAC-ROADMAP.md` Phase 4) — don't build a parallel identity resolution here, same dependency Library and Certificates both deferred their portal phases on.

### Phase 9 — Notifications
Delay/arrival/emergency/route-change alerts as new `Notification` `type` values, delivered through whatever channel `AUTH-RBAC-ROADMAP.md` Phase 9 (Communication) lands — don't build a one-off SMS/WhatsApp sender here if that shared mechanism is imminent, same call `CERTIFICATES-ROADMAP.md` §Phase 8 made for certificate delivery.

### Phase 10 — GPS / live tracking
Explicitly last, matching both the brief's own recommendation ("Phase 2/advanced feature, not something you need to build first") and `AUTH-RBAC-ROADMAP.md`'s existing placement of GPS-tracked Transport under its Phase 10 supporting-modules bucket. This is architecturally different work from everything above it — a real-time device→API→DB ingestion pipeline and a live map UI, not another CRUD module — and deserves its own scoped design once a device/vendor is actually chosen. The schema stays integration-ready in the meantime (`TransportVehicle.gpsDeviceId`), same as Library kept `rfidTag` ready without building scanner integration.

**Deliberately out of scope for this roadmap**: geofencing, route-deviation detection, and ETA calculation — all of these are downstream of Phase 10 actually having a live position feed to compute against, and none of them can be meaningfully designed before that feed exists.

---

## 6. Immediate next steps

1. Build Phase 1 and Phase 2 together on a branch — a vehicle/driver registry without document-expiry tracking is only half the "master setup" the brief asks for, and vice versa.
2. Confirm with the school whether drivers are predominantly employees (the `TransportDriver.staffId` path) or contracted through a vendor (the fallback-identity path) before Phase 1 ships — it changes which fields the add-driver form actually needs to collect.
3. Prove the core loop (Phase 3 → Phase 4: route with stops → a real student assigned to it, replacing the free-text fields) end-to-end for one route before adding fees or attendance around it — same "prove the loop, then add process" sequencing `LIBRARY-ROADMAP.md` and `CERTIFICATES-ROADMAP.md` both used.
4. Write the `Student.busNumber`/`route`/`pickupPoint` backfill script as part of Phase 4, not as an afterthought — those columns are live, editable data today (shown and edited on the student profile page, exported/imported through the whole-database Excel feature, and read by the ID card field resolver at `src/lib/id-cards/resolve-fields.ts`), not empty placeholders, so the migration needs a real reconciliation pass, not a silent drop. The ID card field resolver in particular needs its `student.busNumber`-style field keys re-pointed at `StudentTransport` once it exists, or bus-number ID cards will silently go stale after the cutover.
5. Defer Phase 8 (portal view) until parent/student login is real and Phase 9 (notifications) until the shared Communication mechanism lands — both dependencies are already tracked in `AUTH-RBAC-ROADMAP.md`, so don't build one-off versions here.
6. Revisit `CLAUDE.md`'s module list once Phase 4 lands — it doesn't yet mention Certificates, ID Cards, or Library either, so it's already behind shipped modules.

---

*Compiled from a direct review of the codebase (schema, permission matrix, navigation config, storage layer, Staff/HR and Fees modules) on 2026-08-27. Treat the pasted transport feature brief as superseded by this document wherever the two disagree on how a feature should be built — the brief describes desired behavior; this document maps it onto what already exists in the repo.*
