// The colours Excel gives the references of a formula being edited, in order; they repeat after the last.

export const REFERENCE_COLORS: readonly string[] = [
  '#4472c4', // blue
  '#e74c3c', // red
  '#8e44ad', // purple
  '#27a35a', // green
  '#e67e22', // orange
  '#17a2b8', // teal
  '#c2185b', // magenta
];

export function referenceColor(index: number): string {
  return REFERENCE_COLORS[index % REFERENCE_COLORS.length];
}
