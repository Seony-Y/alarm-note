import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Schedule } from "./types";

function notificationId(scheduleId: string, index: number) {
  const hash = [...`${scheduleId}-${index}`].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) | 0,
    17,
  );
  return Math.abs(hash) || index + 1;
}

export async function requestAlarmPermissions() {
  if (!Capacitor.isNativePlatform()) return true;

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return false;

  const exactAlarm = await LocalNotifications.checkExactNotificationSetting();
  if (exactAlarm.exact_alarm !== "granted") {
    await LocalNotifications.changeExactNotificationSetting();
  }
  return true;
}

export async function syncScheduleNotifications(schedule: Schedule) {
  if (!Capacitor.isNativePlatform()) return;

  const ids = schedule.notifyBeforeMinutes.map((_, index) => ({
    id: notificationId(schedule.id, index),
  }));
  if (ids.length) await LocalNotifications.cancel({ notifications: ids });
  if (!schedule.alarmEnabled || schedule.completed) return;

  if (!(await requestAlarmPermissions())) return;

  const startsAt = new Date(`${schedule.date}T${schedule.time}:00`);
  const notifications = schedule.notifyBeforeMinutes
    .map((minutes, index) => ({
      id: notificationId(schedule.id, index),
      title: schedule.title,
      body:
        minutes === 0
          ? "일정 시간이 되었습니다."
          : `${minutes}분 후 일정이 시작됩니다.`,
      schedule: {
        at: new Date(startsAt.getTime() - minutes * 60_000),
        repeats: schedule.repeat === "daily" || schedule.repeat === "weekly",
        every:
          schedule.repeat === "daily"
            ? ("day" as const)
            : schedule.repeat === "weekly"
              ? ("week" as const)
              : undefined,
        allowWhileIdle: true,
      },
      sound: schedule.soundEnabled ? "default" : undefined,
      extra: { scheduleId: schedule.id },
    }))
    .filter((item) => item.schedule.at.getTime() > Date.now());

  if (notifications.length)
    await LocalNotifications.schedule({ notifications });
}
