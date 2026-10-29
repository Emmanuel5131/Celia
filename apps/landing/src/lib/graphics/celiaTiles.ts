/**
 * Services-section tiles for Celia, drawn with the same blueprint kit as the case studies (hairline strokes, mono labels,
 * motion hooks driven by src/scripts/artMotion.ts). One tile per service, all 640 × 340, with labels big enough to read:
 *   intake    what a victim submits (wallet, account of events, signature) and the claimants table the case bank builds from it
 *   evidence  the fixed tests as a chart: observed value against a threshold committed before the run, and the order of events
 *   file      the pooled claims in one evidence file (proven / not proven), and a certificate ring per jurisdiction
 *   access    the case bank (defrauded wallets and evidence) opened by a lawyer, a law firm or an investigator's AI agent
 * Figures come from the anonymized Protocol P / App A case. The access tile is an illustration and says so.
 */
import { f, arc } from './svg';
import { T, BG, grid, corners, onC, hook, type Art } from './blueprint';
import type { ServiceArt } from '../../data/home';

/** Seal red: only for verdicts and the things a finding points at. */
const SEAL = '#991F38';

/** Panel header: label on the left, optional note on the right, hairline rule under both. */
const head = (x: number, y: number, w: number, label: string, c: string, o: number, right = '') =>
  hook(T(x, y, label, c, 10, 0.95, 'start', 500), 'a-t', o) + (right ? hook(T(x + w, y, right, c, 9, 0.7, 'end'), 'a-t', o + 0.2) : '') +
  `<path class="a-x" data-o="${o}" d="M${f(x)} ${f(y + 8)}H${f(x + w)}" stroke="${c}" stroke-opacity=".3"/>`;
/** Filled check square, drawn at its centre. */
const tick = (x: number, y: number, n: number, c: string) =>
  `<rect x="${f(x - n / 2)}" y="${f(y - n / 2)}" width="${f(n)}" height="${f(n)}" fill="${c}"/><path d="M${f(x - n * 0.25)} ${f(y)}l${f(n * 0.18)} ${f(n * 0.2)} ${f(n * 0.34)} ${f(-n * 0.4)}" stroke="${onC(c)}" stroke-width="1.6"/>`;
/** Hollow square with a dash: checked, nothing found. */
const none = (x: number, y: number, n: number, c: string) =>
  `<rect x="${f(x - n / 2)}" y="${f(y - n / 2)}" width="${f(n)}" height="${f(n)}" ${BG} stroke="${c}" stroke-dasharray="3 2"/><path d="M${f(x - n * 0.24)} ${f(y)}h${f(n * 0.48)}" stroke="${c}" stroke-width="1.6"/>`;

