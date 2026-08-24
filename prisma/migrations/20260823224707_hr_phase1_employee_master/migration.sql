/*
  Warnings:

  - You are about to drop the column `designation` on the `Staff` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UploadedFile" ADD COLUMN "uploadedById" TEXT;

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Designation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Designation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffEducation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "institution" TEXT,
    "board" TEXT,
    "passingYear" INTEGER,
    "percentage" REAL,
    "uploadedFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffEducation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffEducation_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffExperience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "designation" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "description" TEXT,
    "uploadedFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffExperience_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffExperience_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT,
    "uploadedFileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiryDate" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "rejectionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffDocument_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffDocument_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actorId" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffActivityLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffActivityLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "bloodGroup" TEXT,
    "maritalStatus" TEXT,
    "designationId" TEXT,
    "departmentId" TEXT,
    "campusId" TEXT,
    "category" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT,
    "emergencyContact" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "joiningDate" DATETIME,
    "confirmationDate" DATETIME,
    "probationEndDate" DATETIME,
    "reportingManagerId" TEXT,
    "employeeType" TEXT,
    "employmentStatus" TEXT NOT NULL DEFAULT 'active',
    "panNumber" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Staff" ("address", "bloodGroup", "category", "createdAt", "dateOfBirth", "departmentId", "email", "emergencyContact", "employeeId", "employeeType", "employmentStatus", "fullName", "gender", "id", "joiningDate", "mobileNumber", "photoUrl", "schoolId", "updatedAt") SELECT "address", "bloodGroup", "category", "createdAt", "dateOfBirth", "departmentId", "email", "emergencyContact", "employeeId", "employeeType", "employmentStatus", "fullName", "gender", "id", "joiningDate", "mobileNumber", "photoUrl", "schoolId", "updatedAt" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE INDEX "Staff_schoolId_category_idx" ON "Staff"("schoolId", "category");
CREATE INDEX "Staff_schoolId_employmentStatus_idx" ON "Staff"("schoolId", "employmentStatus");
CREATE INDEX "Staff_schoolId_departmentId_idx" ON "Staff"("schoolId", "departmentId");
CREATE UNIQUE INDEX "Staff_schoolId_employeeId_key" ON "Staff"("schoolId", "employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Designation_schoolId_idx" ON "Designation"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_schoolId_code_key" ON "Designation"("schoolId", "code");

-- CreateIndex
CREATE INDEX "StaffEducation_staffId_idx" ON "StaffEducation"("staffId");

-- CreateIndex
CREATE INDEX "StaffExperience_staffId_idx" ON "StaffExperience"("staffId");

-- CreateIndex
CREATE INDEX "StaffDocument_schoolId_status_idx" ON "StaffDocument"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StaffDocument_staffId_documentType_idx" ON "StaffDocument"("staffId", "documentType");

-- CreateIndex
CREATE INDEX "StaffDocument_schoolId_expiryDate_idx" ON "StaffDocument"("schoolId", "expiryDate");

-- CreateIndex
CREATE INDEX "StaffActivityLog_staffId_occurredAt_idx" ON "StaffActivityLog"("staffId", "occurredAt");
