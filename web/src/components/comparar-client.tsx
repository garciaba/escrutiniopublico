/** Browser entry of the comparison page. */
import { hydrate } from 'preact';
import { CompararApp, type CompararProps } from './Comparar.tsx';

export function boot(): void {
  const source = document.getElementById('ranking-data');
  const host = document.getElementById('comparar-app');
  if (!source?.textContent || !host) return;
  hydrate(<CompararApp {...(JSON.parse(source.textContent) as CompararProps)} />, host);
}
