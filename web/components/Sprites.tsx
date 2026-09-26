import { toID } from '../../src/lib/dex';
import itemSprites from '../itemSprites.json';

const SHEET_COLUMNS = 16;
const CELL = 24;

export function PokemonSprite({ species, size = 40 }: { species: string; size?: number }) {
  return (
    <span className="sprite" style={{ width: size, height: size }}>
      <img src={`/sprites/pokemon/${toID(species)}.png`} alt="" loading="lazy" width={Math.round(size * 1.2)} height={Math.round(size * 1.2)} />
    </span>
  );
}

export function ItemIcon({ item }: { item: string | null }) {
  const index = item ? (itemSprites as Record<string, number>)[item] : undefined;
  if (index === undefined) return <span className="item-icon empty" aria-hidden />;
  const x = (index % SHEET_COLUMNS) * CELL;
  const y = Math.floor(index / SHEET_COLUMNS) * CELL;
  return <span className="item-icon" aria-hidden style={{ backgroundPosition: `-${x}px -${y}px` }} title={item ?? undefined} />;
}
