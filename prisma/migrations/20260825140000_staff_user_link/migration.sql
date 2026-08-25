-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "preferredName" TEXT,
    "photoUrl" TEXT,
    "photoFileId" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "bloodGroup" TEXT,
    "maritalStatus" TEXT,
    "designationId" TEXT,
    "departmentId" TEXT,
    "campusId" TEXT,
    "employeeTypeId" TEXT,
    "category" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "alternateNumber" TEXT,
    "email" TEXT,
    "officialEmail" TEXT,
    "emergencyContact" TEXT,
    "emergencyName" TEXT,
    "emergencyRelation" TEXT,
    "emergencyAddress" TEXT,
    "address" TEXT,
    "permanentAddress" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "joiningDate" DATETIME,
    "confirmationDate" DATETIME,
    "probationEndDate" DATETIME,
    "probationMonths" INTEGER,
    "workLocation" TEXT,
    "reportingManagerId" TEXT,
    "employmentStatus" TEXT NOT NULL DEFAULT 'active',
    "panNumber" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "bankAccountHolder" TEXT,
    "pfNumber" TEXT,
    "esicNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_employeeTypeId_fkey" FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Staff" ("address", "alternateNumber", "bankAccountHolder", "bankAccountNumber", "bankIfsc", "bankName", "bloodGroup", "campusId", "category", "city", "confirmationDate", "country", "createdAt", "dateOfBirth", "departmentId", "designationId", "email", "emergencyAddress", "emergencyContact", "emergencyName", "emergencyRelation", "employeeId", "employeeTypeId", "employmentStatus", "esicNumber", "firstName", "fullName", "gender", "id", "joiningDate", "lastName", "maritalStatus", "middleName", "mobileNumber", "officialEmail", "panNumber", "permanentAddress", "pfNumber", "photoFileId", "photoUrl", "pinCode", "preferredName", "probationEndDate", "probationMonths", "reportingManagerId", "schoolId", "state", "updatedAt", "workLocation") SELECT "address", "alternateNumber", "bankAccountHolder", "bankAccountNumber", "bankIfsc", "bankName", "bloodGroup", "campusId", "category", "city", "confirmationDate", "country", "createdAt", "dateOfBirth", "departmentId", "designationId", "email", "emergencyAddress", "emergencyContact", "emergencyName", "emergencyRelation", "employeeId", "employeeTypeId", "employmentStatus", "esicNumber", "firstName", "fullName", "gender", "id", "joiningDate", "lastName", "maritalStatus", "middleName", "mobileNumber", "officialEmail", "panNumber", "permanentAddress", "pfNumber", "photoFileId", "photoUrl", "pinCode", "preferredName", "probationEndDate", "probationMonths", "reportingManagerId", "schoolId", "state", "updatedAt", "workLocation" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");
CREATE INDEX "Staff_schoolId_category_idx" ON "Staff"("schoolId", "category");
CREATE INDEX "Staff_schoolId_employmentStatus_idx" ON "Staff"("schoolId", "employmentStatus");
CREATE INDEX "Staff_schoolId_departmentId_idx" ON "Staff"("schoolId", "departmentId");
CREATE UNIQUE INDEX "Staff_schoolId_employeeId_key" ON "Staff"("schoolId", "employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

