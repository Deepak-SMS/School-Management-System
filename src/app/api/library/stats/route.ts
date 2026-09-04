import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";

/**
 * Library dashboard stats (brief §1). Only the catalogue/copy figures are
 * real yet — issued/overdue/reserved/lost/damaged counts will read from
 * LibraryIssue/LibraryReservation once circulation (Phase 5+) exists.
 */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("libraryCatalogue", "view");

    const [totalTitles, totalCategories, copiesByStatus] = await Promise.all([
      prisma.libraryBook.count({ where: { schoolId, isActive: true } }),
      prisma.libraryCategory.count({ where: { schoolId } }),
      prisma.libraryBookCopy.groupBy({ by: ["status"], where: { schoolId }, _count: true }),
    ]);

    const statusCounts = Object.fromEntries(copiesByStatus.map((row) => [row.status, row._count]));
    const totalBooks = copiesByStatus.reduce((sum, row) => sum + row._count, 0);

    return NextResponse.json({
      totalTitles,
      totalBooks,
      totalCategories,
      available: statusCounts.available ?? 0,
      issued: statusCounts.issued ?? 0,
      reserved: statusCounts.reserved ?? 0,
      lost: statusCounts.lost ?? 0,
      damaged: statusCounts.damaged ?? 0,
      underMaintenance: statusCounts.under_maintenance ?? 0,
    });
  } catch (error) {
    return apiError(error);
  }
}
