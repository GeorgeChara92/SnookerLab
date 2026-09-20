/**
 * Design tokens.
 *
 * The palette is taken from the table itself: baize for surfaces, brass for the premium
 * moments (Pro, achievements, personal bests) and the seven ball colours as a semantic set,
 * so a category or a stat can be coloured by meaning rather than by decoration.
 */

export type BallColourName = "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black" | "cue";

export type BallColour = {
  /** The ball itself. */
  base: string;
  /** Text or icon drawn on top of the ball. */
  on: string;
  /** A muted wash of the ball colour, for tiles and chips behind content. */
  wash: string;
};

export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  /** One step above `surface`, for a card that needs to sit on top of another card. */
  surfaceRaised: string;
  text: string;
  textMuted: string;
  /** For captions and metadata that should recede further than textMuted. */
  textSubtle: string;
  border: string;
  /** A stronger border for controls and focus states. */
  borderStrong: string;
  primary: string;
  primaryStrong: string;
  onPrimary: string;
  /** Brass. Reserved for premium and achievement moments, never for routine actions. */
  accent: string;
  onAccent: string;
  accentWash: string;
  danger: string;
  onDanger: string;
  success: string;
  warning: string;
  tabBar: string;
  tabInactive: string;
  balls: Record<BallColourName, BallColour>;
};

/** Ball colours as they read on a lit table, tuned for contrast rather than realism. */
const LIGHT_BALLS: Record<BallColourName, BallColour> = {
  red: { base: "#C8102E", on: "#FFFFFF", wash: "#FBE9EC" },
  yellow: { base: "#E8B10B", on: "#2A2400", wash: "#FCF3DC" },
  green: { base: "#1E7A46", on: "#FFFFFF", wash: "#E4F1EA" },
  brown: { base: "#7A4B2A", on: "#FFFFFF", wash: "#F1E8E2" },
  blue: { base: "#1763B6", on: "#FFFFFF", wash: "#E4EDF9" },
  pink: { base: "#DB6E9E", on: "#FFFFFF", wash: "#FBEAF2" },
  black: { base: "#14181A", on: "#FFFFFF", wash: "#E7E9EA" },
  cue: { base: "#F7F4EC", on: "#14181A", wash: "#FBFAF5" },
};

const DARK_BALLS: Record<BallColourName, BallColour> = {
  red: { base: "#E2596B", on: "#2B0A10", wash: "#2E1A1D" },
  yellow: { base: "#F2C230", on: "#2A2400", wash: "#2E2A17" },
  green: { base: "#3FB277", on: "#042416", wash: "#152D22" },
  brown: { base: "#B08563", on: "#25130A", wash: "#2A211A" },
  blue: { base: "#5E9BE8", on: "#0A1C33", wash: "#182533" },
  pink: { base: "#EC8FB7", on: "#33101F", wash: "#2F1F27" },
  black: { base: "#8C979B", on: "#0B0E0F", wash: "#1D2224" },
  cue: { base: "#F2EFE6", on: "#14181A", wash: "#262A28" },
};

export const LIGHT_COLORS: AppColors = {
  background: "#EDF3F0",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F9F7",
  surfaceRaised: "#FFFFFF",
  text: "#102A24",
  textMuted: "#5A6F68",
  textSubtle: "#7C8F89",
  border: "#D4DFDA",
  borderStrong: "#BCD0C9",
  primary: "#0F5A43",
  primaryStrong: "#0A4634",
  onPrimary: "#FFFFFF",
  accent: "#A07A16",
  onAccent: "#FFFFFF",
  accentWash: "#F7EFD9",
  danger: "#B42318",
  onDanger: "#FFFFFF",
  success: "#1E7A46",
  warning: "#B4690E",
  tabBar: "#FFFFFF",
  tabInactive: "#6D7F78",
  balls: LIGHT_BALLS,
};

export const DARK_COLORS: AppColors = {
  background: "#0B1714",
  surface: "#13211D",
  surfaceMuted: "#1C2E28",
  surfaceRaised: "#1A2B26",
  text: "#ECF5F1",
  textMuted: "#AABCB5",
  textSubtle: "#879A93",
  border: "#2A3E37",
  borderStrong: "#3A5249",
  primary: "#3CC18E",
  primaryStrong: "#2DA777",
  onPrimary: "#05261C",
  accent: "#D8B24C",
  onAccent: "#241A04",
  accentWash: "#2A2416",
  danger: "#E05D51",
  onDanger: "#1A0F0D",
  success: "#3FB277",
  warning: "#E0A33F",
  tabBar: "#13211D",
  tabInactive: "#8FA59D",
  balls: DARK_BALLS,
};

export const getThemeColors = (isDark: boolean) => (isDark ? DARK_COLORS : LIGHT_COLORS);

export const COLORS = LIGHT_COLORS;

/** 4pt grid. Use these instead of loose numbers so rhythm stays consistent across screens. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * How wide a ball is drawn on a routine diagram, as a fraction of the table's width.
 *
 * The drill data and the renderer share this one number, so balls the data places a ball apart
 * are drawn exactly touching. A real ball is nearer 3% of the bed, but that is too small to read
 * on a phone, so the whole diagram is drawn at this slightly generous scale.
 */
export const DIAGRAM_BALL_WIDTH = 0.048;

/** The same ball measured along the table, which is twice as long as it is wide. */
export const DIAGRAM_BALL_LENGTH = DIAGRAM_BALL_WIDTH / 2;

/**
 * The scrim behind every dialog and sheet. Near-black with a trace of green, so the table
 * cloth reads through it rather than a flat grey. One value, so nothing looks out of place.
 */
export const SCRIM = "rgba(4, 10, 8, 0.72)";

/**
 * Type scale. `score` is the scoreboard voice: tabular figures so digits do not jump
 * as a break climbs, used for scores, breaks and headline stats.
 */
export const TYPE = {
  display: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  score: { fontSize: 34, fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -1 },
  scoreSmall: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
} as const;

/** Minimum touch target. Anything tappable should reach this, padding included. */
export const HIT_TARGET = 44;

/** Which ball speaks for each practice category, so colour carries meaning. */
export const CATEGORY_BALL: Record<string, BallColourName> = {
  "cat-basics": "green",
  "cat-break-building": "black",
  "cat-safety": "brown",
  "cat-straight-cueing": "cue",
  "cat-cue-ball-control": "blue",
  "cat-long-potting": "pink",
};

export const getCategoryBall = (categoryId: string): BallColourName => CATEGORY_BALL[categoryId] ?? "red";
