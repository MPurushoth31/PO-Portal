/* ==========================================================================
   TCCC PO Request Portal — Motion & Effects engine
   --------------------------------------------------------------------------
   Purely additive: this file never edits, replaces or removes any existing
   content, markup, handler or data. It only adds CSS classes / decorative
   aria-hidden elements and drives animations.

   Performance design
   - Only compositor properties are animated (opacity / translate / scale / rotate).
   - One shared requestAnimationFrame loop per feature; idle = zero work.
   - Event delegation (one passive listener each), no per-element listeners.
   - IntersectionObserver for scroll reveals (no scroll polling, no layout reads).
   - Spotlight is ONE fixed element, positioned from a cached rect (no per-frame
     layout reads while hovering).
   - Fully disabled for prefers-reduced-motion users.
   ========================================================================== */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches) return;

  const root = document.documentElement;
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const now = () => performance.now();

  let lastViewSwitch = 0;

  /* Performance governor ------------------------------------------------
     Starts in "full" mode. If real frame times show the device struggling
     during animation windows (or the device is low-spec / Data Saver), the
     heavy effects switch off automatically (html.mx-lite) so the portal
     never feels laggy. Force full effects: localStorage['mx-effects']='full'
     Force lite: localStorage['mx-effects']='lite'.                          */
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    sget(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    sset(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const forced = store.get('mx-effects');
  const conn = navigator.connection || {};
  let lite = forced === 'lite' ||
    (forced !== 'full' && (
      store.sget('mx-lite') === '1' ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
      conn.saveData === true));
  const goLite = () => {
    if (lite || forced === 'full') return;
    lite = true;
    root.classList.add('mx-lite');
    store.sset('mx-lite', '1');
  };

  function boot() {
    try { init(); }
    catch (err) {
      root.classList.remove('mx-js');
      console.warn('[motion-effects] disabled after error:', err);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  function init() {
    root.classList.add('mx-js');
    if (lite) root.classList.add('mx-lite');

    /* ---------------------------------------------------------------
       1. Scroll progress bar
    --------------------------------------------------------------- */
    const bar = document.createElement('div');
    bar.className = 'mx-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let progressQueued = false, docMax = 0;
    const measureDoc = () => { docMax = root.scrollHeight - window.innerHeight; queueProgress(); };
    if (window.ResizeObserver) new ResizeObserver(measureDoc).observe(document.body);
    const updateProgress = () => {
      progressQueued = false;
      const max = docMax;
      const p = max > 4 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      bar.classList.toggle('on', window.scrollY > 8);
    };
    const queueProgress = () => {
      if (!progressQueued) { progressQueued = true; requestAnimationFrame(updateProgress); }
    };
    window.addEventListener('scroll', queueProgress, { passive: true });
    window.addEventListener('resize', measureDoc, { passive: true });

    /* ---------------------------------------------------------------
       2. Scroll / view reveal system
    --------------------------------------------------------------- */
    const REVEAL = [
      '.page-heading', '.dashboard-hero', '.overview-action-banner', '.metric-card',
      '.overview-main-grid > *',
      '.home-action-card', '.home-workflow-panel', '.home-inspiration-band',
      '.track-hero-banner', '.track-workspace-layout > *', '.track-quote-banner',
      '.saved-drafts-panel', '.form-page-layout > *',
      '.email-confirmation-stepper', '.email-preview-layout > *',
      '.reviewer-kpi', '.reviewer-console-layout > *',
      '.master-metric', '.master-panel',
      '.report-hero', '.report-filter-panel', '.report-kpi', '.report-charts-grid > *',
      '.report-register-panel', '.report-notice',
      '.request-detail-page-content > *'
    ].join(',');
    const CONTAINER_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'FORM', 'BUTTON', 'HEADER']);

    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) =>
          (a.boundingClientRect.top - b.boundingClientRect.top) ||
          (a.boundingClientRect.left - b.boundingClientRect.left));
      visible.forEach((entry, i) => {
        const el = entry.target;
        el.style.setProperty('--mx-d', Math.min(i, 5) * 70 + 'ms');
        // Very large panels would rasterize a huge layer for little visual gain: show them instantly.
        if (el.offsetWidth * el.offsetHeight > 420000) el.classList.add('mx-big');
        else el.classList.remove('mx-big');
        el.classList.add('mx-in');
        io.unobserve(el);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' });

    function scan(rootNode) {
      if (!rootNode || rootNode.nodeType !== 1) return;
      const found = [];
      if (rootNode.matches(REVEAL)) found.push(rootNode);
      rootNode.querySelectorAll(REVEAL).forEach(n => found.push(n));
      for (const el of found) {
        if (el.__mx) continue;
        const parent = el.parentElement;
        if (parent && parent.closest('.mx-reveal')) continue; // nested: parent animates for both
        el.__mx = true;
        el.classList.add('mx-reveal');
        io.observe(el);
      }
    }

    function sweep(view) {
      // Safety net: never leave anything on-screen hidden.
      $$('.mx-reveal:not(.mx-in)', view).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('mx-in');
          io.unobserve(el);
        }
      });
    }

    /* ---------------------------------------------------------------
       3. Animated number counters (KPI cards)
    --------------------------------------------------------------- */
    const COUNT_SEL = [
      '#metric-total', '.metric-card .metric-value', '#metric-value',
      '[id^="reviewer-kpi-"]', '[id^="report-kpi-"]:not([id$="-note"])',
      '.master-metric strong'
    ].join(',');

    const parseNum = (text) => {
      const m = text.match(/\d[\d,]*(?:\.\d+)?/g);
      if (!m || m.length !== 1) return null;       // only single, unambiguous numbers
      const raw = m[0];
      const n = parseFloat(raw.replace(/,/g, ''));
      if (!isFinite(n)) return null;
      const i = text.indexOf(raw);
      return { pre: text.slice(0, i), post: text.slice(i + raw.length), n,
               dec: (raw.split('.')[1] || '').length, group: raw.indexOf(',') > -1 };
    };
    const nfCache = {};
    const nf = (dec) => nfCache[dec] || (nfCache[dec] = new Intl.NumberFormat('en-US',
      { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    const fmtNum = (p, v) => {
      const body = p.group ? nf(p.dec).format(v) : v.toFixed(p.dec);
      return p.pre + body + p.post;
    };

    const counters = new Set();
    let counterRaf = 0, counterTick = false;
    function counterFrame(ts) {
      counterRaf = 0;
      const paint = (counterTick = !counterTick);           // text reflow: update every other frame (~30fps)
      counters.forEach(el => {
        const c = el.__mxc;
        const k = Math.max(0, (ts - c.t0) / c.dur);
        if (!paint && k < 1) return;
        if (k >= 1 || !c.node.isConnected) {
          if (c.node.isConnected) c.node.data = el.__mxFinal;   // restore exact original text
          el.classList.remove('mx-counting');
          counters.delete(el);
          return;
        }
        const eased = 1 - Math.pow(2, -10 * k);                  // expo-out
        c.cur = c.from + (c.to - c.from) * eased;
        c.node.data = fmtNum(c.p, c.p.dec ? c.cur : Math.round(c.cur));
      });
      if (counters.size) counterRaf = requestAnimationFrame(counterFrame);
    }
    function startCount(el, from, p) {
      if (lite) return;                                // struggling device: show final numbers immediately
      const node = el.firstChild;
      if (!node || node.nodeType !== 3 || el.childNodes.length !== 1) return;
      if (Math.abs(from - p.n) < 1e-9) return;
      el.__mxc = { node, p, from, cur: from, to: p.n, t0: now(),
                   dur: Math.min(1200, 650 + Math.log10(Math.max(p.n, 1)) * 150) };
      el.classList.add('mx-counting');
      counters.add(el);
      if (!counterRaf) counterRaf = requestAnimationFrame(counterFrame);
    }
    const visibleEl = (el) => el.offsetParent !== null || el.getClientRects().length > 0;

    const countObserver = new MutationObserver((muts) => {
      const seen = new Set();
      muts.forEach(m => seen.add(m.target));
      seen.forEach(el => {
        const text = el.textContent;
        if (text === el.__mxFinal) return;                        // refresh with same value: no animation
        const prev = el.__mxc && counters.has(el) ? el.__mxc.cur : (el.__mxShown || 0);
        el.__mxFinal = text;
        const p = parseNum(text);
        if (!p) { counters.delete(el); el.classList.remove('mx-counting'); return; }
        el.__mxShown = p.n;
        if (visibleEl(el)) startCount(el, prev, p);
      });
    });
    function registerCounters(ctx) {
      $$(COUNT_SEL, ctx).forEach(el => {
        if (el.__mxReg) return;
        el.__mxReg = true;
        el.__mxFinal = el.textContent;
        const p = parseNum(el.textContent);
        el.__mxShown = p ? p.n : 0;
        countObserver.observe(el, { childList: true });
      });
    }
    function countView(view) {
      $$(COUNT_SEL, view).forEach(el => {
        if (!visibleEl(el)) return;
        const p = parseNum(el.__mxFinal != null ? el.__mxFinal : el.textContent);
        if (counters.has(el) && el.__mxc && now() - el.__mxc.t0 < 600) return;
        if (p && p.n > 0) { el.__mxFinal = el.__mxFinal != null ? el.__mxFinal : el.textContent; startCount(el, 0, p); }
      });
    }

    /* ---------------------------------------------------------------
       4. View activation (staggered entrance + replays)
          NOTE: created BEFORE the table observer so lastViewSwitch is
          already set when that observer runs.
    --------------------------------------------------------------- */
    let monitoring = false, windowsSeen = 0, badWindows = 0;
    function monitorFrames() {
      if (monitoring || lite || forced === 'full') return;
      monitoring = true;
      const until = now() + 1800;
      let prev = 0, jank = 0;
      const tick = (ts) => {
        if (prev) { const dt = ts - prev; if (dt > 42 && dt < 1500) jank++; }
        prev = ts;
        if (now() < until && !document.hidden) { requestAnimationFrame(tick); return; }
        monitoring = false;
        windowsSeen++;
        if (windowsSeen > 1) {                       // ignore the very first window (page load / image decode)
          badWindows = jank >= 5 ? badWindows + 1 : 0;
          if (badWindows >= 2) goLite();
        }
      };
      requestAnimationFrame(tick);
    }

    const wasActive = new WeakMap();
    function onActivate(view) {
      monitorFrames();
      lastViewSwitch = now();
      view.classList.add('mx-entering');
      clearTimeout(view.__mxT);
      view.__mxT = setTimeout(() => view.classList.remove('mx-entering'), 1700);
      $$('.mx-reveal.mx-in', view).forEach(el => { el.classList.remove('mx-in'); io.observe(el); });
      scan(view);
      registerCounters(view);
      setTimeout(() => countView(view), 150);
      setTimeout(() => sweep(view), 1500);
      queueProgress();
    }
    const viewObserver = new MutationObserver((muts) => {
      muts.forEach(m => {
        const v = m.target;
        const active = v.classList.contains('active');
        if (active && !wasActive.get(v)) onActivate(v);
        wasActive.set(v, active);
      });
    });
    $$('.view').forEach(v => {
      wasActive.set(v, v.classList.contains('active'));
      viewObserver.observe(v, { attributes: true, attributeFilter: ['class'] });
    });

    /* ---------------------------------------------------------------
       5. Table rows: animate only on a genuinely fresh render
          (background refreshes with unchanged data stay perfectly still)
    --------------------------------------------------------------- */
    const lastSig = new Map();
    function handleTbody(tb) {
      if (tb.closest('#view-create, form')) return;               // never touch editable forms
      const key = tb.id || ((tb.closest('[id]') || {}).id) || '';
      const sig = tb.textContent;
      const prev = key ? lastSig.get(key) : undefined;
      const fresh = now() - lastViewSwitch < 600;
      if (!key || prev === undefined || prev !== sig || fresh) tb.classList.add('mx-anim');
      else tb.classList.remove('mx-anim');
      if (key) lastSig.set(key, sig);
    }

    const domObserver = new MutationObserver((muts) => {
      const bodies = new Set();
      for (const m of muts) {
        const t = m.target;
        if (!m.addedNodes.length || t.nodeType !== 1) continue;
        if (t.tagName === 'TBODY') {
          for (const n of m.addedNodes) if (n.nodeType === 1 && n.tagName === 'TR') { bodies.add(t); break; }
          continue;
        }
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'TBODY') { bodies.add(n); continue; }
          if (CONTAINER_TAGS.has(n.tagName)) {
            scan(n);
            if (n.querySelector) {
              n.querySelectorAll('tbody').forEach(b => bodies.add(b));
              if (n.querySelector(COUNT_SEL) || n.matches(COUNT_SEL)) registerCounters(n.parentNode || n);
            }
          }
        }
      }
      bodies.forEach(handleTbody);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    /* ---------------------------------------------------------------
       6. Click ripple (event-delegated)
    --------------------------------------------------------------- */
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const target = e.target;
      const btn = target && target.closest ? target.closest('.button, .icon-button, .row-action') : null;
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement('span');
      dot.className = 'mx-ripple';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' +
        (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
      const wasStatic = getComputedStyle(btn).position === 'static';
      if (wasStatic) btn.classList.add('mx-rip-pos');
      btn.classList.add('mx-rip-ov');
      btn.__mxr = (btn.__mxr || 0) + 1;
      btn.appendChild(dot);
      setTimeout(() => {
        dot.remove();
        if (--btn.__mxr <= 0) btn.classList.remove('mx-rip-ov', 'mx-rip-pos');
      }, 720);
    }, { passive: true });

    /* ---------------------------------------------------------------
       7. Cursor spotlight + 3D tilt (mouse devices only)
    --------------------------------------------------------------- */
    if (hasFinePointer) {
      const TARGETS = [
        { sel: '.home-action-card',                                              rgb: '200,16,46',  a: .16, r: 1,   tilt: 7 },
        { sel: '.metric-card, .reviewer-kpi, .report-kpi, .master-metric',       rgb: '11,119,114', a: .15, r: 1,   tilt: 4 },
        { sel: '.home-welcome-hero, .dashboard-hero, .report-hero, .track-hero-banner', rgb: '255,255,255', a: .14, r: 1.7, tilt: 0 },
        { sel: '.home-workflow-step',                                            rgb: '200,16,46',  a: .10, r: .7,  tilt: 0 }
      ];
      const ALL = TARGETS.map(t => t.sel).join(',');

      const spot = document.createElement('div');
      spot.className = 'mx-spot';
      spot.setAttribute('aria-hidden', 'true');
      document.body.appendChild(spot);

      let cur = null, px = 0, py = 0, spotRaf = 0;

      const cfgFor = (el) => TARGETS.find(t => el.matches(t.sel));

      function enter(el) {
        if (el.classList.contains('mx-reveal') && !el.classList.contains('mx-in')) return;
        const cfg = cfgFor(el);
        if (!cfg) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 30) return;
        cur = { el, cfg, l: rect.left, t: rect.top, w: rect.width, h: rect.height,
                sx: window.scrollX, sy: window.scrollY };
        spot.style.width = rect.width + 'px';
        spot.style.height = rect.height + 'px';
        spot.style.borderRadius = getComputedStyle(el).borderRadius;
        spot.style.setProperty('--mx-rgb', cfg.rgb);
        spot.style.setProperty('--mx-a', cfg.a);
        spot.style.setProperty('--mx-rad', Math.round(Math.max(rect.width, rect.height) * 0.62 * cfg.r) + 'px');
        spot.classList.add('on');
      }

      function leave() {
        if (!cur) return;
        const { el, cfg } = cur;
        if (cfg.tilt) {
          const from = el.style.rotate;
          el.style.rotate = '';
          if (from && el.animate) {
            const axis = from.split(' ').slice(0, 2).join(' ');
            el.animate([{ rotate: from }, { rotate: axis + ' 0 0deg' }],
                       { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
          }
        }
        spot.classList.remove('on');
        cur = null;
      }

      function spotFrame() {
        spotRaf = 0;
        if (!cur) return;
        const L = cur.l + (cur.sx - window.scrollX);
        const T = cur.t + (cur.sy - window.scrollY);
        const x = px - L, y = py - T;
        spot.style.transform = 'translate3d(' + L + 'px,' + T + 'px,0)';
        spot.style.setProperty('--mx-x', x.toFixed(1) + 'px');
        spot.style.setProperty('--mx-y', y.toFixed(1) + 'px');
        if (cur.cfg.tilt) {
          const nx = Math.max(-1, Math.min(1, (x / cur.w - 0.5) * 2));
          const ny = Math.max(-1, Math.min(1, (y / cur.h - 0.5) * 2));
          const mag = Math.min(1, Math.hypot(nx, ny));
          cur.el.style.rotate = mag < 0.02 ? '' :
            (-ny).toFixed(3) + ' ' + nx.toFixed(3) + ' 0 ' + (cur.cfg.tilt * mag).toFixed(2) + 'deg';
        }
      }
      const queueSpot = () => { if (!spotRaf) spotRaf = requestAnimationFrame(spotFrame); };

      document.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || lite) { if (cur) leave(); return; }
        px = e.clientX; py = e.clientY;
        const t = e.target;
        const el = t && t.closest ? t.closest(ALL) : null;
        if (!cur || el !== cur.el) {
          if (cur) leave();
          if (el) enter(el);
        }
        if (cur) queueSpot();
      }, { passive: true });

      document.documentElement.addEventListener('mouseleave', leave);
      window.addEventListener('scroll', () => { if (cur) queueSpot(); }, { passive: true });
      window.addEventListener('resize', leave, { passive: true });
      window.addEventListener('blur', leave);
      document.addEventListener('pointerdown', () => { if (cur) cur.el.style.rotate = ''; }, { passive: true });
    }

    /* ---------------------------------------------------------------
       Kick off for whichever view is already showing
    --------------------------------------------------------------- */
    registerCounters(document);
    const first = document.querySelector('.view.active');
    if (first) onActivate(first);
    updateProgress();
  }
})();
