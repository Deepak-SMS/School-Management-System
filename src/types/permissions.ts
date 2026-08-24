export type PermissionModule =
  | "schoolProfile"
  | "campuses"
  | "academicYears"
  | "classes"
  | "sections"
  | "subjects"
  | "departments";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "export" | "activate" | "deactivate";
