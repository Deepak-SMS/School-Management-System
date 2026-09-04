"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, Loader2, Upload, Send, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/providers/user-provider";
import { EMAIL_RECIPIENT_TYPES, type EmailRecipientType } from "@/lib/email-campaigns/recipient-types";
import { personalizeMessage, personalizeHtml } from "@/lib/communication/personalize";
import { EMAIL_SAMPLE_VALUES } from "@/lib/email-campaigns/variables";
import { VariablePicker } from "@/features/email/variable-picker";
import { RecipientImportWizard } from "@/features/email/recipient-import-wizard";
import { emailTemplateService, type EmailTemplateRecord } from "@/services/emailTemplateService";
import {
  emailCampaignService,
  type EmailCampaignRecord,
  type EmailCampaignValidateResult,
  type EmailAudiencePreview,
} from "@/services/emailCampaignService";
import { studentService } from "@/services/studentService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { StudentRecord } from "@/types/student";
import type { RecipientImportValidRow } from "@/lib/email-campaigns/recipient-import";

type Step = "details" | "recipients" | "compose" | "preview" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "recipients", label: "Recipients" },
  { id: "compose", label: "Compose" },
  { id: "preview", label: "Preview" },
  { id: "review", label: "Review & Send" },
];

export function CampaignWizard() {
  const [step, setStep] = useState<Step>("details");
  const router = useRouter();
  const { toast } = useToast();
  const user = useCurrentUser();
  const isAccountant = user.role === "accountant";

  // Details step
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");

  // Recipients step
  const [recipientType, setRecipientType] = useState<EmailRecipientType>(isAccountant ? "fee_defaulters" : "all_students");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [minPendingAmount, setMinPendingAmount] = useState(0);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentRecord[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [importedRows, setImportedRows] = useState<RecipientImportValidRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<EmailAudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Compose step
  const [bodyHtml, setBodyHtml] = useState("");

  // Preview / Review / Send
  const [campaign, setCampaign] = useState<EmailCampaignRecord | null>(null);
  const [validation, setValidation] = useState<EmailCampaignValidateResult | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);

  const meta = EMAIL_RECIPIENT_TYPES.find((t) => t.value === recipientType)!;

  useEffect(() => {
    emailTemplateService.list().then((r) => setTemplates(r.data)).catch(() => undefined);
    classService.list({ pageSize: 200 }).then((r) => setClasses(r.data)).catch(() => undefined);
    sectionService.list({ pageSize: 500 }).then((r) => setSections(r.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (recipientType !== "selected_students" || !studentQuery.trim()) { setStudentResults([]); return; }
    const timeout = setTimeout(() => {
      studentService.list({ q: studentQuery, pageSize: 20, status: "active" }).then((r) => setStudentResults(r.data)).catch(() => undefined);
    }, 300);
    return () => clearTimeout(timeout);
  }, [recipientType, studentQuery]);

  // Live "who will actually receive this" preview — debounced.
  useEffect(() => {
    if (step !== "recipients") return;
    if (recipientType === "classes" && classIds.length === 0) { setAudiencePreview(null); return; }
    if (recipientType === "sections" && sectionIds.length === 0) { setAudiencePreview(null); return; }
    if (recipientType === "selected_students" && studentIds.length === 0) { setAudiencePreview(null); return; }
    if (recipientType === "imported_list") { setAudiencePreview(null); return; }

    setPreviewLoading(true);
    const timeout = setTimeout(() => {
      emailCampaignService
        .previewAudience({
          recipientType,
          classIds: meta.needsClasses ? classIds : undefined,
          sectionIds: meta.needsSections ? sectionIds : undefined,
          studentIds: meta.needsStudentIds ? studentIds : undefined,
          minPendingAmount: meta.needsMinPending ? minPendingAmount : undefined,
        })
        .then(setAudiencePreview)
        .catch(() => setAudiencePreview(null))
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [step, recipientType, classIds, sectionIds, studentIds, minPendingAmount, meta]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (t) {
      setSubject(t.subject);
      setBodyHtml(t.bodyHtml);
    }
  }

  function insertVariable(token: string) {
    document.execCommand("insertText", false, `{{${token}}}`);
  }

  const subjectPreview = useMemo(() => personalizeMessage(subject, EMAIL_SAMPLE_VALUES), [subject]);
  const bodyPreview = useMemo(() => personalizeHtml(bodyHtml, EMAIL_SAMPLE_VALUES), [bodyHtml]);

  const visibleSections = classIds.length > 0 ? sections.filter((s) => classIds.includes(s.class.id)) : sections;

  async function handleCreateCampaign() {
    setBusy(true);
    try {
      const created = await emailCampaignService.create({
        name,
        templateId: templateId || undefined,
        subject,
        bodyHtml,
        recipientType,
        classIds: meta.needsClasses ? classIds : undefined,
        sectionIds: meta.needsSections ? sectionIds : undefined,
        studentIds: meta.needsStudentIds ? studentIds : undefined,
        minPendingAmount: meta.needsMinPending ? minPendingAmount : undefined,
        importedRows: recipientType === "imported_list" ? importedRows : undefined,
      });
      setCampaign(created);
      setStep("preview");
      const v = await emailCampaignService.validate(created.id);
      setValidation(v);
    } catch (err) {
      toast({ title: "Couldn't create campaign", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTest() {
    if (!campaign || !testEmail.trim()) return;
    setBusy(true);
    try {
      await emailCampaignService.sendTest(campaign.id, testEmail.trim());
      toast({ title: "Test email sent", description: testEmail, variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't send test email", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleStartNow() {
    if (!campaign) return;
    setBusy(true);
    try {
      await emailCampaignService.start(campaign.id);
      toast({ title: "Campaign sending", description: "Emails are being sent in the background.", variant: "success" });
      router.push(`/communication/email/campaigns/${campaign.id}`);
    } catch (err) {
      toast({ title: "Couldn't send campaign", description: (err as { error?: string }).error, variant: "danger" });
      setBusy(false);
    }
  }

  async function handleSchedule() {
    if (!campaign || !scheduleAt) return;
    setBusy(true);
    try {
      await emailCampaignService.schedule(campaign.id, new Date(scheduleAt).toISOString());
      toast({ title: "Campaign scheduled", description: new Date(scheduleAt).toLocaleString(), variant: "success" });
      router.push(`/communication/email/campaigns/${campaign.id}`);
    } catch (err) {
      toast({ title: "Couldn't schedule campaign", description: (err as { error?: string }).error, variant: "danger" });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const currentIndex = STEPS.findIndex((x) => x.id === step);
          const done = i < currentIndex;
          const active = s.id === step;
          return (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium " +
                  (done ? "border-primary-600 bg-primary-600 text-white" : active ? "border-primary-600 text-primary-700" : "border-border text-muted-foreground")
                }
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span className={"text-sm " + (active ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
              {i < STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-border" />}
            </div>
          );
        })}
      </div>

      {step === "details" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Campaign name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. September Fee Reminder" />
              </div>
              <div className="space-y-1.5">
                <Label>Start from a template (optional)</Label>
                <Select value={templateId} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Compose from scratch" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} placeholder="e.g. Fee reminder for {{student.name}}" />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep("recipients")} disabled={!name.trim() || !subject.trim()}>Next: Recipients</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "recipients" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label>Who should receive this?</Label>
              <Select value={recipientType} onValueChange={(v) => setRecipientType(v as EmailRecipientType)} disabled={isAccountant}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isAccountant ? EMAIL_RECIPIENT_TYPES.filter((t) => t.value === "fee_defaulters") : EMAIL_RECIPIENT_TYPES).map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>

            {meta.needsClasses && (
              <div className="space-y-1.5">
                <Label>Classes {recipientType === "fee_defaulters" ? "(optional — narrows the audience)" : ""}</Label>
                <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto rounded-md border border-border p-3">
                  {classes.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={classIds.includes(c.id)}
                        onCheckedChange={(checked) => setClassIds((prev) => (checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {meta.needsSections && (
              <div className="space-y-1.5">
                <Label>Sections {recipientType === "fee_defaulters" ? "(optional — narrows the audience)" : ""}</Label>
                <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto rounded-md border border-border p-3">
                  {visibleSections.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={sectionIds.includes(s.id)}
                        onCheckedChange={(checked) => setSectionIds((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))}
                      />
                      {s.class.name}-{s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {meta.needsMinPending && (
              <div className="max-w-xs space-y-1.5">
                <Label>Minimum pending amount</Label>
                <Input type="number" min={0} value={minPendingAmount} onChange={(e) => setMinPendingAmount(Number(e.target.value))} />
              </div>
            )}

            {meta.needsStudentIds && (
              <div className="space-y-1.5">
                <Label>Search students ({studentIds.length} selected)</Label>
                <Input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search by name or admission number…" />
                {studentResults.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
                    {studentResults.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background">
                        <Checkbox
                          checked={studentIds.includes(s.id)}
                          onCheckedChange={(checked) => setStudentIds((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))}
                        />
                        {s.firstName} {s.lastName} <span className="text-muted-foreground">({s.admissionNumber})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {recipientType === "imported_list" && (
              <div className="space-y-2">
                <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" /> {importedRows.length > 0 ? `Re-import (${importedRows.length} ready)` : "Import from Excel"}
                </Button>
                {importedRows.length > 0 && <p className="text-sm text-muted-foreground">{importedRows.length} recipients ready from your file.</p>}
              </div>
            )}

            {recipientType !== "imported_list" && (
              <div className="space-y-2">
                <Label>Recipients preview</Label>
                {previewLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading recipients…</p>
                ) : !audiencePreview ? (
                  <p className="text-sm text-muted-foreground">Choose an audience above to see who will receive this.</p>
                ) : audiencePreview.total === 0 ? (
                  <p className="text-sm text-muted-foreground">No recipients match yet.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">{audiencePreview.total} recipients</Badge>
                      {audiencePreview.missingEmailCount > 0 && <Badge variant="warning">{audiencePreview.missingEmailCount} missing an email</Badge>}
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Parent</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Pending fees</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {audiencePreview.sample.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell>{r.studentName ?? "—"}</TableCell>
                              <TableCell>{[r.className, r.sectionName].filter(Boolean).join("-") || "—"}</TableCell>
                              <TableCell>{r.guardianName}</TableCell>
                              <TableCell>{r.email ?? <span className="text-danger-600">No email</span>}</TableCell>
                              <TableCell>{r.pendingFees ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {audiencePreview.truncated && (
                      <p className="text-xs text-muted-foreground">Showing the first {audiencePreview.sample.length} of {audiencePreview.total}.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep("details")}>Back</Button>
              <Button
                onClick={() => setStep("compose")}
                disabled={
                  (meta.needsClasses && recipientType === "classes" && classIds.length === 0) ||
                  (meta.needsSections && recipientType === "sections" && sectionIds.length === 0) ||
                  (meta.needsStudentIds && studentIds.length === 0) ||
                  (recipientType === "imported_list" && importedRows.length === 0)
                }
              >
                Next: Compose
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "compose" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="max-h-96 overflow-y-auto rounded-md border border-border p-3">
                <VariablePicker onInsert={insertVariable} />
              </div>
              <div className="space-y-3">
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Dear {{parent.name}}, ..." className="min-h-64" />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep("recipients")}>Back</Button>
              <Button onClick={handleCreateCampaign} disabled={!bodyHtml.trim()} isLoading={busy}>Next: Preview</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && campaign && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {!validation ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking recipients…</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">Total recipients: {validation.totalRecipients}</Badge>
                  <Badge variant="success">Will send: {validation.sendableCount}</Badge>
                  {validation.invalidEmailCount > 0 && <Badge variant="danger">Invalid/missing emails: {validation.invalidEmailCount}</Badge>}
                  {validation.missingVariableCount > 0 && <Badge variant="warning">Missing variables: {validation.missingVariableCount}</Badge>}
                </div>

                {validation.missingVariableCount > 0 && (
                  <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
                    <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" /> {validation.missingVariableCount} recipients are missing data your message needs and will be skipped, not sent with a blank/broken message.</p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5">
                      {validation.missingVariableSample.slice(0, 5).map((s, i) => (
                        <li key={i}>{s.recipientName}: missing {s.missingVariables.join(", ")}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-md bg-background p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium text-foreground">{subjectPreview.text}</p>
                  <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground">Message (sample data)</p>
                  <div
                    className="rounded-md bg-surface p-3 text-sm text-foreground [&_a]:text-primary-600 [&_a]:underline [&_h2]:text-base [&_h2]:font-semibold [&_hr]:my-2 [&_hr]:border-border [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                    dangerouslySetInnerHTML={{ __html: bodyPreview.text }}
                  />
                </div>

                <div className="space-y-1.5 border-t border-border pt-4">
                  <Label>Send a test email to yourself first</Label>
                  <div className="flex gap-2">
                    <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="max-w-xs" />
                    <Button type="button" variant="secondary" onClick={handleSendTest} disabled={!testEmail.trim()} isLoading={busy}>Send Test</Button>
                  </div>
                </div>

                {validation.sendableCount === 0 && (
                  <p className="text-sm text-danger-600">No recipients can be sent to. Go back and adjust the audience or message.</p>
                )}

                <div className="flex justify-between">
                  <Button variant="secondary" onClick={() => setStep("compose")}>Back</Button>
                  <Button onClick={() => setStep("review")} disabled={validation.sendableCount === 0}>Next: Review &amp; Send</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "review" && campaign && validation && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-base font-semibold text-foreground">Confirm Campaign</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Campaign</dt><dd className="font-medium text-foreground">{campaign.name}</dd></div>
              <div><dt className="text-muted-foreground">Will send to</dt><dd className="font-medium text-foreground">{validation.sendableCount} recipients</dd></div>
            </dl>

            <div className="space-y-1.5">
              <Label>Schedule for later (optional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="max-w-xs" />
                <Button type="button" variant="secondary" onClick={handleSchedule} disabled={!scheduleAt} isLoading={busy}>
                  <Clock className="size-4" /> Schedule
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">Sending starts immediately and cannot target these exact recipients again — the campaign can still be cancelled once it starts.</p>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep("preview")} disabled={busy}>Back</Button>
              <Button onClick={handleStartNow} isLoading={busy}>
                <Send className="size-4" /> Send Campaign Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <RecipientImportWizard open={importOpen} onOpenChange={setImportOpen} onImported={setImportedRows} />
    </div>
  );
}
