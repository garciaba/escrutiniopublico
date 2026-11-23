/**
 * zod schemas for every official input (docs/data-dictionary.md, section 3). Fields
 * ESCAÑO uses are required and format-checked; extra fields the Congreso may add are
 * tolerated (looseObject). A file that fails its schema stops the run (section 6).
 */
import { z } from 'zod';

const ddmmyyyy = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'expected dd/mm/yyyy');
const dmyyyy = z.string().regex(/^\d{1,2}\/\d{1,2}\/\d{4}$/, 'expected d/m/yyyy');
const fullName = z.string().regex(/^[^,]+, [^,]+$/, 'expected "Apellidos, Nombre"');

/** DiputadosActivos and DiputadosDeBaja (JSON). BIOGRAFIA is never read (D-014). */
export const censusRow = z.looseObject({
  NOMBRE: fullName,
  CIRCUNSCRIPCION: z.string().min(1),
  FORMACIONELECTORAL: z.string().min(1),
  FECHACONDICIONPLENA: ddmmyyyy,
  FECHAALTA: ddmmyyyy,
  FECHABAJA: ddmmyyyy.optional(),
  GRUPOPARLAMENTARIO: z.string().min(1),
  FECHAALTAENGRUPOPARLAMENTARIO: ddmmyyyy,
  FECHABAJAENGRUPOPARLAMENTARIO: ddmmyyyy.optional(),
});
export const censusFile = z.array(censusRow).min(1);
export type CensusRow = z.infer<typeof censusRow>;

/** Deputy search resource (D-015). */
export const searchDeputy = z.looseObject({
  apellidosNombre: fullName,
  codParlamentario: z.number().int().positive(),
  idCircunscripcion: z.number().int(),
  nombreCircunscripcion: z.string(),
  formacion: z.string(),
  grupo: z.string(),
  fchAlta: ddmmyyyy,
  fchBaja: z.union([ddmmyyyy, z.literal('')]),
  idLegislatura: z.number().int(),
});
export const searchDeputiesFile = z.looseObject({ data: z.array(searchDeputy).min(1) });
export type SearchDeputy = z.infer<typeof searchDeputy>;

/** One vote file extracted from a session ZIP. */
export const voteFile = z.looseObject({
  informacion: z.looseObject({
    sesion: z.number().int().positive(),
    numeroVotacion: z.number().int().positive(),
    fecha: dmyyyy,
    titulo: z.string(),
    textoExpediente: z.string(),
    tituloSubGrupo: z.string(),
    textoSubGrupo: z.string(),
    votacionesConjuntas: z.array(z.looseObject({ textoExpediente: z.string() })),
  }),
  totales: z.looseObject({
    asentimiento: z.enum(['Sí', 'No']),
    presentes: z.number().int().nonnegative(),
    afavor: z.number().int().nonnegative(),
    enContra: z.number().int().nonnegative(),
    abstenciones: z.number().int().nonnegative(),
    noVotan: z.number().int().nonnegative(),
  }),
  votaciones: z.array(
    z.looseObject({
      asiento: z.string().regex(/^-1$|^\d+$/),
      diputado: fullName,
      grupo: z.string(),
      voto: z.enum(['Sí', 'No', 'Abstención', 'No vota']),
    }),
  ),
});
export type VoteFile = z.infer<typeof voteFile>;

/** IntervencionesCronologicamente (JSON). */
export const interventionRow = z.looseObject({
  LEGISLATURA: z.string(),
  SESION: ddmmyyyy,
  ORGANO: z.string().min(1),
  TIPOINTERVENCION: z.enum(['Intervención', 'Votación']),
  ENLACEDIFERIDO: z.string().regex(/^https:\/\/app\.congreso\.es\/v\d+\/\S+/),
  ORADOR: z.string().optional(),
  CARGOORADOR: z.string().optional(),
  FASE: z.string().optional(),
  INICIOINTERVENCION: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  FININTERVENCION: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  TIPOINICIATIVA: z.string().optional(),
  NUMEXPEDIENTE: z.string().optional(),
  OBJETOINICIATIVA: z.string().optional(),
  ENLACETEXTOINTEGRO: z.string().optional(),
  ENLACEPDF: z.string().optional(),
  ENLACEDESCARGADIRECTA: z.string().optional(),
});
export const interventionsFile = z.array(interventionRow).min(1);
export type InterventionRow = z.infer<typeof interventionRow>;

/** ProyectosDeLey, ProposicionesDeLey and PropuestasDeReforma (JSON). */
export const billRow = z.looseObject({
  NUMEXPEDIENTE: z.string().regex(/^\d{3}\/\d{6}\/\d{4}$/),
  TIPO: z.string().min(1),
  OBJETO: z.string(),
  FECHAPRESENTACION: ddmmyyyy,
  FECHACALIFICACION: ddmmyyyy.optional(),
  AUTOR: z.string(),
  RESULTADOTRAMITACION: z.string().optional(),
  SITUACIONACTUAL: z.string().optional(),
  ENLACESBOCG: z.string().optional(),
});
export const billsFile = z.array(billRow);
export type BillRow = z.infer<typeof billRow>;

/** Rows of the initiatives search export (D-016). */
export const searchInitiativeRow = z.looseObject({
  id_iniciativa: z.string().regex(/^\d{3}\/\d{6}$/),
  titulo: z.string(),
  fecha_presentado: z.union([ddmmyyyy, z.literal('')]),
  fecha_calificado: z.union([ddmmyyyy, z.literal('')]),
  autor: z.string(),
  resultado_tram: z.string(),
  enlaces_bocg: z.string().optional(),
});
export const searchInitiativesFile = z.array(searchInitiativeRow);
export type SearchInitiativeRow = z.infer<typeof searchInitiativeRow>;

/** Committee list resource. */
export const organListFile = z.looseObject({
  datosOrganos: z.array(z.looseObject({ urlExport: z.string(), descOrgano: z.string(), indexOrgano: z.number() })),
});

/** Composition export of one body. */
export const organMemberRow = z.looseObject({
  Nombre: fullName,
  Cargo: z.string(),
  FechaAlta: ddmmyyyy,
  // Empty for current members in some exports (Diputación Permanente).
  FechaBaja: z.union([ddmmyyyy, z.literal('')]).optional(),
  NombreOrgano: z.string(),
  Grupo: z.string().optional(),
});
export const organMembersFile = z.array(organMemberRow);
export type OrganMemberRow = z.infer<typeof organMemberRow>;

/** Parses with a schema and reports the file name and the first problems on failure. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, source: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Schema check failed for ${source}: ${issues}`);
}
