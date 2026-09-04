-- AlterTable
ALTER TABLE "CertificateTemplate" ADD COLUMN "backgroundImageUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CertificateDesignElement" (
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
    "imageUrl" TEXT,
    "borderWidth" REAL,
    "borderColor" TEXT,
    "borderStyle" TEXT NOT NULL DEFAULT 'solid',
    "opacity" REAL NOT NULL DEFAULT 1,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificateDesignElement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CertificateDesignElement" ("backgroundColor", "color", "content", "createdAt", "fieldKey", "fontFamily", "fontSize", "fontWeight", "height", "id", "isHidden", "isLocked", "letterSpacing", "lineHeight", "rotation", "side", "templateId", "textAlign", "type", "updatedAt", "width", "x", "y", "zIndex") SELECT "backgroundColor", "color", "content", "createdAt", "fieldKey", "fontFamily", "fontSize", "fontWeight", "height", "id", "isHidden", "isLocked", "letterSpacing", "lineHeight", "rotation", "side", "templateId", "textAlign", "type", "updatedAt", "width", "x", "y", "zIndex" FROM "CertificateDesignElement";
DROP TABLE "CertificateDesignElement";
ALTER TABLE "new_CertificateDesignElement" RENAME TO "CertificateDesignElement";
CREATE INDEX "CertificateDesignElement_templateId_side_idx" ON "CertificateDesignElement"("templateId", "side");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
