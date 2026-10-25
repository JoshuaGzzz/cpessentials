// The only sections that can order. The year level is worked out from the first digit.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

export const SECTION_GROUPS = [
  { year: "1st Year", label: "First Years", sections: range(1101, 1108) },
  { year: "2nd Year", label: "Second Years", sections: range(2101, 2108) },
  { year: "3rd Year", label: "Third Years", sections: range(3101, 3105) },
  { year: "4th Year", label: "Fourth Years", sections: range(4101, 4103) },
];

/** "3104" -> "3rd Year", unknown section -> "" */
export function yearOfSection(s) {
  return SECTION_GROUPS.find((g) => g.sections.includes(String(s)))?.year || "";
}
