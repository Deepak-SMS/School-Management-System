"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, IdCard, ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { CardPreviewModal } from "@/features/id-cards/card-preview-modal";
import type { ApiError } from "@/services/studentService";

interface Person {
  id: string;
  personType: "student" | "teacher" | "staff";
  name: string;
  reference: string;
  detail: string;
  photoUrl?: string | null;
  card: { id: string; status: string; cardNumber?: string | null } | null;
}

const TYPE_LABELS: Record<string, string> = {
  all: "Everyone",
  student: "Students",
  teacher: "Teachers",
  staff: "Other staff",
};

const PAGE_SIZE = 25;

/**
 * The list a dashboard figure drills into — every person a card can be issued
 * to, and whether they already have one. Each row opens that person's actual
 * card, which is what makes the numbers on the dashboard actionable rather than
 * decorative.
 */
export function CardPeopleList({
  initialType = "all",
  initialCardStatus = "all",
  onBack,
}: {
  initialType?: string;
  initialCardStatus?: string;
  onBack: () => void;
}) {
  const [type, setType] = useState(initialType);
  const [cardStatus, setCardStatus] = useState(initialCardStatus);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<{ data: Person[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Person | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      const query = new URLSearchParams({
        type,
        cardStatus,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(search ? { q: search } : {}),
      });

      fetch(`/api/id-cards/people?${query}`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw body;
          return body;
        })
        .then((body) => {
          if (cancelled) return;
          setResult({ data: body.data, total: body.total });
          setError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          setError((e as ApiError)?.error ?? "Couldn't load people.");
          setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [type, cardStatus, search, page, reloadKey]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to overview
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search name, admission or employee ID…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <Select
          value={type}
          onValueChange={(v) => {
            setPage(1);
            setType(v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={cardStatus}
          onValueChange={(v) => {
            setPage(1);
            setCardStatus(v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any card status</SelectItem>
            <SelectItem value="pending">Card pending</SelectItem>
            <SelectItem value="generated">Card generated</SelectItem>
          </SelectContent>
        </Select>

        {result && (
          <span className="text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "person" : "people"}
          </span>
        )}
      </div>

      {loading && <TableSkeleton rows={8} columns={5} />}
      {!loading && error && <ErrorState description={error} onRetry={reload} />}

      {!loading && !error && result?.data.length === 0 && (
        <EmptyState
          icon={IdCard}
          title="Nobody matches"
          description="Try a different search or filter. Students and employees appear here as soon as they're added."
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((person) => (
                  <TableRow key={`${person.personType}-${person.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={person.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          size="sm"
                        />
                        <span className="font-medium">{person.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{person.reference}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{TYPE_LABELS[person.personType] ?? person.personType}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{person.detail || "—"}</TableCell>
                    <TableCell>
                      {person.card ? (
                        <Badge variant={person.card.status === "active" ? "success" : "neutral"}>
                          {person.card.status}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewing(person)}>
                        <Eye className="size-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {viewing && (
        <CardPreviewModal
          personType={viewing.personType}
          personId={viewing.id}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
