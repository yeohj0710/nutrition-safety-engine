export const MULTI_VALUE_SEPARATOR = " · ";

export function splitMultiValue(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\s*(?:·|,|;|\n)\s*/u)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function joinMultiValue(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).join(
    MULTI_VALUE_SEPARATOR,
  );
}

export function hasMultiValue(value: string, choice: string) {
  return splitMultiValue(value).includes(choice);
}

export function toggleMultiValue(
  current: string,
  choice: string,
  exclusiveChoices: string[] = [],
) {
  const values = splitMultiValue(current);
  if (exclusiveChoices.includes(choice)) {
    return values.length === 1 && values[0] === choice ? "" : choice;
  }

  const ordinaryValues = values.filter(
    (value) => !exclusiveChoices.includes(value),
  );
  return joinMultiValue(
    ordinaryValues.includes(choice)
      ? ordinaryValues.filter((value) => value !== choice)
      : [...ordinaryValues, choice],
  );
}
