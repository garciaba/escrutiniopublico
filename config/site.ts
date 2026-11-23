/**
 * Public identity of the website (decision D-028). Fields marked as pending are owner
 * decisions listed in section 12 of the specification; /acerca shows them as pending
 * until they are filled in.
 */
export const site = {
  name: 'Escrutinio Público',
  domain: 'escrutiniopublico.es',
  url: 'https://escrutiniopublico.es',
  lema: 'La actividad de los diputados, medida con datos oficiales',
  descripcion:
    'Ranking de la actividad parlamentaria de los diputados del Congreso, elaborado solo con datos oficiales y una metodología pública.',
  repositoryUrl: 'https://github.com/garciaba/escrutiniopublico',
  /** Branch whose data files the /datos page links to. */
  dataBranch: 'main',
  licencias: {
    codigo: { nombre: 'MIT', url: 'https://github.com/garciaba/escrutiniopublico/blob/main/LICENSE' },
    datos: { nombre: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.es' },
  },
  fuente: {
    nombre: 'Congreso de los Diputados',
    url: 'https://www.congreso.es/es/datos-abiertos',
    avisoLegal: 'https://www.congreso.es/cem/aviso-legal',
  },
  /** Pending: who is behind the project (natural person, association…). */
  titular: undefined as string | undefined,
  /** Pending: contact address for corrections. */
  contacto: undefined as string | undefined,
  /** Pending: how the project is funded. */
  financiacion: undefined as string | undefined,
  /** Hours after which the home page warns that the data may be stale (specification, section 6). */
  horasDatosAntiguos: 48,
} as const;
