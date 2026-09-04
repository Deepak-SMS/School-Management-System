"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Upload, FileDown, Link2 } from "lucide-react";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { StudentImportModal } from "@/features/students/student-import-modal";
import { RegistrationFormModal } from "@/features/students/registration-form-modal";
import { toast } from "@/hooks/use-toast";

/**
 * The four ways a student record enters the system:
 *   1. Add one by hand
 *   2. Import a list from a spreadsheet
 *   3. Download the template that import expects
 *   4. Share a form for parents to fill in themselves
 *
 * Each is permission-gated — a role that can't import never sees the button, and
 * the route refuses it regardless.
 */
export function StudentToolbar({ onImported }: { onImported?: () => void }) {
  const can = useCan();
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  async function downloadTemplate() {
    try {
      const response = await fetch("/api/students/import/template");
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't download the template.");
      }

      // Streamed as a file rather than built client-side, so the template always
      // matches what the importer accepts.
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student-import-template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Template downloaded", description: "Fill it in, then use Import students.", variant: "success" });
    } catch (error) {
      toast({ title: (error as Error).message, variant: "danger" });
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {can("students", "import") && (
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import students
          </Button>
        )}

        {can("students", "import") && (
          <Button variant="secondary" onClick={downloadTemplate}>
            <FileDown className="size-4" /> Download template
          </Button>
        )}

        {can("studentRegistrations", "create") && (
          <Button variant="secondary" onClick={() => setFormOpen(true)}>
            <Link2 className="size-4" /> Parent form
          </Button>
        )}

        {can("students", "create") && (
          <Button asChild>
            <Link href="/students/new">
              <Plus className="size-4" /> Add student
            </Link>
          </Button>
        )}
      </div>

      <StudentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          onImported?.();
        }}
      />

      <RegistrationFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  );
}