/* ---------------------------------------------------------------- intake: what a victim submits ↔ claimants table */
export const intakeArt: Art = (W, H, c) => {
  let s = grid(W, H, c, 16, 0.05) + corners(W, H, c, 12, 4);
  const wx = 24, wy = 24, ww = 592, wh = 292, bar = 26, split = 290, sb = wy + wh - 24;

  // window: traffic squares, title, document | table split
  s += `<rect class="a-d" x="${wx}" y="${wy}" width="${ww}" height="${wh}" ${BG} stroke="${c}" stroke-width="1.2"/>`;
  s += `<path class="a-x" data-o="0.4" d="M${wx} ${wy + bar}H${wx + ww}" stroke="${c}" stroke-opacity=".5"/>`;
  for (let i = 0; i < 3; i++) s += `<rect class="a-p" data-o="0.5" x="${wx + 10 + i * 12}" y="${wy + 9}" width="8" height="8" stroke="${c}" stroke-opacity=".6"/>`;
  s += hook(T(wx + ww / 2, wy + 17, 'case bank · claimant intake', c, 9.5, 0.9, 'middle', 500), 'a-t', 0.6);
  s += `<path class="a-yd" data-o="0.8" d="M${split} ${wy + bar}V${sb}" stroke="${c}" stroke-opacity=".4"/>`;

  // left: what one victim submits
  const lx = 44, fw = 226;
  s += hook(T(lx, wy + bar + 22, 'one victim submits', c, 9.5, 0.7), 'a-t', 1);
  s += `<rect class="a-d" data-o="1.2" x="${lx}" y="86" width="${fw}" height="34" ${BG} stroke="${c}" stroke-opacity=".8"/>`;
  s += hook(T(lx + 10, 107, 'wallet', c, 9, 0.6), 'a-t', 1.4) + hook(T(lx + 66, 107, '0x7a3f…e91c', c, 10.5, 1, 'start', 500), 'a-t', 1.5);
  s += `<rect class="a-d" data-o="1.6" x="${lx}" y="132" width="${fw}" height="84" ${BG} stroke="${c}" stroke-opacity=".8"/>`;
  s += `<rect class="a-p" data-o="1.8" x="${lx + 10}" y="142" width="104" height="64" fill="${c}" fill-opacity=".07" stroke="${c}" stroke-opacity=".5"/>`;
  s += `<path class="a-p" data-o="2" d="M${lx + 52} 160L${lx + 52} 188L${lx + 76} 174Z" fill="${c}"/>`;
  s += hook(T(lx + 108, 201, '0:42', c, 9, 0.7, 'end'), 'a-f', 2.1);
  s += hook(T(lx + 126, 162, 'what they were', c, 9.5, 0.9), 'a-t', 2.2) + hook(T(lx + 126, 178, 'promised and', c, 9.5, 0.9), 'a-t', 2.3) + hook(T(lx + 126, 194, 'what they lost', c, 9.5, 0.9), 'a-t', 2.4);
  s += `<rect class="a-d" data-o="2.5" x="${lx}" y="228" width="${fw}" height="34" ${BG} stroke="${c}" stroke-opacity=".8"/>`;
  s += `<g class="a-p" data-o="2.8">${tick(lx + 20, 245, 14, c)}</g>` + hook(T(lx + 38, 249, 'signed from the wallet', c, 10, 1, 'start', 500), 'a-t', 2.9);

  // right: the claimants table the case bank builds
  const tx = 306, tw = 294, ty = 84, th = 186, rowH = 38, r0 = ty + 26;
  s += hook(T(tx, ty - 8, 'claimants · one platform', c, 9.5, 0.7), 'a-t', 1.2);
  s += `<rect class="a-d" data-o="1.2" x="${tx}" y="${ty}" width="${tw}" height="${th}" ${BG} stroke="${c}" stroke-opacity=".8"/>`;
  s += `<path class="a-x" data-o="1.5" d="M${tx} ${r0}H${tx + tw}" stroke="${c}" stroke-opacity=".35"/>`;
  s += hook(T(tx + 12, ty + 17, 'claimant', c, 9, 0.6), 'a-t', 1.6) + hook(T(tx + 92, ty + 17, 'wallet', c, 9, 0.6), 'a-t', 1.6) +
    hook(T(tx + 200, ty + 17, 'account', c, 9, 0.6, 'middle'), 'a-t', 1.6) + hook(T(tx + 262, ty + 17, 'owner', c, 9, 0.6, 'middle'), 'a-t', 1.6);
  const rows: [string, string][] = [['01', '0x7a3f…e91c'], ['02', '0x19cd…04b2'], ['03', '0xb6e0…7f35'], ['04', '0x52a8…c1d9']];
  rows.forEach(([id, wallet], i) => {
    const cy = r0 + i * rowH + rowH / 2, o = 3 + i * 0.5;
    if (i) s += `<path class="a-x" data-o="${f(o)}" d="M${tx} ${r0 + i * rowH}H${tx + tw}" stroke="${c}" stroke-opacity=".18"/>`;
    s += hook(T(tx + 12, cy + 4, id, c, 10, 0.8), 'a-t', o) + hook(T(tx + 92, cy + 4, wallet, c, 10.5, 1, 'start', 500), 'a-t', o + 0.1);
    s += `<path class="a-p" data-o="${f(o + 0.3)}" d="M${tx + 192} ${cy - 7}V${cy + 7}L${tx + 206} ${cy}Z" fill="${c}"/>`;
    s += `<g class="a-p" data-o="${f(o + 0.5)}">${tick(tx + 262, cy, 16, c)}</g>`;
    // a packet leaves the submission and lands in this row
    const x1 = split - 6, x2 = tx - 5, y1 = 175;
    s += `<path class="a-d a-flow" data-o="${f(o)}" d="M${x1} ${y1}C${x1 + 14} ${y1} ${x2 - 14} ${cy} ${x2} ${cy}" stroke="${c}" stroke-opacity=".7" stroke-dasharray="2 2"/>`;
  });

  // status bar
  s += `<path class="a-x" data-o="5.4" d="M${wx} ${sb}H${wx + ww}" stroke="${c}" stroke-opacity=".5"/>`;
  s += `<rect class="a-x" data-o="5.4" x="${wx}" y="${sb}" width="${ww}" height="24" fill="${c}" fill-opacity=".06"/>`;
  s += hook(T(wx + 12, sb + 16, '4 claimants joined · ownership proven by signing', c, 10, 0.95, 'start', 500), 'a-t', 5.6);
  return s;
};

