import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createNameResolver } from '../pipeline/normalize/names.ts';
import {
  billsFile,
  censusFile,
  interventionsFile,
  organMembersFile,
  parseOrThrow,
  searchInitiativesFile,
  voteFile,
} from '../pipeline/normalize/schemas.ts';
import { daysBetween, failedBlockDays } from '../pipeline/ingest/families/iniciativas.ts';
import { buildDiputados, buildGrupos } from '../pipeline/normalize/tables/diputados.ts';
import { buildOrganos, buildPertenencias, specialRoles } from '../pipeline/normalize/tables/organos.ts';
import {
  buildIniciativas,
  splitRapporteurs,
  expedienteId,
  namesInSegment,
  splitAuthors,
} from '../pipeline/normalize/tables/iniciativas.ts';
import { buildIntervenciones, classifyCargo } from '../pipeline/normalize/tables/intervenciones.ts';
import { buildVotaciones, votacionId, type Terms } from '../pipeline/normalize/tables/votaciones.ts';
import { diputadoId, isoDate, parseCsv, slugFromName, toCsv } from '../pipeline/normalize/util.ts';

const fixture = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf-8'));
const idOf = (name: string) => diputadoId(15, name);

describe('util', () => {
  it('writes sorted, quoted CSV', () => {
    const csv = toCsv(
      ['id', 'texto'],
      [
        { id: 'b', texto: 'con "comillas", y coma' },
        { id: 'a', texto: undefined },
      ],
      ['id'],
    );
    expect(csv).toBe('id,texto\na,\nb,"con ""comillas"", y coma"\n');
  });

  it('converts both official date formats', () => {
    expect(isoDate('30/9/2026')).toBe('2026-09-30');
    expect(isoDate('06/10/2026')).toBe('2026-10-06');
    expect(isoDate(undefined)).toBeUndefined();
  });

  it('derives a stable id and slug from the census name', () => {
    expect(diputadoId(15, 'Ogou i Corbi, Viviane')).toBe(diputadoId(15, 'Ogou i Corbi, Viviane'));
    expect(diputadoId(15, 'Ogou i Corbi, Viviane')).not.toBe(diputadoId(16, 'Ogou i Corbi, Viviane'));
    expect(slugFromName('Moreno Fernández, Mª Isabel')).toBe('maria-isabel-moreno-fernandez');
  });
});

describe('votaciones (fictitious data)', () => {
  const file = voteFile.parse(fixture('ficticio/votacion.json'));
  const census = ['Ficticia Uno, Ana', 'Ficticio Dos, Luis', 'Ficticia Tres, Eva'];
  const resolve = createNameResolver(census, []);
  const terms: Terms = new Map(census.map((name) => [name, { alta: '2023-08-17', baja: undefined }]));
  const source = { legislatura: 15, sesion: 999, numero: 1, zipUrl: 'https://example.org/z.zip', file };

  it('builds one vote and its nominal rows', () => {
    const { votaciones, votos } = buildVotaciones([source], resolve, idOf, terms);
    expect(votaciones[0]).toMatchObject({ votacion_id: votacionId(15, 999, 1), fecha: '2024-03-05', nominal: true });
    expect(votos.map((voto) => [voto.sentido, voto.telematico])).toEqual([
      ['si', false],
      ['no', true],
      ['no_vota', false],
    ]);
  });

  it('fails when a deputy in office is missing from the roster', () => {
    const extra: Terms = new Map([...terms, ['Ficticio Cuatro, Pablo', { alta: '2023-08-17', baja: undefined }]]);
    expect(() => buildVotaciones([source], resolve, idOf, extra)).toThrow(/not in the roster/);
  });

  it('fails when a voter is not in the census', () => {
    const partial = createNameResolver(census.slice(0, 2), []);
    expect(() => buildVotaciones([source], partial, idOf, terms)).toThrow(/voter not in the census/);
  });
});

