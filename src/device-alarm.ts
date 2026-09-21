import { Capacitor, registerPlugin } from "@capacitor/core";
import dayjs from "dayjs";
import type { Schedule } from "./types";

interface DeviceAlarmPlugin {
  setAlarm(options: {
    hour: number;
    minute: number;
    message: string;
    days?: number[];
  }): Promise<void>;
}

const DeviceAlarm = registerPlugin<DeviceAlarmPlugin>("DeviceAlarm");

function repeatDays(schedule: Schedule) {
  if (schedule.repeat === "daily") return [1, 2, 3, 4, 5, 6, 7];
  if (schedule.repeat === "weekdays") return [2, 3, 4, 5, 6];
  if (schedule.repeat === "weekly") return [dayjs(schedule.date).day() + 1];
  return undefined;
}

export function canUseDeviceAlarm() {
  return Capacitor.getPlatform() === "android";
}

export async function addScheduleToDeviceAlarm(schedule: Schedule) {
  if (!canUseDeviceAlarm()) {
    throw new Error(
      "휴대폰 기본 알람 연결은 Android 앱에서만 사용할 수 있습니다.",
    );
  }

  const [hour, minute] = schedule.time.split(":").map(Number);
  await DeviceAlarm.setAlarm({
    hour,
    minute,
    message: `${schedule.date} ${schedule.title}`,
    days: repeatDays(schedule),
  });
}
