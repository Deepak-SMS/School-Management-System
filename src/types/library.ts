/** Shared reference shape — the same slice every list/detail response nests a related record as. */
interface NamedRef {
  id: string;
  name: string;
}

export interface LibraryCategoryRecord {
  id: string;
  name: string;
  parentId?: string | null;
  isSystemCategory: boolean;
  counts?: { books: number };
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySettingsRecord {
  id: string;
  studentMaxBooks: number;
  studentIssueDays: number;
  teacherMaxBooks: number;
  teacherIssueDays: number;
  staffMaxBooks: number;
  staffIssueDays: number;
  maxRenewals: number;
  finePerDay: number;
  maxFine: number;
  reminderDaysBefore: number;
}

export interface LibraryBookRecord {
  id: string;
  title: string;
  subtitle?: string | null;
  author: string;
  isbn10?: string | null;
  isbn13?: string | null;
  publisher?: string | null;
  publicationYear?: number | null;
  edition?: string | null;
  language?: string | null;
  pageCount?: number | null;
  categoryId?: string | null;
  category?: NamedRef | null;
  subjectId?: string | null;
  subject?: NamedRef | null;
  classRelevanceJson?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  deweyDecimal?: string | null;
  shelf?: string | null;
  rack?: string | null;
  rowLabel?: string | null;
  isActive: boolean;
  counts?: { copies: number; available: number };
  createdAt: string;
  updatedAt: string;
}

export interface LibraryBookCopyRecord {
  id: string;
  bookId: string;
  accessionNumber: string;
  barcode: string;
  rfidTag?: string | null;
  status: string;
  condition: string;
  shelf?: string | null;
  rack?: string | null;
  rowLabel?: string | null;
  purchaseDate?: string | null;
  price?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryBookDetailRecord extends LibraryBookRecord {
  copies: LibraryBookCopyRecord[];
}

export interface LibraryStatsRecord {
  totalTitles: number;
  totalBooks: number;
  totalCategories: number;
  available: number;
  issued: number;
  reserved: number;
  lost: number;
  damaged: number;
  underMaintenance: number;
}
