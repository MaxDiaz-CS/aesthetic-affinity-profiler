// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { App } from './app.tsx';
import { readSession, shareUrl } from './session.ts';

it('completes Quick intake in text mode, shares results, and retakes the quiz', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const rootNode = document.createElement('div');
  document.body.appendChild(rootNode);
  const root = createRoot(rootNode);
  const button = (name: string) => [...rootNode.querySelectorAll('button')]
    .find(item => item.textContent?.includes(name) && !item.disabled);
  const click = async (item: HTMLElement | undefined | null) => {
    expect(item).toBeTruthy();
    await act(() => { item!.click(); });
  };
  try {
    await act(() => root.render(<App />));
    expect(rootNode.querySelector('h1')?.textContent).toContain('The IntakeDesk');
    await click(button('Start quick intake'));
    await click(rootNode.querySelector('.text-mode input'));
    expect(rootNode.querySelector('progress')?.getAttribute('max')).toBe('15');
    await click(button('Skip'));
    await click(rootNode.querySelector<HTMLInputElement>('main input[type="radio"]'));
    await click(button('Continue'));
    expect(rootNode.querySelector('[role="img"]')).toBeNull();
    for (let i = 0; i < 17 && rootNode.querySelector('main.quiz'); i++) {
      const radio = rootNode.querySelector<HTMLInputElement>('main input[type="radio"]');
      if (radio) await click(radio);
      const vote = rootNode.querySelector<HTMLButtonElement>('main .vote-grid button');
      if (vote) await click(vote);
      await click(button('Continue') ?? button('Finish section'));
    }
    expect(rootNode.querySelector('h1')?.textContent).toBe('Your aesthetic profile');
    expect(rootNode.querySelectorAll('.result-card').length).toBe(6);
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    await click(button('Share results'));
    const link = (rootNode.querySelector('.share-field input') as HTMLInputElement).value;
    expect(clipboard.writeText).toHaveBeenCalledWith(link);
    expect(readSession(new URL(link).hash)?.mode).toBe('quick');
    await click(button('Retake quiz'));
    expect(button('Start full intake')).toBeTruthy();
  } finally {
    await act(() => root.unmount());
    rootNode.remove();
  }
});

it('discards out-of-range and unrecognized values from shared sessions', () => {
  const url = new URL(shareUrl('quick', {
    decades: [12], context: 1, outline: 45, 'motifs-1': { 'non-cari-id': 1 }, unknown: 3,
  }, []));
  expect(readSession(url.hash)?.answers).toEqual({ context: 1, 'motifs-1': {} });
});
