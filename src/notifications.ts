import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type Schedule as NotificationSchedule,
  Weekday,
} from "@capacitor/local-notifications";
import { alarmModeFlags, getAlarmSettings } from "./alarm-settings";
import type { Schedule } from "./types";

function notificationId(scheduleId: string, reminderIndex: number, slot = 0) {
  const hash = [...`${scheduleId}-${reminderIndex}-${slot}`].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) | 0,
    17,
  );
  return Math.abs(hash) || reminderIndex * 10 + slot + 1;
}

function shiftedTime(startsAt: Date, minutesBefore: number) {
  const minuteOfDay =
    startsAt.getHours() * 60 + startsAt.getMinutes() - minutesBefore;
  return {
    dayOffset: Math.floor(minuteOfDay / 1_440),
    hour: Math.floor((((minuteOfDay % 1_440) + 1_440) % 1_440) / 60),
    minute: ((minuteOfDay % 60) + 60) % 60,
  };
}

function shiftedWeekday(weekday: number, dayOffset: number) {
  return (((((weekday - 1 + dayOffset) % 7) + 7) % 7) + 1) as Weekday;
}

function notificationSchedules(
  schedule: Schedule,
  startsAt: Date,
  minutesBefore: number,
): NotificationSchedule[] {
  const target = new Date(startsAt.getTime() - minutesBefore * 60_000);
  if (schedule.repeat === "none") {
    return target.getTime() > Date.now()
      ? [{ at: target, allowWhileIdle: true }]
      : [];
  }

  const time = shiftedTime(startsAt, minutesBefore);
  if (schedule.repeat === "daily") {
    return [
      { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: true },
    ];
  }

  const eventWeekdays =
    schedule.repeat === "weekdays"
      ? [
          Weekday.Monday,
          Weekday.Tuesday,
          Weekday.Wednesday,
          Weekday.Thursday,
          Weekday.Friday,
        ]
      : [startsAt.getDay() + 1];
  return eventWeekdays.map((weekday) => ({
    on: {
      weekday: shiftedWeekday(weekday, time.dayOffset),
      hour: time.hour,
      minute: time.minute,
    },
    allowWhileIdle: true,
  }));
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

export function scheduleNotificationDefinitions(
  schedule: Schedule,
): LocalNotificationSchema[] {
  if (schedule.completed) return [];

  const startsAt = new Date(`${schedule.date}T${schedule.time}:00`);
  const alarmMode = alarmModeFlags(getAlarmSettings().mode);
  return schedule.notifyBeforeMinutes.flatMap((minutes, reminderIndex) =>
    notificationSchedules(schedule, startsAt, minutes).map(
      (notificationSchedule, slot) => ({
        id: notificationId(schedule.id, reminderIndex, slot),
        title: schedule.title,
        body:
          minutes === 0
            ? "일정 시간이 되었습니다."
            : `${minutes}분 후 일정이 시작됩니다.`,
        schedule: notificationSchedule,
        sound: alarmMode.soundEnabled ? "default" : undefined,
        extra: { scheduleId: schedule.id },
      }),
    ),
  );
}

export async function syncScheduleNotifications(schedule: Schedule) {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();
  const existing = pending.notifications
    .filter((notification) => notification.extra?.scheduleId === schedule.id)
    .map(({ id }) => ({ id }));
  if (existing.length) {
    await LocalNotifications.cancel({ notifications: existing });
  }
  if (!schedule.alarmEnabled || schedule.completed) return;

  if (!(await requestAlarmPermissions())) return;

  const notifications = scheduleNotificationDefinitions(schedule);

  if (notifications.length)
    await LocalNotifications.schedule({ notifications });
}

export async function cancelAllScheduleNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();
  const scheduleNotifications = pending.notifications
    .filter((notification) => notification.extra?.scheduleId)
    .map(({ id }) => ({ id }));
  if (scheduleNotifications.length) {
    await LocalNotifications.cancel({ notifications: scheduleNotifications });
  }
}
