export interface AppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
}

export const mockNotifications: AppNotification[] = [
  {
    id: "ntf_1",
    title: "Fee payment received",
    description: "Rohan Mehta (Class 8-B) paid ₹18,500 towards Term 2 fees.",
    timestamp: "12 minutes ago",
    isRead: false,
  },
  {
    id: "ntf_2",
    title: "New admission enquiry",
    description: "An enquiry was submitted for Class 1 admission at Main Campus.",
    timestamp: "1 hour ago",
    isRead: false,
  },
  {
    id: "ntf_3",
    title: "Low attendance alert",
    description: "Class 10-A attendance dropped below 75% this week.",
    timestamp: "3 hours ago",
    isRead: false,
  },
  {
    id: "ntf_4",
    title: "Timetable updated",
    description: "Mrs. Kulkarni substituted for Class 9-C, Period 4 (Science).",
    timestamp: "Yesterday",
    isRead: true,
  },
  {
    id: "ntf_5",
    title: "Payroll processed",
    description: "October payroll for 86 employees has been finalized.",
    timestamp: "2 days ago",
    isRead: true,
  },
];
