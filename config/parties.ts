/**
 * Parliamentary groups and electoral formations of the XV legislature.
 * The census names groups in full; votes, interventions and committee exports use a
 * short code. The pairs below were derived from the data on 2026-11-23 (every
 * deputy's census group against the code next to their votes) and are unambiguous.
 * Neutrality (specification, section 9): nothing here may change any score.
 */

export interface GroupConfig {
  /** Code used by votes, interventions and committee exports; also ESCAÑO's grupo_id. */
  code: string;
  /** Full name as written in the census. */
  name: string;
  /** Short label for the web. */
  shortName: string;
}

export const groups: readonly GroupConfig[] = [
  { code: 'GEH Bildu', name: 'Grupo Parlamentario Euskal Herria Bildu', shortName: 'EH Bildu' },
  { code: 'GJxCAT', name: 'Grupo Parlamentario Junts per Catalunya', shortName: 'Junts' },
  { code: 'GMx', name: 'Grupo Parlamentario Mixto', shortName: 'Mixto' },
  { code: 'GP', name: 'Grupo Parlamentario Popular en el Congreso', shortName: 'Popular' },
  { code: 'GR', name: 'Grupo Parlamentario Republicano', shortName: 'Republicano' },
  { code: 'GS', name: 'Grupo Parlamentario Socialista', shortName: 'Socialista' },
  { code: 'GSUMAR', name: 'Grupo Parlamentario Plurinacional SUMAR', shortName: 'SUMAR' },
  { code: 'GV (EAJ-PNV)', name: 'Grupo Parlamentario Vasco (EAJ-PNV)', shortName: 'Vasco (EAJ-PNV)' },
  { code: 'GVOX', name: 'Grupo Parlamentario VOX', shortName: 'VOX' },
];

/**
 * Electoral formation (census FORMACIONELECTORAL) -> party used by the web filter.
 * Regional federations are grouped under their party; the formation is kept as well.
 */
export const formationToParty: Readonly<Record<string, string>> = {
  BNG: 'BNG',
  CCa: 'CCa',
  'EAJ-PNV': 'EAJ-PNV',
  'EH Bildu': 'EH Bildu',
  ERC: 'ERC',
  'JxCAT-JUNTS': 'Junts',
  PP: 'PP',
  'PSC-PSOE': 'PSOE',
  'PSE-EE (PSOE)': 'PSOE',
  'PSIB-PSOE': 'PSOE',
  'PSN-PSOE': 'PSOE',
  PSOE: 'PSOE',
  'PsdeG-PSOE': 'PSOE',
  SUMAR: 'SUMAR',
  UPN: 'UPN',
  VOX: 'VOX',
};
