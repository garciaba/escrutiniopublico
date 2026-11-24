/** Browser entry of the home page: hands the static list and its controls over to Preact. */
import { hydrate } from 'preact';
import { RankingApp, type AppProps } from './RankingTable.tsx';

export function boot(): void {
  const source = document.getElementById('ranking-data');
  const host = document.getElementById('ranking-app');
  if (!source?.textContent || !host) return;
  hydrate(<RankingApp {...(JSON.parse(source.textContent) as AppProps)} />, host);
}
