-- CreateTable
CREATE TABLE "TransportDriver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT,
    "fullName" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "address" TEXT,
    "licenseNumber" TEXT,
    "licenseType" TEXT,
    "licenseIssueDate" DATETIME,
    "licenseExpiryDate" DATETIME,
    "policeVerificationDate" DATETIME,
    "medicalCertificateExpiryDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportDriver_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportDriver_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "landmark" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "distanceFromSchool" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportStop_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "routeNumber" TEXT,
    "startingPoint" TEXT,
    "destination" TEXT,
    "totalDistanceKm" REAL,
    "estimatedDurationMinutes" INTEGER,
    "morningTiming" TEXT,
    "afternoonTiming" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportRoute_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportRouteStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "pickupTime" TEXT,
    "dropTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportRouteStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportStop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportRouteAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportRouteAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportRouteAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportRouteAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportRouteAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TransportDriver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentTransport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "pickupStopId" TEXT NOT NULL,
    "dropStopId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'two_way',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentTransport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentTransport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentTransport_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentTransport_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "TransportStop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentTransport_dropStopId_fkey" FOREIGN KEY ("dropStopId") REFERENCES "TransportStop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportDriver_staffId_key" ON "TransportDriver"("staffId");

-- CreateIndex
CREATE INDEX "TransportDriver_schoolId_status_idx" ON "TransportDriver"("schoolId", "status");

-- CreateIndex
CREATE INDEX "TransportStop_schoolId_status_idx" ON "TransportStop"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStop_schoolId_name_key" ON "TransportStop"("schoolId", "name");

-- CreateIndex
CREATE INDEX "TransportRoute_schoolId_status_idx" ON "TransportRoute"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_schoolId_name_key" ON "TransportRoute"("schoolId", "name");

-- CreateIndex
CREATE INDEX "TransportRouteStop_routeId_sequenceOrder_idx" ON "TransportRouteStop"("routeId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRouteStop_routeId_stopId_key" ON "TransportRouteStop"("routeId", "stopId");

-- CreateIndex
CREATE INDEX "TransportRouteAssignment_routeId_effectiveTo_idx" ON "TransportRouteAssignment"("routeId", "effectiveTo");

-- CreateIndex
CREATE INDEX "TransportRouteAssignment_schoolId_idx" ON "TransportRouteAssignment"("schoolId");

-- CreateIndex
CREATE INDEX "StudentTransport_schoolId_status_idx" ON "StudentTransport"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StudentTransport_studentId_idx" ON "StudentTransport"("studentId");

-- CreateIndex
CREATE INDEX "StudentTransport_routeId_idx" ON "StudentTransport"("routeId");
