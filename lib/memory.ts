import Dexie from "dexie";
import { attemptCoreAutoUpdate } from "./coreAutomation";
import { resetWorkspaceCore } from "./workspaces";

type MemoryRow = {
  id?: number;
  workspaceId: number;
  content: string;
  embedding: number[] | null;
  createdAt: number;
  pinned?: boolean;
};

type MetaRow = {
  key: string;
  value: any;
};

class AnkorynDB extends Dexie {
  memories!: Dexie.Table<MemoryRow, number>;
  meta!: Dexie.Table<MetaRow, string>;

  constructor() {
    super("AnkorynDB");
    this.version(4).stores({
      memories: "++id, workspaceId, createdAt, pinned",
      meta: "key"
    });
  }
}

const db = new AnkorynDB();

// ---- Tunables ----
const MAX_MEMORIES_PER_WORKSPACE = 300;
const SUMMARY_UPDATE_EVERY = 6;
const SUMMARY_MAX_CHARS = 1200;
const SUMMARY_MIN_CHARS = 50;

// NEW: protection rules
const RECENT_MEMORY_PROTECTION = 20;

// ---- Keys ----
function summaryKey(workspaceId: number) {
  return `workspaceSummary:${workspaceId}`;
}
function turnCountKey(workspaceId: number) {
  return `turnCount:${workspaceId}`;
}

/* ============================
   STORE TURN
============================ */

export async function storeTurn(
  workspaceId: number,
  userText: string,
  assistantText: string
) {
  await storeMemory(workspaceId, userText);
  await storeMemory(workspaceId, assistantText);

  try {
    await attemptCoreAutoUpdate(workspaceId, userText);
  } catch (err) {
    console.warn("Core automation skipped:", err);
  }

  const turnCount = (await getMetaNumber(turnCountKey(workspaceId))) + 1;
  await setMeta(turnCountKey(workspaceId), turnCount);

  if (turnCount % SUMMARY_UPDATE_EVERY === 0) {
    try {
      const recent = await getRecentMemories(workspaceId, 10);
      const existingSummary = await getWorkspaceSummary(workspaceId);

      const nextSummary = await summarise(
        existingSummary,
        recent.join("\n")
      );

      if (nextSummary && nextSummary.length >= SUMMARY_MIN_CHARS) {
        await setWorkspaceSummary(workspaceId, nextSummary);
      }
    } catch (err) {
      console.warn("Summary update skipped:", err);
    }
  }

  await pruneOldMemoriesIfNeeded(workspaceId);
}

/* ============================
   SUMMARY
============================ */

export async function getWorkspaceSummary(
  workspaceId: number | null | undefined
): Promise<string> {
  if (!workspaceId) return "";

  const row = await db.meta.get(summaryKey(workspaceId));
  return (row?.value as string) || "";
}

async function setWorkspaceSummary(
  workspaceId: number,
  summary: string
) {
  const trimmed =
    summary.length > SUMMARY_MAX_CHARS
      ? summary.slice(0, SUMMARY_MAX_CHARS - 1) + "…"
      : summary;

  await setMeta(summaryKey(workspaceId), trimmed);
}

/* ============================
   MEMORY RETRIEVAL
============================ */

export async function getRelevantMemory(
  workspaceId: number,
  query: string
) {
  if (!workspaceId) return [];

  const summary = await getWorkspaceSummary(workspaceId);

  let k = 5;
  if (summary.length > 800) k = 3;
  if (summary.length > 1000) k = 2;

  let qEmb: number[] | null = null;

  try {
    qEmb = await embed(query);
  } catch {
    console.warn("Embedding failed, falling back to recency.");
  }

  const all = await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();

  if (all.length === 0) return [];

  /* PRIORITY: PINNED */

  const pinned = all
    .filter(m => m.pinned)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(m => m.content);

  /* SEMANTIC / RECENT */

  let semantic: string[] = [];

  if (!qEmb) {
    semantic = all
      .filter(m => !m.pinned)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, k)
      .map(m => m.content);
  } else {

    const now = Date.now();

const scored = all
  .filter(m => m.embedding && !m.pinned)
  .map(m => {

    const similarity = cosineSimilarity(qEmb!, m.embedding!);

    // recency boost (0 → 0.15)
    const ageHours = (now - m.createdAt) / (1000 * 60 * 60);
    const recencyBoost = Math.max(0, 0.15 - ageHours * 0.01);

    return {
      content: m.content,
      score: similarity + recencyBoost
    };
  });

    semantic = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.content);
  }

  return [...pinned, ...semantic];
}

/* ============================
   MEMORY INSPECTOR API
============================ */

export async function getWorkspaceMemories(workspaceId: number | null | undefined) {
  if (!workspaceId) return [];

  const rows = await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();

  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(m => ({
      id: m.id!,
      content: m.content,
      createdAt: m.createdAt,
      pinned: m.pinned ?? false
    }));
}

/* ============================
   MEMORY STORAGE
============================ */

