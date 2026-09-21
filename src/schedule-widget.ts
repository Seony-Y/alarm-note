import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import dayjs, { type Dayjs } from "dayjs";
import type { Schedule } from "./types";

interface ScheduleWidgetPlugin {
  update(options: {
    items: Array<{
      id: string;
      date: string;
      time: string;
      title: string;
      enabled: boolean;
    }>;
  }): Promise<void>;
}

const ScheduleWidget = registerPlugin<ScheduleWidgetPlugin>("ScheduleWidget");

function nextOccurrence(schedule: Schedule, now: Dayjs) {
  const start = dayjs(`${schedule.date}T${schedule.time}:00`);
  if (schedule.repeat === "none") return start.isAfter(now) ? start : null;

  let candidate = now.startOf("day").hour(start.hour()).minute(start.minute());
  if (candidate.isBefore(start)) candidate = start;

  for (let offset = 0; offset < 8; offset += 1) {
    const occurrence = candidate.add(offset, "day");
    const matches =
      schedule.repeat === "daily" ||
      (schedule.repeat === "weekdays" &&
        occurrence.day() >= 1 &&
        occurrence.day() <= 5) ||
      (schedule.repeat === "weekly" && occurrence.day() === start.day());
    if (matches && occurrence.isAfter(now)) return occurrence;
  }
  return null;
}

export async function syncScheduleWidget(schedules: Schedule[]) {
  if (Capacitor.getPlatform() !== "android") return;

  const now = dayjs();
  const items = schedules
    .filter((schedule) => !schedule.completed)
    .map((schedule) => ({ schedule, at: nextOccurrence(schedule, now) }))
    .filter((item): item is { schedule: Schedule; at: Dayjs } => Boolean(item.at))
    .sort((left, right) => left.at.valueOf() - right.at.valueOf())
    .slice(0, 2)
    .map(({ schedule, at }) => ({
      id: schedule.id,
      date: at.isSame(now, "day")
        ? "오늘"
        : at.isSame(now.add(1, "day"), "day")
          ? "내일"
          : at.format("M월 D일 ddd"),
      time: at.format("HH:mm"),
      title: schedule.title,
      enabled: schedule.alarmEnabled,
    }));

  await ScheduleWidget.update({ items });
}

export async function registerScheduleWidgetActions(actions: {
  onAdd: () => void;
  onSetAlarm: (id: string, enabled: boolean) => Promise<void>;
}) {
  if (Capacitor.getPlatform() !== "android") return () => undefined;

  async function handleUrl(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "com.seony.harualarm:" || parsed.host !== "widget") {
      return;
    }
    if (parsed.pathname === "/new") {
      actions.onAdd();
      return;
    }
    if (parsed.pathname === "/alarm") {
      const id = parsed.searchParams.get("id");
      const enabled = parsed.searchParams.get("enabled");
      if (id && enabled) await actions.onSetAlarm(id, enabled === "true");
    }
  }

  const listener = await App.addListener("appUrlOpen", ({ url }) => {
    void handleUrl(url);
  });
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) await handleUrl(launchUrl.url);
  return () => listener.remove();
}