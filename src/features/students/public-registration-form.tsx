"use client";

import { useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { GENDERS, BLOOD_GROUPS } from "@/lib/constants/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

/**
 * The form a parent fills in. Public — it deliberately uses no admin hooks,
 * providers or services, because it renders outside the signed-in shell.
 *
 * Validation here is for the parent's benefit; the server validates the same
 * payload again and is the real gate.
 */

const RELATIONSHIPS = ["father", "mother", "guardian", "grandparent", "other"] as const;
const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "app", label: "App notification" },
] as const;

interface GuardianDraft {
  relationship: string;
  fullName: string;
  mobile: string;
  alternateMobile: string;
  email: string;
  occupation: string;
  organization: string;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
}

function emptyGuardian(relationship: string, isPrimary = false): GuardianDraft {
  return {
    relationship,
    fullName: "",
    mobile: "",
    alternateMobile: "",
    email: "",
    occupation: "",
    organization: "",
    isPrimary,
    isEmergencyContact: isPrimary,
    isAuthorizedPickup: true,
  };
}

export function PublicRegistrationForm({ token }: { token: string }) {
  const [student, setStudent] = useState({
    firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "", bloodGroup: "",
    nationality: "", motherTongue: "", previousSchool: "", appliedForClass: "",
  });
  const [address, setAddress] = useState({
    address: "", addressLine2: "", city: "", state: "", country: "India", pinCode: "",
  });
  const [sameAsCurrent, setSameAsCurrent] = useState(true);
  const [permanent, setPermanent] = useState({
    permanentAddress: "", permanentCity: "", permanentState: "", permanentCountry: "India", permanentPinCode: "",
  });
  const [contact, setContact] = useState({
    primaryMobile: "", secondaryMobile: "", studentEmail: "", parentEmail: "", whatsappNumber: "",
  });
  const [channels, setChannels] = useState<string[]>(["whatsapp", "sms"]);
  const [emergency, setEmergency] = useState({
    emergencyName: "", emergencyRelation: "", emergencyContact: "", emergencyAltPhone: "", emergencyAddress: "",
  });
  const [guardians, setGuardians] = useState<GuardianDraft[]>([
    emptyGuardian("father", true),
    emptyGuardian("mother"),
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reference, setReference] = useState<string | null>(null);

  function setGuardian(index: number, patch: Partial<GuardianDraft>) {
    setGuardians((list) => list.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  /** Only one guardian can be the main contact, so selecting one clears the rest. */
  function makePrimary(index: number) {
    setGuardians((list) => list.map((g, i) => ({ ...g, isPrimary: i === index })));
  }

  function toggleChannel(value: string) {
    setChannels((list) => (list.includes(value) ? list.filter((c) => c !== value) : [...list, value]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});

    // Guardians with no name are treated as "not provided" rather than as errors —
    // a single parent shouldn't have to delete the second card to submit.
    const filledGuardians = guardians.filter((g) => g.fullName.trim() !== "");
    if (filledGuardians.length === 0) {
      setError("Add at least one parent or guardian.");
      setBusy(false);
      return;
    }
    if (!filledGuardians.some((g) => g.isPrimary)) filledGuardians[0].isPrimary = true;

    try {
      const response = await fetch(`/api/public/register/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...student,
          ...address,
          sameAsCurrent,
          ...(sameAsCurrent ? {} : permanent),
          ...contact,
          commChannels: channels,
          ...emergency,
          guardians: filledGuardians.map((g) => ({
            relationship: g.relationship,
            fullName: g.fullName,
            mobile: g.mobile || undefined,
            alternateMobile: g.alternateMobile || undefined,
            email: g.email || undefined,
            occupation: g.occupation || undefined,
            organization: g.organization || undefined,
            isPrimary: g.isPrimary,
            isEmergencyContact: g.isEmergencyContact,
            isAuthorizedPickup: g.isAuthorizedPickup,
          })),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        setFieldErrors((json?.fieldErrors as Record<string, string[]>) ?? {});
        throw new Error(json?.error ?? "Couldn't submit the form.");
      }

      setReference(json.reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-12 text-accent-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Details submitted</h2>
          <p className="text-sm text-muted-foreground">
            The school has received your child&apos;s details and will get in touch.
          </p>
          <p className="text-sm">
            Your reference: <strong className="font-mono">{reference}</strong>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="danger" title="Couldn't submit">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Student details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" required error={fieldErrors.firstName?.[0]}>
            {(f) => <Input {...f} value={student.firstName} onChange={(e) => setStudent({ ...student, firstName: e.target.value })} />}
          </FormField>
          <FormField label="Middle name">
            {(f) => <Input {...f} value={student.middleName} onChange={(e) => setStudent({ ...student, middleName: e.target.value })} />}
          </FormField>
          <FormField label="Last name" required error={fieldErrors.lastName?.[0]}>
            {(f) => <Input {...f} value={student.lastName} onChange={(e) => setStudent({ ...student, lastName: e.target.value })} />}
          </FormField>
          <FormField label="Date of birth" error={fieldErrors.dateOfBirth?.[0]}>
            {(f) => <Input {...f} type="date" value={student.dateOfBirth} onChange={(e) => setStudent({ ...student, dateOfBirth: e.target.value })} />}
          </FormField>
          <FormField label="Gender">
            {(f) => (
              <Select value={student.gender} onValueChange={(v) => setStudent({ ...student, gender: v })}>
                <SelectTrigger id={f.id}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Blood group">
            {(f) => (
              <Select value={student.bloodGroup} onValueChange={(v) => setStudent({ ...student, bloodGroup: v })}>
                <SelectTrigger id={f.id}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Nationality">
            {(f) => <Input {...f} value={student.nationality} onChange={(e) => setStudent({ ...student, nationality: e.target.value })} />}
          </FormField>
          <FormField label="Mother tongue">
            {(f) => <Input {...f} value={student.motherTongue} onChange={(e) => setStudent({ ...student, motherTongue: e.target.value })} />}
          </FormField>
          <FormField label="Applying for class" description="The school confirms the final class">
            {(f) => <Input {...f} value={student.appliedForClass} onChange={(e) => setStudent({ ...student, appliedForClass: e.target.value })} placeholder="Class 6" />}
          </FormField>
          <FormField label="Previous school">
            {(f) => <Input {...f} value={student.previousSchool} onChange={(e) => setStudent({ ...student, previousSchool: e.target.value })} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parents &amp; guardians</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Fill in whoever applies. Leave a section blank if it doesn&apos;t.
          </p>

          {guardians.map((g, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Select value={g.relationship} onValueChange={(v) => setGuardian(index, { relationship: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {guardians.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setGuardians((l) => l.filter((_, i) => i !== index))}>
                    <Trash2 className="size-4" /> Remove
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Full name">
                  {(f) => <Input {...f} value={g.fullName} onChange={(e) => setGuardian(index, { fullName: e.target.value })} />}
                </FormField>
                <FormField label="Mobile">
                  {(f) => <Input {...f} value={g.mobile} onChange={(e) => setGuardian(index, { mobile: e.target.value })} />}
                </FormField>
                <FormField label="Email">
                  {(f) => <Input {...f} type="email" value={g.email} onChange={(e) => setGuardian(index, { email: e.target.value })} />}
                </FormField>
                <FormField label="Occupation">
                  {(f) => <Input {...f} value={g.occupation} onChange={(e) => setGuardian(index, { occupation: e.target.value })} />}
                </FormField>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox checked={g.isPrimary} onCheckedChange={() => makePrimary(index)} />
                  Main contact
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={g.isEmergencyContact} onCheckedChange={(v) => setGuardian(index, { isEmergencyContact: Boolean(v) })} />
                  Emergency contact
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={g.isAuthorizedPickup} onCheckedChange={(v) => setGuardian(index, { isAuthorizedPickup: Boolean(v) })} />
                  Can collect the child
                </label>
              </div>
            </div>
          ))}

          {guardians.length < 4 && (
            <Button variant="secondary" size="sm" onClick={() => setGuardians((l) => [...l, emptyGuardian("guardian")])}>
              <Plus className="size-4" /> Add another guardian
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Address line 1" className="sm:col-span-2">
            {(f) => <Textarea {...f} rows={2} value={address.address} onChange={(e) => setAddress({ ...address, address: e.target.value })} />}
          </FormField>
          <FormField label="Address line 2" className="sm:col-span-2">
            {(f) => <Input {...f} value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} />}
          </FormField>
          <FormField label="City">
            {(f) => <Input {...f} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />}
          </FormField>
          <FormField label="State">
            {(f) => <Input {...f} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />}
          </FormField>
          <FormField label="Country">
            {(f) => <Input {...f} value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} />}
          </FormField>
          <FormField label="PIN code">
            {(f) => <Input {...f} value={address.pinCode} onChange={(e) => setAddress({ ...address, pinCode: e.target.value })} />}
          </FormField>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={sameAsCurrent} onCheckedChange={(v) => setSameAsCurrent(Boolean(v))} />
            Permanent address is the same as above
          </label>

          {!sameAsCurrent && (
            <>
              <FormField label="Permanent address" className="sm:col-span-2">
                {(f) => <Textarea {...f} rows={2} value={permanent.permanentAddress} onChange={(e) => setPermanent({ ...permanent, permanentAddress: e.target.value })} />}
              </FormField>
              <FormField label="City">
                {(f) => <Input {...f} value={permanent.permanentCity} onChange={(e) => setPermanent({ ...permanent, permanentCity: e.target.value })} />}
              </FormField>
              <FormField label="State">
                {(f) => <Input {...f} value={permanent.permanentState} onChange={(e) => setPermanent({ ...permanent, permanentState: e.target.value })} />}
              </FormField>
              <FormField label="Country">
                {(f) => <Input {...f} value={permanent.permanentCountry} onChange={(e) => setPermanent({ ...permanent, permanentCountry: e.target.value })} />}
              </FormField>
              <FormField label="PIN code">
                {(f) => <Input {...f} value={permanent.permanentPinCode} onChange={(e) => setPermanent({ ...permanent, permanentPinCode: e.target.value })} />}
              </FormField>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Primary mobile" error={fieldErrors.primaryMobile?.[0]}>
            {(f) => <Input {...f} value={contact.primaryMobile} onChange={(e) => setContact({ ...contact, primaryMobile: e.target.value })} />}
          </FormField>
          <FormField label="Alternate mobile">
            {(f) => <Input {...f} value={contact.secondaryMobile} onChange={(e) => setContact({ ...contact, secondaryMobile: e.target.value })} />}
          </FormField>
          <FormField label="WhatsApp number">
            {(f) => <Input {...f} value={contact.whatsappNumber} onChange={(e) => setContact({ ...contact, whatsappNumber: e.target.value })} />}
          </FormField>
          <FormField label="Parent email" error={fieldErrors.parentEmail?.[0]}>
            {(f) => <Input {...f} type="email" value={contact.parentEmail} onChange={(e) => setContact({ ...contact, parentEmail: e.target.value })} />}
          </FormField>
          <FormField label="Student email" className="sm:col-span-2">
            {(f) => <Input {...f} type="email" value={contact.studentEmail} onChange={(e) => setContact({ ...contact, studentEmail: e.target.value })} />}
          </FormField>

          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-foreground">How should the school contact you?</p>
            <div className="flex flex-wrap gap-4 text-sm">
              {CHANNELS.map((c) => (
                <label key={c.value} className="flex items-center gap-2">
                  <Checkbox checked={channels.includes(c.value)} onCheckedChange={() => toggleChannel(c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name">
            {(f) => <Input {...f} value={emergency.emergencyName} onChange={(e) => setEmergency({ ...emergency, emergencyName: e.target.value })} />}
          </FormField>
          <FormField label="Relationship">
            {(f) => <Input {...f} value={emergency.emergencyRelation} onChange={(e) => setEmergency({ ...emergency, emergencyRelation: e.target.value })} placeholder="Uncle" />}
          </FormField>
          <FormField label="Mobile">
            {(f) => <Input {...f} value={emergency.emergencyContact} onChange={(e) => setEmergency({ ...emergency, emergencyContact: e.target.value })} />}
          </FormField>
          <FormField label="Alternate number">
            {(f) => <Input {...f} value={emergency.emergencyAltPhone} onChange={(e) => setEmergency({ ...emergency, emergencyAltPhone: e.target.value })} />}
          </FormField>
          <FormField label="Address" className="sm:col-span-2">
            {(f) => <Textarea {...f} rows={2} value={emergency.emergencyAddress} onChange={(e) => setEmergency({ ...emergency, emergencyAddress: e.target.value })} />}
          </FormField>
        </CardContent>
      </Card>

      <Button size="lg" onClick={submit} isLoading={busy}>
        Submit details
      </Button>
    </div>
  );
}
