/** Shape returned by GET /api/exam-types (and /api/exam-types/[id]). */
export interface ExamTypeRecord {
  id: string;
  name: string;
  code: string;
  examCategory: string;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
