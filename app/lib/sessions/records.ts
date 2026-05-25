// Session record mutation helpers for previews and review decisions.
import { getDb } from "@db";
import type {
  ArtifactRecord,
  ClarificationRecord,
  PreviewRecord,
  ReviewRecord,
} from "@records";
import { SESSIONS, type Session, type SessionStage } from "./types";

/** Append a generated preview artifact and its preview record to the session. */
export async function appendPreviewArtifact(
  session_id: string,
  artifact: ArtifactRecord,
  preview: PreviewRecord,
  stage: SessionStage,
): Promise<void> {
  const db = await getDb();
  await db.collection<Session>(SESSIONS).updateOne(
    { session_id },
    {
      $set: { stage },
      $push: {
        "records.artifacts": artifact,
        "records.previews": preview,
      },
    },
  );
}

/** Append one review decision to the session trail. */
export async function appendReview(
  session_id: string,
  review: ReviewRecord,
): Promise<void> {
  const db = await getDb();
  await db.collection<Session>(SESSIONS).updateOne(
    { session_id },
    {
      $push: { "records.reviews": review },
    },
  );
}

export async function setReviewNotes(
  session_id: string,
  review_id: string,
  notes: string[],
): Promise<void> {
  const db = await getDb();
  await db.collection<Session>(SESSIONS).updateOne(
    { session_id, "records.reviews.review_id": review_id },
    {
      $set: { "records.reviews.$.notes": notes },
    },
  );
}

export async function appendClarification(
  session_id: string,
  clarification: ClarificationRecord,
): Promise<void> {
  const db = await getDb();
  await db.collection<Session>(SESSIONS).updateOne(
    { session_id },
    {
      $push: { "records.clarifications": clarification },
    },
  );
}
