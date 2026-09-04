-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paidOn" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "referenceNo" TEXT,
    "bankName" TEXT,
    "invoiceRef" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "receivedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentFeeCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT 'RCPT',
    "issuedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "schoolName" TEXT NOT NULL,
    "schoolAddress" TEXT,
    "schoolPhone" TEXT,
    "schoolEmail" TEXT,
    "schoolLogoUrl" TEXT,
    "studentName" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "className" TEXT,
    "sectionName" TEXT,
    "academicYear" TEXT,
    "amountPaid" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "referenceNo" TEXT,
    "invoiceRef" TEXT,
    "paidOn" DATETIME NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "componentsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "voidedAt" DATETIME,
    "voidReason" TEXT,
    "voidedById" TEXT,
    "emailedAt" DATETIME,
    "emailedTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Receipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ReceiptCounter_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Payment_schoolId_studentId_idx" ON "Payment"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_paidOn_idx" ON "Payment"("schoolId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_schoolId_paymentNumber_key" ON "Payment"("schoolId", "paymentNumber");

-- CreateIndex
CREATE INDEX "PaymentAllocation_chargeId_idx" ON "PaymentAllocation"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_chargeId_key" ON "PaymentAllocation"("paymentId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_schoolId_issuedOn_idx" ON "Receipt"("schoolId", "issuedOn");

-- CreateIndex
CREATE INDEX "Receipt_schoolId_studentId_idx" ON "Receipt"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_schoolId_receiptNumber_key" ON "Receipt"("schoolId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptCounter_schoolId_series_year_key" ON "ReceiptCounter"("schoolId", "series", "year");
