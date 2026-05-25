import { useState } from "react";

export type CopyState = "idle" | "copied" | "error";

export function useCopyState() {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyText(text: string) {
    if (typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return { copyState, copyText };
}
