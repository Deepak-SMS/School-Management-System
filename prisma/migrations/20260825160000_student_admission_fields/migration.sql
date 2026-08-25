-- AlterTable
ALTER TABLE "Student" ADD COLUMN "district" TEXT;
ALTER TABLE "Student" ADD COLUMN "medium" TEXT;
ALTER TABLE "Student" ADD COLUMN "permanentDistrict" TEXT;
ALTER TABLE "Student" ADD COLUMN "previousClass" TEXT;
ALTER TABLE "Student" ADD COLUMN "promotionStatus" TEXT;
ALTER TABLE "Student" ADD COLUMN "stream" TEXT;

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'admission',
    "title" TEXT,
    "uploadedFileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "issuedOn" DATETIME,
    "expiresOn" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "academicYearId" TEXT,
    "uploadedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentDocument_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_category_idx" ON "StudentDocument"("studentId", "category");

-- CreateIndex
CREATE INDEX "StudentDocument_schoolId_status_idx" ON "StudentDocument"("schoolId", "status");

