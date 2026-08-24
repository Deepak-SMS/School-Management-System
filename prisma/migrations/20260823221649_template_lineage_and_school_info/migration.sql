-- AlterTable
ALTER TABLE "School" ADD COLUMN "address" TEXT;
ALTER TABLE "School" ADD COLUMN "affiliationBoard" TEXT;
ALTER TABLE "School" ADD COLUMN "email" TEXT;
ALTER TABLE "School" ADD COLUMN "phone" TEXT;
ALTER TABLE "School" ADD COLUMN "pinCode" TEXT;
ALTER TABLE "School" ADD COLUMN "principalName" TEXT;
ALTER TABLE "School" ADD COLUMN "principalSignatureUrl" TEXT;
ALTER TABLE "School" ADD COLUMN "schoolCode" TEXT;
ALTER TABLE "School" ADD COLUMN "schoolSealUrl" TEXT;
ALTER TABLE "School" ADD COLUMN "website" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IDCardTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "basedOnTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cardWidthMm" REAL NOT NULL DEFAULT 85.6,
    "cardHeightMm" REAL NOT NULL DEFAULT 53.98,
    "cornerRadiusMm" REAL NOT NULL DEFAULT 3.18,
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IDCardTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IDCardTemplate_basedOnTemplateId_fkey" FOREIGN KEY ("basedOnTemplateId") REFERENCES "IDCardTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_IDCardTemplate" ("cardHeightMm", "cardWidthMm", "category", "cornerRadiusMm", "createdAt", "id", "isActive", "isDefault", "name", "orientation", "schoolId", "updatedAt") SELECT "cardHeightMm", "cardWidthMm", "category", "cornerRadiusMm", "createdAt", "id", "isActive", "isDefault", "name", "orientation", "schoolId", "updatedAt" FROM "IDCardTemplate";
DROP TABLE "IDCardTemplate";
ALTER TABLE "new_IDCardTemplate" RENAME TO "IDCardTemplate";
CREATE INDEX "IDCardTemplate_schoolId_category_idx" ON "IDCardTemplate"("schoolId", "category");
CREATE INDEX "IDCardTemplate_isSystemTemplate_idx" ON "IDCardTemplate"("isSystemTemplate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
