-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "maxConsecutivePeriods" INTEGER;
ALTER TABLE "Staff" ADD COLUMN "maxPeriodsPerDay" INTEGER;

-- CreateTable
CREATE TABLE "TimingSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimingSet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "timingSetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'teaching',
    CONSTRAINT "Period_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Period_timingSetId_fkey" FOREIGN KEY ("timingSetId") REFERENCES "TimingSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "campusId" TEXT,
    "name" TEXT NOT NULL,
    "buildingName" TEXT,
    "floor" TEXT,
    "capacity" INTEGER,
    "roomType" TEXT NOT NULL DEFAULT 'classroom',
    "allowedSubjectIdsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Room_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherUnavailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherUnavailability_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherUnavailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherUnavailability_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Timetable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "timingSetId" TEXT NOT NULL,
    "workingDaysJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastGenerationReportJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timetable_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timetable_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Timetable_timingSetId_fkey" FOREIGN KEY ("timingSetId") REFERENCES "TimingSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimetableClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timetableId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    CONSTRAINT "TimetableClass_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableClass_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "roomId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableSlot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "teacherId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodsPerWeek" INTEGER NOT NULL DEFAULT 0,
    "preferDoublePeriod" BOOLEAN NOT NULL DEFAULT false,
    "preferredRoomId" TEXT,
    CONSTRAINT "SubjectAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_preferredRoomId_fkey" FOREIGN KEY ("preferredRoomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SubjectAssignment" ("academicYearId", "classId", "createdAt", "id", "schoolId", "sectionId", "subjectId", "teacherId") SELECT "academicYearId", "classId", "createdAt", "id", "schoolId", "sectionId", "subjectId", "teacherId" FROM "SubjectAssignment";
DROP TABLE "SubjectAssignment";
ALTER TABLE "new_SubjectAssignment" RENAME TO "SubjectAssignment";
CREATE INDEX "SubjectAssignment_schoolId_idx" ON "SubjectAssignment"("schoolId");
CREATE INDEX "SubjectAssignment_classId_idx" ON "SubjectAssignment"("classId");
CREATE UNIQUE INDEX "SubjectAssignment_subjectId_academicYearId_classId_sectionId_key" ON "SubjectAssignment"("subjectId", "academicYearId", "classId", "sectionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TimingSet_schoolId_idx" ON "TimingSet"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TimingSet_schoolId_name_key" ON "TimingSet"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Period_timingSetId_idx" ON "Period"("timingSetId");

-- CreateIndex
CREATE INDEX "Period_schoolId_idx" ON "Period"("schoolId");

-- CreateIndex
CREATE INDEX "Room_schoolId_idx" ON "Room"("schoolId");

-- CreateIndex
CREATE INDEX "Room_campusId_idx" ON "Room"("campusId");

-- CreateIndex
CREATE INDEX "TeacherUnavailability_schoolId_idx" ON "TeacherUnavailability"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherUnavailability_staffId_dayOfWeek_periodId_key" ON "TeacherUnavailability"("staffId", "dayOfWeek", "periodId");

-- CreateIndex
CREATE INDEX "Timetable_schoolId_idx" ON "Timetable"("schoolId");

-- CreateIndex
CREATE INDEX "Timetable_academicYearId_idx" ON "Timetable"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableClass_timetableId_classId_sectionId_key" ON "TimetableClass"("timetableId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "TimetableSlot_timetableId_teacherId_dayOfWeek_periodId_idx" ON "TimetableSlot"("timetableId", "teacherId", "dayOfWeek", "periodId");

-- CreateIndex
CREATE INDEX "TimetableSlot_timetableId_roomId_dayOfWeek_periodId_idx" ON "TimetableSlot"("timetableId", "roomId", "dayOfWeek", "periodId");

-- CreateIndex
CREATE INDEX "TimetableSlot_schoolId_idx" ON "TimetableSlot"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_timetableId_sectionId_dayOfWeek_periodId_key" ON "TimetableSlot"("timetableId", "sectionId", "dayOfWeek", "periodId");
