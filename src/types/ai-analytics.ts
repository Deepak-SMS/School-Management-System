export interface AttendanceOverview {
  totalMarked: number;
  present: number;
  absent: number;
  attendancePct: number;
  dailyTrend: { date: string; present: number; absent: number }[];
  classWise: { classId: string; className: string; present: number; total: number; pct: number }[];
}

export interface LowAttendanceStudent {
  studentId: string;
  name: string;
  className: string;
  sectionName: string | null;
  presentDays: number;
  totalDays: number;
  pct: number;
}

export interface FeesOverview {
  totalCharged: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  collectionPct: number;
  defaulterCount: number;
  monthlyTrend: { month: string; collected: number }[];
  classWise: { classId: string; className: string; charged: number; paid: number; pending: number }[];
}

export interface FeeDefaulter {
  studentId: string;
  name: string;
  className: string;
  sectionName: string | null;
  pending: number;
  overdue: number;
}

export interface AiAttendanceAnalyticsResponse {
  section: "attendance";
  stats: AttendanceOverview;
  lowAttendanceStudents: LowAttendanceStudent[];
  narrative: string | null;
  narrativeError?: string;
  from: string;
  to: string;
}

export interface AiFeesAnalyticsResponse {
  section: "fees";
  stats: FeesOverview;
  feeDefaulters: FeeDefaulter[];
  narrative: string | null;
  narrativeError?: string;
  from: string;
  to: string;
}

export type AiAnalyticsResponse = AiAttendanceAnalyticsResponse | AiFeesAnalyticsResponse;
