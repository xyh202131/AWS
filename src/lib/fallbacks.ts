export const compactTextList = (items: string[] | null | undefined) =>
  (items ?? []).map((item) => item.trim()).filter(Boolean);

export const withTextFallback = (items: string[] | null | undefined, fallback: string) => {
  const compactItems = compactTextList(items);
  return compactItems.length ? compactItems : [fallback];
};

export const formatOptionalValue = (value: number | string | null | undefined, fallback: string) => {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
};

export const formatPositions = (positions: string[] | null | undefined, fallback: string) => {
  const compactPositions = compactTextList(positions);
  return compactPositions.length ? compactPositions.join("/") : fallback;
};
