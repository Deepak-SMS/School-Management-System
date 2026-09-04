-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetSchoolId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlatformAuditLog_targetSchoolId_fkey" FOREIGN KEY ("targetSchoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "affiliationBoard" TEXT,
    "schoolCode" TEXT,
    "principalName" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "principalSignatureUrl" TEXT,
    "schoolSealUrl" TEXT,
    "udisePlusCode" TEXT,
    "udiseSchoolId" TEXT,
    "boardAffiliationNumber" TEXT,
    "recognitionNumber" TEXT,
    "rteRegistrationNumber" TEXT,
    "nocNumber" TEXT,
    "registrationNumber" TEXT,
    "schoolType" TEXT,
    "institutionType" TEXT,
    "establishedYear" INTEGER,
    "alternatePhone" TEXT,
    "administratorName" TEXT,
    "administrativeEmail" TEXT,
    "administrativePhone" TEXT,
    "timeZone" TEXT,
    "currency" TEXT,
    "dateFormat" TEXT,
    "language" TEXT,
    "weekStartDay" TEXT,
    "workingDaysJson" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "youtubeUrl" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'trial',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "enabledModulesJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_School" ("address", "administrativeEmail", "administrativePhone", "administratorName", "affiliationBoard", "alternatePhone", "bannerUrl", "boardAffiliationNumber", "city", "country", "createdAt", "currency", "dateFormat", "email", "establishedYear", "facebookUrl", "id", "instagramUrl", "institutionType", "language", "linkedinUrl", "logoUrl", "name", "nocNumber", "phone", "pinCode", "principalName", "principalSignatureUrl", "recognitionNumber", "registrationNumber", "rteRegistrationNumber", "schoolCode", "schoolSealUrl", "schoolType", "shortName", "state", "timeZone", "twitterUrl", "udisePlusCode", "udiseSchoolId", "updatedAt", "website", "weekStartDay", "workingDaysJson", "youtubeUrl") SELECT "address", "administrativeEmail", "administrativePhone", "administratorName", "affiliationBoard", "alternatePhone", "bannerUrl", "boardAffiliationNumber", "city", "country", "createdAt", "currency", "dateFormat", "email", "establishedYear", "facebookUrl", "id", "instagramUrl", "institutionType", "language", "linkedinUrl", "logoUrl", "name", "nocNumber", "phone", "pinCode", "principalName", "principalSignatureUrl", "recognitionNumber", "registrationNumber", "rteRegistrationNumber", "schoolCode", "schoolSealUrl", "schoolType", "shortName", "state", "timeZone", "twitterUrl", "udisePlusCode", "udiseSchoolId", "updatedAt", "website", "weekStartDay", "workingDaysJson", "youtubeUrl" FROM "School";
DROP TABLE "School";
ALTER TABLE "new_School" RENAME TO "School";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isActive", "mustChangePassword", "name", "passwordHash", "updatedAt") SELECT "createdAt", "email", "id", "isActive", "mustChangePassword", "name", "passwordHash", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actorUserId_idx" ON "PlatformAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetSchoolId_idx" ON "PlatformAuditLog"("targetSchoolId");
