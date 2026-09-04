import { z } from "zod";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = (max: number) => z.string().trim().max(max).optional();

export const libraryBookInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  subtitle: optionalString(300),
  author: z.string().trim().min(1, "Author is required").max(200),
  isbn10: optionalString(10),
  isbn13: optionalString(17),
  publisher: optionalString(150),
  publicationYear: optionalNumber(z.coerce.number().int().min(1400).max(2100)),
  edition: optionalString(50),
  language: optionalString(50),
  pageCount: optionalNumber(z.coerce.number().int().min(1).max(20000)),
  categoryId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  // Pre-serialized JSON array of Class ids — same convention as School.workingDaysJson.
  classRelevanceJson: z.string().optional(),
  description: optionalString(4000),
  coverImageUrl: optionalString(500),
  deweyDecimal: optionalString(30),
  shelf: optionalString(30),
  rack: optionalString(30),
  rowLabel: optionalString(30),
  isActive: z.boolean().optional(),
});

export type LibraryBookInput = z.infer<typeof libraryBookInputSchema>;
