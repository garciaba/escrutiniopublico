/**
 * Deputy names. The Congreso open data has no deputy code (docs/data-dictionary.md,
 * section 2), so every source is joined to the census by name. Matching is strict:
 * an exact census name, or an alias listed by hand in config/overrides.ts. Similar
 * names are only ever *suggested* (isCompatibleName) for a human to confirm.
 */

/** Words that join surnames or given names and are written inconsistently ("Ogou i Corbi"). */
const CONNECTORS = new Set(['i', 'y', 'de', 'del', 'la', 'las', 'los', 'el']);

/** Lower case, no accents, "Mª" spelled out, only letters and single spaces. */
export function foldName(text: string): string {
  return text
    .replace(/M\.?ª/g, 'María')
    .replace(/ª/g, 'a')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

export interface NameParts {
  surnames: string[];
  given: string[];
}

/** Splits "Apellidos, Nombre" into folded tokens without connectors. */
export function nameParts(fullName: string): NameParts {
  const [surnames = '', given = ''] = fullName.split(',', 2);
  const tokens = (text: string) =>
    foldName(text)
      .split(' ')
      .filter((token) => token !== '' && !CONNECTORS.has(token));
  return { surnames: tokens(surnames), given: tokens(given) };
}

/**
 * True when two spellings may be the same person: identical surnames (ignoring
 * accents and connectors) and one set of given names contained in the other
 * ("Pilar" / "María Pilar", "Mª Isabel" / "María Isabel"). Used only to propose
 * aliases for review, never to join records automatically.
 */
export function isCompatibleName(a: string, b: string): boolean {
  const pa = nameParts(a);
  const pb = nameParts(b);
  if (pa.surnames.length === 0 || pa.surnames.join(' ') !== pb.surnames.join(' ')) return false;
  const ga = new Set(pa.given);
  const gb = new Set(pb.given);
  const subset = (x: Set<string>, y: Set<string>) => [...x].every((token) => y.has(token));
  return subset(ga, gb) || subset(gb, ga);
}

const GROUP_SUFFIX = /\s*\(((?:[^()]|\([^()]*\))*)\)\s*$/;

/** Splits the speaker field of the interventions file: "Agirretxea Urresti, Joseba Andoni (GV (EAJ-PNV))". */
export function splitSpeaker(orador: string): { name: string; group: string | undefined } {
  const match = GROUP_SUFFIX.exec(orador);
  return {
    name: orador.replace(GROUP_SUFFIX, '').replace(/\s+/g, ' ').trim(),
    group: match?.[1]?.trim() || undefined,
  };
}

export interface NameAlias {
  /** Name exactly as written in the source file. */
  variant: string;
  /** Name exactly as written in the census (DiputadosActivos / DiputadosDeBaja). */
  canonical: string;
}

/**
 * Resolves a name from any source to a census name: exact match first, then the
 * manual alias table. Returns undefined otherwise; there is no fuzzy fallback.
 */
export function createNameResolver(
  censusNames: Iterable<string>,
  aliases: readonly NameAlias[],
): (name: string) => string | undefined {
  const census = new Set(censusNames);
  const aliasMap = new Map<string, string>();
  for (const alias of aliases) {
    if (!census.has(alias.canonical)) {
      throw new Error(`Alias target is not in the census: "${alias.canonical}" (from "${alias.variant}")`);
    }
    if (census.has(alias.variant)) {
      throw new Error(`Alias variant is itself a census name: "${alias.variant}"`);
    }
    aliasMap.set(alias.variant, alias.canonical);
  }
  return (name: string) => {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (census.has(clean)) return clean;
    return aliasMap.get(clean);
  };
}
