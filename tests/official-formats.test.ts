/**
 * Facts about the official files found in milestone 0 (docs/data-dictionary.md),
 * pinned against real reduced samples so a format change is noticed.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { decodeText } from '../pipeline/discover/profile.ts';

function sample<T = Record<string, unknown>[]>(path: string): T {
  return JSON.parse(decodeText(readFileSync(new URL(`./fixtures/congreso/${path}`, import.meta.url)))) as T;
}

const DATE = /^\d{2}\/\d{2}\/\d{4}$/;

describe('diputados', () => {
  const activos = sample('diputados/DiputadosActivos.sample.json');
  const baja = sample('diputados/DiputadosDeBaja.sample.json');

  it('has no official identifier: the name is "Apellidos, Nombre"', () => {
    for (const row of [...activos, ...baja]) {
      expect(Object.keys(row).some((key) => /ID|COD/i.test(key))).toBe(false);
      expect(row.NOMBRE).toMatch(/^[^,]+, [^,]+$/);
    }
  });

  it('uses dd/mm/yyyy dates and omits empty fields in JSON', () => {
    for (const row of activos) {
      expect(row.FECHAALTA).toMatch(DATE);
      expect(row).not.toHaveProperty('FECHABAJAENGRUPOPARLAMENTARIO');
    }
    for (const row of baja) expect(row.FECHABAJA).toMatch(DATE);
  });
});

interface VoteFile {
  informacion: { sesion: number; numeroVotacion: number; fecha: string; votacionesConjuntas: unknown[] };
  totales: { presentes: number; afavor: number; enContra: number; abstenciones: number; noVotan: number };
  votaciones: { asiento: string; diputado: string; grupo: string; voto: string }[];
}

describe('votaciones', () => {
  const vote = sample<VoteFile>('votaciones/sesion202votacion1.sample.json');

  it('is nominal: one row per deputy with seat, name, group code and vote', () => {
    expect(vote.votaciones.length).toBeGreaterThan(0);
    for (const row of vote.votaciones) {
      expect(['Sí', 'No', 'Abstención', 'No vota']).toContain(row.voto);
      expect(row.asiento).toMatch(/^-1$|^\d+$/);
      expect(row.diputado).toMatch(/^[^,]+, [^,]+$/);
    }
  });

  it('counts "presentes" as yes + no + abstention, excluding "No vota"', () => {
    const { presentes, afavor, enContra, abstenciones } = vote.totales;
    expect(presentes).toBe(afavor + enContra + abstenciones);
  });

  it('writes the date without zero padding', () => {
    expect(vote.informacion.fecha).toBe('30/9/2026');
  });

  it('publishes secret ballots with totals but no nominal rows', () => {
    const secret = sample<VoteFile>('votaciones/sesion202votacion21.json');
    expect(secret.votaciones).toEqual([]);
    expect(secret.totales.presentes).toBe(340);
  });

  it('groups joint votes under votacionesConjuntas', () => {
    const joint = sample<VoteFile>('votaciones/sesion40votacion52.sample.json');
    expect(joint.informacion.votacionesConjuntas.length).toBeGreaterThan(0);
  });
});

describe('intervenciones', () => {
  const rows = sample('intervenciones/IntervencionesCronologicamente.sample.json');
  const GROUP_SUFFIX = /\s*\(((?:[^()]|\([^()]*\))*)\)\s*$/;

  it('usually appends the group code to the speaker name, sometimes nested', () => {
    const groups = rows
      .map((row) => GROUP_SUFFIX.exec(String(row.ORADOR ?? ''))?.[1])
      .filter((group) => group !== undefined);
    expect(groups).toContain('GV (EAJ-PNV)');
    expect(groups).toContain('GP');
  });

  it('includes rows that are not speeches: votes have no speaker', () => {
    const votes = rows.filter((row) => row.TIPOINTERVENCION === 'Votación');
    expect(votes.length).toBeGreaterThan(0);
    for (const row of votes) expect(row).not.toHaveProperty('ORADOR');
  });

  it('repeats one speech per initiative debated jointly (same video link)', () => {
    const byLink = new Map<string, Set<unknown>>();
    for (const row of rows) {
      const link = String(row.ENLACEDIFERIDO);
      byLink.set(link, (byLink.get(link) ?? new Set()).add(row.NUMEXPEDIENTE));
    }
    expect([...byLink.values()].some((expedientes) => expedientes.size > 1)).toBe(true);
  });

  it('distinguishes Pleno, committees and Diputación Permanente in ORGANO', () => {
    const organos = new Set(rows.map((row) => String(row.ORGANO).split(' ')[0]));
    expect(organos).toEqual(new Set(['Pleno', 'Comisión', 'Diputación']));
  });
});

describe('iniciativas', () => {
  it('attributes almost every bill to a group, not to individual deputies', () => {
    const rows = sample('iniciativas/ProposicionesDeLey.sample.json');
    const byDeputies = rows.filter((row) => row.TIPO === 'Proposición de ley de Diputados');
    expect(byDeputies.map((row) => String(row.AUTOR))).toContainEqual(expect.stringContaining('y 45 Diputados'));
  });

  it('lists approved laws without author or file number', () => {
    for (const row of sample('iniciativas/IniciativasLegislativasAprobadas.sample.json')) {
      expect(Object.keys(row).sort()).toEqual([
        'FECHA_BOLETIN',
        'FECHA_LEY',
        'NUMERO_BOLETIN',
        'NUMERO_LEY',
        'PDF',
        'TIPO',
        'TITULO_LEY',
      ]);
    }
  });
});

describe('organos', () => {
  it('exports composition with name, post, dates and group code', () => {
    for (const row of sample('organos/Composicion_Comision_Constitucional_15.sample.json')) {
      expect(Object.keys(row)).toEqual(
        expect.arrayContaining(['Nombre', 'Cargo', 'FechaAlta', 'NombreOrgano', 'Grupo']),
      );
      expect(row.FechaAlta).toMatch(DATE);
    }
  });
});
