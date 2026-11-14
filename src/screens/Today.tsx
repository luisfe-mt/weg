import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getInstalledAt } from "@/lib/db";

type DbStatus = { state: "checking" } | { state: "ready" } | { state: "error"; message: string };

/**
 * Scaffold of the Today screen (north star, section 5). The session planner and
 * the hours ledger are not built yet, so nothing here shows learner data.
 */
export function Today() {
  const [db, setDb] = useState<DbStatus>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    getInstalledAt().then(
      () => {
        if (!cancelled) setDb({ state: "ready" });
      },
      (e: unknown) => {
        if (!cancelled) setDb({ state: "error", message: String(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">Weg</h1>
        <p className="text-muted-foreground">German, A1.1 to C1.2. One step at a time.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>No session yet: the session planner is not built.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Progress value={0} aria-label="Hours done in this sublevel" />
          <Button size="lg" disabled>
            Start
          </Button>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground" role="status">
        {db.state === "checking" && "Checking local database…"}
        {db.state === "ready" && "Local database ready."}
        {db.state === "error" && `Local database failed: ${db.message}`}
      </p>
    </main>
  );
}
