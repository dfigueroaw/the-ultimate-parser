export function tokenizeInput(input: string) {
  return input.match(/[A-Za-z_][A-Za-z0-9_]*|\d+|==|!=|<=|>=|[^\s]/g) ?? [];
}

export function symbolMatches(expected: string, actual: string) {
  return expected === actual || (expected === "number" && /^\d+$/.test(actual));
}