/* ---------------------------------------------------------------- evidence: observed vs a threshold fixed first */
export const evidenceArt: Art = (W, H, c) => {
  let s = grid(W, H, c, 16, 0.05) + corners(W, H, c, 12, 4);
  s += head(30, 34, 580, 'commit · 0x9f3a…c21e', c, 0, 'thresholds fixed before any data is read');

  // chart: share of the cohort (0–100%), one row per test
  const bx0 = 262, bw = 318, X = (p: number) => bx0 + (bw * p) / 100, top = 62, rowH = 40, bottom = top + 4 * rowH + 8;
  for (let i = 0; i <= 4; i++) {
    const p = i * 25, x = X(p);
    s += hook(T(x, top, `${p}%`, c, 8.5, 0.55, i === 0 ? 'start' : i === 4 ? 'end' : 'middle'), 'a-f', 0.6);
    s += `<path d="M${f(x)} ${top + 6}V${bottom}" stroke="${c}" stroke-opacity=".12" stroke-dasharray="2 3"/>`;
  }
  // [label, observed %, threshold %, note]
  const tests: [string, number, number, string][] = [
    ['funding trail', 90, 50, '90% from one funder'],
    ['cohort vs baseline', 79, 33, '79% single-purpose vs 11%'],
    ['circularity', 2, 5, 'no loop-back found'],
    ['concentration', 88, 60, '88% one counterparty'],
  ];
  tests.forEach(([label, v, thr, note], i) => {
    const y = top + 14 + i * rowH, by = y + 6, bh = 18, o = 1 + i * 0.45, over = v > thr;
    s += hook(T(30, y + 14, label, c, 10.5, 1, 'start', 500), 'a-t', o) + hook(T(30, y + 30, note, c, 9.5, 0.75), 'a-t', o + 0.5);
    s += `<rect x="${bx0}" y="${by}" width="${bw}" height="${bh}" fill="${c}" fill-opacity=".05"/>`;
    s += `<rect class="a-x" data-o="${f(o + 0.3)}" x="${bx0}" y="${by}" width="${f(Math.max(X(v) - bx0, 3))}" height="${bh}" fill="${c}" fill-opacity="${over ? 1 : 0.4}"/>`;
    s += `<path class="a-yd" data-o="${f(o + 0.6)}" d="M${f(X(thr))} ${by - 5}V${by + bh + 5}" stroke="${SEAL}" stroke-width="1.6" stroke-dasharray="3 2"/>`;
    s += `<path class="a-p" data-o="${f(o + 0.8)}" d="M${f(X(thr))} ${by - 11}l4 4.5l-4 4.5l-4 -4.5z" fill="${SEAL}"/>`;
  });
  s += hook(T(bx0, bottom + 18, '◆ threshold, fixed before the run', SEAL, 9.5, 1, 'start', 500), 'a-f', 3.4);
  s += `<g class="a-loopx" data-dx="${bw}" data-dur="6"><path d="M${bx0} ${top + 6}V${bottom}" stroke="${c}" stroke-opacity=".5" stroke-dasharray="1.5 2"/><path d="M${bx0 - 5} ${top + 3}h10l-5 6z" fill="${c}"/></g>`;

  // order of events: the method is committed, then the data is read, then the report is written
  const ey = 262, px = [70, 300, 560], py = ey + 24;
  s += `<path class="a-x" data-o="4.4" d="M30 ${ey - 6}H610" stroke="${c}" stroke-opacity=".3"/>`;
  s += hook(T(30, ey + 8, 'order of events', c, 9.5, 0.7), 'a-t', 4.4);
  s += `<path class="a-x" data-o="4.8" d="M${px[0]} ${py + 14}H${px[2]}" stroke="${c}" stroke-width="1.5"/>`;
  ([['method committed', 'T+0', 'solid'], ['data read', 'T+1', 'hollow'], ['report written', 'T+6', 'solid']] as const).forEach(([name, t, kind], i) => {
    const o = 5 + i * 0.4, x = px[i];
    s += `<rect class="a-p" data-o="${f(o)}" x="${x - 6}" y="${py + 8}" width="12" height="12" ${kind === 'solid' ? `fill="${c}"` : `${BG} stroke="${c}"`}/>`;
    s += hook(T(x, py + 40, `${name} · ${t}`, c, 10, 1, i === 0 ? 'start' : i === 2 ? 'end' : 'middle', 500), 'a-t', o);
  });
  return s;
};

