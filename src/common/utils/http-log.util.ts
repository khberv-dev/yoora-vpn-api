const MAX_PAYLOAD_CHARS = 2000;

export function formatHttpLogPayload(payload: unknown): string {
  if (payload === undefined || payload === null) return '';
  try {
    const seen = new WeakSet<object>();
    const text = JSON.stringify(
      payload,
      (_key, value: unknown) => {
        if (typeof value === 'bigint') return value.toString();
        if (value !== null && typeof value === 'object') {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
      2,
    );
    if (!text) return '';
    return text.length > MAX_PAYLOAD_CHARS
      ? `${text.slice(0, MAX_PAYLOAD_CHARS)}…`
      : text;
  } catch {
    return '[Unable to serialize]';
  }
}
