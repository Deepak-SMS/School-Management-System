"use client";

import { useState } from "react";
import { FileText, Palette, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Modal, ModalTrigger, ModalContent, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "@/hooks/use-toast";

const componentInventory = [
  { name: "Button", status: "Ready", notes: "6 variants · 4 sizes · loading state" },
  { name: "Sidebar / Top Nav", status: "Ready", notes: "Collapsible, role-filtered, responsive" },
  { name: "Modal / Drawer", status: "Ready", notes: "Radix Dialog under the hood" },
  { name: "Toast", status: "Ready", notes: "4 variants, queued via useToast()" },
  { name: "Table", status: "Ready", notes: "Composable; TanStack Table wires in per-module" },
];

export default function Home() {
  const [stateDemo, setStateDemo] = useState<"loading" | "empty" | "error">("empty");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Design system preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase 1 — application shell and reusable components. This page exists to review that
          foundation; the real admin dashboard (KPIs, charts, quick actions) arrives in Phase 2.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Variants and sizes, shared across every future module.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="icon" variant="secondary" aria-label="Add">
            <Plus className="size-4" />
          </Button>
          <Button isLoading>Saving…</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges &amp; alerts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="success">Paid</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Overdue</Badge>
            <Badge variant="info">Info</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <Alert variant="info" title="Heads up">This is an informational message.</Alert>
            <Alert variant="success" title="Saved">Changes were saved successfully.</Alert>
            <Alert variant="warning" title="Review needed">Some records need your attention.</Alert>
            <Alert variant="danger" title="Action failed">Something went wrong — please retry.</Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form controls</CardTitle>
          <CardDescription>Wire these with react-hook-form + zod as each module ships.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Student name" required description="As it appears on official documents.">
            {(field) => <Input {...field} placeholder="e.g. Ananya Sharma" />}
          </FormField>
          <FormField label="Class" required error="Please select a class.">
            {(field) => (
              <Select>
                <SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]}>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Class 6</SelectItem>
                  <SelectItem value="7">Class 7</SelectItem>
                  <SelectItem value="8">Class 8</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox defaultChecked /> Send admission confirmation email
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch defaultChecked /> Enable parent portal access
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overlays</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Modal>
            <ModalTrigger asChild>
              <Button variant="secondary">Open modal</Button>
            </ModalTrigger>
            <ModalContent title="Add fee discount" description="This is a sample modal, not a real form yet.">
              <p className="text-sm text-muted-foreground">
                Modal content area — future modules render real forms here.
              </p>
              <ModalFooter className="-mx-5 -mb-4 mt-4">
                <Button variant="secondary">Cancel</Button>
                <Button>Save</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" /> Delete record
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete this record?"
            description="This action can't be undone."
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={() => {
              setConfirmOpen(false);
              toast({ title: "Record deleted", variant: "success" });
            }}
          />

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary">Open drawer</Button>
            </DrawerTrigger>
            <DrawerContent side="right" hideTitle={false} title="Filters">
              <div className="p-4 text-sm text-muted-foreground">
                Side drawers reuse this component for filters, quick views, and record details.
              </div>
            </DrawerContent>
          </Drawer>

          <Button
            variant="secondary"
            onClick={() => toast({ title: "Announcement sent", description: "Delivered to 3 classes.", variant: "success" })}
          >
            Trigger toast
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabs</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-sm text-muted-foreground">
              Tabs will structure detail pages like a student or teacher profile.
            </TabsContent>
            <TabsContent value="attendance" className="text-sm text-muted-foreground">
              Attendance history renders here in Phase 7.
            </TabsContent>
            <TabsContent value="fees" className="text-sm text-muted-foreground">
              Fee ledger renders here in Phase 9.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
          <CardDescription>Phase 1 component inventory — not application data.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table wrapperClassName="rounded-none border-none">
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {componentInventory.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="success">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loading / empty / error states</CardTitle>
          <CardDescription>Every data view in later phases must render all three.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button size="sm" variant={stateDemo === "loading" ? "primary" : "secondary"} onClick={() => setStateDemo("loading")}>
            Loading
          </Button>
          <Button size="sm" variant={stateDemo === "empty" ? "primary" : "secondary"} onClick={() => setStateDemo("empty")}>
            Empty
          </Button>
          <Button size="sm" variant={stateDemo === "error" ? "primary" : "secondary"} onClick={() => setStateDemo("error")}>
            Error
          </Button>
        </CardContent>
        <CardFooter className="justify-start p-0">
          <div className="w-full">
            {stateDemo === "loading" && <LoadingState label="Loading records…" />}
            {stateDemo === "empty" && (
              <EmptyState
                icon={FileText}
                title="No records yet"
                description="Once this module ships, matching records will show up here."
                action={<Button size="sm"><Plus className="size-4" /> Add record</Button>}
              />
            )}
            {stateDemo === "error" && <ErrorState onRetry={() => toast({ title: "Retried", variant: "default" })} />}
          </div>
        </CardFooter>
      </Card>

      <div className="flex items-center gap-2 pb-4 text-xs text-muted-foreground">
        <Palette className="size-3.5" />
        Original visual identity — palette, layout, and components are purpose-built, not copied from any reference product.
      </div>
    </div>
  );
}
