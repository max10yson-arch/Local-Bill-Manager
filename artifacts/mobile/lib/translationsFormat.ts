/** Parse `translations.js` body into a plain key/value object. */
export function parseTranslationsJs(jsText: string): Record<string, string> {
  const start = jsText.indexOf("{");
  const end = jsText.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};
  const jsonSlice = jsText.slice(start, end + 1);
  try {
    return JSON.parse(jsonSlice) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Serialize object back to `translations.js` format used by saree site. */
export function serializeTranslationsJs(data: Record<string, string>): string {
  const body = JSON.stringify(data, null, 2);
  return `const translations = ${body};\n`;
}