/* ---------------------------------------------------------------- file: pooled claims, one evidence file, a certificate per jurisdiction */
export const fileArt: Art = (W, H, c) => {
  let s = grid(W, H, c, 16, 0.05) + corners(W, H, c, 12, 4);
  // claimants, pooled
  s += hook(T(30, 38, 'claims', c, 9.5, 0.7), 'a-t', 0);
  const cy = [66, 112, 158, 204, 250];
  cy.forEach((y, i) => {
    const o = 0.3 + i * 0.2;
    s += `<rect class="a-p" data-o="${f(o)}" x="30" y="${y - 15}" width="104" height="30" ${BG} stroke="${c}"/>`;
    s += hook(T(82, y + 4, `claimant 0${i + 1}`, c, 9.5, 0.95, 'middle'), 'a-t', o + 0.1);
    s += `<path class="a-d a-flow" data-o="${f(o + 0.2)}" d="M134 ${y}C160 ${y} 160 175 190 175" stroke="${c}" stroke-opacity=".6" stroke-dasharray="2 2"/>`;
  });
  // evidence file
  const dx = 190, dy = 30, dw = 250, dh = 280;
  s += `<rect class="a-d" data-o="1.2" x="${dx}" y="${dy}" width="${dw}" height="${dh}" ${BG} stroke="${c}" stroke-width="1.3"/>`;
  s += hook(T(dx + 18, dy + 28, 'evidence file · one platform', c, 10.5, 1, 'start', 500), 'a-t', 1.4);
  s += hook(T(dx + 18, dy + 46, '5 claimants pooled', c, 9.5, 0.7), 'a-t', 1.6);
  s += `<path class="a-x" data-o="1.7" d="M${dx + 18} ${dy + 58}H${dx + dw - 18}" stroke="${c}" stroke-opacity=".3"/>`;
  const find: [string, string][] = [['tick', 'falsity · proven'], ['tick', 'loss · proven']];
  find.forEach(([kind, label], i) => {
    const y = dy + 88 + i * 40, o = 2 + i * 0.5;
    s += `<g class="a-p" data-o="${f(o)}">${kind === 'tick' ? tick(dx + 28, y, 16, c) : none(dx + 28, y, 16, c)}</g>`;
    s += hook(T(dx + 50, y + 4, label, c, 10.5, 1, 'start', 500), 'a-t', o + 0.1);
  });
  s += `<rect class="a-p" data-o="3.8" x="${dx + 18}" y="${dy + dh - 62}" width="40" height="40" fill="${SEAL}"/>`;
  s += hook(T(dx + 70, dy + dh - 46, 'case file', c, 10.5, 1, 'start', 500), 'a-t', 4) + hook(T(dx + 70, dy + dh - 30, 'hash 9f3a…c21e', c, 9.5, 0.7), 'a-t', 4.1);
  // certificates
  s += hook(T(580, 38, 'certificates', c, 9.5, 0.7, 'end'), 'a-t', 4.2);
  s += `<path class="a-d a-flow" data-o="4.4" d="M${dx + dw} 175H468V108H486M468 175V236H486" stroke="${c}" stroke-opacity=".6" stroke-dasharray="2 2"/>`;
  ([['s.84', 'NG · Evidence Act', 108, false], ['902', 'US · in counsel review', 236, true]] as const).forEach(([label, note, y, pending], i) => {
    const gx = 540, r = 36, o = 4.6 + i * 0.4;
    s += `<circle cx="${gx}" cy="${y}" r="${r}" stroke="${c}" stroke-opacity=".18" stroke-width="3"/>`;
    s += `<path class="a-d" data-o="${f(o)}" d="${arc(gx, y, r, -90, 269.5)}" stroke="${c}" stroke-width="3"${pending ? ' stroke-dasharray="6 4"' : ''}/>`;
    s += hook(T(gx, y + 5, label, c, 13, 1, 'middle', 600), 'a-t', o + 0.3);
    s += hook(T(gx, y + r + 22, note, c, 9, 0.9, 'middle'), 'a-f', o + 0.5);
  });
  return s;
};

