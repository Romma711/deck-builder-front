import { useCatalog } from '../../lib/catalog/useCatalog';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { reloadCatalog } from '../../lib/catalog/catalog';

/**
 * Catálogo público de juegos con sus formatos y reglas (GET /games).
 * Isle de client:load — el backend responde el listado completo.
 */
export function GamesCatalog() {
  const { status, games, errorMessage } = useCatalog();

  if (status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert title="No se pudieron cargar los juegos" message={errorMessage} />
        <Button variant="secondary" onClick={() => void reloadCatalog()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <p className="text-sm text-slate-400" role="status">
        Cargando catálogo…
      </p>
    );
  }

  if (games.length === 0) {
    return <Alert title="No hay juegos activos" message="Consultá el backend /api/v3/games." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {games.map((game) => (
        <section
          key={game.code}
          className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{game.name}</h2>
            <p className="text-xs uppercase tracking-wide text-slate-500">{game.code}</p>
          </div>

          {(game.formats ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Sin formatos configurados todavía.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-800">
              {(game.formats ?? []).map((format) => (
                <li key={format.code} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{format.name}</p>
                    <p className="text-xs text-slate-500">{format.code}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-xs text-slate-400">
                    {format.deck_size && <span>{format.deck_size} cartas</span>}
                    {(format.min_size || format.max_size) && (
                      <span>
                        {format.min_size ?? '?'}–{format.max_size ?? '?'} cartas
                      </span>
                    )}
                    {format.requires_leader && <span className="text-indigo-400">Requiere líder</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
