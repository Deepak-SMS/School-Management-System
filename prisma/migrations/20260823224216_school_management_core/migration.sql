/*
  Warnings:

  - You are about to drop the column `isCurrent` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `Staff` table. All the data in the column will be lost.
  - Added the required column `academicYearId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campusId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicYearId` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campusId` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Section` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "School" ADD COLUMN "administrativeEmail" TEXT;
ALTER TABLE "School" ADD COLUMN "administrativePhone" TEXT;
ALTER TABLE "School" ADD COLUMN "administratorName" TEXT;
ALTER TABLE "School" ADD COLUMN "alternatePhone" TEXT;
ALTER TABLE "School" ADD COLUMN "currency" TEXT;
ALTER TABLE "School" ADD COLUMN "dateFormat" TEXT;
ALTER TABLE "School" ADD COLUMN "establishedYear" INTEGER;
ALTER TABLE "School" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "School" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "School" ADD COLUMN "institutionType" TEXT;
ALTER TABLE "School" ADD COLUMN "language" TEXT;
ALTER TABLE "School" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "School" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "School" ADD COLUMN "schoolType" TEXT;
ALTER TABLE "School" ADD COLUMN "timeZone" TEXT;
ALTER TABLE "School" ADD COLUMN "twitterUrl" TEXT;
ALTER TABLE "School" ADD COLUMN "weekStartDay" TEXT;
ALTER TABLE "School" ADD COLUMN "workingDaysJson" TEXT;
ALTER TABLE "School" ADD COLUMN "youtubeUrl" TEXT;

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "campusType" TEXT NOT NULL DEFAULT 'main',
    "headStaffId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "studentCapacity" INTEGER,
    "staffCapacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Campus_headStaffId_fkey" FOREIGN KEY ("headStaffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT 'core',
    "description" TEXT,
    "natureType" TEXT NOT NULL DEFAULT 'theory',
    "maxMarks" INTEGER,
    "passingMarks" INTEGER,
    "credits" REAL,
    "gradingSystem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "teacherId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "campusId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL DEFAULT 'academic',
    "headStaffId" TEXT,
    "description" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Department_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Department_headStaffId_fkey" FOREIGN KEY ("headStaffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AcademicYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "admissionStartDate" DATETIME,
    "admissionEndDate" DATETIME,
    "promotionDate" DATETIME,
    "resultPublicationDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AcademicYear" ("createdAt", "endDate", "id", "label", "schoolId", "startDate") SELECT "createdAt", "endDate", "id", "label", "schoolId", "startDate" FROM "AcademicYear";
DROP TABLE "AcademicYear";
ALTER TABLE "new_AcademicYear" RENAME TO "AcademicYear";
CREATE INDEX "AcademicYear_schoolId_idx" ON "AcademicYear"("schoolId");
CREATE INDEX "AcademicYear_schoolId_status_idx" ON "AcademicYear"("schoolId", "status");
CREATE UNIQUE INDEX "AcademicYear_schoolId_label_key" ON "AcademicYear"("schoolId", "label");
CREATE TABLE "new_Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "classTeacherId" TEXT,
    "gradingSystem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Class_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Class_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Class" ("createdAt", "id", "name", "schoolId", "sortOrder") SELECT "createdAt", "id", "name", "schoolId", "sortOrder" FROM "Class";
DROP TABLE "Class";
ALTER TABLE "new_Class" RENAME TO "Class";
CREATE INDEX "Class_schoolId_idx" ON "Class"("schoolId");
CREATE INDEX "Class_campusId_idx" ON "Class"("campusId");
CREATE UNIQUE INDEX "Class_schoolId_academicYearId_name_key" ON "Class"("schoolId", "academicYearId", "name");
CREATE UNIQUE INDEX "Class_schoolId_academicYearId_code_key" ON "Class"("schoolId", "academicYearId", "code");
CREATE TABLE "new_Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "room" TEXT,
    "classTeacherId" TEXT,
    "capacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Section_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Section_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Section_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Section_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Section" ("classId", "createdAt", "id", "name", "schoolId") SELECT "classId", "createdAt", "id", "name", "schoolId" FROM "Section";
DROP TABLE "Section";
ALTER TABLE "new_Section" RENAME TO "Section";
CREATE INDEX "Section_schoolId_idx" ON "Section"("schoolId");
CREATE UNIQUE INDEX "Section_classId_name_key" ON "Section"("classId", "name");
CREATE UNIQUE INDEX "Section_classId_code_key" ON "Section"("classId", "code");
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "bloodGroup" TEXT,
    "designation" TEXT NOT NULL,
    "departmentId" TEXT,
    "category" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT,
    "emergencyContact" TEXT,
    "address" TEXT,
    "joiningDate" DATETIME,
    "employeeType" TEXT,
    "employmentStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Staff" ("address", "bloodGroup", "category", "createdAt", "dateOfBirth", "designation", "email", "emergencyContact", "employeeId", "employeeType", "employmentStatus", "fullName", "gender", "id", "joiningDate", "mobileNumber", "photoUrl", "schoolId", "updatedAt") SELECT "address", "bloodGroup", "category", "createdAt", "dateOfBirth", "designation", "email", "emergencyContact", "employeeId", "employeeType", "employmentStatus", "fullName", "gender", "id", "joiningDate", "mobileNumber", "photoUrl", "schoolId", "updatedAt" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE INDEX "Staff_schoolId_category_idx" ON "Staff"("schoolId", "category");
CREATE INDEX "Staff_schoolId_employmentStatus_idx" ON "Staff"("schoolId", "employmentStatus");
CREATE UNIQUE INDEX "Staff_schoolId_employeeId_key" ON "Staff"("schoolId", "employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Campus_schoolId_idx" ON "Campus"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_schoolId_code_key" ON "Campus"("schoolId", "code");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_code_key" ON "Subject"("schoolId", "code");

-- CreateIndex
CREATE INDEX "SubjectAssignment_schoolId_idx" ON "SubjectAssignment"("schoolId");

-- CreateIndex
CREATE INDEX "SubjectAssignment_classId_idx" ON "SubjectAssignment"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAssignment_subjectId_academicYearId_classId_sectionId_key" ON "SubjectAssignment"("subjectId", "academicYearId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "Department_schoolId_idx" ON "Department"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_schoolId_code_key" ON "Department"("schoolId", "code");
