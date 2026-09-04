import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { runTimetableGeneration } from "@/lib/timetable/generate-timetable";
import { apiError } from "@/lib/api-error";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id } = await params;
    const result = await runTimetableGeneration(schoolId, id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
