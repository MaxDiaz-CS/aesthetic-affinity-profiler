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
    const pictures = rootNode.querySelectorAll('[role="img"]');
    expect(pictures).toHaveLength(6);
    for (const picture of pictures) {
      expect(picture.getAttribute('style')).toContain('eras.webp');
      expect(picture.getAttribute('aria-label')).toBeTruthy();
    }
    await click(rootNode.querySelector('.text-mode input'));
    expect(rootNode.querySelector('progress')?.getAttribute('max')).toBe('15');
    await click(button('Skip'));
    await click(rootNode.querySelector<HTMLInputElement>('main input[type="radio"], main input[type="checkbox"]'));
    await click(button('Continue'));
    expect(rootNode.querySelector('[role="img"]')).toBeNull();
    for (let i = 0; i < 17 && rootNode.querySelector('main.quiz'); i++) {
      const radio = rootNode.querySelector<HTMLInputElement>('main input[type="radio"], main input[type="checkbox"]');
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
    const catalog = rootNode.querySelector('.catalog-controls');
    const decade = catalog?.querySelector('select') as HTMLSelectElement;
    await act(() => {
      decade.value = '1990s';
      decade.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const filtered = rootNode.querySelectorAll('.catalog-list > li').length;
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(78);
    const friendLink = rootNode.querySelector('.compare-form input') as HTMLInputElement;
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(friendLink, link);
      friendLink.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(() => {
      expect(rootNode.querySelector('form.compare-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))).toBe(false);
    });
    expect(rootNode.querySelector('.comparison')?.textContent).toContain('Your displayed match percentages are identical.');
    expect(rootNode.querySelectorAll('.comparison-top li')).toHaveLength(6);
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
