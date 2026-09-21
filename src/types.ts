export type RepeatType = "none" | "daily" | "weekdays" | "weekly";

export interface Schedule {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  importantMemo: string;
  alarmEnabled: boolean;
  notifyBeforeMinutes: number[];
  repeat: RepeatType;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  completed: boolean;
  createdAt: string;
  googleEventId?: string;
}

export type AppView = "today" | "calendar" | "alarms" | "settings";
