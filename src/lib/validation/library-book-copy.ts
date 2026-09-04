import { z } from "zod";
import { LIBRARY_COPY_CONDITIONS, LIBRARY_COPY_STATUSES } from "@/lib/constants/library";
import { optionalNumber } from "@/lib/validation/shared";

/** Creates one or more copies of a book. Accession numbers and barcodes are always system-generated (brief §5) — never user-typed at creation. */
export const libraryBookCopyCreateSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(200).default(1),
  condition: z.enum(LIBRARY_COPY_CONDITIONS).optional(),
  shelf: z.string().trim().max(30).optional(),
  rack: z.string().trim().max(30).optional(),
  rowLabel: z.string().trim().max(30).optional(),
  purchaseDate: z.string().trim().optional(),
  price: optionalNumber(z.coerce.number().min(0).max(1000000)),
});

export type LibraryBookCopyCreateInput = z.infer<typeof libraryBookCopyCreateSchema>;

/** Editing an existing copy — status/condition transitions, location correction, or a manual barcode/accession fix. */
export const libraryBookCopyUpdateSchema = z.object({
  status: z.enum(LIBRARY_COPY_STATUSES).optional(),
  condition: z.enum(LIBRARY_COPY_CONDITIONS).optional(),
  shelf: z.string().trim().max(30).optional(),
  rack: z.string().trim().max(30).optional(),
  rowLabel: z.string().trim().max(30).optional(),
  purchaseDate: z.string().trim().optional(),
  price: optionalNumber(z.coerce.number().min(0).max(1000000)),
  accessionNumber: z.string().trim().min(1).max(40).optional(),
  barcode: z.string().trim().min(1).max(40).optional(),
  rfidTag: z.string().trim().max(80).optional(),
});

export type LibraryBookCopyUpdateInput = z.infer<typeof libraryBookCopyUpdateSchema>;
