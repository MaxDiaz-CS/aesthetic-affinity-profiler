import type { Aesthetic } from './engine/scoring.ts';

type Theme = { paper: string; ink: string; accent: string; soft: string; font: string; motif: string };
const neutral: Theme = {
  paper: '#f4f1e9', ink: '#252727', accent: '#435749', soft: '#e5e9df',
  font: 'Georgia, serif', motif: 'rules',
};
const families: Record<string, Omit<Theme, 'font' | 'motif'>> = {
  neon: { paper: '#161427', ink: '#faf4ff', accent: '#e7a7fd', soft: '#2d2240' },
  pastel: { paper: '#faf2f8', ink: '#34273a', accent: '#694564', soft: '#eee0ed' },
  earth: { paper: '#f7efe0', ink: '#302a21', accent: '#654629', soft: '#eae0ce' },
  chrome: { paper: '#edf1f7', ink: '#202a38', accent: '#364b72', soft: '#dce4f1' },
  primary: { paper: '#fff9e7', ink: '#222938', accent: '#17499c', soft: '#f4e9c6' },
  jewel: { paper: '#221829', ink: '#fff1f4', accent: '#f8bdd5', soft: '#422c42' },
  mono: { paper: '#ecebe8', ink: '#242423', accent: '#434343', soft: '#dad8d4' },
};
const named: Record<string, Partial<Theme>> = {
  'frutiger-aero': { paper: '#edf9ff', ink: '#133038', accent: '#28585b', soft: '#d4f2eb', font: 'Verdana, sans-serif', motif: 'bubbles' },
  'gen-x-soft-club': { paper: '#ecefe9', ink: '#252e2c', accent: '#415454', soft: '#d9e1d9', font: 'Arial, sans-serif', motif: 'rules' },
  'y2k-aesthetic': { accent: '#343f81', font: 'Verdana, sans-serif', motif: 'bubbles' },
  'whimsigothic': { ...families.jewel, font: 'Georgia, serif', motif: 'bubbles' },
  'global-village-coffeehouse': { ...families.earth, motif: 'ripples' },
  'paperback-chic': { ...families.pastel, motif: 'rules' },
  'frasurbane': { ...families.earth, motif: 'rules' },
  'corporate-memphis': { ...families.pastel, font: 'Arial, sans-serif', motif: 'bubbles' },
  'zen-x': { paper: '#eff2e9', ink: '#263126', accent: '#34543c', soft: '#e1e8d8', motif: 'ripples' },
  'cyberbougie': { ...families.neon, accent: '#c3c2ff', motif: 'grid' },
  'pulp-fantasy': { ...families.jewel, motif: 'ripples' },
  'industrial-gothic': { paper: '#1c2020', ink: '#f5f1e8', accent: '#d8caa9', soft: '#2c3030', motif: 'grid' },
};

export function resultTheme(style?: Aesthetic): Theme {
  if (!style) return neutral;
  const vector = style.vector;
  const family = Object.keys(families).find(key => vector[`palette:${key}`]);
  const typography = vector['typography:techno'] ? 'ui-monospace, monospace'
    : vector['typography:classic_serif'] ? 'Georgia, serif'
      : vector['typography:script'] ? 'Palatino, Georgia, serif' : 'Arial, sans-serif';
  const motif = vector.geometry > 0 ? 'grid' : vector.geometry < 0 ? 'ripples' : vector.surface > 0 ? 'bubbles' : 'rules';
  return { ...neutral, ...(family ? families[family] : {}), font: typography, motif, ...named[style.slug] };
}

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(pair => parseInt(pair, 16) / 255);
  return rgb.reduce((total, value, index) => total + [0.2126, 0.7152, 0.0722][index]
    * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4), 0);
}

export function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
