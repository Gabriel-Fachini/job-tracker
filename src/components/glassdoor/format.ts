const numberFormat = (digits: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const oneDecimal = numberFormat(1);
const integer = numberFormat(0);

export function formatRating(value: number | null | undefined) {
  return value === null || value === undefined ? "–" : oneDecimal.format(value);
}

export function formatShare(value: number | null | undefined) {
  return value === null || value === undefined ? "–" : `${integer.format(value * 100)}%`;
}

export function formatMoney(value: number | null | undefined) {
  return value === null || value === undefined ? "–" : `R$ ${integer.format(value)}`;
}

export function formatMonthYear(iso: string | null | undefined) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })
    .format(date)
    .replace(".", "");
}

export function formatFullDate(iso: string | null | undefined) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatOneDecimal(value: number) {
  return oneDecimal.format(value);
}
