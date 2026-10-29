/**
 * Motion system (GSAP 3 + ScrollTrigger + SplitText + ScrambleText + DrawSVG, Lenis smooth scroll).
 * Components opt in with data attributes — no per-component JS needed:
 *   data-split[="load"] [data-split-type="chars"]   masked line / character reveal
 *   data-scramble[="load"]                          monospace scramble-in for eyebrows / labels
 *   data-reveal[="load"] [data-delay]               fade + rise
 *   data-stagger[="load"] [data-axis="x"] [data-each] [data-delay] [data-start]   children stagger in (`data-start` = when it starts, default `top 86%`; a larger % starts earlier)
 *   data-count                                      count-up of the number inside the text
 *   data-clip                                       clip-path reveal + inner image parallax
 *   data-parallax="0.1"                             scroll parallax (yPercent)
 *   data-draw        (paths with [data-draw-path])  SVG stroke drawing
 *   data-timeline[="x"] + [data-timeline-fill] + [data-timeline-step]   scrubbed progress timelines
 *   data-tilt-in                                    3D "lay flat" entrance while scrolling (dashboards)
 *   data-gauge="98"                                 ring gauge fill
 *   data-bars                                       Gantt bars grow + release markers pop
 *   data-words                                      words fill in with scroll (quotes)
 *   data-wordmark                                   footer wordmark characters rise
 *   data-code                                       code lines type in
 *   data-pop                                        SVG cells pop in randomly
 *   data-tilt  (+ [data-tilt-layer="depth"])        pointer-driven 3D tilt
 * Everything is skipped for prefers-reduced-motion; content is always visible without JS.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, DrawSVGPlugin);

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const EASE = 'expo.out';
const $$ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = document) => Array.from(scope.querySelectorAll<T>(sel));
const once = (trigger: Element, start = 'top 86%') => ({ trigger, start, once: true });
const isLoad = (v?: string) => v === 'load';
const CLEAR = 'transform,translate,rotate,scale,opacity,visibility';
/** Entrance tweens pause CSS transitions while running, then hand control back to CSS (hover states). */
const handoff = (targets: Element[]) => ({
  onStart: () => targets.forEach((t) => t.classList.add('gsap-anim')),
  onComplete: () => { targets.forEach((t) => t.classList.remove('gsap-anim')); gsap.set(targets, { clearProps: CLEAR }); },
});

(window as any).__zxMotion = 1; // tells the loader the motion bundle has arrived (part of its real progress)
const loaderGate = (window as any).__zxReveal as Promise<void> | undefined;

if (reduce) {
  root.classList.add('motion-ready');
  $$<SVGSVGElement>('svg').forEach((s) => s.pauseAnimations?.());
} else if (loaderGate) {
  loaderGate.then(init); // first visit: intros start as the loader dissolves, not underneath it
} else {
  init();
}

