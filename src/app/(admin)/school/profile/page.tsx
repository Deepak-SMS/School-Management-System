"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Upload, Trash2, ImageOff } from "lucide-react";
import { schoolProfileService } from "@/services/schoolProfileService";
import type { SchoolProfileRecord, SchoolProfileInput } from "@/types/schoolProfile";
import { SCHOOL_TYPE_LABELS, INSTITUTION_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/constants/school";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";
import { SchoolProfileForm } from "@/features/school-profile/school-profile-form";
import { SchoolDocumentsCard } from "@/features/school-profile/school-documents-card";

const COMPLETION_FIELDS: (keyof SchoolProfileRecord)[] = [
  "name",
  "schoolCode",
  "registrationNumber",
  "affiliationBoard",
  "schoolType",
  "institutionType",
  "establishedYear",
  "email",
  "phone",
  "website",
  "address",
  "city",
  "country",
  "principalName",
  "administratorName",
  "timeZone",
  "currency",
  "dateFormat",
  "logoUrl",
  "bannerUrl",
  "udisePlusCode",
  "udiseSchoolId",
  "recognitionNumber",
];

export default function SchoolProfilePage() {
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  function load() {
    schoolProfileService.get().then(setProfile).catch(() => setError(true));
  }

  useEffect(load, []);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!profile) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  const filledCount = COMPLETION_FIELDS.filter((f) => Boolean(profile[f])).length;
  const completion = Math.round((filledCount / COMPLETION_FIELDS.length) * 100);

  async function handleLogoFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Logo must be a JPG, PNG, or WebP image.", variant: "danger" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo must be smaller than 2 MB.", variant: "danger" });
      return;
    }
    setUploadingLogo(true);
    try {
      const updated = await schoolProfileService.uploadLogo(file);
      setProfile(updated);
      toast({ title: "Logo updated", variant: "success" });
    } catch {
      toast({ title: "Couldn't upload logo", variant: "danger" });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    setUploadingLogo(true);
    try {
      const updated = await schoolProfileService.removeLogo();
      setProfile(updated);
      toast({ title: "Logo removed", variant: "success" });
    } catch {
      toast({ title: "Couldn't remove logo", variant: "danger" });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleBannerFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Banner must be a JPG, PNG, or WebP image.", variant: "danger" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Banner must be smaller than 5 MB.", variant: "danger" });
      return;
    }
    setUploadingBanner(true);
    try {
      const updated = await schoolProfileService.uploadBanner(file);
      setProfile(updated);
      toast({ title: "Banner updated", variant: "success" });
    } catch {
      toast({ title: "Couldn't upload banner", variant: "danger" });
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleRemoveBanner() {
    setUploadingBanner(true);
    try {
      const updated = await schoolProfileService.removeBanner();
      setProfile(updated);
      toast({ title: "Banner removed", variant: "success" });
    } catch {
      toast({ title: "Couldn't remove banner", variant: "danger" });
    } finally {
      setUploadingBanner(false);
    }
  }

  if (editing) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <div>
          <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "School Profile" }]} />
          <h1 className="mt-2 text-xl font-semibold text-foreground">Edit School Profile</h1>
        </div>
        <SchoolProfileForm
          profile={profile}
          onCancel={() => setEditing(false)}
          onSubmit={async (input: SchoolProfileInput) => {
            const updated = await schoolProfileService.update(input);
            setProfile(updated);
            toast({ title: "School profile updated", variant: "success" });
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "School Profile" }]} />
          <h1 className="mt-2 text-xl font-semibold text-foreground">School Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Core information about your school, used across ID cards and reports.</p>
        </div>
        <Button onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> Edit Profile
        </Button>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Profile completion</span>
              <span className="text-muted-foreground">{completion}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School logo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div
            className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed ${dragOver ? "border-primary-500 bg-primary-50" : "border-border"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleLogoFile(file);
            }}
          >
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt="School logo" className="size-full object-contain" />
            ) : (
              <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 2 MB. Drag and drop or choose a file.</p>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="secondary" size="sm" isLoading={uploadingLogo} onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" /> {profile.logoUrl ? "Replace" : "Upload"}
              </Button>
              {profile.logoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo} disabled={uploadingLogo}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School banner</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            className={`flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed sm:h-40 ${bannerDragOver ? "border-primary-500 bg-primary-50" : "border-border"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setBannerDragOver(true);
            }}
            onDragLeave={() => setBannerDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setBannerDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleBannerFile(file);
            }}
          >
            {profile.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.bannerUrl} alt="School banner" className="size-full object-cover" />
            ) : (
              <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 5 MB. Recommended 1600×400. Drag and drop or choose a file.</p>
            <div className="flex shrink-0 gap-2">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerFile(file);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="secondary" size="sm" isLoading={uploadingBanner} onClick={() => bannerInputRef.current?.click()}>
                <Upload className="size-4" /> {profile.bannerUrl ? "Replace" : "Upload"}
              </Button>
              {profile.bannerUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemoveBanner} disabled={uploadingBanner}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="School name" value={profile.name} />
          <Field label="School code" value={profile.schoolCode} />
          <Field label="Registration number" value={profile.registrationNumber} />
          <Field label="Affiliation / Board" value={profile.affiliationBoard} />
          <Field label="School type" value={profile.schoolType ? SCHOOL_TYPE_LABELS[profile.schoolType as keyof typeof SCHOOL_TYPE_LABELS] : undefined} />
          <Field
            label="Institution type"
            value={profile.institutionType ? INSTITUTION_TYPE_LABELS[profile.institutionType as keyof typeof INSTITUTION_TYPE_LABELS] : undefined}
          />
          <Field label="Established year" value={profile.establishedYear?.toString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Government &amp; Board IDs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="UDISE+ Code" value={profile.udisePlusCode} />
          <Field label="UDISE School ID" value={profile.udiseSchoolId} />
          <Field label="Recognition Number" value={profile.recognitionNumber} />
          <Field label="Board Affiliation Number" value={profile.boardAffiliationNumber} />
          <Field label="School Code" value={profile.schoolCode} />
          <Field label="RTE Recognition / Registration No." value={profile.rteRegistrationNumber} />
          <Field label="NOC Number" value={profile.nocNumber} />
        </CardContent>
      </Card>

      {/* The certificates evidencing the numbers above. */}
      <SchoolDocumentsCard profile={profile} />

      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Official email" value={profile.email} />
          <Field label="Phone number" value={profile.phone} />
          <Field label="Alternate phone" value={profile.alternatePhone} />
          <Field label="Website" value={profile.website} />
          <Field label="Address" value={profile.address} className="sm:col-span-2" />
          <Field label="City" value={profile.city} />
          <Field label="State" value={profile.state} />
          <Field label="Country" value={profile.country} />
          <Field label="PIN / ZIP code" value={profile.pinCode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administration information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Principal / Head name" value={profile.principalName} />
          <Field label="Administrator name" value={profile.administratorName} />
          <Field label="Administrative email" value={profile.administrativeEmail} />
          <Field label="Administrative phone" value={profile.administrativePhone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Time zone" value={profile.timeZone} />
          <Field label="Currency" value={profile.currency} />
          <Field label="Date format" value={profile.dateFormat} />
          <Field label="Language" value={profile.language} />
          <Field label="Week start day" value={profile.weekStartDay ? WEEKDAY_LABELS[profile.weekStartDay as keyof typeof WEEKDAY_LABELS] : undefined} />
          <Field
            label="Working days"
            value={
              profile.workingDaysJson
                ? (JSON.parse(profile.workingDaysJson) as string[]).map((d) => WEEKDAY_LABELS[d as keyof typeof WEEKDAY_LABELS]).join(", ")
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social media</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Facebook" value={profile.facebookUrl} />
          <Field label="Instagram" value={profile.instagramUrl} />
          <Field label="YouTube" value={profile.youtubeUrl} />
          <Field label="LinkedIn" value={profile.linkedinUrl} />
          <Field label="Twitter / X" value={profile.twitterUrl} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
