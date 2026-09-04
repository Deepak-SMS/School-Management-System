"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { WHATSAPP_AUDIENCE_MODES, type WhatsAppAudienceMode } from "@/lib/whatsapp/audience-modes";
import { personalizeMessage } from "@/lib/communication/personalize";
import { WHATSAPP_SAMPLE_VALUES } from "@/lib/whatsapp/variables";
import { VariablePicker } from "@/features/whatsapp/variable-picker";
import { whatsappTemplateService, type WhatsAppTemplateRecord } from "@/services/whatsappTemplateService";
import {
  whatsappCampaignService,
  type WhatsAppCampaignRecord,
  type WhatsAppCampaignValidateResult,
  type WhatsAppAudiencePreview,
} from "@/services/whatsappCampaignService";
import { whatsappContactService, type WhatsAppContactRecord } from "@/services/whatsappContactService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";

type Step = "message" | "audience" | "review" | "send";
const STEPS: { id: Step; label: string }[] = [
  { id: "message", label: "Message" },
  { id: "audience", label: "Audience" },
  { id: "review", label: "Review" },
  { id: "send", label: "Send" },
];

export function CampaignWizard() {
  const [step, setStep] = useState<Step>("message");
  const router = useRouter();
  const { toast } = useToast();

  // Message step
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplateRecord[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [messageBody, setMessageBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Audience step
  const [audienceMode, setAudienceMode] = useState<WhatsAppAudienceMode>("class_parents");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [thresholdPct, setThresholdPct] = useState(75);
  const [tag, setTag] = useState("");
  const [contacts, setContacts] = useState<WhatsAppContactRecord[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [audiencePreview, setAudiencePreview] = useState<WhatsAppAudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Review / send
  const [campaign, setCampaign] = useState<WhatsAppCampaignRecord | null>(null);
  const [validation, setValidation] = useState<WhatsAppCampaignValidateResult | null>(null);
  const [busy, setBusy] = useState(false);

  const mode = WHATSAPP_AUDIENCE_MODES.find((m) => m.value === audienceMode)!;

  useEffect(() => {
    whatsappTemplateService.list().then((r) => setTemplates(r.data)).catch(() => undefined);
    classService.list({ pageSize: 200 }).then((r) => setClasses(r.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!classId) { setSections([]); return; }
    sectionService.list({ classId, pageSize: 200 }).then((r) => setSections(r.data)).catch(() => undefined);
  }, [classId]);

  useEffect(() => {
    if (audienceMode !== "manual_contacts") return;
    whatsappContactService.list({ pageSize: 200 }).then((r) => setContacts(r.data)).catch(() => undefined);
  }, [audienceMode]);

  // Live "who will actually receive this" preview — debounced so picking a
  // class doesn't fire a request per keystroke/selection change.
  useEffect(() => {
    if (step !== "audience") return;
    if (audienceMode === "class_parents" && !classId) { setAudiencePreview(null); return; }
    if (mode.needsTag && !tag.trim()) { setAudiencePreview(null); return; }
    if (mode.needsContactIds && contactIds.length === 0) { setAudiencePreview(null); return; }

    setPreviewLoading(true);
    const timeout = setTimeout(() => {
      whatsappCampaignService
        .previewAudience({
          audienceMode,
          classId: mode.needsClassSection ? classId || undefined : undefined,
          sectionId: mode.needsClassSection ? sectionId || undefined : undefined,
          thresholdPct: mode.needsThreshold ? thresholdPct : undefined,
          tag: mode.needsTag ? tag || undefined : undefined,
          contactIds: mode.needsContactIds ? contactIds : undefined,
        })
        .then(setAudiencePreview)
        .catch(() => setAudiencePreview(null))
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [step, audienceMode, classId, sectionId, thresholdPct, tag, contactIds, mode]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (t) setMessageBody(t.bodyText);
  }

  function insertVariable(token: string) {
    const el = textareaRef.current;
    const insertion = `{{${token}}}`;
    if (!el) {
      setMessageBody((prev) => prev + insertion);
      return;
    }
    const start = el.selectionStart ?? messageBody.length;
    const end = el.selectionEnd ?? messageBody.length;
    setMessageBody(messageBody.slice(0, start) + insertion + messageBody.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + insertion.length;
    });
  }

  const preview = useMemo(() => personalizeMessage(messageBody, WHATSAPP_SAMPLE_VALUES), [messageBody]);

  async function handleCreateDraft() {
    setBusy(true);
    try {
      const created = await whatsappCampaignService.create({
        name,
        templateId: templateId || undefined,
        messageBody,
        audienceMode,
        classId: mode.needsClassSection ? classId || undefined : undefined,
        sectionId: mode.needsClassSection ? sectionId || undefined : undefined,
        thresholdPct: mode.needsThreshold ? thresholdPct : undefined,
        tag: mode.needsTag ? tag || undefined : undefined,
        contactIds: mode.needsContactIds ? contactIds : undefined,
      });
      setCampaign(created);
      setStep("review");
      const v = await whatsappCampaignService.validate(created.id);
      setValidation(v);
    } catch (err) {
      toast({ title: "Couldn't create campaign", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!campaign) return;
    setBusy(true);
    try {
      await whatsappCampaignService.send(campaign.id);
      toast({ title: "Campaign sending", description: "Messages are being sent in the background.", variant: "success" });
      router.push(`/communication/whatsapp/campaigns/${campaign.id}`);
    } catch (err) {
      toast({ title: "Couldn't send campaign", description: (err as { error?: string }).error, variant: "danger" });
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

      {step === "message" && (
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

            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="max-h-72 overflow-y-auto rounded-md border border-border p-3">
                <VariablePicker onInsert={insertVariable} />
              </div>
              <div className="space-y-3">
                <Textarea ref={textareaRef} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} rows={8} maxLength={4096} placeholder="Hello {{parent_name}}, ..." />
                <p className="text-right text-xs text-muted-foreground">{messageBody.length} / 4096</p>
                <div className="rounded-md bg-background p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Live preview (sample data)</p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{preview.text || "Your message will appear here…"}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep("audience")} disabled={!name.trim() || !messageBody.trim()}>Next: Audience</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "audience" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label>Who should receive this?</Label>
              <Select value={audienceMode} onValueChange={(v) => setAudienceMode(v as WhatsAppAudienceMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WHATSAPP_AUDIENCE_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{mode.description}</p>
            </div>

            {mode.needsClassSection && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Class {audienceMode === "class_parents" ? "" : "(optional — narrows the audience)"}</Label>
                  <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
                    <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Section (optional)</Label>
                  <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
                    <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                    <SelectContent>
                      {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {mode.needsThreshold && (
              <div className="max-w-xs space-y-1.5">
                <Label>Attendance threshold (%)</Label>
                <Input type="number" min={1} max={100} value={thresholdPct} onChange={(e) => setThresholdPct(Number(e.target.value))} />
              </div>
            )}

            {mode.needsTag && (
              <div className="max-w-xs space-y-1.5">
                <Label>Tag</Label>
                <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. alumni" />
              </div>
            )}

            {mode.needsContactIds && (
              <div className="space-y-1.5">
                <Label>Select contacts ({contactIds.length} selected)</Label>
                <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
                  {contacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background">
                      <Checkbox
                        checked={contactIds.includes(c.id)}
                        onCheckedChange={(checked) => setContactIds((prev) => (checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))}
                      />
                      {c.name} <span className="text-muted-foreground">({c.phoneE164})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
                    {audiencePreview.classTeacher && <Badge variant="neutral">Class teacher: {audiencePreview.classTeacher}</Badge>}
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Parent</TableHead>
                          <TableHead>Phone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audiencePreview.sample.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.studentName ?? "—"}</TableCell>
                            <TableCell>{[r.className, r.sectionName].filter(Boolean).join("-") || "—"}</TableCell>
                            <TableCell>{r.guardianName}</TableCell>
                            <TableCell>{r.phone ?? <span className="text-danger-600">No number</span>}</TableCell>
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

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep("message")}>Back</Button>
              <Button onClick={handleCreateDraft} isLoading={busy} disabled={mode.needsContactIds && contactIds.length === 0}>
                Next: Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && campaign && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {!validation ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking recipients…</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">Total recipients: {validation.totalRecipients}</Badge>
                  <Badge variant="success">Will send: {validation.sendableCount}</Badge>
                  {validation.invalidPhoneCount > 0 && <Badge variant="danger">Invalid numbers: {validation.invalidPhoneCount}</Badge>}
                  {validation.optedOutCount > 0 && <Badge variant="warning">Opted out: {validation.optedOutCount}</Badge>}
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

                {validation.sendableCount === 0 && (
                  <p className="text-sm text-danger-600">No recipients can be sent to. Go back and adjust the audience or message.</p>
                )}

                <div className="rounded-md bg-background p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Message</p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{campaign.messageBody}</p>
                </div>

                <div className="flex justify-between">
                  <Button variant="secondary" onClick={() => setStep("audience")}>Back</Button>
                  <Button onClick={() => setStep("send")} disabled={validation.sendableCount === 0}>Next: Confirm &amp; Send</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "send" && campaign && validation && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-base font-semibold text-foreground">Confirm Campaign</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Campaign</dt><dd className="font-medium text-foreground">{campaign.name}</dd></div>
              <div><dt className="text-muted-foreground">Will send to</dt><dd className="font-medium text-foreground">{validation.sendableCount} recipients</dd></div>
            </dl>
            <p className="text-sm text-muted-foreground">Sending starts immediately and cannot target these exact recipients again — the campaign can still be cancelled once it starts.</p>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep("review")} disabled={busy}>Back</Button>
              <Button onClick={handleSend} isLoading={busy}>Send Campaign</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
