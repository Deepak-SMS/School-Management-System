export interface NewsCategoryRecord {
  id: string;
  name: string;
  code: string;
  colorHex?: string | null;
  status: string;
  counts?: {
    news: number;
  };
  createdAt: string;
}

export interface NewsCategoryListResponse {
  data: NewsCategoryRecord[];
  total: number;
  page: number;
  pageSize: number;
}
