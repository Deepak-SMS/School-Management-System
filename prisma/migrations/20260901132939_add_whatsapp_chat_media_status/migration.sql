-- AlterTable
ALTER TABLE "WhatsAppChat" ADD COLUMN "avatarUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT NOT NULL,
    "status" TEXT,
    "providerMessageId" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppChatMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "WhatsAppChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppChatMessage" ("chatId", "createdAt", "direction", "id", "providerMessageId", "schoolId", "sentAt", "text") SELECT "chatId", "createdAt", "direction", "id", "providerMessageId", "schoolId", "sentAt", "text" FROM "WhatsAppChatMessage";
DROP TABLE "WhatsAppChatMessage";
ALTER TABLE "new_WhatsAppChatMessage" RENAME TO "WhatsAppChatMessage";
CREATE INDEX "WhatsAppChatMessage_schoolId_chatId_sentAt_idx" ON "WhatsAppChatMessage"("schoolId", "chatId", "sentAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
