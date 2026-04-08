import { MaterialCommunityIcons as Icons } from "@expo/vector-icons";

export type AchievementCategory = "matches" | "breaks" | "practice" | "streaks" | "special";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Icons.glyphMap;
  category: AchievementCategory;
  requirement: {
    type: "matches_won" | "matches_played" | "best_break" | "sessions_logged" | "win_streak" | "practice_streak" | "centuries" | "routine_completion";
    value: number;
  };
  tier: "bronze" | "silver" | "gold" | "platinum";
  xpReward: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Match achievements
  {
    id: "first_win",
    title: "First Victory",
    description: "Win your first match",
    icon: "trophy",
    category: "matches",
    requirement: { type: "matches_won", value: 1 },
    tier: "bronze",
    xpReward: 50,
  },
  {
    id: "match_winner",
    title: "Match Winner",
    description: "Win 10 matches",
    icon: "trophy-outline",
    category: "matches",
    requirement: { type: "matches_won", value: 10 },
    tier: "silver",
    xpReward: 150,
  },
  {
    id: "match_master",
    title: "Match Master",
    description: "Win 50 matches",
    icon: "trophy-variant",
    category: "matches",
    requirement: { type: "matches_won", value: 50 },
    tier: "gold",
    xpReward: 500,
  },
  {
    id: "century_winner",
    title: "Century Champion",
    description: "Win 100 matches",
    icon: "trophy-variant-outline",
    category: "matches",
    requirement: { type: "matches_won", value: 100 },
    tier: "platinum",
    xpReward: 1000,
  },
  // Practice achievements
  {
    id: "first_session",
    title: "First Steps",
    description: "Log your first practice session",
    icon: "clipboard-check",
    category: "practice",
    requirement: { type: "sessions_logged", value: 1 },
    tier: "bronze",
    xpReward: 25,
  },
  {
    id: "regular_player",
    title: "Regular Player",
    description: "Complete 10 practice sessions",
    icon: "calendar-check",
    category: "practice",
    requirement: { type: "sessions_logged", value: 10 },
    tier: "silver",
    xpReward: 100,
  },
  {
    id: "dedicated_player",
    title: "Dedicated Player",
    description: "Complete 50 practice sessions",
    icon: "calendar-star",
    category: "practice",
    requirement: { type: "sessions_logged", value: 50 },
    tier: "gold",
    xpReward: 400,
  },
  {
    id: "practice_veteran",
    title: "Practice Veteran",
    description: "Complete 100 practice sessions",
    icon: "calendar-clock",
    category: "practice",
    requirement: { type: "sessions_logged", value: 100 },
    tier: "platinum",
    xpReward: 800,
  },
  // Break achievements
  {
    id: "first_break",
    title: "First Break",
    description: "Record a break of 20+ points",
    icon: "chart-line",
    category: "breaks",
    requirement: { type: "best_break", value: 20 },
    tier: "bronze",
    xpReward: 30,
  },
  {
    id: "half_century_break",
    title: "Half Century",
    description: "Record a break of 50+ points",
    icon: "chart-bell-curve",
    category: "breaks",
    requirement: { type: "best_break", value: 50 },
    tier: "silver",
    xpReward: 100,
  },
  {
    id: "century_break",
    title: "Century Maker",
    description: "Record a break of 100+ points",
    icon: "star",
    category: "breaks",
    requirement: { type: "best_break", value: 100 },
    tier: "gold",
    xpReward: 300,
  },
  {
    id: "century_master",
    title: "Century Master",
    description: "Record 10 century breaks",
    icon: "star-circle",
    category: "breaks",
    requirement: { type: "centuries", value: 10 },
    tier: "platinum",
    xpReward: 1000,
  },
  // Streak achievements
  {
    id: "winning_streak",
    title: "On Fire",
    description: "Win 3 matches in a row",
    icon: "fire",
    category: "streaks",
    requirement: { type: "win_streak", value: 3 },
    tier: "bronze",
    xpReward: 50,
  },
  {
    id: "hot_streak",
    title: "Hot Streak",
    description: "Win 5 matches in a row",
    icon: "fire",
    category: "streaks",
    requirement: { type: "win_streak", value: 5 },
    tier: "silver",
    xpReward: 150,
  },
  {
    id: "unstoppable",
    title: "Unstoppable",
    description: "Win 10 matches in a row",
    icon: "lightning-bolt",
    category: "streaks",
    requirement: { type: "win_streak", value: 10 },
    tier: "gold",
    xpReward: 500,
  },
  {
    id: "practice_streak",
    title: "Consistent Practice",
    description: "Practice 5 days in a row",
    icon: "calendar-multiselect",
    category: "streaks",
    requirement: { type: "practice_streak", value: 5 },
    tier: "bronze",
    xpReward: 75,
  },
  {
    id: "practice_dedication",
    title: "Dedication",
    description: "Practice 14 days in a row",
    icon: "calendar-month",
    category: "streaks",
    requirement: { type: "practice_streak", value: 14 },
    tier: "silver",
    xpReward: 200,
  },
  // Special achievements
  {
    id: "routine_explorer",
    title: "Routine Explorer",
    description: "Try 10 different routines",
    icon: "compass",
    category: "special",
    requirement: { type: "routine_completion", value: 10 },
    tier: "silver",
    xpReward: 100,
  },
  {
    id: "routine_master",
    title: "Routine Master",
    description: "Complete all routines at least once",
    icon: "check-all",
    category: "special",
    requirement: { type: "routine_completion", value: 25 },
    tier: "gold",
    xpReward: 400,
  },
  {
    id: "first_match",
    title: "First Match",
    description: "Play your first match",
    icon: "billiards",
    category: "matches",
    requirement: { type: "matches_played", value: 1 },
    tier: "bronze",
    xpReward: 25,
  },
  {
    id: "tournament_player",
    title: "Tournament Player",
    description: "Play 25 matches",
    icon: "tournament",
    category: "matches",
    requirement: { type: "matches_played", value: 25 },
    tier: "silver",
    xpReward: 200,
  },
];

export const getAchievementById = (id: string): Achievement | undefined => {
  return ACHIEVEMENTS.find((a) => a.id === id);
};

export const getAchievementsByCategory = (category: AchievementCategory): Achievement[] => {
  return ACHIEVEMENTS.filter((a) => a.category === category);
};

export const getPlayerLevel = (xp: number): { level: number; title: string; xpToNext: number } => {
  const levels = [
    { xp: 0, title: "Rookie" },
    { xp: 100, title: "Beginner" },
    { xp: 250, title: "Club Player" },
    { xp: 500, title: "Regular" },
    { xp: 1000, title: "Skilled" },
    { xp: 2000, title: "Advanced" },
    { xp: 4000, title: "Expert" },
    { xp: 7500, title: "Master" },
    { xp: 12000, title: "Champion" },
    { xp: 20000, title: "Legend" },
  ];

  let currentLevel = 0;
  let currentTitle = levels[0].title;
  let xpToNext = levels[1]?.xp ?? Infinity;

  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i].xp) {
      currentLevel = i + 1;
      currentTitle = levels[i].title;
      xpToNext = levels[i + 1]?.xp ? levels[i + 1].xp - xp : Infinity;
    } else {
      break;
    }
  }

  return { level: currentLevel, title: currentTitle, xpToNext };
};