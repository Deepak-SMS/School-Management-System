"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { School, Campus, AcademicYear } from "@/types/tenant";
import { tenantService } from "@/services/tenantService";
import { useCurrentUser } from "@/providers/user-provider";

interface TenantContextValue {
  schools: School[];
  currentSchool: School | undefined;
  currentCampus: Campus | undefined;
  currentAcademicYear: AcademicYear | undefined;
  setCurrentSchoolId: (id: string) => void;
  setCurrentCampusId: (id: string) => void;
  setCurrentAcademicYearId: (id: string) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);
const STORAGE_KEY = "sms.tenant";

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string>("");
  const [currentCampusId, setCurrentCampusId] = useState<string>("");
  const [currentAcademicYearId, setCurrentAcademicYearId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    tenantService.listSchoolsForUser(user.id).then((result) => {
      if (cancelled) return;
      setSchools(result);
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const saved = stored ? (JSON.parse(stored) as { schoolId?: string; campusId?: string; yearId?: string }) : {};
      const school = result.find((s) => s.id === saved.schoolId) ?? result[0];
      if (school) {
        setCurrentSchoolId(school.id);
        const campus = school.campuses.find((c) => c.id === saved.campusId) ?? school.campuses[0];
        const year = school.academicYears.find((y) => y.id === saved.yearId) ?? school.academicYears.find((y) => y.isCurrent) ?? school.academicYears[0];
        setCurrentCampusId(campus?.id ?? "");
        setCurrentAcademicYearId(year?.id ?? "");
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const currentSchool = useMemo(() => schools.find((s) => s.id === currentSchoolId), [schools, currentSchoolId]);
  const currentCampus = useMemo(() => currentSchool?.campuses.find((c) => c.id === currentCampusId), [currentSchool, currentCampusId]);
  const currentAcademicYear = useMemo(
    () => currentSchool?.academicYears.find((y) => y.id === currentAcademicYearId),
    [currentSchool, currentAcademicYearId],
  );

  useEffect(() => {
    if (!currentSchoolId) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schoolId: currentSchoolId, campusId: currentCampusId, yearId: currentAcademicYearId }),
    );
  }, [currentSchoolId, currentCampusId, currentAcademicYearId]);

  function handleSetSchool(id: string) {
    setCurrentSchoolId(id);
    const school = schools.find((s) => s.id === id);
    setCurrentCampusId(school?.campuses[0]?.id ?? "");
    const year = school?.academicYears.find((y) => y.isCurrent) ?? school?.academicYears[0];
    setCurrentAcademicYearId(year?.id ?? "");
  }

  return (
    <TenantContext.Provider
      value={{
        schools,
        currentSchool,
        currentCampus,
        currentAcademicYear,
        setCurrentSchoolId: handleSetSchool,
        setCurrentCampusId,
        setCurrentAcademicYearId,
        isLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
