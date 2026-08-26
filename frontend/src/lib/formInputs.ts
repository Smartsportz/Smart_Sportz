export function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(-10).slice(0, 10);
}
