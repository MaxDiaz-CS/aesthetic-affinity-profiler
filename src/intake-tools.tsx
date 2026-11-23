import { useRef, useState } from 'react';
import { previews } from './data.ts';
import type { Answer, Question } from './engine/scoring.ts';

const sheets = import.meta.glob<string>('./assets/*.webp', { eager: true, import: 'default', query: '?inline' });

export function Preview({ id, textOnly }: { id: string; textOnly: boolean }) {
  const item = previews.find(sample => sample.id === id);
  if (!item || textOnly) return null;
  return <div className={`sample sample-${item.asset}`}>
    <img alt={item.alt} src={sheets[`./assets/${item.asset}.webp`]} style={{
      width: `${item.cols * 100}%`, height: `${item.rows * 100}%`,
      left: `${-item.col * 100}%`, top: `${-item.row * 100}%` }} />
  </div>;
}

export function Inspector({ question, index, close }: { question: Question; index: number; close: () => void }) {
  const [position, setPosition] = useState(index);
  const start = useRef<number | null>(null);
  const options = question.options.filter(option => option.image);
  const choice = options[position];
  const move = (delta: number) => setPosition(current => (current + delta + options.length) % options.length);
  return <dialog className="inspection" aria-label="Inspect answer images" ref={el => { if (el && !el.open) el.showModal(); }}
    onCancel={close} onKeyDown={event => {
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    }}>
    <header><span>Image {position + 1} of {options.length}</span><button autoFocus onClick={close}>Close</button></header>
    <div onTouchStart={e => {start.current = e.touches[0].clientX;}} onTouchEnd={e => {
      const delta = e.changedTouches[0].clientX - (start.current ?? e.changedTouches[0].clientX);
      if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
      start.current = null;
    }}><Preview id={choice.image!} textOnly={false} /></div>
    <p aria-live="polite"><b>{choice.label}</b> {choice.detail}</p>
    <footer><button onClick={() => move(-1)}>Previous</button><button onClick={() => move(1)}>Next</button></footer>
  </dialog>;
}

export function describeAnswer(q: Question, a?: Answer) {
  if (a === undefined) return 'Skipped';
  if (Array.isArray(a)) return a.map(i => q.options[i].label).join(', ') || 'None selected';
  if (typeof a === 'object') return q.options.flatMap(o => {
    const vote = a[o.motifs[0]];
    return vote ? [(vote > 0 ? 'Love · ' : 'Dislike · ') + o.label] : [];
  }).join(', ') || 'Neutral';
  if (q.type === 'slider') return a ? (Math.abs(a) === 2 ? 'Strongly · ' : 'Slightly · ') + q.options[a < 0 ? 0 : 1].label : 'Neutral';
  return a === -1 ? 'Neither' : q.options[a]?.label;
}

export const visualHints: Record<string, string> = {
  finish: 'Find the brightest spot on each surface. Does the light form a sharp reflection or spread softly across it?',
  chroma: 'Imagine both samples in the same room. Which intensity of color would you want to see every day?',
  temperature: 'Look at the overall cast of each picture, from amber and sand to blue and slate.',
  composition: 'Trace the empty space around the main shape. Does your eye settle in one place or travel between many details?',
  outline: 'Follow the outside edge with your eye. Notice where it curves smoothly or changes direction at a corner.',
  light: 'Compare how much of each picture sits in shadow and how much opens into light.',
  signal: 'Look closely at an edge. One image breaks into irregular grains, the other into little squares.',
  letter: 'Inspect the ends of the letter strokes and the thickness of their lines. Imagine reading a whole title in each.',
  pace: 'Follow a repeated shape across the picture. Notice where your eye slows down or jumps ahead.',
  touch: 'Imagine resting a hand on each object. Which surface would you want within reach?',
  attitude: 'Look at the angles, spacing and gestures. Which mood would you choose for something you see daily?',
  future: 'Imagine stepping inside each scene. What do the light and empty spaces suggest about life there?',
  lobby: 'Imagine waiting here for someone. Look at the distance between seats, the light on the walls and the materials closest to you.',
  flyer: 'Imagine the same band on every flyer. Look at how the letters fill the page and where your eye lands first.',
  device: 'Picture each object on your own desk. Follow its silhouette and imagine the feel of its casing.',
  cafe: 'Picture the view from your table. Notice the light sources and how their reflections change the room.',
  cover: 'Cover the imaginary title with your thumb. Which arrangement would still make you pick up the magazine?',
  jacket: 'Look at the weave, sheen and placement of each graphic. Imagine wearing each jacket with the same outfit.',
  shop: 'Imagine walking past each window selling the same product. Which display makes you slow down?',
  album: 'Imagine the same music inside every sleeve. Trace the shapes across each cover and choose the one you would keep.',
  paperback: 'Look at how each illustration handles scale and depth. Which image would draw you over to the shelf?',
  'record-art': 'Imagine framing one sleeve on your wall. Look at the scale of the objects and the texture of the picture.'
};
