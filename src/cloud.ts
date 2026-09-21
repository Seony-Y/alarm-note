import { supabase } from "./supabase";
import type { Schedule } from "./types";

interface ScheduleRow {
  id: string;
  payload: Schedule;
}

export async function loadCloudSchedules() {
  const { data, error } = await supabase
    .from("schedules")
    .select("id, payload")
    .order("updated_at", { ascending: true });

  if (error) throw error;
  return (data as ScheduleRow[]).map((row) => row.payload);
}

export async function saveCloudSchedule(schedule: Schedule, userId: string) {
  const { error } = await supabase.from("schedules").upsert(
    {
      id: schedule.id,
      user_id: userId,
      payload: schedule,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,id" },
  );
  if (error) throw error;
}

export async function removeCloudSchedule(id: string, userId: string) {
  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
