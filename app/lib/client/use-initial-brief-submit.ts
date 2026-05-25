import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ProgressState } from "./session-progress";

type InitialSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "submitted" }
  | { status: "error"; message: string };

export function useInitialBriefSubmit({
  initialBrief,
  sessionId,
  setProgress,
}: {
  initialBrief: string | null;
  sessionId: string;
  setProgress: Dispatch<SetStateAction<ProgressState | null>>;
}) {
  const [initialSubmitState, setInitialSubmitState] =
    useState<InitialSubmitState>({ status: "idle" });
  const submittedInitialBriefRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialBrief) return;

    const cleanUrl = `${location.pathname}${location.hash}`;
    window.history.replaceState(null, "", cleanUrl);

    const initialSubmitKey = `${sessionId}:${initialBrief}`;
    if (submittedInitialBriefRef.current === initialSubmitKey) return;

    submittedInitialBriefRef.current = initialSubmitKey;
    setInitialSubmitState({ status: "submitting" });
    setProgress({
      node: "ingest_brief",
      phase: "refining_brief",
      status: "started",
    });

    void fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "submit_brief", raw_input: initialBrief }),
    }).then(
      async (response) => {
        if (!response.ok) {
          let message = "Could not start the brief. Please try again.";
          const body = (await response.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          if (body) {
            if (typeof body.error === "string") message = body.error;
          }
          setInitialSubmitState({ status: "error", message });
          return;
        }
        setInitialSubmitState({ status: "submitted" });
      },
      () => {
        setInitialSubmitState({
          status: "error",
          message: "Could not start the brief. Please try again.",
        });
      },
    );
  }, [initialBrief, sessionId, setProgress]);

  return initialSubmitState;
}
