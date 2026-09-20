export type SkillLevel = "beginner" | "intermediate" | "advanced" | "professional";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type RoutineContentType = "routine" | "guide";
export type ScoringType = "points" | "percentage" | "count" | "time";
export type SyncStatus = "synced" | "pending" | "error";
export type MatchType = "casual" | "league" | "tournament" | "practice";
export type MatchFormat = "best_of" | "first_to" | "timed";
export type MatchResult = "win" | "loss" | "draw";
export type MatchRecordingMode = "live" | "manual";
export type TournamentType = "knockout" | "league";
export type TournamentEntryMode = "singles" | "doubles";
export type TournamentPairingMode = "random" | "manual";
export type TournamentFixtureStatus = "pending" | "completed";
export type LiveFrameSide = "user" | "opponent";
export type LiveFrameWinner = "user" | "opponent" | "draw";
export type LiveFrameFoulType = "in_off" | "foul_and_miss" | "push_shot" | "touching_ball" | "wrong_ball" | "other";
export type AnalysisType = "shot" | "stance" | "technique" | "tactical" | "full_session";
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type SubscriptionTier = "free" | "half_century" | "century";

export interface User {
  id: string;
  email: string;
  username?: string;
  profile_image_url?: string;
  avatar_preset?: string;
  country_code?: string;
  bio?: string;
  cue_preference?: string;
  skill_level?: SkillLevel;
  subscription_tier?: SubscriptionTier;
  subscription_anchor_date?: string;
  created_at: string;
  updated_at: string;
}

export interface RoutineCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order_index: number;
  created_at: string;
}

