import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bxakaxylrfjldhtdjjmf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4YWtheHlscmZqbGRodGRqam1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDgyNjIsImV4cCI6MjA5MDM4NDI2Mn0.S1lilLIGP53SaaecNv3u9ZZ-wqQ0wteFjCgoRsgmwB0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type LogType = 'info' | 'warn' | 'error' | 'sys';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: string;
  connection_id: string | null;
  device_fingerprint: string | null;
  last_seen: string | null;
  theme: string;
  created_at: string;
}

export interface LogEntry {
  id?: string;
  user_id: string;
  msg: string;
  type: LogType;
  created_at?: string;
}

export interface ConnectionEntry {
  id: string;
  caller_id: string;
  receiver_id: string;
  status: string;
  duration_seconds: number;
  created_at: string;
  ended_at: string | null;
}