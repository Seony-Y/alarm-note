import { openDB } from "idb";
import type { Schedule } from "./types";

interface StoredSchedule extends Schedule {
  storageId: string;
  ownerId: string;
}

const database = openDB("haru-alarm", 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("schedules")) {
      db.createObjectStore("schedules", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("user-schedules")) {
      db.createObjectStore("user-schedules", { keyPath: "storageId" });
    }
  },
});

export async function loadSchedules(ownerId = "guest") {
  const db = await database;
  if (ownerId === "guest") {
    return db.getAll("schedules") as Promise<Schedule[]>;
  }

  const rows = (await db.getAll("user-schedules")) as StoredSchedule[];
  return rows
    .filter((row) => row.ownerId === ownerId)
    .map(
      ({ storageId: _storageId, ownerId: _ownerId, ...schedule }) => schedule,
    );
}

export async function saveSchedule(schedule: Schedule, ownerId = "guest") {
  const db = await database;
  if (ownerId === "guest") {
    await db.put("schedules", schedule);
    return;
  }

  await db.put("user-schedules", {
    ...schedule,
    ownerId,
    storageId: `${ownerId}:${schedule.id}`,
  });
}

export async function removeSchedule(id: string, ownerId = "guest") {
  const db = await database;
  await db.delete(
    ownerId === "guest" ? "schedules" : "user-schedules",
    ownerId === "guest" ? id : `${ownerId}:${id}`,
  );
}
