import dayjs from "dayjs";
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
  initialize: () => Promise<void>;
  setOwner: (ownerId: string | null) => Promise<void>;
  upsert: (schedule: Schedule) => Promise<void>;
  toggleCompleted: (id: string) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const today = dayjs().format("YYYY-MM-DD");
const sampleSchedules: Schedule[] = [
  {
    id: "sample-1",
    date: today,
    time: "09:30",
    title: "주간 업무 정리",
    description: "이번 주 우선순위와 진행 상황 확인",
    importantMemo: "보고서 첨부 잊지 않기",
    alarmEnabled: true,
    notifyBeforeMinutes: [10],
    repeat: "weekdays",
    soundEnabled: true,
    vibrationEnabled: true,
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "sample-2",
    date: today,
    time: "14:00",
    title: "치과 예약",
    description: "예약 시간 10분 전에 도착",
    importantMemo: "",
    alarmEnabled: true,
    notifyBeforeMinutes: [30],
    repeat: "none",
    soundEnabled: true,
    vibrationEnabled: true,
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "sample-3",
    date: today,
    time: "19:30",
    title: "하루 기록 정리",
    description: "",
    importantMemo: "",
    alarmEnabled: false,
    notifyBeforeMinutes: [0],
    repeat: "daily",
    soundEnabled: false,
    vibrationEnabled: true,
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  ready: false,
  ownerId: "guest",
  syncError: null,
  initialize: async () => {
    const saved = await loadSchedules("guest");
    const schedules = saved.length ? saved : sampleSchedules;
    if (!saved.length) {
      await Promise.all(
        schedules.map((schedule) => saveSchedule(schedule, "guest")),
      );
    }
    set({ schedules, ready: true });
  },
  setOwner: async (ownerId) => {
    const nextOwnerId = ownerId ?? "guest";
    if (get().ownerId === nextOwnerId && get().ready) return;

    set({ ready: false, ownerId: nextOwnerId, syncError: null });
    const localSchedules = await loadSchedules(nextOwnerId);

    if (!ownerId) {
      set({
        schedules: localSchedules.length ? localSchedules : sampleSchedules,
        ready: true,
      });
      return;
    }

    try {
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
