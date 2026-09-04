import type { NotificationListResponse } from "@/types/notification";

export const notificationService = {
  async list(): Promise<NotificationListResponse> {
    const response = await fetch("/api/notifications");
    if (!response.ok) throw new Error("Failed to load notifications");
    return response.json();
  },
};