export interface Routine {
  id: string;
  category_id: string;
  category?: RoutineCategory;
  name: string;
  icon?: string;
  summary?: string;
  youtube_video_id?: string;
  youtube_url?: string;
  youtube_title?: string;
  youtube_channel?: string;
  youtube_alt_video_id?: string;
  youtube_alt_url?: string;
  youtube_alt_title?: string;
  youtube_alt_channel?: string;
  description?: string;
  content_type?: RoutineContentType;
  difficulty: DifficultyLevel;
  setup_instructions?: string;
  steps?: string[];
  success_criteria?: string;
  improves?: string[];
  scoring_type: ScoringType;
  max_score?: number;
  estimated_duration_minutes?: number;
  is_system_routine: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  title?: string;
  date: string;
  duration_minutes?: number;
  total_score?: number;
  max_possible_score?: number;
  completion_percentage?: number;
  notes?: string;
  location?: string;
  sync_status: SyncStatus;
  local_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionResult {
  id: string;
  session_id: string;
  routine_id: string;
  routine?: Routine;
  order_index: number;
  score?: number;
  max_score?: number;
  percentage?: number;
  attempts?: number;
  success_count?: number;
  duration_minutes?: number;
  notes?: string;
  created_at: string;
}

export interface Match {
  id: string;
  user_id: string;
  opponent_name: string;
  opponent_id?: string;
  date: string;
  location?: string;
  match_type: MatchType;
  format: MatchFormat;
  target_frames?: number;
  frames_played: number;
  user_score: number;
  opponent_score: number;
  result: MatchResult;
  notes?: string;
  recording_mode?: MatchRecordingMode;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface FrameScore {
  id: string;
  match_id: string;
  frame_number: number;
  user_score: number;
  opponent_score: number;
  winner?: "user" | "opponent";
  user_break?: number;
  opponent_break?: number;
  created_at: string;
}

export interface LiveFrameBreakEntry {
  player: LiveFrameSide;
  points: number;
  endedBy: "visit_end" | "foul" | "switch" | "frame_end";
  timestamp: string;
}

export interface LiveFrameEvent {
  id: string;
  kind: "pot" | "foul" | "visit_end" | "switch" | "re_rack" | "frame_saved";
  timestamp: string;
  player?: LiveFrameSide;
  ball?: "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";
  points?: number;
  foulValue?: 4 | 5 | 6 | 7;
  foulType?: LiveFrameFoulType;
  note?: string;
}

export interface LiveFrameRecord {
  id: string;
  match_id: string;
  frame_number: number;
  user_score: number;
  opponent_score: number;
  winner: LiveFrameWinner;
  highest_break_user: number;
  highest_break_opponent: number;
  breaks: LiveFrameBreakEntry[];
  events: LiveFrameEvent[];
  abandoned?: boolean;
  created_at: string;
}

export interface TournamentFrameScore {
  frame_number: number;
  score_a: number;
  score_b: number;
  winner: "a" | "b" | "draw";
}

export interface TournamentFixture {
  id: string;
  tournament_id: string;
  round_number: number;
  fixture_index: number;
  participant_a: string;
  participant_b: string;
  best_of_frames: number;
  frame_scores?: TournamentFrameScore[];
  score_a?: number;
  score_b?: number;
  winner?: string;
  status: TournamentFixtureStatus;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  tournament_type: TournamentType;
  entry_mode: TournamentEntryMode;
  pairing_mode: TournamentPairingMode;
  best_of_frames: number;
  participants: string[];
  fixtures: TournamentFixture[];
  status: "active" | "completed";
  previous_champion?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AIAnalysis {
  id: string;
  user_id: string;
  video_url: string;
  video_thumbnail_url?: string;
  analysis_type: AnalysisType;
  status: AnalysisStatus;
  context_tags?: string[];
  user_notes?: string;
  feedback?: string;
  recommendations?: string[];
  error_message?: string;
  report_json?: {
    summary: string;
    positives: string[];
    improvements: string[];
    possible_causes: string[];
    not_assessable: string[];
    coaching_tip: string;
  };
  created_at: string;
  updated_at?: string;
}

export interface RoutineScoreEntry {
  id: string;
  routine_id: string;
  routine_name: string;
  score: string;
  notes?: string;
  recorded_at: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  notes?: string;
  routine_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface SessionLogResult {
  routine_id: string;
  score: string;
  notes?: string;
}

export interface SessionLog {
  id: string;
  template_id: string;
  template_name: string;
  date: string;
  recorded_at: string;
  results: SessionLogResult[];
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ProfileModal: undefined;
};

export type AuthStackParamList = {
  Login: { notice?: string; prefillEmail?: string } | undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ConfirmEmail: { email: string };
  UpdatePassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Practice: undefined;
  Sessions: undefined;
  Matches: undefined;
  Stats: undefined;
  AICoach: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
};

export type PracticeStackParamList = {
  RoutineCategories: undefined;
  RoutinesList: { categoryId: string };
  RoutineDetail: { routineId: string };
  RecordRoutineScore: { routineId: string };
  ARRoutineSetup: { routineId: string };
};

export type MatchesStackParamList = {
  MatchesList: undefined;
  OpponentMatches: { opponentName: string };
  MatchDetail: { matchId: string };
  LiveFrameScoring: { matchId: string };
  ARTableCapture: { matchId: string; frameNumber: number };
  NewMatch: { opponentName?: string } | undefined;
  NewTournament:
    | {
        prefill?: {
          name?: string;
          participants: string[];
          tournamentType: TournamentType;
          entryMode: TournamentEntryMode;
          pairingMode: TournamentPairingMode;
          bestOfFrames: number;
          previousChampion?: string;
          autoRunDraw?: boolean;
        };
      }
    | undefined;
  TournamentDetail: { tournamentId: string };
};

export type SessionsStackParamList = {
  SessionsHome: undefined;
  SessionTemplateDetail: { templateId: string };
  SessionSetup: { templateId?: string } | undefined;
  ActiveSession: { templateId: string; date?: string };
  GuidedSessionBuilder: undefined;
};

export type StatsStackParamList = {
  Dashboard: undefined;
};

export type AICoachStackParamList = {
  AIDashboard: undefined;
  VideoUpload: undefined;
  AnalysisDetail: { analysisId: string };
  AnalysisHistory: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  SubscriptionPlans: undefined;
  Achievements: undefined;
  EditProfileField: { field: "skill_level" | "country_code" | "cue_preference" };
};
