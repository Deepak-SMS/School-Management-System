/*
  Warnings:

  - You are about to drop the column `employeeType` on the `Staff` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "EmployeeType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "fromDepartmentId" TEXT,
    "toDepartmentId" TEXT,
    "fromDesignationId" TEXT,
    "toDesignationId" TEXT,
    "fromCampusId" TEXT,
    "toCampusId" TEXT,
    "fromManagerId" TEXT,
    "toManagerId" TEXT,
    "fromWorkLocation" TEXT,
    "toWorkLocation" TEXT,
    "reason" TEXT,
    "effectiveDate" DATETIME NOT NULL,
    "approvedById" TEXT,
    "appliedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffTransfer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffTransfer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT,
    "designationId" TEXT,
    "employeeTypeId" TEXT,
    "requiredQualification" TEXT,
    "requiredExperienceYears" REAL,
    "skillsJson" TEXT,
    "salaryRangeMin" REAL,
    "salaryRangeMax" REAL,
    "description" TEXT,
    "responsibilities" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobPosition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "jobPositionId" TEXT,
    "departmentId" TEXT,
    "designationId" TEXT,
    "campusId" TEXT,
    "employeeTypeId" TEXT,
    "positionsCount" INTEGER NOT NULL DEFAULT 1,
    "salaryRangeMin" REAL,
    "salaryRangeMax" REAL,
    "requiredQualification" TEXT,
    "requiredExperienceYears" REAL,
    "skillsJson" TEXT,
    "description" TEXT,
    "responsibilities" TEXT,
    "openingDate" DATETIME,
    "closingDate" DATETIME,
    "hiringManagerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vacancy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vacancy_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vacancy_employeeTypeId_fkey" FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vacancy_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "photoFileId" TEXT,
    "resumeFileId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pinCode" TEXT,
    "currentOrganization" TEXT,
    "currentDesignation" TEXT,
    "totalExperienceYears" REAL,
    "noticePeriodDays" INTEGER,
    "currentSalary" REAL,
    "expectedSalary" REAL,
    "highestQualification" TEXT,
    "university" TEXT,
    "passingYear" INTEGER,
    "skillsJson" TEXT,
    "certificationsJson" TEXT,
    "source" TEXT,
    "recruiterId" TEXT,
    "convertedStaffId" TEXT,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Candidate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Candidate_convertedStaffId_fkey" FOREIGN KEY ("convertedStaffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "appliedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "recruiterId" TEXT,
    "notes" TEXT,
    "screeningScore" REAL,
    "screeningComments" TEXT,
    "screenedAt" DATETIME,
    "screenedById" TEXT,
    "rejectionReason" TEXT,
    "proposedDesignationId" TEXT,
    "proposedDepartmentId" TEXT,
    "proposedCampusId" TEXT,
    "proposedSalary" REAL,
    "proposedJoiningDate" DATETIME,
    "proposedManagerId" TEXT,
    "selectedAt" DATETIME,
    "selectedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "roundName" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'in_person',
    "location" TEXT,
    "meetingLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "outcome" TEXT,
    "overallScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interview_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewPanelMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "panelRole" TEXT,
    CONSTRAINT "InterviewPanelMember_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewPanelMember_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "evaluatorStaffId" TEXT NOT NULL,
    "scoresJson" TEXT,
    "overallScore" REAL,
    "recommendation" TEXT,
    "comments" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewEvaluation_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewEvaluation_evaluatorStaffId_fkey" FOREIGN KEY ("evaluatorStaffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemoClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "subject" TEXT,
    "gradeLevel" TEXT,
    "topic" TEXT,
    "evaluatorStaffId" TEXT,
    "teachingScore" REAL,
    "classroomManagementScore" REAL,
    "studentInteractionScore" REAL,
    "overallScore" REAL,
    "feedback" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DemoClass_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "code" TEXT,
    "designationId" TEXT,
    "departmentId" TEXT,
    "campusId" TEXT,
    "employeeTypeId" TEXT,
    "salaryAmount" REAL,
    "joiningDate" DATETIME,
    "workLocation" TEXT,
    "reportingManagerId" TEXT,
    "expiryDate" DATETIME,
    "termsText" TEXT,
    "pdfFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" DATETIME,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Offer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CandidateDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT,
    "uploadedFileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateDocument_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateDocument_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Backfill: promote existing free-text Staff.employeeType values into real
-- EmployeeType master rows before the column is dropped, so no data is lost and
-- every staff member keeps their employment type as an FK.
INSERT INTO "EmployeeType" ("id", "schoolId", "name", "code", "isPaid", "sortOrder", "status", "createdAt", "updatedAt")
SELECT DISTINCT
    'et_' || s."schoolId" || '_' || UPPER(REPLACE(TRIM(s."employeeType"), ' ', '_')),
    s."schoolId",
    TRIM(s."employeeType"),
    UPPER(REPLACE(TRIM(s."employeeType"), ' ', '_')),
    1,
    0,
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Staff" s
WHERE s."employeeType" IS NOT NULL AND TRIM(s."employeeType") <> '';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
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
    CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_employeeTypeId_fkey" FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Staff" ("address", "bankAccountNumber", "bankIfsc", "bankName", "bloodGroup", "campusId", "category", "city", "confirmationDate", "country", "createdAt", "dateOfBirth", "departmentId", "designationId", "email", "emergencyContact", "employeeId", "employeeTypeId", "employmentStatus", "fullName", "gender", "id", "joiningDate", "maritalStatus", "mobileNumber", "panNumber", "photoUrl", "pinCode", "probationEndDate", "reportingManagerId", "schoolId", "state", "updatedAt") SELECT "address", "bankAccountNumber", "bankIfsc", "bankName", "bloodGroup", "campusId", "category", "city", "confirmationDate", "country", "createdAt", "dateOfBirth", "departmentId", "designationId", "email", "emergencyContact", "employeeId", CASE WHEN "employeeType" IS NULL OR TRIM("employeeType") = '' THEN NULL ELSE 'et_' || "schoolId" || '_' || UPPER(REPLACE(TRIM("employeeType"), ' ', '_')) END, "employmentStatus", "fullName", "gender", "id", "joiningDate", "maritalStatus", "mobileNumber", "panNumber", "photoUrl", "pinCode", "probationEndDate", "reportingManagerId", "schoolId", "state", "updatedAt" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE INDEX "Staff_schoolId_category_idx" ON "Staff"("schoolId", "category");
CREATE INDEX "Staff_schoolId_employmentStatus_idx" ON "Staff"("schoolId", "employmentStatus");
CREATE INDEX "Staff_schoolId_departmentId_idx" ON "Staff"("schoolId", "departmentId");
CREATE UNIQUE INDEX "Staff_schoolId_employeeId_key" ON "Staff"("schoolId", "employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EmployeeType_schoolId_idx" ON "EmployeeType"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeType_schoolId_code_key" ON "EmployeeType"("schoolId", "code");

-- CreateIndex
CREATE INDEX "StaffTransfer_schoolId_status_idx" ON "StaffTransfer"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StaffTransfer_staffId_effectiveDate_idx" ON "StaffTransfer"("staffId", "effectiveDate");

-- CreateIndex
CREATE INDEX "JobPosition_schoolId_status_idx" ON "JobPosition"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Vacancy_schoolId_status_idx" ON "Vacancy"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_schoolId_code_key" ON "Vacancy"("schoolId", "code");

-- CreateIndex
CREATE INDEX "Candidate_schoolId_idx" ON "Candidate"("schoolId");

-- CreateIndex
CREATE INDEX "Candidate_schoolId_email_idx" ON "Candidate"("schoolId", "email");

-- CreateIndex
CREATE INDEX "Application_schoolId_status_idx" ON "Application"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Application_vacancyId_status_idx" ON "Application"("vacancyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_candidateId_vacancyId_key" ON "Application"("candidateId", "vacancyId");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_occurredAt_idx" ON "ApplicationStatusHistory"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "Interview_schoolId_scheduledAt_idx" ON "Interview"("schoolId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_applicationId_roundNumber_idx" ON "Interview"("applicationId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPanelMember_interviewId_staffId_key" ON "InterviewPanelMember"("interviewId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewEvaluation_interviewId_evaluatorStaffId_key" ON "InterviewEvaluation"("interviewId", "evaluatorStaffId");

-- CreateIndex
CREATE INDEX "DemoClass_schoolId_scheduledAt_idx" ON "DemoClass"("schoolId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Offer_schoolId_status_idx" ON "Offer"("schoolId", "status");

-- CreateIndex
CREATE INDEX "CandidateDocument_candidateId_documentType_idx" ON "CandidateDocument"("candidateId", "documentType");
