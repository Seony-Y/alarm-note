import dayjs from "dayjs";
import type { Schedule } from "./types";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  reminders?: {
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

interface GoogleCalendarResponse {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
}

export async function importGoogleCalendar(providerToken: string) {
  const query = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin: dayjs().startOf("day").toISOString(),
    timeMax: dayjs().add(90, "day").endOf("day").toISOString(),
  });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`,
    { headers: { Authorization: `Bearer ${providerToken}` } },
  );
  const result = (await response.json()) as GoogleCalendarResponse;

  if (!response.ok) {
    throw new Error(
      result.error?.message ?? "Google Calendar를 불러올 수 없습니다.",
    );
  }

  return (result.items ?? []).flatMap((event): Schedule[] => {
    const startValue = event.start?.dateTime ?? event.start?.date;
    if (!startValue) return [];
    const startsAt = dayjs(startValue);
    const reminder = event.reminders?.overrides?.find(
      (item) => item.method === "popup",
    )?.minutes;

    return [
      {
        id: `google-${event.id}`,
        date: startsAt.format("YYYY-MM-DD"),
        time: event.start?.dateTime ? startsAt.format("HH:mm") : "09:00",
        title: event.summary || "제목 없는 일정",
        description: event.description ?? "",
        importantMemo: "",
        alarmEnabled: true,
        notifyBeforeMinutes: [reminder ?? 10],
        repeat: "none",
        soundEnabled: true,
        vibrationEnabled: true,
        completed: false,
        createdAt: new Date().toISOString(),
        googleEventId: event.id,
      },
    ];
  });
}
