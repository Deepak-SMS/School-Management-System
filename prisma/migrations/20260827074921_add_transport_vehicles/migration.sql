-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL DEFAULT 'bus',
    "make" TEXT,
    "modelName" TEXT,
    "manufacturingYear" INTEGER,
    "seatingCapacity" INTEGER,
    "standingCapacity" INTEGER,
    "fuelType" TEXT,
    "color" TEXT,
    "gpsDeviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportVehicle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransportVehicle_schoolId_status_idx" ON "TransportVehicle"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_schoolId_vehicleNumber_key" ON "TransportVehicle"("schoolId", "vehicleNumber");
