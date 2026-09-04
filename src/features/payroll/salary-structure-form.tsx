"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/loading-state";
import { SALARY_COMPONENT_TYPE_LABELS } from "@/lib/constants/payroll";
import { ACTIVE_STATUSES } from "@/lib/constants/school";
import type { SalaryComponentRecord } from "@/types/payroll";
import type { SalaryStructureInput } from "@/lib/validation/salary-structure";
import type { ApiError } from "@/services/studentService";

interface DraftItem {
  componentId: string;
  componentName: string;
  componentType: string;
  calculationType: string;
  amount?: string;
  percentage?: string;
}

interface SalaryStructureFormProps {
  defaultValues?: {
    name: string;
    description?: string | null;
    status: string;
    items: { componentId: string; componentName: string; componentType: string; calculationType: string; amount?: number | null; percentage?: number | null }[];
  };
  onSubmit: (input: SalaryStructureInput) => Promise<void>;
  submitLabel?: string;
}

export function SalaryStructureForm({ defaultValues, onSubmit, submitLabel = "Create structure" }: SalaryStructureFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [status, setStatus] = useState(defaultValues?.status ?? "active");
  const [components, setComponents] = useState<SalaryComponentRecord[] | null>(null);
  const [items, setItems] = useState<DraftItem[]>(
    defaultValues?.items.map((i) => ({
      componentId: i.componentId,
      componentName: i.componentName,
      componentType: i.componentType,
      calculationType: i.calculationType,
      amount: i.amount != null ? String(i.amount) : undefined,
      percentage: i.percentage != null ? String(i.percentage) : undefined,
    })) ?? [],
  );
  const [pickerComponentId, setPickerComponentId] = useState("");
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/salary-components")
      .then((r) => r.json())
      .then((body) => setComponents((body.data as SalaryComponentRecord[])?.filter((c) => c.status === "active") ?? []))
      .catch(() => setComponents([]));
  }, []);

  function addItem() {
    if (!pickerComponentId) return;
    const component = components?.find((c) => c.id === pickerComponentId);
    if (!component) return;
    if (items.some((i) => i.componentId === component.id)) return;
    setItems((prev) => [
      ...prev,
      { componentId: component.id, componentName: component.name, componentType: component.componentType, calculationType: component.calculationType },
    ]);
    setItemsError(null);
    setPickerComponentId("");
  }

  function removeItem(componentId: string) {
    setItems((prev) => prev.filter((i) => i.componentId !== componentId));
  }

  function updateItemOverride(componentId: string, field: "amount" | "percentage", value: string) {
    setItems((prev) => prev.map((i) => (i.componentId === componentId ? { ...i, [field]: value } : i)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!name.trim()) {
      setServerError("Name is required.");
      return;
    }
    if (items.length === 0) {
      setItemsError("Add at least one component.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        status: status as SalaryStructureInput["status"],
        items: items.map((i) => ({
          componentId: i.componentId,
          amount: i.amount ? Number(i.amount) : undefined,
          percentage: i.percentage ? Number(i.percentage) : undefined,
        })),
      });
    } catch (error) {
      setServerError((error as ApiError)?.error ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!components) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  const availableComponents = components.filter((c) => !items.some((i) => i.componentId === c.id));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save structure">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Structure details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Teacher Grade I" />}
          </FormField>
          <FormField label="Status">
            {(field) => (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Description">
              {(field) => <Textarea {...field} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />}
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>Pick each component this structure pays. Leave the override blank to use the component&apos;s own default amount/percentage.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Component</span>
              <Select value={pickerComponentId || "none"} onValueChange={(v) => setPickerComponentId(v === "none" ? "" : v)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select component" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select component</SelectItem>
                  {availableComponents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({SALARY_COMPONENT_TYPE_LABELS[c.componentType as keyof typeof SALARY_COMPONENT_TYPE_LABELS]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addItem} disabled={!pickerComponentId}>
              Add
            </Button>
          </div>
          {itemsError && <p className="text-sm text-danger-600">{itemsError}</p>}

          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div key={item.componentId} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                  <Badge variant={item.componentType === "earning" ? "success" : "warning"} className="shrink-0">
                    {SALARY_COMPONENT_TYPE_LABELS[item.componentType as keyof typeof SALARY_COMPONENT_TYPE_LABELS]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.componentName}</span>
                  {item.calculationType === "fixed" && (
                    <Input
                      className="w-32"
                      type="number"
                      min={0}
                      placeholder="Amount"
                      value={item.amount ?? ""}
                      onChange={(e) => updateItemOverride(item.componentId, "amount", e.target.value)}
                    />
                  )}
                  {item.calculationType === "percentage_of_basic" && (
                    <Input
                      className="w-32"
                      type="number"
                      min={0}
                      max={100}
                      placeholder="% of Basic"
                      value={item.percentage ?? ""}
                      onChange={(e) => updateItemOverride(item.componentId, "percentage", e.target.value)}
                    />
                  )}
                  <button type="button" onClick={() => removeItem(item.componentId)} aria-label="Remove" className="text-muted-foreground hover:text-danger-600">
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
