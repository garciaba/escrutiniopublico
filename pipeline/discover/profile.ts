/**
 * Field profiling used by the data-discovery milestone: for each field of a list of
 * records, how often it is present, filled and distinct, plus a couple of examples.
 */

export interface FieldProfile {
  field: string;
  present: number;
  nonEmpty: number;
  distinct: number;
  examples: string[];
}

export interface DatasetProfile {
  rows: number;
  fields: FieldProfile[];
}

const MAX_EXAMPLE_LENGTH = 80;

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

/** Profiles plain objects. Fields keep the order in which they first appear. */
export function profileRecords(records: readonly unknown[], maxExamples = 2): DatasetProfile {
  const stats = new Map<string, { present: number; nonEmpty: number; values: Set<string>; examples: string[] }>();
  for (const record of records) {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) continue;
    for (const [field, value] of Object.entries(record)) {
      let entry = stats.get(field);
      if (!entry) {
        entry = { present: 0, nonEmpty: 0, values: new Set(), examples: [] };
        stats.set(field, entry);
      }
      entry.present++;
      const text = toText(value);
      if (text.trim() === '') continue;
      entry.nonEmpty++;
      entry.values.add(text);
      if (entry.examples.length < maxExamples) {
        entry.examples.push(text.replace(/\s+/g, ' ').slice(0, MAX_EXAMPLE_LENGTH));
      }
    }
  }
  return {
    rows: records.length,
    fields: [...stats.entries()].map(([field, entry]) => ({
      field,
      present: entry.present,
      nonEmpty: entry.nonEmpty,
      distinct: entry.values.size,
      examples: entry.examples,
    })),
  };
}

/** Decodes bytes as UTF-8 (dropping a BOM) or, when the XML prolog says so, ISO-8859-1. */
export function decodeText(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 100));
  const encoding = /encoding="ISO-8859-1"/i.test(head) ? 'latin1' : 'utf-8';
  const text = new TextDecoder(encoding).decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
