import { create } from "zustand";
import {
  loadCloudSchedules,
  removeCloudSchedule,
  saveCloudSchedule,
} from "./cloud";
import { loadSchedules, removeSchedule, saveSchedule } from "./data";
import { syncScheduleNotifications } from "./notifications";
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

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  ready: false,
  ownerId: "guest",
  syncError: null,
  setOwner: async (ownerId) => {
    const nextOwnerId = ownerId ?? "guest";
    if (get().ownerId === nextOwnerId && get().ready) return;

    set({ ready: false, ownerId: nextOwnerId, syncError: null });
    const localSchedules = await loadSchedules(nextOwnerId);

    if (!ownerId) {
      set({ schedules: [], ready: true });
      return;
    }

    try {
      await Promise.all(sampleScheduleIds.map((id) => removeCloudSchedule(id)));
      const cloudSchedules = await loadCloudSchedules();
      const schedules = cloudSchedules.length ? cloudSchedules : localSchedules;
      await Promise.all(
        schedules.map((schedule) => saveSchedule(schedule, ownerId)),
      );
      set({ schedules, ready: true });
    } catch (error) {
      set({
        schedules: localSchedules,
        ready: true,
        syncError:
          error instanceof Error ? error.message : "동기화할 수 없습니다.",
      });
    }
  },
  upsert: async (schedule) => {
    const ownerId = get().ownerId;
    await saveSchedule(schedule, ownerId);
    await syncScheduleNotifications(schedule);
    if (ownerId !== "guest") {
      try {
        await saveCloudSchedule(schedule, ownerId);
        set({ syncError: null });
      } catch (error) {
        set({
          syncError:
            error instanceof Error ? error.message : "동기화할 수 없습니다.",
        });
      }
    }
    const exists = get().schedules.some((item) => item.id === schedule.id);
    set({
      schedules: exists
        ? get().schedules.map((item) =>
            item.id === schedule.id ? schedule : item,
          )
        : [...get().schedules, schedule],
    });
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
    if (schedule)
      await syncScheduleNotifications({ ...schedule, alarmEnabled: false });
    await removeSchedule(id, ownerId);
    if (ownerId !== "guest") {
      try {
        await removeCloudSchedule(id);
        set({ syncError: null });
      } catch (error) {
        set({
          syncError:
            error instanceof Error ? error.message : "동기화할 수 없습니다.",
        });
      }
    }
    set({ schedules: get().schedules.filter((item) => item.id !== id) });
  },
}));
