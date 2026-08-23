"use client";

import { useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useTenant } from "@/providers/tenant-provider";
import { cn } from "@/lib/utils";

export function TenantSwitcher() {
  const {
    schools,
    currentSchool,
    currentCampus,
    currentAcademicYear,
    setCurrentSchoolId,
    setCurrentCampusId,
    setCurrentAcademicYearId,
    isLoading,
  } = useTenant();
  const [open, setOpen] = useState(false);

  if (isLoading || !currentSchool) {
    return <div className="h-9 w-56 animate-pulse rounded-md bg-black/[.05] dark:bg-white/[.06]" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex max-w-xs items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-100 text-xs font-bold text-primary-700">
            {currentSchool.logoInitials}
          </span>
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="truncate text-sm font-semibold text-foreground">{currentSchool.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {currentCampus?.name}
              {currentAcademicYear ? ` · AY ${currentAcademicYear.label}` : ""}
            </span>
          </span>
          <ChevronsUpDown className="ml-1 hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Current school
        </p>
        <div className="flex items-center gap-2.5 rounded-md bg-primary-50 px-2.5 py-2 dark:bg-primary-500/10">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-xs font-bold text-white">
            {currentSchool.logoInitials}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{currentSchool.name}</span>
          <Check className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Campus</span>
            <Select value={currentCampus?.id} onValueChange={setCurrentCampusId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select campus" />
              </SelectTrigger>
              <SelectContent>
                {currentSchool.campuses.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id}>
                    {campus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Academic year</span>
            <Select value={currentAcademicYear?.id} onValueChange={setCurrentAcademicYearId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {currentSchool.academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {schools.length > 1 && (
          <>
            <p className="mt-4 px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Other schools
            </p>
            <div className="flex flex-col gap-0.5">
              {schools
                .filter((s) => s.id !== currentSchool.id)
                .map((school) => (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => {
                      setCurrentSchoolId(school.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-black/[.06] text-xs font-semibold text-foreground dark:bg-white/[.08]">
                      {school.logoInitials}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{school.name}</span>
                  </button>
                ))}
            </div>
          </>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
          <Building2 className="size-3.5" aria-hidden="true" />
          You have access to {schools.length} school{schools.length === 1 ? "" : "s"}.
        </div>
      </PopoverContent>
    </Popover>
  );
}
