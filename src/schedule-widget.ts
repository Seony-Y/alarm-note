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

function occursOn(schedule: Schedule, date: Dayjs) {
  const start = dayjs(schedule.date).startOf("day");
  if (date.isBefore(start, "day")) return false;
  if (schedule.repeat === "none") return date.isSame(start, "day");
  if (schedule.repeat === "daily") return true;
  if (schedule.repeat === "weekdays") {
    return date.day() >= 1 && date.day() <= 5;
  }
  return date.day() === start.day();
}

export async function syncScheduleWidget(schedules: Schedule[]) {
  if (Capacitor.getPlatform() !== "android") return;

  const windowStart = dayjs().startOf("month");
  const windowEnd = windowStart.add(13, "month");
  const itemsPerDate = new Map<string, number>();
  const items = schedules
    .filter((schedule) => !schedule.completed)
    .flatMap((schedule) => {
      const occurrences = [];
      for (
        let date = windowStart;
        date.isBefore(windowEnd, "day");
        date = date.add(1, "day")
      ) {
        if (!occursOn(schedule, date)) continue;
        occurrences.push({
          id: schedule.id,
          date: date.format("YYYY-MM-DD"),
          time: schedule.time,
          title: schedule.title,
          enabled: schedule.alarmEnabled,
        });
      }
      return occurrences;
    })
    .sort((left, right) =>
      `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`),
    )
    .filter((item) => {
      const count = itemsPerDate.get(item.date) ?? 0;
      if (count >= 3) return false;
      itemsPerDate.set(item.date, count + 1);
      return true;
    });

  await ScheduleWidget.update({ items });
}

export async function registerScheduleWidgetActions(actions: {
  onAdd: (date: string | null) => void;
  onOpenAlarms: (date: string | null) => void;
}) {
  if (Capacitor.getPlatform() !== "android") return () => undefined;

  async function handleUrl(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "com.seony.harualarm:" || parsed.host !== "widget") {
      return;
    }
    if (parsed.pathname === "/new") {
      actions.onAdd(parsed.searchParams.get("date"));
      return;
    }
    if (parsed.pathname === "/alarms") {
      actions.onOpenAlarms(parsed.searchParams.get("date"));
    }
  }

  const listener = await App.addListener("appUrlOpen", ({ url }) => {
    void handleUrl(url);
  });
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) await handleUrl(launchUrl.url);
  return () => listener.remove();
}