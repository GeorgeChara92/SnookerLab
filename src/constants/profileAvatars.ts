export type PresetAvatar = {
  id: string;
  label: string;
  group?: "player" | "snooker";
  tag?: string;
  unlockCondition?: {
    type: "matches_won" | "matches_played" | "best_break" | "sessions_logged" | "win_rate" | "win_streak" | "level";
    value: number;
  };
  description?: string;
};

export const SNOOKER_PRESET_AVATARS: PresetAvatar[] = [
  //Player avatars - progression based
  {
    id: "player-pro",
    label: "Rookie",
    group: "player",
    tag: "Starter",
    unlockCondition: { type: "level", value: 1 },
    description: "Default avatar for new players",
  },
  {
    id: "player-classic",
    label: "Club Player",
    group: "player",
    tag: "Progress",
    unlockCondition: { type: "sessions_logged", value: 5 },
    description: "Complete5 practice sessions",
  },
  {
    id: "player-ace",
    label: "Century Player",
    group: "player",
    tag: "Scoring",
    unlockCondition: { type: "best_break", value: 50 },
    description: "Record a break of 50+ points",
  },
  {
    id: "player-captain",
    label: "Tour Contender",
    group: "player",
    tag: "Elite",
    unlockCondition: { type: "matches_won", value: 20 },
    description: "Win 20 matches",
  },
  // Snooker icons - unlockable achievements
  {
    id: "black-ball",
    label: "Black Ball Specialist",
    group: "snooker",
    tag: "Colours",
    description: "Available from start",
  },
  {
    id: "pack-reds",
    label: "Pack Splitter",
    group: "snooker",
    tag: "Break Building",
    unlockCondition: { type: "sessions_logged", value: 3 },
    description: "Complete 3 practice sessions",
  },
  {
    id: "trophy-cue",
    label: "Frame Winner",
    group: "snooker",
    tag: "Matchplay",
    unlockCondition: { type: "matches_won", value: 1 },
    description: "Win your first match",
  },
  {
    id: "corner-pot",
    label: "Long Pot Specialist",
    group: "snooker",
    tag: "Potting",
    unlockCondition: { type: "sessions_logged", value: 10 },
    description: "Complete 10 practice sessions",
  },
  {
    id: "cue-master",
    label: "Cue Action",
    group: "snooker",
    tag: "Technique",
    unlockCondition: { type: "sessions_logged", value: 15 },
    description: "Complete 15 practice sessions",
  },
  {
    id: "scoreboard",
    label: "Frame Tracker",
    group: "snooker",
    tag: "Scoring",
    unlockCondition: { type: "matches_played", value: 5 },
    description: "Play 5 matches",
  },
  {
    id: "safety-first",
    label: "Safety Exchange",
    group: "snooker",
    tag: "Tactical",
    unlockCondition: { type: "sessions_logged", value: 20 },
    description: "Complete 20 practice sessions",
  },
  {
    id: "match-medal",
    label: "Ranking Event",
    group: "snooker",
    tag: "Tour",
    unlockCondition: { type: "matches_won", value: 5 },
    description: "Win 5 matches",
  },
  {
    id: "frame-race",
    label: "Decider Nerves",
    group: "snooker",
    tag: "Pressure",
    unlockCondition: { type: "win_streak", value: 3 },
    description: "Win 3 matches in a row",
  },
  {
    id: "break-builder",
    label: "Century Chase",
    group: "snooker",
    tag: "Break Building",
    unlockCondition: { type: "best_break", value: 30 },
    description: "Record a break of 30+ points",
  },
  {
    id: "time-pressure",
    label: "Shot Clock",
    group: "snooker",
    tag: "Tempo",
    unlockCondition: { type: "sessions_logged", value: 25 },
    description: "Complete 25 practice sessions",
  },
  {
    id: "focus-mode",
    label: "Baulk Line Focus",
    group: "snooker",
    tag: "Control",
    unlockCondition: { type: "sessions_logged", value: 30 },
    description: "Complete 30 practice sessions",
  },
  {
    id: "rest-play",
    label: "Rest Specialist",
    group: "snooker",
    tag: "Technique",
    unlockCondition: { type: "sessions_logged", value: 40 },
    description: "Complete 40 practice sessions",
  },
  {
    id: "screw-back",
    label: "Screw Back",
    group: "snooker",
    tag: "Cue Ball",
    unlockCondition: { type: "best_break", value: 40 },
    description: "Record a break of 40+ points",
  },
  {
    id: "stun-run",
    label: "Stun Through",
    group: "snooker",
    tag: "Cue Ball",
    unlockCondition: { type: "sessions_logged", value: 50 },
    description: "Complete 50 practice sessions",
  },
  {
    id: "double-kiss",
    label: "Two Cushion Escape",
    group: "snooker",
    tag: "Escape",
    unlockCondition: { type: "matches_played", value: 15 },
    description: "Play 15 matches",
  },
  {
    id: "thin-cut",
    label: "Thin Cut",
    group: "snooker",
    tag: "Potting",
    unlockCondition: { type: "sessions_logged", value: 60 },
    description: "Complete 60 practice sessions",
  },
  {
    id: "final-black",
    label: "Final Black",
    group: "snooker",
    tag: "Matchplay",
    unlockCondition: { type: "matches_won", value: 25 },
    description: "Win 25 matches",
  },
  {
    id: "triple-crown",
    label: "Triple Crown",
    group: "snooker",
    tag: "Legacy",
    unlockCondition: { type: "matches_won", value: 50 },
    description: "Win 50 matches",
  },
  {
    id: "masters-room",
    label: "Masters Room",
    group: "snooker",
    tag: "Prestige",
    unlockCondition: { type: "best_break", value: 75 },
    description: "Record a break of 75+ points",
  },
  {
    id: "champion-seal",
    label: "Champion Seal",
    group: "snooker",
    tag: "Elite",
    unlockCondition: { type: "win_streak", value: 5 },
    description: "Win 5 matches in a row",
  },
  {
    id: "spotlight-table",
    label: "Spotlight Table",
    group: "snooker",
    tag: "Focus",
    unlockCondition: { type: "best_break", value: 100 },
    description: "Record a century break",
  },
];

export const getPresetAvatarId = (avatarId?: string) => {
  if (!avatarId) return "black-ball";
  if (avatarId === "target-pot") return "corner-pot";
  if (avatarId === "green-baize") return "focus-mode";
  return SNOOKER_PRESET_AVATARS.find((item) => item.id === avatarId)?.id ?? "black-ball";
};

export const isAvatarUnlocked = (
  avatar: PresetAvatar,
  stats: {
    matchesWon: number;
    matchesPlayed: number;
    sessionsLogged: number;
    bestBreak: number;
    longestWinStreak: number;
    playerLevel: number;
  }
): boolean => {
  if (!avatar.unlockCondition) return true;

  const { type, value } = avatar.unlockCondition;

  switch (type) {
    case "matches_won":
      return stats.matchesWon >= value;
    case "matches_played":
      return stats.matchesPlayed >= value;
    case "sessions_logged":
      return stats.sessionsLogged >= value;
    case "best_break":
      return stats.bestBreak >= value;
    case "win_streak":
      return stats.longestWinStreak >= value;
    case "level":
      return stats.playerLevel >= value;
    case "win_rate":
      return false; // Not tracked yet
    default:
      return true;
  }
};