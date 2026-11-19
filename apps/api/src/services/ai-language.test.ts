import { describe, expect, it } from 'vitest';
import { requestLanguage } from '@frameroom/shared';
import { aiSystem, aiStreamError } from './ai-language.js';

describe('AI response language', () => {
  it('defaults unknown or absent preferences to English', () => {
    expect(requestLanguage()).toBe('en');
    expect(requestLanguage('fr-FR')).toBe('en');
    expect(aiSystem()).toContain('Respond in English');
  });
  it('uses Vietnamese when selected, including regional headers', () => {
    expect(requestLanguage('vi-VN, en-US;q=0.8')).toBe('vi');
    expect(requestLanguage('en-US, vi;q=0.5')).toBe('en');
    expect(aiSystem('vi')).toContain('Respond in Vietnamese');
    expect(aiStreamError('vi')).toContain('Vui lòng');
    expect(aiStreamError('en')).toContain('Please try again');
  });
});
