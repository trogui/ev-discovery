import { presetsFor, usePresets } from '../presets';
import type { EditableSet } from '../me';
import { fromPreset } from './SetEditor';
import { PokemonSprite } from './Sprites';

export function StartPicker({ species, onPick }: { species: string[]; onPick: (set: EditableSet) => void }) {
  const presets = usePresets();
  const options = species.map((s) => ({ species: s, preset: presetsFor(presets, s)?.presets[0] })).filter((o) => o.preset);
  if (!options.length) return null;
  return (
    <div className="start">
      <p>Not sure where to start? Load the most common set of a top Pokémon:</p>
      <ul className="start-grid">
        {options.map(({ species: s, preset }) => (
          <li key={s}>
            <button type="button" onClick={() => onPick(fromPreset(s, preset!))} title={`${preset!.item ?? 'No item'}, ${preset!.nature}`}>
              <PokemonSprite species={s} size={44} />
              <span>{s}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
