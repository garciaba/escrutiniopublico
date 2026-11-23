/**
 * Project-wide configuration. Every value that may change over time
 * (legislature, URLs, thresholds) lives here; code never hardcodes them.
 * See docs/data-dictionary.md for what each official dataset contains.
 */

export const project = {
  name: 'ESCAÑO',
  repositoryUrl: 'https://github.com/garciaba/escrutiniopublico',

  /** Current legislature: arabic number and the roman numeral the Congreso URLs use. */
  legislatura: { number: 15, roman: 'XV' },

  baseUrl: 'https://www.congreso.es',

  http: {
    /**
     * The Congreso web application firewall rejects some User-Agent strings
     * (HTTP 403), including one that carried the repository URL.
     * `ESCANO/<version>` is accepted. Pending owner decision D-003 in docs/decisions.md.
     */
    userAgent: 'ESCANO/0.1',
    /** At most one request per second. */
    minIntervalMs: 1000,
    /** Retries after the first attempt, with exponential backoff. */
    retries: 3,
    backoffBaseMs: 2000,
    timeoutMs: 120_000,
  },

  /** Index pages of the five open-data families. Download links are read from them. */
  indexPages: {
    diputados: '/es/opendata/diputados',
    votaciones: '/es/opendata/votaciones',
    intervenciones: '/es/opendata/intervenciones',
    iniciativas: '/es/opendata/iniciativas',
    organos: '/es/opendata/organos',
  },

  /**
   * Static files to ingest, identified by the file-name prefix before `__<timestamp>`.
   * Prefixes present on the index pages but deliberately not ingested are listed in
   * `excludedPrefixes` with the reason.
   */
  datasets: [
    { id: 'diputados_activos', family: 'diputados', prefix: 'DiputadosActivos' },
    { id: 'diputados_baja', family: 'diputados', prefix: 'DiputadosDeBaja' },
    { id: 'intervenciones', family: 'intervenciones', prefix: 'IntervencionesCronologicamente' },
    { id: 'iniciativas_aprobadas', family: 'iniciativas', prefix: 'IniciativasLegislativasAprobadas' },
    { id: 'proyectos_ley', family: 'iniciativas', prefix: 'ProyectosDeLey' },
    { id: 'proposiciones_ley', family: 'iniciativas', prefix: 'ProposicionesDeLey' },
    { id: 'propuestas_reforma_estatuto', family: 'iniciativas', prefix: 'PropuestasDeReforma' },
  ],

  excludedPrefixes: {
    docacteco: 'Declaraciones de intereses económicos: excluded by the personal-data policy.',
    Diputadas: 'Subset of Diput (women in every legislature); not needed.',
    Diput: 'Every deputy of every legislature, without dates of the current term; not needed for the MVP.',
    odsDiputados: 'One file per past legislature; phase 2 (history).',
    IntervencionesIniciativa: 'Same rows as IntervencionesCronologicamente in a different order.',
  },

  /** Preferred format order: JSON first; CSV or XML only if JSON is missing. */
  formatPreference: ['json', 'csv', 'xml'] as const,

  votaciones: {
    /** Page for one voting day: `targetDate` is dd/mm/yyyy. */
    dayPagePath: '/es/opendata/votaciones',
    dayPageQuery: {
      p_p_id: 'votaciones',
      p_p_lifecycle: '0',
      p_p_state: 'normal',
      p_p_mode: 'view',
    },
  },

  organos: {
    /** POST endpoint that lists committees (tipoConsulta 3) or subcommittees (4). */
    listPath: '/es/opendata/organos',
    listQuery: {
      p_p_id: 'opendata',
      p_p_lifecycle: '2',
      p_p_state: 'normal',
      p_p_mode: 'view',
      p_p_resource_id: 'resourceIDOrganos',
      p_p_cacheability: 'cacheLevelPage',
    },
    /** POST endpoint behind the "Exportar datos composición" button of committees. */
    exportPath: '/es/organos/composicion-en-la-legislatura',
    exportQuery: {
      p_p_id: 'organos',
      p_p_lifecycle: '2',
      p_p_state: 'normal',
      p_p_mode: 'view',
      p_p_resource_id: 'opendataExport',
      p_p_cacheability: 'cacheLevelPage',
    },
    /** `selectedOrganoSup` of committees; each committee has its own `selectedSuborgano`. */
    comisionesOrganoSup: 1,
    /**
     * Governing bodies export from their own page path with an empty `selectedSuborgano`.
     * Codes read from those pages; the Junta de Portavoces one is still unverified.
     */
    superiores: {
      mesa: { path: '/es/mesa', organoSup: 100 },
      diputacionPermanente: { path: '/es/diputacion-permanente', organoSup: 500 },
    },
  },

  /** Deputy search and agenda resources of the deputy profile (decisions D-015 and D-017). */
  agendas: {
    legislatureStart: '2023-08-17',
    path: '/es/busqueda-de-diputados',
    searchQuery: {
      p_p_id: 'diputadomodule',
      p_p_lifecycle: '2',
      p_p_state: 'normal',
      p_p_mode: 'view',
      p_p_resource_id: 'searchDiputados',
      p_p_cacheability: 'cacheLevelPage',
    },
    agendaQuery: {
      p_p_id: 'diputadomodule',
      p_p_lifecycle: '2',
      p_p_state: 'normal',
      p_p_mode: 'view',
      p_p_resource_id: 'agendaDiputados',
      p_p_cacheability: 'cacheLevelPage',
      _diputadomodule_mostrarFicha: 'true',
    },
  },

  /** Pre-publication sanity checks (section 6 of the specification). */
  sanity: {
    activeDeputiesMin: 340,
    activeDeputiesMax: 350,
    maxRowLossPct: 5,
    maxUnassignedPct: 0.5,
    maxDailyScoreJump: 15,
  },
} as const;

export type DatasetConfig = (typeof project.datasets)[number];
export type Family = keyof typeof project.indexPages;
