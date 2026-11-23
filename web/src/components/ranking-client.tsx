/** Browser entry of the home page: hands the static controls and table over to Preact. */
import { hydrate } from 'preact';
import type { RankingData } from '../lib/ranking.ts';
import { RankingApp } from './RankingTable.tsx';

interface Payload {
  data: RankingData;
  ejecutado: string;
  horasAviso: number;
  legislaturaFinalizada: boolean;
}

export function boot(): void {
  const source = document.getElementById('ranking-data');
  const host = document.getElementById('ranking-controles');
  const table = document.getElementById('ranking-tabla');
  if (!source?.textContent || !host || !table) return;
  const payload = JSON.parse(source.textContent) as Payload;
  hydrate(<RankingApp {...payload} thead={table.querySelector('thead')} tbody={table.querySelector('tbody')} />, host);
}
