-- CreateTable
CREATE TABLE "AttendanceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'both',
    "warningThreshold" REAL NOT NULL DEFAULT 90,
    "criticalThreshold" REAL NOT NULL DEFAULT 75,
    "allowHalfDay" BOOLEAN NOT NULL DEFAULT true,
    "allowLate" BOOLEAN NOT NULL DEFAULT true,
    "allowLeave" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AttendanceSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSettings_schoolId_key" ON "AttendanceSettings"("schoolId");
