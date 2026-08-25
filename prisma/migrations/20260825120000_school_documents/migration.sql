-- CreateTable
CREATE TABLE "SchoolDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT,
    "referenceValue" TEXT,
    "uploadedFileId" TEXT NOT NULL,
    "issuedOn" DATETIME,
    "expiresOn" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolDocument_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SchoolDocument_schoolId_documentType_idx" ON "SchoolDocument"("schoolId", "documentType");

-- CreateIndex
CREATE INDEX "SchoolDocument_schoolId_expiresOn_idx" ON "SchoolDocument"("schoolId", "expiresOn");