describe('intervenciones (real reduced sample)', () => {
  const rows = interventionsFile.parse(fixture('congreso/intervenciones/IntervencionesCronologicamente.sample.json'));
  const census = [
    'Gamarra Ruiz-Clavijo, Concepción',
    'Salvador i Duch, Jordi',
    'Agirretxea Urresti, Joseba Andoni',
    'Rodríguez de Millán Parro, María José',
    'Albares Bueno, José Manuel',
    'Álvarez de Toledo Peralta-Ramos, Cayetana',
    'Pueyo Sanz, Jorge',
  ];
  const resolve = createNameResolver(census, []);
  const terms: Terms = new Map(census.map((name) => [name, { alta: '2023-08-01', baja: undefined }]));
  const organs = (label: string) =>
    label === 'Pleno' ? 'pleno' : label === 'Diputación Permanente' ? 'diputacion-permanente' : 'c1-x';
  const result = buildIntervenciones(rows, resolve, idOf, terms, organs, (id) => id === 'diputacion-permanente');

  it('keeps only speeches by census deputies, once per video link', () => {
    expect(result.every((row) => row.diputado_id.startsWith('L15-'))).toBe(true);
    const pueyo = result.filter((row) => row.diputado_id === idOf('Pueyo Sanz, Jorge'));
    expect(pueyo).toHaveLength(1);
    expect(pueyo[0]?.expedientes).toBe('155/000001/0000;155/000002/0000');
  });

  it('counts the formulation of an own oral question once, as an initiative', () => {
    const pueyo = idOf('Pueyo Sanz, Jorge');
    const own = buildIntervenciones(
      rows,
      resolve,
      idOf,
      terms,
      organs,
      (id) => id === 'diputacion-permanente',
      (expediente, diputadoId) => expediente === '155/000002/0000' && diputadoId === pueyo,
    );
    expect(own.find((row) => row.diputado_id === pueyo)).toMatchObject({
      cuenta: false,
      motivo_exclusion: 'pregunta_oral',
    });
    // Other exclusions come first.
    const minister = own.find((row) => row.diputado_id === idOf('Albares Bueno, José Manuel'));
    expect(minister?.motivo_exclusion).toBe('cargo_gobierno');
  });

  it('excludes the Diputación Permanente and government posts', () => {
    const byName = (name: string) => result.find((row) => row.diputado_id === idOf(name));
    expect(byName('Álvarez de Toledo Peralta-Ramos, Cayetana')?.motivo_exclusion).toBe('diputacion_permanente');
    expect(byName('Albares Bueno, José Manuel')?.motivo_exclusion).toBe('cargo_gobierno');
    expect(byName('Gamarra Ruiz-Clavijo, Concepción')?.cuenta).toBe(true);
  });

  it('classifies speaker posts', () => {
    expect(classifyCargo('Diputada')).toBe('diputado');
    expect(classifyCargo('Presidenta de la Comisión de Igualdad')).toBe('cargo_parlamentario');
    expect(classifyCargo('Vicepresidenta Primera del Gobierno y Ministra de Hacienda')).toBe('gobierno');
    expect(classifyCargo('Candidato a la presidencia del Gobierno')).toBe('investidura');
    expect(classifyCargo('Directora General de la Guardia Civil')).toBe('externo');
  });
});