async function storeMemory(
  workspaceId: number,
  content: string
) {

  /* AUTO PIN DETECTION */

  const lower = content.toLowerCase();

  const autoPin =
    lower.includes("my project") ||
    lower.includes("my product") ||
    lower.includes("called") ||
    lower.includes("pricing") ||
    lower.includes("price") ||
    lower.includes("target market") ||
    lower.includes("constraint") ||
    lower.includes("important") ||
    lower.includes("goal");

  try {
    const embedding = await embed(content);

    await db.memories.add({
      workspaceId,
      content,
      embedding,
      createdAt: Date.now(),
      pinned: autoPin
    });

  } catch {
    console.warn("Embedding failed. Saving without embedding.");

    await db.memories.add({
      workspaceId,
      content,
      embedding: null,
      createdAt: Date.now(),
      pinned: autoPin
    });
  }
}

/* ============================
   SMART PRUNING
============================ */

async function pruneOldMemoriesIfNeeded(workspaceId: number) {

  const all = await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .sortBy("createdAt");

  if (all.length <= MAX_MEMORIES_PER_WORKSPACE) return;

  const summary = await getWorkspaceSummary(workspaceId);

  const recentProtected = all.slice(-RECENT_MEMORY_PROTECTION);

  const protectedIds = new Set<number>();

  recentProtected.forEach(m => {
    if (m.id) protectedIds.add(m.id);
  });

  const candidates = all.filter(m => {

    if (!m.id) return false;

    if (m.pinned) return false;

    if (protectedIds.has(m.id)) return false;

    if (summary && summary.includes(m.content.slice(0, 40))) return false;

    return true;

  });

  const toDelete = all.length - MAX_MEMORIES_PER_WORKSPACE;

  const ids = candidates
    .slice(0, toDelete)
    .map(m => m.id!)
    .filter(Boolean);

  await db.memories.bulkDelete(ids);
}

async function getRecentMemories(
  workspaceId: number,
  n: number
) {
  const all = await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();

  const recent = all
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, n)
    .reverse();

  return recent.map((m) => m.content);
}

/* ============================
   GOVERNANCE API
============================ */

export async function pinMemory(memoryId: number, pinned: boolean) {
  await db.memories.update(memoryId, { pinned });
}

export async function deleteMemory(memoryId: number) {
  await db.memories.delete(memoryId);
}

export async function resetSummaryOnly(workspaceId: number) {
  await db.meta.delete(summaryKey(workspaceId));
}

export async function resetSemanticMemoryOnly(workspaceId: number) {
  await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .delete();
}

export async function fullWorkspaceReset(workspaceId: number) {

  await resetSummaryOnly(workspaceId);

  await resetSemanticMemoryOnly(workspaceId);

  await db.meta.delete(turnCountKey(workspaceId));

  await resetWorkspaceCore(workspaceId);

}

export async function getMemoryCount(workspaceId: number | null | undefined): Promise<number> {
  if (!workspaceId) return 0;

  return db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .count();
}

/* ============================
   EXPORT / IMPORT SUPPORT
============================ */

export async function exportWorkspaceMemories(workspaceId: number) {
  const rows = await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();

  return rows.map(m => ({
    content: m.content,
    createdAt: m.createdAt,
    pinned: m.pinned ?? false
  }));
}

export async function importWorkspaceMemories(
  workspaceId: number,
  memories: any[]
) {
  for (const m of memories) {
    await storeMemory(workspaceId, m.content);
  }
}

/* ============================
   SUMMARY GENERATION
============================ */

async function summarise(
  existingSummary: string,
  recentTranscript: string
): Promise<string> {
  const key = localStorage.getItem("openai_key");
  if (!key) throw new Error("Missing OpenAI key for summarisation.");

  const prompt = [
    "You are updating a compact workspace summary.",
    "Keep it structured and factual.",
    "Preserve concrete facts.",
    "Remove fluff.",
    "",
    "Existing summary:",
    existingSummary || "(none)",
    "",
    "Recent transcript:",
    recentTranscript,
    "",
    "Return updated summary:"
  ].join("\n");

  const res = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are a precise summariser." },
          { role: "user", content: prompt }
        ]
      })
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Summary failed");

  return data.choices[0].message.content.trim();
}

/* ============================
   EMBEDDINGS
============================ */

async function embed(text: string): Promise<number[]> {
  const key = localStorage.getItem("openai_key");
  if (!key) throw new Error("Missing OpenAI key for embeddings.");

  const res = await fetch(
    "https://api.openai.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Embedding failed");

  return data.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function setMeta(key: string, value: any) {
  await db.meta.put({ key, value });
}

async function getMetaNumber(key: string): Promise<number> {
  const row = await db.meta.get(key);
  const v = row?.value;
  return typeof v === "number" ? v : 0;
}

export async function getWorkspaceHistory(workspaceId: number) {

  const rows = await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .sortBy("createdAt");

  return rows.map((r: any, i: number) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: r.content
  }));

}