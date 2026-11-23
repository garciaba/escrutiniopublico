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

export interface GovernmentTerm {
  /** Name exactly as written in the census. */
  name: string;
  /** Name as written in the BOE. */
  boeName: string;
  /** Posts held during the term, in order. */
  posts: string;
  /**
   * First day in office (yyyy-mm-dd, BOE publication of the appointment). When the
   * person was already in office before the XV legislature began, this is the
   * legislature's first day and `inOfficeBeforeLegislature` is true.
   */
  from: string;
  inOfficeBeforeLegislature: boolean;
  /** First day out of office (BOE publication of the removal or of the successor); absent if still in office at the dissolution. */
  until?: string;
  /** BOE identifiers of every appointment and removal used. */
  evidence: readonly string[];
}

/**
 * Members of the Government who were deputies of the XV legislature at some point
 * while in office (specification section 7: excluded from the general ranking).
 * Built on 2026-11-23 by replaying every appointment and removal of the President,
 * Vice-Presidents and Ministers in the BOE daily summaries from 13/01/2020 to
 * 06/10/2026, and joining names to the census with the strict name rules; each pair
 * reviewed by hand. Periods are half-open: [from, until). The pipeline intersects
 * them with each deputy's mandate. Not listed because the two never overlapped:
 * Óscar López Águeda and Milagros Tolón Jaime, deputies only until December 2023 and
 * appointed ministers in 2024 and 2025.
 */
