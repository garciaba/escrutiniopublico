/**
 * Scoring methodology (specification, section 7; decisions D-006 and D-016).
 * This file is the single source for the calculation and for the public
 * /metodologia page, so the text and the numbers cannot diverge. Nothing here may
 * refer to a parliamentary group or a party (neutrality test).
 */

export type MetricEstado = 'observado' | 'calculado' | 'no_disponible';

export const scoring = {
  /** Semantic version. Any change of weights, metrics or rules bumps it and is listed in `historial`. */
  metodologiaVersion: '1.0.0',
  historial: [
    {
      version: '1.0.0',
      fecha: '2026-11-23',
      cambios: [
        'Primera versión: tres dimensiones con dato (dedicación, participación en debates e iniciativa parlamentaria) de cinco, cobertura del 60 %.',
        'La dimensión «Productividad legislativa» pasa a llamarse «Iniciativa parlamentaria» y mide preguntas escritas y solicitudes de informe, con crédito fraccional entre firmantes.',
      ],
    },
  ],

  /** The index goes from 0 to 100 and is published with this many decimals. */
  decimales: 1,
  /** Below this share of the total weight no global index is published. */
  coberturaMinima: 0.4,

  /**
   * Reference population: deputies with at least `diasMinimos` days in office inside
   * the period. A period shorter than twice that uses `proporcionMinimaPeriodo` of
   * its length instead (decision D-023).
   */
  poblacionReferencia: { diasMinimos: 90, proporcionMinimaPeriodo: 0.5 },

  /** `dias` undefined = from the first day of the legislature. */
  periodos: [
    { id: 'legislatura', nombre: 'Legislatura', dias: undefined },
    { id: '12m', nombre: 'Último año', dias: 365 },
    { id: '3m', nombre: 'Último trimestre', dias: 91 },
    { id: '1m', nombre: 'Último mes', dias: 30 },
  ],

  /** `nombreCorto` heads the columns of the ranking table. */
  dimensiones: [
    {
      id: 'dedicacion',
      nombre: 'Dedicación',
      nombreCorto: 'Dedicación',
      peso: 20,
      descripcion: 'Participación en las votaciones del Pleno.',
    },
    {
      id: 'debates',
      nombre: 'Participación en debates',
      nombreCorto: 'Debates',
      peso: 20,
      descripcion: 'Intervenciones en el Pleno y en las comisiones. Mide cantidad, no calidad.',
    },
    {
      id: 'iniciativa',
      nombre: 'Iniciativa parlamentaria',
      nombreCorto: 'Iniciativa',
      peso: 20,
      descripcion: 'Preguntas con respuesta escrita y solicitudes de informe firmadas.',
    },
    {
      id: 'resultados',
      nombre: 'Resultados e impacto',
      nombreCorto: 'Resultados',
      peso: 20,
      descripcion:
        'Iniciativas propias que llegan a aprobarse. Sin fuente oficial que las atribuya a diputados concretos.',
    },
    {
      id: 'representacion',
      nombre: 'Representación ciudadana',
      nombreCorto: 'Representación',
      peso: 20,
      descripcion: 'Atención a la circunscripción. Sin fuente oficial.',
    },
  ],

  /** Official sources cited next to every metric. */
  fuentes: {
    votaciones: {
      nombre: 'Congreso de los Diputados · Votaciones',
      url: 'https://www.congreso.es/es/opendata/votaciones',
    },
    intervenciones: {
      nombre: 'Congreso de los Diputados · Intervenciones',
      url: 'https://www.congreso.es/es/opendata/intervenciones',
    },
    iniciativas: {
      nombre: 'Congreso de los Diputados · Buscador de iniciativas',
      url: 'https://www.congreso.es/es/busqueda-de-iniciativas',
    },
  },

  /** `objeto` is the counted thing, singular and plural, for the sentences of the profile. */
  metricas: [
    {
      id: 'votaciones_participacion',
      dimension: 'dedicacion',
      nombre: 'Participación en votaciones de Pleno',
      objeto: ['votación', 'votaciones'],
      calculo:
        'Votos emitidos (sí, no o abstención) ÷ votaciones nominales en cuya lista figura el diputado. No votar no equivale a estar ausente.',
      unidad: 'proporcion',
      estado: 'observado',
      fuente: 'votaciones',
    },
    {
      id: 'intervenciones_pleno',
      dimension: 'debates',
      nombre: 'Intervenciones en Pleno',
      objeto: ['intervención', 'intervenciones'],
      calculo: 'Intervenciones como diputado en el Pleno por cada 100 días en activo.',
      unidad: 'por_100_dias',
      estado: 'observado',
      fuente: 'intervenciones',
    },
    {
      id: 'intervenciones_comision',
      dimension: 'debates',
      nombre: 'Intervenciones en comisión',
      objeto: ['intervención', 'intervenciones'],
      calculo: 'Intervenciones como diputado en comisiones y subcomisiones por cada 100 días en activo.',
      unidad: 'por_100_dias',
      estado: 'observado',
      fuente: 'intervenciones',
    },
    {
      id: 'preguntas_escritas',
      dimension: 'iniciativa',
      nombre: 'Preguntas con respuesta escrita',
      objeto: ['pregunta', 'preguntas'],
      calculo:
        'Preguntas con respuesta escrita al Gobierno y a la Corporación RTVE por cada 100 días en activo. Una pregunta con n firmantes suma 1/n a cada uno.',
      unidad: 'por_100_dias',
      estado: 'calculado',
      fuente: 'iniciativas',
      tiposIniciativa: ['184', '179'],
    },
    {
      id: 'solicitudes_informe',
      dimension: 'iniciativa',
      nombre: 'Solicitudes de informe',
      objeto: ['solicitud', 'solicitudes'],
      calculo:
        'Solicitudes de informe (art. 7 del Reglamento) a la Administración del Estado, comunidades autónomas, entidades locales y otras entidades públicas, por cada 100 días en activo. Una solicitud con n firmantes suma 1/n a cada uno.',
      unidad: 'por_100_dias',
      estado: 'calculado',
      fuente: 'iniciativas',
      tiposIniciativa: ['186', '187', '188', '189'],
    },
    {
      id: 'iniciativas_legislativas',
      dimension: 'iniciativa',
      nombre: 'Iniciativas legislativas firmadas',
      objeto: ['iniciativa', 'iniciativas'],
      calculo: 'Proposiciones de ley con autoría individual por cada 100 días en activo.',
      unidad: 'por_100_dias',
      estado: 'no_disponible',
      motivo: 'Los datos oficiales atribuyen casi todas las proposiciones de ley al grupo, no a diputados concretos.',
    },
    {
      id: 'iniciativas_aprobadas',
      dimension: 'resultados',
      nombre: 'Iniciativas aprobadas',
      objeto: ['iniciativa', 'iniciativas'],
      calculo: 'Iniciativas firmadas que constan como aprobadas.',
      unidad: 'recuento',
      estado: 'no_disponible',
      motivo: 'Los datos oficiales de leyes aprobadas no traen autor ni expediente.',
    },
  ],

  /** Types of body that count for each debate metric. Joint sessions of both chambers count for neither. */
  organosPorMetrica: {
    intervenciones_pleno: ['pleno'],
    intervenciones_comision: ['comision', 'comision_mixta', 'comision_investigacion', 'subcomision'],
  },

  formulas: {
    percentil: 'P_m(i) = 100 · (#{j : x_j < x_i} + 0,5 · #{j : x_j = x_i}) / N',
    dimension: 'S_d(i) = media de los percentiles de las métricas disponibles de la dimensión d',
    global: 'G(i) = Σ_{d ∈ D} w_d · S_d(i) / Σ_{d ∈ D} w_d',
    cobertura: 'cobertura = Σ_{d ∈ D} w_d / Σ_d w_d',
  },

  reglas: [
    {
      id: 'no_disponible_no_es_cero',
      titulo: 'Dato no disponible no es cero',
      texto:
        'Una métrica sin fuente sale del cálculo y su peso se reparte entre las demás. La cobertura se muestra siempre junto al índice.',
    },
    {
      id: 'cobertura_minima',
      titulo: 'Cobertura mínima',
      texto: 'Por debajo del 40 % de cobertura no se publica índice global, solo las métricas individuales.',
    },
    {
      id: 'poblacion_referencia',
      titulo: 'Población de referencia',
      texto:
        'Los percentiles se calculan entre los diputados con al menos 90 días en activo dentro del periodo (la mitad del periodo en los de menos de 180 días). Quien lleva menos aparece con sus métricas brutas y la etiqueta «periodo insuficiente», sin posición.',
    },
    {
      id: 'normalizacion',
      titulo: 'Normalización por oportunidad',
      texto:
        'Los recuentos se dividen por los días en activo. En votaciones solo cuentan aquellas en cuya lista oficial figura el diputado.',
    },
    {
      id: 'gobierno',
      titulo: 'Miembros del Gobierno',
      texto:
        'Los días en que un diputado es miembro del Gobierno no se evalúan, porque su actividad en la Cámara responde a otra función. Quien ha pasado en el Gobierno la mayor parte de sus días como diputado en el periodo, o no reúne los días mínimos fuera de él, no entra en el ranking general: tiene ficha con sus métricas brutas y un filtro permite incluirlo. Los demás se evalúan solo por su etapa fuera del Gobierno.',
    },
    {
      id: 'mesa_y_portavoces',
      titulo: 'Presidencia, Mesa y portavoces',
      texto: 'Entran en el ranking con una etiqueta visible, porque su cargo condiciona sus cifras.',
    },
    {
      id: 'contexto_de_grupo',
      titulo: 'Contexto de grupo',
      texto:
        'Cada métrica muestra también el percentil dentro del grupo parlamentario, porque los turnos de palabra se reparten por grupos. No interviene en la puntuación.',
    },
    {
      id: 'periodos_sin_actividad',
      titulo: 'Periodos sin actividad',
      texto: 'Si en un periodo no hubo votaciones o sesiones, la métrica es «no disponible» para todos.',
    },
    {
      id: 'empates',
      titulo: 'Empates',
      texto: 'Misma puntuación redondeada, misma posición.',
    },
    {
      id: 'diputacion_permanente',
      titulo: 'Diputación Permanente',
      texto: 'La actividad en la Diputación Permanente no cuenta: el índice mide los periodos ordinarios.',
    },
  ],

  noMide: [
    'El trabajo en ponencias a puerta cerrada.',
    'La negociación política.',
    'La atención a la circunscripción.',
    'La calidad de las intervenciones y de las iniciativas.',
  ],

  /** Known limits of what the index does measure; shown on the methodology page. */
  limitaciones: [
    'Las preguntas al Gobierno y las solicitudes de informe son instrumentos de control: los usan sobre todo los diputados de la oposición. Quien apoya al Gobierno puntúa más bajo en esa dimensión por la función que desempeña, no por menor dedicación.',
    'En los grupos pequeños cada diputado interviene en más debates, y en los grandes los turnos se reparten entre más personas. Por eso cada métrica muestra también el percentil dentro del grupo.',
    'No votar no equivale a estar ausente: hay ausencias justificadas, bajas y pactos de no votación que los datos oficiales no distinguen.',
  ],
} as const;

export type Scoring = typeof scoring;
export type MetricConfig = Scoring['metricas'][number];
export type MetricId = MetricConfig['id'];
export type DimensionId = Scoring['dimensiones'][number]['id'];
export type PeriodConfig = Scoring['periodos'][number];
export type PeriodId = PeriodConfig['id'];
export type FuenteId = keyof Scoring['fuentes'];
