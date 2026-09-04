/** Single source of truth for News Management's "enum-like" string fields — see prisma/schema.prisma `News` model. */

export const NEWS_STATUSES = ["draft", "scheduled", "published", "expired", "archived", "cancelled"] as const;

export const NEWS_STATUS_LABELS: Record<(typeof NEWS_STATUSES)[number], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  expired: "Expired",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const NEWS_PRIORITIES = ["normal", "important", "urgent", "pinned"] as const;

export const NEWS_PRIORITY_LABELS: Record<(typeof NEWS_PRIORITIES)[number], string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
  pinned: "Pinned",
};

export const NEWS_AUDIENCE_TYPES = ["all", "students", "parents", "teachers", "staff", "admin"] as const;

export const NEWS_AUDIENCE_TYPE_LABELS: Record<(typeof NEWS_AUDIENCE_TYPES)[number], string> = {
  all: "All Users",
  students: "Students",
  parents: "Parents",
  teachers: "Teachers",
  staff: "Non-teaching Staff",
  admin: "School Admin",
};

export const NEWS_COMMENT_STATUSES = ["visible", "hidden"] as const;