/* ---------------------------------------------------------------- access: the case bank, opened by lawyers, firms and agents */
export const accessArt: Art = (W, H, c) => {
  let s = grid(W, H, c, 16, 0.05) + corners(W, H, c, 12, 4);
  // the case bank: the wallets of those defrauded, and the evidence
  s += `<rect class="a-d" data-o="0" x="30" y="40" width="240" height="252" ${BG} stroke="${c}" stroke-width="1.3"/>`;
  s += hook(T(46, 66, 'case bank', c, 10.5, 1, 'start', 500), 'a-t', 0.3);
  s += `<path class="a-x" data-o="0.5" d="M46 76H254" stroke="${c}" stroke-opacity=".3"/>`;
  s += hook(T(46, 98, 'wallets of the defrauded', c, 9.5, 0.7), 'a-t', 0.7);
  ['0x7a3f…e91c', '0x19cd…04b2', '0xb6e0…7f35'].forEach((wallet, i) => {
    const y = 124 + i * 28, o = 1 + i * 0.3;
    s += `<g class="a-p" data-o="${f(o)}">${tick(54, y, 14, c)}</g>` + hook(T(72, y + 4, wallet, c, 10.5, 1, 'start', 500), 'a-t', o + 0.1);
  });
  s += hook(T(46, 226, 'evidence', c, 9.5, 0.7), 'a-t', 2);
  ['funding trail', 'onchain records'].forEach((label, i) => {
    const y = 250 + i * 28, o = 2.2 + i * 0.3;
    s += `<g class="a-p" data-o="${f(o)}">${tick(54, y, 14, c)}</g>` + hook(T(72, y + 4, label, c, 10.5, 1, 'start', 500), 'a-t', o + 0.1);
  });
  // lawyers, firms, agencies and AI agents open it
  s += hook(T(340, 128, 'connected', c, 9, 0.75, 'middle'), 'a-t', 3);
  [['lawyer or law firm', 'opens the evidence file', 52], ['investigative agency', 'adds offchain findings', 140], ['AI agent', 'reads it through the MCP', 228]].forEach(([who, does, y], i) => {
    const o = 3.2 + i * 0.45, cy = Number(y) + 33;
    s += `<rect class="a-d" data-o="${f(o)}" x="410" y="${y}" width="200" height="66" ${BG} stroke="${c}" stroke-opacity=".8"/>`;
    s += hook(T(426, cy - 4, String(who), c, 11, 1, 'start', 500), 'a-t', o + 0.2) + hook(T(426, cy + 14, String(does), c, 9.5, 0.7), 'a-t', o + 0.3);
    s += `<g class="a-p" data-o="${f(o + 0.5)}">${tick(594, cy, 14, c)}</g>`;
    s += `<path class="a-d a-flow" data-o="${f(o - 0.2)}" d="M270 166C340 166 340 ${cy} 410 ${cy}" stroke="${c}" stroke-opacity=".7" stroke-dasharray="2 2"/>`;
  });
  s += hook(T(30, 322, 'Celia holds wallets and evidence. They run the case.', c, 10, 0.95, 'start', 500), 'a-t', 5);
  s += hook(T(610, 40, 'illustration · placeholder addresses', c, 9, 0.6, 'end'), 'a-f', 5.2);
  return s;
};

export const serviceArts: Record<ServiceArt, Art> = { intake: intakeArt, evidence: evidenceArt, file: fileArt, access: accessArt };
