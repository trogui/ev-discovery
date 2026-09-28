const SCALE = 2;
const MARGIN = 32;

function breaks(node: HTMLElement, selectors: string[]) {
  const top = node.getBoundingClientRect().top;
  return selectors.map((s) => [...node.querySelectorAll(s)].map((el) => Math.ceil(el.getBoundingClientRect().top - top) + 1));
}

function paginate(height: number, pageHeight: number, tiers: number[][]) {
  const pages: [number, number][] = [];
  let start = 0;
  while (start < height) {
    const room = pageHeight - (pages.length ? 2 * MARGIN : MARGIN);
    if (height - start <= room) {
      pages.push([start, height]);
      break;
    }
    const fits = tiers.map((cuts) => cuts.filter((c) => c > start + 1 && c <= start + room)).find((cuts) => cuts.length);
    const end = fits ? Math.max(...fits) : start + room;
    pages.push([start, end]);
    start = end;
  }
  return pages;
}

export async function exportPdf(node: HTMLElement, filename: string) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const background = getComputedStyle(node).backgroundColor;
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const pageHeight = Math.round((width * 297) / 210);
  const canvas = await toCanvas(node, { pixelRatio: SCALE, backgroundColor: background });
  const pages = paginate(height, pageHeight, breaks(node, ['.report-build, .report-mode:not(:nth-child(2)), .report-opp:not(:nth-child(2))', '.report-set:not(:nth-child(2))', '.report-calc:not(:first-child)']));

  const pdf = new jsPDF({ unit: 'px', format: [width, pageHeight], hotfixes: ['px_scaling'], compress: true });
  pages.forEach(([from, to], i) => {
    if (i) pdf.addPage([width, pageHeight]);
    const page = document.createElement('canvas');
    page.width = width * SCALE;
    page.height = pageHeight * SCALE;
    const ctx = page.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(canvas, 0, from * SCALE, width * SCALE, (to - from) * SCALE, 0, (i ? MARGIN : 0) * SCALE, width * SCALE, (to - from) * SCALE);
    pdf.addImage(page, 'PNG', 0, 0, width, pageHeight, undefined, 'FAST');
  });
  pdf.save(filename);
}