export const governmentMembers: readonly GovernmentTerm[] = [
  {
    name: 'Sánchez Pérez-Castejón, Pedro',
    boeName: 'Pedro Sánchez Pérez-Castejón',
    posts: 'Presidente del Gobierno (en funciones desde el 25/07/2023; nombrado de nuevo el 17/11/2023)',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: [
      'BOE-A-2023-17073 (RD 694/2023, cese tras las elecciones; sigue en funciones)',
      'BOE-A-2023-23302 (RD 828/2023)',
    ],
  },
  {
    name: 'Díaz Pérez, Yolanda',
    boeName: 'Yolanda Díaz Pérez',
    posts: 'Vicepresidenta Segunda y Ministra de Trabajo y Economía Social',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: [
      'BOE-A-2020-416 (RD 8/2020)',
      'BOE-A-2021-11529 (RD 523/2021)',
      'BOE-A-2023-23540 (RD 832/2023)',
      'BOE-A-2023-23543 (RD 835/2023)',
    ],
  },
  {
    name: 'Montero Cuadrado, María Jesús',
    boeName: 'María Jesús Montero Cuadrado',
    posts: 'Ministra de Hacienda y Función Pública; Vicepresidenta Cuarta y después Primera y Ministra de Hacienda',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2026-03-27',
    evidence: [
      'BOE-A-2021-11533 (RD 527/2021)',
      'BOE-A-2023-23542 (RD 834/2023)',
      'BOE-A-2023-23543 (RD 835/2023)',
      'BOE-A-2023-26734 (RD 1237/2023)',
      'BOE-A-2023-26735 (RD 1238/2023)',
      'BOE-A-2026-7045 (RD 256/2026, cese)',
      'BOE-A-2026-7046 (RD 257/2026, cese)',
    ],
  },
  {
    name: 'Bolaños García, Félix',
    boeName: 'Félix Bolaños García',
    posts:
      'Ministro de la Presidencia, Relaciones con las Cortes y Memoria Democrática; desde el 21/11/2023, de la Presidencia, Justicia y Relaciones con las Cortes',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: ['BOE-A-2021-11536 (RD 530/2021)', 'BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Puente Santiago, Óscar',
    boeName: 'Óscar Puente Santiago',
    posts: 'Ministro de Transportes y Movilidad Sostenible',
    from: '2023-11-21',
    inOfficeBeforeLegislature: false,
    evidence: ['BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Ribera Rodríguez, Teresa',
    boeName: 'Teresa Ribera Rodríguez',
    posts: 'Vicepresidenta Tercera y Ministra para la Transición Ecológica y el Reto Demográfico',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2024-11-25',
    evidence: [
      'BOE-A-2021-11530 (RD 524/2021)',
      'BOE-A-2023-23541 (RD 833/2023)',
      'BOE-A-2023-23543 (RD 835/2023)',
      'BOE-A-2024-24518 (RD 1170/2024, cese)',
      'BOE-A-2024-24519 (RD 1171/2024, cese)',
    ],
  },
  {
    name: 'Robles Fernández, Margarita',
    boeName: 'María Margarita Robles Fernández',
    posts: 'Ministra de Defensa',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: ['BOE-A-2020-416 (RD 8/2020)', 'BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Grande-Marlaska Gómez, Fernando',
    boeName: 'Fernando Grande-Marlaska Gómez',
    posts: 'Ministro del Interior',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: ['BOE-A-2020-416 (RD 8/2020)', 'BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Planas Puchades, Luis',
    boeName: 'Luis Planas Puchades',
    posts: 'Ministro de Agricultura, Pesca y Alimentación',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: ['BOE-A-2020-416 (RD 8/2020)', 'BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Albares Bueno, José Manuel',
    boeName: 'José Manuel Albares Bueno',
    posts: 'Ministro de Asuntos Exteriores, Unión Europea y Cooperación',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: ['BOE-A-2021-11531 (RD 525/2021)', 'BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Alegría Continente, María Pilar',
    boeName: 'María del Pilar Alegría Continente',
    posts:
      'Ministra de Educación y Formación Profesional; desde el 21/11/2023, de Educación, Formación Profesional y Deportes',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2025-12-22',
    evidence: [
      'BOE-A-2021-11535 (RD 529/2021)',
      'BOE-A-2023-23543 (RD 835/2023)',
      'BOE-A-2025-26352 (RD 1183/2025, cese)',
    ],
  },
  {
    name: 'Rodríguez García, Isabel',
    boeName: 'Isabel Rodríguez García',
    posts: 'Ministra de Política Territorial; desde el 21/11/2023, de Vivienda y Agenda Urbana',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: ['BOE-A-2021-11537 (RD 531/2021)', 'BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Morant Ripoll, Diana',
    boeName: 'Diana Morant Ripoll',
    posts: 'Ministra de Ciencia e Innovación; desde el 21/11/2023, de Ciencia, Innovación y Universidades',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    evidence: ['BOE-A-2021-11539 (RD 533/2021)', 'BOE-A-2023-23543 (RD 835/2023)'],
  },
  {
    name: 'Belarra Urteaga, Ione',
    boeName: 'Ione Belarra Urteaga',
    posts: 'Ministra de Derechos Sociales y Agenda 2030 (en funciones)',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2023-11-21',
    evidence: ['BOE-A-2021-5047 (RD 235/2021)', 'BOE-A-2023-23543 (RD 835/2023, nombra a su sucesor)'],
  },
  {
    name: 'Miñones Conde, José',
    boeName: 'José Manuel Miñones Conde',
    posts: 'Ministro de Sanidad (en funciones)',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2023-11-21',
    evidence: ['BOE-A-2023-7888 (RD 203/2023)', 'BOE-A-2023-23543 (RD 835/2023, nombra a su sucesora)'],
  },
  {
    name: 'Gómez Hernández, Héctor',
    boeName: 'Héctor José Gómez Hernández',
    posts: 'Ministro de Industria, Comercio y Turismo (en funciones)',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2023-11-21',
    evidence: ['BOE-A-2023-7887 (RD 202/2023)', 'BOE-A-2023-23543 (RD 835/2023, nombra a su sucesor)'],
  },
  {
    name: 'Iceta i Llorens, Miquel',
    boeName: 'Miquel Octavi Iceta i Llorens',
    posts: 'Ministro de Cultura y Deporte (en funciones)',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2023-11-21',
    evidence: ['BOE-A-2021-11538 (RD 532/2021)', 'BOE-A-2023-23543 (RD 835/2023, nombra a su sucesor)'],
  },
  {
    name: 'Sánchez Jiménez, Raquel',
    boeName: 'Raquel Sánchez Jiménez',
    posts: 'Ministra de Transportes, Movilidad y Agenda Urbana (en funciones)',
    from: '2023-08-17',
    inOfficeBeforeLegislature: true,
    until: '2023-11-21',
    evidence: ['BOE-A-2021-11534 (RD 528/2021)', 'BOE-A-2023-23543 (RD 835/2023, nombra a su sucesor)'],
  },
];
