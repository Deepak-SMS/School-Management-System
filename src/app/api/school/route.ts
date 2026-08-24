import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { apiError } from "@/lib/api-error";
import { SCHOOL_TYPES, INSTITUTION_TYPES, WEEKDAYS, TIME_ZONES, CURRENCIES, DATE_FORMATS, LANGUAGES } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

const schoolInfoSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  shortName: z.string().trim().min(1).max(60).optional(),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  pinCode: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  website: z.string().trim().max(150).optional(),
  affiliationBoard: z.string().trim().max(60).optional(),
  schoolCode: z.string().trim().max(30).optional(),
  principalName: z.string().trim().max(150).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  bannerUrl: z.string().trim().max(500).optional(),
  // School Profile module — additive fields, see prisma/schema.prisma School model.
  registrationNumber: z.string().trim().max(100).optional(),
  schoolType: z.enum(SCHOOL_TYPES).optional(),
  institutionType: z.enum(INSTITUTION_TYPES).optional(),
  establishedYear: optionalNumber(z.coerce.number().int().min(1800).max(2100)),
  alternatePhone: z.string().trim().max(30).optional(),
  administratorName: z.string().trim().max(150).optional(),
  administrativeEmail: z.string().trim().email().optional().or(z.literal("")),
  administrativePhone: z.string().trim().max(30).optional(),
  timeZone: z.enum(TIME_ZONES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  dateFormat: z.enum(DATE_FORMATS).optional(),
  language: z.enum(LANGUAGES).optional(),
  weekStartDay: z.enum(WEEKDAYS).optional(),
  workingDaysJson: z.string().optional(),
  facebookUrl: z.string().trim().max(255).optional(),
  instagramUrl: z.string().trim().max(255).optional(),
  youtubeUrl: z.string().trim().max(255).optional(),
  linkedinUrl: z.string().trim().max(255).optional(),
  twitterUrl: z.string().trim().max(255).optional(),
});

export async function GET() {
  const schoolId = await getCurrentSchoolId();
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  return NextResponse.json(school);
}

export async function PATCH(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = schoolInfoSchema.parse(body);

    const school = await prisma.school.update({ where: { id: schoolId }, data: input });
    return NextResponse.json(school);
  } catch (error) {
    return apiError(error);
  }
}
