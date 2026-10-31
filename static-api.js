/*
 * PO Request Portal - GitHub Pages edition.
 * The original Node server logic runs inside the browser (portal-engine.js). Its data files live in a private
 * GitHub "data" repository which is read/written through the GitHub API with the team access key.
 */
(function () {
  'use strict';
  window.PO_STATIC = true;
  const FILES = ['master-data.json', 'company-codes.json', 'currencies.json', 'portal-config.json', 'requests.json', 'reviewer-key.txt'];
  const KEY_STORAGE = 'po_team_key';
  const cfg = Object.assign({ dataRepo: '', branch: 'main', dataPath: 'data' }, window.PO_CONFIG || {});
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hashParams.get('repo')) cfg.dataRepo = hashParams.get('repo');
  if (hashParams.get('key')) {
    try { localStorage.setItem(KEY_STORAGE, hashParams.get('key').trim()); } catch (e) { /* storage blocked */ }
    hashParams.delete('key'); hashParams.delete('repo');
    const rest = hashParams.toString();
    history.replaceState(null, '', location.pathname + location.search + (rest ? '#' + rest : ''));
  }
  if (!cfg.dataRepo && /\.github\.io$/i.test(location.hostname)) cfg.dataRepo = `${location.hostname.split('.')[0]}/po-portal-data`;
  const DIR = cfg.dataPath.replace(/^\/+|\/+$/g, '');
  const API = 'https://api.github.com';
  const realFetch = window.fetch.bind(window);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const getKey = () => { try { return localStorage.getItem(KEY_STORAGE) || ''; } catch (e) { return ''; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------------------------------------------------------------- GitHub helpers
  class ConflictError extends Error {}
  class AuthError extends Error {}
  async function gh(method, path, { body, raw, etag } = {}) {
    const headers = { Authorization: `Bearer ${getKey()}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (etag) headers['If-None-Match'] = etag;
    if (body) headers['Content-Type'] = 'application/json';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await realFetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
      if (res.status === 401) throw new AuthError('The team access key is invalid or expired.');
      if ([502, 503, 504].includes(res.status) && attempt < 2) { await sleep(800 * (attempt + 1)); continue; }
      return res;
    }
    throw new Error('GitHub is not responding.');
  }
  const contentsPath = name => `/repos/${cfg.dataRepo}/contents/${[DIR, name].filter(Boolean).map(encodeURIComponent).join('/')}`;
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  // ---------------------------------------------------------------- team key dialog
  let keyPrompt = null;
  function askForKey(message) {
    if (keyPrompt) return keyPrompt;
    keyPrompt = new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,20,25,.62);display:flex;align-items:center;justify-content:center;padding:18px;font:15px system-ui,Segoe UI,Arial,sans-serif';
      wrap.innerHTML = `<div style="background:#fff;max-width:480px;width:100%;border-radius:18px;padding:26px 26px 22px;box-shadow:0 24px 70px rgba(0,0,0,.35);color:#1f3a42">
        <h2 style="margin:0 0 6px;font-size:21px">Connect to the team data store</h2>
        <p style="margin:0 0 14px;color:#5b747c;line-height:1.45">Paste the <b>Team Access Key</b> shared by your PO Portal admin. You only need to do this once on this browser.</p>
        <input id="po-key-input" type="password" autocomplete="off" placeholder="github_pat_…" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #c9d8d8;border-radius:10px;font:inherit">
        <div id="po-key-msg" style="min-height:20px;margin:8px 0 0;color:#b3261e;font-size:13.5px">${message || ''}</div>
        <div style="display:flex;gap:10px;margin-top:12px"><button id="po-key-go" style="flex:1;padding:11px 14px;border:0;border-radius:10px;background:#c8102e;color:#fff;font:600 15px system-ui;cursor:pointer">Connect</button></div>
      </div>`;
      document.body.appendChild(wrap);
      const input = wrap.querySelector('#po-key-input'); const msg = wrap.querySelector('#po-key-msg'); const go = wrap.querySelector('#po-key-go');
      const submit = async () => {
        const value = input.value.trim(); if (!value) { msg.textContent = 'Paste the key first.'; return; }
        go.disabled = true; go.textContent = 'Checking…'; msg.textContent = '';
        try {
          localStorage.setItem(KEY_STORAGE, value);
          const res = await gh('GET', `/repos/${cfg.dataRepo}`);
          if (res.status === 404) throw new Error(`Data repository "${cfg.dataRepo}" was not found with this key.`);
          if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
          wrap.remove(); keyPrompt = null; resolve();
        } catch (error) {
          localStorage.removeItem(KEY_STORAGE); msg.textContent = error.message; go.disabled = false; go.textContent = 'Connect';
        }
      };
      go.addEventListener('click', submit); input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }); setTimeout(() => input.focus(), 50);
    });
    return keyPrompt;
  }
  async function ensureKey() { if (!getKey()) await askForKey(); }

  // ---------------------------------------------------------------- repo <-> virtual file system
  const cache = {}; let listEtag = ''; let lastListAt = 0; let engineLoaded = null; let engineStarted = false;
  const vpath = name => `/app/data/${name}`;
  function loadEngineScript() {
    if (!engineLoaded) engineLoaded = new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = 'portal-engine.js?v=2.6.35'; s.onload = resolve; s.onerror = () => reject(new Error('Could not load portal-engine.js.')); document.head.appendChild(s);
    });
    return engineLoaded;
  }
  async function seedRepo() {
    for (const name of FILES) {
      const res = await realFetch(`seed/${name}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Seed file seed/${name} is missing from the site.`);
      const text = await res.text();
      const put = await gh('PUT', contentsPath(name), { body: { message: `data: seed ${name}`, content: toBase64(text), branch: cfg.branch } });
      if (!put.ok) throw new Error(`Could not create ${name} in the data repository (${put.status}). The key needs Contents: Read and write.`);
      const result = await put.json(); cache[name] = { sha: result.content.sha, text }; window.PortalEngine.vfs.load(vpath(name), text);
    }
    listEtag = '';
  }
  async function refresh(maxAge) {
    if (maxAge && Date.now() - lastListAt < maxAge) return;
    const res = await gh('GET', `/repos/${cfg.dataRepo}/contents/${DIR ? DIR.split('/').map(encodeURIComponent).join('/') : ''}?ref=${encodeURIComponent(cfg.branch)}`, { etag: listEtag });
    lastListAt = Date.now();
    if (res.status === 304) return;
    if (res.status === 404) { await seedRepo(); return; }
    if (res.status === 403) throw new Error('GitHub rate limit or permission problem (403). Wait a minute and try again.');
    if (!res.ok) throw new Error(`GitHub answered ${res.status} while reading the data repository.`);
    const listing = await res.json(); const shas = {};
    for (const item of listing) if (item.type === 'file') shas[item.name] = item.sha;
    const missing = FILES.filter(name => !shas[name] && !cache[name]);
    if (missing.length === FILES.length) { await seedRepo(); return; }
    for (const name of FILES) {
      if (!shas[name]) { if (!cache[name]) { const r = await realFetch(`seed/${name}`, { cache: 'no-store' }); if (r.ok) window.PortalEngine.vfs.load(vpath(name), await r.text()); } continue; }
      if (cache[name] && cache[name].sha === shas[name]) continue;
      const raw = await gh('GET', `${contentsPath(name)}?ref=${encodeURIComponent(cfg.branch)}`, { raw: true });
      if (!raw.ok) throw new Error(`Could not read ${name} (${raw.status}).`);
      const text = await raw.text(); cache[name] = { sha: shas[name], text }; window.PortalEngine.vfs.load(vpath(name), text);
    }
    listEtag = res.headers.get('ETag') || '';
  }
  async function pushDirty(paths) {
    for (const path of paths) {
      const name = path.split('/').pop(); if (!FILES.includes(name)) continue;
      const text = window.PortalEngine.vfs.get(path); if (text === undefined) continue;
      if (cache[name] && cache[name].text === text) continue;
      const res = await gh('PUT', contentsPath(name), { body: { message: `data: update ${name}`, content: toBase64(text), branch: cfg.branch, ...(cache[name] ? { sha: cache[name].sha } : {}) } });
      if (res.status === 409 || res.status === 422) throw new ConflictError('conflict');
      if (!res.ok) throw new Error(`Could not save ${name} to GitHub (${res.status}).`);
      const result = await res.json(); cache[name] = { sha: result.content.sha, text }; listEtag = '';
    }
  }

  // ---------------------------------------------------------------- API calls (serialised)
  let chain = Promise.resolve();
  const enqueue = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
  function normalizeHeaders(h) {
    const out = {}; if (!h) return out;
    if (typeof Headers !== 'undefined' && h instanceof Headers) { h.forEach((v, k) => { out[k] = v; }); return out; }
    if (Array.isArray(h)) { h.forEach(([k, v]) => { out[k] = v; }); return out; }
    Object.keys(h).forEach(k => { out[k] = h[k]; }); return out;
  }
  async function callApi(url, init) {
    const method = String((init && init.method) || 'GET').toUpperCase();
    const body = init && init.body ? (typeof init.body === 'string' ? init.body : String(init.body)) : '';
    const headers = normalizeHeaders(init && init.headers);
    const path = url.replace(location.origin, '');
    return enqueue(async () => {
      try {
        await ensureKey(); await loadEngineScript();
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            await refresh(attempt === 0 ? (method === 'GET' ? 3000 : 1000) : 0);
            if (!engineStarted) { await window.PortalEngine.start(); engineStarted = true; await pushDirty(window.PortalEngine.vfs.takeDirty()); }
            window.PortalEngine.vfs.takeDirty();
            const result = await window.PortalEngine.handle({ method, url: path, headers, body });
            const dirty = window.PortalEngine.vfs.takeDirty();
            if (dirty.length) await pushDirty(dirty);
            const outHeaders = {}; Object.keys(result.headers || {}).forEach(k => { if (k.toLowerCase() !== 'content-length') outHeaders[k] = result.headers[k]; });
            return new Response(result.body, { status: result.status, headers: outHeaders });
          } catch (error) {
            if (error instanceof ConflictError && attempt < 3) { listEtag = ''; lastListAt = 0; Object.keys(cache).forEach(n => { cache[n].sha = ''; }); continue; }
            throw error;
          }
        }
        return json(409, { error: 'Someone else saved at the same moment. Please try again.' });
      } catch (error) {
        if (error instanceof AuthError) { localStorage.removeItem(KEY_STORAGE); askForKey('The team access key was rejected. Paste a new key.'); return json(401, { error: error.message }); }
        const offline = error instanceof TypeError;
        return json(offline ? 503 : 502, { error: offline ? 'Cannot reach GitHub. Check your internet connection and try again.' : error.message });
      }
    });
  }
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (/^\/api\//.test(url) || url.startsWith(location.origin + '/api/')) return callApi(url, init || (typeof input !== 'string' ? { method: input.method } : undefined));
    return realFetch(input, init);
  };
})();
