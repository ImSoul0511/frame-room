import { expect, it } from 'vitest';
import { selectionReport } from './selection-export';
it('exports only selected frames/current-round feedback and never includes media URLs', () => {
  const output = selectionReport(
    {
      images: [
        {
          id: 'a',
          caption: 'A, "portrait"',
          url: 'https://private/signed',
          storagePath: 'private/key',
          provenance: 'captured',
        },
        {
          id: 'b',
          caption: 'Other',
          url: 'https://private/other',
          storagePath: 'private/other',
          provenance: 'captured',
        },
      ],
      selected: ['a'],
      round: 2,
      state: 'Draft',
      feedback: [
        { id: 'one', imageId: 'a', round: 1, note: 'Old round', x: null, y: null },
        { id: 'two', imageId: 'a', round: 2, note: '=1+1', x: null, y: null },
      ],
    },
    ['Frame', 'Filename', 'Round', 'State', 'Notes', 'Origin'],
  );
  expect(output).toContain('"A, ""portrait"""');
  expect(output).toContain('"\'=1+1"');
  expect(output).not.toMatch(/https:|private\/|Other|Old round/);
  expect(output).toContain('"2","Draft"');
});
