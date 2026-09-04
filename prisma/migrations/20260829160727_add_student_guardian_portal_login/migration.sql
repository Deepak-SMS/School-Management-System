-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guardian" (
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
    CONSTRAINT "Guardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Guardian" ("address", "alternateMobile", "annualIncome", "city", "country", "createdAt", "designation", "education", "email", "firstName", "fullName", "govtIdRef", "id", "lastName", "mobile", "occupation", "organization", "photoFileId", "pinCode", "schoolId", "state", "updatedAt", "userId") SELECT "address", "alternateMobile", "annualIncome", "city", "country", "createdAt", "designation", "education", "email", "firstName", "fullName", "govtIdRef", "id", "lastName", "mobile", "occupation", "organization", "photoFileId", "pinCode", "schoolId", "state", "updatedAt", "userId" FROM "Guardian";
DROP TABLE "Guardian";
ALTER TABLE "new_Guardian" RENAME TO "Guardian";
CREATE UNIQUE INDEX "Guardian_userId_key" ON "Guardian"("userId");
CREATE INDEX "Guardian_schoolId_idx" ON "Guardian"("schoolId");
CREATE INDEX "Guardian_schoolId_mobile_idx" ON "Guardian"("schoolId", "mobile");
CREATE INDEX "Guardian_schoolId_email_idx" ON "Guardian"("schoolId", "email");
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
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "FeeStudentCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("academicYearId", "address", "addressLine2", "admissionClassId", "admissionDate", "admissionNumber", "admissionType", "bloodGroup", "busNumber", "category", "city", "classId", "commChannelsJson", "country", "createdAt", "dateOfBirth", "district", "emergencyAddress", "emergencyAltPhone", "emergencyContact", "emergencyName", "emergencyRelation", "enrollmentNumber", "feeCategoryId", "firstName", "gender", "govtIdRef", "house", "id", "lastName", "medium", "middleName", "motherTongue", "nationality", "parentEmail", "permanentAddress", "permanentCity", "permanentCountry", "permanentDistrict", "permanentLine2", "permanentPinCode", "permanentState", "photoFileId", "photoUrl", "pickupPoint", "pinCode", "preferredChannel", "previousClass", "previousSchool", "primaryMobile", "promotionStatus", "religion", "rollNumber", "route", "sameAsCurrent", "schoolId", "secondaryMobile", "sectionId", "state", "status", "stream", "studentEmail", "updatedAt", "whatsappNumber") SELECT "academicYearId", "address", "addressLine2", "admissionClassId", "admissionDate", "admissionNumber", "admissionType", "bloodGroup", "busNumber", "category", "city", "classId", "commChannelsJson", "country", "createdAt", "dateOfBirth", "district", "emergencyAddress", "emergencyAltPhone", "emergencyContact", "emergencyName", "emergencyRelation", "enrollmentNumber", "feeCategoryId", "firstName", "gender", "govtIdRef", "house", "id", "lastName", "medium", "middleName", "motherTongue", "nationality", "parentEmail", "permanentAddress", "permanentCity", "permanentCountry", "permanentDistrict", "permanentLine2", "permanentPinCode", "permanentState", "photoFileId", "photoUrl", "pickupPoint", "pinCode", "preferredChannel", "previousClass", "previousSchool", "primaryMobile", "promotionStatus", "religion", "rollNumber", "route", "sameAsCurrent", "schoolId", "secondaryMobile", "sectionId", "state", "status", "stream", "studentEmail", "updatedAt", "whatsappNumber" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE INDEX "Student_schoolId_classId_sectionId_idx" ON "Student"("schoolId", "classId", "sectionId");
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");
CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
