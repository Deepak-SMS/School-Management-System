-- CreateTable
CREATE TABLE "AdmissionEnquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "parentEmail" TEXT,
    "childName" TEXT NOT NULL,
    "childDob" DATETIME,
    "interestedClassId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'walk_in',
    "status" TEXT NOT NULL DEFAULT 'new',
    "followUpDate" DATETIME,
    "assignedToId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdmissionEnquiry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdmissionEnquiry_interestedClassId_fkey" FOREIGN KEY ("interestedClassId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdmissionEnquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RegistrationForm" (
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
    "enquiryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegistrationForm_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegistrationForm_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RegistrationForm" ("academicYearId", "classId", "createdAt", "createdById", "description", "expiresAt", "id", "isActive", "schoolId", "title", "token", "updatedAt") SELECT "academicYearId", "classId", "createdAt", "createdById", "description", "expiresAt", "id", "isActive", "schoolId", "title", "token", "updatedAt" FROM "RegistrationForm";
DROP TABLE "RegistrationForm";
ALTER TABLE "new_RegistrationForm" RENAME TO "RegistrationForm";
CREATE UNIQUE INDEX "RegistrationForm_token_key" ON "RegistrationForm"("token");
CREATE INDEX "RegistrationForm_schoolId_isActive_idx" ON "RegistrationForm"("schoolId", "isActive");
CREATE INDEX "RegistrationForm_enquiryId_idx" ON "RegistrationForm"("enquiryId");
CREATE TABLE "new_StudentRegistration" (
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
    "enquiryId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentRegistration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentRegistration_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RegistrationForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentRegistration_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudentRegistration" ("contactEmail", "contactPhone", "formId", "id", "payloadJson", "reviewNote", "reviewedAt", "reviewedById", "schoolId", "status", "studentId", "studentName", "submittedAt") SELECT "contactEmail", "contactPhone", "formId", "id", "payloadJson", "reviewNote", "reviewedAt", "reviewedById", "schoolId", "status", "studentId", "studentName", "submittedAt" FROM "StudentRegistration";
DROP TABLE "StudentRegistration";
ALTER TABLE "new_StudentRegistration" RENAME TO "StudentRegistration";
CREATE UNIQUE INDEX "StudentRegistration_studentId_key" ON "StudentRegistration"("studentId");
CREATE INDEX "StudentRegistration_schoolId_status_idx" ON "StudentRegistration"("schoolId", "status");
CREATE INDEX "StudentRegistration_formId_idx" ON "StudentRegistration"("formId");
CREATE INDEX "StudentRegistration_enquiryId_idx" ON "StudentRegistration"("enquiryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_schoolId_status_idx" ON "AdmissionEnquiry"("schoolId", "status");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_schoolId_followUpDate_idx" ON "AdmissionEnquiry"("schoolId", "followUpDate");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_interestedClassId_idx" ON "AdmissionEnquiry"("interestedClassId");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_assignedToId_idx" ON "AdmissionEnquiry"("assignedToId");
