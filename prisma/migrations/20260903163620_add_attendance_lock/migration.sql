-- CreateTable
CREATE TABLE "AttendanceLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "date" DATETIME NOT NULL,
    "lockedById" TEXT,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceLock_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceLock_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceLock_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceLock_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AttendanceLock_schoolId_classId_sectionId_date_idx" ON "AttendanceLock"("schoolId", "classId", "sectionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceLock_schoolId_classId_sectionId_subjectId_date_key" ON "AttendanceLock"("schoolId", "classId", "sectionId", "subjectId", "date");
