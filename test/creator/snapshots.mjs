// test/creator/snapshots.mjs
import { n, r } from './helpers.mjs';

const HEADING = { color: 'rgb(17, 24, 39)', fontFamily: 'Inter, sans-serif', fontSize: '56px', fontWeight: '700', lineHeight: '64px', textAlign: 'left' };

export function hero() {
  return n('section', r(80, 600), [
    n('h1', r(160, 60, 120, 600), [], { text: 'Acme ships faster', style: HEADING }),
    n('p', r(240, 48, 120, 600), [], { text: 'Plan, build and launch in one place.', style: { color: 'rgb(75, 85, 99)', fontSize: '18px', lineHeight: 'normal' } }),
    n('a', r(310, 48, 120, 160), [], { text: 'Start free', cls: ['btn'], attrs: { href: 'https://acme.test/signup' }, style: { backgroundColor: 'rgb(10, 132, 255)', color: 'rgb(255, 255, 255)' } }),
    n('img', r(140, 420, 800, 520), [], { attrs: { src: 'https://acme.test/hero.png', alt: 'Acme dashboard' } }),
  ], { style: { backgroundColor: 'rgba(0, 0, 0, 0)', paddingTop: '80px', paddingBottom: '80px' } });
}

export function features() {
  const card = (i) => n('div', r(860, 200, 120 + i * 420, 380), [
    n('h3', r(880, 30, 120 + i * 420, 380), [], { text: `Feature ${i + 1}` }),
    n('p', r(920, 60, 120 + i * 420, 380), [], { text: `Feature ${i + 1} explained.` }),
  ], { cls: ['card'] });
  return n('section', r(680, 420), [
    n('h2', r(720, 48, 120, 800), [], { text: 'Why Acme', style: { textAlign: 'center' } }),
    n('div', r(860, 200, 120, 1200), [card(0), card(1), card(2)], { cls: ['grid'] }),
  ]);
}

export function faq() {
  const q = (i) => n('details', r(1180 + i * 60, 50, 120, 1200), [
    n('summary', r(1180 + i * 60, 50, 120, 1200), [], { text: `Question ${i + 1}?` }),
    n('p', r(0, 0, 0, 0), [], { text: `Answer ${i + 1}.`, visible: false }),
  ]);
  return n('section', r(1100, 300), [n('h2', r(1120, 48, 120, 800), [], { text: 'Questions' }), q(0), q(1), q(2)]);
}

export function cta() {
  return n('section', r(1400, 240), [
    n('h2', r(1440, 48, 120, 800), [], { text: 'Ready to ship?' }),
    n('p', r(1500, 30, 120, 800), [], { text: 'Start in five minutes.' }),
    n('a', r(1550, 48, 120, 160), [], { text: 'Start free', cls: ['btn'], attrs: { href: 'https://acme.test/signup' } }),
  ]);
}

export function stats() {
  const item = (i, v) => n('li', r(1700, 120, 120 + i * 300, 280), [n('strong', r(1700, 60, 120 + i * 300, 280), [], { text: v }), n('span', r(1760, 30, 120 + i * 300, 280), [], { text: `Label ${i + 1}` })], { cls: ['stat'] });
  return n('section', r(1660, 220), [n('h2', r(1670, 40, 120, 800), [], { text: 'Acme in numbers' }), n('ul', r(1700, 120, 120, 1200), [item(0, '120k'), item(1, '99.9%'), item(2, '40+'), item(3, '7')])]);
}

export function landing({ wrap = false } = {}) {
  const header = n('header', r(0, 80), [n('nav', r(0, 80), [n('a', r(20, 40, 20, 80), [], { text: 'Acme', attrs: { href: '/' } })])]);
  const main = n('main', r(80, 1560), [hero(), features(), faq(), cta()]);
  const footer = n('footer', r(1640, 120), [n('p', r(1660, 20), [], { text: '© Acme' })]);
  const kids = [header, main, footer];
  return n('body', r(0, 1760), wrap ? [n('div', r(0, 1760), kids, { attrs: { id: 'app' } })] : kids);
}
