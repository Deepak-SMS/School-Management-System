import Link from "next/link";
import { APP_NAME, APP_LOGO_MARK } from "@/config/app";

const COLUMNS = [
  { title: "Platform", links: ["Admissions", "Academics", "Attendance", "Exams", "Fees", "HR", "Transport", "AI"] },
  { title: "Solutions", links: ["School Admin", "Teachers", "Parents", "Students"] },
  { title: "Company", links: ["About", "Contact", "Careers"] },
  { title: "Resources", links: ["Documentation", "Help Center", "FAQs"] },
  { title: "Legal", links: ["Privacy", "Terms", "Security"] },
];

export function FooterSection() {
  return (
    <footer className="border-t border-border py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
                {APP_LOGO_MARK}
              </span>
              <span className="text-sm font-semibold text-foreground">{APP_NAME}</span>
            </Link>
            <p className="text-xs text-muted-foreground">The operating system for modern schools.</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.title}</p>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="text-sm text-muted-foreground">{link}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <Link href="/login" className="hover:text-foreground">
            Sign in to your school
          </Link>
        </div>
      </div>
    </footer>
  );
}
