import { describe, expect, it } from 'vitest';
import { parsePeople } from './people';

const ID = '11111111-1111-4111-8111-111111111111';
const person = { id: ID, display_name: 'Demo', user_name: 'demo' };
describe('public user search results', () => {
  it('handles the one-to-one photographer relation returned by the Cloud database', () => {
    expect(
      parsePeople([{ ...person, photographers: { id: ID, is_hidden: false } }])?.[0].photographerId,
    ).toBe(ID);
  });
  it('also accepts an array relation and does not link hidden profiles', () => {
    expect(
      parsePeople([{ ...person, photographers: [{ id: ID, is_hidden: true }] }])?.[0]
        .photographerId,
    ).toBeNull();
  });
  it('uses the visible photographer display name when available', () => {
    expect(
      parsePeople([
        { ...person, photographers: { id: ID, is_hidden: false, display_name: 'Studio Name' } },
      ])?.[0].displayName,
    ).toBe('Studio Name');
  });
  it('keeps clients in name results without inventing a public photographer page', () => {
    expect(parsePeople([{ ...person, photographers: null }])).toEqual([
      { id: ID, displayName: 'Demo', userName: 'demo', avatarPath: null, photographerId: null },
    ]);
  });
});
