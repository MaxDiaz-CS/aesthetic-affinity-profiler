import { useRef, useState } from 'react';
import channels from '../data/galleries.json' with { type: 'json' };
import type { Aesthetic } from './engine/scoring.ts';

const galleries: Record<string, string> = channels;

export function Gallery({ aesthetic, textOnly }: { aesthetic: Aesthetic; textOnly: boolean }) {
  const channel = galleries[aesthetic.slug];
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const title = aesthetic.name + ' gallery';
  const external = <a href={channel ?? aesthetic.url} target="_blank" rel="noopener noreferrer">
    Browse {aesthetic.name} on {channel ? 'Are.na' : 'CARI'} ↗</a>;
  if (!channel || textOnly) return <div className="gallery-link">{external}</div>;
  return <div className="gallery-link">
    <button type="button" className="button secondary" aria-haspopup="dialog"
      aria-label={'Browse ' + title} onClick={() => { dialog.current?.showModal(); setOpen(true); }}>Browse gallery</button>
    <dialog ref={dialog} className="gallery-dialog" aria-label={title} onClose={() => setOpen(false)}>
      <header><div><p>CARI collection on Are.na</p><h2>{aesthetic.name}</h2></div>
        <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>Close</button>
      </header>
      {open && <iframe title={title + ' on Are.na'} src={channel + '/embed'} referrerPolicy="no-referrer" />}
      {external}
    </dialog>
  </div>;
}
