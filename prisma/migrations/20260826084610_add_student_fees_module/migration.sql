-- CreateTable
CREATE TABLE "StudentFeeCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT,
    "feeStructureItemId" TEXT,
    "feeCategoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentFeeCharge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentFeeCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentFeeCharge_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentFeeCharge_feeStructureItemId_fkey" FOREIGN KEY ("feeStructureItemId") REFERENCES "FeeStructureItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentFeeCharge_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "FeeCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentFeeAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "chargeId" TEXT,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT,
    "relatedStudentId" TEXT,
    "appliedById" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentFeeAdjustment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentFeeAdjustment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentFeeAdjustment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentFeeCharge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentFeeAdjustment_relatedStudentId_fkey" FOREIGN KEY ("relatedStudentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentFeeCharge_schoolId_studentId_idx" ON "StudentFeeCharge"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentFeeCharge_feeStructureId_idx" ON "StudentFeeCharge"("feeStructureId");

-- CreateIndex
CREATE INDEX "StudentFeeCharge_feeStructureItemId_idx" ON "StudentFeeCharge"("feeStructureItemId");

-- CreateIndex
CREATE INDEX "StudentFeeAdjustment_schoolId_studentId_idx" ON "StudentFeeAdjustment"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentFeeAdjustment_chargeId_idx" ON "StudentFeeAdjustment"("chargeId");
