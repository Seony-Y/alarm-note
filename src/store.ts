import { create } from "zustand";
import {
  loadCloudSchedules,
  removeCloudSchedule,
  saveCloudSchedule,
} from "./cloud";
import {
  loadSchedules,
  removeSchedule,
  replaceSchedules,
  saveSchedule,
} from "./data";
import {
  cancelAllScheduleNotifications,
  syncScheduleNotifications,
} from "./notifications";
import type { Schedule } from "./types";

interface ScheduleState {
  schedules: Schedule[];
  ready: boolean;
  ownerId: string;
  syncError: string | null;
  setOwner: (ownerId: string | null) => Promise<void>;
  upsert: (schedule: Schedule) => Promise<void>;
  toggleCompleted: (id: string) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const sampleScheduleIds = ["sample-1", "sample-2", "sample-3"];
let ownerLoadVersion = 0;

async function restoreScheduleNotifications(schedules: Schedule[]) {
  for (const schedule of schedules) {
    await syncScheduleNotifications(schedule);
  }
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  ready: false,
  ownerId: "guest",
  syncError: null,
  setOwner: async (ownerId) => {
    const loadVersion = ++ownerLoadVersion;
    const nextOwnerId = ownerId ?? "guest";
    if (get().ownerId === nextOwnerId && get().ready) return;

    const resetNotifications = get().ready;
    if (resetNotifications) {
      try {
        await cancelAllScheduleNotifications();
      } catch (error) {
        console.error("이전 계정의 알림을 정리할 수 없습니다.", error);
      }
    }
    if (loadVersion !== ownerLoadVersion) return;
    set({ ready: false, ownerId: nextOwnerId, syncError: null });
    const localSchedules = await loadSchedules(nextOwnerId);
    if (loadVersion !== ownerLoadVersion) return;

    if (!ownerId) {
      set({ schedules: [], ready: true });
      return;
    }

    let schedulesToRestore = localSchedules;
    try {
      await Promise.all(
        sampleScheduleIds.map((id) => removeCloudSchedule(id, ownerId)),
      );
      const cloudSchedules = await loadCloudSchedules();
      await replaceSchedules(cloudSchedules, ownerId);
      if (loadVersion !== ownerLoadVersion) return;
      schedulesToRestore = cloudSchedules;
      set({ schedules: cloudSchedules, ready: true });
    } catch (error) {
      if (loadVersion !== ownerLoadVersion) return;
      set({
        schedules: localSchedules,
        ready: true,
        syncError:
          error instanceof Error ? error.message : "동기화할 수 없습니다.",
      });
    }
    if (resetNotifications) {
      try {
        await restoreScheduleNotifications(schedulesToRestore);
      } catch (error) {
        console.error("계정의 알림을 복원할 수 없습니다.", error);
      }
    }
  },
  upsert: async (schedule) => {
    const ownerId = get().ownerId;
    await saveSchedule(schedule, ownerId);
    if (get().ownerId !== ownerId) return;
    const exists = get().schedules.some((item) => item.id === schedule.id);
    set({
      schedules: exists
        ? get().schedules.map((item) =>
            item.id === schedule.id ? schedule : item,
          )
        : [...get().schedules, schedule],
    });
    try {
      await syncScheduleNotifications(schedule);
    } catch (error) {
      console.error("일정 알림을 예약할 수 없습니다.", error);
    }
    if (get().ownerId !== ownerId) return;
    if (ownerId !== "guest") {
      try {
        await saveCloudSchedule(schedule, ownerId);
        if (get().ownerId === ownerId) set({ syncError: null });
      } catch (error) {
        if (get().ownerId === ownerId) {
          set({
            syncError:
              error instanceof Error ? error.message : "동기화할 수 없습니다.",
          });
        }
      }
    }
  },
  toggleCompleted: async (id) => {
    const schedule = get().schedules.find((item) => item.id === id);
    if (schedule)
      await get().upsert({ ...schedule, completed: !schedule.completed });
  },
  toggleAlarm: async (id) => {
    const schedule = get().schedules.find((item) => item.id === id);
    if (schedule)
      await get().upsert({ ...schedule, alarmEnabled: !schedule.alarmEnabled });
  },
  remove: async (id) => {
    const ownerId = get().ownerId;
    const schedule = get().schedules.find((item) => item.id === id);
    if (schedule) {
      try {
        await syncScheduleNotifications({ ...schedule, alarmEnabled: false });
      } catch (error) {
        console.error("일정 알림을 취소할 수 없습니다.", error);
      }
    }
    await removeSchedule(id, ownerId);
    if (get().ownerId !== ownerId) return;
    if (ownerId !== "guest") {
      try {
        await removeCloudSchedule(id, ownerId);
        if (get().ownerId === ownerId) set({ syncError: null });
      } catch (error) {
        if (get().ownerId === ownerId) {
          set({
            syncError:
              error instanceof Error ? error.message : "동기화할 수 없습니다.",
          });
        }
      }
    }
    if (get().ownerId !== ownerId) return;
    set({ schedules: get().schedules.filter((item) => item.id !== id) });
  },
}));
