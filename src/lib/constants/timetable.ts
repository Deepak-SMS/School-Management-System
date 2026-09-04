export const ROOM_TYPES = ["classroom", "lab", "activity", "other"] as const;

export const ROOM_TYPE_LABELS: Record<(typeof ROOM_TYPES)[number], string> = {
  classroom: "Classroom",
  lab: "Laboratory",
  activity: "Activity Room",
  other: "Other",
};

export const PERIOD_KINDS = ["teaching", "break", "lunch", "assembly"] as const;

export const PERIOD_KIND_LABELS: Record<(typeof PERIOD_KINDS)[number], string> = {
  teaching: "Teaching Period",
  break: "Break",
  lunch: "Lunch",
  assembly: "Assembly",
};

export const TIMETABLE_STATUSES = ["draft", "published", "archived"] as const;

export const TIMETABLE_STATUS_LABELS: Record<(typeof TIMETABLE_STATUSES)[number], string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
