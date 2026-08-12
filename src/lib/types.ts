import type { Database } from "@/integrations/supabase/types";

export type TrackRow = Database["public"]["Tables"]["tracks"]["Row"];
export type CircleRow = Database["public"]["Tables"]["circles"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export type ScheduleSlot = { day: string; time: string };
