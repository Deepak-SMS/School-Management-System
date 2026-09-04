import type { PermissionModule } from "@/types/permissions";

export const SCHOOL_STATUSES = ["trial", "active", "suspended", "expired", "cancelled"] as const;

export const SCHOOL_STATUS_LABELS: Record<(typeof SCHOOL_STATUSES)[number], string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const SCHOOL_PLANS = ["starter", "professional", "enterprise"] as const;

export const SCHOOL_PLAN_LABELS: Record<(typeof SCHOOL_PLANS)[number], string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

/**
 * Default module set granted when a new school is created on a given plan.
 * The Super Admin can still adjust individual toggles afterward from the
 * school detail page. `null` (Enterprise) means unrestricted — see
 * School.enabledModulesJson in prisma/schema.prisma.
 */
export const PLAN_DEFAULT_MODULES: Record<(typeof SCHOOL_PLANS)[number], PermissionModule[] | null> = {
  starter: [
    "schoolProfile",
    "campuses",
    "academicYears",
    "classes",
    "sections",
    "subjects",
    "departments",
    "students",
    "guardians",
    "studentAttendance",
    "feeCategories",
    "feeStructures",
    "studentFees",
    "payments",
    "receipts",
  ],
  professional: [
    "schoolProfile",
    "campuses",
    "academicYears",
    "classes",
    "sections",
    "subjects",
    "departments",
    "students",
    "guardians",
    "studentAttendance",
    "studentRegistrations",
    "admissionEnquiries",
    "hrDashboard",
    "employees",
    "employeeDocuments",
    "designations",
    "employeeTypes",
    "employeeAttendance",
    "staffLeave",
    "holidays",
    "idCards",
    "certificateTypes",
    "certificates",
    "feeCategories",
    "feeStudentCategories",
    "lateFeeRules",
    "feeStructures",
    "studentFees",
    "payments",
    "receipts",
    "expenses",
    "expenseCategories",
  ],
  enterprise: null,
};
