-- CreateTable
CREATE TABLE "FeeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isRefundable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeStudentCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeStudentCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LateFeeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'fixed',
    "amount" REAL,
    "percentage" REAL,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "maxAmount" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LateFeeRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "classId" TEXT,
    "sectionId" TEXT,
    "studentCategoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeeStructure_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeStructure_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FeeStructure_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FeeStructure_studentCategoryId_fkey" FOREIGN KEY ("studentCategoryId") REFERENCES "FeeStudentCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeStructureItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feeStructureId" TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'one_time',
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "lateFeeRuleId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeStructureItem_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeeStructureItem_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "FeeCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeStructureItem_lateFeeRuleId_fkey" FOREIGN KEY ("lateFeeRuleId") REFERENCES "LateFeeRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feeStructureItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FeeInstallment_feeStructureItemId_fkey" FOREIGN KEY ("feeStructureItemId") REFERENCES "FeeStructureItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeStructureAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "FeeStructureAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeeStructureAssignment_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeeStructureAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "feeCategoryId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "rollNumber" TEXT,
    "house" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "previousSchool" TEXT,
    "previousClass" TEXT,
    "admissionDate" DATETIME,
    "admissionType" TEXT,
    "admissionClassId" TEXT,
    "stream" TEXT,
    "medium" TEXT,
    "promotionStatus" TEXT,
    "address" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "sameAsCurrent" BOOLEAN NOT NULL DEFAULT true,
    "permanentAddress" TEXT,
    "permanentLine2" TEXT,
    "permanentCity" TEXT,
    "permanentDistrict" TEXT,
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
    CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "FeeStudentCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("academicYearId", "address", "addressLine2", "admissionClassId", "admissionDate", "admissionNumber", "admissionType", "bloodGroup", "busNumber", "category", "city", "classId", "commChannelsJson", "country", "createdAt", "dateOfBirth", "district", "emergencyAddress", "emergencyAltPhone", "emergencyContact", "emergencyName", "emergencyRelation", "enrollmentNumber", "firstName", "gender", "govtIdRef", "house", "id", "lastName", "medium", "middleName", "motherTongue", "nationality", "parentEmail", "permanentAddress", "permanentCity", "permanentCountry", "permanentDistrict", "permanentLine2", "permanentPinCode", "permanentState", "photoFileId", "photoUrl", "pickupPoint", "pinCode", "preferredChannel", "previousClass", "previousSchool", "primaryMobile", "promotionStatus", "religion", "rollNumber", "route", "sameAsCurrent", "schoolId", "secondaryMobile", "sectionId", "state", "status", "stream", "studentEmail", "updatedAt", "whatsappNumber") SELECT "academicYearId", "address", "addressLine2", "admissionClassId", "admissionDate", "admissionNumber", "admissionType", "bloodGroup", "busNumber", "category", "city", "classId", "commChannelsJson", "country", "createdAt", "dateOfBirth", "district", "emergencyAddress", "emergencyAltPhone", "emergencyContact", "emergencyName", "emergencyRelation", "enrollmentNumber", "firstName", "gender", "govtIdRef", "house", "id", "lastName", "medium", "middleName", "motherTongue", "nationality", "parentEmail", "permanentAddress", "permanentCity", "permanentCountry", "permanentDistrict", "permanentLine2", "permanentPinCode", "permanentState", "photoFileId", "photoUrl", "pickupPoint", "pinCode", "preferredChannel", "previousClass", "previousSchool", "primaryMobile", "promotionStatus", "religion", "rollNumber", "route", "sameAsCurrent", "schoolId", "secondaryMobile", "sectionId", "state", "status", "stream", "studentEmail", "updatedAt", "whatsappNumber" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_schoolId_classId_sectionId_idx" ON "Student"("schoolId", "classId", "sectionId");
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");
CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FeeCategory_schoolId_idx" ON "FeeCategory"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_schoolId_code_key" ON "FeeCategory"("schoolId", "code");

-- CreateIndex
CREATE INDEX "FeeStudentCategory_schoolId_idx" ON "FeeStudentCategory"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStudentCategory_schoolId_code_key" ON "FeeStudentCategory"("schoolId", "code");

-- CreateIndex
CREATE INDEX "LateFeeRule_schoolId_idx" ON "LateFeeRule"("schoolId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_academicYearId_idx" ON "FeeStructure"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_status_idx" ON "FeeStructure"("schoolId", "status");

-- CreateIndex
CREATE INDEX "FeeStructure_classId_idx" ON "FeeStructure"("classId");

-- CreateIndex
CREATE INDEX "FeeStructureItem_feeStructureId_idx" ON "FeeStructureItem"("feeStructureId");

-- CreateIndex
CREATE INDEX "FeeStructureItem_feeCategoryId_idx" ON "FeeStructureItem"("feeCategoryId");

-- CreateIndex
CREATE INDEX "FeeInstallment_feeStructureItemId_idx" ON "FeeInstallment"("feeStructureItemId");

-- CreateIndex
CREATE INDEX "FeeStructureAssignment_schoolId_studentId_idx" ON "FeeStructureAssignment"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructureAssignment_feeStructureId_studentId_key" ON "FeeStructureAssignment"("feeStructureId", "studentId");
