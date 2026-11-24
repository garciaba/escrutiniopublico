/**
 * Side-by-side comparison of up to three deputies (decision D-038): index, position
 * and each dimension, for the period chosen. The selection lives in the URL, so a
 * comparison can be shared. Rendered empty at build time; the browser fills it in.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { num } from '../lib/format.ts';
import {
  buscarDiputados,
  escribirComparar,
  estadoInicial,
  filasDe,
  leerComparar,
  MAX_COMPARAR,
  type Fila,
  type RankingData,
} from '../lib/ranking.ts';
import { PuntoGrupo, Puntuacion } from './parts.tsx';

const SUGERENCIAS = 6;

export interface CompararProps {
  data: RankingData;
}

export function CompararApp({ data }: CompararProps) {
  const periodoInicial = useMemo(() => estadoInicial(data).periodo, [data]);
  const [activo, setActivo] = useState(false);
  const [slugs, setSlugs] = useState<readonly string[]>([]);
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [q, setQ] = useState('');

  useEffect(() => {
    const leer = () => {
      const pedido = new URLSearchParams(window.location.search).get('periodo') ?? '';
      setSlugs(leerComparar(window.location.search, data));
      setPeriodo(data.periodos.some((p) => p.id === pedido && p.disponible) ? pedido : periodoInicial);
    };
    leer();
    setActivo(true);
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, [data, periodoInicial]);

  useEffect(() => {
    if (!activo) return;
    const params = new URLSearchParams(escribirComparar(slugs));
    if (periodo !== periodoInicial) params.set('periodo', periodo);
    // Commas between deputies stay readable in the address.
    const consulta = params.size > 0 ? `?${params.toString().replace(/%2C/g, ',')}` : '';
    if (consulta !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${consulta}`);
    }
  }, [activo, slugs, periodo, periodoInicial]);

  const filas = useMemo(() => new Map(filasDe(data, periodo).map((fila) => [fila.slug, fila])), [data, periodo]);
  const elegidos = slugs.map((slug) => filas.get(slug)).filter((fila): fila is Fila => fila !== undefined);
  const lleno = slugs.length >= MAX_COMPARAR;
  const sugerencias = useMemo(
    () => (lleno ? [] : buscarDiputados(data, q, SUGERENCIAS + slugs.length).filter((d) => !slugs.includes(d[0]))),
    [data, q, slugs, lleno],
  );
  const grupos = new Map(data.grupos.map((grupo) => [grupo.id, grupo]));
  const grupoDe = new Map(filasDe(data, periodoInicial).map((fila) => [fila.slug, fila.grupo]));
  const disponibles = data.periodos.filter((p) => p.disponible);

  return (
    <div class="comparar-app">
      <div class="comparar-buscar" role="search">
        <div class="barra-buscar">
          <label class="sr" for="comparar-q">
            Añadir un diputado a la comparación
          </label>
          <input
            id="comparar-q"
            type="search"
            placeholder={lleno ? `Máximo ${MAX_COMPARAR} diputados` : 'Añadir diputado'}
            autocomplete="off"
            spellcheck={false}
            maxLength={80}
            disabled={!activo || lleno}
            value={q}
            onInput={(event) => setQ(event.currentTarget.value)}
          />
        </div>
        {sugerencias.length > 0 ? (
          <ul class="sugerencias tarjeta" aria-label="Diputados que coinciden">
            {sugerencias.slice(0, SUGERENCIAS).map(([slug, nombre, , circunscripcion]) => {
              const grupo = grupos.get(grupoDe.get(slug) ?? '');
              return (
                <li key={slug}>
                  <button
                    type="button"
                    onClick={() => {
                      setSlugs((previos) => [...previos, slug].slice(0, MAX_COMPARAR));
                      setQ('');
                    }}
                  >
                    <span class="nombre">{nombre}</span>
                    <span class="meta">
                      <PuntoGrupo color={grupo?.color ?? '#9c9c9c'} />
                      {grupo?.nombre ?? ''} · {circunscripcion}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : q.trim() && !lleno && activo ? (
          <p class="muted sugerencias-vacio" role="status">
            Ningún diputado coincide.
          </p>
        ) : null}
      </div>

      {disponibles.length > 1 ? (
        <fieldset class="segmento" disabled={!activo}>
          <legend>Periodo</legend>
          <div class="segmento-opciones">
            {disponibles.map((p) => (
              <label key={p.id}>
                <input
                  type="radio"
                  name="comparar-periodo"
                  value={p.id}
                  checked={periodo === p.id}
                  onChange={() => setPeriodo(p.id)}
                />
                {p.nombre}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {elegidos.length === 0 ? (
        <p class="comparar-vacio tarjeta">{activo ? 'Busca un diputado para empezar.' : 'Cargando…'}</p>
      ) : (
        <div class="tarjeta comparacion-marco">
          <table class="comparacion" id="comparacion">
            <caption class="sr">Comparación de diputados: índice, posición y puntuación por dimensión</caption>
            <thead>
              <tr>
                <td></td>
                {elegidos.map((fila) => {
                  const grupo = grupos.get(fila.grupo);
                  return (
                    <th scope="col" key={fila.slug}>
                      <a href={`/diputados/${fila.slug}`}>{fila.nombre}</a>
                      <span class="meta">
                        <PuntoGrupo color={grupo?.color ?? '#9c9c9c'} />
                        {grupo?.nombre ?? fila.grupo} · {fila.circunscripcion}
                      </span>
                      <button
                        type="button"
                        class="chip"
                        onClick={() => setSlugs((previos) => previos.filter((slug) => slug !== fila.slug))}
                      >
                        Quitar<span class="sr"> a {fila.nombre}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr class="principal">
                <th scope="row">Índice</th>
                {elegidos.map((fila) => (
                  <td key={fila.slug}>
                    <Puntuacion valor={fila.indice} />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Posición</th>
                {elegidos.map((fila) => (
                  <td key={fila.slug}>
                    {fila.posicion === null ? (
                      <span class="nd">
                        <span aria-hidden="true">—</span>
                        <span class="sr">Sin posición</span>
                      </span>
                    ) : (
                      <span class="valor">{num(fila.posicion)}.º</span>
                    )}
                  </td>
                ))}
              </tr>
              {data.dimensiones.map((dimension, i) => (
                <tr key={dimension.id}>
                  <th scope="row" title={dimension.nombre}>
                    {dimension.corto}
                  </th>
                  {elegidos.map((fila) => (
                    <td key={fila.slug}>
                      <Puntuacion valor={fila.dims[i]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
