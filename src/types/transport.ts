/** Shape returned by GET /api/transport-vehicles (and /api/transport-vehicles/[id]) — dates arrive as ISO strings over JSON. */
export interface TransportVehicleRecord {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  make?: string | null;
  modelName?: string | null;
  manufacturingYear?: number | null;
  seatingCapacity?: number | null;
  standingCapacity?: number | null;
  fuelType?: string | null;
  color?: string | null;
  gpsDeviceId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportVehicleListResponse {
  data: TransportVehicleRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface NamedRef {
  id: string;
  name: string;
}

export interface TransportDriverRecord {
  id: string;
  staffId?: string | null;
  fullName?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  address?: string | null;
  licenseNumber?: string | null;
  licenseType?: string | null;
  licenseIssueDate?: string | null;
  licenseExpiryDate?: string | null;
  policeVerificationDate?: string | null;
  medicalCertificateExpiryDate?: string | null;
  status: string;
  staff?: { id: string; fullName: string; mobileNumber: string; photoUrl?: string | null; employmentStatus: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransportStopRecord {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceFromSchool?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportRouteAssignmentRecord {
  id: string;
  routeId: string;
  vehicleId: string;
  driverId: string;
  startDate: string;
  effectiveTo?: string | null;
  note?: string | null;
  createdAt: string;
  vehicle: { id: string; vehicleNumber: string; vehicleType: string; seatingCapacity?: number | null };
  driver: { id: string; fullName?: string | null; phone?: string | null; staff?: { fullName: string; mobileNumber: string } | null };
}

export interface TransportRouteStopRecord {
  id: string;
  routeId: string;
  stopId: string;
  sequenceOrder: number;
  pickupTime?: string | null;
  dropTime?: string | null;
  stop: TransportStopRecord;
}

export interface TransportRouteRecord {
  id: string;
  name: string;
  routeNumber?: string | null;
  startingPoint?: string | null;
  destination?: string | null;
  totalDistanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  morningTiming?: string | null;
  afternoonTiming?: string | null;
  status: string;
  counts?: { stops: number; students: number };
  currentAssignment?: TransportRouteAssignmentRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransportRouteDetailRecord extends TransportRouteRecord {
  stops: TransportRouteStopRecord[];
  assignmentHistory: TransportRouteAssignmentRecord[];
}

export interface StudentTransportRecord {
  id: string;
  studentId: string;
  routeId: string;
  pickupStopId: string;
  dropStopId?: string | null;
  direction: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    photoUrl?: string | null;
    class: NamedRef;
    section?: NamedRef | null;
  };
  route: { id: string; name: string; routeNumber?: string | null };
  pickupStop: NamedRef;
  dropStop?: NamedRef | null;
  createdAt: string;
  updatedAt: string;
}