function init() {
  /* ------------------------------------------------------------ smooth scroll */
  const lenis = new Lenis({
    lerp: 0.1,
    anchors: { offset: -96 },
    // Nested scrollers (code, diagrams, textareas) only take the wheel when they can actually scroll in that
    // direction; otherwise Lenis keeps smooth-scrolling the page — no native/virtual scroll fight.
    allowNestedScroll: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  // Overlays (e.g. the video theatre) pause page scrolling while they are open.
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ------------------------------------------------------------ text */
  $$('[data-split]').forEach((el) => {
    const load = isLoad(el.dataset.split);
    const chars = el.dataset.splitType === 'chars';
    SplitText.create(el, {
      type: chars ? 'chars,lines' : 'lines',
      mask: 'lines',
      autoSplit: true,
      aria: 'auto',
      onSplit(self) {
        gsap.set(el, { autoAlpha: 1 });
        return gsap.from(chars ? self.chars : self.lines, {
          yPercent: 118, duration: chars ? 1.15 : 1.25, ease: EASE, stagger: chars ? 0.035 : 0.09,
          delay: load ? +(el.dataset.delay ?? 0.1) : 0,
          scrollTrigger: load ? undefined : once(el, 'top 88%'),
        });
      },
    });
  });

  $$('[data-scramble]').forEach((el) => {
    const text = el.textContent ?? '';
    const load = isLoad(el.dataset.scramble);
    el.style.minHeight = `${el.offsetHeight}px`; // lock height so scrambling can never reflow the layout (CLS)
    gsap.fromTo(el, { autoAlpha: 0 }, {
      autoAlpha: 1, duration: Math.min(1.5, 0.5 + text.length * 0.022), ease: 'none',
      scrambleText: { text, chars: '/\\<>_-+=#01', revealDelay: 0.2, speed: 0.6 },
      delay: load ? 0.05 : 0, scrollTrigger: load ? undefined : once(el, 'top 92%'),
    });
  });

  $$('[data-words]').forEach((el) => {
    SplitText.create(el, {
      type: 'words', aria: 'auto', autoSplit: true,
      onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.14 }, { opacity: 1, ease: 'none', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: 0.4 } }),
    });
  });

  $$('[data-rise]').forEach((el) => {
    gsap.fromTo(el, { yPercent: 105 }, { yPercent: 0, duration: 1.5, ease: EASE, scrollTrigger: once(el.parentElement ?? el, 'top 96%') });
  });

  $$('[data-wordmark]').forEach((el) => {
    SplitText.create(el, {
      type: 'chars', autoSplit: true,
      onSplit: (self) => gsap.from(self.chars, { yPercent: 105, duration: 1.4, ease: EASE, stagger: 0.07, scrollTrigger: once(el, 'top 98%') }),
    });
  });

  /* ------------------------------------------------------------ entrances */
  $$('[data-reveal]').forEach((el) => {
    const load = isLoad(el.dataset.reveal);
    gsap.fromTo(el, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: EASE, delay: load ? +(el.dataset.delay ?? 0.35) : +(el.dataset.delay ?? 0), scrollTrigger: load ? undefined : once(el), ...handoff([el]) });
  });

  $$('[data-stagger]').forEach((wrap) => {
    const load = isLoad(wrap.dataset.stagger);
    const x = wrap.dataset.axis === 'x';
    const kids = Array.from(wrap.children);
    gsap.fromTo(kids, { autoAlpha: 0, x: x ? 90 : 0, y: x ? 0 : 46 }, {
      autoAlpha: 1, x: 0, y: 0, duration: 1.2, ease: EASE, stagger: +(wrap.dataset.each ?? 0.09),
      delay: load ? +(wrap.dataset.delay ?? 0.45) : 0, scrollTrigger: load ? undefined : once(wrap, wrap.dataset.start ?? 'top 86%'), ...handoff(kids),
    });
  });

  $$('[data-clip]').forEach((fig) => {
    const img = fig.querySelector('img');
    const tl = gsap.timeline({ scrollTrigger: once(fig, 'top 92%') });
    tl.fromTo(fig, { clipPath: 'inset(12% 7% 12% 7%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.7, ease: 'expo.inOut' });
    if (img) {
      tl.fromTo(img, { scale: 1.35 }, { scale: 1.08, duration: 2, ease: EASE }, 0);
      gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  });

  $$('[data-parallax]').forEach((el) => {
    const amt = +(el.dataset.parallax || 0.1) * 100;
    gsap.fromTo(el, { yPercent: -amt / 2 }, { yPercent: amt / 2, ease: 'none', scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  $$('[data-tilt-in]').forEach((el) => {
    gsap.fromTo(el, { rotateX: 26, yPercent: 10, scale: 0.9, transformPerspective: 1600, transformOrigin: '50% 0%' }, {
      rotateX: 0, yPercent: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: el.parentElement ?? el, start: 'top 95%', end: 'center 55%', scrub: 0.8 },
    });
  });

  /* ------------------------------------------------------------ numbers & data viz */
  $$('[data-count]').forEach((el) => {
    const raw = el.textContent ?? '';
    const m = raw.match(/\d[\d.,]*/);
    if (!m || m.index === undefined) return;
    const num = m[0], pre = raw.slice(0, m.index), post = raw.slice(m.index + num.length);
    const target = parseFloat(num.replace(/,/g, ''));
    const dec = (num.split('.')[1] || '').length, comma = num.includes(','), pad = /^0\d/.test(num) ? num.length : 0;
    const fmt = (v: number) => {
      let s = comma ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
      if (pad) s = s.padStart(pad, '0');
      return pre + s + post;
    };
    const o = { v: 0 };
    el.textContent = fmt(0);
    gsap.to(o, { v: target, duration: 1.9, ease: 'power3.out', scrollTrigger: once(el, 'top 92%'), onUpdate: () => { el.textContent = fmt(o.v); }, onComplete: () => { el.textContent = raw; } });
  });

  $$('[data-draw]').forEach((svg) => {
    const paths = $$<SVGPathElement>('[data-draw-path]', svg);
    if (paths.length) gsap.from(paths, { drawSVG: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.04, scrollTrigger: once(svg, 'top 85%') });
    const nodes = $$('[data-node]', svg);
    if (nodes.length) gsap.from(nodes, { autoAlpha: 0, y: 14, duration: 0.9, ease: EASE, stagger: 0.05, scrollTrigger: once(svg, 'top 85%'), ...handoff(nodes) });
    const fades = $$('[data-fade]', svg);
    if (fades.length) gsap.from(fades, { autoAlpha: 0, duration: 1.4, ease: 'power2.out', delay: 0.6, scrollTrigger: once(svg, 'top 85%') });
  });

  $$<SVGCircleElement>('[data-gauge]').forEach((c) => {
    const pct = +(c.dataset.gauge ?? 100);
    gsap.fromTo(c, { drawSVG: '0% 0%' }, { drawSVG: `0% ${pct}%`, duration: 2, ease: 'power3.out', scrollTrigger: once(c, 'top 92%') });
  });

  $$('[data-bars]').forEach((wrap) => {
    gsap.from($$('.bar', wrap), { scaleX: 0, transformOrigin: '0% 50%', duration: 1.3, ease: EASE, stagger: 0.12, scrollTrigger: once(wrap, 'top 80%') });
    gsap.from($$('.rel__m', wrap), { scale: 0, rotate: 45, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.05, delay: 0.5, scrollTrigger: once(wrap, 'top 80%') });
  });

  $$('[data-pop]').forEach((svg) => {
    gsap.from($$('rect', svg), { scale: 0, transformOrigin: '50% 50%', duration: 0.55, ease: 'back.out(2)', stagger: { each: 0.008, from: 'random' }, scrollTrigger: once(svg, 'top 88%') });
  });

  $$('[data-code]').forEach((win) => {
    gsap.from($$('.ln', win), { autoAlpha: 0, x: -14, duration: 0.5, ease: 'power2.out', stagger: 0.05, scrollTrigger: once(win, 'top 80%') });
    const res = win.querySelector<HTMLElement>('[data-type]');
    if (res) { const text = res.textContent ?? ''; gsap.fromTo(res, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, delay: 1.1, scrambleText: { text, chars: '01', speed: 0.8 }, scrollTrigger: once(win, 'top 80%') }); }
  });

  /* ------------------------------------------------------------ scrubbed timelines */
  $$('[data-timeline]').forEach((tl) => {
    const fill = tl.querySelector('[data-timeline-fill]');
    if (fill) gsap.fromTo(tl, { '--p': 0 }, { '--p': 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 72%', end: 'bottom 62%', scrub: 0.6 } });
    $$('[data-timeline-step]', tl).forEach((s) => ScrollTrigger.create({ trigger: s, start: tl.dataset.timeline === 'x' ? 'top 78%' : 'center 70%', onEnter: () => s.classList.add('is-active'), onLeaveBack: () => s.classList.remove('is-active') }));
  });

  /* ------------------------------------------------------------ pointer interactions */
  // Buttons stay put. The fill grows as a circle from the exact point the pointer enters and retracts toward
  // the point it leaves, so the response feels physical without the button itself moving.
  $$('.btn, [data-fill]').forEach((el) => {
    const at = (e: PointerEvent) => { const r = el.getBoundingClientRect(); el.style.setProperty('--fx', `${((e.clientX - r.left) / r.width) * 100}%`); el.style.setProperty('--fy', `${((e.clientY - r.top) / r.height) * 100}%`); };
    el.addEventListener('pointerenter', at); el.addEventListener('pointerleave', at);
  });

  if (finePointer) {
    // Pointer-driven 3D tilt with layered depth
    $$('[data-tilt]').forEach((el) => {
      const layers = $$('[data-tilt-layer]', el).map((l) => ({ l, d: +(l.dataset.tiltLayer || 1), rx: gsap.quickTo(l, 'rotateX', { duration: 0.8, ease: 'power3.out' }), ry: gsap.quickTo(l, 'rotateY', { duration: 0.8, ease: 'power3.out' }), x: gsap.quickTo(l, 'x', { duration: 0.8, ease: 'power3.out' }), y: gsap.quickTo(l, 'y', { duration: 0.8, ease: 'power3.out' }) }));
      gsap.set(layers.map((o) => o.l), { transformPerspective: 900 });
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; layers.forEach((o) => { o.ry(px * 14 * o.d); o.rx(-py * 12 * o.d); o.x(px * 18 * o.d); o.y(py * 14 * o.d); }); });
      el.addEventListener('pointerleave', () => layers.forEach((o) => { o.ry(0); o.rx(0); o.x(0); o.y(0); }));
    });
  }

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  root.classList.add('motion-ready');
}
