import { useCatalog } from '../../lib/catalog/useCatalog';

export interface GameFormatSelection {
  game: string;
  format: string;
}

interface Props {
  selection: GameFormatSelection;
  onChange: (selection: GameFormatSelection) => void;
  /** Etiquetas accesibles */
  gameLabel?: string;
  formatLabel?: string;
  /** Deshabilita ambos selects (p. ej. al editar un mazo existente) */
  disabled?: boolean;
  /** Muestra el error de validación bajo el select de formato */
  formatError?: string;
}

/**
 * Selector juego → formato basado en el catálogo del backend (`GET /games`).
 *
 * Cambiar de juego resetea el formato al primero del nuevo juego, porque los
 * formatos son específicos de cada juego.
 */
export function GameFormatSelector({
  selection,
  onChange,
  gameLabel = 'Juego',
  formatLabel = 'Formato',
  disabled = false,
  formatError,
}: Props) {
  const { status, games, errorMessage } = useCatalog();

  if (status === 'error') {
    return (
      <p className="text-sm text-red-400" role="alert">
        No se pudieron cargar los juegos: {errorMessage}
      </p>
    );
  }

  if (status !== 'ready') {
    return (
      <p className="text-sm text-slate-400" role="status">
        Cargando juegos…
      </p>
    );
  }

  const activeGame = games.find((game) => game.code === selection.game) ?? games[0];
  const formats = activeGame?.formats ?? [];
  const activeFormat =
    formats.find((format) => format.code === selection.format) ?? formats[0];

  function handleGameChange(gameCode: string) {
    const game = games.find((g) => g.code === gameCode);
    const firstFormat = game?.formats?.[0];
    onChange({
      game: gameCode,
      format: firstFormat?.code ?? '',
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="game-select" className="text-sm font-medium text-slate-300">
          {gameLabel}
        </label>
        <select
          id="game-select"
          value={activeGame?.code ?? ''}
          disabled={disabled}
          onChange={(e) => handleGameChange(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60"
        >
          {games.map((game) => (
            <option key={game.code} value={game.code}>
              {game.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="format-select" className="text-sm font-medium text-slate-300">
          {formatLabel}
        </label>
        <select
          id="format-select"
          value={activeFormat?.code ?? ''}
          disabled={disabled || formats.length === 0}
          aria-invalid={formatError ? true : undefined}
          onChange={(e) => onChange({ game: activeGame?.code ?? '', format: e.target.value })}
          className={`rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60 ${
            formatError ? 'border-red-500' : 'border-slate-700'
          }`}
        >
          {formats.map((format) => (
            <option key={format.code} value={format.code}>
              {format.name}
            </option>
          ))}
        </select>
        {formatError && <p className="text-xs text-red-400">{formatError}</p>}
      </div>
    </div>
  );
}

/** Resumen legible de las reglas del formato (para mostrar en el editor). */
export function FormatRulesSummary({ game, format }: GameFormatSelection) {
  const { formatsByGame } = useCatalog();
  const rules = formatsByGame[game]?.find((f) => f.code === format);

  if (!rules) return null;

  const parts: string[] = [];
  if (rules.deck_size) parts.push(`${rules.deck_size} cartas`);
  if (rules.min_size || rules.max_size) {
    parts.push(`entre ${rules.min_size ?? '?'} y ${rules.max_size ?? '?'}`);
  }
  if (rules.requires_leader) parts.push('requiere líder');

  if (parts.length === 0) return null;

  return <p className="text-xs text-slate-400">Reglas: {parts.join(' · ')}</p>;
}
