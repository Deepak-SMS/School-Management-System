export const COMMUNICATION_TYPE_VALUES = [
  "parent_message",
  "student_announcement",
  "teacher_announcement",
  "school_circular",
  "holiday_notice",
  "exam_notification",
  "fee_reminder",
  "attendance_warning",
  "meeting_invitation",
  "emergency_notification",
  "appreciation_message",
  "academic_performance_message",
] as const;

export type CommunicationType = (typeof COMMUNICATION_TYPE_VALUES)[number];

export const COMMUNICATION_TYPES: { value: CommunicationType; label: string; hint: string }[] = [
  { value: "parent_message", label: "Parent Message", hint: "A general message to one or more parents/guardians." },
  { value: "student_announcement", label: "Student Announcement", hint: "An announcement addressed directly to students." },
  { value: "teacher_announcement", label: "Teacher Announcement", hint: "An announcement addressed to teaching staff." },
  { value: "school_circular", label: "School Circular", hint: "A formal, official circular from the school administration." },
  { value: "holiday_notice", label: "Holiday Notice", hint: "Notice of an upcoming holiday or school closure." },
  { value: "exam_notification", label: "Exam Notification", hint: "Notification about an upcoming examination — dates, syllabus, or instructions." },
  { value: "fee_reminder", label: "Fee Reminder", hint: "A reminder to parents about pending or overdue fee payment." },
  { value: "attendance_warning", label: "Attendance Warning", hint: "A message to parents about a student's low attendance, encouraging improvement." },
  { value: "meeting_invitation", label: "Meeting Invitation", hint: "An invitation to a parent-teacher meeting or school event." },
  { value: "emergency_notification", label: "Emergency Notification", hint: "An urgent, time-sensitive notice (safety, closure, emergency)." },
  { value: "appreciation_message", label: "Appreciation Message", hint: "A positive, congratulatory message recognizing an achievement." },
  { value: "academic_performance_message", label: "Academic Performance Message", hint: "A message to parents about a student's academic performance." },
];

export const COMMUNICATION_TONE_VALUES = ["professional", "friendly", "formal", "short", "polite", "urgent"] as const;
export type CommunicationTone = (typeof COMMUNICATION_TONE_VALUES)[number];

export const COMMUNICATION_TONES: { value: CommunicationTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "short", label: "Short" },
  { value: "polite", label: "Polite" },
  { value: "urgent", label: "Urgent" },
];

export const COMMUNICATION_LANGUAGES = ["English", "Hindi", "Marathi"] as const;
