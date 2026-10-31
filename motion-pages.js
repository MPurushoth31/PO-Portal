/* TCCC PO Request Portal — per-page motion hooks.
   Strictly additive: no existing application source or UI text is edited. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stopped = false;
  const addedClasses = new Map();
  const ownedNodes = new Set();
  const timers = new Set();
  const rafs = new Set();
  const observers = [];
  const listeners = [];
  const loopTargets = new Set();
  const loopVisible = new WeakSet();
  const seenToasts = new WeakSet();
  const priorSummary = new WeakMap();
  const priorTrackStatuses = new Map();
  const parallaxState = new WeakMap();
  const validationSeen = new WeakSet();
  const underlinedTrackHeadings = new WeakSet();
  const poppedBadges = new WeakSet();
  const observedHomeCards = new WeakSet();
  let homeCardObserver = null;
  const lineTimers = new Map();
  const lineDelayStyles = new Map();
  const magneticState = new WeakMap();
  const ioSeen = new WeakSet();
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const now = () => performance.now();
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let batchRaf = 0;
  let scrollRaf = 0;
  let parallaxRaf = 0;
  let flowRaf = 0;
  let magneticRaf = 0;
  let breadcrumbText = '';
  let currentViewId = '';
  let stepIndex = null;
  let lastResultCount = '';
  let lastRequestCount = '';
  let lastProgressId = '';
  let navPill = null;
  let heroLayer = null;
  let workflowDot = null;
  let skeletonLayer = null;
  let skeletonMount = null;
  let skeletonTimer = 0;
  let searchBusyStarted = 0;
  let saveStarted = 0;
  let submitSignalUntil = 0;
  let pendingSaveOutcome = '';
  let magneticTarget = null;
  let magneticPointer = { x: 0, y: 0 };
  let flowMotion = { start: null, end: null, startedAt: 0, duration: 4800 };
  let parallaxVisible = false;
  let viewTransitionDispatch = false;

  const storageGet = key => { try { return window.localStorage.getItem(key); } catch (_) { return null; } };
  const isLite = () => root.classList.contains('mx-lite') || storageGet('mx-effects') === 'lite';
  const motionAllowed = () => !stopped && !reducedQuery.matches;
  const heavyAllowed = () => motionAllowed() && !isLite() && !document.hidden;
  const scheduleTimer = (fn, ms) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!stopped) safe(fn)(); }, ms);
    timers.add(id);
    return id;
  };
  const scheduleRaf = fn => {
    const id = requestAnimationFrame(ts => { rafs.delete(id); if (!stopped) safe(() => fn(ts))(); });
    rafs.add(id);
    return id;
  };
  const addClass = (el, name) => {
    if (!el || !el.classList) return;
    if (!addedClasses.has(el)) addedClasses.set(el, new Set());
    if (!el.classList.contains(name)) { el.classList.add(name); addedClasses.get(el).add(name); }
  };
  const removeClass = (el, name) => { if (el && el.classList) el.classList.remove(name); };
  const ownNode = (tag, className, parent) => {
    const node = document.createElement(tag);
    node.className = className;
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('data-mxp-owned', 'true');
    node.setAttribute('tabindex', '-1');
    node.style.pointerEvents = 'none';
    if ('inert' in node) node.inert = true;
    parent.appendChild(node);
    ownedNodes.add(node);
    return node;
  };
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push({ target, type, handler, options });
    return handler;
  };
  const safe = fn => (...args) => {
    if (stopped) return;
    try { return fn(...args); }
    catch (error) { failSafe(error); }
  };

  function failSafe(error) {
    if (stopped) return;
    // Restore every inline transform we own before shutting down, so a failed enhancement
    // leaves the application in its pre-enhancement state.
    try { stopParallax(); stopFlowMotion(); resetMagnetic(); stopSkeleton(); } catch (_) {}
    stopped = true;
    listeners.forEach(({ target, type, handler, options }) => { try { target.removeEventListener(type, handler, options); } catch (_) {} });
    listeners.length = 0;
    observers.forEach(observer => { try { observer.disconnect(); } catch (_) {} });
    timers.forEach(id => clearTimeout(id));
    timers.clear();
    rafs.forEach(id => cancelAnimationFrame(id));
    rafs.clear();
    [batchRaf, scrollRaf, parallaxRaf, flowRaf, magneticRaf].forEach(id => { if (id) cancelAnimationFrame(id); });
    addedClasses.forEach((names, el) => names.forEach(name => { try { el.classList.remove(name); } catch (_) {} }));
    addedClasses.clear();
    lineDelayStyles.forEach((saved, row) => {
      try { if (saved.value) row.style.setProperty('--mxp-row-delay', saved.value, saved.priority); else row.style.removeProperty('--mxp-row-delay'); } catch (_) {}
    });
    lineDelayStyles.clear();
    lineTimers.clear();
    ownedNodes.forEach(node => { try { node.remove(); } catch (_) {} });
    ownedNodes.clear();
    if (heroLayer) heroLayer.remove();
    if (workflowDot) workflowDot.remove();
    if (navPill) navPill.remove();
    root.classList.remove('mxp-native-vt', 'mxp-tab-hidden');
    if (error && window.console && typeof console.error === 'function') console.error('[motion-pages] safe shutdown:', error);
  }

  if (reducedQuery.matches) return;
  if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', safe(init), { once: true });
  else safe(init)();

  function init() {
    /* Live shell elements are intentionally queried repeatedly: app.js re-renders with innerHTML. */
    if (isLite()) addClass(root, 'mxp-local-lite');
    if (document.hidden) addClass(root, 'mxp-tab-hidden'); else removeClass(root, 'mxp-tab-hidden');

    installNavPill();
    installHeaderShadow();
    installHeroLayer();
    installCardGlows();
    installWorkflowDot();
    installWizardProgress();
    installInitialLoopTargets();
    installMutationObservers();
    installViewObserver();
    installWizardObserver();
    installLoopObserver();
    installEventDelegation();
    installScrollMotion();
    installMagneticDrift();
    installViewTransitionDelegation();
    installSafetySignals();
    observeFooterQuote();
    refreshNavPill();
    syncWizardProgress();
    syncHeaderShadow();
    scanCurrentState();
  }

  function installNavPill() {
    const nav = $('.side-nav');
    if (!nav) return;
    navPill = ownNode('span', 'mxp-nav-pill', nav);
    addClass(navPill, 'mxp-visible');
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(safe(refreshNavPill));
      ro.observe(nav);
      observers.push(ro);
    }
    listen(nav, 'scroll', safe(refreshNavPill), { passive: true });
  }

  function refreshNavPill() {
    const nav = $('.side-nav');
    if (!nav || !navPill || !navPill.isConnected || isLite()) return;
    const active = $('.side-nav .nav-item.active');
    if (!active) { removeClass(navPill, 'mxp-visible'); return; }
    const navRect = nav.getBoundingClientRect();
    const itemRect = active.getBoundingClientRect();
    if (navRect.width < 2 || itemRect.height < 2) { removeClass(navPill, 'mxp-visible'); return; }
    // Fixed full-nav width; transform scales the pill to the active tab without width animation.
    const ratio = Math.max(.08, Math.min(1, itemRect.width / Math.max(navRect.width, 1)));
    navPill.style.transform = `translate3d(${Math.round(itemRect.left - navRect.left)}px,${Math.round(itemRect.top - navRect.top)}px,0) scaleX(${ratio.toFixed(4)})`;
    navPill.style.transformOrigin = 'left center';
    addClass(navPill, 'mxp-visible');
  }

  function installHeaderShadow() {
    const topbar = $('.topbar');
    if (!topbar) return;
    syncHeaderShadow();
  }
  function syncHeaderShadow() {
    const topbar = $('.topbar');
    if (!topbar) return;
    if (window.scrollY > 8) addClass(topbar, 'mxp-scrolled');
    else removeClass(topbar, 'mxp-scrolled');
  }

  function installHeroLayer() {
    const hero = $('#view-home .home-welcome-hero');
    if (!hero || hero.querySelector('.mxp-hero-image-layer')) return;
    let imageUrl = '';
    try {
      const bg = getComputedStyle(hero).backgroundImage;
      const matches = [...bg.matchAll(/url\((?:"|')?(.*?)(?:"|')?\)/g)];
      if (matches.length) imageUrl = matches[matches.length - 1][1];
    } catch (_) { imageUrl = ''; }
    if (!imageUrl) return;
    heroLayer = ownNode('div', 'mxp-hero-image-layer', hero);
    heroLayer.style.backgroundImage = `url("${imageUrl.replace(/"/g, '\\"')}")`;
    try { heroLayer.style.backgroundPosition = getComputedStyle(hero).backgroundPosition; } catch (_) {}
    listen(heroLayer, 'animationend', safe(event => {
      if (event.animationName === 'mxpHeroSettle') removeHeroLayer();
    }));
    const heroIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || stopped) return;
        if (hero.classList.contains('active') || $('#view-home')?.classList.contains('active')) startHeroSettle();
        heroIO.unobserve(entry.target);
      });
    }, { threshold: .05 });
    heroIO.observe(hero);
    observers.push(heroIO);
    scheduleTimer(() => { if (heroLayer && heroLayer.isConnected && !heroLayer.classList.contains('mxp-hero-settle') && $('#view-home')?.classList.contains('active')) startHeroSettle(); }, 900);
  }

  function startHeroSettle() {
    if (!heroLayer?.isConnected || heroLayer.classList.contains('mxp-hero-settle')) return;
    addClass(heroLayer, 'mxp-hero-settle');
    // Animationend is primary; this bound also prevents a stale overlay if an engine suppresses it.
    scheduleTimer(() => { if (heroLayer?.isConnected && heroLayer.classList.contains('mxp-hero-settle')) removeHeroLayer(); }, 1650);
  }
  function removeHeroLayer() {
    if (!heroLayer) return;
    const layer = heroLayer;
    layer.remove();
    ownedNodes.delete(layer);
    heroLayer = null;
  }

  function installCardGlows() {
    $$('#view-home .home-action-card').forEach(card => {
      if (card.querySelector('.mxp-card-glow')) return;
      const glow = ownNode('span', 'mxp-card-glow', card);
      const color = card.classList.contains('home-action-create') ? 'rgba(200,16,46,.2)'
        : card.classList.contains('home-action-track') ? 'rgba(44,119,210,.19)'
          : 'rgba(36,160,101,.18)';
      glow.style.setProperty('--mxp-glow', color);
    });
    if (!homeCardObserver && window.IntersectionObserver) {
      homeCardObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting || stopped) return;
        const badge = $('.home-action-number', entry.target);
        if (badge && !poppedBadges.has(badge)) {
          poppedBadges.add(badge);
          addClass(badge, 'mxp-badge-pop');
          scheduleTimer(() => removeClass(badge, 'mxp-badge-pop'), 450);
        }
        homeCardObserver.unobserve(entry.target);
      }), { threshold: .12 });
      observers.push(homeCardObserver);
    }
    if (homeCardObserver) $$('#view-home .home-action-card').forEach(card => {
      if (!observedHomeCards.has(card)) { observedHomeCards.add(card); homeCardObserver.observe(card); }
    });
  }

  function installWorkflowDot() {
    const steps = $('#view-home .home-workflow-steps');
    if (!steps || steps.querySelector('.mxp-workflow-dot')) return;
    workflowDot = ownNode('span', 'mxp-workflow-dot', steps);
    measureWorkflowPath();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(safe(measureWorkflowPath));
      ro.observe(steps);
      observers.push(ro);
    }
  }

  function measureWorkflowPath() {
    const steps = $('#view-home .home-workflow-steps');
    const arrows = steps ? $$('.home-workflow-steps > i', steps) : [];
    if (!steps || !workflowDot || arrows.length < 1) return;
    const base = steps.getBoundingClientRect();
    const first = arrows[0].getBoundingClientRect();
    const last = arrows[arrows.length - 1].getBoundingClientRect();
    flowMotion.start = { x: first.left + first.width / 2 - base.left, y: first.top + first.height / 2 - base.top };
    flowMotion.end = { x: last.left + last.width / 2 - base.left, y: last.top + last.height / 2 - base.top };
    workflowDot.style.setProperty('--mxp-flow-start-x', `${flowMotion.start.x}px`);
    workflowDot.style.setProperty('--mxp-flow-start-y', `${flowMotion.start.y}px`);
    workflowDot.style.setProperty('--mxp-flow-end-x', `${flowMotion.end.x}px`);
    workflowDot.style.setProperty('--mxp-flow-end-y', `${flowMotion.end.y}px`);
    workflowDot.style.transform = `translate3d(${flowMotion.start.x}px,${flowMotion.start.y}px,0) scale(.7)`;
  }

  function installWizardProgress() {
    const stepper = $('#wizard-stepper');
    if (!stepper || stepper.querySelector('.mxp-wizard-progress-track')) return;
    const track = ownNode('span', 'mxp-wizard-progress-track', stepper);
    const fill = ownNode('span', 'mxp-wizard-progress-fill', track);
    // Keep references through DOM lookup; observers update only the compositor transform.
    const position = () => {
      const host = $('#wizard-stepper');
      const nums = $$('#wizard-stepper .wizard-step-button .wizard-step-number');
      if (!host || nums.length < 2 || !track.isConnected) return;
      const r = host.getBoundingClientRect();
      const a = nums[0].getBoundingClientRect();
      const b = nums[nums.length - 1].getBoundingClientRect();
      track.style.left = `${a.left + a.width / 2 - r.left}px`;
      track.style.right = `${r.right - (b.left + b.width / 2)}px`;
      track.style.top = `${a.top + a.height / 2 - r.top}px`;
      track.style.transform = 'translateY(-50%)';
    };
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(safe(position));
      ro.observe(stepper);
      observers.push(ro);
    }
    scheduleTimer(position, 80);
    position();
    syncWizardProgress();
  }

  function syncWizardProgress() {
    const stepper = $('#wizard-stepper');
    const fill = $('.mxp-wizard-progress-fill', stepper || document);
    const panels = $$('.wizard-panel');
    const active = $('.wizard-panel.active');
    if (!stepper || !fill || !panels.length || !active) return;
    const count = panels.length;
    const idx = Math.max(0, panels.indexOf(active));
    fill.style.transform = `scaleX(${count > 1 ? idx / (count - 1) : 0})`;
  }

  function installInitialLoopTargets() {
    [
      '#view-home .home-workflow-panel',
      '#view-home .home-inspiration-ribbon',
      '.top-create', '#view-home .home-primary-action', '#wizard-next', '#submit-request', '#track-search-submit',
      '#wizard-next',
      '#view-track .track-initial-icon',
      '#view-track .track-progress-empty-icon',
      '#view-track .track-auto-badge'
    ].forEach(sel => $$(sel).forEach(observeLoopTarget));
    const quote = $('.main-footer-quote');
    if (quote) observeFooterNode(quote);
  }

  function observeLoopTarget(el) {
    if (!el || loopTargets.has(el)) return;
    loopTargets.add(el);
    if (el.matches('.top-create, #view-home .home-primary-action, #wizard-next, #submit-request, #track-search-submit')) addClass(el, 'mxp-cta-shine');
    addClass(el, 'mxp-loop-target');
    if (loopObserver) loopObserver.observe(el);
  }

  let loopObserver = null;
  function installLoopObserver() {
    loopObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const el = entry.target;
        if (entry.isIntersecting && heavyAllowed() && el.isConnected) {
          loopVisible.add(el);
          addClass(el, 'mxp-loop-on');
          if (el.matches('#view-home .home-workflow-panel')) startFlowMotion();
        } else {
          loopVisible.delete(el);
          removeClass(el, 'mxp-loop-on');
        }
      });
    }, { threshold: .06, rootMargin: '40px 0px 40px 0px' });
    observers.push(loopObserver);
    loopTargets.forEach(el => { if (el.isConnected) loopObserver.observe(el); });
    if (workflowDot) observeLoopTarget(workflowDot);
  }

  function observeFooterNode(quote) {
    if (!quote || ioSeen.has(quote)) return;
    ioSeen.add(quote);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        addClass(entry.target, 'mxp-footer-entered');
        observer.unobserve(entry.target);
      }
    }), { threshold: .12 });
    observer.observe(quote);
    observers.push(observer);
  }
  function observeFooterQuote() { const quote = $('.main-footer-quote'); if (quote) observeFooterNode(quote); }

  let pendingMutations = [];
  function installMutationObservers() {
    const observer = new MutationObserver(mutations => {
      if (stopped) return;
      // Collect only the current mutation batch; a single rAF dispatches to the affected feature.
      // The app rerenders large tables/forms with innerHTML, so do not rescan the whole document.
      pendingMutations.push(...mutations);
      if (!batchRaf) batchRaf = scheduleRaf(() => {
        batchRaf = 0;
        const batch = pendingMutations;
        pendingMutations = [];
        scanMutationBatch(batch);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observers.push(observer);
  }

  function scanMutationBatch(mutations) {
    if (stopped || !mutations.length) return;
    let breadcrumb = false, summary = false, trackResults = false, progress = false;
    let searchButton = false, submitButton = false, toastRegion = false, navBadge = false;
    for (const mutation of mutations) {
      const node = mutation.target && mutation.target.nodeType === 1
        ? mutation.target
        : mutation.target?.parentElement;
      if (!node) continue;
      if (!breadcrumb && node.closest('#breadcrumb-current')) breadcrumb = true;
      if (!summary && (node.closest('.form-summary-rail') || node.matches('#summary-total'))) summary = true;
      if (!trackResults && node.closest('#track-search-results')) trackResults = true;
      if (!progress && (node.closest('#track-progress-body') || node.matches('#track-progress-request-id'))) progress = true;
      if (!searchButton && node.closest('#track-search-submit')) searchButton = true;
      if (!submitButton && node.closest('#submit-request')) submitButton = true;
      if (!toastRegion && node.closest('#toast-region')) toastRegion = true;
      if (!navBadge && node.closest('#nav-request-count')) navBadge = true;
      if (breadcrumb && summary && trackResults && progress && searchButton && submitButton && toastRegion && navBadge) break;
    }
    if (breadcrumb) scanBreadcrumb();
    if (summary) scanSummaryValues();
    if (trackResults || progress) {
      scanTrackValues();
      scanTrackStatuses();
      scanProgressTimeline();
    }
    if (searchButton || trackResults || progress) scanSearchBusy();
    if (submitButton) scanSubmitBusy();
    if (toastRegion) { scanToasts(); scanValidation(); }
    if (navBadge) scanNavBadge();
  }

  function installViewObserver() {
    const views = $$('.view');
    currentViewId = ($('.view.active') || {}).id || '';
    views.forEach(view => {
      if (view.classList.contains('active')) activateView(view, true);
    });
    const observer = new MutationObserver(() => {
      const active = $('.view.active');
      const nextId = active?.id || '';
      if (nextId && nextId !== currentViewId) {
        currentViewId = nextId;
        activateView(active, false);
      }
    });
    views.forEach(view => observer.observe(view, { attributes: true, attributeFilter: ['class'] }));
    observers.push(observer);
  }

  function activateView(view, initial) {
    if (!view) return;
    const relevant = ['view-home', 'view-create', 'view-track'].includes(view.id);
    if (!initial && relevant) {
      addClass(view, 'mxp-view-in');
      scheduleTimer(() => removeClass(view, 'mxp-view-in'), 680);
    }
    if (view.id === 'view-home') {
      installCardGlows();
      measureWorkflowPath();
      if (heroLayer && !heroLayer.classList.contains('mxp-hero-settle')) scheduleTimer(() => { if (view.classList.contains('active')) startHeroSettle(); }, 80);
    }
    if (view.id === 'view-create') {
      const stepper = $('#wizard-stepper');
      if (stepper) {
        addClass(stepper, 'mxp-stepper-entrance');
        scheduleTimer(() => removeClass(stepper, 'mxp-stepper-entrance'), 850);
      }
      const rail = $('.form-summary-rail', view);
      const tip = $('.summary-help', view);
      const activePanel = $('.wizard-panel.active', view);
      if (rail) { addClass(rail, 'mxp-summary-rail-in'); scheduleTimer(() => removeClass(rail, 'mxp-summary-rail-in'), 620); }
      if (tip) { addClass(tip, 'mxp-summary-tip-in'); scheduleTimer(() => removeClass(tip, 'mxp-summary-tip-in'), 700); }
      if (activePanel) { addClass(activePanel, 'mxp-form-panel-in'); scheduleTimer(() => removeClass(activePanel, 'mxp-form-panel-in'), 560); }
      refreshWizardLayout();
    }
    if (view.id === 'view-track') {
      const em = $('#view-track .track-hero-copy h1 em');
      if (em && !underlinedTrackHeadings.has(em)) {
        underlinedTrackHeadings.add(em);
        addClass(em, 'mxp-track-underline');
      }
      observeTrackLoopElements();
    }
    refreshNavPill();
    syncHeaderShadow();
    if (parallaxVisible) queueParallax();
  }

  function installWizardObserver() {
    const form = $('#po-form');
    if (!form) return;
    stepIndex = activeWizardIndex();
    refreshWizardLayout();
    const observer = new MutationObserver(() => {
      const active = activeWizardIndex();
      if (active !== null && active !== stepIndex) {
        const old = stepIndex;
        stepIndex = active;
        const panel = $(`.wizard-panel[data-wizard-panel="${active}"]`);
        if (panel) {
          removeClass(panel, 'mxp-step-forward');
          removeClass(panel, 'mxp-step-backward');
          removeClass(panel, 'mxp-form-panel-in');
          addClass(panel, active >= (old ?? active) ? 'mxp-step-forward' : 'mxp-step-backward');
          addClass(panel, 'mxp-form-panel-in');
          scheduleTimer(() => { removeClass(panel, 'mxp-step-forward'); removeClass(panel, 'mxp-step-backward'); removeClass(panel, 'mxp-form-panel-in'); }, 560);
        }
        syncWizardProgress();
        refreshWizardLayout();
      }
    });
    observer.observe(form, { attributes: true, attributeFilter: ['class'], subtree: true });
    observers.push(observer);
  }

  function activeWizardIndex() {
    const active = $('.wizard-panel.active');
    return active ? Number(active.dataset.wizardPanel) : null;
  }

  function refreshWizardLayout() {
    const stepper = $('#wizard-stepper');
    if (!stepper || !$('.mxp-wizard-progress-track', stepper)) return;
    const track = $('.mxp-wizard-progress-track', stepper);
    const nums = $$('#wizard-stepper .wizard-step-button .wizard-step-number');
    if (nums.length < 2) return;
    const r = stepper.getBoundingClientRect();
    const a = nums[0].getBoundingClientRect();
    const b = nums[nums.length - 1].getBoundingClientRect();
    track.style.left = `${a.left + a.width / 2 - r.left}px`;
    track.style.right = `${r.right - (b.left + b.width / 2)}px`;
    track.style.top = `${a.top + a.height / 2 - r.top}px`;
    track.style.transform = 'translateY(-50%)';
  }

  function observeTrackLoopElements() {
    ['#view-track .track-initial-icon', '#view-track .track-progress-empty-icon', '#view-track .track-auto-badge', '#view-track .track-progress-step.active', '#view-track .track-search-empty .track-empty-mark'].forEach(sel => $$(sel).forEach(observeLoopTarget));
  }

  function installEventDelegation() {
    listen(document, 'click', safe(event => {
      if (stopped || event.defaultPrevented) return;
      const target = event.target?.closest?.('button, a, [role="button"]');
      if (!target) return;
      if (target.matches('#save-draft')) {
        saveStarted = now();
        addClass(target, 'mxp-save-pending');
        scheduleTimer(() => {
          if (target.isConnected && target.classList.contains('mxp-save-pending')) removeClass(target, 'mxp-save-pending');
        }, 1800);
      }
      if (target.matches('#submit-request')) {
        submitSignalUntil = now() + 30000;
        addClass(target, 'mxp-submit-pending');
      }
      if (target.matches('#wizard-next')) observeLoopTarget(target);
      if (target.matches('#track-search-submit')) { /* app text change confirms an actual network search */ }
      if (target.matches('#track-clear-filters, #track-clear-only-filters')) stopSkeleton();
      if (target.matches('#add-line, .line-copy')) animateLineInsertAfterApp(target);
    }), true);

    listen(document, 'pointerover', safe(event => {
      const el = event.target?.closest?.('.top-create, #view-home .home-primary-action, #wizard-next, #submit-request, #track-search-submit');
      if (!el || !hasFinePointer || event.pointerType === 'touch' || event.relatedTarget && el.contains(event.relatedTarget) || isLite()) return;
      addClass(el, 'mxp-shine-hover');
    }), { passive: true });
    listen(document, 'pointerout', safe(event => {
      const el = event.target?.closest?.('.top-create, #view-home .home-primary-action, #wizard-next, #submit-request, #track-search-submit');
      if (!el || event.relatedTarget && el.contains(event.relatedTarget)) return;
      removeClass(el, 'mxp-shine-hover');
    }), { passive: true });

    listen(document, 'change', safe(event => {
      if (event.target?.matches?.('#track-auto-refresh-toggle')) {
        const badge = $('.track-auto-badge');
        if (badge) observeLoopTarget(badge);
      }
      if (event.target?.matches?.('#track-region-filter, #track-status-filter, #track-date-from, #track-date-to, #track-sort')) {
        // Mark the rerendered tbody before paint so filter refreshes stay still.
        scheduleRaf(() => { const tbody = $('#view-track .track-request-table tbody'); if (tbody) addClass(tbody, 'mxp-filter-stable'); });
      }
    }), { passive: true, capture: true });
  }

  function animateLineInsertAfterApp(button) {
    const before = new Set($$('#line-items-body > tr').map(row => row.dataset.lineId).filter(Boolean));
    scheduleRaf(() => {
      const rows = $$('#line-items-body > tr').filter(row => row.dataset.lineId && !before.has(row.dataset.lineId)).slice(0, 6);
      rows.forEach((row, index) => {
        addClass(row, 'mxp-line-in');
        if (!lineDelayStyles.has(row)) lineDelayStyles.set(row, { value: row.style.getPropertyValue('--mxp-row-delay'), priority: row.style.getPropertyPriority('--mxp-row-delay') });
        row.style.setProperty('--mxp-row-delay', `${index * 70}ms`);
        const old = lineTimers.get(row);
        if (old) { clearTimeout(old); timers.delete(old); lineTimers.delete(row); }
        const timer = scheduleTimer(() => {
          removeClass(row, 'mxp-line-in');
          const saved = lineDelayStyles.get(row);
          if (saved?.value) row.style.setProperty('--mxp-row-delay', saved.value, saved.priority); else row.style.removeProperty('--mxp-row-delay');
          lineDelayStyles.delete(row); lineTimers.delete(row);
        }, 600);
        lineTimers.set(row, timer);
      });
      // Removed rows stay removed immediately; no exit delay is introduced.
    });
  }

  function installScrollMotion() {
    listen(window, 'scroll', safe(() => {
      if (scrollRaf) return;
      scrollRaf = scheduleRaf(() => { scrollRaf = 0; syncHeaderShadow(); if (!isLite()) queueParallax(); });
    }), { passive: true });
    listen(window, 'resize', safe(() => {
      refreshNavPill(); refreshWizardLayout(); measureWorkflowPath(); queueParallax();
    }), { passive: true });
    listen(document, 'visibilitychange', safe(() => {
      if (document.hidden) addClass(root, 'mxp-tab-hidden'); else removeClass(root, 'mxp-tab-hidden');
      if (document.hidden) {
        stopParallax(); stopFlowMotion(); resetMagnetic();
      } else if (!isLite()) {
        if ($('#view-home')?.classList.contains('active')) queueParallax();
        if (workflowDot && loopVisible.has($('#view-home .home-workflow-panel'))) startFlowMotion();
      }
    }));
  }

  function installMagneticDrift() {
    const targets = '.top-create, #view-home .home-primary-action, #wizard-next, #submit-request, #track-search-submit';
    if (!hasFinePointer) return;
    $$(targets).forEach(el => addClass(el, 'mxp-magnetic-target'));
    listen(document, 'pointermove', safe(event => {
      if (event.pointerType !== 'mouse' || isLite() || document.hidden) { resetMagnetic(); return; }
      const target = event.target?.closest?.(targets);
      if (!target || !target.isConnected || target.disabled) { if (magneticTarget) resetMagnetic(); return; }
      if (target !== magneticTarget) {
        resetMagnetic();
        magneticTarget = target;
        magneticState.set(target, { inline: target.style.transform, priority: target.style.getPropertyPriority('transform'), base: getComputedStyle(target).transform });
        addClass(target, 'mxp-magnetic-moving');
      }
      magneticPointer = { x: event.clientX, y: event.clientY };
      if (!magneticRaf) magneticRaf = scheduleRaf(updateMagnetic);
    }), { passive: true });
    listen(document, 'pointerleave', safe(() => resetMagnetic()), { passive: true });
    listen(window, 'blur', safe(resetMagnetic));
  }

  function updateMagnetic() {
    magneticRaf = 0;
    const el = magneticTarget;
    if (!el || !el.isConnected || isLite() || document.hidden) { resetMagnetic(); return; }
    const r = el.getBoundingClientRect();
    const dx = (magneticPointer.x - (r.left + r.width / 2)) / Math.max(r.width / 2, 1);
    const dy = (magneticPointer.y - (r.top + r.height / 2)) / Math.max(r.height / 2, 1);
    const x = Math.max(-6, Math.min(6, dx * 6));
    const y = Math.max(-4, Math.min(4, dy * 4));
    const saved = magneticState.get(el);
    if (!saved) return;
    const base = saved.base && saved.base !== 'none' ? ` ${saved.base}` : '';
    el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)${base}`;
  }

  function resetMagnetic() {
    if (magneticRaf) { cancelAnimationFrame(magneticRaf); rafs.delete(magneticRaf); magneticRaf = 0; }
    const el = magneticTarget;
    if (!el) return;
    const saved = magneticState.get(el);
    if (saved) {
      if (saved.inline) el.style.setProperty('transform', saved.inline, saved.priority);
      else el.style.removeProperty('transform');
    }
    removeClass(el, 'mxp-magnetic-moving');
    magneticTarget = null;
  }

  function queueParallax() {
    if (parallaxRaf || !heavyAllowed() || window.matchMedia('(max-width: 820px)').matches) return;
    parallaxRaf = scheduleRaf(updateParallax);
  }
  function updateParallax() {
    parallaxRaf = 0;
    const copy = $('#view-home .home-welcome-copy');
    const side = $('#view-home .home-welcome-side');
    const home = $('#view-home');
    if (!copy || !side || !home?.classList.contains('active') || isLite() || document.hidden || window.matchMedia('(max-width: 820px)').matches) {
      stopParallax(); return;
    }
    const scroll = Math.max(0, window.scrollY);
    const y1 = -Math.min(24, scroll * .055);
    const y2 = -Math.min(16, scroll * .036);
    if (!parallaxState.has(copy)) parallaxState.set(copy, { inline: copy.style.transform, priority: copy.style.getPropertyPriority('transform') });
    if (!parallaxState.has(side)) parallaxState.set(side, { inline: side.style.transform, priority: side.style.getPropertyPriority('transform') });
    copy.style.transform = `translate3d(0,${y1.toFixed(2)}px,0)`;
    side.style.transform = `translate3d(0,${y2.toFixed(2)}px,0)`;
    parallaxVisible = true;
  }
  function stopParallax() {
    if (parallaxRaf) { cancelAnimationFrame(parallaxRaf); rafs.delete(parallaxRaf); parallaxRaf = 0; }
    const copy = $('#view-home .home-welcome-copy');
    const side = $('#view-home .home-welcome-side');
    [copy, side].forEach(el => {
      if (!el) return;
      const saved = parallaxState.get(el);
      if (saved) {
        if (saved.inline) el.style.setProperty('transform', saved.inline, saved.priority);
        else el.style.removeProperty('transform');
        parallaxState.delete(el);
      }
    });
    parallaxVisible = false;
  }

  // The workflow travel is a compositor-friendly CSS transform animation; JS only measures
  // endpoints when the section resizes or enters view, never writes a transform every frame.
  function startFlowMotion() {
    if (!heavyAllowed() || !workflowDot?.isConnected) return;
    measureWorkflowPath();
  }
  function stopFlowMotion() {
    if (flowRaf) { cancelAnimationFrame(flowRaf); rafs.delete(flowRaf); flowRaf = 0; }
  }

  function installViewTransitionDelegation() {
    listen(document, 'click', safe(event => {
      if (viewTransitionDispatch || reducedQuery.matches || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target?.closest?.('#sidebar [data-view], #sidebar [data-action="create"], #view-home [data-view="track"], #view-home [data-action="create"], .topbar [data-action="create"]');
      if (!target || !target.isConnected || target.disabled) return;
      const requestedView = target.dataset.view || (target.dataset.action === 'create' ? 'create' : '');
      if (!['home', 'create', 'track'].includes(requestedView) || currentViewId === `view-${requestedView}`) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const dispatchOriginalClick = () => {
        viewTransitionDispatch = true;
        try { target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
        finally { viewTransitionDispatch = false; }
      };
      if (typeof document.startViewTransition === 'function') {
        addClass(root, 'mxp-native-vt');
        scheduleTimer(() => removeClass(root, 'mxp-native-vt'), 720);
        try {
          const transition = document.startViewTransition(dispatchOriginalClick);
          transition.finished?.catch?.(safe(() => { removeClass(root, 'mxp-native-vt'); }));
          return;
        } catch (_) {
          removeClass(root, 'mxp-native-vt');
        }
      }
      // Compatibility fallback: let the visible outgoing view slide/fade for 300ms,
      // then replay the original navigation click and animate the incoming view for 300ms.
      const outgoing = $('.view.active');
      addClass(root, 'mxp-fallback-vt');
      if (outgoing && ['view-home', 'view-create', 'view-track'].includes(outgoing.id)) addClass(outgoing, 'mxp-view-out');
      scheduleTimer(() => {
        if (outgoing) removeClass(outgoing, 'mxp-view-out');
        dispatchOriginalClick();
        scheduleTimer(() => removeClass(root, 'mxp-fallback-vt'), 720);
      }, outgoing ? 300 : 0);
    }), true);
  }

  function installSafetySignals() {
    const htmlObserver = new MutationObserver(safe(() => {
      if (isLite()) {
        stopParallax(); stopFlowMotion(); resetMagnetic();
        loopTargets.forEach(el => removeClass(el, 'mxp-loop-on'));
        if (navPill) removeClass(navPill, 'mxp-visible');
      } else {
        removeClass(root, 'mxp-local-lite');
        loopTargets.forEach(el => {
          if (loopVisible.has(el)) addClass(el, 'mxp-loop-on');
        });
        refreshNavPill();
      }
    }));
    htmlObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    observers.push(htmlObserver);

    if (window.addEventListener) listen(window, 'storage', safe(event => {
      if (event.key === 'mx-effects' && event.newValue === 'lite') {
        addClass(root, 'mxp-local-lite'); stopParallax(); stopFlowMotion(); resetMagnetic();
        loopTargets.forEach(el => removeClass(el, 'mxp-loop-on'));
      }
    }));
    if (reducedQuery.addEventListener) listen(reducedQuery, 'change', safe(event => { if (event.matches) failSafe(); }));
  }

  function scanCurrentState() {
    if (stopped) return;
    installCardGlows();
    observeTrackLoopElements();
    observeFooterQuote();
    refreshNavPill();
    syncHeaderShadow();
    syncWizardProgress();
    refreshWizardLayout();
    scanBreadcrumb();
    scanSummaryValues();
    scanTrackValues();
    scanTrackStatuses();
    scanSearchBusy();
    scanSubmitBusy();
    scanToasts();
    scanValidation();
    scanProgressTimeline();
    scanNavBadge();
    scanHomeEntrance();
    if (flowMotion.start && flowMotion.end && loopVisible.has($('#view-home .home-workflow-panel'))) startFlowMotion();
  }

  function scanBreadcrumb() {
    const node = $('#breadcrumb-current');
    if (!node) return;
    const text = node.textContent;
    if (breadcrumbText === '') { breadcrumbText = text; return; }
    if (text !== breadcrumbText) {
      breadcrumbText = text;
      removeClass(node, 'mxp-breadcrumb-change');
      scheduleRaf(() => addClass(node, 'mxp-breadcrumb-change'));
      scheduleTimer(() => removeClass(node, 'mxp-breadcrumb-change'), 420);
    }
  }

  function scanSummaryValues() {
    const rail = $('.form-summary-rail');
    if (!rail) return;
    $$('.summary-row strong, #summary-total', rail).forEach(value => {
      const text = value.textContent.trim();
      const before = priorSummary.get(value);
      if (before === undefined) { priorSummary.set(value, text); if (value.closest('.summary-row')) addClass(value.closest('.summary-row'), 'mxp-summary-row'); return; }
      if (before === text) return;
      priorSummary.set(value, text);
      const row = value.closest('.summary-row, .summary-total');
      if (!row) return;
      addClass(row, 'mxp-summary-row');
      const overlay = ownNode('span', 'mxp-summary-flash-overlay', row);
      scheduleTimer(() => overlay.remove(), 1050);
      removeClass(value, 'mxp-summary-value-in');
      addClass(value, 'mxp-summary-value-in');
      scheduleTimer(() => removeClass(value, 'mxp-summary-value-in'), 380);
    });
  }

  function scanTrackValues() {
    const count = $('#track-result-count');
    if (count) {
      const text = count.textContent.trim();
      if (lastResultCount === '') lastResultCount = text;
      else if (text !== lastResultCount) {
        lastResultCount = text;
        removeClass(count, 'mxp-count-pop'); addClass(count, 'mxp-count-pop');
        scheduleTimer(() => removeClass(count, 'mxp-count-pop'), 300);
      }
    }
    const body = $('#track-progress-body');
    const id = $('#track-progress-request-id')?.textContent.trim() || '';
    if (body && id && id !== lastProgressId) {
      lastProgressId = id;
      removeClass(body, 'mxp-progress-swap'); addClass(body, 'mxp-progress-swap');
      const timeline = $('.track-progress-timeline', body);
      if (timeline) addClass(timeline, 'mxp-timeline-draw');
      const outcome = $('.track-progress-outcome.created', body);
      if (outcome) { addClass(outcome, 'mxp-created-glow'); scheduleTimer(() => removeClass(outcome, 'mxp-created-glow'), 1200); }
      scheduleTimer(() => removeClass(body, 'mxp-progress-swap'), 600);
    }
    if (!id) lastProgressId = '';
  }


  function scanTrackStatuses() {
    const rows = $$('#view-track tr[data-track-row]');
    const present = new Set();
    rows.slice(0, 50).forEach(row => {
      const id = row.getAttribute('data-track-row');
      const pill = $('.status-pill, .status-badge, .status-chip', row);
      if (!id || !pill) return;
      present.add(id);
      const value = pill.textContent.trim();
      const previous = priorTrackStatuses.get(id);
      if (previous !== undefined && previous !== value) {
        removeClass(pill, 'mxp-status-flash'); addClass(pill, 'mxp-status-flash');
        scheduleTimer(() => removeClass(pill, 'mxp-status-flash'), 520);
      }
      priorTrackStatuses.set(id, value);
    });
    priorTrackStatuses.forEach((value, id) => { if (!present.has(id)) priorTrackStatuses.delete(id); });
  }

  function scanSearchBusy() {
    const button = $('#track-search-submit');
    if (!button) return;
    const searching = /searching/i.test(button.textContent);
    if (searching && !button.classList.contains('mxp-search-busy')) {
      searchBusyStarted = now();
      addClass(button, 'mxp-search-busy');
      startSkeleton();
    } else if (!searching && button.classList.contains('mxp-search-busy')) {
      removeClass(button, 'mxp-search-busy');
      stopSkeleton();
    }
    const results = $('#track-search-results');
    if (results && skeletonLayer && (results.querySelector('table') || results.querySelector('.track-search-empty') || results.querySelector('.track-search-results-head'))) stopSkeleton();
  }


  function scanSubmitBusy() {
    const button = $('#submit-request');
    if (!button || !button.classList.contains('mxp-submit-pending')) return;
    if (!/submitting/i.test(button.textContent)) removeClass(button, 'mxp-submit-pending');
  }

  function startSkeleton() {
    const host = $('#track-search-results');
    const initial = $('#track-initial-state');
    if (!host || host.querySelector('table, .track-search-empty, .track-search-results-head') || skeletonLayer) return;
    // Overlay the app's already-rendered empty state; do not change its size or reveal an
    // otherwise hidden results container. Real result DOM is never covered by this layer.
    if (!initial || initial.classList.contains('hidden')) return;
    skeletonMount = initial;
    addClass(initial, 'mxp-skeleton-host');
    skeletonLayer = ownNode('div', 'mxp-skeleton-layer', initial);
    for (let i = 0; i < 3; i += 1) ownNode('div', 'mxp-skeleton-row', skeletonLayer);
    observeLoopTarget(skeletonLayer);
    if (skeletonTimer) { clearTimeout(skeletonTimer); timers.delete(skeletonTimer); }
    const timeoutId = window.setTimeout(() => { timers.delete(timeoutId); skeletonTimer = 0; stopSkeleton(); }, 4000);
    skeletonTimer = timeoutId;
    timers.add(timeoutId);
  }
  function stopSkeleton() {
    if (skeletonTimer) { clearTimeout(skeletonTimer); timers.delete(skeletonTimer); skeletonTimer = 0; }
    if (skeletonLayer) { loopTargets.delete(skeletonLayer); try { loopObserver?.unobserve(skeletonLayer); } catch (_) {} skeletonLayer.remove(); ownedNodes.delete(skeletonLayer); skeletonLayer = null; }
    $$('.mxp-skeleton-row').forEach(row => { row.remove(); ownedNodes.delete(row); });
    if (skeletonMount) { removeClass(skeletonMount, 'mxp-skeleton-host'); skeletonMount = null; }
  }

  function scanToasts() {
    const region = $('#toast-region');
    if (!region) return;
    $$('.toast', region).forEach(toast => {
      if (seenToasts.has(toast)) return;
      const inScope = ['view-home', 'view-create', 'view-track'].some(id => $(`#${id}`)?.classList.contains('active'));
      if (!inScope && now() >= submitSignalUntil) return;
      seenToasts.add(toast);
      addClass(toast, 'mxp-toast-timer');
      const title = $('.toast-symbol', toast);
      const text = $('.toast strong', toast)?.textContent.trim() || '';
      if (text && /draft saved/i.test(text)) handleSaveOutcome(true);
      if (text && /could not save draft/i.test(text)) handleSaveOutcome(false);
      if (/request submitted/i.test(text) && now() < submitSignalUntil) drawSubmitCheck(title);
      scheduleTimer(() => removeClass(toast, 'mxp-toast-timer'), 4500);
    });
  }

  function handleSaveOutcome(success) {
    const button = $('#save-draft');
    if (!button) return;
    pendingSaveOutcome = success ? 'success' : 'error';
    const elapsed = now() - saveStarted;
    const delay = Math.max(0, 170 - elapsed);
    scheduleTimer(() => {
      removeClass(button, 'mxp-save-pending');
      if (success) {
        addClass(button, 'mxp-save-success');
        scheduleTimer(() => removeClass(button, 'mxp-save-success'), 460);
      }
      pendingSaveOutcome = '';
    }, delay);
  }

  function drawSubmitCheck(symbol) {
    if (!symbol || symbol.querySelector('.mxp-success-check')) return;
    addClass(symbol, 'mxp-success-mark');
    ownNode('span', 'mxp-success-ring', symbol);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('mxp-success-check');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-mxp-owned', 'true');
    svg.setAttribute('tabindex', '-1');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('role', 'presentation');
    svg.style.pointerEvents = 'none';
    if ('inert' in svg) svg.inert = true;
    symbol.appendChild(svg);
    ownedNodes.add(svg);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M4.5 12.5l4.5 4.2L19.5 6.8');
    path.setAttribute('aria-hidden', 'true'); path.setAttribute('tabindex', '-1');
    path.style.pointerEvents = 'none'; if ('inert' in path) path.inert = true;
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#14965B'); path.setAttribute('stroke-width', '3.2'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('aria-hidden', 'true'); path.style.pointerEvents = 'none';
    svg.appendChild(path);
    scheduleTimer(() => { svg.remove(); ownedNodes.delete(svg); symbol.querySelectorAll('.mxp-success-ring').forEach(ring => { ring.remove(); ownedNodes.delete(ring); }); removeClass(symbol, 'mxp-success-mark'); }, 1050);
  }

  function scanValidation() {
    const region = $('#toast-region');
    const latest = region ? region.lastElementChild : null;
    if (!latest || validationSeen.has(latest)) return;
    const title = $('.toast strong', latest)?.textContent || '';
    if (!/need attention|validation|resolve the following/i.test(title)) return;
    validationSeen.add(latest);
    const focused = document.activeElement;
    const field = focused?.closest?.('#view-create .field');
    if (!field) return;
    addClass(field, 'mxp-validation-shake');
    const indicator = ownNode('span', 'mxp-validation-indicator', field);
    // The overlay is absolute and doesn't cover or replace the input hit area.
    scheduleTimer(() => { removeClass(field, 'mxp-validation-shake'); indicator.remove(); ownedNodes.delete(indicator); }, 900);
  }

  function scanProgressTimeline() {
    const body = $('#track-progress-body');
    if (!body) return;
    const timeline = $('.track-progress-timeline', body);
    if (timeline && body.classList.contains('mxp-progress-swap')) addClass(timeline, 'mxp-timeline-draw');
    $$('.track-progress-empty-icon, .track-initial-icon, .track-auto-badge', $('#view-track') || document).forEach(observeLoopTarget);
  }

  function scanNavBadge() {
    const badge = $('#nav-request-count');
    if (!badge) return;
    const text = badge.textContent.trim();
    if (lastRequestCount === '') lastRequestCount = text;
    else if (text !== lastRequestCount) {
      lastRequestCount = text;
      removeClass(badge, 'mxp-badge-pop'); addClass(badge, 'mxp-badge-pop');
      scheduleTimer(() => removeClass(badge, 'mxp-badge-pop'), 450);
    }
  }

  function scanHomeEntrance() {
    const footerQuote = $('.main-footer-quote');
    if (footerQuote) observeFooterNode(footerQuote);
  }

  // Keep the existing engine's full/lite contract: the class comes from motion-effects.js.
  // We only stop our own continuous work when it changes to lite; we never replace its governor.
})();
