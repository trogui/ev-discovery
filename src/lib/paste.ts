export type ParsedMon = { species: string; item: string | null; ability: string | null; nature: string | null; evs: string | null; moves: string[]; raw: string };

export function parsePaste(text: string): ParsedMon[] {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 1)
    .map((lines) => {
      const [head, ...rest] = lines;
      const [left, item] = head.split(' @ ').map((s) => s.trim());
      const cleaned = left.replace(/\((M|F)\)\s*$/, '').trim();
      const nick = cleaned.match(/\(([^()]+)\)\s*$/);
      const mon: ParsedMon = { species: nick ? nick[1] : cleaned, item: item ?? null, ability: null, nature: null, evs: null, moves: [], raw: head };
      for (const line of rest) {
        if (line.startsWith('Ability:')) mon.ability = line.slice(8).trim();
        else if (/^(EVs|SPs|Stat Points):/i.test(line)) mon.evs = line.replace(/^[^:]+:/, '').trim();
        else if (/ Nature$/.test(line)) mon.nature = line.replace(/ Nature$/, '').trim();
        else if (line.startsWith('- ')) mon.moves.push(line.slice(2).split(' / ')[0].trim());
      }
      return mon;
    });
}
