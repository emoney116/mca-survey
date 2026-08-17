export const GOALS = [
  {
    key: "get-stronger",
    label: "Get stronger",
    shortLabel: "Strength",
  },
  {
    key: "sprint-speed",
    label: "Get faster / improve sprint speed",
    shortLabel: "Sprint speed",
  },
  {
    key: "agility",
    label: "Get quicker / improve agility",
    shortLabel: "Agility",
  },
  {
    key: "lose-body-fat",
    label: "Lose body fat",
    shortLabel: "Body fat",
  },
  {
    key: "gain-weight",
    label: "Gain weight",
    shortLabel: "Gain weight",
  },
  {
    key: "nutrition",
    label: "Learn to eat better / healthier",
    shortLabel: "Nutrition",
  },
  {
    key: "flexibility-mobility",
    label: "Improve flexibility and mobility",
    shortLabel: "Mobility",
  },
  {
    key: "conditioning",
    label: "Improve overall stamina / conditioning",
    shortLabel: "Conditioning",
  },
  {
    key: "core-strength",
    label: "Improve core strength",
    shortLabel: "Core strength",
  },
  {
    key: "sleep-schedule",
    label: "Improve overall sleep schedule",
    shortLabel: "Sleep",
  },
] as const;

export type Goal = (typeof GOALS)[number];
export type GoalKey = Goal["key"];

export const GOAL_KEYS = GOALS.map((goal) => goal.key) as GoalKey[];

export function getGoalByKey(key: string): Goal | undefined {
  return GOALS.find((goal) => goal.key === key);
}

export function getGoalLabel(key: string): string {
  return getGoalByKey(key)?.label ?? key;
}
