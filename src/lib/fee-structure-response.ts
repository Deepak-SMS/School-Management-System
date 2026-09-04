import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Shared shape for every route that returns a FeeStructure — list, detail, create, update, publish, archive, duplicate. */
export const feeStructureInclude = {
  academicYear: { select: { id: true, label: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  studentCategory: { select: { id: true, name: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      feeCategory: { select: { id: true, name: true, code: true } },
      lateFeeRule: { select: { id: true, name: true } },
      installments: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} satisfies Prisma.FeeStructureInclude;

type FeeStructureWithRelations = Prisma.FeeStructureGetPayload<{ include: typeof feeStructureInclude }>;

/** Adds `totalAmount` (sum of every item's amount) and the live count of actively-assigned students. */
export async function shapeFeeStructure(row: FeeStructureWithRelations) {
  const totalAmount = row.items.reduce((sum, item) => sum + item.amount, 0);
  const assignedStudents = await prisma.feeStructureAssignment.count({ where: { feeStructureId: row.id, status: "active" } });
  return { ...row, totalAmount, counts: { assignedStudents } };
}

export async function shapeFeeStructures(rows: FeeStructureWithRelations[]) {
  return Promise.all(rows.map(shapeFeeStructure));
}
