-- CreateTable
CREATE TABLE "WhatsAppAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "phoneNumber" TEXT,
    "displayName" TEXT,
    "businessName" TEXT,
    "qrCodeDataUrl" TEXT,
    "qrGeneratedAt" DATETIME,
    "sessionDataJson" TEXT,
    "connectedAt" DATETIME,
    "disconnectedAt" DATETIME,
    "lastActivityAt" DATETIME,
    "dailyMessageCount" INTEGER NOT NULL DEFAULT 0,
    "dailyMessageCountDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "guardianId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "name" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "rawPhone" TEXT,
    "tagsJson" TEXT,
    "customFieldsJson" TEXT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "optedOutAt" DATETIME,
    "optedOutReason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppContact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppContact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppContact_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "bodyText" TEXT NOT NULL,
    "variablesJson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "messageBody" TEXT NOT NULL,
    "audienceMode" TEXT NOT NULL,
    "audienceFilterJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "invalidNumberCount" INTEGER NOT NULL DEFAULT 0,
    "optedOutCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppCampaign_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppMessageJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "studentId" TEXT,
    "guardianId" TEXT,
    "recipientName" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "variablesJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" DATETIME,
    "providerMessageId" TEXT,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppMessageJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppMessageJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WhatsAppCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppMessageJob_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsAppContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppMessageJob_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppMessageJob_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAccount_schoolId_key" ON "WhatsAppAccount"("schoolId");

-- CreateIndex
CREATE INDEX "WhatsAppContact_schoolId_studentId_idx" ON "WhatsAppContact"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "WhatsAppContact_schoolId_guardianId_idx" ON "WhatsAppContact"("schoolId", "guardianId");

-- CreateIndex
CREATE INDEX "WhatsAppContact_schoolId_isActive_idx" ON "WhatsAppContact"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_schoolId_phoneE164_key" ON "WhatsAppContact"("schoolId", "phoneE164");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_schoolId_isActive_idx" ON "WhatsAppTemplate"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_schoolId_category_idx" ON "WhatsAppTemplate"("schoolId", "category");

-- CreateIndex
CREATE INDEX "WhatsAppCampaign_schoolId_status_idx" ON "WhatsAppCampaign"("schoolId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppCampaign_schoolId_createdAt_idx" ON "WhatsAppCampaign"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageJob_schoolId_campaignId_status_idx" ON "WhatsAppMessageJob"("schoolId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppMessageJob_campaignId_status_idx" ON "WhatsAppMessageJob"("campaignId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppMessageJob_schoolId_phoneE164_idx" ON "WhatsAppMessageJob"("schoolId", "phoneE164");

-- CreateIndex
CREATE INDEX "WhatsAppMessageJob_schoolId_createdAt_idx" ON "WhatsAppMessageJob"("schoolId", "createdAt");
