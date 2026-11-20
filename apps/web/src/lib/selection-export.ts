import type { Image, PhotoFeedback } from './types';
function cell(value: string | number) {
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function selectionReport(
  input: {
    images: Image[];
    selected: string[];
    feedback: PhotoFeedback[];
    round: number;
    state: string;
  },
  headers: string[],
) {
  const rows: (string | number)[][] = [headers];
  input.images.forEach((image, index) => {
    if (!input.selected.includes(image.id)) return;
    rows.push([
      String(index + 1).padStart(3, '0'),
      image.caption,
      input.round,
      input.state,
      input.feedback
        .filter((note) => note.imageId === image.id && note.round === input.round)
        .map((note) => note.note)
        .join('\n'),
      image.provenance,
    ]);
  });
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
