export type SchedulablePlanItem = {
  id?: string;
  plannedDate: string;
  week?: string | null;
  platformName?: string;
  format?: string;
};

type ParsedMonth = {
  year: number;
  monthIndex: number;
  lastDay: number;
};

const exactDatePattern = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseMonth(month: string): ParsedMonth | null {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;

  return {
    year,
    monthIndex,
    lastDay: new Date(year, monthIndex + 1, 0).getDate(),
  };
}

export function parseExactPlanDate(value: string) {
  const match = value.trim().match(exactDatePattern);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day
    ? dateKey(date)
    : null;
}

function weekNumberFromText(value?: string | null) {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  const numericWeek = normalized.match(/(?:week|недел[яи]?|нед\.?)\s*[-_ ]?([1-5])/i);
  if (numericWeek) return Number(numericWeek[1]);

  if (normalized.includes("first week") || normalized.includes("первая нед")) return 1;
  if (normalized.includes("second week") || normalized.includes("вторая нед")) return 2;
  if (normalized.includes("third week") || normalized.includes("третья нед")) return 3;
  if (normalized.includes("fourth week") || normalized.includes("четв")) return 4;
  if (normalized.includes("fifth week") || normalized.includes("пятая нед")) return 5;
  if (normalized.includes("early month") || normalized.includes("начал")) return 1;
  if (normalized.includes("mid month") || normalized.includes("серед")) return 3;
  if (normalized.includes("late month") || normalized.includes("конец")) return 4;

  return null;
}

function fallbackWeekForIndex(index: number, itemCount: number) {
  if (itemCount <= 1) return 1;
  return Math.min(4, Math.max(1, Math.floor((index / itemCount) * 4) + 1));
}

function dateKeysForWeek(month: ParsedMonth, weekNumber: number) {
  const startDay = Math.min(month.lastDay, Math.max(1, (weekNumber - 1) * 7 + 1));
  const endDay = Math.min(month.lastDay, startDay + 6);
  const allDates = Array.from({ length: endDay - startDay + 1 }, (_, index) => {
    return new Date(month.year, month.monthIndex, startDay + index);
  });
  const weekdays = allDates.filter((date) => {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  });

  return (weekdays.length > 0 ? weekdays : allDates).map(dateKey);
}

function chooseLeastLoadedDate(candidates: string[], counts: Map<string, number>, offset: number) {
  const sorted = [...candidates].sort((left, right) => {
    const loadDifference = (counts.get(left) ?? 0) - (counts.get(right) ?? 0);
    return loadDifference || left.localeCompare(right);
  });
  const lowestLoad = counts.get(sorted[0]) ?? 0;
  const lightestDates = sorted.filter((candidate) => (counts.get(candidate) ?? 0) === lowestLoad);

  return lightestDates[offset % lightestDates.length] ?? sorted[0];
}

function isInsideMonth(dateValue: string, month: string) {
  return dateValue.startsWith(`${month}-`);
}

export function normalizeMonthlyPlanDates<T extends SchedulablePlanItem>(
  items: T[],
  month: string,
): { items: T[]; changedCount: number } {
  const parsedMonth = parseMonth(month);
  if (!parsedMonth) return { items, changedCount: 0 };

  const dateCounts = new Map<string, number>();
  for (const item of items) {
    const exactDate = parseExactPlanDate(item.plannedDate);
    if (exactDate && isInsideMonth(exactDate, month)) {
      dateCounts.set(exactDate, (dateCounts.get(exactDate) ?? 0) + 1);
    }
  }

  let changedCount = 0;

  items.forEach((item, index) => {
    const exactDate = parseExactPlanDate(item.plannedDate);
    if (exactDate && isInsideMonth(exactDate, month)) {
      if (item.plannedDate !== exactDate) {
        item.plannedDate = exactDate;
        changedCount += 1;
      }
      return;
    }

    const weekNumber =
      weekNumberFromText(item.week) ??
      weekNumberFromText(item.plannedDate) ??
      fallbackWeekForIndex(index, items.length);
    const candidates = dateKeysForWeek(parsedMonth, Math.min(5, Math.max(1, weekNumber)));
    const scheduledDate = chooseLeastLoadedDate(candidates, dateCounts, index);

    item.plannedDate = scheduledDate;
    item.week = item.week || `week ${Math.min(5, Math.max(1, weekNumber))}`;
    dateCounts.set(scheduledDate, (dateCounts.get(scheduledDate) ?? 0) + 1);
    changedCount += 1;
  });

  return { items, changedCount };
}
