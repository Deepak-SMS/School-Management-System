-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT,
    "alternateMobile" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "organization" TEXT,
    "designation" TEXT,
    "education" TEXT,
    "annualIncome" REAL,
    "photoFileId" TEXT,
    "govtIdRef" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "isAuthorizedPickup" BOOLEAN NOT NULL DEFAULT false,
    "isLegalGuardian" BOOLEAN NOT NULL DEFAULT false,
    "canReceiveAcademic" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveFee" BOOLEAN NOT NULL DEFAULT false,
    "canAccessPortal" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistrationForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "academicYearId" TEXT,
    "classId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegistrationForm_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "studentName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "studentId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentRegistration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentRegistration_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RegistrationForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Data migration: promote the free-text Student.guardianName/guardianPhone into
-- real Guardian records before those columns are dropped, and link each one to
-- its student. Ids are derived from the student id so the join below can find
-- them without a second pass.
INSERT INTO "Guardian" ("id", "schoolId", "firstName", "lastName", "fullName", "mobile", "createdAt", "updatedAt")
SELECT
    'gdn_' || s."id",
    s."schoolId",
    -- Split the stored name on the first space; everything after it is the surname.
    CASE WHEN INSTR(TRIM(s."guardianName"), ' ') > 0
         THEN SUBSTR(TRIM(s."guardianName"), 1, INSTR(TRIM(s."guardianName"), ' ') - 1)
         ELSE TRIM(s."guardianName") END,
    CASE WHEN INSTR(TRIM(s."guardianName"), ' ') > 0
         THEN SUBSTR(TRIM(s."guardianName"), INSTR(TRIM(s."guardianName"), ' ') + 1)
         ELSE NULL END,
    TRIM(s."guardianName"),
    NULLIF(TRIM(COALESCE(s."guardianPhone", '')), ''),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Student" s
WHERE s."guardianName" IS NOT NULL AND TRIM(s."guardianName") <> '';

-- Link each migrated guardian to their student as the primary contact. The
-- relationship is unknown from the old flat fields, so it records as "guardian"
-- rather than guessing father/mother.
INSERT INTO "StudentGuardian" ("id", "studentId", "guardianId", "relationship", "isPrimary", "isEmergencyContact", "isAuthorizedPickup", "isLegalGuardian", "canReceiveAcademic", "canReceiveFee", "canAccessPortal", "sortOrder", "createdAt")
SELECT
    'sg_' || s."id",
    s."id",
    'gdn_' || s."id",
    'guardian',
    1, 1, 1, 0, 1, 1, 0, 0,
    CURRENT_TIMESTAMP
FROM "Student" s
WHERE s."guardianName" IS NOT NULL AND TRIM(s."guardianName") <> '';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "enrollmentNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "photoFileId" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "bloodGroup" TEXT,
    "nationality" TEXT,
    "motherTongue" TEXT,
    "religion" TEXT,
    "category" TEXT,
    "govtIdRef" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "rollNumber" TEXT,
    "house" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "previousSchool" TEXT,
    "admissionDate" DATETIME,
    "admissionType" TEXT,
    "admissionClassId" TEXT,
    "address" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "sameAsCurrent" BOOLEAN NOT NULL DEFAULT true,
    "permanentAddress" TEXT,
    "permanentLine2" TEXT,
    "permanentCity" TEXT,
    "permanentState" TEXT,
    "permanentCountry" TEXT,
    "permanentPinCode" TEXT,
    "primaryMobile" TEXT,
    "secondaryMobile" TEXT,
    "studentEmail" TEXT,
    "parentEmail" TEXT,
    "whatsappNumber" TEXT,
    "commChannelsJson" TEXT,
    "preferredChannel" TEXT,
    "emergencyName" TEXT,
    "emergencyRelation" TEXT,
    "emergencyContact" TEXT,
    "emergencyAltPhone" TEXT,
    "emergencyAddress" TEXT,
    "busNumber" TEXT,
    "route" TEXT,
    "pickupPoint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Student_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("academicYearId", "address", "admissionNumber", "bloodGroup", "busNumber", "city", "classId", "country", "createdAt", "dateOfBirth", "emergencyContact", "firstName", "gender", "house", "id", "lastName", "middleName", "photoUrl", "pickupPoint", "pinCode", "rollNumber", "route", "schoolId", "sectionId", "state", "status", "updatedAt") SELECT "academicYearId", "address", "admissionNumber", "bloodGroup", "busNumber", "city", "classId", "country", "createdAt", "dateOfBirth", "emergencyContact", "firstName", "gender", "house", "id", "lastName", "middleName", "photoUrl", "pickupPoint", "pinCode", "rollNumber", "route", "schoolId", "sectionId", "state", "status", "updatedAt" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_schoolId_classId_sectionId_idx" ON "Student"("schoolId", "classId", "sectionId");
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");
CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Guardian_schoolId_idx" ON "Guardian"("schoolId");

-- CreateIndex
CREATE INDEX "Guardian_schoolId_mobile_idx" ON "Guardian"("schoolId", "mobile");

-- CreateIndex
CREATE INDEX "Guardian_schoolId_email_idx" ON "Guardian"("schoolId", "email");

-- CreateIndex
CREATE INDEX "StudentGuardian_studentId_idx" ON "StudentGuardian"("studentId");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationForm_token_key" ON "RegistrationForm"("token");

-- CreateIndex
CREATE INDEX "RegistrationForm_schoolId_isActive_idx" ON "RegistrationForm"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRegistration_studentId_key" ON "StudentRegistration"("studentId");

-- CreateIndex
CREATE INDEX "StudentRegistration_schoolId_status_idx" ON "StudentRegistration"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StudentRegistration_formId_idx" ON "StudentRegistration"("formId");

