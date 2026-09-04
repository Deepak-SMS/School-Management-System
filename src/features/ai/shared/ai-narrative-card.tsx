import { Sparkles, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loading-state";

interface AiNarrativeCardProps {
  loading: boolean;
  narrative: string | null;
  narrativeError?: string;
}

/** The one place an LLM is allowed to talk about real numbers — always paired with the backend-computed stats it's describing, never shown alone. */
export function AiNarrativeCard({ loading, narrative, narrativeError }: AiNarrativeCardProps) {
  return (
    <Card className="border-primary-200 bg-primary-50/40 dark:border-primary-500/20 dark:bg-primary-500/5">
      <CardContent className="flex gap-3 py-4">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
          <Sparkles className="size-3.5" />
        </span>
        <div className="flex-1 space-y-1.5">
          {loading ? (
            <>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </>
          ) : narrativeError ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TriangleAlert className="size-3.5 shrink-0 text-warning-500" />
              {narrativeError}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-foreground">{narrative}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
