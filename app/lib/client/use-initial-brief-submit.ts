import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Dispatch, SetStateAction } from "react";
import type { ProgressState } from "./session-progress";

type InitialSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "submitted" }
  | { status: "error"; message: string };

type SubmitBriefResponse = { error?: string } | null;

export function useInitialBriefSubmit({
  initialBrief,
  sessionId,
  setProgress,
}: {
  initialBrief: string | null;
  sessionId: string;
  setProgress: Dispatch<SetStateAction<ProgressState | null>>;
}) {
  const fetcher = useFetcher<SubmitBriefResponse>();
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

    fetcher.submit(
      { type: "submit_brief", raw_input: initialBrief },
      {
        action: `/api/sessions/${sessionId}/events`,
        encType: "application/json",
        method: "post",
      },
    );
  }, [fetcher, initialBrief, sessionId, setProgress]);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (initialSubmitState.status !== "submitting") return;

    if (fetcher.data?.error) {
      setInitialSubmitState({ status: "error", message: fetcher.data.error });
      return;
    }

    setInitialSubmitState({ status: "submitted" });
  }, [fetcher.data, fetcher.state, initialSubmitState.status]);

  return initialSubmitState;
}
