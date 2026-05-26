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
  shouldStartInitialBrief,
  sessionId,
  setProgress,
}: {
  shouldStartInitialBrief: boolean;
  sessionId: string;
  setProgress: Dispatch<SetStateAction<ProgressState | null>>;
}) {
  const fetcher = useFetcher<SubmitBriefResponse>();
  const [initialSubmitState, setInitialSubmitState] =
    useState<InitialSubmitState>({ status: "idle" });
  const submittedInitialBriefRef = useRef<string | null>(null);
  const fetcherStartedRef = useRef(false);

  useEffect(() => {
    if (!shouldStartInitialBrief) return;

    const cleanUrl = `${location.pathname}${location.hash}`;
    window.history.replaceState(null, "", cleanUrl);

    const initialSubmitKey = sessionId;
    if (submittedInitialBriefRef.current === initialSubmitKey) return;

    submittedInitialBriefRef.current = initialSubmitKey;
    fetcherStartedRef.current = false;
    setInitialSubmitState({ status: "submitting" });
    setProgress({
      node: "ingest_brief",
      phase: "refining_brief",
      status: "started",
    });

    fetcher.submit(
      { type: "submit_brief" },
      {
        action: `/api/sessions/${sessionId}/events`,
        encType: "application/json",
        method: "post",
      },
    );
  }, [fetcher, shouldStartInitialBrief, sessionId, setProgress]);

  useEffect(() => {
    if (fetcher.state !== "idle") {
      fetcherStartedRef.current = true;
      return;
    }
    if (initialSubmitState.status !== "submitting") return;
    if (!fetcherStartedRef.current) return;

    if (fetcher.data?.error) {
      setInitialSubmitState({ status: "error", message: fetcher.data.error });
      return;
    }

    setInitialSubmitState({ status: "submitted" });
  }, [fetcher.data, fetcher.state, initialSubmitState.status]);

  return initialSubmitState;
}
