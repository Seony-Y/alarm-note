export type AlarmMode = "sound-vibration" | "sound" | "vibration" | "silent";

export interface AlarmSettings {
  mode: AlarmMode;
}

const storageKey = "haru-alarm:alarm-settings";

export const defaultAlarmSettings: AlarmSettings = {
  mode: "sound-vibration",
};

export function getAlarmSettings(): AlarmSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Partial<AlarmSettings>;
    return { ...defaultAlarmSettings, ...stored };
  } catch {
    return defaultAlarmSettings;
  }
}

export function saveAlarmSettings(settings: AlarmSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

export function alarmModeFlags(mode: AlarmMode) {
  return {
    soundEnabled: mode === "sound-vibration" || mode === "sound",
    vibrationEnabled: mode === "sound-vibration" || mode === "vibration",
  };
}