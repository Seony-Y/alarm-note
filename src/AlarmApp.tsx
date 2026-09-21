import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ko";
import Holidays from "date-holidays";
import {
  AlarmClock,
  Bell,
  BellOff,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Clock3,
  LogIn,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import checkIcon from "./assets/check.png";
import clockIcon from "./assets/clock.png";
import {
  alarmModeFlags,
  getAlarmSettings,
  saveAlarmSettings,
  type AlarmMode,
  type AlarmSettings,
} from "./alarm-settings";
import {
  connectGoogleCalendar,
  getSession,
  onAuthChange,
  registerNativeAuthCallback,
  signInWithGoogle,
  signOut,
} from "./auth";
import { addScheduleToDeviceAlarm, canUseDeviceAlarm } from "./device-alarm";
import {
  GoogleCalendarError,
  importGoogleCalendar,
} from "./google-calendar.ts";
import {
  requestAlarmPermissions,
  syncScheduleNotifications,
} from "./notifications";
import {
  registerScheduleWidgetActions,
  syncScheduleWidget,
} from "./schedule-widget";
import { useScheduleStore } from "./store";
import type { AppView, RepeatType, Schedule } from "./types";

dayjs.locale("ko");

const koreanHolidays = new Holidays("KR", {
  languages: "ko",
  types: ["public"],
});

const navigation = [
  { id: "today" as const, label: "오늘", icon: Clock3 },
  { id: "calendar" as const, label: "캘린더", icon: CalendarDays },
  { id: "alarms" as const, label: "알람", icon: AlarmClock },
  { id: "settings" as const, label: "설정", icon: Settings },
];

const repeatLabels: Record<RepeatType, string> = {
  none: "반복 없음",
  daily: "매일",
  weekdays: "평일",
  weekly: "매주",
};

function reminderLabel(minutes: number) {
  if (minutes === 0) return "정시";
  if (minutes === 60) return "1시간 전";
  return `${minutes}분 전`;
}

export function AlarmApp() {
  const store = useScheduleStore();
  const setOwner = useScheduleStore((state) => state.setOwner);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<AppView>("today");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [alarmSettings, setAlarmSettings] = useState(getAlarmSettings);

  function updateAlarmSettings(settings: AlarmSettings) {
    saveAlarmSettings(settings);
    setAlarmSettings(settings);
    void (async () => {
      for (const schedule of store.schedules) {
        await syncScheduleNotifications(schedule);
      }
    })().catch((error) =>
      console.error("알림 설정을 적용할 수 없습니다.", error),
    );
  }

  useEffect(() => {
    let active = true;
    let removeNativeListener: () => void | Promise<void> = () => undefined;

    void registerNativeAuthCallback().then((remove) => {
      removeNativeListener = remove;
    });
    void getSession().then(async (currentSession) => {
      if (!active) return;
      setSession(currentSession);
      await setOwner(currentSession?.user.id ?? null);
      if (active) {
        setPermissionsReady(
          currentSession
            ? localStorage.getItem(
                `haru-alarm:permissions:${currentSession.user.id}`,
              ) === "done"
            : false,
        );
        setAuthReady(true);
      }
    });

    const unsubscribe = onAuthChange((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setPermissionsReady(
        nextSession
          ? localStorage.getItem(
              `haru-alarm:permissions:${nextSession.user.id}`,
            ) === "done"
          : false,
      );
      void setOwner(nextSession?.user.id ?? null);
    });

    return () => {
      active = false;
      unsubscribe();
      void removeNativeListener();
    };
  }, [setOwner]);

  useEffect(() => {
    if (store.ready) {
      void syncScheduleWidget(store.schedules).catch((error) =>
        console.error("위젯을 갱신할 수 없습니다.", error),
      );
    }
  }, [store.ready, store.schedules]);

  useEffect(() => {
    if (!store.ready) return;
    let removeListener: () => void | Promise<void> = () => undefined;
    void registerScheduleWidgetActions({
      onAdd: (date) => {
        if (date && dayjs(date).isValid()) setSelectedDate(dayjs(date));
        openForm();
      },
      onOpenAlarms: (date) => {
        if (date && dayjs(date).isValid()) setSelectedDate(dayjs(date));
        setView("alarms");
      },
    }).then((remove) => {
      removeListener = remove;
    });
    return () => void removeListener();
  }, [store.ready]);

  const daySchedules = useMemo(
    () =>
      store.schedules
        .filter((item) => item.date === selectedDate.format("YYYY-MM-DD"))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [store.schedules, selectedDate],
  );

  function openForm(schedule?: Schedule) {
    setEditing(schedule ?? null);
    setFormOpen(true);
  }

  async function toggleAlarm(id: string) {
    const schedule = store.schedules.find((item) => item.id === id);
    await store.toggleAlarm(id);
    if (schedule && !schedule.alarmEnabled && canUseDeviceAlarm()) {
      try {
        await addScheduleToDeviceAlarm({ ...schedule, alarmEnabled: true });
      } catch (error) {
        console.error("기본 시계 알람을 추가할 수 없습니다.", error);
      }
    }
  }

  async function importCalendar() {
    if (!session?.provider_token) {
      await connectGoogleCalendar();
      return null;
    }
    try {
      const events = await importGoogleCalendar(session.provider_token);
      await Promise.all(events.map((event) => store.upsert(event)));
      return events.length;
    } catch (error) {
      if (error instanceof GoogleCalendarError && error.status === 401) {
        await connectGoogleCalendar();
        return null;
      }
      throw error;
    }
  }

  if (!authReady || !store.ready)
    return <main className="loading">하루를 준비하고 있어요.</main>;
  if (!session) return <LoginView />;
  if (!permissionsReady)
    return (
      <PermissionSetup
        onComplete={() => {
          localStorage.setItem(
            `haru-alarm:permissions:${session.user.id}`,
            "done",
          );
          setPermissionsReady(true);
        }}
      />
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span id="icon">
            <img src={clockIcon} alt="" />
          </span>
          <strong>하루알람</strong>
        </div>
        <Navigation view={view} onChange={setView} />
        <div className="next-alarm">
          <Bell size={18} />
          <span>활성 알람</span>
          <strong>
            {
              store.schedules.filter(
                (item) => item.alarmEnabled && !item.completed,
              ).length
            }
            개
          </strong>
        </div>
      </aside>

      <main className="content">
        {view === "today" && (
          <TodayView
            date={selectedDate}
            schedules={daySchedules}
            onDateChange={setSelectedDate}
            onAdd={() => openForm()}
            onEdit={openForm}
            onComplete={store.toggleCompleted}
            onAlarm={toggleAlarm}
          />
        )}
        {view === "calendar" && (
          <CalendarView
            schedules={store.schedules}
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setView("today");
            }}
          />
        )}
        {view === "alarms" && (
          <AlarmView
            key={selectedDate.format("YYYY-MM")}
            schedules={store.schedules}
            selectedDate={selectedDate}
            onToggle={toggleAlarm}
          />
        )}
        {view === "settings" && (
          <SettingsView
            session={session}
            syncError={store.syncError}
            onImportCalendar={importCalendar}
            alarmSettings={alarmSettings}
            onAlarmSettingsChange={updateAlarmSettings}
          />
        )}
      </main>

      <div className="bottom-nav">
        <Navigation view={view} onChange={setView} />
      </div>

      {formOpen && (
        <ScheduleForm
          initial={editing}
          date={selectedDate.format("YYYY-MM-DD")}
          alarmSettings={alarmSettings}
          onClose={() => setFormOpen(false)}
          onSave={async (schedule) => {
            await store.upsert(schedule);
            setFormOpen(false);
            if (schedule.alarmEnabled && canUseDeviceAlarm()) {
              try {
                await addScheduleToDeviceAlarm(schedule);
              } catch (error) {
                console.error("기본 시계 알람을 추가할 수 없습니다.", error);
              }
            }
          }}
          onDelete={
            editing
              ? async () => {
                  await store.remove(editing.id);
                  setFormOpen(false);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function LoginView() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Google 로그인에 실패했습니다.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <img src={clockIcon} alt="" />
        <p>나만의 일정과 알람</p>
        <h1>하루알람</h1>
        <span>Google 계정으로 로그인하면 내 일정만 안전하게 불러옵니다.</span>
        <button
          className="primary google-login"
          disabled={busy}
          onClick={() => void handleSignIn()}
        >
          <LogIn size={19} />
          {busy ? "연결 중" : "Google로 간편 로그인"}
        </button>
        {error && <small className="setting-error">{error}</small>}
      </section>
    </main>
  );
}

function PermissionSetup({ onComplete }: { onComplete: () => void }) {
  const [notificationMessage, setNotificationMessage] = useState(
    "정확한 시간에 알람을 받으려면 필요합니다.",
  );

  async function allowNotifications() {
    const granted = await requestAlarmPermissions();
    setNotificationMessage(
      granted ? "알림 권한이 허용되었습니다." : "알림 권한이 필요합니다.",
    );
  }

  return (
    <main className="auth-screen">
      <section className="permission-panel">
        <div className="permission-heading">
          <ShieldCheck size={30} />
          <div>
            <p>로그인 완료</p>
            <h1>사용 권한을 설정하세요</h1>
          </div>
        </div>
        <div className="permission-row">
          <span>
            <strong>알림 및 정확한 알람</strong>
            <small>{notificationMessage}</small>
          </span>
          <button
            className="secondary"
            onClick={() => void allowNotifications()}
          >
            허용
          </button>
        </div>
        <button className="primary permission-continue" onClick={onComplete}>
          하루알람 시작하기
        </button>
      </section>
    </main>
  );
}

function Navigation({
  view,
  onChange,
}: {
  view: AppView;
  onChange: (view: AppView) => void;
}) {
  return (
    <nav aria-label="주 메뉴">
      {navigation.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={view === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function TodayView({
  date,
  schedules,
  onDateChange,
  onAdd,
  onEdit,
  onComplete,
  onAlarm,
}: {
  date: dayjs.Dayjs;
  schedules: Schedule[];
  onDateChange: (date: dayjs.Dayjs) => void;
  onAdd: () => void;
  onEdit: (schedule: Schedule) => void;
  onComplete: (id: string) => Promise<void>;
  onAlarm: (id: string) => Promise<void>;
}) {
  const important = schedules.find(
    (item) => item.importantMemo && !item.completed,
  );
  return (
    <>
      <PageHeader
        eyebrow={date.format("YYYY년 M월")}
        title={date.format("D일 dddd")}
      >
        <button className="primary" aria-label="일정 추가" onClick={onAdd}>
          <Plus size={19} />
          <span>일정 추가</span>
        </button>
      </PageHeader>
      <div className="date-control">
        <button
          aria-label="이전 날짜"
          onClick={() => onDateChange(date.subtract(1, "day"))}
        >
          <ChevronLeft />
        </button>
        <button className="today-button" onClick={() => onDateChange(dayjs())}>
          오늘
        </button>
        <button
          aria-label="다음 날짜"
          onClick={() => onDateChange(date.add(1, "day"))}
        >
          <ChevronRight />
        </button>
      </div>
      {important && (
        <section className="important-band">
          <Star size={19} fill="currentColor" />
          <div>
            <span>오늘의 중요 메모</span>
            <strong>{important.importantMemo}</strong>
          </div>
        </section>
      )}
      <section className="schedule-section">
        <div className="section-heading">
          <h2>일정</h2>
          <span>
            {schedules.filter((item) => item.completed).length}/
            {schedules.length} 완료
          </span>
        </div>
        {schedules.length ? (
          <div className="timeline">
            {schedules.map((schedule) => (
              <article
                className={`schedule-row ${schedule.completed ? "completed" : ""}`}
                key={schedule.id}
              >
                <time>{schedule.time}</time>
                <button
                  className="check-button"
                  aria-label="완료 상태 변경"
                  onClick={() => void onComplete(schedule.id)}
                >
                  {schedule.completed && <img src={checkIcon} alt="" />}
                </button>
                <button
                  className="schedule-copy"
                  onClick={() => onEdit(schedule)}
                >
                  <strong>{schedule.title}</strong>
                  <span>
                    {schedule.description ||
                      reminderLabel(schedule.notifyBeforeMinutes[0])}
                  </span>
                  {schedule.importantMemo && (
                    <em>
                      <Star size={11} fill="currentColor" />
                      {schedule.importantMemo}
                    </em>
                  )}
                </button>
                <button
                  className={`alarm-toggle ${schedule.alarmEnabled ? "on" : ""}`}
                  aria-label="알람 상태 변경"
                  onClick={() => void onAlarm(schedule.id)}
                >
                  {schedule.alarmEnabled ? (
                    <Bell size={18} />
                  ) : (
                    <BellOff size={18} />
                  )}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <CalendarDays />
            </div>
            <h3>등록된 일정이 없어요</h3>
            <p>오늘 기억할 일을 가볍게 남겨보세요.</p>
            <button onClick={onAdd}>첫 일정 추가</button>
          </div>
        )}
      </section>
    </>
  );
}

function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}

function CalendarView({
  schedules,
  selected,
  onSelect,
}: {
  schedules: Schedule[];
  selected: dayjs.Dayjs;
  onSelect: (date: dayjs.Dayjs) => void;
}) {
  const [month, setMonth] = useState(selected.startOf("month"));
  const days = useMemo(() => {
    const start = month.startOf("month").startOf("week");
    return Array.from({ length: 42 }, (_, index) => start.add(index, "day"));
  }, [month]);
  const holidays = useMemo(() => {
    const years = [...new Set(days.map((date) => date.year()))];
    return new Map(
      years
        .flatMap((year) => koreanHolidays.getHolidays(year))
        .flatMap((holiday) => {
          const startDate = dayjs(holiday.date.slice(0, 10));
          const duration = Math.max(
            1,
            Math.round(
              (holiday.end.getTime() - holiday.start.getTime()) / 86_400_000,
            ),
          );
          return Array.from(
            { length: duration },
            (_, index) =>
              [
                startDate.add(index, "day").format("YYYY-MM-DD"),
                holiday.name,
              ] as const,
          );
        }),
    );
  }, [days]);
  return (
    <>
      <PageHeader eyebrow="한눈에 보는 일정" title={month.format("YYYY년 M월")}>
        <div className="month-buttons">
          <button
            onClick={() => setMonth(month.subtract(1, "month"))}
            aria-label="이전 달"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => setMonth(month.add(1, "month"))}
            aria-label="다음 달"
          >
            <ChevronRight />
          </button>
        </div>
      </PageHeader>
      <section className="calendar-panel">
        <div className="weekdays">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
            <span
              key={day}
              className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""}
            >
              {day}
            </span>
          ))}
        </div>
        <div className="calendar-grid">
          {days.map((date) => {
            const items = schedules.filter(
              (item) => item.date === date.format("YYYY-MM-DD"),
            );
            const holiday = holidays.get(date.format("YYYY-MM-DD"));
            const weekend =
              date.day() === 0 ? "sunday" : date.day() === 6 ? "saturday" : "";
            return (
              <button
                key={date.format("YYYY-MM-DD")}
                aria-label={`${date.format("M월 D일")}${holiday ? ` ${holiday}` : ""}`}
                className={`${date.month() !== month.month() ? "muted" : ""} ${date.isSame(dayjs(), "day") ? "today" : ""} ${weekend} ${holiday ? "holiday" : ""}`}
                onClick={() => onSelect(date)}
              >
                <span className="date-number">{date.date()}</span>
                <span className="calendar-markers">
                  {holiday && <small className="holiday-name">{holiday}</small>}
                  {items.slice(0, 3).map((item) => (
                    <i
                      key={item.id}
                      className={item.importantMemo ? "important" : ""}
                    >
                      {item.title}
                    </i>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function AlarmView({
  schedules,
  selectedDate,
  onToggle,
}: {
  schedules: Schedule[];
  selectedDate: Dayjs;
  onToggle: (id: string) => Promise<void>;
}) {
  const [month, setMonth] = useState(selectedDate.startOf("month"));
  const alarms = schedules
    .filter(
      (item) => !item.completed && dayjs(item.date).isSame(month, "month"),
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return (
    <>
      <PageHeader eyebrow="예정된 알림" title="알람 관리">
        <div className="alarm-count">
          <Bell size={17} />
          {alarms.filter((item) => item.alarmEnabled).length}개 활성
        </div>
      </PageHeader>
      <div className="alarm-month-toolbar">
        <button
          className="icon-button"
          onClick={() => setMonth(month.subtract(1, "month"))}
          aria-label="이전 달"
        >
          <ChevronLeft />
        </button>
        <strong>{month.format("YYYY년 M월")}</strong>
        <button
          className="icon-button"
          onClick={() => setMonth(month.add(1, "month"))}
          aria-label="다음 달"
        >
          <ChevronRight />
        </button>
      </div>
      <section className="alarm-list">
        {alarms.length ? (
          alarms.map((item) => (
            <article key={item.id}>
              <div className="alarm-time">
                <strong>{item.time}</strong>
                <span>{dayjs(item.date).format("M월 D일 ddd")}</span>
              </div>
              <div className="alarm-info">
                <strong>{item.title}</strong>
                <span>
                  {item.notifyBeforeMinutes.map(reminderLabel).join(", ")} ·{" "}
                  {repeatLabels[item.repeat]}
                </span>
              </div>
              <Switch
                checked={item.alarmEnabled}
                onChange={() => void onToggle(item.id)}
              />
            </article>
          ))
        ) : (
          <p className="alarm-empty">이 달에 등록된 알람이 없습니다.</p>
        )}
      </section>
    </>
  );
}

function SettingsView({
  session,
  syncError,
  onImportCalendar,
  alarmSettings,
  onAlarmSettingsChange,
}: {
  session: Session | null;
  syncError: string | null;
  onImportCalendar: () => Promise<number | null>;
  alarmSettings: AlarmSettings;
  onAlarmSettingsChange: (settings: AlarmSettings) => void;
}) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "로그인할 수 없습니다.",
      );
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOut();
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "로그아웃할 수 없습니다.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleCalendarImport() {
    setCalendarBusy(true);
    setCalendarMessage(null);
    try {
      const count = await onImportCalendar();
      if (count !== null) {
        setCalendarMessage(`${count}개 일정을 가져왔습니다.`);
      }
    } catch (error) {
      setCalendarMessage(
        error instanceof Error
          ? error.message
          : "Google Calendar를 불러올 수 없습니다.",
      );
    } finally {
      setCalendarBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="나에게 맞게" title="설정" />
      <section className="settings-list">
        <div className="setting-row account-row">
          <span>
            <strong>{session ? "Google 계정" : "계정 연결"}</strong>
            <small>
              {session?.user.email ?? "로그인하면 일정이 계정별로 동기화됩니다"}
            </small>
            {(authError || syncError) && (
              <small className="setting-error">{authError || syncError}</small>
            )}
          </span>
          {session ? (
            <button
              className="account-button secondary"
              disabled={authBusy}
              onClick={() => void handleSignOut()}
            >
              <LogOut size={17} />
              로그아웃
            </button>
          ) : (
            <button
              className="account-button primary"
              disabled={authBusy}
              onClick={() => void handleSignIn()}
            >
              <LogIn size={17} />
              {authBusy ? "연결 중" : "Google 로그인"}
            </button>
          )}
        </div>
        <SettingSelect
          title="알람 방식"
          note="새로 추가하는 시계 알람에 적용됩니다"
          options={[
            { value: "sound-vibration", label: "소리 및 진동" },
            { value: "sound", label: "소리" },
            { value: "vibration", label: "진동" },
            { value: "silent", label: "무음" },
          ]}
          value={alarmSettings.mode}
          onChange={(value) =>
            onAlarmSettingsChange({
              ...alarmSettings,
              mode: value as AlarmMode,
            })
          }
        />
        <div className="setting-row">
          <span>
            <strong>데이터 백업</strong>
            <small>
              {session
                ? "Supabase에 자동 저장됩니다"
                : "Google 로그인이 필요합니다"}
            </small>
          </span>
          <span className={`sync-status ${session ? "connected" : ""}`}>
            <Cloud size={15} />
            {session ? "연결됨" : "미연결"}
          </span>
        </div>
        <div className="setting-row">
          <span>
            <strong>Google Calendar</strong>
            <small>
              {calendarMessage ?? "앞으로 90일의 일정을 가져옵니다"}
            </small>
          </span>
          <div className="calendar-actions">
            <button
              className="account-button secondary"
              disabled={!session || calendarBusy}
              onClick={() => void handleCalendarImport()}
            >
              <CalendarPlus size={17} />
              {calendarBusy ? "가져오는 중" : "일정 가져오기"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function SettingSelect({
  title,
  note,
  options,
  value,
  onChange,
}: {
  title: string;
  note: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={`switch ${checked ? "on" : ""}`}
      onClick={onChange}
      aria-label={checked ? "끄기" : "켜기"}
    >
      <span />
    </button>
  );
}

function ScheduleForm({
  initial,
  date,
  alarmSettings,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Schedule | null;
  date: string;
  alarmSettings: AlarmSettings;
  onClose: () => void;
  onSave: (schedule: Schedule) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [scheduleDate, setScheduleDate] = useState(initial?.date ?? date);
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [importantMemo, setImportantMemo] = useState(
    initial?.importantMemo ?? "",
  );
  const [before, setBefore] = useState(initial?.notifyBeforeMinutes[0] ?? 0);
  const [repeat, setRepeat] = useState<RepeatType>(initial?.repeat ?? "none");
  const [alarmEnabled, setAlarmEnabled] = useState(
    initial?.alarmEnabled ?? true,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const alarmMode = alarmModeFlags(alarmSettings.mode);
    await onSave({
      id: initial?.id ?? crypto.randomUUID(),
      date: scheduleDate,
      time,
      title: title.trim(),
      description: description.trim(),
      importantMemo: importantMemo.trim(),
      alarmEnabled,
      notifyBeforeMinutes: [before],
      repeat,
      ...alarmMode,
      completed: initial?.completed ?? false,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="form-panel"
        role="dialog"
        aria-modal="true"
        aria-label="일정 등록"
      >
        <header>
          <div>
            <p>{initial ? "일정 수정" : "새로운 일정"}</p>
            <h2>{initial ? "일정을 변경할까요?" : "무엇을 기억할까요?"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <X />
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>제목</span>
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="일정 제목"
            />
          </label>
          <div className="form-grid">
            <label>
              <span>날짜</span>
              <input
                type="date"
                required
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
              />
            </label>
            <label>
              <span>시간</span>
              <input
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          </div>
          <label>
            <span>상세 내용</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="필요한 내용을 기록하세요"
            />
          </label>
          <label className="important-input">
            <span>
              <Star size={14} />
              중요 메모
            </span>
            <input
              value={importantMemo}
              onChange={(event) => setImportantMemo(event.target.value)}
              placeholder="놓치면 안 되는 내용을 강조하세요"
            />
          </label>
          <div className="form-grid">
            <label>
              <span>사전 알림</span>
              <select
                value={before}
                onChange={(event) => setBefore(Number(event.target.value))}
              >
                <option value="0">정시</option>
                <option value="5">5분 전</option>
                <option value="10">10분 전</option>
                <option value="30">30분 전</option>
                <option value="60">1시간 전</option>
              </select>
            </label>
            <label>
              <span>반복</span>
              <select
                value={repeat}
                onChange={(event) =>
                  setRepeat(event.target.value as RepeatType)
                }
              >
                {Object.entries(repeatLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="option-row">
            <Toggle
              label="알람"
              checked={alarmEnabled}
              onChange={setAlarmEnabled}
            />
          </div>
          <footer>
            {onDelete && (
              <button
                type="button"
                className="delete-button"
                onClick={() => void onDelete()}
              >
                <Trash2 size={17} />
                삭제
              </button>
            )}
            <span />
            <button type="button" className="secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="primary">
              저장
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <Switch checked={checked} onChange={() => onChange(!checked)} />
    </label>
  );
}
