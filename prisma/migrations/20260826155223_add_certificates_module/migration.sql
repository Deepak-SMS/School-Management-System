-- CreateTable
CREATE TABLE "CertificateType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "numberingPrefix" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isSystemType" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificateType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "basedOnTemplateId" TEXT,
    "certificateTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageWidthMm" REAL NOT NULL DEFAULT 210,
    "pageHeightMm" REAL NOT NULL DEFAULT 297,
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificateTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateTemplate_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateTemplate_basedOnTemplateId_fkey" FOREIGN KEY ("basedOnTemplateId") REFERENCES "CertificateTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateDesignElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'front',
    "type" TEXT NOT NULL,
    "fieldKey" TEXT,
    "content" TEXT,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "rotation" REAL NOT NULL DEFAULT 0,
    "fontSize" REAL,
    "fontFamily" TEXT,
    "fontWeight" TEXT,
    "textAlign" TEXT,
    "letterSpacing" REAL,
    "lineHeight" REAL,
    "color" TEXT,
    "backgroundColor" TEXT,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificateDesignElement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateTemplateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CertificateTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateNumberingSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CertificateNumberingSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateNumberingSequence_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "academicYearId" TEXT,
    "certificateNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "fieldValuesJson" TEXT NOT NULL,
    "generatedByUserId" TEXT,
    "revokedAt" DATETIME,
    "revokedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Certificate_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Certificate_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Certificate_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Certificate_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visibleFieldsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificateVerification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateVerification_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CertificateType_schoolId_category_idx" ON "CertificateType"("schoolId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateType_schoolId_key_key" ON "CertificateType"("schoolId", "key");

-- CreateIndex
CREATE INDEX "CertificateTemplate_schoolId_certificateTypeId_idx" ON "CertificateTemplate"("schoolId", "certificateTypeId");

-- CreateIndex
CREATE INDEX "CertificateTemplate_isSystemTemplate_idx" ON "CertificateTemplate"("isSystemTemplate");

-- CreateIndex
CREATE INDEX "CertificateDesignElement_templateId_side_idx" ON "CertificateDesignElement"("templateId", "side");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplateVersion_templateId_versionNumber_key" ON "CertificateTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateNumberingSequence_schoolId_certificateTypeId_year_key" ON "CertificateNumberingSequence"("schoolId", "certificateTypeId", "year");

-- CreateIndex
CREATE INDEX "Certificate_schoolId_status_idx" ON "Certificate"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Certificate_studentId_idx" ON "Certificate"("studentId");

-- CreateIndex
CREATE INDEX "Certificate_staffId_idx" ON "Certificate"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_schoolId_certificateNumber_key" ON "Certificate"("schoolId", "certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateVerification_code_key" ON "CertificateVerification"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateVerification_certificateId_key" ON "CertificateVerification"("certificateId");

-- CreateIndex
CREATE INDEX "CertificateVerification_schoolId_idx" ON "CertificateVerification"("schoolId");
