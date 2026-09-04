export interface NewsFileRef {
  id: string;
  url: string;
  originalName?: string | null;
}

export interface NewsAudienceTargetRecord {
  id: string;
  class: { id: string; name: string };
  section?: { id: string; name: string } | null;
}

export interface NewsAttachmentRecord {
  id: string;
  label?: string | null;
  file: NewsFileRef;
}

export interface NewsImageRecord {
  id: string;
  caption?: string | null;
  sortOrder: number;
  file: NewsFileRef;
}

export interface NewsCommentRecord {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  status: string;
  createdAt: string;
}

/** Shape returned by GET /api/news (and /api/news/[id]). */
export interface NewsRecord {
  id: string;
  title: string;
  shortDescription?: string | null;
  contentHtml: string;
  category?: { id: string; name: string; colorHex?: string | null } | null;
  author?: { id: string; fullName: string } | null;
  featuredImage?: NewsFileRef | null;
  priority: string;
  status: string;
  audienceType: string;
  audienceTargets?: NewsAudienceTargetRecord[];
  attachments?: NewsAttachmentRecord[];
  images?: NewsImageRecord[];
  comments?: NewsCommentRecord[];
  commentsEnabled: boolean;
  notifyInApp: boolean;
  publishAt?: string | null;
  expiresAt?: string | null;
  autoArchiveAfterExpiry: boolean;
  viewCount: number;
  counts?: {
    comments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface NewsListResponse {
  data: NewsRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewsDashboardStats {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  archived: number;
  pinned: number;
  publishedThisMonth: number;
}
