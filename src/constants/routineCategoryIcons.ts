export const ROUTINE_CATEGORY_ICON_NAMES: Record<string, string> = {
  "cat-basics": "bullseye-arrow",
  "cat-break-building": "fire",
  "cat-safety": "shield-check",
  "cat-straight-cueing": "ray-start-end",
  "cat-cue-ball-control": "chart-timeline-variant",
  "cat-long-potting": "target-variant",
};

export const getRoutineCategoryIconName = (categoryId: string) => {
  return ROUTINE_CATEGORY_ICON_NAMES[categoryId] ?? "shape-outline";
};
