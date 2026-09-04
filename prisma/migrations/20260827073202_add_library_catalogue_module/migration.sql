-- CreateTable
CREATE TABLE "LibraryCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "isSystemCategory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LibraryCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibrarySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentMaxBooks" INTEGER NOT NULL DEFAULT 2,
    "studentIssueDays" INTEGER NOT NULL DEFAULT 14,
    "teacherMaxBooks" INTEGER NOT NULL DEFAULT 5,
    "teacherIssueDays" INTEGER NOT NULL DEFAULT 30,
    "staffMaxBooks" INTEGER NOT NULL DEFAULT 3,
    "staffIssueDays" INTEGER NOT NULL DEFAULT 21,
    "maxRenewals" INTEGER NOT NULL DEFAULT 2,
    "finePerDay" REAL NOT NULL DEFAULT 5,
    "maxFine" REAL NOT NULL DEFAULT 500,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibrarySettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "author" TEXT NOT NULL,
    "isbn10" TEXT,
    "isbn13" TEXT,
    "publisher" TEXT,
    "publicationYear" INTEGER,
    "edition" TEXT,
    "language" TEXT,
    "pageCount" INTEGER,
    "categoryId" TEXT,
    "subjectId" TEXT,
    "classRelevanceJson" TEXT,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "deweyDecimal" TEXT,
    "shelf" TEXT,
    "rack" TEXT,
    "rowLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryBook_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryBook_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LibraryCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryBook_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryBookCopy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "rfidTag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "condition" TEXT NOT NULL DEFAULT 'good',
    "shelf" TEXT,
    "rack" TEXT,
    "rowLabel" TEXT,
    "purchaseDate" DATETIME,
    "price" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryBookCopy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryBookCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryAccessionCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "LibraryAccessionCounter_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LibraryCategory_schoolId_parentId_idx" ON "LibraryCategory"("schoolId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCategory_schoolId_name_key" ON "LibraryCategory"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LibrarySettings_schoolId_key" ON "LibrarySettings"("schoolId");

-- CreateIndex
CREATE INDEX "LibraryBook_schoolId_categoryId_idx" ON "LibraryBook"("schoolId", "categoryId");

-- CreateIndex
CREATE INDEX "LibraryBook_schoolId_title_idx" ON "LibraryBook"("schoolId", "title");

-- CreateIndex
CREATE INDEX "LibraryBookCopy_schoolId_bookId_idx" ON "LibraryBookCopy"("schoolId", "bookId");

-- CreateIndex
CREATE INDEX "LibraryBookCopy_schoolId_status_idx" ON "LibraryBookCopy"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryBookCopy_schoolId_accessionNumber_key" ON "LibraryBookCopy"("schoolId", "accessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryBookCopy_schoolId_barcode_key" ON "LibraryBookCopy"("schoolId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAccessionCounter_schoolId_year_key" ON "LibraryAccessionCounter"("schoolId", "year");
