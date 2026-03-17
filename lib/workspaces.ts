import Dexie from "dexie";

/* ============================
   Types
============================ */

export type Workspace = {
  id?: number;
  name: string;
  createdAt: number;

  // model routing
  provider?: string;
  model?: string;
};

export type WorkspaceCore = {
  workspaceId: number;

  // NEW: flexible identity store
  data?: Record<string, string>;

  identityLocked?: boolean;

  updatedAt: number;
};

type MetaRow = { key: string; value: any };

/* ============================
   Workspace Limits
============================ */

const FREE_WORKSPACE_LIMIT = 2;

/* ============================
   DB
============================ */

class AnkorynDB extends Dexie {
  workspaces!: Dexie.Table<Workspace, number>;
  workspaceCore!: Dexie.Table<WorkspaceCore, number>;
  meta!: Dexie.Table<MetaRow, string>;

  constructor() {
    super("AnkorynDB");

    this.version(7).stores({
    workspaces: "++id, createdAt, name, provider, model",
    workspaceCore: "workspaceId, updatedAt",
    meta: "key",
    });
  }
}

const db = new AnkorynDB();

/* ============================
   Workspace CRUD
============================ */

export async function listWorkspaces(): Promise<Workspace[]> {
  return db.workspaces.orderBy("createdAt").toArray();
}

export async function createWorkspace(name: string): Promise<number> {
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Workspace name cannot be empty.");

  const existing = await db.workspaces.toArray();

const licenseValid =
  typeof window !== "undefined" &&
  !!localStorage.getItem("ankoryn_license_key");

if (!licenseValid && existing.length >= FREE_WORKSPACE_LIMIT) {
  throw new Error("WORKSPACE_LIMIT_REACHED");
}

  const id = await db.workspaces.add({
    name: clean,
    createdAt: Date.now(),
  });

  await db.workspaceCore.put({
    workspaceId: id,
    data: {},
    updatedAt: Date.now(),
  });

  await setActiveWorkspaceId(id);
  return id;
}

export async function setActiveWorkspaceId(id: number) {
  await db.meta.put({ key: "activeWorkspaceId", value: id });
}

export async function getActiveWorkspaceId(): Promise<number | null> {
  const row = await db.meta.get("activeWorkspaceId");
  const v = row?.value;
  return typeof v === "number" ? v : null;
}

export async function ensureDefaultWorkspace(): Promise<number> {

  const all = await db.workspaces.toArray();

  // If workspaces exist, just return the first one
  if (all.length > 0) {
    const first = all[0];

    if (first.id) {
      await setActiveWorkspaceId(first.id);
      return first.id;
    }
  }

  // Only create Default if absolutely none exist
  const id = await db.workspaces.add({
    name: "Default",
    createdAt: Date.now(),
  });

  await db.workspaceCore.put({
    workspaceId: id,
    data: {},
    updatedAt: Date.now(),
  });

  await setActiveWorkspaceId(id);

  return id;
}

/* ============================
   Deterministic Core Layer
============================ */

export async function getWorkspaceCore(
  workspaceId: number | null | undefined
): Promise<WorkspaceCore | null> {

  if (!workspaceId) return null;

  const core = await db.workspaceCore.get(workspaceId);

  return core ?? null;
}

export async function updateWorkspaceCore(
  workspaceId: number,
  partial: Record<string, string>
) {
  const existing = await db.workspaceCore.get(workspaceId);

  if (!existing) {
    await db.workspaceCore.put({
      workspaceId,
      data: partial,
      updatedAt: Date.now(),
    });
    return;
  }

  if (existing.identityLocked) return;

  const merged: WorkspaceCore = {
    ...existing,
    data: {
      ...(existing.data ?? {}),
      ...partial,
    },
    updatedAt: Date.now(),
  };

  await db.workspaceCore.put(merged);
}

export async function pinMemoryToCore(
  workspaceId: number,
  content: string
) {

  const text = content.toLowerCase().trim();

  let key = "";
  let value = "";

  if (text.includes("my name is")) {
    key = "user_name";
    value = text.replace("my name is", "").trim();
  }

  else if (text.includes("project name is")) {
    key = "project_name";
    value = text.replace("project name is", "").trim();
  }

  else if (text.includes("called")) {
    key = "project_name";
    value = text.split("called").pop()?.trim() || "";
  }

  else if (text.includes("building")) {
    key = "current_project";
    value = text.replace("i am building", "").replace("building", "").trim();
  }

  else if (text.includes(":")) {
    const [k, ...rest] = content.split(":");
    key = k.trim().toLowerCase().replace(/\s+/g, "_");
    value = rest.join(":").trim();
  }

  if (!key || !value) {
    throw new Error("Could not extract a core fact.");
  }

  await updateWorkspaceCore(workspaceId, {
    [key]: value
  });

}

/* ============================
   Reset Core
============================ */

export async function resetWorkspaceCore(workspaceId: number) {
  await db.workspaceCore.put({
    workspaceId,
    data: {},
    updatedAt: Date.now(),
  });
}

/* =====================================================
   PHASE 3 ADDITIONS — EXPORT / IMPORT SUPPORT
===================================================== */

export async function exportWorkspaceMeta(workspaceId: number) {
  const workspace = await db.workspaces.get(workspaceId);
  return workspace ?? null;
}

export async function exportWorkspaceCore(workspaceId: number) {
  const core = await db.workspaceCore.get(workspaceId);
  return core ?? null;
}

export async function importWorkspaceMeta(data: Workspace): Promise<number> {
  const id = await db.workspaces.add({
    name: data.name,
    createdAt: data.createdAt ?? Date.now(),
  });

  return id;
}

export async function importWorkspaceCore(
  workspaceId: number,
  core: WorkspaceCore | null
) {
  if (!core) return;

  await db.workspaceCore.put({
    workspaceId,
    data: core.data ?? {},
    updatedAt: Date.now(),
  });
}

export async function renameWorkspace(id: number, name: string) {
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Workspace name cannot be empty.");

  await db.workspaces.update(id, { name: clean });
}

export async function deleteWorkspace(workspaceId: number) {

  const dbInstance = db;

  await dbInstance.transaction(
    "rw",
    dbInstance.workspaces,
    dbInstance.workspaceCore,
    dbInstance.meta,
    async () => {

      await dbInstance.workspaces.delete(workspaceId);

      await dbInstance.workspaceCore
        .where("workspaceId")
        .equals(workspaceId)
        .delete();

      await dbInstance.meta.delete(`workspaceSummary:${workspaceId}`);
      await dbInstance.meta.delete(`turnCount:${workspaceId}`);

    }
  );
}

export async function setWorkspaceModel(
  workspaceId: number,
  provider: string,
  model: string
) {
  await db.workspaces.update(workspaceId, {
    provider,
    model
  });
}

export async function getWorkspaceModel(
  workspaceId: number
): Promise<{ provider: string; model: string } | null> {

  const ws = await db.workspaces.get(workspaceId);

  if (!ws) return null;

  return {
    provider: ws.provider ?? "openai",
    model: ws.model ?? "gpt-4o-mini"
  };
}