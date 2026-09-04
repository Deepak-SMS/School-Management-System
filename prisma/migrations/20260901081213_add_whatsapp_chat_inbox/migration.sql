-- CreateTable
CREATE TABLE "WhatsAppChat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "contactId" TEXT,
    "phoneE164" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastMessageAt" DATETIME,
    "lastMessagePreview" TEXT,
    "lastMessageFromMe" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppChat_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppChat_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsAppContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppChatMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "WhatsAppChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WhatsAppChat_schoolId_lastMessageAt_idx" ON "WhatsAppChat"("schoolId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppChat_schoolId_phoneE164_key" ON "WhatsAppChat"("schoolId", "phoneE164");

-- CreateIndex
CREATE INDEX "WhatsAppChatMessage_schoolId_chatId_sentAt_idx" ON "WhatsAppChatMessage"("schoolId", "chatId", "sentAt");
