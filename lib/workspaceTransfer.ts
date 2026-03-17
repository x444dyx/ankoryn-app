import Dexie from "dexie";

import {
  listWorkspaces,
  exportWorkspaceCore,
  exportWorkspaceMeta
} from "./workspaces";

class AnkorynDB extends Dexie {
  workspaces!: Dexie.Table<any, number>;
  workspaceCore!: Dexie.Table<any, number>;
  memories!: Dexie.Table<any, number>;
  meta!: Dexie.Table<any, string>;

  constructor() {
    super("AnkorynDB");

    this.version(4).stores({
      workspaces: "++id, createdAt, name",
      workspaceCore: "workspaceId, updatedAt",
      memories: "++id, workspaceId, createdAt, pinned",
      meta: "key",
    });
  }
}

const db = new AnkorynDB();

/* ============================
   EXPORT WORKSPACE
============================ */

export async function downloadWorkspace(workspaceId: number) {

  const workspace = await db.workspaces.get(workspaceId);
  const core = await db.workspaceCore.get(workspaceId);

  const memories = await db.memories
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();

  const meta = await db.meta
    .filter(m => m.key.startsWith(`workspaceSummary:${workspaceId}`))
    .toArray();

  const payload = {
    workspace,
    core,
    memories,
    meta,
    exportedAt: Date.now()
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ankoryn-workspace-${workspaceId}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

export async function downloadAllWorkspaces() {

  const workspaces = await db.workspaces.toArray();

  const exportData: any[] = [];

  for (const ws of workspaces) {

    const core = await db.workspaceCore.get(ws.id);

    const memories = await db.memories
      .where("workspaceId")
      .equals(ws.id)
      .toArray();

    const meta = await db.meta
      .filter(m => m.key.startsWith(`workspaceSummary:${ws.id}`))
      .toArray();

    exportData.push({
      workspace: ws,
      core,
      memories,
      meta
    });
  }

  const payload = {
    version: 1,
    exportedAt: Date.now(),
    workspaces: exportData
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ankoryn-backup-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/* ============================
   IMPORT WORKSPACE
============================ */

export async function importWorkspaceFromFile(file: File) {

  const text = await file.text();
  const data = JSON.parse(text);

  /* ============================
     FULL BACKUP IMPORT
  ============================ */

  if (Array.isArray(data.workspaces)) {

    let lastWorkspaceId: number | null = null;

    for (const wsData of data.workspaces) {

      const workspaceName =
        wsData.workspace?.name ?? "Imported Workspace";

      const newWorkspaceId = await db.workspaces.add({
        name: workspaceName,
        createdAt: Date.now(),
      });

      /* -------- CORE -------- */

      if (wsData.core) {

        await db.workspaceCore.put({
          workspaceId: newWorkspaceId,
          data: wsData.core.data ?? {},
          updatedAt: Date.now()
        });
      }

      /* -------- MEMORIES -------- */

      if (Array.isArray(wsData.memories)) {

        for (const m of wsData.memories) {

          await db.memories.add({
            ...m,
            workspaceId: newWorkspaceId,
            id: undefined
          });
        }
      }

      /* -------- META -------- */

      if (Array.isArray(wsData.meta)) {

        for (const m of wsData.meta) {

          await db.meta.put({
            ...m
          });
        }
      }

      lastWorkspaceId = newWorkspaceId;
    }

    return lastWorkspaceId;
  }

  /* ============================
     SINGLE WORKSPACE IMPORT
  ============================ */

  // derive workspace name from file name
  let workspaceName = file.name.replace(".json", "").trim();

  if (!workspaceName) {
    workspaceName = "Imported Workspace";
  }

  // prevent duplicate names
  const existing = await db.workspaces
    .where("name")
    .equals(workspaceName)
    .first();

  if (existing) {
    workspaceName = `${workspaceName} (imported)`;
  }

  const newWorkspaceId = await db.workspaces.add({
    name: workspaceName,
    createdAt: Date.now(),
  });

  /* -------- CORE -------- */

  if (data.core) {

    let coreData = data.core.data ?? null;

    // Backwards compatibility
    if (!coreData) {
      coreData = {};

      if (data.core.productName)
        coreData.productName = data.core.productName;

      if (data.core.pricing)
        coreData.pricing = data.core.pricing;

      if (data.core.targetMarket)
        coreData.targetMarket = data.core.targetMarket;

      if (data.core.primaryUsers)
        coreData.primaryUsers = data.core.primaryUsers;
    }

    await db.workspaceCore.put({
      workspaceId: newWorkspaceId,
      data: coreData,
      updatedAt: Date.now()
    });
  }

  /* -------- MEMORIES -------- */

  if (Array.isArray(data.memories)) {

    for (const m of data.memories) {

      await db.memories.add({
        ...m,
        workspaceId: newWorkspaceId,
        id: undefined
      });
    }

  return newWorkspaceId;
}
  /* ---------------------------
     IMPORT CORE
  --------------------------- */

  if (data.core) {

    let coreData = data.core.data ?? null;

    // Backwards compatibility for old schema
    if (!coreData) {
      coreData = {};

      if (data.core.productName)
        coreData.productName = data.core.productName;

      if (data.core.pricing)
        coreData.pricing = data.core.pricing;

      if (data.core.targetMarket)
        coreData.targetMarket = data.core.targetMarket;

      if (data.core.primaryUsers)
        coreData.primaryUsers = data.core.primaryUsers;
    }

    await db.workspaceCore.put({
      workspaceId: newWorkspaceId,
      data: coreData,
      updatedAt: Date.now()
    });
  }

  /* ---------------------------
     IMPORT MEMORIES
  --------------------------- */

  if (Array.isArray(data.memories)) {
    for (const m of data.memories) {
      await db.memories.add({
        ...m,
        workspaceId: newWorkspaceId,
        id: undefined
      });
    }
  }

  return newWorkspaceId;
}

/* ============================
   EXPORT ENTIRE BRAIN
============================ */

export async function exportBrain() {

  const workspaces = await db.workspaces.toArray();
  const workspaceCore = await db.workspaceCore.toArray();
  const memories = await db.memories.toArray();
  const meta = await db.meta.toArray();

  const payload = {
    version: 1,
    exportedAt: Date.now(),
    brain: {
      workspaces,
      workspaceCore,
      memories,
      meta
    }
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "ankoryn-brain-backup.json";
  a.click();

  URL.revokeObjectURL(url);
}

/* ============================
   IMPORT ENTIRE BRAIN
============================ */

export async function importBrainFromFile(file: File) {

  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.brain) {
    throw new Error("Invalid brain backup file.");
  }

  const { workspaces, workspaceCore, memories, meta } = data.brain;

  // Clear existing DB
  await db.transaction("rw", db.workspaces, db.workspaceCore, db.memories, db.meta, async () => {
    await db.workspaces.clear();
    await db.workspaceCore.clear();
    await db.memories.clear();
    await db.meta.clear();

    if (Array.isArray(workspaces)) {
      await db.workspaces.bulkAdd(workspaces);
    }

    if (Array.isArray(workspaceCore)) {
      await db.workspaceCore.bulkAdd(workspaceCore);
    }

    if (Array.isArray(memories)) {
      await db.memories.bulkAdd(memories);
    }

    if (Array.isArray(meta)) {
      await db.meta.bulkAdd(meta);
    }
  });

  return true;
}