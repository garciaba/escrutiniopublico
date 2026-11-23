/**
 * Manual corrections (specification, section 6). Every entry states why it exists,
 * when it was added and the evidence, and is published on the /cambios page.
 * Official files are never edited by hand: corrections live here.
 */

export interface NameAliasEntry {
  /** Name exactly as written in the source file. */
  variant: string;
  /** Name exactly as written in the census (DiputadosActivos / DiputadosDeBaja). */
  canonical: string;
  /** Files where the variant appears. */
  sources: readonly ('votaciones' | 'intervenciones' | 'organos')[];
  reason: string;
  evidence: string;
  /** yyyy-mm-dd */
  added: string;
}

/**
 * Spellings of a deputy's name that differ from the census. Found by checking every
 * row of the XV legislature (docs/data-dictionary.md, section 4) and confirmed one by
 * one: same surnames, compatible given names, activity inside the deputy's term and,
 * when present, the same parliamentary group.
 */
export const nameAliases: readonly NameAliasEntry[] = [
  {
    variant: 'Cuesta Rodríguez, María del Socorro',
    canonical: 'Cuesta Rodríguez, María',
    sources: ['votaciones'],
    reason: 'El voto nominal usa el nombre completo; el censo, solo «María».',
    evidence:
      'Votaciones de Pleno de la XV: la variante ocupa el escaño de la diputada del censo y no hay otra persona con esos apellidos.',
    added: '2026-11-23',
  },
  {
    variant: 'Alegría Continente, Pilar',
    canonical: 'Alegría Continente, María Pilar',
    sources: ['intervenciones'],
    reason: 'Nombre abreviado en el cargo de ministra.',
    evidence:
      'Intervenciones como Ministra de Educación, Formación Profesional y Deportes (2024-10-16 a 2025-11-26); el censo y el resto de filas usan «María Pilar».',
    added: '2026-11-23',
  },
  {
    variant: 'Calvo Poyato, María del Carmen',
    canonical: 'Calvo Poyato, Carmen',
    sources: ['intervenciones'],
    reason: 'Nombre completo en su comparecencia como candidata a presidir el Consejo de Estado.',
    evidence:
      'Dos filas con cargo «Candidata propuesta por el Gobierno como presidenta del Consejo de Estado»; única persona del censo con esos apellidos. Esas filas no cuentan como actividad de diputada (cargo no parlamentario).',
    added: '2026-11-23',
  },
  {
    variant: 'Lago Peñas, José Manuel',
    canonical: 'Lago Peñas, Manuel',
    sources: ['intervenciones'],
    reason: 'Nombre completo en algunas intervenciones; el censo usa «Manuel».',
    evidence:
      'Nueve filas con cargo «Diputado» en 2025 (PNL en la Comisión de Agricultura y en el Pleno), dentro de su mandato (alta 06/02/2024); único diputado del censo con esos apellidos (Sumar, A Coruña).',
    added: '2026-11-23',
  },
  {
    variant: 'Moreno Fernández, María Isabel',
    canonical: 'Moreno Fernández, Mª Isabel',
    sources: ['intervenciones'],
    reason: '«Mª» desarrollado como «María».',
    evidence:
      'Dos filas con cargo «Diputada» en la Comisión de Sanidad (2024 y 2025), dentro de su mandato (alta 12/12/2023, Cádiz). Distinta de la senadora «Moreno Fernández, Cristina».',
    added: '2026-11-23',
  },
  {
    variant: 'Ogou Corbi, Viviane',
    canonical: 'Ogou i Corbi, Viviane',
    sources: ['intervenciones'],
    reason: 'Falta la conjunción catalana «i» entre apellidos.',
    evidence:
      'Cinco filas en 2025 (PNL en comisión y en Pleno, moción); el resto de sus intervenciones figuran como «Ogou i Corbi, Viviane (GSUMAR)», igual que en el censo.',
    added: '2026-11-23',
  },
];

/**
 * Names labelled "Diputado/a" in the interventions file that are not deputies of the
 * Congreso. They never match the census and are listed so the check that every
 * deputy-like name is accounted for passes knowingly, not by accident.
 */
export const notDeputies: readonly { name: string; reason: string }[] = [
  { name: 'Camps Devesa, Gerardo', reason: 'Senador (SGPP) en una comisión mixta; cargo mal rotulado.' },
  { name: 'Lemus Rubiales, Rafael Damián', reason: 'Senador (SGPS) en una comisión mixta; cargo mal rotulado.' },
  { name: 'Matarí Sáez, Juan José', reason: 'Senador (SGPP) en la Comisión Mixta de RTVE; cargo mal rotulado.' },
  { name: 'Morera Català, Enric Xavier', reason: 'Senador (SGPIC) en comisiones mixtas; cargo mal rotulado.' },
  {
    name: 'Fernández Heredia, Álvaro',
    reason: 'Compareciente como autoridad en la Comisión de Transportes; cargo mal rotulado.',
  },
];
