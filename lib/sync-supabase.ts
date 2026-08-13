import type { ProgressSnapshot } from "./sync";
import { isSyncConfigured, supabase } from "./supabase";

/**
 * Supabase transport for {@link syncWithTransport}. Every user has exactly one
 * row in the `progress` table (PK user_id referencing auth.users); row-level
 * security restricts reads/writes to the signed-in user, so the client can talk
 * to the table directly — no API routes or service-role key needed.
 *
 * The blob is client-controlled and unvalidated (a tampered client could inflate
 * XP or mastery) — acceptable for a single-player learning app with no
 * leaderboard, but worth revisiting if competitive features ever land.
 *
 * Table setup (run once in the Supabase SQL editor):
 *   create table public.progress (
 *     user_id uuid primary key references auth.users(id) on delete cascade,
 *     blob jsonb not null default '{}'::jsonb,
 *     updated_at timestamptz not null default now()
 *   );
 *   alter table public.progress enable row level security;
 *   create policy "own progress read"   on public.progress for select using (auth.uid() = user_id);
 *   create policy "own progress insert" on public.progress for insert with check (auth.uid() = user_id);
 *   create policy "own progress update" on public.progress for update using (auth.uid() = user_id);
 */

type ProgressBlob = Omit<ProgressSnapshot, "updatedAt">;
type ProgressRow = { user_id: string; blob: ProgressBlob; updated_at: string };

async function currentUserId(): Promise<string> {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in to sync progress across devices.");
  return data.user.id;
}

export async function fetchRemoteProgress(): Promise<ProgressSnapshot | null> {
  if (!isSyncConfigured || !supabase) return null;
  await currentUserId();
  const { data, error } = await supabase.from("progress").select("blob, updated_at").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ProgressRow;
  const parsed = Date.parse(row.updated_at);
  return { ...row.blob, updatedAt: Number.isFinite(parsed) ? parsed : 0 };
}

export async function pushRemoteProgress(snapshot: ProgressSnapshot): Promise<void> {
  if (!isSyncConfigured || !supabase) return;
  const userId = await currentUserId();
  const { updatedAt, ...blob } = snapshot;
  const { error } = await supabase
    .from("progress")
    .upsert(
      { user_id: userId, blob, updated_at: new Date(updatedAt).toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
}
