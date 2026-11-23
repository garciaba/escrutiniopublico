/**
 * Public log of data changes and rectifications, shown on /cambios next to the
 * methodology versions (config/scoring.ts) and the manual corrections
 * (config/overrides.ts). Newest first. Add an entry whenever a rectification is
 * accepted or a reload changes published figures for a reason other than new activity.
 */

export interface EntradaRegistro {
  /** yyyy-mm-dd */
  fecha: string;
  tipo: 'datos' | 'rectificacion';
  texto: string;
}

export const registro: readonly EntradaRegistro[] = [
  {
    fecha: '2026-11-23',
    tipo: 'datos',
    texto:
      'Nueva página «Grupos», con las cifras sumadas por grupo parlamentario y por candidatura electoral, y nuevo fichero grupos.json. No cambia ninguna puntuación. El filtro «Partido» del ranking pasa a llamarse «Candidatura», que es lo que recoge el dato oficial.',
  },
  {
    fecha: '2026-11-23',
    tipo: 'datos',
    texto:
      'Nuevas fuentes con las metodologías 1.1.0 y 1.2.0: 3.788 preguntas orales (en Pleno, en comisión y a la Corporación RTVE) y los ponentes de 46 proyectos y proposiciones de ley. Cambian las puntuaciones de todos los diputados.',
  },
  {
    fecha: '2026-11-23',
    tipo: 'datos',
    texto:
      'Primera carga completa de la XV Legislatura: votaciones nominales del Pleno, intervenciones, preguntas con respuesta escrita, solicitudes de informe y composición de los órganos.',
  },
];
