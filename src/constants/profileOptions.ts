import type { SkillLevel } from "../types";

export type Country = {
  code: string;
  name: string;
  emoji: string;
};

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", emoji: "🇦🇫" },
  { code: "AL", name: "Albania", emoji: "🇦🇱" },
  { code: "DZ", name: "Algeria", emoji: "🇩🇿" },
  { code: "AD", name: "Andorra", emoji: "🇦🇩" },
  { code: "AO", name: "Angola", emoji: "🇦🇴" },
  { code: "AG", name: "Antigua and Barbuda", emoji: "🇦🇬" },
  { code: "AR", name: "Argentina", emoji: "🇦🇷" },
  { code: "AM", name: "Armenia", emoji: "🇦🇲" },
  { code: "AU", name: "Australia", emoji: "🇦🇺" },
  { code: "AT", name: "Austria", emoji: "🇦🇹" },
  { code: "AZ", name: "Azerbaijan", emoji: "🇦🇿" },
  { code: "BS", name: "Bahamas", emoji: "🇧🇸" },
  { code: "BH", name: "Bahrain", emoji: "🇧🇭" },
  { code: "BD", name: "Bangladesh", emoji: "🇧🇩" },
  { code: "BB", name: "Barbados", emoji: "🇧🇧" },
  { code: "BY", name: "Belarus", emoji: "🇧🇾" },
  { code: "BE", name: "Belgium", emoji: "🇧🇪" },
  { code: "BZ", name: "Belize", emoji: "🇧🇿" },
  { code: "BJ", name: "Benin", emoji: "🇧🇯" },
  { code: "BT", name: "Bhutan", emoji: "🇧🇹" },
  { code: "BO", name: "Bolivia", emoji: "🇧🇴" },
  { code: "BA", name: "Bosnia and Herzegovina", emoji: "🇧🇦" },
  { code: "BW", name: "Botswana", emoji: "🇧🇼" },
  { code: "BR", name: "Brazil", emoji: "🇧🇷" },
  { code: "BN", name: "Brunei", emoji: "🇧🇳" },
  { code: "BG", name: "Bulgaria", emoji: "🇧🇬" },
  { code: "BF", name: "Burkina Faso", emoji: "🇧🇫" },
  { code: "BI", name: "Burundi", emoji: "🇧🇮" },
  { code: "CV", name: "Cabo Verde", emoji: "🇨🇻" },
  { code: "KH", name: "Cambodia", emoji: "🇰🇭" },
  { code: "CM", name: "Cameroon", emoji: "🇨🇲" },
  { code: "CA", name: "Canada", emoji: "🇨🇦" },
  { code: "CF", name: "Central African Republic", emoji: "🇨🇫" },
  { code: "TD", name: "Chad", emoji: "🇹🇩" },
  { code: "CL", name: "Chile", emoji: "🇨🇱" },
  { code: "CN", name: "China", emoji: "🇨🇳" },
  { code: "CO", name: "Colombia", emoji: "🇨🇴" },
  { code: "KM", name: "Comoros", emoji: "🇰🇲" },
  { code: "CG", name: "Congo", emoji: "🇨🇬" },
  { code: "CD", name: "Congo (Democratic Republic)", emoji: "🇨🇩" },
  { code: "CR", name: "Costa Rica", emoji: "🇨🇷" },
  { code: "CI", name: "Côte d'Ivoire", emoji: "🇨🇮" },
  { code: "HR", name: "Croatia", emoji: "🇭🇷" },
  { code: "CU", name: "Cuba", emoji: "🇨🇺" },
  { code: "CY", name: "Cyprus", emoji: "🇨🇾" },
  { code: "CZ", name: "Czech Republic", emoji: "🇨🇿" },
  { code: "DK", name: "Denmark", emoji: "🇩🇰" },
  { code: "DJ", name: "Djibouti", emoji: "🇩🇯" },
  { code: "DM", name: "Dominica", emoji: "🇩🇲" },
  { code: "DO", name: "Dominican Republic", emoji: "🇩🇴" },
  { code: "EC", name: "Ecuador", emoji: "🇪🇨" },
  { code: "EG", name: "Egypt", emoji: "🇪🇬" },
  { code: "SV", name: "El Salvador", emoji: "🇸🇻" },
  { code: "GQ", name: "Equatorial Guinea", emoji: "🇬🇶" },
  { code: "ER", name: "Eritrea", emoji: "🇪🇷" },
  { code: "EE", name: "Estonia", emoji: "🇪🇪" },
  { code: "SZ", name: "Eswatini", emoji: "🇸🇿" },
  { code: "ET", name: "Ethiopia", emoji: "🇪🇹" },
  { code: "FJ", name: "Fiji", emoji: "🇫🇯" },
  { code: "FI", name: "Finland", emoji: "🇫🇮" },
  { code: "FR", name: "France", emoji: "🇫🇷" },
  { code: "GA", name: "Gabon", emoji: "🇬🇦" },
  { code: "GM", name: "Gambia", emoji: "🇬🇲" },
  { code: "GE", name: "Georgia", emoji: "🇬🇪" },
  { code: "DE", name: "Germany", emoji: "🇩🇪" },
  { code: "GH", name: "Ghana", emoji: "🇬🇭" },
  { code: "GR", name: "Greece", emoji: "🇬🇷" },
  { code: "GD", name: "Grenada", emoji: "🇬🇩" },
  { code: "GT", name: "Guatemala", emoji: "🇬🇹" },
  { code: "GN", name: "Guinea", emoji: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau", emoji: "🇬🇼" },
  { code: "GY", name: "Guyana", emoji: "🇬🇾" },
  { code: "HT", name: "Haiti", emoji: "🇭🇹" },
  { code: "HN", name: "Honduras", emoji: "🇭🇳" },
  { code: "HU", name: "Hungary", emoji: "🇭🇺" },
  { code: "IS", name: "Iceland", emoji: "🇮🇸" },
  { code: "IN", name: "India", emoji: "🇮🇳" },
  { code: "ID", name: "Indonesia", emoji: "🇮🇩" },
  { code: "IR", name: "Iran", emoji: "🇮🇷" },
  { code: "IQ", name: "Iraq", emoji: "🇮🇶" },
  { code: "IE", name: "Ireland", emoji: "🇮🇪" },
  { code: "IL", name: "Israel", emoji: "🇮🇱" },
  { code: "IT", name: "Italy", emoji: "🇮🇹" },
  { code: "JM", name: "Jamaica", emoji: "🇯🇲" },
  { code: "JP", name: "Japan", emoji: "🇯🇵" },
  { code: "JO", name: "Jordan", emoji: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", emoji: "🇰🇿" },
  { code: "KE", name: "Kenya", emoji: "🇰🇪" },
  { code: "KI", name: "Kiribati", emoji: "🇰🇮" },
  { code: "KP", name: "North Korea", emoji: "🇰🇵" },
  { code: "KR", name: "South Korea", emoji: "🇰🇷" },
  { code: "KW", name: "Kuwait", emoji: "🇰🇼" },
  { code: "KG", name: "Kyrgyzstan", emoji: "🇰🇬" },
  { code: "LA", name: "Laos", emoji: "🇱🇦" },
  { code: "LV", name: "Latvia", emoji: "🇱🇻" },
  { code: "LB", name: "Lebanon", emoji: "🇱🇧" },
  { code: "LS", name: "Lesotho", emoji: "🇱🇸" },
  { code: "LR", name: "Liberia", emoji: "🇱🇷" },
  { code: "LY", name: "Libya", emoji: "🇱🇾" },
  { code: "LI", name: "Liechtenstein", emoji: "🇱🇮" },
  { code: "LT", name: "Lithuania", emoji: "🇱🇹" },
  { code: "LU", name: "Luxembourg", emoji: "🇱🇺" },
  { code: "MG", name: "Madagascar", emoji: "🇲🇬" },
  { code: "MW", name: "Malawi", emoji: "🇲🇼" },
  { code: "MY", name: "Malaysia", emoji: "🇲🇾" },
  { code: "MV", name: "Maldives", emoji: "🇲🇻" },
  { code: "ML", name: "Mali", emoji: "🇲🇱" },
  { code: "MT", name: "Malta", emoji: "🇲🇹" },
  { code: "MH", name: "Marshall Islands", emoji: "🇲🇭" },
  { code: "MR", name: "Mauritania", emoji: "🇲🇷" },
  { code: "MU", name: "Mauritius", emoji: "🇲🇺" },
  { code: "MX", name: "Mexico", emoji: "🇲🇽" },
  { code: "FM", name: "Micronesia", emoji: "🇫🇲" },
  { code: "MD", name: "Moldova", emoji: "🇲🇩" },
  { code: "MC", name: "Monaco", emoji: "🇲🇨" },
  { code: "MN", name: "Mongolia", emoji: "🇲🇳" },
  { code: "ME", name: "Montenegro", emoji: "🇲🇪" },
  { code: "MA", name: "Morocco", emoji: "🇲🇦" },
  { code: "MZ", name: "Mozambique", emoji: "🇲🇿" },
  { code: "MM", name: "Myanmar", emoji: "🇲🇲" },
  { code: "NA", name: "Namibia", emoji: "🇳🇦" },
  { code: "NR", name: "Nauru", emoji: "🇳🇷" },
  { code: "NP", name: "Nepal", emoji: "🇳🇵" },
  { code: "NL", name: "Netherlands", emoji: "🇳🇱" },
  { code: "NZ", name: "New Zealand", emoji: "🇳🇿" },
  { code: "NI", name: "Nicaragua", emoji: "🇳🇮" },
  { code: "NE", name: "Niger", emoji: "🇳🇪" },
  { code: "NG", name: "Nigeria", emoji: "🇳🇬" },
  { code: "MK", name: "North Macedonia", emoji: "🇲🇰" },
  { code: "NO", name: "Norway", emoji: "🇳🇴" },
  { code: "OM", name: "Oman", emoji: "🇴🇲" },
  { code: "PK", name: "Pakistan", emoji: "🇵🇰" },
  { code: "PW", name: "Palau", emoji: "🇵🇼" },
  { code: "PS", name: "Palestine", emoji: "🇵🇸" },
  { code: "PA", name: "Panama", emoji: "🇵🇦" },
  { code: "PG", name: "Papua New Guinea", emoji: "🇵🇬" },
  { code: "PY", name: "Paraguay", emoji: "🇵🇾" },
  { code: "PE", name: "Peru", emoji: "🇵🇪" },
  { code: "PH", name: "Philippines", emoji: "🇵🇭" },
  { code: "PL", name: "Poland", emoji: "🇵🇱" },
  { code: "PT", name: "Portugal", emoji: "🇵🇹" },
  { code: "QA", name: "Qatar", emoji: "🇶🦶" },
  { code: "RO", name: "Romania", emoji: "🇷🇴" },
  { code: "RU", name: "Russia", emoji: "🇷🇺" },
  { code: "RW", name: "Rwanda", emoji: "🇷🇼" },
  { code: "KN", name: "Saint Kitts and Nevis", emoji: "🇰🇳" },
  { code: "LC", name: "Saint Lucia", emoji: "🇱🇨" },
  { code: "VC", name: "Saint Vincent and the Grenadines", emoji: "🇻🇨" },
  { code: "WS", name: "Samoa", emoji: "🇼🇸" },
  { code: "SM", name: "San Marino", emoji: "🇸🇲" },
  { code: "ST", name: "Sao Tome and Principe", emoji: "🇸🇹" },
  { code: "SA", name: "Saudi Arabia", emoji: "🇸🇦" },
  { code: "SN", name: "Senegal", emoji: "🇸🇳" },
  { code: "RS", name: "Serbia", emoji: "🇷🇸" },
  { code: "SC", name: "Seychelles", emoji: "🇸🇨" },
  { code: "SL", name: "Sierra Leone", emoji: "🇸🇱" },
  { code: "SG", name: "Singapore", emoji: "🇸🇬" },
  { code: "SK", name: "Slovakia", emoji: "🇸🇰" },
  { code: "SI", name: "Slovenia", emoji: "🇸🇮" },
  { code: "SB", name: "Solomon Islands", emoji: "🇸🇧" },
  { code: "SO", name: "Somalia", emoji: "🇸🇴" },
  { code: "ZA", name: "South Africa", emoji: "🇿🇦" },
  { code: "SS", name: "South Sudan", emoji: "🇸🇸" },
  { code: "ES", name: "Spain", emoji: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", emoji: "🇱🇰" },
  { code: "SD", name: "Sudan", emoji: "🇸🇩" },
  { code: "SR", name: "Suriname", emoji: "🇸🇷" },
  { code: "SE", name: "Sweden", emoji: "🇸🇪" },
  { code: "CH", name: "Switzerland", emoji: "🇨🇭" },
  { code: "SY", name: "Syria", emoji: "🇸🇾" },
  { code: "TW", name: "Taiwan", emoji: "🇹🇼" },
  { code: "TJ", name: "Tajikistan", emoji: "🇹🇯" },
  { code: "TZ", name: "Tanzania", emoji: "🇹🇿" },
  { code: "TH", name: "Thailand", emoji: "🇹🇭" },
  { code: "TL", name: "Timor-Leste", emoji: "🇹🇱" },
  { code: "TG", name: "Togo", emoji: "🇹🇬" },
  { code: "TO", name: "Tonga", emoji: "🇹🇴" },
  { code: "TT", name: "Trinidad and Tobago", emoji: "🇹🇹" },
  { code: "TN", name: "Tunisia", emoji: "🇹🇳" },
  { code: "TR", name: "Turkey", emoji: "🇹🇷" },
  { code: "TM", name: "Turkmenistan", emoji: "🇹🇲" },
  { code: "TV", name: "Tuvalu", emoji: "🇹🇻" },
  { code: "UG", name: "Uganda", emoji: "🇺🇬" },
  { code: "UA", name: "Ukraine", emoji: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", emoji: "🇦🇪" },
  { code: "GB", name: "United Kingdom", emoji: "🇬🇧" },
  { code: "US", name: "United States", emoji: "🇺🇸" },
  { code: "UY", name: "Uruguay", emoji: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan", emoji: "🇺🇿" },
  { code: "VU", name: "Vanuatu", emoji: "🇻🇺" },
  { code: "VA", name: "Vatican City", emoji: "🇻🇦" },
  { code: "VE", name: "Venezuela", emoji: "🇻🇪" },
  { code: "VN", name: "Vietnam", emoji: "🇻🇳" },
  { code: "YE", name: "Yemen", emoji: "🇾🇪" },
  { code: "ZM", name: "Zambia", emoji: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", emoji: "🇿🇼" },
];

export const getCountryByCode = (code: string | undefined): Country | undefined => {
  return COUNTRIES.find((c) => c.code === code);
};

export const getCountryByName = (name: string): Country | undefined => {
  return COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
};

export const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export const CUE_LENGTH_OPTIONS = ["56.5", "57", "57.5", "58", "58.5"] as const;
export const CUE_FERRULE_OPTIONS = ["brass", "titanium"] as const;
export const CUE_TIP_OPTIONS = [
  "7",
  "7.25",
  "7.5",
  "7.75",
  "8",
  "8.25",
  "8.5",
  "8.75",
  "9",
  "9.25",
  "9.5",
  "9.75",
  "10",
  "10.25",
  "10.5",
  "10.75",
  "11",
] as const;
export const CUE_WEIGHT_OPTIONS = ["17", "17.25", "17.5", "17.75", "18", "18.25", "18.5", "18.75", "19", "19.25", "19.5"] as const;

export type CueSetupSelection = {
  lengthIn: (typeof CUE_LENGTH_OPTIONS)[number];
  ferrule: (typeof CUE_FERRULE_OPTIONS)[number];
  tipMm: (typeof CUE_TIP_OPTIONS)[number];
  weightOz: (typeof CUE_WEIGHT_OPTIONS)[number];
};

export const DEFAULT_CUE_SETUP: CueSetupSelection = {
  lengthIn: "57.5",
  ferrule: "titanium",
  tipMm: "9.5",
  weightOz: "18.5",
};

const encodeCueSetup = (setup: CueSetupSelection): string => {
  return `len:${setup.lengthIn}|fer:${setup.ferrule}|tip:${setup.tipMm}|wt:${setup.weightOz}`;
};

const decodeCueSetup = (value: string | undefined): CueSetupSelection | null => {
  if (!value || !value.includes("len:")) return null;
  const pairs = value.split("|").map((entry) => entry.split(":"));
  const map = Object.fromEntries(pairs) as Record<string, string>;

  const lengthIn = CUE_LENGTH_OPTIONS.find((option) => option === map.len);
  const ferrule = CUE_FERRULE_OPTIONS.find((option) => option === map.fer);
  const tipMm = CUE_TIP_OPTIONS.find((option) => option === map.tip);
  const weightOz = CUE_WEIGHT_OPTIONS.find((option) => option === map.wt);

  if (!lengthIn || !ferrule || !tipMm || !weightOz) return null;
  return { lengthIn, ferrule, tipMm, weightOz };
};

export const buildCuePreferenceValue = (setup: CueSetupSelection): string => encodeCueSetup(setup);
export const parseCuePreferenceValue = (value: string | undefined): CueSetupSelection => decodeCueSetup(value) ?? DEFAULT_CUE_SETUP;

const LEGACY_CUE_PREFERENCE_LABELS: Record<string, string> = {
  pool_cue: "Pool cue (legacy)",
  snooker_cue: "Snooker cue (legacy)",
  break_cue: "Break cue (legacy)",
  jump_cue: "Jump cue (legacy)",
  three_cushion: "Three cushion cue (legacy)",
};

export const getSkillLabel = (value: SkillLevel | undefined): string => {
  return SKILL_LEVELS.find((s) => s.value === value)?.label ?? "Not set";
};

export const getCuePreferenceLabel = (value: string | undefined): string => {
  if (!value) return "Not set";
  const parsed = decodeCueSetup(value);
  if (parsed) {
    const ferruleLabel = parsed.ferrule === "brass" ? "Brass" : "Titanium";
    return `${parsed.lengthIn} in • ${ferruleLabel} • ${parsed.tipMm} mm • ${parsed.weightOz} oz`;
  }
  return LEGACY_CUE_PREFERENCE_LABELS[value] ?? value;
};
