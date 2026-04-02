export type PresetAvatar = {
  id: string;
  label: string;
  group?: "player" | "snooker";
  tag?: string;
};

export const SNOOKER_PRESET_AVATARS: PresetAvatar[] = [
  { id: "player-pro", label: "Crucible Contender", group: "player", tag: "Matchplay" },
  { id: "player-classic", label: "Baize Technician", group: "player", tag: "Technique" },
  { id: "player-ace", label: "Cue Artist", group: "player", tag: "Flair" },
  { id: "player-captain", label: "Match Captain", group: "player", tag: "Leadership" },
  { id: "black-ball", label: "Black Ball Specialist", group: "snooker", tag: "Colours" },
  { id: "pack-reds", label: "Pack Splitter", group: "snooker", tag: "Break Building" },
  { id: "trophy-cue", label: "Frame Winner", group: "snooker", tag: "Matchplay" },
  { id: "corner-pot", label: "Long Pot Specialist", group: "snooker", tag: "Potting" },
  { id: "cue-master", label: "Cue Action", group: "snooker", tag: "Technique" },
  { id: "scoreboard", label: "Frame Tracker", group: "snooker", tag: "Scoring" },
  { id: "safety-first", label: "Safety Exchange", group: "snooker", tag: "Tactical" },
  { id: "match-medal", label: "Ranking Event", group: "snooker", tag: "Tour" },
  { id: "frame-race", label: "Decider Nerves", group: "snooker", tag: "Pressure" },
  { id: "break-builder", label: "Century Chase", group: "snooker", tag: "Break Building" },
  { id: "time-pressure", label: "Shot Clock", group: "snooker", tag: "Tempo" },
  { id: "focus-mode", label: "Baulk Line Focus", group: "snooker", tag: "Control" },
  { id: "rest-play", label: "Rest Specialist", group: "snooker", tag: "Technique" },
  { id: "screw-back", label: "Screw Back", group: "snooker", tag: "Cue Ball" },
  { id: "stun-run", label: "Stun Through", group: "snooker", tag: "Cue Ball" },
  { id: "double-kiss", label: "Two Cushion Escape", group: "snooker", tag: "Escape" },
  { id: "thin-cut", label: "Thin Cut", group: "snooker", tag: "Potting" },
  { id: "final-black", label: "Final Black", group: "snooker", tag: "Matchplay" },
];

export const getPresetAvatarId = (avatarId?: string) => {
  if (!avatarId) return "black-ball";
  if (avatarId === "target-pot") return "corner-pot";
  if (avatarId === "green-baize") return "focus-mode";
  return SNOOKER_PRESET_AVATARS.find((item) => item.id === avatarId)?.id ?? "black-ball";
};
