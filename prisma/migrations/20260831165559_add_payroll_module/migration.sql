-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'fixed',
    "amount" REAL,
    "percentage" REAL,
    "formula" TEXT,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryComponent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryStructureItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "structureId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" REAL,
    "percentage" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SalaryStructureItem_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalaryStructureItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryStructureAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryStructureAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalaryStructureAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalaryStructureAssignment_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "rate" REAL,
    "thresholdAmount" REAL,
    "employeeContributionPercent" REAL,
    "employerContributionPercent" REAL,
    "applicableEmployeeGroup" TEXT NOT NULL DEFAULT 'all',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "processedAt" DATETIME,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "lockedById" TEXT,
    "lockedAt" DATETIME,
    "reopenedById" TEXT,
    "reopenedAt" DATETIME,
    "reopenReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "structureId" TEXT,
    "workingDays" INTEGER NOT NULL,
    "payableDays" REAL NOT NULL,
    "grossSalary" REAL NOT NULL,
    "totalDeductions" REAL NOT NULL,
    "netSalary" REAL NOT NULL,
    "earningsJson" TEXT NOT NULL,
    "deductionsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "slipNumber" TEXT NOT NULL,
    "pdfFileId" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalarySlip_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalarySlip_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PayrollEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalarySlip_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "UploadedFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalarySlipNumberingSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SalarySlipNumberingSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SalaryComponent_schoolId_idx" ON "SalaryComponent"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_schoolId_code_key" ON "SalaryComponent"("schoolId", "code");

-- CreateIndex
CREATE INDEX "SalaryStructure_schoolId_idx" ON "SalaryStructure"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_schoolId_name_key" ON "SalaryStructure"("schoolId", "name");

-- CreateIndex
CREATE INDEX "SalaryStructureItem_structureId_idx" ON "SalaryStructureItem"("structureId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureItem_structureId_componentId_key" ON "SalaryStructureItem"("structureId", "componentId");

-- CreateIndex
CREATE INDEX "SalaryStructureAssignment_schoolId_staffId_idx" ON "SalaryStructureAssignment"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "SalaryStructureAssignment_structureId_idx" ON "SalaryStructureAssignment"("structureId");

-- CreateIndex
CREATE INDEX "PayrollRule_schoolId_ruleType_effectiveDate_idx" ON "PayrollRule"("schoolId", "ruleType", "effectiveDate");

-- CreateIndex
CREATE INDEX "PayrollPeriod_schoolId_status_idx" ON "PayrollPeriod"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_schoolId_year_month_key" ON "PayrollPeriod"("schoolId", "year", "month");

-- CreateIndex
CREATE INDEX "PayrollEntry_schoolId_periodId_idx" ON "PayrollEntry"("schoolId", "periodId");

-- CreateIndex
CREATE INDEX "PayrollEntry_staffId_idx" ON "PayrollEntry"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_periodId_staffId_key" ON "PayrollEntry"("periodId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlip_entryId_key" ON "SalarySlip"("entryId");

-- CreateIndex
CREATE INDEX "SalarySlip_schoolId_idx" ON "SalarySlip"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlipNumberingSequence_schoolId_year_key" ON "SalarySlipNumberingSequence"("schoolId", "year");
