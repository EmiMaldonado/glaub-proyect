import { Database } from '@/integrations/supabase/types';

// Extended types to include missing database fields
export interface ExtendedProfile {
  id: string;
  user_id: string;
  age: number | null;
  avatar_url: string | null;
  can_manage_teams: boolean | null;
  can_be_managed: boolean | null;
  created_at: string;
  display_name: string | null;
  email: string | null;
  full_name: string | null;
  gender: string | null;
  job_level: string | null;
  job_position: string | null;
  manager_id: string | null;
  onboarding_completed: boolean | null;
  organization: string | null;
  role: string | null;
  team_name: string | null;
  updated_at: string;
}

export interface ExtendedProfileInsert {
  id?: string;
  user_id: string;
  age?: number | null;
  avatar_url?: string | null;
  can_manage_teams?: boolean | null;
  can_be_managed?: boolean | null;
  created_at?: string;
  display_name?: string | null;
  email?: string | null;
  full_name?: string | null;
  gender?: string | null;
  job_level?: string | null;
  job_position?: string | null;
  manager_id?: string | null;
  onboarding_completed?: boolean | null;
  organization?: string | null;
  role?: string | null;
  team_name?: string | null;
  updated_at?: string;
}

export interface ExtendedProfileUpdate {
  id?: string;
  user_id?: string;
  age?: number | null;
  avatar_url?: string | null;
  can_manage_teams?: boolean | null;
  can_be_managed?: boolean | null;
  created_at?: string;
  display_name?: string | null;
  email?: string | null;
  full_name?: string | null;
  gender?: string | null;
  job_level?: string | null;
  job_position?: string | null;
  manager_id?: string | null;
  onboarding_completed?: boolean | null;
  organization?: string | null;
  role?: string | null;
  team_name?: string | null;
  updated_at?: string;
}

// Session-related types
export interface SessionData {
  conversation: {
    id: string;
    title: string;
    status: string;
    started_at: string;
    duration_minutes: number;
    max_duration_minutes: number;
  };
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    metadata?: any;
  }>;
  lastActivity: number;
}

// Team member with extended profile
export interface TeamMember {
  id: string;
  member_id: string;
  team_id: string;
  role: string;
  joined_at: string | null;
  profile?: ExtendedProfile;
  can_manage_teams?: boolean;
}