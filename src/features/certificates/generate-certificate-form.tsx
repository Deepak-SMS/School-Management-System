"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, FileDown, ShieldCheck, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

interface CertificateType {
  id: string;
  name: string;
  category: "student" | "staff";
  numberingPrefix: string;
}

interface TemplateOption {
  id: string;
  name: string;
  isActive: boolean;
  certificateTypeId: string;
}

interface StudentResult {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  class?: { name: string } | null;
  section?: { name: string } | null;
}

interface StaffResult {
  id: string;
  fullName: string;
  employeeId: string;
  designation?: { name: string } | null;
}

interface GeneratedCertificate {
  id: string;
  certificateNumber: string;
  pdfUrl: string | null;
  verification?: { code: string } | null;
}

export function GenerateCertificateForm() {
  const searchParams = useSearchParams();
  const presetCategory = searchParams.get("category");
  const [category, setCategory] = useState<"student" | "staff">(presetCategory === "staff" ? "staff" : "student");
  const [types, setTypes] = useState<CertificateType[] | null>(null);
  // Preselected from a "Generate" link on the Certificate Types table (?certificateTypeId=...) —
  // the certificate-types fetch below still runs to populate the dropdown and validate the id.
  const [certificateTypeId, setCertificateTypeId] = useState(searchParams.get("certificateTypeId") ?? "");
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<(StudentResult | StaffResult)[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/certificate-types?category=${category}`)
      .then((r) => r.json())
      .then((body) => setTypes(body.data ?? []))
      .catch(() => setTypes([]));
  }, [category]);

  function changeCategory(next: "student" | "staff") {
    setCategory(next);
    setCertificateTypeId("");
    setTemplates(null);
    setTemplateId("");
    setSelectedId(null);
    setSelectedLabel(null);
    setSearch("");
    setResults([]);
    setResult(null);
  }

  function changeCertificateType(next: string) {
    setCertificateTypeId(next);
    setTemplates(null);
    setTemplateId("");
  }

  useEffect(() => {
    if (!certificateTypeId) return;
    fetch(`/api/certificate-templates?certificateTypeId=${certificateTypeId}`)
      .then((r) => r.json())
      .then((body) => {
        const rows: TemplateOption[] = (body.data ?? []).filter((t: TemplateOption) => t.isActive);
        setTemplates(rows);
        setTemplateId(rows[0]?.id ?? "");
      })
      .catch(() => setTemplates([]));
  }, [certificateTypeId]);

  function changeSearch(value: string) {
    setSearch(value);
    if (value.trim().length < 2) setResults([]);
  }

  useEffect(() => {
    if (search.trim().length < 2) return;
    const timeout = setTimeout(() => {
      const endpoint = category === "student" ? `/api/students?q=${encodeURIComponent(search)}&pageSize=8` : `/api/staff?q=${encodeURIComponent(search)}&pageSize=8`;
      fetch(endpoint)
        .then((r) => r.json())
        .then((body) => setResults(body.data ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, category]);

  function selectPerson(person: StudentResult | StaffResult) {
    setSelectedId(person.id);
    setSelectedLabel(
      category === "student"
        ? `${(person as StudentResult).firstName} ${(person as StudentResult).lastName} · ${(person as StudentResult).admissionNumber}`
        : `${(person as StaffResult).fullName} · ${(person as StaffResult).employeeId}`,
    );
    setResults([]);
    setSearch("");
  }

  async function generate() {
    if (!certificateTypeId || !templateId || !selectedId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateTypeId,
          templateId,
          ...(category === "student" ? { studentId: selectedId } : { staffId: selectedId }),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw body;
      setResult(body);
      toast({ title: "Certificate generated", description: body.certificateNumber, variant: "success" });
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't generate the certificate.");
    } finally {
      setGenerating(false);
    }
  }

  const selectedType = types?.find((t) => t.id === certificateTypeId);

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Label>Who is this for?</Label>
        <Select value={category} onValueChange={(v) => changeCategory(v as "student" | "staff")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Certificate type</Label>
        <Select value={certificateTypeId} onValueChange={changeCertificateType} disabled={!types || types.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={types === null ? "Loading…" : types.length === 0 ? "No certificate types yet" : "Choose a certificate type"} />
          </SelectTrigger>
          <SelectContent>
            {types?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.numberingPrefix})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {certificateTypeId && (
        <div className="flex flex-col gap-1">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId} disabled={!templates || templates.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={templates === null ? "Loading…" : templates.length === 0 ? "No templates for this type yet — create one in the Designer" : "Choose a template"} />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {certificateTypeId && templateId && (
        <div className="flex flex-col gap-1">
          <Label>{category === "student" ? "Student" : "Staff member"}</Label>
          {selectedLabel ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-raised px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{selectedLabel}</span>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setSelectedLabel(null); }}>
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                leadingIcon={<Search />}
                placeholder={category === "student" ? "Search by name or admission number…" : "Search by name or employee ID…"}
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-raised"
                      onClick={() => selectPerson(p)}
                    >
                      <span className="font-medium text-foreground">{category === "student" ? `${(p as StudentResult).firstName} ${(p as StudentResult).lastName}` : (p as StaffResult).fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {category === "student"
                          ? `${(p as StudentResult).admissionNumber} · ${(p as StudentResult).class?.name ?? ""} ${(p as StudentResult).section?.name ?? ""}`
                          : `${(p as StaffResult).employeeId} · ${(p as StaffResult).designation?.name ?? ""}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <Button onClick={generate} disabled={!certificateTypeId || !templateId || !selectedId} isLoading={generating}>
        <ScrollText className="size-4" /> Generate certificate
      </Button>

      {selectedType?.numberingPrefix && !result && (
        <p className="text-xs text-muted-foreground">Will be numbered {selectedType.numberingPrefix}/{new Date().getFullYear()}/00001 (next available in sequence).</p>
      )}

      {result && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent-500/30 bg-accent-50 p-4 dark:bg-accent-500/10">
          <div className="flex items-center gap-2">
            <Badge variant="success">{result.certificateNumber}</Badge>
            <span className="text-sm text-foreground">Certificate generated</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.pdfUrl && (
              <a href={result.pdfUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  <FileDown className="size-4" /> Download PDF
                </Button>
              </a>
            )}
            {result.verification?.code && (
              <a href={`/verify-certificate/${result.verification.code}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm">
                  <ShieldCheck className="size-4" /> View verification page
                </Button>
              </a>
            )}
          </div>
        </div>
      )}

      {types?.length === 0 && (
        <EmptyState icon={ScrollText} title="No certificate types for this category" description="Add one under Certificate Types before generating." className="py-6" />
      )}
    </div>
  );
}
