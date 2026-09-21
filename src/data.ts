import { openDB } from "idb";
import type { Schedule } from "./types";

interface StoredSchedule extends Schedule {
  storageId: string;
  ownerId: string;
}

const sampleScheduleIds = new Set(["sample-1", "sample-2", "sample-3"]);

const database = openDB("haru-alarm", 3, {
  async upgrade(db, oldVersion, _newVersion, transaction) {
    if (!db.objectStoreNames.contains("schedules")) {
      db.createObjectStore("schedules", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("user-schedules")) {
      db.createObjectStore("user-schedules", { keyPath: "storageId" });
    }
    if (oldVersion < 3) {
      const guestStore = transaction.objectStore("schedules");
      await Promise.all(
        [...sampleScheduleIds].map((id) => guestStore.delete(id)),
      );

      const userStore = transaction.objectStore("user-schedules");
      let cursor = await userStore.openCursor();
      while (cursor) {
        if (sampleScheduleIds.has((cursor.value as StoredSchedule).id)) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }
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

export async function replaceSchedules(
  schedules: Schedule[],
  ownerId: string,
) {
  const db = await database;
  const transaction = db.transaction("user-schedules", "readwrite");
  let cursor = await transaction.store.openCursor();
  while (cursor) {
    if ((cursor.value as StoredSchedule).ownerId === ownerId) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await Promise.all(
    schedules.map((schedule) =>
      transaction.store.put({
        ...schedule,
        ownerId,
        storageId: `${ownerId}:${schedule.id}`,
      }),
    ),
  );
  await transaction.done;
}

export async function removeSchedule(id: string, ownerId = "guest") {
  const db = await database;
  await db.delete(
    ownerId === "guest" ? "schedules" : "user-schedules",
    ownerId === "guest" ? id : `${ownerId}:${id}`,
  );
}
