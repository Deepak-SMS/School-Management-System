"use client";

import { useState } from "react";
import { Sparkles, RotateCcw, Copy, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { COMMUNICATION_TYPES, COMMUNICATION_TONES, COMMUNICATION_LANGUAGES, type CommunicationType, type CommunicationTone } from "@/lib/ai/communication/templates";
import type { AudienceMode } from "@/lib/ai/communication/audience-modes";
import { AudiencePicker } from "@/features/ai/communication/audience-picker";
import { aiCommunicationService, type GenerateCommunicationResult } from "@/services/aiCommunicationService";

export default function AiCommunicationAssistantPage() {
  const [type, setType] = useState<CommunicationType>("parent_message");
  const [tone, setTone] = useState<CommunicationTone>("polite");
  const [language, setLanguage] = useState<string>(COMMUNICATION_LANGUAGES[0]);
  const [context, setContext] = useState("");

  const [audienceMode, setAudienceMode] = useState<AudienceMode>("custom");
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [thresholdPct, setThresholdPct] = useState(75);

  const [draft, setDraft] = useState<GenerateCommunicationResult | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await aiCommunicationService.generate({ type, tone, language, context, audienceMode, classId, sectionId, thresholdPct });
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
    } catch (error) {
      toast({ title: "Couldn't generate a draft", description: (error as { error?: string })?.error ?? "Please try again.", variant: "danger" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSendConfirmed() {
    setConfirmSend(false);
    setSending(true);
    try {
      const result = await aiCommunicationService.send({ subject, body, audienceMode, classId, sectionId, thresholdPct });
      const parts = [`Posted to the school notification feed.`];
      if (result.emailConfigured) parts.push(`Emailed ${result.emailsSent} recipient${result.emailsSent === 1 ? "" : "s"}${result.emailsSkipped ? ` (${result.emailsSkipped} skipped — no address on file)` : ""}.`);
      else if (result.emailsSkipped > 0) parts.push(`Email isn't configured, so ${result.emailsSkipped} recipient${result.emailsSkipped === 1 ? "" : "s"} weren't emailed.`);
      toast({ title: "Sent", description: parts.join(" ") });
    } catch (error) {
      toast({ title: "Send failed", description: (error as { error?: string })?.error ?? "Please try again.", variant: "danger" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Communication Assistant</h1>
        <p className="mt-1 text-sm text-muted-foreground">Draft a message, review it, then send — nothing goes out without your confirmation.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CommunicationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as CommunicationTone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <AudiencePicker
            mode={audienceMode}
            onModeChange={setAudienceMode}
            classId={classId}
            sectionId={sectionId}
            onClassChange={setClassId}
            onSectionChange={setSectionId}
            thresholdPct={thresholdPct}
            onThresholdChange={setThresholdPct}
          />

          <div className="flex flex-col gap-1.5">
            <Label>Context</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="What should this message say? e.g. 'Remind them the annual sports day is next Friday, 9am at the main ground.'"
              rows={3}
            />
          </div>

          <Button onClick={handleGenerate} isLoading={generating} className="w-fit gap-1.5">
            <Sparkles className="size-4" /> Generate
          </Button>
        </CardContent>
      </Card>

      {draft && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Draft</CardTitle>
            <Badge variant={draft.audience.recipientCount > 0 ? "primary" : "neutral"}>{draft.audience.label}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="(no subject)" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
            </div>
            {draft.audience.missingEmailCount > 0 && (
              <p className="text-xs text-muted-foreground">{draft.audience.missingEmailCount} recipient(s) have no email on file and will only see this as an in-app notification.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerate} isLoading={generating} className="gap-1.5">
                <RotateCcw className="size-3.5" /> Regenerate
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" onClick={() => setConfirmSend(true)} isLoading={sending} className="ml-auto gap-1.5">
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send this communication?"
        description={
          draft && draft.audience.recipientCount > 0
            ? `This posts a school-wide notification and emails up to ${draft.audience.recipientCount} recipient(s) (${draft.audience.label}). This can't be undone.`
            : "This posts a school-wide notification. No specific recipient list was resolved for this audience, so no individual emails will be sent. This can't be undone."
        }
        confirmLabel="Send"
        onConfirm={handleSendConfirmed}
      />
    </div>
  );
}