describe('iniciativas (real reduced samples)', () => {
  it('splits signers, including nested group codes and "y N Diputados"', () => {
    expect(
      splitAuthors('Agirretxea Urresti, Joseba Andoni (GV (EAJ-PNV)) Pueyo Sanz, Jorge (GSUMAR)  y 45 Diputados'),
    ).toEqual([
      { text: 'Agirretxea Urresti, Joseba Andoni', group: 'GV (EAJ-PNV)' },
      { text: 'Pueyo Sanz, Jorge', group: 'GSUMAR' },
      { text: 'y 45 Diputados', group: undefined },
    ]);
    expect(expedienteId('122/000001/0000')).toBe('122/000001');
  });

  it('finds signers written without a group code, alone or glued to the next name', () => {
    // Real patterns of the search export: "Catalán Higueras, Alberto" and
    // "Fernández Herranz, Sandra Pérez Coronado, Pablo (GP)".
    const census = ['Catalán Higueras, Alberto', 'Fernández Herranz, Sandra', 'Pérez Coronado, Pablo'];
    const resolve = createNameResolver(census, []);
    expect(namesInSegment('Catalán Higueras, Alberto', resolve)).toEqual(['Catalán Higueras, Alberto']);
    expect(namesInSegment('Fernández Herranz, Sandra Pérez Coronado, Pablo', resolve)).toEqual([
      'Fernández Herranz, Sandra',
      'Pérez Coronado, Pablo',
    ]);
    expect(namesInSegment('Grupo Parlamentario Ficticio', resolve)).toBeUndefined();
    const row = (id: string, autor: string) => ({
      id_iniciativa: id,
      titulo: '',
      fecha_presentado: '01/02/2024',
      fecha_calificado: '',
      autor,
      resultado_tram: '',
    });
    const { firmantes, autoresNoDiputados } = buildIniciativas(
      [],
      new Map([
        [
          '184',
          [
            row('184/000001', 'Catalán Higueras, Alberto'),
            row('184/000002', 'Fernández Herranz, Sandra Pérez Coronado, Pablo (GP)'),
            row('184/000003', 'Senadora Ficticia, Ana (SGPX)'),
          ],
        ],
      ]),
      resolve,
      idOf,
    );
    expect(firmantes.map((f) => [f.iniciativa_id, f.orden, f.n_firmantes, f.grupo_id])).toEqual([
      ['184/000001', 1, 1, undefined],
      ['184/000002', 1, 2, undefined],
      ['184/000002', 2, 2, 'GP'],
    ]);
    expect([...autoresNoDiputados]).toEqual([['Senadora Ficticia, Ana (SGPX)', 1]]);
  });

  it('builds questions with every signer and stops on an unknown deputy', () => {
    const rows = searchInitiativesFile.parse(fixture('congreso/iniciativas/buscador-184.sample.json'));
    const signers = rows.flatMap((row) => splitAuthors(row.autor).map((author) => author.text));
    const resolve = createNameResolver([...new Set(signers)], []);
    const { iniciativas, firmantes } = buildIniciativas([], new Map([['184', rows]]), resolve, idOf);
    expect(iniciativas).toHaveLength(3);
    const multi = iniciativas.find((row) => row.n_firmantes > 1);
    expect(firmantes.filter((row) => row.iniciativa_id === multi?.iniciativa_id)).toHaveLength(multi?.n_firmantes ?? 0);
    const partial = createNameResolver([...new Set(signers)].slice(1), []);
    expect(() => buildIniciativas([], new Map([['184', rows]]), partial, idOf)).toThrow(/signer not in the census/);
  });

  it('reads the rapporteurs of a bill and stops on a name outside the census', () => {
    const bills = billsFile.parse(fixture('congreso/iniciativas/ProyectosDeLey-ponentes.sample.json'));
    const names = splitRapporteurs(bills[0]?.PONENTES);
    expect(names).toHaveLength(15);
    expect(names[0]).toBe('Acedo Reyes, Sofía');
    const resolve = createNameResolver(names, []);
    const { iniciativas, ponentes } = buildIniciativas(bills, new Map(), resolve, idOf);
    expect(iniciativas[0]).toMatchObject({
      iniciativa_id: '121/000001',
      resultado: 'Aprobado con modificaciones',
      fecha_resultado: '2024-09-10',
      // Start of the "Concluido" phase: the Congreso's last vote, before the file closes.
      fecha_conclusion: '2024-07-23',
    });
    expect(ponentes).toHaveLength(15);
    expect(ponentes[0]).toEqual({ iniciativa_id: '121/000001', orden: 1, diputado_id: idOf('Acedo Reyes, Sofía') });
    const partial = createNameResolver(names.slice(1), []);
    expect(() => buildIniciativas(bills, new Map(), partial, idOf)).toThrow(/rapporteur not in the census/);
  });

  it('splits the rapporteur field into names', () => {
    expect(splitRapporteurs('A, B \nC, D \n')).toEqual(['A, B', 'C, D']);
    expect(splitRapporteurs(undefined)).toEqual([]);
  });

  it('keeps group authorship of bills without signers', () => {
    const bills = billsFile.parse(fixture('congreso/iniciativas/ProposicionesDeLey.sample.json'));
    const { iniciativas } = buildIniciativas(
      bills.filter((bill) => bill.AUTOR === 'Senado'),
      new Map(),
      () => undefined,
      idOf,
    );
    expect(iniciativas[0]).toMatchObject({ autor: 'Senado', n_firmantes: 0, tipo_codigo: '124' });
  });
});

describe('diputados and organos', () => {
  const census = censusFile.parse(fixture('congreso/diputados/DiputadosActivos.sample.json'));
  const search = census.map((row, index) => ({
    apellidosNombre: row.NOMBRE,
    codParlamentario: 100 + index,
    idCircunscripcion: 28,
    nombreCircunscripcion: row.CIRCUNSCRIPCION,
    formacion: row.FORMACIONELECTORAL,
    grupo: row.GRUPOPARLAMENTARIO,
    fchAlta: row.FECHAALTA,
    fchBaja: '',
    idLegislatura: 15,
  }));

  it('builds deputies with official code, group code, party and profile link', () => {
    const [first] = buildDiputados(census, search, new Map([[census[0]?.NOMBRE ?? '', ['portavoz']]]));
    expect(first).toMatchObject({
      nombre_completo: 'Abascal Conde, Santiago',
      nombre: 'Santiago',
      apellidos: 'Abascal Conde',
      slug: 'santiago-abascal-conde',
      grupo_id: 'GVOX',
      partido: 'VOX',
      cod_parlamentario: 100,
      rol_especial: 'portavoz',
    });
    expect(first?.url_ficha_oficial).toContain('codParlamentario=100');
  });

  it('stops when the census and the deputy search disagree', () => {
    expect(() => buildDiputados(census, search.slice(1), new Map())).toThrow(/disagree/);
  });

  it('keeps deputies, drops senators and legal staff, and stops on unknown names', () => {
    const miembros = organMembersFile.parse(
      fixture('congreso/organos/Composicion_Comision_Constitucional_15.sample.json'),
    );
    const composition = {
      organoSup: 1,
      suborgano: '301',
      nombre: 'Comisión Constitucional',
      miembros: [
        ...miembros,
        {
          Nombre: 'Senador Ficticio, Pedro',
          Cargo: 'Vocales',
          FechaAlta: '01/01/2024',
          NombreOrgano: 'X',
          Grupo: 'SGPP',
        },
        { Nombre: 'Letrada Ficticia, Ana', Cargo: 'Letrados', FechaAlta: '01/01/2024', NombreOrgano: 'X', Grupo: '' },
      ],
    };
    const names = miembros.map((member) => member.Nombre);
    const rows = buildPertenencias([composition], createNameResolver(names, []), idOf);
    // The real sample already includes two committee lawyers (Letrados), also excluded.
    expect(rows).toHaveLength(miembros.filter((member) => !/^Letrad/.test(member.Cargo)).length);
    expect(rows.every((row) => row.organo_id === 'c1-301')).toBe(true);
    expect(() => buildPertenencias([composition], createNameResolver(names.slice(1), []), idOf)).toThrow(
      /not in the census/,
    );
    expect(buildOrganos([composition]).find((row) => row.organo_id === 'c1-301')?.tipo).toBe('comision');
  });
});

