"use client";

import {
  UserPlus,
  Users,
  BookOpenCheck,
  ClipboardCheck,
  ClipboardList,
  CalendarClock,
  Wallet,
  UserCog,
  Briefcase,
  Library,
  Bus,
  MessagesSquare,
  IdCard,
  ScrollText,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/features/marketing/reveal";

const MODULES = [
  { icon: UserPlus, title: "Admissions", description: "Enquiry to enrollment, with a public form parents fill in themselves." },
  { icon: Users, title: "Students", description: "Full profiles, guardians, documents and academic history." },
  { icon: BookOpenCheck, title: "Academics", description: "Classes, sections, subjects and teacher assignments." },
  { icon: ClipboardCheck, title: "Attendance", description: "Daily attendance for students and staff, backed by history." },
  { icon: ClipboardList, title: "Examinations", description: "Exam setup, schedules, marks and report cards." },
  { icon: CalendarClock, title: "Timetable", description: "An automatic generator that avoids teacher and room clashes." },
  { icon: Wallet, title: "Fees & Finance", description: "Fee structures, payments, receipts and outstanding balances." },
  { icon: UserCog, title: "HR & Payroll", description: "Employee records, attendance, leave and salary — access-controlled." },
  { icon: Briefcase, title: "Recruitment", description: "Vacancies, candidates, interviews and offer-to-employee conversion." },
  { icon: Library, title: "Library", description: "Catalogue, circulation and borrowing records." },
  { icon: Bus, title: "Transport", description: "Vehicles, routes, stops and student route assignments." },
  { icon: MessagesSquare, title: "Communication", description: "Reach a class, a department, or a single parent from one place." },
  { icon: IdCard, title: "ID Cards", description: "Design once, generate in bulk, verify instantly by QR code." },
  { icon: ScrollText, title: "Certificates", description: "A visual designer for bonafide, transfer and experience letters." },
  { icon: BarChart3, title: "Reports & Analytics", description: "Attendance, fees and academic performance, in one view." },
  { icon: Sparkles, title: "AI", description: "Ask your school's data questions in plain language." },
];

export function ModulesSection() {
  return (
    <section id="modules" className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Everything your school needs. Connected in one place.
          </h2>
          <p className="mt-3 text-muted-foreground">Every module below is real, working software — not a roadmap slide.</p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((mod, i) => (
            <Reveal key={mod.title} delayMs={(i % 4) * 60}>
              <div className="group flex h-full flex-col gap-3 rounded-2xl border border-border-strong bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary-500/40 hover:shadow-lg">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-transform duration-300 group-hover:scale-110 dark:bg-primary-500/10 dark:text-primary-300">
                  <mod.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-semibold text-foreground">{mod.title}</h3>
                <p className="text-sm text-muted-foreground">{mod.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
