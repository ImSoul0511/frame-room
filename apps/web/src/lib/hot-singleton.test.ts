import { createContext, createElement, useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { hotSingleton } from './hot-singleton';

describe('stateful resources during hot updates', () => {
  it('lets an updated consumer read the provider that is already mounted', () => {
    const hotData = {};
    const mountedContext = hotSingleton(hotData, 'demo-context', () =>
      createContext<string | null>(null),
    );
    const updatedContext = hotSingleton(hotData, 'demo-context', () =>
      createContext<string | null>(null),
    );
    function UpdatedConsumer() {
      const value = useContext(updatedContext);
      if (!value) throw new Error('DemoProvider is required');
      return createElement('span', null, value);
    }
    expect(
      renderToString(
        createElement(mountedContext.Provider, { value: 'client' }, createElement(UpdatedConsumer)),
      ),
    ).toBe('<span>client</span>');
  });

  it('creates one Auth client across repeated module evaluations', () => {
    const hotData = {};
    const create = vi.fn(() => ({ auth: { getSession: vi.fn() } }));
    const first = hotSingleton(hotData, 'supabase-client', create);
    expect(hotSingleton(hotData, 'supabase-client', create)).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('isolates a fresh page and does not require a hot runtime in production', () => {
    const create = () => ({});
    expect(hotSingleton({}, 'resource', create)).not.toBe(hotSingleton({}, 'resource', create));
    expect(hotSingleton(undefined, 'resource', create)).not.toBe(
      hotSingleton(undefined, 'resource', create),
    );
  });

  it('retains an intentionally unconfigured client without retrying initialization', () => {
    const hotData = {};
    const create = vi.fn(() => null);
    expect(hotSingleton(hotData, 'supabase-client', create)).toBeNull();
    expect(hotSingleton(hotData, 'supabase-client', create)).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
