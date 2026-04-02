export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryStrong: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  tabBar: string;
  tabInactive: string;
};

export const LIGHT_COLORS: AppColors = {
  background: "#EDF3F0",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F9F7",
  text: "#102A24",
  textMuted: "#5A6F68",
  border: "#D4DFDA",
  primary: "#0F5A43",
  primaryStrong: "#0A4634",
  onPrimary: "#FFFFFF",
  danger: "#B42318",
  onDanger: "#FFFFFF",
  tabBar: "#FFFFFF",
  tabInactive: "#6D7F78",
};

export const DARK_COLORS: AppColors = {
  background: "#0E1714",
  surface: "#15231F",
  surfaceMuted: "#1C2E28",
  text: "#ECF5F1",
  textMuted: "#AABCB5",
  border: "#2A3E37",
  primary: "#3CC18E",
  primaryStrong: "#2DA777",
  onPrimary: "#05261C",
  danger: "#E05D51",
  onDanger: "#1A0F0D",
  tabBar: "#15231F",
  tabInactive: "#8FA59D",
};

export const getThemeColors = (isDark: boolean) => (isDark ? DARK_COLORS : LIGHT_COLORS);

export const COLORS = LIGHT_COLORS;
