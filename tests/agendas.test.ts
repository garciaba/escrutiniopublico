import { describe, expect, it } from 'vitest';

import {
  parseAgendaTime,
  sanitizeAgendaEntry,
  sortAgendaEntries,
  toSpanishDate,
  weekMondays,
  type RawAgendaEntry,
} from '../pipeline/ingest/agendas.ts';

const bodies = new Set(['Pleno', 'Comisión de Hacienda y Función Pública']);

// Shapes copied from real responses of the agenda resource (23/11/2026); the personal
// label below is a placeholder, not a real entry.
const institutional: RawAgendaEntry = {
  fechaAgenda: '2026-09-29',
  agendaCodOrgAbr: 'Pleno',
  horaAgenda2: '',
  horaAgenda1: '2001-01-01T15:00:00.000+01:00',
  textoAgenda: '',
};
const personal: RawAgendaEntry = {
  fechaAgenda: '2026-09-23',
  agendaCodOrgAbr: 'Reunión con una entidad de ejemplo',
  horaAgenda2: '2001-01-01T11:30:00.000+01:00',
  horaAgenda1: '2001-01-01T10:00:00.000+01:00',
  textoAgenda: '',
};

describe('parseAgendaTime', () => {
  it('reads the time of day from the placeholder date', () => {
    expect(parseAgendaTime('2001-01-01T09:05:00.000+01:00')).toBe('09:05');
    expect(parseAgendaTime('')).toBeUndefined();
  });
});

describe('sanitizeAgendaEntry', () => {
  it('keeps the body of institutional entries', () => {
    expect(sanitizeAgendaEntry(institutional, bodies)).toEqual({
      fecha: '2026-09-29',
      horaInicio: '15:00',
      tipo: 'institucional',
      organo: 'Pleno',
    });
  });

  it('never keeps the text of personal entries', () => {
    const entry = sanitizeAgendaEntry(personal, bodies);
    expect(entry).toEqual({ fecha: '2026-09-23', horaInicio: '10:00', horaFin: '11:30', tipo: 'personal' });
    expect(JSON.stringify(entry)).not.toContain('entidad');
  });

  it('treats labels that are not an exact official body as personal', () => {
    expect(
      sanitizeAgendaEntry({ ...institutional, agendaCodOrgAbr: 'Comisión Ejecutiva del partido' }, bodies).tipo,
    ).toBe('personal');
  });

  it('treats an official label with free text as personal', () => {
    const entry = sanitizeAgendaEntry({ ...institutional, textoAgenda: 'Nota libre' }, bodies);
    expect(entry.tipo).toBe('personal');
    expect(entry).not.toHaveProperty('organo');
  });
});

describe('sortAgendaEntries', () => {
  it('orders by date and time', () => {
    const sorted = sortAgendaEntries([
      sanitizeAgendaEntry(institutional, bodies),
      sanitizeAgendaEntry(personal, bodies),
    ]);
    expect(sorted.map((entry) => entry.fecha)).toEqual(['2026-09-23', '2026-09-29']);
  });
});

describe('weekMondays', () => {
  it('lists the Monday of every overlapping week', () => {
    expect(weekMondays('2023-08-17', '2023-08-28')).toEqual(['2023-08-14', '2023-08-21', '2023-08-28']);
  });
});

describe('toSpanishDate', () => {
  it('converts yyyy-mm-dd to dd/mm/yyyy', () => {
    expect(toSpanishDate('2026-09-21')).toBe('21/09/2026');
  });
});
