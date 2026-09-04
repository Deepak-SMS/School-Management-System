-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "googleUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "tokenExpiry" DATETIME,
    "scopesJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastError" TEXT,
    "dailyMessageCount" INTEGER NOT NULL DEFAULT 0,
    "dailyMessageCountDate" DATETIME,
    "connectedAt" DATETIME,
    "disconnectedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GmailConnection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "variablesJson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "senderEmail" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "audienceFilterJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailCampaign_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "renderedHtml" TEXT NOT NULL,
    "renderedText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "lastErrorType" TEXT,
    "providerMessageId" TEXT,
    "nextAttemptAt" DATETIME,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "sentAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailJob_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailSuppression_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailCampaignAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "uploadedFileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailCampaignAttachment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailCampaignAttachment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailCampaignAttachment_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_schoolId_key" ON "GmailConnection"("schoolId");

-- CreateIndex
CREATE INDEX "EmailTemplate_schoolId_isActive_idx" ON "EmailTemplate"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "EmailTemplate_schoolId_category_idx" ON "EmailTemplate"("schoolId", "category");

-- CreateIndex
CREATE INDEX "EmailCampaign_schoolId_status_idx" ON "EmailCampaign"("schoolId", "status");

-- CreateIndex
CREATE INDEX "EmailCampaign_schoolId_createdAt_idx" ON "EmailCampaign"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailCampaign_schoolId_scheduledAt_idx" ON "EmailCampaign"("schoolId", "scheduledAt");

-- CreateIndex
CREATE INDEX "EmailJob_schoolId_campaignId_status_idx" ON "EmailJob"("schoolId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "EmailJob_campaignId_status_idx" ON "EmailJob"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EmailJob_schoolId_recipientEmail_idx" ON "EmailJob"("schoolId", "recipientEmail");

-- CreateIndex
CREATE INDEX "EmailJob_schoolId_studentId_idx" ON "EmailJob"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "EmailJob_schoolId_createdAt_idx" ON "EmailJob"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailJob_providerMessageId_idx" ON "EmailJob"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailJob_campaignId_recipientEmail_key" ON "EmailJob"("campaignId", "recipientEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_schoolId_email_key" ON "EmailSuppression"("schoolId", "email");

-- CreateIndex
CREATE INDEX "EmailCampaignAttachment_schoolId_campaignId_idx" ON "EmailCampaignAttachment"("schoolId", "campaignId");