describe('initiatives recovery', () => {
  const row = (fecha_calificado: string) => ({
    id_iniciativa: '184/000001',
    titulo: '',
    fecha_presentado: '',
    fecha_calificado,
    autor: '',
    resultado_tram: '',
  });

  it('lists every day of a range, across months and leap days', () => {
    expect(daysBetween('28/02/2024', '01/03/2024')).toEqual(['28/02/2024', '29/02/2024', '01/03/2024']);
  });

  it('dates a failed export block from its neighbours (newest first)', () => {
    // Real case: block 154 failed between blocks qualified on 21/10/2025 and 14/10/2025.
    const blocks = [[row('21/10/2025')], undefined, [row('21/10/2025'), row('14/10/2025')]];
    expect(failedBlockDays(blocks)).toEqual(['21/10/2025']);
  });

  it('cannot date a failed block without neighbours', () => {
    expect(() => failedBlockDays([undefined])).toThrow(/Cannot date/);
  });
});

describe('roles, groups and schema errors (fictitious data)', () => {
  const member = (Nombre: string, Cargo: string, Grupo = 'GX') => ({
    Nombre,
    Cargo,
    FechaAlta: '01/01/2024',
    FechaBaja: '',
    NombreOrgano: 'Órgano ficticio',
    Grupo,
  });
  const resolve = (name: string) => (name.startsWith('Ficticio') ? name : undefined);

  it('derives the Mesa and spokesperson roles, skipping senators and legal staff', () => {
    const roles = specialRoles(
      [
        {
          organoSup: 100,
          suborgano: '0',
          nombre: 'Mesa',
          miembros: [member('Ficticio Uno, Ana', 'Presidenta'), member('Ficticio Dos, Blas', 'Letrado Mayor')],
        },
        {
          organoSup: 300,
          suborgano: '0',
          nombre: 'Junta de Portavoces',
          miembros: [
            member('Ficticio Tres, Carla', 'Portavoces titulares'),
            member('Ficticio Cuatro, Dario', 'Portavoces adjuntos'),
            member('Ficticio Cinco, Eva', 'Portavoces titulares', 'SGPX'),
            member('Nadie, Nadie', 'Portavoces titulares'),
          ],
        },
      ],
      resolve,
    );
    expect(roles.get('Ficticio Uno, Ana')).toEqual(['mesa']);
    expect(roles.get('Ficticio Tres, Carla')).toEqual(['portavoz']);
    for (const name of ['Ficticio Dos, Blas', 'Ficticio Cuatro, Dario', 'Ficticio Cinco, Eva', 'Nadie, Nadie']) {
      expect(roles.has(name)).toBe(false);
    }
    // Members of the Government come from config/overrides.ts.
    expect([...roles.values()].filter((list) => list.includes('gobierno')).length).toBeGreaterThan(0);
  });

  it('lists every parliamentary group with its members in the census', () => {
    const grupos = buildGrupos([]);
    expect(grupos.length).toBeGreaterThan(0);
    expect(grupos.every((grupo) => grupo.miembros_censo === 0)).toBe(true);
  });

  it('names the file and the first problems when a schema check fails', () => {
    expect(() => parseOrThrow(censusFile, [{ NOMBRE: 1 }], 'Ficticio.json')).toThrow(
      /Schema check failed for Ficticio\.json: 0\./,
    );
  });

  it('rejects malformed CSV', () => {
    expect(() => parseCsv('a\n"x"y\n')).toThrow(/Unexpected character/);
  });
});
