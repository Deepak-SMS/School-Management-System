export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  relatedNewsId?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationRecord[];
}
