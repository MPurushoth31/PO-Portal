'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const REVIEWER_STORAGE_KEY = 'tccc-po-reviewer-key';
const state = {
  master: null,
  requests: [],
  supportingFiles: [],
  lastSubmittedRequest: null,
  lastSubmittedFiles: [],
  emailPreviewRequest: null,
  emailPreviewFiles: [],
  emailPreviewReturnView: 'track',
  emailPreviewTrackingCode: '',
  currentView: 'home',
  masterTab: 'gl',
  editingId: '',
  localDraftId: '',
  currentDetailId: '',
  currentDetailRecord: null,
  detailTab: 'overview',
  detailReturnView: 'track',
  detailSource: 'track',
  masterEditIndex: null,
  masterEditOriginal: null,
  reviewerKey: '',
  reviewerMode: false,
  editingMode: '',
  lineItems: [],
  requestSearch: '',
  requestStatus: 'All statuses',
  requestRegion: '',
  masterSearch: '',
  requestPage: 1,
  requestPageSize: 20,
  requestVendorNumber: '',
  requestorFilter: '',
  requestPoFilter: '',
  requestOroFilter: '',
  reviewerSelectedId: '',
  reviewerPanelTab: 'overview',
  reviewerSelectedRows: [],
  requestDateFrom: '',
  requestDateTo: '',
  requestSort: 'updated-desc',
  currentWizardStep: 0,
  trackSearchResults: [],
  trackSearchTotal: 0,
  trackSearchCriteria: null,
  trackSearchRunId: 0,
  trackSearchAutoNote: '',
  trackProgressRequestId: '',
  reportFilters: null,
  reportPage: 1,
  reportPageSize: 10,
  reportSort: 'requestDate-desc',
  reportDatePreset: 'ytd',
};
const STATUS_META = {
  'Draft': { cls: 'status-draft', color: '#8a989e' },
  'Submitted': { cls: 'status-submitted', color: '#d99a29' },
  'Under Review': { cls: 'status-review', color: '#4b8bc8' },
  'Clarification Required': { cls: 'status-clarification', color: '#ce8348' },
  'Request Submitted on PP+': { cls: 'status-ppplus', color: '#22a16e' },
  'Rejected': { cls: 'status-rejected', color: '#d45a54' },
  'PO Created': { cls: 'status-created', color: '#168a84' },
};
const STATUS_LIST = Object.keys(STATUS_META);
const INITIAL_SUBMISSION_LABEL = 'PO Request Submitted to PO Team for Creation';
const INITIAL_SUBMISSION_DISPLAY_LABEL = 'Submitted to PO Team';
const INITIAL_SUBMISSION_NOTE = 'PO Request submitted to PO Team for creation.';
const PLANT_UNKNOWN_VALUE = "Don't know";
const WBS_SUFFIX_PATTERN = /(?:^|-)(?:90\d{3}|00\d{3})$/i;
function validWbsSuffix(value) { return WBS_SUFFIX_PATTERN.test(clean(value)); }
const PROJECT_GL_RULES = {
  projectOpex: { regex: /^90\d{3}$/, type: 'PROJECT OPEX' },
  projectCapex: { regex: /^00\d{3}$/, type: 'PROJECT CAPEX' },
};
const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attrEscape = htmlEscape;
const clean = value => String(value ?? '').trim();
const selected = (a, b) => String(a ?? '') === String(b ?? '') ? 'selected' : '';
const checked = value => value ? 'checked' : '';

function localDateInput(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function dateTimeLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function currencyMasterRow(currency = 'USD') {
  const code = clean(currency).toUpperCase();
  return (state.master?.currencies || []).find(row => clean(row.code).toUpperCase() === code) || null;
}
function money(value, currency = 'USD') {
  const amount = Number(value || 0);
  const code = /^[A-Z]{3}$/.test(clean(currency).toUpperCase()) ? clean(currency).toUpperCase() : 'USD';
  const row = currencyMasterRow(code);
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(amount);
    return parts.map(part => part.type === 'currency' && row?.symbol ? row.symbol : part.value).join('');
  } catch {
    const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${row?.symbol || code}${formatted}`;
  }
}
function compactStatusDisplayLabel(label) {
  const value = clean(label);
  if ([INITIAL_SUBMISSION_LABEL, INITIAL_SUBMISSION_DISPLAY_LABEL].some(item => value.toLowerCase() === item.toLowerCase())) return INITIAL_SUBMISSION_DISPLAY_LABEL;
  return value;
}
function isInitialPortalSubmission(request) {
  if (!request || String(request.status || '') !== 'Submitted') return false;
  if ([INITIAL_SUBMISSION_LABEL, INITIAL_SUBMISSION_DISPLAY_LABEL].some(item => clean(request.statusLabel).toLowerCase() === item.toLowerCase())) return true;
  const history = Array.isArray(request.approvalHistory) ? request.approvalHistory : (Array.isArray(request.history) ? request.history : []);
  const latestStatusChange = history.slice().reverse().find(event => !event?.from || String(event.from) !== String(event.status || ''));
  return Boolean(latestStatusChange && String(latestStatusChange.status || '') === 'Submitted' && String(latestStatusChange.note || '').trim() === INITIAL_SUBMISSION_NOTE);
}
function statusDisplayLabel(status, request = null) {
  if (isInitialPortalSubmission(request) && String(status || request.status) === 'Submitted') return INITIAL_SUBMISSION_DISPLAY_LABEL;
  if ([INITIAL_SUBMISSION_LABEL, INITIAL_SUBMISSION_DISPLAY_LABEL].some(item => clean(status).toLowerCase() === item.toLowerCase())) return INITIAL_SUBMISSION_DISPLAY_LABEL;
  if (request?.statusLabel) return compactStatusDisplayLabel(request.statusLabel);
  if (status === 'Submitted' || status === 'Under Review') return 'Pending for Approval';
  if (status === 'Approved' || status === 'Request Submitted on PP+') return 'Submitted on PP+';
  return status || 'Draft';
}
function statusDisplayLabelForEvent(event) {
  if (event?.statusLabel) return compactStatusDisplayLabel(event.statusLabel);
  if (String(event?.status || '') === 'Submitted' && clean(event?.note) === INITIAL_SUBMISSION_NOTE) return INITIAL_SUBMISSION_DISPLAY_LABEL;
  return statusDisplayLabel(event?.status || 'Updated');
}
function statusPill(status, label = '') {
  const meta = STATUS_META[status] || STATUS_META.Draft;
  return `<span class="status-pill ${meta.cls}">${htmlEscape(label || statusDisplayLabel(status))}</span>`;
}
function requestTotal(request) {
  if (typeof request.poValue === 'number') return request.poValue;
  return (request.lineItems || []).reduce((sum, line) => sum + Number(line.total || Number(line.quantity || 0) * Number(line.unitPrice || 0)), 0);
}
function manualLineDescription(line = {}) {
  // Descriptions are always entered by the requester; never infer or suppress them from GL master data.
  return clean(line.description);
}
function notify(title, message = '', kind = 'success') {
  const region = $('#toast-region');
  const toast = document.createElement('div');
  toast.className = `toast ${kind === 'error' ? 'error' : ''}`;
  toast.innerHTML = `<span class="toast-symbol">${kind === 'error' ? '!' : '✓'}</span><div><strong>${htmlEscape(title)}</strong>${message ? `<p>${htmlEscape(message)}</p>` : ''}</div>`;
  region.appendChild(toast);
  window.setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-5px)'; window.setTimeout(() => toast.remove(), 220); }, 4400);
}
async function api(path, options = {}) {
  const authHeaders = state.reviewerKey ? { 'X-Reviewer-Key': state.reviewerKey } : {};
  const config = { ...options, cache: options.cache || 'no-store', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders, ...(options.headers || {}) } };
  if (config.body && typeof config.body !== 'string') config.body = JSON.stringify(config.body);
  let response;
  try { response = await fetch(path, config); }
  catch { throw new Error('Cannot reach the local app server. Please restart launch-windows.bat or node server.js.'); }
  let data = {};
  try { data = await response.json(); } catch { /* non-JSON error */ }
  if (!response.ok) {
    const err = new Error(data.error || `Request failed (${response.status}).`);
    err.status = response.status;
    err.problems = data.problems || [];
    throw err;
  }
  return data;
}
function sortedUnique(values) {
  return [...new Set(values.map(v => clean(v)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}
function getRegions() {
  const managed = Array.isArray(state.master?.regions) ? state.master.regions : [];
  return sortedUnique([...managed, ...(state.master?.costCenters || []).map(row => row.region)]);
}
function getCurrencies(region = '') {
  const workbookCurrencies = (state.master?.currencies || []).map(row => clean(row.code).toUpperCase()).filter(Boolean);
  if (workbookCurrencies.length) return sortedUnique(workbookCurrencies);
  const relevant = region ? (state.master?.costCenters || []).filter(row => row.region === region) : (state.master?.costCenters || []);
  const ccCurrencies = relevant.map(row => row.currency);
  const plantCurrencies = (state.master?.plants || []).map(row => row.currency || '');
  return sortedUnique([...ccCurrencies, ...(region ? [] : plantCurrencies)]);
}
function costCenterValue(row) { return clean(row.s4CostCenter) || clean(row.p08CostCenter) || clean(row.city); }
function costCenterLabel(row) {
  const code = costCenterValue(row);
  const name = [row.city, row.country].filter(Boolean).join(', ');
  const currency = row.currency ? ` · ${row.currency}` : '';
  return `${code}${name ? ` — ${name}` : ''}${currency}`;
}
function centersForRegion(region = '') {
  return (state.master?.costCenters || []).filter(row => !region || row.region === region).filter(row => costCenterValue(row));
}
function findCenter(value) {
  const needle = clean(value);
  if (!needle) return null;
  return (state.master?.costCenters || []).find(row => costCenterValue(row) === needle || clean(row.s4CostCenter) === needle || clean(row.p08CostCenter) === needle || clean(row.city) === needle) || null;
}
function findPlant(value) {
  const needle = clean(value);
  if (!needle) return null;
  return (state.master?.plants || []).find(row => clean(row.plantCode || row.plant) === needle) || null;
}
function plantDisplayLabel(row) {
  if (!row) return '';
  const code = clean(row.plantCode || row.plant);
  const details = [row.plantName, row.city, row.postalCode, row.name2].map(clean).filter(v => v && v !== '0');
  return `${code}${details.length ? ` — ${[...new Set(details)].join(' · ')}` : ''}`;
}
function compatibleLineType(account, lineType) {
  const accountType = clean(account.goodOrService).toLowerCase();
  const wanted = clean(lineType).toLowerCase();
  return !wanted || accountType === wanted || accountType === 'good or service';
}
function mappedProjectCategory(wbsNumber) {
  const lastFive = clean(wbsNumber).slice(-5);
  if (PROJECT_GL_RULES.projectOpex.regex.test(lastFive)) return 'PROJECT OPEX';
  if (PROJECT_GL_RULES.projectCapex.regex.test(lastFive)) return 'PROJECT CAPEX';
  return '';
}
function accountForMappedProject(category, type) {
  return (state.master?.glAccounts || []).find(account => account.accountType === category && compatibleLineType(account, type)) || null;
}
function getEligibleOpexAccounts(type) {
  return (state.master?.glAccounts || []).filter(account => account.accountType === 'OPEX' && compatibleLineType(account, type));
}
function getLineGl(line) {
  const fundingType = getFundingType();
  if (fundingType === 'CAPEX') {
    const category = mappedProjectCategory($('#wbs-number').value) || line.wbsCategory || '';
    return category ? accountForMappedProject(category, line.type) : null;
  }
  const wanted = clean(line.costCenterGlCode);
  return (state.master?.glAccounts || []).find(account => `${account.glNumber} - ${account.name}` === wanted || account.glNumber === wanted) || null;
}
function displayGl(account) { return account ? `${account.glNumber} - ${account.name}` : ''; }
function parseManualGlEntry(value) {
  const text = clean(value);
  if (!text) return null;
  const split = text.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (split) return { code: clean(split[1]), description: clean(split[2]) || 'Manual GL entry' };
  return { code: text, description: 'Manual GL entry' };
}
function getFundingType() {
  return $('input[name="funding-type"]:checked')?.value || 'OPEX';
}
function populateHeaderLookups() {
  const regionSelect = $('#region');
  const currencySelect = $('#currency');
  const regions = getRegions();
  regionSelect.innerHTML = `<option value="">Select region</option>${regions.map(region => `<option value="${attrEscape(region)}">${htmlEscape(region)}</option>`).join('')}`;
  const plantSelect = $('#plant-code');
  plantSelect.innerHTML = `<option value="">Search plant code or description</option><option value="${attrEscape(PLANT_UNKNOWN_VALUE)}">I don’t know — Procurement to confirm</option>${(state.master?.plants || []).map(row => {
    const code = clean(row.plantCode || row.plant);
    return `<option value="${attrEscape(code)}">${htmlEscape(plantDisplayLabel(row))}</option>`;
  }).join('')}`;
  populateCompanyCodeOptions('');
  populateCurrencyOptions('', false);
  $('#vendor-master-link').href = state.master?.links?.vendorMasterPowerBI || '#';
  $('#master-vendor-link').href = state.master?.links?.vendorMasterPowerBI || '#';
  $('#master-gl-count').textContent = state.master.glAccounts.length;
  refreshSearchableSelect(regionSelect);
  refreshSearchableSelect(plantSelect);
  $('#master-plant-count').textContent = state.master.plants.length;
  $('#master-cc-count').textContent = state.master.costCenters.length;
  $('#master-region-count').textContent = regions.length;
  $('#tab-gl-count').textContent = state.master.glAccounts.length;
  $('#tab-cc-count').textContent = state.master.costCenters.length;
  $('#tab-plant-count').textContent = state.master.plants.length;
  const reportMasterCount = $('#report-master-count');
  if (reportMasterCount) reportMasterCount.textContent = `${state.master.glAccounts.length + state.master.plants.length + state.master.costCenters.length} records`;
  $('#region-filter').innerHTML = `<option value="">All regions</option>${regions.map(region => `<option value="${attrEscape(region)}">${htmlEscape(region)}</option>`).join('')}`;
  const trackRegion = $('#track-region-filter');
  if (trackRegion) { const previousRegion = trackRegion.value; trackRegion.innerHTML = `<option value="">All regions</option>${regions.map(region => `<option value="${attrEscape(region)}">${htmlEscape(region)}</option>`).join('')}`; if (regions.includes(previousRegion)) trackRegion.value = previousRegion; }
}
function populateCurrencyOptions(region = '', keepValue = true) {
  const select = $('#currency');
  const previous = keepValue ? clean(select.value).toUpperCase() : '';
  const currencies = getCurrencies(region);
  const currencyRows = state.master?.currencies || [];
  select.innerHTML = `<option value="">Select currency or type a code</option>${currencies.map(currency => { const info = currencyRows.find(row => clean(row.code).toUpperCase() === currency); const label = info ? `${currency} — ${info.name || 'Currency'}${info.symbol ? ` (${info.symbol})` : ''}` : `${currency} — Currency name/symbol unavailable`; return `<option value="${attrEscape(currency)}">${htmlEscape(label)}</option>`; }).join('')}`;
  if (previous && !currencies.includes(previous) && /^[A-Z]{3}$/.test(previous)) {
    const manual = document.createElement('option'); manual.value = previous; manual.textContent = `${previous} — Manual currency`; manual.dataset.custom = 'true'; select.appendChild(manual);
  }
  if (previous) select.value = previous;
  refreshSearchableSelect(select);
}
function populateCompanyCodeOptions(region = '', keepValue = true) {
  const select = $('#company-code');
  const previous = keepValue ? clean(select.value) : '';
  const previousOption = select.selectedOptions?.[0];
  const previousMeta = previousOption ? {
    description: previousOption.dataset.description || '', region: previousOption.dataset.region || '',
    country: previousOption.dataset.country || '', ou: previousOption.dataset.ou || ''
  } : null;
  const codes = state.master?.companyCodes || [];
  const normalize = value => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedRegion = normalize(region);
  const visibleCodes = normalizedRegion ? codes.filter(row => normalize(row.region) === normalizedRegion) : [];
  select.innerHTML = `<option value="">${normalizedRegion ? 'Select a company code for this region' : 'Select a region first, or search company code'}</option>${visibleCodes.map(row => {
    const label = `${row.companyCode} — ${row.description}${row.country ? ` · ${row.country}` : ''}${row.region ? ` · ${row.region}` : ''}`;
    return `<option value="${attrEscape(row.companyCode)}" data-description="${attrEscape(row.description)}" data-region="${attrEscape(row.region)}" data-country="${attrEscape(row.country)}" data-ou="${attrEscape(row.ou)}">${htmlEscape(label)}</option>`;
  }).join('')}`;
  if (previous) {
    let option = [...select.options].find(item => item.value === previous);
    if (!option) {
      option = document.createElement('option'); option.value = previous;
      option.textContent = `${previous}${previousMeta?.description ? ` — ${previousMeta.description}` : ' — Manual company code'}`;
      option.dataset.description = previousMeta?.description || '';
      option.dataset.region = previousMeta?.region || region || '';
      option.dataset.country = previousMeta?.country || '';
      option.dataset.ou = previousMeta?.ou || '';
      option.dataset.custom = 'true';
      select.appendChild(option);
    }
    select.value = previous;
  }
  refreshSearchableSelect(select);
}
function populateCostCenters(region, keepValue = true) {
  const select = $('#cost-center');
  const previous = keepValue ? select.value : '';
  const centers = region ? centersForRegion(region) : [];
  select.innerHTML = `<option value="">${region ? 'Select cost center' : 'Choose a region first'}</option>${centers.map(row => {
    const value = costCenterValue(row);
    return `<option value="${attrEscape(value)}" data-currency="${attrEscape(row.currency || '')}">${htmlEscape(costCenterLabel(row))}</option>`;
  }).join('')}`;
  if (previous && centers.some(row => costCenterValue(row) === previous)) select.value = previous;
  refreshSearchableSelect(select);
  updateLineCenterOptions();
}
function updateLineCenterOptions() {
  const selectedRegion = $('#region').value;
  const centers = selectedRegion ? centersForRegion(selectedRegion) : [];
  $$('#line-items-body select[data-field="costCenter"]').forEach(select => {
    const lineId = select.closest('tr[data-line-id]')?.dataset.lineId;
    const line = state.lineItems.find(item => item.id === lineId);
    const previous = select.value || line?.costCenter || $('#cost-center').value;
    const isMasterValue = centers.some(row => costCenterValue(row) === previous);
    const manualOption = previous && !isMasterValue ? `<option value="${attrEscape(previous)}" selected>${htmlEscape(previous)}</option>` : '';
    select.innerHTML = `<option value="">Select CC</option>${manualOption}${centers.map(row => `<option value="${attrEscape(costCenterValue(row))}">${htmlEscape(costCenterLabel(row))}</option>`).join('')}`;
    if (previous && (isMasterValue || manualOption)) select.value = previous;
    refreshSearchableSelect(select);
  });
}
function lineDefault() {
  return { id: cryptoId(), type: 'Goods', wbsCategory: '', wbsGlCode: '', costCenterGlCode: '', glCode: '', glDescription: '', description: '', deliveryDate: '', costCenter: $('#cost-center')?.value || '', quantity: '', unitPrice: '' };
}
function cryptoId() { return `line-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`; }
function recalculateLine(line) {
  const qty = Number(line.quantity || 0);
  const price = Number(line.unitPrice || 0);
  line.total = Math.round((Math.max(0, qty) * Math.max(0, price) + Number.EPSILON) * 100) / 100;
  const account = getLineGl(line);
  const funding = getFundingType();
  if (account) {
    line.glCode = account.glNumber || '';
    line.glDescription = account.name || '';
  } else if (funding === 'OPEX' && clean(line.costCenterGlCode)) {
    const manual = parseManualGlEntry(line.costCenterGlCode);
    line.glCode = manual?.code || '';
    line.glDescription = manual?.description || '';
  } else {
    line.glCode = '';
    line.glDescription = '';
  }
  if (funding === 'CAPEX') line.wbsGlCode = account ? displayGl(account) : '';
  else line.wbsGlCode = '';
  if (funding !== 'CAPEX') line.costCenterGlCode = line.costCenterGlCode || '';
  return line;
}
function glOptionsForLine(line) {
  const accounts = getEligibleOpexAccounts(line.type);
  const known = accounts.some(account => `${account.glNumber} - ${account.name}` === clean(line.costCenterGlCode) || account.glNumber === clean(line.costCenterGlCode));
  const manual = clean(line.costCenterGlCode) && !known
    ? `<option value="${attrEscape(line.costCenterGlCode)}" selected>${htmlEscape(line.costCenterGlCode)}</option>`
    : '';
  return manual + accounts.map(account => {
    const value = `${account.glNumber} - ${account.name}`;
    return `<option value="${attrEscape(value)}" ${selected(line.costCenterGlCode, value)}>${htmlEscape(`${account.glNumber} — ${account.name}`)}</option>`;
  }).join('');
}
function renderLineItems() {
  const tbody = $('#line-items-body');
  const funding = getFundingType();
  const wbsNumber = $('#wbs-number').value;
  const autoCategory = mappedProjectCategory(wbsNumber);
  const lineItemsCard = $('.line-items-card');
  if (lineItemsCard) lineItemsCard.classList.toggle('is-capex', funding === 'CAPEX');
  if (!state.lineItems.length) state.lineItems = [lineDefault()];
  tbody.innerHTML = state.lineItems.map((raw, index) => {
    const line = recalculateLine(raw);
    const account = getLineGl(line);
    const wbsCell = funding !== 'CAPEX' ? `<input aria-label="WBS GL code on line ${index + 1}" readonly placeholder="—" value="—" />` : autoCategory
      ? `<input aria-label="WBS GL code on line ${index + 1}" readonly value="${attrEscape(line.wbsGlCode || 'No mapping found')}" title="${attrEscape(autoCategory)}" />`
      : `<select data-field="wbsCategory" required aria-label="WBS GL mapping on line ${index + 1}"><option value="">Select mapping</option><option value="PROJECT OPEX" ${selected(line.wbsCategory, 'PROJECT OPEX')}>PROJECT OPEX</option><option value="PROJECT CAPEX" ${selected(line.wbsCategory, 'PROJECT CAPEX')}>PROJECT CAPEX</option></select>`;
    const lineCenters = $('#region').value ? centersForRegion($('#region').value) : [];
    const lineCenterIsKnown = lineCenters.some(row => costCenterValue(row) === clean(line.costCenter));
    const manualCcOption = clean(line.costCenter) && !lineCenterIsKnown ? `<option value="${attrEscape(line.costCenter)}" selected>${htmlEscape(line.costCenter)}</option>` : '';
    const ccOptions = `${manualCcOption}${lineCenters.map(row => `<option value="${attrEscape(costCenterValue(row))}" ${selected(line.costCenter, costCenterValue(row))}>${htmlEscape(costCenterLabel(row))}</option>`).join('')}`;
    return `<tr data-line-id="${attrEscape(line.id)}">
      <td class="line-number-cell" aria-label="Line number ${index + 1}">${index + 1}</td>
      <td><select data-field="type" required aria-label="Line ${index + 1} type"><option value="Goods" ${selected(line.type, 'Goods')}>Goods</option><option value="Service" ${selected(line.type, 'Service')}>Service</option></select></td>
      <td class="code-cell wbs-only">${wbsCell}</td>
      <td class="code-cell cc-only"><select data-field="costCenterGlCode" data-allow-custom="true" data-placeholder="Search or type GL code" ${funding === 'OPEX' ? 'required' : ''} aria-label="Cost center GL code on line ${index + 1}" ${funding === 'CAPEX' ? 'disabled' : ''}><option value="">${funding === 'CAPEX' ? 'Not applicable' : 'Select GL account or type manually'}</option>${funding === 'CAPEX' ? '' : glOptionsForLine(line)}</select></td>
      <td class="code-cell"><input aria-label="Resolved GL code on line ${index + 1}" readonly value="${attrEscape(line.glCode || '')}" placeholder="Auto" title="${attrEscape(line.glDescription || 'Select a GL code')}" /></td>
      <td><input class="line-desc" data-field="description" required aria-label="Description on line ${index + 1}" value="${attrEscape(line.description)}" maxlength="1000" placeholder="Describe goods or services" /></td>
      <td class="delivery-date-cell"><input data-field="deliveryDate" type="date" aria-label="Delivery date on line ${index + 1}" value="${attrEscape(line.deliveryDate || '')}" /></td>
      <td class="code-cell cc-only"><select data-field="costCenter" data-allow-custom="true" data-placeholder="Search or type cost center" aria-label="Cost center on line ${index + 1}" ${funding === 'CAPEX' ? 'disabled' : ''}><option value="">${funding === 'CAPEX' ? 'WBS assignment' : 'Select CC'}</option>${funding === 'CAPEX' ? '' : ccOptions}</select></td>
      <td><input data-field="quantity" required aria-label="Quantity on line ${index + 1}" type="number" min="0.01" step="any" value="${attrEscape(line.quantity)}" placeholder="0" /></td>
      <td><input data-field="unitPrice" required aria-label="Unit price on line ${index + 1}" type="number" min="0" step="0.01" value="${attrEscape(line.unitPrice)}" placeholder="0.00" /></td>
      <td><span class="line-total" data-line-total>${money(line.total || 0, $('#currency').value || 'USD')}</span></td>
      <td><div class="line-row-actions"><button type="button" class="line-copy" data-action="copy-line" aria-label="Copy line ${index + 1}" title="Copy this line item">⧉</button><button type="button" class="line-delete" data-action="delete-line" aria-label="Delete line ${index + 1}" title="Delete line">×</button></div></td>
    </tr>`;
  }).join('');
  $('#line-count-label').textContent = `${state.lineItems.length} line item${state.lineItems.length === 1 ? '' : 's'}`;
  const addButton = $('#add-line');
  if (addButton) { addButton.disabled = state.lineItems.length >= 20; addButton.title = state.lineItems.length >= 20 ? 'Maximum 20 line items per request' : 'Add a line item'; }
  const limitNote = $('#line-item-limit-note');
  if (limitNote) limitNote.classList.toggle('is-limit-reached', state.lineItems.length >= 20);
  updateLineCenterOptions();
  enhanceSearchableSelects(tbody);
  syncFormSummary();
}
function syncFormSummary() {
  state.lineItems.forEach(line => recalculateLine(line));
  const total = state.lineItems.reduce((sum, line) => sum + Number(line.total || 0), 0);
  const currency = clean($('#currency').value).toUpperCase();
  const region = clean($('#region').value);
  const vendor = clean($('#vendor-name').value);
  const vendorNumber = clean($('#vendor-number').value);
  const title = clean($('#po-title').value);
  const funding = getFundingType();
  const companyCode = clean($('#company-code').value);
  const companyCodeDescription = clean($('#company-code').selectedOptions?.[0]?.dataset?.description);
  const plantCode = clean($('#plant-code').value);
  const plant = findPlant(plantCode);
  const plantLabel = plantCode ? (plantDisplayLabel(plant) || clean($('#plant-code').selectedOptions?.[0]?.textContent) || plantCode) : '';
  const accountValue = funding === 'OPEX' ? clean($('#cost-center').value) : clean($('#wbs-number').value);
  const accountOptionLabel = funding === 'OPEX' ? clean($('#cost-center').selectedOptions?.[0]?.textContent) : accountValue;
  const displayAccount = accountValue ? (accountOptionLabel && accountOptionLabel !== 'Choose a region first' && accountOptionLabel !== 'Select CC' ? accountOptionLabel : accountValue) : '';
  $('#form-po-total').textContent = currency ? money(total, currency) : Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('#total-currency-label').textContent = currency || 'Select currency';
  $('#summary-title').textContent = title || 'Not entered';
  $('#summary-region').textContent = region || 'Not selected';
  $('#summary-vendor').textContent = vendorNumber || 'Not entered';
  $('#summary-vendor-name').textContent = vendor || 'Not entered';
  $('#summary-company-code').textContent = companyCode ? (companyCodeDescription ? `${companyCode} — ${companyCodeDescription}` : companyCode) : 'Not selected';
  $('#summary-plant-code').textContent = plantLabel || 'Not selected';
  $('#summary-account-value').textContent = displayAccount || (funding === 'OPEX' ? 'Select a cost center' : 'Enter a WBS number');
  $('#summary-currency-code').textContent = currency || 'Select a currency';
  $('#summary-total').textContent = currency ? money(total, currency) : Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('#summary-currency').textContent = currency ? `${currency} · Estimated request value` : 'Select a currency';
  return { total, currency, title };
}
function setFundingMode(value) {
  const capex = value === 'CAPEX';
  $('#choice-opex').classList.toggle('selected', !capex);
  $('#choice-capex').classList.toggle('selected', capex);
  $('#cost-center-field').classList.toggle('hidden', capex);
  $('#wbs-field').classList.toggle('hidden', !capex);
  $('#cost-center').required = !capex;
  $('#wbs-number').required = capex;
  document.body.classList.toggle('capex-mode', capex);
  if (capex) {
    $('#cost-center').value = '';
    const centerCombo = searchableSelects.get($('#cost-center'));
    if (centerCombo) centerCombo.input.value = '';
  } else {
    $('#wbs-number').value = '';
  }
  state.lineItems.forEach(line => {
    if (capex) {
      line.costCenterGlCode = '';
      line.costCenter = '';
    } else {
      line.wbsCategory = '';
      line.wbsGlCode = '';
      if (!line.costCenter) line.costCenter = $('#cost-center').value || '';
    }
  });
  refreshSearchableSelect($('#cost-center'));
  renderLineItems();
}

function serializeForm() {
  const currency = $('#currency').value;
  const lineItems = state.lineItems.map(line => {
    recalculateLine(line);
    return {
      id: line.id, type: line.type, wbsGlCode: getFundingType() === 'CAPEX' ? line.wbsGlCode : '', wbsCategory: getFundingType() === 'CAPEX' ? (line.wbsCategory || '') : '',
      costCenterGlCode: getFundingType() === 'OPEX' ? line.costCenterGlCode : '', glCode: line.glCode, glDescription: line.glDescription,
      description: line.description, deliveryDate: line.deliveryDate || '', costCenter: getFundingType() === 'OPEX' ? line.costCenter : '', quantity: line.quantity === '' ? '' : Number(line.quantity),
      unitPrice: line.unitPrice === '' ? '' : Number(line.unitPrice), total: line.total || 0, currency,
    };
  });
  return {
    region: $('#region').value, requestDate: $('#request-date').value,
    requestorName: $('#requestor-name').value.trim(), requestorEmail: $('#requestor-email').value.trim(),
    vendorName: $('#vendor-name').value.trim(), vendorNumber: $('#vendor-number').value.trim(), vendorEmail: $('#vendor-email').value.trim(),
    companyCode: $('#company-code').value.trim(),
    companyCodeDescription: $('#company-code').selectedOptions[0]?.dataset.description || '',
    companyCodeRegion: $('#company-code').selectedOptions[0]?.dataset.region || '',
    companyCodeCountry: $('#company-code').selectedOptions[0]?.dataset.country || '',
    companyCodeOU: $('#company-code').selectedOptions[0]?.dataset.ou || '',
    plantCode: $('#plant-code').value.trim(), plantName: plantDisplayLabel(findPlant($('#plant-code').value)).replace(`${$('#plant-code').value.trim()} — `, ''), fundingType: getFundingType(),
    costCenter: getFundingType() === 'OPEX' ? $('#cost-center').value.trim() : '', wbsNumber: getFundingType() === 'CAPEX' ? $('#wbs-number').value.trim() : '', currency,
    deliveryFrequency: $('#delivery-frequency').value,
    startDeliveryDate: $('#start-delivery').value, endDeliveryDate: $('#end-delivery').value,
    deliveryCount: $('#delivery-count').value ? Number($('#delivery-count').value) : null,
    title: $('#po-title').value.trim(), requesterNotes: $('#request-notes').value.trim(), lineItems,
  };
}
function localValidation(request) {
  const errors = [];
  if (!request.region) errors.push('Select a region.');
  if (!request.currency || !/^[A-Z]{3}$/.test(request.currency)) errors.push('Select a valid 3-letter currency code.');
  if (!clean(request.title)) errors.push('Enter a purchase order title.');
  if (!clean(request.vendorName)) errors.push('Enter the vendor/company name.');
  if (!clean(request.vendorNumber)) errors.push('Enter the vendor number.');
  if (!clean(request.companyCode)) errors.push('Select a Company Code.');
  if (!clean(request.plantCode)) errors.push('Select a Plant Code or choose “I don’t know — Procurement to confirm”.');
  if (!clean(request.requestorName)) errors.push('Enter the requestor name.');
  if (request.vendorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.vendorEmail)) errors.push('Enter a valid vendor contact email.');
  if (request.requestorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.requestorEmail)) errors.push('Enter a valid requestor email.');
  if (request.fundingType === 'OPEX' && !clean(request.costCenter)) errors.push('Select a cost center for OPEX.');
  if (request.fundingType === 'CAPEX' && !clean(request.wbsNumber)) errors.push('Enter the WBS number for CAPEX.');
  if (request.fundingType === 'CAPEX' && clean(request.wbsNumber) && !validWbsSuffix(request.wbsNumber)) errors.push('WBS number must end in 90XXX or 00XXX (for example, E-00001234-90100).');
  if (!Array.isArray(request.lineItems) || !request.lineItems.length) errors.push('Add at least one line item.');
  if (Array.isArray(request.lineItems) && request.lineItems.length > 20) errors.push('A PO creation request can contain no more than 20 line items. Split larger requirements into separate requests.');
  (request.lineItems || []).forEach((line, i) => {
    const row = i + 1;
    if (!clean(line.type)) errors.push(`Line ${row}: select Goods or Service.`);
    if (!clean(line.description)) errors.push(`Line ${row}: enter a description.`);
    const sourceCode = request.fundingType === 'CAPEX' ? (line.wbsGlCode || line.glCode || line.wbsCategory) : (line.costCenterGlCode || line.glCode);
    if (!clean(sourceCode) || !clean(line.glCode)) errors.push(`Line ${row}: select a valid ${request.fundingType === 'CAPEX' ? 'WBS GL mapping' : 'Cost Center GL Code'} so the GL Code is resolved.`);
    if (!(Number(line.quantity) > 0) || !Number.isFinite(Number(line.quantity))) errors.push(`Line ${row}: quantity must be greater than zero.`);
    if (line.unitPrice === '' || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) errors.push(`Line ${row}: enter a valid unit price.`);
  });
  if (request.startDeliveryDate && request.endDeliveryDate && request.endDeliveryDate < request.startDeliveryDate) errors.push('End delivery date cannot be earlier than start delivery date.');
  return errors;
}
function showValidation(errors) {
  const first = errors[0] || 'Please check the request details.';
  if ($('#wizard-stepper')) {
    const text = first.toLowerCase();
    const step = text.includes('line ') || text.includes('description') || text.includes('gl code') || text.includes('quantity') || text.includes('unit price') ? 4
      : text.includes('delivery date') ? 3
        : text.includes('requestor') || text.includes('cost center') || text.includes('wbs') ? 2
          : text.includes('vendor') || text.includes('company code') || text.includes('plant code') ? 1 : 0;
    setWizardStep(step);
  }
  notify(`${errors.length} item${errors.length === 1 ? '' : 's'} need attention`, first + (errors.length > 1 ? ` Plus ${errors.length - 1} more issue(s).` : ''), 'error');
  const badField = errors[0]?.toLowerCase().includes('region') ? $('#region')
    : errors[0]?.toLowerCase().includes('requestor') ? $('#requestor-name')
      : errors[0]?.toLowerCase().includes('vendor number') ? $('#vendor-number')
      : errors[0]?.toLowerCase().includes('vendor') ? $('#vendor-name')
        : errors[0]?.toLowerCase().includes('plant code') ? $('#plant-code')
        : errors[0]?.toLowerCase().includes('title') ? $('#po-title')
          : errors[0]?.toLowerCase().includes('currency') ? $('#currency')
            : errors[0]?.toLowerCase().includes('cost center') ? $('#cost-center')
              : errors[0]?.toLowerCase().includes('wbs') ? $('#wbs-number') : null;
  if (badField) { const combo = searchableSelects.get(badField); (combo?.input || badField).focus({ preventScroll: false }); }
}
function updateSaveNote(text) { $('#save-note').textContent = text; }
function ensureSelectOption(select, value, label = value) {
  const text = clean(value);
  if (!text) { select.value = ''; refreshSearchableSelect(select); return; }
  let option = [...select.options].find(item => item.value === text);
  if (!option) {
    option = document.createElement('option');
    option.value = text;
    option.textContent = clean(label) || text;
    option.dataset.custom = 'true';
    select.appendChild(option);
  }
  select.value = text;
  refreshSearchableSelect(select);
}
function resetForm() {
  $('#po-form').reset();
  state.supportingFiles = [];
  if ($('#supporting-documents')) $('#supporting-documents').value = '';
  renderSupportingFiles();
  if ($('#wizard-confirm-details')) $('#wizard-confirm-details').checked = false;
  if ($('#wizard-stepper')) setWizardStep(0);
  $('#track-result')?.classList.add('hidden');
  $('#editing-request-id').value = '';
  state.editingId = '';
  state.localDraftId = '';
  state.editingMode = '';
  $('#save-draft').style.display = '';
  $('#submit-request').innerHTML = 'Submit request <span>→</span>';
  $('#request-date').value = localDateInput();
  $('#form-page-title').textContent = 'Create PO request';
  $('#wbs-number').value = '';
  $('input[name="funding-type"][value="OPEX"]').checked = true;
  $('#cost-center').value = '';
  $('#plant-code').value = '';
  $('#region').value = '';
  populateCompanyCodeOptions('', false);
  populateCostCenters('', false);
  populateCurrencyOptions('', false);
  state.lineItems = [lineDefault()];
  setFundingMode('OPEX');
  updateSaveNote('Changes are not saved yet');
  syncSearchableSelects();
  syncFormSummary();
}
function openCreateView(request = null) {
  // Only unsent, browser-local drafts may be resumed in the requester form.
  // Submitted requests are immutable here; reviewers use status / tracking controls.
  if (request && request.requestId && !request._localDraftId) {
    notify('Submitted requests are read-only', 'Use the Reviewer Console to update status and procurement references. Request details cannot be edited after submission.', 'error');
    return;
  }
  resetForm();
  if (request) loadRequestToForm(request);
  switchView('create');
}
function loadRequestToForm(request) {
  setWizardStep(0);
  const isLocalDraft = Boolean(request._localDraftId);
  if (!isLocalDraft) {
    notify('Only saved drafts can be resumed', 'Submitted request details are read-only.', 'error');
    return;
  }
  state.editingId = '';
  state.localDraftId = String(request._localDraftId);
  state.editingMode = 'local-draft';
  $('#save-draft').style.display = '';
  $('#submit-request').innerHTML = 'Submit request <span>→</span>';
  $('#editing-request-id').value = '';
  $('#form-page-title').textContent = `Resume Draft · ${request.title || 'Untitled Request'}`;
  $('#request-date').value = request.requestDate || localDateInput();
  $('#region').value = request.region || '';
  populateCompanyCodeOptions(request.region || '', false);
  populateCostCenters(request.region || '', false);
  populateCurrencyOptions(request.region || '', false);
  const currencyCode = clean(request.currency || '').toUpperCase();
  if (currencyCode && ![...$('#currency').options].some(option => option.value === currencyCode)) {
    const manualCurrency = document.createElement('option');
    manualCurrency.value = currencyCode; manualCurrency.textContent = `${currencyCode} — Manual currency`;
    manualCurrency.dataset.custom = 'true'; $('#currency').appendChild(manualCurrency);
  }
  $('#currency').value = currencyCode; refreshSearchableSelect($('#currency'));
  $('#po-title').value = request.title || '';
  $('#vendor-name').value = request.vendorName || '';
  $('#vendor-number').value = request.vendorNumber || '';
  $('#vendor-email').value = request.vendorEmail || '';
  if (request.companyCode && ![...$('#company-code').options].some(option => option.value === request.companyCode)) {
    const opt = document.createElement('option'); opt.value = request.companyCode;
    opt.textContent = `${request.companyCode}${request.companyCodeDescription ? ` — ${request.companyCodeDescription}` : ''}`;
    opt.dataset.description = request.companyCodeDescription || ''; opt.dataset.region = request.companyCodeRegion || ''; opt.dataset.country = request.companyCodeCountry || ''; opt.dataset.ou = request.companyCodeOU || '';
    $('#company-code').appendChild(opt);
  }
  $('#company-code').value = request.companyCode || ''; refreshSearchableSelect($('#company-code'));
  ensureSelectOption($('#plant-code'), request.plantCode || request.deliveryAddress || '', request.plantCode ? `${request.plantCode}${request.plantName ? ` — ${request.plantName}` : ''}` : (request.deliveryAddress || ''));
  $('#requestor-name').value = request.requestorName || '';
  $('#requestor-email').value = request.requestorEmail || '';
  $('input[name="funding-type"][value="CAPEX"]').checked = request.fundingType === 'CAPEX';
  $('input[name="funding-type"][value="OPEX"]').checked = request.fundingType !== 'CAPEX';
  ensureSelectOption($('#cost-center'), request.costCenter || '', request.costCenter || '');
  $('#wbs-number').value = request.wbsNumber || '';
  $('#request-notes').value = request.requesterNotes || '';
  $('#delivery-frequency').value = request.deliveryFrequency || '';
  $('#start-delivery').value = request.startDeliveryDate || '';
  $('#end-delivery').value = request.endDeliveryDate || '';
  $('#delivery-count').value = request.deliveryCount ?? '';
  state.lineItems = (request.lineItems || []).map(line => ({ ...line, description: line.description || '', deliveryDate: line.deliveryDate || '', id: line.id || cryptoId(), quantity: line.quantity ?? '', unitPrice: line.unitPrice ?? '', wbsCategory: line.wbsCategory || mappedProjectCategory(request.wbsNumber || '') }));
  if (!state.lineItems.length) state.lineItems = [lineDefault()];
  setFundingMode(request.fundingType || 'OPEX');
  renderLineItems();
  updateSaveNote('Editing a saved draft');
  syncSearchableSelects();
  syncFormSummary();
}
const LOCAL_DRAFTS_KEY = 'tccc-po-requester-drafts-v1';
function getLocalDrafts() {
  try { const value = JSON.parse(localStorage.getItem(LOCAL_DRAFTS_KEY) || '[]'); return Array.isArray(value) ? value.filter(item => item && item.id && item.request) : []; }
  catch { return []; }
}
function writeLocalDrafts(drafts) {
  localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
  renderSavedDraftsPanel();
}
function deleteLocalDraft(draftId) {
  const drafts = getLocalDrafts().filter(item => item.id !== draftId);
  writeLocalDrafts(drafts);
  if (state.localDraftId === draftId) state.localDraftId = '';
}
function renderSavedDraftsPanel(open = false) {
  const panel = $('#saved-drafts-panel');
  const button = $('#saved-drafts-toggle');
  const list = $('#saved-drafts-list');
  if (!panel || !button || !list) return;
  const drafts = getLocalDrafts().sort((a,b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
  button.textContent = `My Saved Drafts (${drafts.length})`;
  if (open) panel.classList.remove('hidden');
  if (!drafts.length) {
    list.innerHTML = '<div class="saved-drafts-empty"><strong>No saved drafts yet</strong><span>Use Save Draft at any step to continue the request later.</span></div>';
  } else {
    list.innerHTML = drafts.map(draft => `<article class="saved-draft-row"><div class="saved-draft-copy"><strong>${htmlEscape(draft.title || 'Untitled Request')}</strong><span>${htmlEscape([draft.request?.region || 'Region not selected', draft.request?.vendorName || 'Vendor not entered', draft.request?.requestorName || 'Requestor not entered'].join(' · '))}</span><small>Saved ${htmlEscape(dateTimeLabel(draft.savedAt))}</small></div><div class="saved-draft-actions"><button type="button" class="button button-primary button-small" data-action="resume-local-draft" data-draft-id="${attrEscape(draft.id)}">Resume</button><button type="button" class="button button-quiet button-small" data-action="delete-local-draft" data-draft-id="${attrEscape(draft.id)}">Delete</button></div></article>`).join('');
  }
}
async function saveDraft() {
  try {
    const request = serializeForm();
    const drafts = getLocalDrafts();
    const id = state.localDraftId || `draft-${cryptoId()}`;
    const savedAt = new Date().toISOString();
    const record = { id, title: clean(request.title) || 'Untitled Request', savedAt, request };
    const next = [record, ...drafts.filter(item => item.id !== id)].slice(0, 50);
    writeLocalDrafts(next);
    state.localDraftId = id;
    state.editingId = '';
    state.editingMode = 'local-draft';
    $('#editing-request-id').value = '';
    $('#form-page-title').textContent = `Resume Draft · ${record.title}`;
    updateSaveNote(`Draft saved at ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    notify('Draft saved on this device', 'Open My Saved Drafts to resume it. Supporting documents need to be reattached when you return.');
  } catch (error) {
    notify('Could not save draft', error?.name === 'QuotaExceededError' ? 'Browser storage is full. Delete an old draft or reduce the amount of text entered.' : (error.message || 'Browser storage is unavailable.'), 'error');
  }
}
function renderTrackResult(data, targetId = 'track-result', pageMode = false) {
  const result = $(`#${targetId}`);
  const history = Array.isArray(data.history) ? data.history : [];
  const lines = Array.isArray(data.lineItems) ? data.lineItems : [];
  const account = String(data.fundingType || '').toUpperCase() === 'CAPEX' ? `WBS: ${data.wbsNumber || '—'}` : `Cost Center: ${data.costCenter || '—'}`;
  const lineTable = lines.length ? `<section class="track-full-lines"><div class="track-full-section-head"><h4>PO line items</h4><span>${lines.length} item(s)</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>TYPE</th><th>GL CODE</th><th>DESCRIPTION</th><th>QUANTITY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead><tbody>${lines.map(line => `<tr><td>${htmlEscape(line.type || '—')}</td><td>${htmlEscape(line.glCode || '—')}</td><td>${htmlEscape(line.description || '—')}</td><td>${htmlEscape(line.quantity ?? 0)}</td><td>${htmlEscape(money(line.unitPrice || 0, data.currency || 'USD'))}</td><td>${htmlEscape(money(line.total ?? Number(line.quantity || 0) * Number(line.unitPrice || 0), data.currency || 'USD'))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="5">PO Value</td><td>${htmlEscape(money(data.poValue || 0, data.currency || 'USD'))}</td></tr></tfoot></table></div></section>` : '';
  result.innerHTML = `<div class="track-result-head"><div><span class="track-result-label">CURRENT STATUS</span><h3>${htmlEscape(data.statusLabel || data.status || 'Unknown')}</h3><p>${htmlEscape(data.requestId)} · ${htmlEscape(data.title || 'PO request')}</p></div><div class="track-result-head-actions">${statusPill(data.status, data.statusLabel || statusDisplayLabel(data.status, data))}<button class="button button-secondary button-small" type="button" data-action="refresh-status" ${pageMode ? 'data-track-page="true"' : ''}>Refresh status</button></div></div><div class="track-request-summary"><div><span>Vendor</span><strong>${htmlEscape(data.vendorName || '—')}</strong></div><div><span>Vendor number</span><strong>${htmlEscape(data.vendorNumber || '—')}</strong></div><div><span>Requestor</span><strong>${htmlEscape(data.requestorName || '—')}</strong></div><div><span>Region</span><strong>${htmlEscape(data.region || '—')}</strong></div><div><span>Request value</span><strong>${htmlEscape(money(data.poValue || 0, data.currency || 'USD'))}</strong></div><div><span>Company Code</span><strong>${htmlEscape(data.companyCode ? `${data.companyCode}${data.companyCodeDescription ? ` — ${data.companyCodeDescription}` : ''}` : '—')}</strong></div></div><div class="track-result-meta"><div><span>Request date</span><strong>${htmlEscape(dateLabel(data.requestDate || data.createdAt))}</strong></div><div><span>Delivery frequency</span><strong>${htmlEscape(data.deliveryFrequency || '—')}</strong></div><div><span>Start delivery</span><strong>${htmlEscape(dateLabel(data.startDeliveryDate))}</strong></div><div><span>End delivery</span><strong>${htmlEscape(dateLabel(data.endDeliveryDate))}</strong></div><div><span>Account assignment</span><strong>${htmlEscape(account)}</strong></div><div><span>Plant Code</span><strong>${htmlEscape([data.plantCode, data.plantName].filter(Boolean).join(' — ') || '—')}</strong></div><div><span>Last updated</span><strong>${htmlEscape(dateTimeLabel(data.updatedAt))}</strong></div>${data.lastUpdatedBy ? `<div><span>Last updated by</span><strong>${htmlEscape(data.lastUpdatedBy)}</strong></div>` : ''}${data.oroNumber ? `<div><span>ORO</span><strong>${htmlEscape(data.oroNumber)}</strong></div>` : ''}${data.poNumber ? `<div><span>PO Number</span><strong>${htmlEscape(data.poNumber)}</strong></div>` : ''}${data.requesterNotes ? `<div class="track-note-wide"><span>Request notes</span><strong>${htmlEscape(data.requesterNotes)}</strong></div>` : ''}</div>${lineTable}<div class="track-full-section-head track-history-head"><h4>Workflow history</h4><span>${history.length} event(s)</span></div><div class="track-timeline">${history.map(item => `<div class="track-timeline-item"><i></i><div><strong>${htmlEscape(item.statusLabel || item.status)}${item.note ? ` · ${htmlEscape(item.note)}` : ''}</strong><span>${htmlEscape(dateTimeLabel(item.at))}${item.by ? ` · ${htmlEscape(item.by)}` : ''}</span></div></div>`).join('') || '<p>No workflow updates have been recorded yet.</p>'}</div><p class="track-privacy-note">Status and procurement references are shown for the selected submitted request. A private tracking code is optional; if entered, it must match.</p>`;
  result.classList.remove('hidden');
}
async function trackRequest(options = {}) {
  const pageMode = Boolean(options.page);
  const requestId = $(pageMode ? '#track-request-id-page' : '#track-request-id').value.trim();
  const trackingCode = $(pageMode ? '#track-code-page' : '#track-code').value.trim();
  if (!requestId) { if (!options.quiet) notify('Enter a Request ID', 'Enter the Request ID or choose one from the search results.', 'error'); return; }
  const button = $(pageMode ? '#track-submit-page' : '#track-submit');
  button.disabled = true; button.textContent = 'Checking…';
  try {
    const data = await api('/api/track-request', { method: 'POST', body: { requestId, trackingCode } });
    renderTrackResult(data, pageMode ? 'track-result-page' : 'track-result', pageMode);
  } catch (error) {
    $(pageMode ? '#track-result-page' : '#track-result').classList.add('hidden');
    if (!options.quiet) notify('Could not find request', error.message, 'error');
  } finally { button.disabled = false; button.innerHTML = pageMode ? 'Track request <span>→</span>' : 'Check status <span>→</span>'; }
}
function trackSortRequests(requests) {
  const sortBy = $('#track-sort')?.value || 'request-desc';
  const copy = [...requests];
  const valueFor = row => sortBy.startsWith('request') ? String(row.requestDate || row.createdAt || '').slice(0, 10) : String(row.updatedAt || row.requestDate || row.createdAt || '');
  copy.sort((a, b) => {
    const av = valueFor(a), bv = valueFor(b);
    const cmp = av.localeCompare(bv);
    return sortBy.endsWith('asc') ? cmp : -cmp;
  });
  return copy;
}
function trackProgressHistoryEntry(request, candidates) {
  const history = Array.isArray(request?.approvalHistory) ? request.approvalHistory : [];
  return history.slice().reverse().find(event => candidates.includes(String(event.status || '')));
}
function renderTrackProgress(request) {
  const body = $('#track-progress-body');
  const idBadge = $('#track-progress-request-id');
  const subtitle = $('#track-progress-subtitle');
  const viewButton = $('#track-progress-view-details');
  if (!body) return;
  if (!request) {
    state.trackProgressRequestId = '';
    if (idBadge) { idBadge.textContent = ''; idBadge.classList.add('hidden'); }
    if (subtitle) subtitle.textContent = 'Track the current status of your selected request.';
    if (viewButton) { viewButton.disabled = true; viewButton.dataset.requestId = ''; }
    body.innerHTML = '<div class="track-progress-empty"><span class="track-progress-empty-icon">⌕</span><strong>Select a request to view progress</strong><p>Search for a request, then select its Request ID to see the latest workflow stage.</p></div>';
    return;
  }
  state.trackProgressRequestId = request.requestId;
  if (idBadge) { idBadge.textContent = request.requestId; idBadge.classList.remove('hidden'); }
  if (subtitle) subtitle.textContent = `${request.title || 'Purchase order request'} · latest saved status`;
  if (viewButton) { viewButton.disabled = false; viewButton.dataset.requestId = request.requestId; }

  const status = String(request.status || 'Submitted');
  const isInitial = isInitialPortalSubmission(request);
  const isPp = status === 'Request Submitted on PP+' || status === 'Approved';
  const isPending = ['Submitted', 'Under Review'].includes(status) && !isInitial;
  const isOutcome = ['PO Created', 'Clarification Required', 'Rejected'].includes(status);
  const step1Done = !isInitial;
  const step1Active = isInitial;
  const step2Done = isOutcome || isPp;
  const step2Active = isPending;
  const progressHistory = Array.isArray(request.approvalHistory) ? request.approvalHistory : [];
  const stage1Event = progressHistory.find(item => String(item.status || '') === 'Submitted' && String(item.note || '').trim() === INITIAL_SUBMISSION_NOTE)
    || progressHistory.find(item => String(item.status || '') === 'Submitted' && !item.from)
    || trackProgressHistoryEntry(request, ['Request Submitted on PP+', 'Approved']) || null;
  const stage2Event = progressHistory.slice().reverse().find(item => ['Under Review', 'Submitted'].includes(String(item.status || '')) && (!item.from || String(item.from) !== String(item.status || '')) && !(String(item.status || '') === 'Submitted' && String(item.note || '').trim() === INITIAL_SUBMISSION_NOTE)) || null;
  const outcomeEvent = progressHistory.slice().reverse().find(item => String(item.status || '') === status && (!item.from || String(item.from) !== String(item.status || ''))) || null;
  const submittedAt = stage1Event?.at || request.requestDate || request.createdAt;
  const pendingAt = isPending ? (stage2Event?.at || request.updatedAt) : '';
  const outcomeAt = isOutcome ? (outcomeEvent?.at || request.updatedAt) : '';
  const timelineDate = value => value ? dateTimeLabel(value) : 'Awaiting next step';
  let outcomeHeading = 'Approval outcome';
  let outcomeCopy = 'The PO Team will update this section after review.';
  let outcomeClass = 'pending';
  if (status === 'PO Created') { outcomeHeading = 'PO Created'; outcomeCopy = request.poNumber ? `PO Number: ${request.poNumber}` : 'Purchase order has been created.'; outcomeClass = 'created'; }
  else if (status === 'Clarification Required') { outcomeHeading = 'Clarification Required'; outcomeCopy = 'Additional information is needed before the review can continue.'; outcomeClass = 'clarification'; }
  else if (status === 'Rejected') { outcomeHeading = 'Rejected'; outcomeCopy = 'The request was rejected by the review team.'; outcomeClass = 'rejected'; }
  body.innerHTML = `<div class="track-progress-summary">${statusPill(status, statusDisplayLabel(status, request))}<span>Updated ${htmlEscape(dateTimeLabel(request.updatedAt || request.requestDate || request.createdAt))}</span></div><div class="track-progress-timeline"><div class="track-progress-step ${step1Done ? 'complete' : ''} ${step1Active ? 'active' : ''}"><i>${step1Done ? '✓' : '1'}</i><div><strong>${htmlEscape(INITIAL_SUBMISSION_LABEL)}</strong><small>${htmlEscape(timelineDate(submittedAt))}</small><p>${step1Active ? 'Request received. The PO Team can now start creating the purchase order.' : 'Portal request received and registered.'}</p></div></div><div class="track-progress-step ${step2Done ? 'complete' : ''} ${step2Active ? 'active' : ''}"><i>${step2Done ? '✓' : '2'}</i><div><strong>Pending for Approval</strong><small>${htmlEscape(timelineDate(pendingAt))}</small><p>${step2Active ? 'The request is being reviewed by Procurement.' : step2Done ? 'Review stage completed.' : 'Shown when the request enters review.'}</p></div></div><div class="track-progress-outcome ${outcomeClass}"><span class="track-outcome-indicator">${isOutcome ? (status === 'PO Created' ? '✓' : status === 'Rejected' ? '×' : '!') : '3'}</span><div><strong>${htmlEscape(outcomeHeading)}</strong><small>${htmlEscape(timelineDate(outcomeAt))}</small><p>${htmlEscape(outcomeCopy)}</p>${!isOutcome ? '<div class="track-outcome-options"><span class="created">PO Created</span><span class="clarification">Clarification Required</span><span class="rejected">Rejected</span></div>' : ''}</div></div></div>`;
}
function renderRequestSearchResults(payload) {
  const container = $('#track-search-results');
  const requests = trackSortRequests(Array.isArray(payload.requests) ? payload.requests : []);
  state.trackSearchResults = requests;
  $('#track-initial-state')?.classList.add('hidden');
  const total = Number(payload.total ?? requests.length);
  state.trackSearchTotal = total;
  const summary = $('#track-search-summary');
  if (summary) summary.textContent = `${total} matching request${total === 1 ? '' : 's'} found`;
  const count = $('#track-result-count');
  if (count) count.textContent = `${total} request${total === 1 ? '' : 's'}`;
  const exportButton = $('#track-export-results');
  if (exportButton) exportButton.disabled = !requests.length;
  if (!requests.length) {
    container.innerHTML = '<div class="track-search-empty"><span class="track-empty-mark" aria-hidden="true">⌕</span><strong>No matching requests found</strong><span>Try a different Request ID, requestor or vendor, or clear one of the filters.</span></div>';
    renderTrackProgress(null);
  } else {
    const selectedRequest = requests.find(request => request.requestId === state.trackProgressRequestId) || requests[0];
    container.innerHTML = `<div class="track-search-results-head"><strong>Search results <span>${requests.length}${total > requests.length ? ` of ${total}` : ''} shown</span></strong><span>Select a Request ID to view its progress</span></div><div class="table-wrap track-table-wrap"><table class="data-table track-request-table"><thead><tr><th>#</th><th>REQUEST ID</th><th>REQUESTOR NAME</th><th>VENDOR NAME / NUMBER</th><th>REGION</th><th>REQUEST DATE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${requests.map((r, i) => `<tr class="${r.requestId === selectedRequest.requestId ? 'track-row-selected' : ''}" data-track-row="${attrEscape(r.requestId)}"><td class="track-row-index">${i + 1}</td><td><button type="button" class="track-search-request-id track-request-id-link" data-action="select-track-request" data-request-id="${attrEscape(r.requestId)}" aria-pressed="${r.requestId === selectedRequest.requestId ? 'true' : 'false'}">${htmlEscape(r.requestId)}</button></td><td>${htmlEscape(r.requestorName || '—')}</td><td><span class="track-table-vendor">${htmlEscape(r.vendorName || '—')}${r.vendorNumber ? ` (${htmlEscape(r.vendorNumber)})` : ''}</span></td><td>${htmlEscape(r.region || '—')}</td><td>${htmlEscape(dateLabel(r.requestDate || r.createdAt))}</td><td>${statusPill(r.status, r.statusLabel || statusDisplayLabel(r.status, r))}</td><td><button type="button" class="track-view-button" data-action="open-track-request" data-request-id="${attrEscape(r.requestId)}"><span aria-hidden="true">◉</span> View <b aria-hidden="true">›</b></button></td></tr>`).join('')}</tbody></table></div>${payload.limited ? '<p class="track-search-hint track-results-limit">Showing the newest 50 matches. Add more search detail to narrow the list.</p>' : ''}`;
    renderTrackProgress(selectedRequest);
  }
  container.classList.remove('hidden');
}
let trackAutoSearchTimer = null;
let trackRefreshInterval = null;
function configureTrackAutoRefresh(enabled) {
  if (trackRefreshInterval) window.clearInterval(trackRefreshInterval);
  trackRefreshInterval = null;
  if (!enabled) return;
  trackRefreshInterval = window.setInterval(() => {
    if (document.hidden || state.currentView !== 'track' || !state.trackSearchCriteria) return;
    searchSubmittedRequests({ auto: true, silentRefresh: true });
  }, 30000);
}
function clearTrackSearchResults() {
  state.trackSearchRunId += 1;
  state.trackSearchResults = []; state.trackSearchTotal = 0; state.trackSearchCriteria = null; state.trackSearchAutoNote = ''; state.trackProgressRequestId = '';
  $('#track-search-results').classList.add('hidden');
  $('#track-initial-state').classList.remove('hidden');
  $('#track-search-summary').textContent = 'Search by Request ID, Requestor, Vendor, or use filters. Filter changes update results automatically.';
  $('#track-result-count').textContent = '0 requests';
  $('#track-export-results').disabled = true;
  renderTrackProgress(null);
}
function queueTrackAutoSearch() {
  if (trackAutoSearchTimer) window.clearTimeout(trackAutoSearchTimer);
  trackAutoSearchTimer = window.setTimeout(() => {
    trackAutoSearchTimer = null;
    const values = {
      requestId: $('#track-request-id-search').value.trim(),
      requestorName: $('#track-requestor-search').value.trim(),
      vendorQuery: $('#track-vendor-search').value.trim(),
      region: $('#track-region-filter').value, status: $('#track-status-filter').value,
      fromDate: $('#track-date-from').value, toDate: $('#track-date-to').value
    };
    const hasFilters = Boolean(values.region || values.status || values.fromDate || values.toDate);
    const hasEligibleTerms = [values.requestId, values.requestorName, values.vendorQuery].some(value => value.length >= 3);
    const hasPartialTerms = [values.requestId, values.requestorName, values.vendorQuery].some(value => value.length > 0 && value.length < 3);
    if (!hasFilters && !hasEligibleTerms) {
      // Do not leave results from an older query on screen while a new short query is incomplete.
      clearTrackSearchResults();
      if (hasPartialTerms) $('#track-search-summary').textContent = 'Type at least 3 characters, or choose a filter to update results.';
      return;
    }
    searchSubmittedRequests({ auto: true });
  }, 220);
}
async function searchSubmittedRequests(options = {}) {
  const auto = Boolean(options.auto);
  const rawRequestId = $('#track-request-id-search').value.trim();
  const rawRequestorName = $('#track-requestor-search').value.trim();
  const rawVendorQuery = $('#track-vendor-search').value.trim();
  // Automatic filtering can still run when a user has started typing a keyword: terms under
  // three characters are temporarily ignored, while the selected filters are applied.
  const requestId = auto && rawRequestId.length > 0 && rawRequestId.length < 3 ? '' : rawRequestId;
  const requestorName = auto && rawRequestorName.length > 0 && rawRequestorName.length < 3 ? '' : rawRequestorName;
  const vendorQuery = auto && rawVendorQuery.length > 0 && rawVendorQuery.length < 3 ? '' : rawVendorQuery;
  const trackingCode = $('#track-code-search').value.trim();
  const region = $('#track-region-filter').value;
  const status = $('#track-status-filter').value;
  const fromDate = $('#track-date-from').value;
  const toDate = $('#track-date-to').value;
  if (!requestId && !requestorName && !vendorQuery && !region && !status && !fromDate && !toDate) {
    if (!auto) { notify('Enter a search or choose a filter', 'Search by Request ID, requestor or vendor, or select a region, status or date range.', 'error'); $('#track-request-id-search').focus(); }
    else clearTrackSearchResults();
    return;
  }
  for (const [label, value] of [['Request ID', requestId], ['Requestor name', requestorName], ['Vendor name or number', vendorQuery]]) {
    if (value && value.length < 3) { if (!auto) notify(`${label} is too short`, 'Enter at least 3 characters or clear this field.', 'error'); return; }
  }
  if (trackingCode && !requestId && !auto) {
    notify('Request ID required', 'Enter the Request ID with the optional tracking code so the code can be verified securely.', 'error');
    $('#track-request-id-search').focus();
    return;
  }
  if (fromDate && toDate && fromDate > toDate) {
    if (!auto) notify('Invalid date range', 'The From date must not be later than the To date.', 'error');
    else {
      $('#track-search-summary').textContent = 'Invalid date range: From date must not be later than To date.';
      $('#track-search-results').innerHTML = `<div class="track-search-empty error"><span class="track-empty-mark" aria-hidden="true">!</span><strong>Check the date range</strong><span>The From date must be on or before the To date.</span></div>`;
      $('#track-search-results').classList.remove('hidden'); $('#track-initial-state').classList.add('hidden');
    }
    return;
  }
  const button = $('#track-search-submit');
  const refreshButton = $('#track-refresh-results');
  const manualRefresh = Boolean(options.manualRefresh);
  const runId = ++state.trackSearchRunId;
  if (manualRefresh && refreshButton) { refreshButton.disabled = true; refreshButton.textContent = 'Refreshing…'; }
  if (!auto) { button.disabled = true; button.innerHTML = 'Searching…'; }
  state.trackSearchAutoNote = auto && [rawRequestId, rawRequestorName, rawVendorQuery].some(value => value.length > 0 && value.length < 3)
    ? ' Short keywords are ignored until you enter at least 3 characters.' : '';
  try {
    if (requestId && trackingCode) {
      await api('/api/track-request', { method: 'POST', body: { requestId, trackingCode } });
    }
    const result = await api('/api/request-search', { method: 'POST', body: { requestId, requestorName, vendorQuery, region, status, fromDate, toDate } });
    if (runId !== state.trackSearchRunId) return;
    state.trackSearchCriteria = { requestId, requestorName, vendorQuery, region, status, fromDate, toDate };
    renderRequestSearchResults(result);
    if (state.trackSearchAutoNote) $('#track-search-summary').textContent += state.trackSearchAutoNote;
    if (manualRefresh) notify('Tracking results refreshed', `Latest saved statuses loaded at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
    if (result.limited && !auto) notify('Search results limited', 'Refine your filters to narrow the matches.');
  } catch (error) {
    if (runId !== state.trackSearchRunId) return;
    // A failed refresh must not erase the last good result set or lose the user's search criteria.
    if (auto && (manualRefresh || options.silentRefresh) && state.trackSearchCriteria) {
      $('#track-search-summary').textContent = `Refresh failed. Showing the last loaded results. ${error.message}`;
      if (manualRefresh) notify('Refresh failed', error.message, 'error');
      return;
    }
    state.trackSearchResults = []; state.trackSearchTotal = 0; state.trackSearchCriteria = null;
    $('#track-initial-state')?.classList.add('hidden');
    $('#track-search-summary').textContent = auto ? `Could not update results: ${error.message}` : 'Search could not be completed';
    $('#track-result-count').textContent = 'Search error';
    $('#track-export-results').disabled = true;
    $('#track-search-results').innerHTML = `<div class="track-search-empty error"><span class="track-empty-mark" aria-hidden="true">!</span><strong>Could not search requests</strong><span>${htmlEscape(error.message)}</span></div>`;
    $('#track-search-results').classList.remove('hidden');
  } finally {
    if (!auto) { button.disabled = false; button.innerHTML = '<span aria-hidden="true">⌕</span> Search'; }
    if (manualRefresh && refreshButton) { refreshButton.disabled = false; refreshButton.innerHTML = '↻ Refresh'; }
  }
}
async function exportTrackSearchResults() {
  const criteria = state.trackSearchCriteria;
  const button = $('#track-export-results');
  if (!state.trackSearchResults.length || !criteria) return;
  button.disabled = true; button.textContent = 'Exporting…';
  try {
    const response = await fetch('/api/request-search/export.xlsx', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...criteria, sortBy: $('#track-sort').value })
    });
    if (!response.ok) {
      let message = 'Could not export the current search results.';
      try { message = (await response.json()).error || message; } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `po-request-search-${localDateInput()}.xlsx`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    notify('Excel export ready', 'The filtered Track My Request results were downloaded as an Excel workbook.');
  } catch (error) { notify('Export failed', error.message, 'error'); }
  finally { button.disabled = false; button.innerHTML = '⇩ Export (Excel)'; }
}

async function openTrackedRequest(requestId) {
  const id = clean(requestId).toUpperCase();
  if (!id) return;
  const button = document.activeElement?.closest?.('[data-action="open-track-request"]');
  if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Opening…'; }
  try {
    const data = await api('/api/track-request', { method: 'POST', body: { requestId: id, trackingCode: '' } });
    state.detailReturnView = 'track';
    state.detailSource = 'track';
    state.detailTab = 'overview';
    renderRequestDetailsPage(data, 'track');
    switchView('details');
  } catch (error) {
    notify('Could not open request', error.message, 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'View'; delete button.dataset.originalText; }
  }
}

async function submitRequest() {
  const request = serializeForm();
  const errors = localValidation(request);
  if (errors.length) return showValidation(errors);
  if (state.currentWizardStep === WIZARD_STEPS.length - 1 && !$('#wizard-confirm-details').checked) {
    notify('Confirm request details', 'Tick the confirmation box after reviewing the details before submitting.', 'error');
    $('#wizard-confirm-details').focus();
    return;
  }
  // Saving a request never opens or sends email automatically. The requester opens the pre-filled compose window when ready.
  $('#submit-request').disabled = true;
  $('#submit-request').textContent = 'Submitting…';
  try {
    let result;
    result = await api('/api/requests', { method: 'POST', body: { intent: 'submit', request } });
    const submittedSupportingFiles = [...state.supportingFiles];
    const submittedRequest = result.request;
    if (state.localDraftId) deleteLocalDraft(state.localDraftId);
    state.lastSubmittedRequest = submittedRequest;
    state.lastSubmittedFiles = submittedSupportingFiles;
    if (state.reviewerMode) await reloadRequests();
    const submittedId = submittedRequest.requestId;
    const trackingCode = result.trackingCode || '';
    resetForm();
    if (state.reviewerMode) {
      switchView('requests');
      notify('Request submitted', `${submittedId} was saved to the request register. Email was not opened or sent automatically.`, 'success');
      await showDetails(submittedId);
    } else {
      // After saving, show the complete email preview. The mail app opens only when the requester clicks the GRW address.
      openEmailPreview(submittedRequest, submittedSupportingFiles, 'track', trackingCode);
      notify('Request submitted successfully', `${submittedId} is in the request register. Click the GRW mailbox address to open a pre-filled email and send manually. Nothing was sent automatically.`, 'success');
    }
  } catch (error) {
    const problems = error.problems || [];
    if (problems.length) showValidation(problems);
    else notify('Submission failed', error.message, 'error');
  } finally {
    $('#submit-request').disabled = false;
    $('#submit-request').innerHTML = 'Submit request <span>→</span>';
  }
}

function switchView(view) {
  if (!state.reviewerMode && !['home', 'create', 'track', 'details', 'email'].includes(view)) view = 'home';
  if (view === 'create' && state.currentView !== 'create') {
    if (!state.editingId) resetForm();
    setWizardStep(0);
  }
  state.currentView = view;
  $$('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view || (view === 'create' && item.dataset.action === 'create')));
  $('#breadcrumb-current').textContent = ({ home: 'Home', overview: 'Overview', create: 'New request', track: 'Track My Request', details: 'Request Details', email: 'Email Compose Preview', requests: 'PO Requests', master: 'Master Data', reports: 'Reports & Exports' })[view] || 'Overview';
  if (view === 'overview') renderOverview();
  if (view === 'requests') renderRequests();
  if (view === 'master') { renderMasterTable(); loadExcelSyncStatus(); }
  if (view === 'reports') renderReports();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMobileNav();
}
function closeMobileNav() {
  const sidebar=$('#sidebar'), scrim=$('#mobile-scrim'), menu=$('#open-sidebar');
  if(!sidebar||!scrim)return;
  const wasOpen=sidebar.classList.contains('open');
  sidebar.classList.remove('open');scrim.classList.remove('show');
  const onMobile=window.matchMedia('(max-width: 820px)').matches;
  sidebar.setAttribute('aria-hidden',onMobile?'true':'false');scrim.setAttribute('aria-hidden','true');
  document.body.classList.remove('mobile-nav-open');
  if(menu)menu.setAttribute('aria-expanded','false');
  if(wasOpen && onMobile && menu) window.setTimeout(()=>menu.focus({preventScroll:true}),20);
}
function openMobileNav() {
  const sidebar=$('#sidebar'), scrim=$('#mobile-scrim'), menu=$('#open-sidebar');
  if(!sidebar||!scrim)return;
  sidebar.classList.add('open');scrim.classList.add('show');
  sidebar.setAttribute('aria-hidden','false');scrim.setAttribute('aria-hidden','false');
  document.body.classList.add('mobile-nav-open');
  if(menu)menu.setAttribute('aria-expanded','true');
  window.setTimeout(()=>$('#close-sidebar')?.focus({preventScroll:true}),25);
}
function requestRow(request, recent = false) {
  const total = requestTotal(request);
  if (recent) {
    return `<tr><td><button class="request-id inline-request-link" data-open-request="${attrEscape(request.requestId)}">${htmlEscape(request.requestId)}</button><div class="secondary-cell">${htmlEscape(request.title || 'Untitled request')}</div></td><td class="vendor-cell">${htmlEscape(request.vendorName || '—')}<div class="secondary-cell">${htmlEscape(request.vendorNumber || '')}</div></td><td>${htmlEscape(request.requestorName || '—')}</td><td>${htmlEscape(dateLabel(request.requestDate || request.createdAt))}</td><td class="value-cell">${money(total, request.currency || 'USD')}</td><td>${statusPill(request.status, request.statusLabel || statusDisplayLabel(request.status, request))}</td><td><button class="row-action" data-open-request="${attrEscape(request.requestId)}" title="Open request">↗</button></td></tr>`;
  }
  return `<tr><td><button class="request-id inline-request-link" data-open-request="${attrEscape(request.requestId)}">${htmlEscape(request.requestId)}</button><div class="secondary-cell">${(request.lineItems || []).length} line item${(request.lineItems || []).length === 1 ? '' : 's'}</div></td><td><div class="request-title-cell" title="${attrEscape(request.title || '')}">${htmlEscape(request.title || 'Untitled request')}</div></td><td><div class="vendor-cell" title="${attrEscape(request.vendorName || '')}">${htmlEscape(request.vendorName || '—')}</div><div class="secondary-cell">${htmlEscape(request.vendorNumber || '')}${request.vendorNumber && request.vendorEmail ? ' · ' : ''}${htmlEscape(request.vendorEmail || '')}</div></td><td><div class="requestor-cell" title="${attrEscape(request.requestorName || '')}">${htmlEscape(request.requestorName || '—')}</div><div class="secondary-cell">${htmlEscape(request.requestorEmail || '')}</div></td><td>${htmlEscape(request.region || '—')}</td><td>${htmlEscape(dateLabel(request.requestDate || request.createdAt))}</td><td class="value-cell">${money(total, request.currency || 'USD')}</td><td>${statusPill(request.status, request.statusLabel || statusDisplayLabel(request.status, request))}</td><td><div class="register-actions"><button class="register-action" data-open-request="${attrEscape(request.requestId)}">Open</button></div></td></tr>`;
}
function isAwaitingPoTeamAction(request) {
  return String(request?.status || '') === 'Submitted' && isInitialPortalSubmission(request);
}
function overviewActivityClass(label) {
  const value = clean(label).toLowerCase();
  if (value.includes('created')) return 'created';
  if (value.includes('reject')) return 'rejected';
  if (value.includes('clarification')) return 'clarification';
  if (value.includes('pending') || value.includes('approval')) return 'pending';
  if (value.includes('submitted')) return 'submitted';
  return 'neutral';
}
function renderOverviewActivity(requests) {
  const container = $('#overview-activity-list');
  if (!container) return;
  const entries = [];
  requests.forEach(request => {
    const history = Array.isArray(request.approvalHistory) ? request.approvalHistory : (Array.isArray(request.history) ? request.history : []);
    if (history.length) {
      history.forEach(event => {
        const at = event?.at || event?.timestamp || request.updatedAt || request.createdAt || request.requestDate || '';
        const label = statusDisplayLabelForEvent(event);
        entries.push({ request, event, at, label, fallback: false });
      });
    } else {
      const at = request.updatedAt || request.createdAt || request.requestDate || '';
      entries.push({ request, event: null, at, label: statusDisplayLabel(request.status, request), fallback: true });
    }
  });
  entries.sort((a, b) => (Date.parse(b.at || '') || 0) - (Date.parse(a.at || '') || 0));
  const latest = entries.slice(0, 5);
  if (!latest.length) {
    container.innerHTML = '<div class="overview-activity-empty"><span aria-hidden="true">◷</span><strong>No activity recorded yet</strong><p>Request status changes will appear here.</p></div>';
    return;
  }
  container.innerHTML = latest.map(item => {
    const request = item.request;
    const detail = clean(item.event?.note) || clean(request.title) || clean(request.vendorName) || (item.fallback ? 'Current request status' : 'Workflow status updated');
    const by = clean(item.event?.by);
    return `<article class="overview-activity-item"><span class="overview-activity-dot ${overviewActivityClass(item.label)}" aria-hidden="true"></span><div class="overview-activity-copy"><div class="overview-activity-topline"><strong>${htmlEscape(request.requestId || 'PO Request')}</strong><span class="overview-activity-status ${overviewActivityClass(item.label)}">${htmlEscape(item.label)}</span></div><p title="${attrEscape(detail)}">${htmlEscape(detail)}</p><small>${htmlEscape(dateTimeLabel(item.at))}${by ? ` · ${htmlEscape(by)}` : ''}</small></div></article>`;
  }).join('');
}
function renderOverview() {
  const requests = [...state.requests].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const actionQueue = requests.filter(isAwaitingPoTeamAction).sort((a, b) => String(a.createdAt || a.requestDate || '').localeCompare(String(b.createdAt || b.requestDate || '')));
  const actionCount = actionQueue.length;
  const pending = requests.filter(r => !isAwaitingPoTeamAction(r) && (['Under Review', 'Clarification Required'].includes(r.status) || (r.status === 'Submitted' && !isInitialPortalSubmission(r)))).length;
  const submittedPpPlus = requests.filter(r => statusDisplayLabel(r.status, r) === 'Submitted on PP+').length;
  $('#metric-total').textContent = String(requests.length);
  $('#metric-action').textContent = String(actionCount);
  $('#metric-pending').textContent = String(pending);
  $('#metric-ppplus').textContent = String(submittedPpPlus);
  $('#metric-created').textContent = String(requests.filter(r => r.status === 'PO Created').length);
  const headline = $('#overview-action-headline');
  const actionCopy = $('#overview-action-copy');
  const actionBanner = $('#overview-action-banner');
  if (headline) headline.textContent = actionCount ? `${actionCount} request${actionCount === 1 ? ' needs' : 's need'} your action` : "You're all caught up";
  if (actionCopy) actionCopy.textContent = actionCount ? 'These requests are waiting for the PO Team to submit them on PP+.' : "No requests are waiting for the PO Team's first action.";
  if (actionBanner) actionBanner.classList.toggle('is-clear', actionCount === 0);
  const queueButton = $('#overview-review-queue-button');
  if (queueButton) {
    queueButton.dataset.filterStatus = actionCount ? INITIAL_SUBMISSION_DISPLAY_LABEL : 'All statuses';
    queueButton.innerHTML = `${actionCount ? 'Review action queue' : 'View all requests'} <span aria-hidden="true">→</span>`;
  }
  const queueCount = $('#overview-action-queue-count');
  if (queueCount) queueCount.textContent = `${actionCount} waiting`;
  const queueBody = $('#overview-action-queue-body');
  if (queueBody) queueBody.innerHTML = actionQueue.map(request => `<tr><td><button class="request-id inline-request-link" data-open-request="${attrEscape(request.requestId)}">${htmlEscape(request.requestId)}</button><div class="overview-queue-title" title="${attrEscape(request.title || '')}">${htmlEscape(request.title || 'Untitled request')}</div></td><td><div class="overview-queue-vendor">${htmlEscape(request.vendorName || '—')}</div><div class="secondary-cell">${htmlEscape(request.vendorNumber || '')}</div></td><td>${htmlEscape(request.region || '—')}</td><td>${htmlEscape(dateLabel(request.requestDate || request.createdAt))}</td><td class="value-cell">${htmlEscape(money(requestTotal(request), request.currency || 'USD'))}</td><td><button class="overview-review-button" type="button" data-open-request="${attrEscape(request.requestId)}">Review <span aria-hidden="true">→</span></button></td></tr>`).join('');
  const queueWrap = $('#overview-action-queue-table-wrap');
  const emptyQueue = $('#overview-action-empty');
  if (queueWrap) queueWrap.style.display = actionCount ? '' : 'none';
  if (emptyQueue) emptyQueue.classList.toggle('show', actionCount === 0);
  const byCurrency = requests.reduce((map, r) => {
    const currency = clean(r.currency) || 'USD';
    map[currency] = (map[currency] || 0) + requestTotal(r);
    return map;
  }, {});
  const currencies = Object.keys(byCurrency);
  const metricValue = !requests.length ? '0.00' : currencies.length === 1 ? money(byCurrency[currencies[0]], currencies[0]) : `${currencies.length} currencies`;
  $('#metric-value').textContent = metricValue;
  $('#metric-value').title = currencies.length > 1 ? currencies.map(c => money(byCurrency[c], c)).join(' · ') : '';
  const navCount = $('#nav-request-count');
  if (navCount) {
    navCount.textContent = String(actionCount);
    navCount.title = `${actionCount} request${actionCount === 1 ? '' : 's'} awaiting PO Team action`;
    navCount.setAttribute('aria-label', `${actionCount} requests awaiting PO Team action`);
    navCount.classList.toggle('nav-count-zero', actionCount === 0);
  }
  renderStatusSummary($('#status-summary'), requests, false);
  renderOverviewActivity(requests);
}
function renderStatusSummary(container, requests, reportMode = false) {
  if (!requests.length) {
    container.innerHTML = `<div class="empty-status">No status activity yet. Your saved requests will be summarized here.</div>`;
    return;
  }
  const preferredStatusOrder = [INITIAL_SUBMISSION_DISPLAY_LABEL, 'Submitted on PP+', 'Pending for Approval', 'Clarification Required', 'Rejected', 'PO Created', 'Draft'];
  const labels = preferredStatusOrder.filter(label => label === INITIAL_SUBMISSION_DISPLAY_LABEL
    ? (reportMode || requests.some(request => statusDisplayLabel(request.status, request) === label))
    : STATUS_LIST.some(status => statusDisplayLabel(status) === label));
  const colorForLabel = label => {
    if (label === INITIAL_SUBMISSION_DISPLAY_LABEL) return STATUS_META.Submitted.color;
    if (label === 'Pending for Approval') return STATUS_META['Under Review'].color;
    if (label === 'Submitted on PP+') return STATUS_META['Request Submitted on PP+'].color;
    const source = STATUS_LIST.find(status => statusDisplayLabel(status) === label);
    return STATUS_META[source || 'Draft'].color;
  };
  const counts = labels.map(label => ({
    status: label,
    count: requests.filter(r => statusDisplayLabel(r.status, r) === label).length,
    color: colorForLabel(label),
  })).filter(item => item.count > 0 || reportMode);
  const max = Math.max(1, ...counts.map(item => item.count));
  if (reportMode) {
    container.innerHTML = counts.map(item => `<div class="report-status-item"><span class="status-square" style="background:${item.color}"></span><div><strong>${item.count}</strong><span>${htmlEscape(item.status)}</span></div></div>`).join('');
  } else {
    container.innerHTML = counts.map(item => `<div class="status-summary-row"><span>${htmlEscape(item.status)}</span><div class="status-track"><div class="status-fill" style="background:${item.color};width:${Math.round(item.count / max * 100)}%"></div></div><b class="status-count">${item.count}</b></div>`).join('');
  }
}
function filteredRequests() {
  const search = state.requestSearch.trim().toLowerCase();
  const vendorNumber = state.requestVendorNumber.trim().toLowerCase();
  const requestor = state.requestorFilter.trim().toLowerCase();
  const poFilter = state.requestPoFilter.trim().toLowerCase();
  const oroFilter = state.requestOroFilter.trim().toLowerCase();
  const dateFrom = state.requestDateFrom;
  const dateTo = state.requestDateTo;
  const rows = state.requests.filter(r => {
    const displayedStatus = statusDisplayLabel(r.status, r);
    const statusOk = state.requestStatus === 'All statuses' || !state.requestStatus ||
      (state.requestStatus === 'Pending' ? displayedStatus === 'Pending for Approval' : displayedStatus === state.requestStatus || r.status === state.requestStatus);
    const regionOk = !state.requestRegion || r.region === state.requestRegion;
    const haystack = [r.requestId, r.title, r.vendorName, r.vendorNumber, r.vendorEmail, r.requestorName, r.requestorEmail, r.region, r.plantCode, r.plantName, r.status, r.poNumber, r.oroNumber, r.wbsNumber, r.costCenter].join(' ').toLowerCase();
    const vendorNumberOk = !vendorNumber || [r.vendorNumber, r.vendorName].join(' ').toLowerCase().includes(vendorNumber);
    const requestorOk = !requestor || [r.requestorName, r.requestorEmail].join(' ').toLowerCase().includes(requestor);
    const poOk = !poFilter || String(r.poNumber || '').toLowerCase().includes(poFilter);
    const oroOk = !oroFilter || String(r.oroNumber || '').toLowerCase().includes(oroFilter);
    const reqDate = String(r.requestDate || r.createdAt || '').slice(0, 10);
    const fromOk = !dateFrom || reqDate >= dateFrom;
    const toOk = !dateTo || reqDate <= dateTo;
    return statusOk && regionOk && vendorNumberOk && requestorOk && poOk && oroOk && fromOk && toOk && (!search || haystack.includes(search));
  });
  const key = value => String(value || '').toLowerCase();
  rows.sort((a, b) => {
    if (state.requestSort === 'date-desc') return String(b.requestDate || b.createdAt || '').localeCompare(String(a.requestDate || a.createdAt || ''));
    if (state.requestSort === 'date-asc') return String(a.requestDate || a.createdAt || '').localeCompare(String(b.requestDate || b.createdAt || ''));
    if (state.requestSort === 'value-desc') return requestTotal(b) - requestTotal(a);
    if (state.requestSort === 'requestor-asc') return key(a.requestorName).localeCompare(key(b.requestorName));
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  return rows;
}
function reviewerRequestRow(request, index) {
  const id = request.requestId || '';
  const checkedRow = state.reviewerSelectedRows.includes(id) ? 'checked' : '';
  const active = state.reviewerSelectedId === id ? ' reviewer-row-selected' : '';
  const status = statusDisplayLabel(request.status, request);
  return `<tr class="reviewer-request-row${active}" data-reviewer-row="${attrEscape(id)}">
    <td class="reviewer-check-col"><input type="checkbox" data-reviewer-row-check="${attrEscape(id)}" aria-label="Select ${attrEscape(id)}" ${checkedRow} /></td>
    <td class="reviewer-row-number">${index + 1}</td>
    <td><button type="button" class="reviewer-request-id" data-review-select="${attrEscape(id)}">${htmlEscape(id)}</button></td>
    <td><strong class="reviewer-table-title" title="${attrEscape(request.title || '')}">${htmlEscape(request.title || 'Untitled request')}</strong></td>
    <td><div class="reviewer-vendor-name">${htmlEscape(request.vendorName || '—')}</div><small class="reviewer-subcell">${htmlEscape(request.vendorNumber || '')}</small></td>
    <td>${htmlEscape(request.region || '—')}</td>
    <td>${statusPill(request.status, status)}</td>
    <td>${htmlEscape(request.oroNumber || '—')}</td>
    <td>${htmlEscape(request.poNumber || '—')}</td>
    <td>${htmlEscape(dateLabel(request.requestDate || request.createdAt))}</td>
    <td>${htmlEscape(dateLabel(request.updatedAt || request.requestDate || request.createdAt))}</td>
    <td>${htmlEscape(request.lastUpdatedBy || 'Not assigned')}</td>
    <td><div class="reviewer-row-actions"><button type="button" class="button button-secondary button-small" data-review-select="${attrEscape(id)}" data-review-mode="view">View</button><button type="button" class="button button-secondary button-small reviewer-update-button" data-review-select="${attrEscape(id)}" data-review-mode="update">Update</button><button type="button" class="button button-danger button-small reviewer-delete-button" data-review-delete="${attrEscape(id)}" aria-label="Delete ${attrEscape(id)}">Delete</button></div></td>
  </tr>`;
}
async function deleteReviewerRequest(id) {
  if (!state.reviewerMode || !state.reviewerKey) return notify('Reviewer access required', 'Unlock the Reviewer Console first.', 'error');
  const request = (state.requests || []).find(item => item.requestId === id);
  if (!request) return notify('Request not found', 'Refresh the register and try again.', 'error');
  const summary = `${id} — ${request.title || 'Untitled request'}${request.requestorName ? `\nRequestor: ${request.requestorName}` : ''}`;
  if (!window.confirm(`Delete this PO request permanently?\n\n${summary}\n\nThis removes it from the register, reports and the requester's tracking. This cannot be undone.`)) return;
  try {
    const result = await api(`/api/requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.reviewerSelectedRows = (state.reviewerSelectedRows || []).filter(item => item !== id);
    if (state.reviewerSelectedId === id) state.reviewerSelectedId = '';
    if (state.currentDetailId === id) closeModal();
    await reloadRequests();
    notify('Request deleted', result.message || `${id} was deleted.`);
  } catch (error) {
    notify('Could not delete request', error.message, 'error');
    if (error.status === 404) { try { await reloadRequests(); } catch (e) { /* ignore */ } }
  }
}
function renderReviewerMetrics() {
  const requests = state.requests || [];
  const count = (predicate) => requests.filter(predicate).length;
  const set = (id, value) => { const node = $(`#${id}`); if (node) node.textContent = String(value); };
  set('reviewer-kpi-ppplus', count(r => ['Request Submitted on PP+', 'Approved'].includes(r.status)));
  set('reviewer-kpi-pending', count(r => ['Submitted', 'Under Review'].includes(r.status)));
  set('reviewer-kpi-clarification', count(r => r.status === 'Clarification Required'));
  set('reviewer-kpi-created', count(r => r.status === 'PO Created'));
  set('reviewer-kpi-rejected', count(r => r.status === 'Rejected'));
}
function reviewerField(label, value, icon = '•') {
  return `<div class="reviewer-info-row"><span class="reviewer-info-icon" aria-hidden="true">${icon}</span><span class="reviewer-info-label">${htmlEscape(label)}</span><strong>${htmlEscape(value || '—')}</strong></div>`;
}
function reviewerPanelTabContent(request) {
  const tab = state.reviewerPanelTab || 'overview';
  const lines = Array.isArray(request.lineItems) ? request.lineItems : [];
  if (tab === 'lines') {
    return `<div class="reviewer-tab-table-wrap"><table class="reviewer-tab-table"><thead><tr><th>#</th><th>Type</th><th>GL / WBS</th><th>Description</th><th>Qty</th><th>Total</th></tr></thead><tbody>${lines.map((line, i) => `<tr><td>${i + 1}</td><td>${htmlEscape(line.type || '—')}</td><td>${htmlEscape(line.glCode || line.costCenterGlCode || line.wbsGlCode || '—')}</td><td>${htmlEscape(manualLineDescription(line) || '—')}</td><td>${htmlEscape(line.quantity ?? '—')}</td><td>${htmlEscape(money(line.total ?? Number(line.quantity || 0) * Number(line.unitPrice || 0), request.currency || 'USD'))}</td></tr>`).join('') || '<tr><td colspan="6">No line items recorded.</td></tr>'}</tbody></table><div class="reviewer-panel-total"><span>Total PO value</span><strong>${htmlEscape(money(requestTotal(request), request.currency || 'USD'))}</strong></div></div>`;
  }
  if (tab === 'documents') {
    const docs = Array.isArray(request.supportingDocuments) ? request.supportingDocuments : (Array.isArray(request.attachments) ? request.attachments : []);
    return docs.length ? `<div class="reviewer-document-list">${docs.map(doc => `<div class="reviewer-document-row"><span class="reviewer-document-icon">▧</span><div><strong>${htmlEscape(doc.filename || doc.name || 'Supporting document')}</strong><small>${htmlEscape(doc.contentType || doc.type || 'Attachment')}</small></div></div>`).join('')}</div>` : '<div class="reviewer-tab-empty">No supporting documents were attached to this request.</div>';
  }
  if (tab === 'history') {
    const history = Array.isArray(request.approvalHistory) ? [...request.approvalHistory].reverse() : [];
    return history.length ? `<div class="reviewer-history-list">${history.map(item => `<div class="reviewer-history-row"><span class="reviewer-history-dot"></span><div><strong>${htmlEscape(statusDisplayLabelForEvent(item))}</strong>${item.note ? `<p>${htmlEscape(item.note)}</p>` : ''}<small>${htmlEscape(dateTimeLabel(item.at))}${item.by ? ` · ${htmlEscape(item.by)}` : ''}</small></div></div>`).join('')}</div>` : '<div class="reviewer-tab-empty">No workflow history recorded yet.</div>';
  }
  const capex = String(request.fundingType || '').toUpperCase() === 'CAPEX';
  const account = capex ? `WBS (CAPEX) · ${request.wbsNumber || '—'}` : `Cost Center (OPEX) · ${request.costCenter || '—'}`;
  const companyCode = [request.companyCode, request.companyCodeDescription].filter(Boolean).join(' — ');
  const plant = [request.plantCode || request.deliveryAddress, request.plantName].filter(Boolean).join(' — ');
  const delivery = `${request.deliveryFrequency || '—'}${request.startDeliveryDate || request.endDeliveryDate ? ` · ${dateLabel(request.startDeliveryDate)} – ${dateLabel(request.endDeliveryDate)}` : ''}`;
  return `<div class="reviewer-info-list">
    ${reviewerField('Region', request.region, '◎')}
    ${reviewerField('Vendor', [request.vendorName, request.vendorNumber ? `(${request.vendorNumber})` : ''].filter(Boolean).join(' '), '▤')}
    ${reviewerField('Vendor email', request.vendorEmail, '✉')}
    ${reviewerField('Company code', companyCode, '▦')}
    ${reviewerField('Plant code', plant, '⌖')}
    ${reviewerField('Account assignment', account, '▧')}
    ${reviewerField('Currency', request.currency, '¤')}
    ${reviewerField('PO value', money(requestTotal(request), request.currency || 'USD'), '▣')}
    ${reviewerField('Requestor', request.requestorName, '♙')}
    ${reviewerField('Requestor email', request.requestorEmail, '✉')}
    ${reviewerField('Delivery schedule', delivery, '◷')}
    ${reviewerField('Updated by', request.lastUpdatedBy || '', '✓')}
  </div>`;
}
function renderReviewerDetailPanel() {
  const host = $('#reviewer-detail-body');
  if (!host) return;
  const request = state.requests.find(item => item.requestId === state.reviewerSelectedId);
  if (!request) {
    host.innerHTML = '<div class="reviewer-detail-empty"><span>▤</span><strong>Select a request</strong><p>Select a Request ID or use View / Update to see its details.</p></div>';
    return;
  }
  const knownReviewerNames = (state.master?.reviewerNames || ['Kirtika', 'Purushoth']).map(item => typeof item === 'string' ? item : item.name).filter(Boolean);
  const transitions = [request.status, ...possibleTransitions(request)];
  const optionMap = new Map();
  transitions.forEach(status => { const label = status === request.status ? statusDisplayLabel(status, request) : statusDisplayLabel(status); if (!optionMap.has(label)) optionMap.set(label, status); });
  const preferredStatusOrder = [INITIAL_SUBMISSION_DISPLAY_LABEL, 'Submitted on PP+', 'Pending for Approval', 'Clarification Required', 'Rejected', 'PO Created', 'Draft'];
  const statusRank = new Map(preferredStatusOrder.map((label, index) => [label, index]));
  const statusOptions = [...optionMap.entries()].sort((a, b) => (statusRank.get(a[0]) ?? 99) - (statusRank.get(b[0]) ?? 99)).map(([label, value]) => `<option value="${attrEscape(value)}" ${selected(value, request.status)}>${htmlEscape(label)}</option>`).join('');
  const tabs = [['overview','Overview'],['lines','Line items'],['documents','Documents'],['history','History']];
  host.innerHTML = `<div class="reviewer-selected-summary"><div class="reviewer-selected-symbol">▤</div><div class="reviewer-selected-copy"><strong>${htmlEscape(request.requestId)}</strong><span>${htmlEscape(request.title || 'Purchase order request')}</span><small>Created ${htmlEscape(dateTimeLabel(request.createdAt || request.requestDate))} · Updated ${htmlEscape(dateTimeLabel(request.updatedAt || request.createdAt))}</small></div><div class="reviewer-selected-actions">${statusPill(request.status, statusDisplayLabel(request.status, request))}</div></div>
    <nav class="reviewer-detail-tabs" aria-label="Request detail tabs">${tabs.map(([tab, label]) => `<button type="button" data-reviewer-panel-tab="${tab}" class="${state.reviewerPanelTab === tab ? 'active' : ''}">${label}${tab === 'lines' ? ` (${(request.lineItems || []).length})` : tab === 'documents' ? ` (${(request.supportingDocuments || request.attachments || []).length})` : tab === 'history' ? ` (${(request.approvalHistory || []).length})` : ''}</button>`).join('')}</nav>
    <div class="reviewer-detail-tab-content">${reviewerPanelTabContent(request)}</div>
    <section class="reviewer-procurement-update"><div class="reviewer-update-title"><h3>Update procurement tracking</h3><p>Changes apply to this Request ID and are recorded in the workflow history.</p></div>
      <div class="field"><label for="reviewer-panel-status">Status</label><select id="reviewer-panel-status">${statusOptions}</select></div>
      <div class="reviewer-update-fields"><div class="field"><label for="reviewer-panel-oro">ORO</label><input id="reviewer-panel-oro" maxlength="160" value="${attrEscape(request.oroNumber || '')}" placeholder="Enter ORO reference" /></div><div class="field"><label for="reviewer-panel-po">PO Number</label><input id="reviewer-panel-po" maxlength="160" value="${attrEscape(request.poNumber || '')}" placeholder="Enter PO number" /></div></div>
      <div class="field"><label for="reviewer-panel-updated-by">Updated by</label><select id="reviewer-panel-updated-by"><option value="">Select reviewer name</option>${knownReviewerNames.map(name => `<option value="${attrEscape(name)}" ${selected(name, request.lastUpdatedBy)}>${htmlEscape(name)}</option>`).join('')}</select><small>Optional. Leave blank to record this as Procurement reviewer.</small></div>
      <div class="field"><label for="reviewer-panel-note">Reviewer note</label><textarea id="reviewer-panel-note" maxlength="1000" placeholder="Add a note for this status update"></textarea><small>The note is saved when you change the status.</small></div>
      <button type="button" class="button button-primary reviewer-save-changes" id="reviewer-panel-save">▣ Save changes</button>
    </section>`;
}
async function saveReviewerPanelChanges() {
  if (!state.reviewerMode || !state.reviewerKey) return notify('Reviewer access required', 'Unlock the Reviewer Console first.', 'error');
  const request = state.requests.find(item => item.requestId === state.reviewerSelectedId);
  if (!request) return notify('Select a request', 'Choose a request from the register before saving changes.', 'error');
  const status = $('#reviewer-panel-status')?.value || request.status;
  const oroNumber = $('#reviewer-panel-oro')?.value.trim() || '';
  const poNumber = $('#reviewer-panel-po')?.value.trim() || '';
  const updatedBy = $('#reviewer-panel-updated-by')?.value.trim() || '';
  const note = $('#reviewer-panel-note')?.value.trim() || '';
  try {
    if (status !== request.status) {
      const result = await api(`/api/requests/${encodeURIComponent(request.requestId)}/status`, { method: 'PUT', body: { status, oroNumber, poNumber, updatedBy, note } });
      state.reviewerSelectedId = result.request.requestId;
      notify('Status updated', `${result.request.requestId} is now ${statusDisplayLabel(result.request.status)}.`);
    } else if (oroNumber !== (request.oroNumber || '') || poNumber !== (request.poNumber || '')) {
      const result = await api(`/api/requests/${encodeURIComponent(request.requestId)}/tracking`, { method: 'PUT', body: { oroNumber, poNumber, updatedBy } });
      state.reviewerSelectedId = result.request.requestId;
      notify('Tracking details saved', `${result.request.requestId}: ORO / PO Number updated.`);
    } else {
      return notify('No changes to save', 'Change the status, ORO, or PO Number before saving.', 'error');
    }
    await reloadRequests();
  } catch (error) {
    if (error.problems?.length) notify('Request needs attention', error.problems[0], 'error');
    else notify('Could not save changes', error.message, 'error');
  }
}
function renderRequests() {
  const list = filteredRequests();
  const pageCount = Math.max(1, Math.ceil(list.length / state.requestPageSize));
  state.requestPage = Math.min(Math.max(1, state.requestPage), pageCount);
  const start = (state.requestPage - 1) * state.requestPageSize;
  const pageRows = list.slice(start, start + state.requestPageSize);
  if (!pageRows.some(row => row.requestId === state.reviewerSelectedId)) state.reviewerSelectedId = pageRows[0]?.requestId || '';
  $('#requests-body').innerHTML = pageRows.map((r, i) => reviewerRequestRow(r, start + i + 1)).join('');
  const empty = $('#requests-empty');
  if (empty) empty.classList.toggle('hidden', list.length !== 0);
  const tableWrap = $('#requests-body').closest('.table-wrap');
  if (tableWrap) tableWrap.style.display = list.length ? '' : 'none';
  $('#request-count').textContent = `${list.length} matching request${list.length === 1 ? '' : 's'}`;
  const pagination = $('#requests-pagination');
  if (pagination) {
    pagination.classList.toggle('hidden', list.length <= state.requestPageSize);
    $('#request-page-info').textContent = list.length ? `Showing ${start + 1}–${Math.min(start + state.requestPageSize, list.length)} of ${list.length}` : 'No results';
    $('#request-page-number').textContent = `Page ${state.requestPage} of ${pageCount}`;
    $('#request-prev').disabled = state.requestPage <= 1;
    $('#request-next').disabled = state.requestPage >= pageCount;
  }
  $('#request-search').value = state.requestSearch;
  $('#status-filter').value = state.requestStatus;
  $('#region-filter').value = state.requestRegion;
  if ($('#vendor-number-filter')) $('#vendor-number-filter').value = state.requestVendorNumber;
  if ($('#requestor-filter')) $('#requestor-filter').value = state.requestorFilter;
  if ($('#po-number-filter')) $('#po-number-filter').value = state.requestPoFilter;
  if ($('#oro-number-filter')) $('#oro-number-filter').value = state.requestOroFilter;
  if ($('#request-date-from')) $('#request-date-from').value = state.requestDateFrom;
  if ($('#request-date-to')) $('#request-date-to').value = state.requestDateTo;
  if ($('#request-sort')) $('#request-sort').value = state.requestSort;
  if ($('#request-page-size')) $('#request-page-size').value = String(state.requestPageSize);
  const selectAll = $('#reviewer-select-all');
  if (selectAll) {
    const visibleIds = pageRows.map(row => row.requestId);
    const selectedVisible = visibleIds.filter(id => state.reviewerSelectedRows.includes(id)).length;
    selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
  }
  renderReviewerMetrics();
  renderReviewerDetailPanel();
  syncSearchableSelects();
}
const REPORT_COLUMN_DEFAULTS = ['requestId','requestDate','title','vendor','region','status','value','oro','poNumber','requestor','updated','actions'];
const REPORT_CHART_COLORS = ['#c8102e','#2787cf','#20a56f','#f59e0b','#8757d8','#ec7651'];
function reportDefaultDates() {
  const today = new Date();
  const from = new Date(today.getFullYear(), 0, 1);
  return { from: localDateInput(from), to: localDateInput(today) };
}
function reportRangeDates(preset) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const to = localDateInput(today);
  let fromDate = new Date(today);
  if (preset === '30d') fromDate.setDate(fromDate.getDate() - 29);
  else if (preset === '90d') fromDate.setDate(fromDate.getDate() - 89);
  else if (preset === '12m') { fromDate.setFullYear(fromDate.getFullYear() - 1); }
  else if (preset === 'all') {
    const available = (state.requests || []).filter(r => r && r.status !== 'Draft').map(reportDateValue).filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v)).sort();
    fromDate = available.length ? new Date(`${available[0]}T00:00:00`) : new Date(today.getFullYear(), 0, 1);
  } else fromDate = new Date(today.getFullYear(), 0, 1);
  return { from: localDateInput(fromDate), to };
}
function syncReportQuickRanges() {
  const from = $('#report-from-date')?.value || '';
  const to = $('#report-to-date')?.value || '';
  $$('.report-quick-range').forEach(button => {
    const range = reportRangeDates(button.dataset.reportRange);
    const active = from === range.from && to === range.to;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function selectReportRange(preset) {
  const range = reportRangeDates(preset);
  $('#report-from-date').value = range.from;
  $('#report-to-date').value = range.to;
  state.reportDatePreset = preset;
  applyReportFilters();
}
function initReportControls() {
  const regionSelect = $('#report-region-filter');
  if (regionSelect) {
    const current = regionSelect.value || state.reportFilters?.region || '';
    const regions = sortedUnique([...(getRegions() || []), ...(state.requests || []).map(row => row.region)]);
    regionSelect.innerHTML = '<option value="">All regions</option>' + regions.map(region => `<option value="${attrEscape(region)}">${htmlEscape(region)}</option>`).join('');
    regionSelect.value = regions.includes(current) ? current : '';
  }
  const dateDefaults = reportDefaultDates();
  if ($('#report-from-date') && !$('#report-from-date').value) $('#report-from-date').value = dateDefaults.from;
  if ($('#report-to-date') && !$('#report-to-date').value) $('#report-to-date').value = dateDefaults.to;
  if (!state.reportFilters) state.reportFilters = readReportFiltersFromControls();
  syncReportQuickRanges();
}
function readReportFiltersFromControls() {
  return {
    from: $('#report-from-date')?.value || '', to: $('#report-to-date')?.value || '',
    region: $('#report-region-filter')?.value || '', status: $('#report-status-filter')?.value || '',
    vendor: clean($('#report-vendor-filter')?.value).toLowerCase(), requestor: clean($('#report-requestor-filter')?.value).toLowerCase(),
  };
}
function reportDateValue(request) { return String(request.requestDate || request.createdAt || '').slice(0, 10); }
function reportFilteredRequests() {
  const filters = state.reportFilters || readReportFiltersFromControls();
  return (state.requests || []).filter(request => {
    if (!request || request.status === 'Draft') return false;
    const date = reportDateValue(request);
    if (filters.from && date && date < filters.from) return false;
    if (filters.to && date && date > filters.to) return false;
    if (filters.region && clean(request.region) !== filters.region) return false;
    if (filters.status && statusDisplayLabel(request.status, request) !== filters.status) return false;
    if (filters.vendor && !`${request.vendorName || ''} ${request.vendorNumber || ''}`.toLowerCase().includes(filters.vendor)) return false;
    if (filters.requestor && !`${request.requestorName || ''} ${request.requestorEmail || ''}`.toLowerCase().includes(filters.requestor)) return false;
    return true;
  });
}
function reportSortRequests(requests) {
  const key = state.reportSort || 'requestDate-desc';
  const direction = key.endsWith('-asc') ? 1 : -1;
  const field = key.replace(/-(asc|desc)$/, '');
  return [...requests].sort((a,b) => {
    let av, bv;
    if (field === 'requestDate') { av = reportDateValue(a); bv = reportDateValue(b); }
    else if (field === 'updated') { av = String(a.updatedAt || a.createdAt || ''); bv = String(b.updatedAt || b.createdAt || ''); }
    else if (field === 'value') { av = requestTotal(a); bv = requestTotal(b); }
    else if (field === 'status') { av = statusDisplayLabel(a.status, a); bv = statusDisplayLabel(b.status, b); }
    else if (field === 'vendor') { av = a.vendorName || ''; bv = b.vendorName || ''; }
    else if (field === 'requestor') { av = a.requestorName || ''; bv = b.requestorName || ''; }
    else if (field === 'region') { av = a.region || ''; bv = b.region || ''; }
    else if (field === 'title') { av = a.title || ''; bv = b.title || ''; }
    else if (field === 'oro') { av = a.oroNumber || ''; bv = b.oroNumber || ''; }
    else if (field === 'poNumber') { av = a.poNumber || ''; bv = b.poNumber || ''; }
    else { av = a.requestId || ''; bv = b.requestId || ''; }
    if (typeof av === 'number' && typeof bv === 'number') return (av-bv)*direction;
    return String(av).localeCompare(String(bv), undefined, {numeric:true,sensitivity:'base'})*direction;
  });
}
function compactReportNumber(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n/1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}
function renderReportKpis(requests) {
  const count = requests.length;
  const labelFor = request => statusDisplayLabel(request.status, request);
  // Reporting buckets follow the agreed business definitions; Pending combines approval and clarification.
  const submitted = requests.filter(request => labelFor(request) === 'Submitted on PP+').length;
  const pending = requests.filter(request => ['Pending for Approval', 'Clarification Required'].includes(labelFor(request))).length;
  const rejected = requests.filter(request => labelFor(request) === 'Rejected').length;
  const created = requests.filter(request => labelFor(request) === 'PO Created').length;
  $('#report-kpi-total').textContent = count.toLocaleString('en-US');
  $('#report-kpi-total-note').textContent = 'All matching requests';
  $('#report-kpi-submitted').textContent = submitted.toLocaleString('en-US');
  $('#report-kpi-submitted-note').textContent = 'Submitted on PP+';
  $('#report-kpi-pending').textContent = pending.toLocaleString('en-US');
  $('#report-kpi-pending-note').textContent = 'Approval or clarification';
  $('#report-kpi-rejected').textContent = rejected.toLocaleString('en-US');
  $('#report-kpi-rejected-note').textContent = 'Rejected requests';
  $('#report-kpi-created').textContent = created.toLocaleString('en-US');
  $('#report-kpi-created-note').textContent = 'PO successfully created';
}
function reportMonthlyBuckets(requests) {
  const filters = state.reportFilters || {};
  const defaults = reportDefaultDates();
  const from = new Date(`${filters.from || defaults.from}T12:00:00`);
  const to = new Date(`${filters.to || defaults.to}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return { invalid: true, months: [] };
  const months = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end && months.length < 600) {
    months.push({key:`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`, label:cursor.toLocaleDateString('en-US',{month:'short',year:'2-digit'}), count:0});
    cursor.setMonth(cursor.getMonth()+1);
  }
  const visibleMonths = months.length > 18 ? months.slice(-18) : months;
  const lookup = new Map(visibleMonths.map(m=>[m.key,m]));
  requests.forEach(request => { const date=reportDateValue(request); const row=lookup.get(date.slice(0,7)); if(row) row.count+=1; });
  return { invalid: false, months: visibleMonths, truncated: months.length > 18 };
}
function renderReportTrend(requests) {
  const node = $('#report-trend-chart'); if (!node) return;
  const result = reportMonthlyBuckets(requests);
  if (result.invalid) { node.innerHTML='<div class="report-chart-empty">Choose a valid date range to draw the trend.</div>'; return; }
  const months = result.months;
  $('#report-trend-subtitle').textContent = result.truncated ? 'Latest 18 months shown; cards and register use the full range.' : 'Monthly request volume in the selected period.';
  $('#report-trend-legend').innerHTML = '<span><i class="legend-bar"></i>No. of Requests</span>';
  if (!requests.length || !months.length) { node.innerHTML='<div class="report-chart-empty">No requests match this report range.</div>'; return; }
  const w=640,h=225,left=42,right=16,top=15,bottom=38,plotW=w-left-right,plotH=h-top-bottom;
  const maxCount=Math.max(4,...months.map(m=>m.count));
  const step=plotW/Math.max(1,months.length),barW=Math.min(34,step*.58);
  let svg='<svg class="report-trend-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Monthly request volume">';
  for(let tick=0;tick<=4;tick++){
    const y=top+plotH-(plotH*tick/4),value=Math.round(maxCount*tick/4);
    svg+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" class="report-gridline"/><text x="${left-8}" y="${y+4}" class="report-axis-label" text-anchor="end">${value}</text>`;
  }
  months.forEach((m,i)=>{
    const cx=left+step*i+step/2,bh=m.count/maxCount*plotH,y=top+plotH-bh;
    svg+=`<rect x="${cx-barW/2}" y="${y}" width="${barW}" height="${Math.max(m.count?2:0,bh)}" rx="3" class="report-trend-bar"><title>${htmlEscape(m.label)}: ${m.count} requests</title></rect>`;
    if (m.count && (months.length<=12 || i===months.length-1)) svg+=`<text x="${cx}" y="${Math.max(10,y-5)}" class="report-axis-caption" text-anchor="middle">${m.count}</text>`;
    svg+=`<text x="${cx}" y="${h-16}" class="report-month-label" text-anchor="middle">${htmlEscape(m.label)}</text>`;
  });
  svg+='</svg>'; node.innerHTML=svg;
}
const REPORT_HEATMAP_STATUSES = [
  {label:'Submitted',matches:['Submitted on PP+'],rgb:'39,132,218'},
  {label:'Pending',matches:['Pending for Approval','Clarification Required'],rgb:'239,171,24'},
  {label:'Rejected',matches:['Rejected'],rgb:'224,53,67'},
  {label:'PO Created',matches:['PO Created'],rgb:'31,166,105'},
];
function renderReportHeatmap(requests) {
  const node=$('#report-heatmap-chart'); if(!node) return;
  $('#report-heatmap-subtitle').textContent='Request counts by region and reporting status.';
  if(!requests.length){node.innerHTML='<div class="report-chart-empty">No requests match these report filters.</div>';$('#report-heatmap-footnote').textContent='No matching request data for this selection.';return;}
  const regionNames=sortedUnique(requests.map(r=>clean(r.region)||'Unspecified'));
  const matrix=regionNames.map(region=>{
    const rows=requests.filter(r=>(clean(r.region)||'Unspecified')===region);
    const counts=REPORT_HEATMAP_STATUSES.map(status=>rows.filter(r=>status.matches.includes(statusDisplayLabel(r.status, r))).length);
    return {region,counts,total:rows.length};
  });
  const maximum=Math.max(1,...matrix.flatMap(row=>row.counts));
  const head=REPORT_HEATMAP_STATUSES.map(s=>`<th scope="col">${htmlEscape(s.label)}</th>`).join('');
  const body=matrix.map(row=>`<tr><th scope="row">${htmlEscape(row.region)}</th>${row.counts.map((count,i)=>{
    const status=REPORT_HEATMAP_STATUSES[i],alpha=count?Math.min(.82,.16+(count/maximum)*.52):.045;
    const color=count>0&&alpha>.48?'#fff':'#31455c';
    return `<td><span class="report-heatmap-cell" style="background:rgba(${status.rgb},${alpha.toFixed(3)});color:${color}" title="${attrEscape(row.region)} · ${attrEscape(status.label)}: ${count}" aria-label="${attrEscape(row.region)}, ${attrEscape(status.label)}: ${count}">${count}</span></td>`;
  }).join('')}<td><span class="report-heatmap-total" title="${attrEscape(row.region)} · Total matching requests: ${row.total}">${row.total}</span></td></tr>`).join('');
  node.innerHTML=`<div class="report-heatmap-scroll"><table class="report-heatmap-table" aria-label="Region and status request count heatmap"><thead><tr><th scope="col">Region</th>${head}<th scope="col">Total</th></tr></thead><tbody>${body}</tbody></table></div>`;
  $('#report-heatmap-footnote').textContent=`${requests.length.toLocaleString('en-US')} matching requests across ${regionNames.length} region${regionNames.length===1?'':'s'}. Pending includes approval and clarification; Submitted counts PP+ only. Total includes every status.`;
}
function renderReportRegionVolume(requests) {
  const node=$('#report-volume-chart'); if(!node) return;
  const counts=new Map();
  requests.forEach(r=>{const region=clean(r.region)||'Unspecified';counts.set(region,(counts.get(region)||0)+1);});
  const entries=[...counts.entries()].map(([region,count])=>({region,count})).sort((a,b)=>b.count-a.count||a.region.localeCompare(b.region)).slice(0,8);
  $('#report-volume-subtitle').textContent='Requests by region in the selected period.';
  if(!entries.length){node.innerHTML='<div class="report-chart-empty">No regional requests to show.</div>';return;}
  const max=Math.max(1,...entries.map(e=>e.count));
  node.innerHTML=entries.map(item=>{
    const width=item.count?Math.max(3,Math.round(item.count/max*100)):0;
    return `<div class="report-region-row report-volume-row"><div class="report-region-meta"><span><strong>${htmlEscape(item.region)}</strong></span><strong class="report-region-value">${item.count.toLocaleString('en-US')}</strong></div><div class="report-region-track"><i style="width:${width}%"></i></div></div>`;
  }).join('');
}
function renderReportPendingAge(requests) {
  const node=$('#report-age-chart'); if(!node) return;
  const open=requests.filter(r=>[INITIAL_SUBMISSION_LABEL,'Submitted on PP+','Pending for Approval','Clarification Required'].includes(statusDisplayLabel(r.status, r)));
  const today=new Date();today.setHours(0,0,0,0);
  const buckets=[
    {label:'0–2 days',min:0,max:2,color:'#20a56f',count:0},
    {label:'3–5 days',min:3,max:5,color:'#f1b323',count:0},
    {label:'6–10 days',min:6,max:10,color:'#f28a2e',count:0},
    {label:'11+ days',min:11,max:Infinity,color:'#e31837',count:0},
  ];
  let dated=0;
  open.forEach(r=>{
    const value=reportDateValue(r);if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
    const date=new Date(`${value}T00:00:00`);if(Number.isNaN(date.getTime()))return;
    const age=Math.max(0,Math.floor((today-date)/86400000));const bucket=buckets.find(b=>age>=b.min&&age<=b.max);if(bucket){bucket.count++;dated++;}
  });
  $('#report-age-subtitle').textContent=`${dated.toLocaleString('en-US')} open request${dated===1?'':'s'} grouped by age.`;
  if(!dated){node.innerHTML='<div class="report-chart-empty">No open requests in the selected period.</div>';return;}
  const max=Math.max(1,...buckets.map(b=>b.count));
  node.innerHTML=buckets.map(b=>`<div class="report-age-row"><span class="report-age-label">${b.label}</span><div class="report-age-track"><i style="width:${b.count?Math.max(3,Math.round(b.count/max*100)):0}%;background:${b.color}"></i></div><strong>${b.count}</strong></div>`).join('');
}
function reportTableRow(r, n) {
  const fields={
    requestId:`<button type="button" class="report-request-link" data-report-open="${attrEscape(r.requestId)}">${htmlEscape(r.requestId||'—')}</button>`,
    requestDate:htmlEscape(dateLabel(reportDateValue(r))), title:htmlEscape(r.title||'—'),
    vendor:`<span>${htmlEscape(r.vendorName||'—')}</span><small>${htmlEscape(r.vendorNumber||'')}</small>`, region:htmlEscape(r.region||'—'),
    status:statusPill(r.status, r.statusLabel || statusDisplayLabel(r.status, r)), value:`<span class="report-value-cell">${htmlEscape(money(requestTotal(r),r.currency||'USD'))}</span>`,
    oro:htmlEscape(r.oroNumber||'—'), poNumber:htmlEscape(r.poNumber||'—'), requestor:htmlEscape(r.requestorName||'—'),
    updated:htmlEscape(dateLabel(r.updatedAt||r.requestDate||r.createdAt)), actions:`<button type="button" class="report-view-button" data-report-open="${attrEscape(r.requestId)}" aria-label="View ${attrEscape(r.requestId)}">◉ <span>View</span></button>`
  };
  return `<tr>${REPORT_COLUMN_DEFAULTS.map(key=>`<td data-col="${key}">${fields[key]||''}</td>`).join('')}</tr>`;
}
function syncReportColumnVisibility() {
  $$('#report-columns-menu [data-report-column]').forEach(input=>{
    const key=input.dataset.reportColumn; const hidden=!input.checked;
    $$(`#report-register-table [data-col="${key}"]`).forEach(cell=>cell.classList.toggle('report-column-hidden',hidden));
  });
}
function renderReportRegister(requests) {
  const sorted=reportSortRequests(requests);
  const pages=Math.max(1,Math.ceil(sorted.length/state.reportPageSize));
  state.reportPage=Math.min(Math.max(1,state.reportPage),pages);
  const start=(state.reportPage-1)*state.reportPageSize;
  const rows=sorted.slice(start,start+state.reportPageSize);
  $('#report-register-body').innerHTML=rows.map((r,i)=>reportTableRow(r,start+i+1)).join('');
  $('#report-register-count').textContent=`${requests.length.toLocaleString('en-US')} request${requests.length===1?'':'s'}`;
  $('#report-register-empty').classList.toggle('hidden',requests.length>0);
  $('#report-register-table').classList.toggle('hidden',requests.length===0);
  $('#report-page-info').textContent=requests.length?`Showing ${start+1}–${Math.min(start+state.reportPageSize,requests.length)} of ${requests.length}`:'Showing 0 requests';
  $('#report-page-current').textContent=String(state.reportPage);
  $('#report-page-prev').disabled=state.reportPage<=1;
  $('#report-page-next').disabled=state.reportPage>=pages;
  $('#report-page-size').value=String(state.reportPageSize);
  syncReportColumnVisibility();
}
function renderReports() {
  initReportControls();
  const requests=reportFilteredRequests();
  renderReportKpis(requests);
  renderReportTrend(requests);
  renderReportHeatmap(requests);
  renderReportRegionVolume(requests);
  renderReportPendingAge(requests);
  renderReportRegister(requests);
  syncReportQuickRanges();
  const filters=state.reportFilters||{};
  const filterParts=[];
  if(filters.region) filterParts.push(filters.region);
  if(filters.status) filterParts.push(filters.status);
  if(filters.vendor) filterParts.push(`vendor: ${filters.vendor}`);
  if(filters.requestor) filterParts.push(`requestor: ${filters.requestor}`);
  $('#report-filter-feedback').textContent=`${requests.length.toLocaleString('en-US')} matching request${requests.length===1?'':'s'}${filterParts.length?' · '+filterParts.join(' · '):''}. Data comes from saved requests.`;
  const reportMasterCount = $('#report-master-count');
  if (reportMasterCount) reportMasterCount.textContent=`${(state.master?.glAccounts.length||0)+(state.master?.plants.length||0)+(state.master?.costCenters.length||0)} records`;
}
function applyReportFilters() {
  const filters=readReportFiltersFromControls();
  if(filters.from && filters.to && filters.from>filters.to){notify('Invalid date range','The start date must be on or before the end date.','error');return;}
  state.reportFilters=filters;state.reportPage=1;renderReports();
}
function clearReportFilters() {
  const dates=reportDefaultDates();
  $('#report-from-date').value=dates.from;$('#report-to-date').value=dates.to;
  $('#report-region-filter').value='';$('#report-status-filter').value='';$('#report-vendor-filter').value='';$('#report-requestor-filter').value='';
  state.reportFilters=readReportFiltersFromControls();state.reportPage=1;state.reportSort='requestDate-desc';state.reportDatePreset='ytd';renderReports();
}
async function exportReportXlsx() {
  try {
    const filters=state.reportFilters||readReportFiltersFromControls();
    const query=new URLSearchParams();
    Object.entries({from:filters.from,to:filters.to,region:filters.region,status:filters.status,vendor:filters.vendor,requestor:filters.requestor}).forEach(([key,value])=>{if(value)query.set(key,value)});
    const response=await fetch(`/api/reports/export.xlsx?${query.toString()}`,{headers:state.reviewerKey?{'X-Reviewer-Key':state.reviewerKey}:{},cache:'no-store'});
    if(!response.ok){let data={};try{data=await response.json()}catch{}throw new Error(data.error||`Excel export failed (${response.status}).`)}
    const blob=await response.blob(), href=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=href;link.download=`po-report-${localDateInput()}.xlsx`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(href),30000);
    notify('Report exported',`${reportFilteredRequests().length} matching request row(s) were included in the Excel workbook.`);
  } catch(error){notify('Could not export report',error.message,'error')}
}
function printReportSummary() {
  state.printReportOriginalPageSize = state.reportPageSize;
  state.printReportOriginalPage = state.reportPage;
  state.reportPageSize = Math.max(10, reportFilteredRequests().length || 10);
  state.reportPage = 1;
  renderReports();
  document.body.classList.add('print-reports-only');
  window.setTimeout(()=>window.print(),80);
}
function restoreAfterReportPrint() {
  document.body.classList.remove('print-reports-only');
  if (state.printReportOriginalPageSize) state.reportPageSize = state.printReportOriginalPageSize;
  if (state.printReportOriginalPage) state.reportPage = state.printReportOriginalPage;
  state.printReportOriginalPageSize = 0; state.printReportOriginalPage = 0;
  if (state.currentView === 'reports') renderReports();
}

function masterColumns() {
  const columns = {
    gl: [['accountType','ACCOUNT TYPE'],['glNumber','GL NUMBER'],['goodOrService','GOOD / SERVICE'],['name','GL ACCOUNT NAME'],['usedFor','USAGE GUIDANCE'],['comment','REFERENCE']],
    costCenters: [['region','REGION'],['city','CITY / COST CENTER'],['p08CostCenter','P08 CC'],['s4CostCenter','S4 CC']],
    plants: [['region','REGION'],['plant','PLANT CODE'],['plantName','PLANT NAME / DESCRIPTION'],['postalCode','POSTAL CODE'],['city','CITY'],['name2','ADDITIONAL NAME']],
    companyCodes: [['companyCode','COMPANY CODE'],['region','REGION'],['description','DESCRIPTION'],['country','COUNTRY'],['ou','OU']],
    currencies: [['code','CURRENCY CODE'],['name','CURRENCY NAME'],['symbol','SYMBOL']],
    regions: [['region','REGION']],
    reviewerNames: [['name','UPDATED BY NAME']],
  };
  return columns[state.masterTab] || columns.gl;
}
function masterKind() {
  return ({ gl:'glAccounts', costCenters:'costCenters', plants:'plants', companyCodes:'companyCodes', currencies:'currencies', regions:'regions', reviewerNames:'reviewerNames' })[state.masterTab] || 'glAccounts';
}
function masterRows() {
  if (!state.master) return [];
  if (state.masterTab === 'regions') return (state.master.regions || []).map(region => ({ region }));
  if (state.masterTab === 'reviewerNames') return (state.master.reviewerNames || []).map(name => ({ name }));
  return state.master[masterKind()] || [];
}
function masterSourceList() {
  if (state.masterTab === 'regions') return state.master.regions || [];
  if (state.masterTab === 'reviewerNames') return state.master.reviewerNames || [];
  return state.master?.[masterKind()] || [];
}
function masterSourceIndex(row) {
  if (state.masterTab === 'regions') return masterSourceList().indexOf(row.region);
  if (state.masterTab === 'reviewerNames') return masterSourceList().indexOf(row.name);
  return masterSourceList().indexOf(row);
}
function masterRecordAt(index) {
  const row = masterSourceList()[index];
  if (state.masterTab === 'regions') return { region: row || '' };
  if (state.masterTab === 'reviewerNames') return { name: row || '' };
  return row ? { ...row } : {};
}
function masterRequiredKeys() {
  return ({ glAccounts:['glNumber','name'], plants:['plantName'], costCenters:['region','city'], companyCodes:['companyCode','region','description'], currencies:['code','name'], regions:['region'], reviewerNames:['name'] })[masterKind()] || [];
}
function masterFieldDefinitions() {
  const definitions = {
    glAccounts: [['accountType','Account type'],['glNumber','GL number'],['goodOrService','Good / Service'],['name','GL account name'],['usedFor','Usage guidance'],['comment','Reference']],
    costCenters: [['region','Region'],['city','City / Cost Center'],['p08CostCenter','P08 CC'],['s4CostCenter','S4 CC']],
    plants: [['region','Region'],['plant','Plant code'],['plantCode','Plant code (dropdown value)'],['plantName','Plant name'],['postalCode','Postal code'],['city','City'],['name2','Additional name']],
    companyCodes: [['companyCode','Company code'],['region','Region'],['description','Description'],['country','Country'],['ou','OU']],
    currencies: [['code','Currency code'],['name','Currency name'],['symbol','Currency symbol']],
    regions: [['region','Region code']],
    reviewerNames: [['name','Reviewer name']],
  };
  return definitions[masterKind()] || definitions.glAccounts;
}
function renderMasterTable() {
  if (!state.master) return;
  const columns = masterColumns();
  const search = state.masterSearch.toLowerCase();
  const source = masterRows();
  const list = source.filter(row => !search || columns.some(([key]) => String(row[key] ?? '').toLowerCase().includes(search)));
  $('#master-table-head').innerHTML = `<tr>${columns.map(([, label]) => `<th>${htmlEscape(label)}</th>`).join('')}<th class="master-actions-heading">ACTIONS</th></tr>`;
  $('#master-table-body').innerHTML = list.map(row => {
    const index = masterSourceIndex(row);
    const cells = columns.map(([key]) => {
      const value = row[key] ?? '';
      const code = ['glNumber','s4CostCenter','p08CostCenter','plant','plantCode','companyCode','purchaseOrg','code'].includes(key);
      return `<td class="${code ? 'table-code' : ''}" title="${attrEscape(value)}">${htmlEscape(value || '—')}</td>`;
    }).join('');
    return `<tr>${cells}<td class="master-actions"><button class="button button-secondary button-small" data-master-edit-index="${index}" type="button">Edit</button><button class="button button-danger button-small" data-master-remove-index="${index}" type="button">Remove</button></td></tr>`;
  }).join('');
  $('#master-result-count').textContent = `${list.length} row${list.length === 1 ? '' : 's'}`;
  const addButton = $('#master-add-record');
  if (addButton) addButton.textContent = `＋ Add ${({gl:'GL account',costCenters:'cost center',plants:'plant code',companyCodes:'company code',currencies:'currency',regions:'region',reviewerNames:'reviewer name'})[state.masterTab] || 'record'}`;
}
function openMasterEditor(index = null) {
  state.masterEditIndex = index;
  const host = $('#master-editor');
  const fields = masterFieldDefinitions();
  const row = index === null ? {} : masterRecordAt(index);
  state.masterEditOriginal = index === null ? null : JSON.parse(JSON.stringify(row));
  const title = index === null ? `Add ${masterKind() === 'reviewerNames' ? 'updated-by name' : state.masterTab === 'gl' ? 'GL account' : state.masterTab === 'costCenters' ? 'cost center' : state.masterTab === 'plants' ? 'plant code' : state.masterTab === 'companyCodes' ? 'company code' : state.masterTab === 'currencies' ? 'currency' : 'region'}` : `Edit master data record`;
  host.innerHTML = `<form id="master-entry-form" class="master-editor-form"><div class="master-editor-title"><div><strong>${htmlEscape(title)}</strong><small>Changes are saved to the server master-data files and used by searchable dropdowns.</small></div><button type="button" class="icon-button" data-master-cancel aria-label="Close editor">×</button></div><div class="master-editor-grid">${fields.map(([key,label]) => `<div class="field"><label for="master-field-${key}">${htmlEscape(label)}${masterRequiredKeys().includes(key) ? ' *' : ''}</label><input id="master-field-${key}" name="${attrEscape(key)}" maxlength="500" value="${attrEscape(row[key] || '')}" placeholder="Enter ${attrEscape(label.toLowerCase())}" ${masterRequiredKeys().includes(key) ? 'required' : ''}></div>`).join('')}</div><div class="master-editor-actions"><button type="button" class="button button-secondary" data-master-cancel>Cancel</button><button type="submit" class="button button-primary">Save master data</button></div></form>`;
  host.classList.remove('hidden');
  $('#master-entry-form').addEventListener('submit', saveMasterEntry);
  host.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
async function reloadMasterData() {
  const selected = { region: $('#region')?.value || '', companyCode: $('#company-code')?.value || '', currency: $('#currency')?.value || '', costCenter: $('#cost-center')?.value || '', plant: $('#plant-code')?.value || '' };
  state.master = await api(`/api/master-data?refresh=${Date.now()}`);
  populateHeaderLookups();
  if (selected.region) {
    ensureSelectOption($('#region'), selected.region, selected.region); $('#region').value = selected.region;
    populateCompanyCodeOptions(selected.region, true); populateCostCenters(selected.region, true);
  }
  if (selected.companyCode) ensureSelectOption($('#company-code'), selected.companyCode, selected.companyCode);
  if (selected.currency) ensureSelectOption($('#currency'), selected.currency, selected.currency);
  if (selected.costCenter) ensureSelectOption($('#cost-center'), selected.costCenter, selected.costCenter);
  if (selected.plant) ensureSelectOption($('#plant-code'), selected.plant, selected.plant);
  $('#master-gl-count').textContent = state.master.glAccounts.length;
  $('#master-plant-count').textContent = state.master.plants.length;
  $('#master-cc-count').textContent = state.master.costCenters.length;
  $('#master-region-count').textContent = getRegions().length;
  $('#tab-gl-count').textContent = state.master.glAccounts.length;
  $('#tab-cc-count').textContent = state.master.costCenters.length;
  $('#tab-plant-count').textContent = state.master.plants.length;
  renderMasterTable(); renderReports(); syncFormSummary(); renderLineItems(); syncSearchableSelects();
}
function masterOriginalValue(row) {
  if (row === null || row === undefined) return null;
  if (masterKind() === 'regions') return row.region ?? '';
  if (masterKind() === 'reviewerNames') return row.name ?? '';
  return row;
}
async function saveMasterEntry(event) {
  event.preventDefault();
  const fields = masterFieldDefinitions();
  const record = {};
  for (const [key] of fields) record[key] = $(`#master-field-${key}`).value.trim();
  try {
    const payload = { kind: masterKind(), action: state.masterEditIndex === null ? 'add' : 'update', record };
    if (state.masterEditIndex !== null) { payload.index = state.masterEditIndex; payload.original = masterOriginalValue(state.masterEditOriginal); }
    const result = await api('/api/master-data/admin', { method:'POST', body: payload });
    $('#master-editor').classList.add('hidden'); state.masterEditIndex = null;
    await reloadMasterData();
    notify('Master data saved', result.message || 'The dropdown data has been updated.');
  } catch (error) { notify('Could not save master data', error.message, 'error'); if (error.status === 409) { try { await reloadMasterData(); } catch (e) { /* ignore */ } } }
}
async function removeMasterEntry(index) {
  const item = masterRecordAt(index);
  const label = masterKind() === 'costCenters' ? ([item.city, item.s4CostCenter, item.p08CostCenter].filter(Boolean).join(' / ') || item.region || 'selected record') : (item.region || item.name || item.glNumber || item.plantCode || item.plant || item.s4CostCenter || item.p08CostCenter || item.companyCode || item.code || item.name || item.city || 'selected record');
  if (!window.confirm(`Remove ${label} from ${masterKind()}? This will update the dropdown source and cannot be undone.`)) return;
  try {
    const result = await api('/api/master-data/admin', { method:'POST', body: { kind: masterKind(), action:'remove', index, original: masterOriginalValue(item) } });
    $('#master-editor').classList.add('hidden'); state.masterEditIndex = null;
    await reloadMasterData(); notify('Master record removed', result.message || `${label} removed.`);
  } catch (error) { notify('Could not remove master data', error.message, 'error'); if (error.status === 409) { try { await reloadMasterData(); } catch (e) { /* ignore */ } } }
}
async function reloadRequests() {
  const data = await api('/api/requests');
  state.requests = data.requests || [];
  renderOverview();
  renderRequests();
  renderReports();
  return state.requests;
}
function openModal() { $('#detail-modal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal() { $('#detail-modal').classList.add('hidden'); document.body.style.overflow = ''; state.currentDetailId = ''; state.currentDetailRecord = null; }
function possibleTransitions(request) {
  // Status is a single active state; corrections are allowed and audited.
  // The reviewer never edits requester-entered PO details after submission.
  const canonicalOptions = [
    'Request Submitted on PP+',
    'Under Review',
    'Clarification Required',
    'Rejected',
    'PO Created',
  ];
  const currentLabel = statusDisplayLabel(request?.status || 'Submitted', request || null);
  return canonicalOptions.filter(value => statusDisplayLabel(value) !== currentLabel);
}
function renderDetail(request) {
  state.currentDetailRecord = request;
  $('#detail-title').textContent = `${request.requestId} · ${request.title || 'Untitled request'}`;
  $('#detail-subtitle').innerHTML = state.reviewerMode ? `${statusPill(request.status, request.statusLabel || statusDisplayLabel(request.status, request))} <span style="margin-left:8px">Updated ${htmlEscape(dateTimeLabel(request.updatedAt))}</span>` : 'Request details';
  const center = findCenter(request.costCenter);
  const plant = findPlant(request.plantCode || '');
  const plantDetails = request.plantName || (plant ? plantDisplayLabel(plant).replace(`${request.plantCode} — `, '') : '');
  const plantInfo = request.plantCode ? `${request.plantCode}${plantDetails ? ` — ${plantDetails}` : ''}` : (request.deliveryAddress || '—');
  const accountTitle = request.fundingType === 'CAPEX' ? `WBS: ${request.wbsNumber || '—'}` : `Cost center: ${request.costCenter || '—'}`;
  const lines = request.lineItems || [];
  $('#detail-content').innerHTML = `
    <div class="detail-overview-strip">
      <div class="detail-summary-box"><span>Request date</span><strong>${htmlEscape(dateLabel(request.requestDate || request.createdAt))}</strong></div>
      <div class="detail-summary-box"><span>Region</span><strong>${htmlEscape(request.region || '—')}</strong></div>
      <div class="detail-summary-box"><span>Line items</span><strong>${lines.length}</strong></div>
      <div class="detail-summary-box"><span>PO value</span><strong>${htmlEscape(money(requestTotal(request), request.currency || 'USD'))}</strong></div>
    </div>
    <section class="detail-block"><h3>Vendor & requestor</h3><div class="detail-info-grid">
      <div class="detail-info"><span>Vendor / company</span><strong>${htmlEscape(request.vendorName || '—')}</strong></div>
      <div class="detail-info"><span>Vendor number</span><strong>${htmlEscape(request.vendorNumber || '—')}</strong></div>
      <div class="detail-info"><span>Vendor email</span><strong>${htmlEscape(request.vendorEmail || '—')}</strong></div>
      <div class="detail-info"><span>Company Code</span><strong>${htmlEscape(request.companyCode ? `${request.companyCode}${request.companyCodeDescription ? ` — ${request.companyCodeDescription}` : ''}` : '—')}</strong></div>
      <div class="detail-info"><span>Requestor</span><strong>${htmlEscape(request.requestorName || '—')}</strong></div>
      <div class="detail-info"><span>Requestor email</span><strong>${htmlEscape(request.requestorEmail || '—')}</strong></div>
      <div class="detail-info"><span>Account assignment</span><strong>${htmlEscape(accountTitle)}</strong></div>
      <div class="detail-info"><span>Plant Code</span><strong>${htmlEscape(plantInfo)}</strong></div>
      ${request.fundingType !== 'CAPEX' ? `<div class="detail-info"><span>Cost center reference</span><strong>${htmlEscape(center ? ([center.city, center.country, center.currency].filter(Boolean).join(' · ') || request.costCenter || '—') : (request.costCenter || '—'))}</strong></div>` : ''}
      <div class="detail-info"><span>Delivery frequency</span><strong>${htmlEscape(request.deliveryFrequency || '—')}${request.deliveryCount ? ` · ${request.deliveryCount} times` : ''}</strong></div>
      <div class="detail-info"><span>Start delivery</span><strong>${htmlEscape(dateLabel(request.startDeliveryDate))}</strong></div>
      <div class="detail-info"><span>End delivery</span><strong>${htmlEscape(dateLabel(request.endDeliveryDate))}</strong></div>
      <div class="detail-info"><span>Currency</span><strong>${htmlEscape(request.currency || '—')}</strong></div>
    ${state.reviewerMode ? `<div class="detail-info"><span>ORO</span><strong>${htmlEscape(request.oroNumber || '—')}</strong></div><div class="detail-info"><span>PO Number</span><strong>${htmlEscape(request.poNumber || '—')}</strong></div><div class="detail-info"><span>Last updated by</span><strong>${htmlEscape(request.lastUpdatedBy || '—')}</strong></div>` : ''}
    </div></section>
    <section class="detail-block"><h3>Line items</h3><div class="table-wrap"><table class="detail-lines"><thead><tr><th>TYPE</th><th>GL CODE</th><th>DESCRIPTION</th><th>QTY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead><tbody>${lines.map(line => `<tr><td>${htmlEscape(line.type || '—')}</td><td>${htmlEscape(line.glCode || '—')}${line.glDescription ? `<div style="color:#98a6aa;margin-top:2px">${htmlEscape(line.glDescription)}</div>` : ''}</td><td>${htmlEscape(manualLineDescription(line) || '—')}</td><td>${htmlEscape(line.quantity ?? '—')}</td><td>${htmlEscape(money(line.unitPrice || 0, request.currency || 'USD'))}</td><td>${htmlEscape(money(line.total ?? (Number(line.quantity || 0) * Number(line.unitPrice || 0)), request.currency || 'USD'))}</td></tr>`).join('')}</tbody></table></div><div class="detail-total"><span>PO VALUE</span><strong>${htmlEscape(money(requestTotal(request), request.currency || 'USD'))}</strong></div></section>
    ${request.requesterNotes ? `<section class="detail-block"><h3>Request notes</h3><p style="font-size:10px;color:#677d83;white-space:pre-wrap;margin:0">${htmlEscape(request.requesterNotes)}</p></section>` : ''}
    ${state.reviewerMode ? `<section class="detail-block"><h3>Procurement tracking</h3><div class="form-grid three-col reviewer-tracking-grid"><div class="field"><label for="detail-oro-number">ORO</label><input id="detail-oro-number" maxlength="160" value="${attrEscape(request.oroNumber || '')}" placeholder="Enter ORO reference" /></div><div class="field"><label for="detail-po-number">PO Number</label><input id="detail-po-number" maxlength="160" value="${attrEscape(request.poNumber || '')}" placeholder="Enter created PO number" /></div><div class="field"><label for="detail-updated-by">Updated by</label><select id="detail-updated-by" class="searchable-native" data-placeholder="Select reviewer name"><option value="">Select reviewer name</option>${(state.master?.reviewerNames || ['Kirtika','Purushoth']).map(name => `<option value="${attrEscape(name)}">${htmlEscape(name)}</option>`).join('')}</select><small>Optional. Leave blank to use the generic reviewer attribution.</small></div></div><button class="button button-secondary button-small" data-detail-action="save-tracking">Save ORO / PO Number</button></section><section class="detail-block"><h3>Workflow history</h3><div class="history-list">${(request.approvalHistory || []).slice().reverse().map(event => `<div class="history-item"><span class="history-dot"></span><div class="history-copy"><strong>${htmlEscape(statusDisplayLabelForEvent(event))}${event.note ? ` · ${htmlEscape(event.note)}` : ''}</strong><span>${htmlEscape(dateTimeLabel(event.at))}${event.by ? ` · ${htmlEscape(event.by)}` : ''}</span></div></div>`).join('') || '<div class="history-copy"><span>No history recorded.</span></div>'}</div></section>${possibleTransitions(request).length ? `<section class="detail-block"><h3>Reviewer note</h3><textarea class="detail-note" id="detail-note" maxlength="1000" placeholder="Optional comment to record with the status update"></textarea></section>` : ''}` : ''}
  `;
  enhanceSearchableSelects($('#detail-content'));
  const transitions = state.reviewerMode ? possibleTransitions(request) : [];
  const statusButtons = transitions.map(status => {
    const color = status === 'Request Submitted on PP+' || status === 'PO Created' ? 'button-primary' : status === 'Rejected' ? 'button-danger' : 'button-secondary';
    return `<button class="button ${color}" data-set-status="${attrEscape(status)}">${htmlEscape(status)}</button>`;
  }).join('');
  let left = `<div class="left-actions"><button class="button button-secondary" data-detail-action="email">↗ Open Email Compose</button><button class="button button-secondary" data-detail-action="print">Print / PDF</button>`;
  left += `</div>`;
  $('#detail-actions').innerHTML = `${left}<div class="right-actions">${statusButtons}<button class="button button-secondary" data-detail-action="close">Close</button></div>`;
}
function printRequestDocument(request) {
  if (!request) { notify('No request selected', 'Open a request before printing it.', 'error'); return; }
  const printWindow = window.open('', '_blank', 'width=1000,height=850');
  if (!printWindow) { notify('Print window blocked', 'Allow pop-ups for this local portal and click Print / PDF again.', 'error'); return; }
  const lines = request.lineItems || [];
  const info = [
    ['Request date', dateLabel(request.requestDate || request.createdAt)], ['Region', request.region], ['Requestor', request.requestorName],
    ['Requestor email', request.requestorEmail], ['Vendor / company', request.vendorName], ['Vendor number', request.vendorNumber], ['Vendor email', request.vendorEmail],
    ['Company Code', [request.companyCode, request.companyCodeDescription].filter(Boolean).join(' — ')], ['Plant Code', [request.plantCode, request.plantName].filter(Boolean).join(' — ')],
    ['Funding type', request.fundingType], ['Cost Center', request.fundingType === 'CAPEX' ? '' : request.costCenter], ['WBS Number', request.fundingType === 'CAPEX' ? request.wbsNumber : ''],
    ['Currency', request.currency], ['Delivery frequency', request.deliveryFrequency], ['Start delivery', dateLabel(request.startDeliveryDate)], ['End delivery', dateLabel(request.endDeliveryDate)],
    ['Delivery count', request.deliveryCount], ['ORO', request.oroNumber], ['PO Number', request.poNumber], ['Last updated by', request.lastUpdatedBy || '']
  ].filter(([label,value]) => clean(value));
  const rows = info.map(([label,value]) => `<div class="field"><span>${htmlEscape(label)}</span><strong>${htmlEscape(value)}</strong></div>`).join('');
  const lineRows = lines.map(line => `<tr><td>${htmlEscape(line.type || '—')}</td><td>${htmlEscape(line.glCode || '—')}<small>${htmlEscape(line.glDescription || '')}</small></td><td>${htmlEscape(manualLineDescription(line) || '—')}</td><td>${htmlEscape(line.quantity ?? 0)}</td><td>${htmlEscape(money(line.unitPrice || 0, request.currency || 'USD'))}</td><td>${htmlEscape(money(line.total ?? Number(line.quantity || 0) * Number(line.unitPrice || 0), request.currency || 'USD'))}</td></tr>`).join('');
  const printHistoryItems = Array.isArray(request.history) ? request.history : (Array.isArray(request.approvalHistory) ? request.approvalHistory : []);
  const history = printHistoryItems.slice().sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)).map(item => `<li><strong>${htmlEscape(statusDisplayLabelForEvent(item))}${item.note ? ` — ${htmlEscape(item.note)}` : ''}</strong><span>${htmlEscape(dateTimeLabel(item.at))}${item.by ? ` · ${htmlEscape(item.by)}` : ''}</span></li>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(request.requestId)} - PO Request Details</title><style>
    @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#182d3a;font:10px/1.45 'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #c8102e;padding:0 0 12px;margin-bottom:15px}.brand strong{font-size:17px;letter-spacing:.2px}.brand span{color:#77848f;font-size:9px}.eyebrow{font-size:8px;letter-spacing:1.2px;color:#c8102e;font-weight:800}h1{font-size:20px;line-height:1.2;margin:5px 0}p{margin:4px 0;color:#687987}.status{display:inline-block;background:#fff0f2;color:#b20d2b;padding:4px 8px;border-radius:5px;font-weight:800;font-size:9px;margin:4px 0 15px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:17px}.metric{border:1px solid #e5e9ee;border-radius:7px;padding:10px}.metric span{display:block;color:#77848f;font-size:8px}.metric strong{display:block;margin-top:5px;font-size:12px}.section{margin:15px 0;break-inside:avoid;page-break-inside:avoid}.section h2{font-size:11px;color:#c8102e;margin:0 0 8px;padding-bottom:5px;border-bottom:1px solid #e6e8eb;text-transform:uppercase;letter-spacing:.5px}.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px}.field{border-bottom:1px solid #edf0f2;padding:0 0 7px;min-width:0}.field span{display:block;color:#788792;font-size:8px;margin-bottom:3px}.field strong{display:block;font-size:9px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5px}thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid;page-break-inside:avoid}th{background:#c8102e;color:#fff;text-align:left;padding:8px 6px;font-size:7px;letter-spacing:.25px}td{padding:7px 6px;border-bottom:1px solid #e8ecef;overflow-wrap:anywhere;vertical-align:top}td small{display:block;color:#7f8b93;margin-top:2px}tfoot td{font-weight:800;background:#fff2f4;color:#a80d28}.total{text-align:right;margin-top:10px;padding:10px;border:1px solid #f0cbd2;border-radius:7px;background:#fff5f6;font-size:10px}.total strong{font-size:17px;color:#c8102e;margin-left:15px}.history{list-style:none;margin:0;padding:0}.history li{padding:0 0 10px 13px;border-left:2px solid #d8e9e7;position:relative;break-inside:avoid}.history li:before{content:'';position:absolute;left:-5px;top:3px;width:7px;height:7px;border-radius:50%;background:#149c8c}.history li strong,.history li span{display:block}.history li span{font-size:8px;color:#788792;margin-top:2px}.notes{white-space:pre-wrap;overflow-wrap:anywhere}.footer{margin-top:18px;border-top:1px solid #e7eaed;padding-top:7px;color:#88949c;font-size:8px;display:flex;justify-content:space-between}.no-break{break-inside:avoid;page-break-inside:avoid}@media screen{body{max-width:210mm;margin:20px auto;padding:18px 23px;box-shadow:0 5px 32px #ccd3da}.toolbar{position:sticky;top:0;display:flex;justify-content:flex-end;padding:10px;background:#fff;border-bottom:1px solid #eee;margin:-18px -23px 18px;z-index:2}.toolbar button{background:#c8102e;border:0;color:#fff;border-radius:6px;padding:9px 14px;font-weight:800;cursor:pointer}}@media print{.toolbar{display:none!important}body{max-width:none;margin:0;padding:0;box-shadow:none}.section{break-inside:auto}.fields .field{break-inside:avoid}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div><header class="brand"><div><div class="eyebrow">PURCHASE ORDER REQUEST</div><strong>TCCC PO Request Portal</strong></div><span>Generated ${htmlEscape(new Date().toLocaleString('en-GB'))}</span></header><div class="eyebrow">REQUEST DETAILS</div><h1>${htmlEscape(request.requestId)} · ${htmlEscape(request.title || 'Untitled request')}</h1><p>Purchase order request summary and line item breakdown.</p><div class="status">${htmlEscape(statusDisplayLabel(request.status, request))}</div><div class="metrics"><div class="metric"><span>Request date</span><strong>${htmlEscape(dateLabel(request.requestDate || request.createdAt))}</strong></div><div class="metric"><span>Region</span><strong>${htmlEscape(request.region || '—')}</strong></div><div class="metric"><span>Line items</span><strong>${lines.length}</strong></div><div class="metric"><span>PO value</span><strong>${htmlEscape(money(requestTotal(request), request.currency || 'USD'))}</strong></div></div><section class="section"><h2>Vendor, requestor & accounting</h2><div class="fields">${rows}</div></section><section class="section"><h2>Line items</h2><table><thead><tr><th style="width:10%">TYPE</th><th style="width:19%">GL CODE</th><th style="width:35%">DESCRIPTION</th><th style="width:7%">QTY</th><th style="width:14%">UNIT PRICE</th><th style="width:15%">TOTAL</th></tr></thead><tbody>${lineRows}</tbody><tfoot><tr><td colspan="5">PO VALUE</td><td>${htmlEscape(money(requestTotal(request), request.currency || 'USD'))}</td></tr></tfoot></table></section>${request.requesterNotes ? `<section class="section"><h2>Request notes</h2><p class="notes">${htmlEscape(request.requesterNotes)}</p></section>` : ''}<section class="section"><h2>Workflow history</h2><ul class="history">${history || '<li>No workflow updates recorded.</li>'}</ul></section><footer class="footer"><span>${htmlEscape(request.requestId)} · TCCC PO Request Portal</span><span>Generated for review — not an issued Purchase Order</span></footer><script>window.addEventListener('load',()=>{setTimeout(()=>{window.focus();window.print()},350)});window.addEventListener('afterprint',()=>setTimeout(()=>window.close(),500));</script></body></html>`;
  try { printWindow.document.open(); printWindow.document.write(html); printWindow.document.close(); } catch(error) { printWindow.close(); notify('Print failed', error.message, 'error'); }
}

function renderDetailTimeline(historyItems, compact = false) {
  const items = (Array.isArray(historyItems) ? historyItems : []).slice().sort((a, b) => {
    const ta = Date.parse(a.at || a.timestamp || '') || 0;
    const tb = Date.parse(b.at || b.timestamp || '') || 0;
    return ta - tb;
  });
  if (!items.length) return '<div class="detail-timeline-empty"><span class="timeline-empty-icon">◷</span><strong>No workflow updates yet</strong><p>The first timeline event appears after the request is submitted.</p></div>';
  return `<ol class="request-status-timeline ${compact ? 'is-compact' : ''}">${items.map((event, index) => {
    const label = statusDisplayLabelForEvent(event);
    const latest = index === items.length - 1;
    return `<li class="request-timeline-event ${latest ? 'is-current' : 'is-complete'}"><span class="request-timeline-marker">${latest ? '●' : '✓'}</span><div class="request-timeline-copy"><div class="request-timeline-title-row"><strong>${htmlEscape(label)}</strong>${latest ? '<span class="timeline-current-tag">Current</span>' : ''}</div>${event.note ? `<p>${htmlEscape(event.note)}</p>` : ''}<span class="request-timeline-meta">${htmlEscape(dateTimeLabel(event.at || event.timestamp))}${event.by ? ` · ${htmlEscape(event.by)}` : ''}</span></div></li>`;
  }).join('')}</ol>`;
}
function renderCurrentWorkflow(request) {
  const status = String(request.status || 'Submitted');
  const label = statusDisplayLabel(status, request);
  const isInitial = isInitialPortalSubmission(request);
  const statusKey = isInitial ? 'initial' : label === 'Submitted on PP+' ? 'ppplus' :
    label === 'Pending for Approval' ? 'pending' :
    label === 'Clarification Required' ? 'clarification' :
    label === 'Rejected' ? 'rejected' :
    label === 'PO Created' ? 'created' : 'pending';
  const history = Array.isArray(request.approvalHistory) ? request.approvalHistory : (Array.isArray(request.history) ? request.history : []);
  const latestEvent = statuses => history.slice().reverse().find(event => statuses.includes(String(event.status || '')) && (!event.from || String(event.from) !== String(event.status || '')));
  const initialEvent = history.find(event => String(event.status || '') === 'Submitted' && String(event.note || '').trim() === INITIAL_SUBMISSION_NOTE)
    || history.find(event => String(event.status || '') === 'Submitted' && !event.from) || null;
  const pendingEvent = latestEvent(['Under Review', 'Submitted'].filter(eventStatus => !(eventStatus === 'Submitted' && isInitial)));
  const outcomeEvent = latestEvent(statusKey === 'created' ? ['PO Created'] : statusKey === 'clarification' ? ['Clarification Required'] : statusKey === 'rejected' ? ['Rejected'] : []);
  const eventDate = event => event ? dateTimeLabel(event.at || event.timestamp) : '';
  const firstState = isInitial ? 'is-current' : 'is-complete';
  const pendingState = statusKey === 'pending' ? 'is-current' : (['clarification','rejected','created'].includes(statusKey) ? 'is-complete' : 'is-upcoming');
  const outcomeState = key => statusKey === key ? 'is-current' : 'is-alternative';
  const initialDate = eventDate(initialEvent) || dateTimeLabel(request.createdAt || request.requestDate);
  const pendingDate = statusKey === 'pending' ? (eventDate(pendingEvent) || dateTimeLabel(request.updatedAt || request.createdAt)) : '';
  const outcomeDate = ['created','clarification','rejected'].includes(statusKey) ? (eventDate(outcomeEvent) || dateTimeLabel(request.updatedAt || request.createdAt)) : '';
  const currentOutcomeLabel = statusKey === 'created' ? 'PO Created' : statusKey === 'clarification' ? 'Clarification Required' : statusKey === 'rejected' ? 'Rejected' : '';
  const statusNote = isInitial
    ? 'The portal has received the request. The PO Team can now begin creating the purchase order.'
    : statusKey === 'pending'
      ? 'Procurement is reviewing the request.'
      : statusKey === 'clarification'
        ? 'The requestor needs to provide additional information before review continues.'
        : statusKey === 'rejected'
          ? 'The request was rejected. Any later correction remains visible in the audit history.'
          : statusKey === 'created'
            ? 'The purchase order has been created. Add the final PO number in Procurement Tracking.'
            : statusKey === 'ppplus'
              ? 'The request has been recorded in PP+. Procurement will update the next stage when applicable.'
              : 'The latest workflow state is shown below.';
  return `<div class="request-active-workflow" aria-label="Current request workflow">
    <div class="workflow-summary-row"><div><span class="workflow-section-kicker">CURRENT PROGRESS</span><strong>Request timeline</strong></div><span class="workflow-current-badge ${statusKey}">${htmlEscape(label)}</span></div>
    <div class="workflow-process-list">
      <article class="workflow-process-step ${firstState}"><span class="workflow-process-icon">${isInitial ? '1' : '✓'}</span><div class="workflow-process-copy"><strong>${htmlEscape(INITIAL_SUBMISSION_LABEL)}</strong><small>${htmlEscape(isInitial ? 'Received by the PO Team' : 'Portal submission recorded')}</small></div><div class="workflow-step-trailing">${isInitial ? '<b class="workflow-step-state">CURRENT</b>' : `<small>${htmlEscape(initialDate)}</small>`}</div></article>
      <div class="workflow-process-connector ${statusKey === 'initial' ? '' : 'is-complete'}"><span></span></div>
      <article class="workflow-process-step ${pendingState}"><span class="workflow-process-icon">${statusKey === 'pending' ? '2' : pendingState === 'is-complete' ? '✓' : '2'}</span><div class="workflow-process-copy"><strong>Pending for Approval</strong><small>Procurement review</small></div><div class="workflow-step-trailing">${statusKey === 'pending' ? '<b class="workflow-step-state">CURRENT</b>' : pendingState === 'is-complete' ? `<small>${htmlEscape(pendingDate || 'Review stage completed')}</small>` : '<small>Next stage</small>'}</div></article>
    </div>
    <div class="workflow-outcome-heading"><strong>Possible outcomes</strong><span>${currentOutcomeLabel ? `Current: ${htmlEscape(currentOutcomeLabel)}` : 'Procurement updates the outcome'}</span></div>
    <div class="workflow-outcome-grid compact-outcomes">
      <article class="workflow-outcome workflow-outcome-created ${outcomeState('created')}"><span class="workflow-outcome-marker">✓</span><div><strong>PO Created</strong><small>${statusKey === 'created' && request.poNumber ? `PO Number: ${htmlEscape(request.poNumber)}` : 'Purchase order created'}</small></div>${statusKey === 'created' ? '<b class="workflow-outcome-current">CURRENT</b>' : ''}</article>
      <article class="workflow-outcome workflow-outcome-clarification ${outcomeState('clarification')}"><span class="workflow-outcome-marker">!</span><div><strong>Clarification Required</strong><small>Requestor action needed</small></div>${statusKey === 'clarification' ? '<b class="workflow-outcome-current">CURRENT</b>' : ''}</article>
      <article class="workflow-outcome workflow-outcome-rejected ${outcomeState('rejected')}"><span class="workflow-outcome-marker">×</span><div><strong>Rejected</strong><small>Request not approved</small></div>${statusKey === 'rejected' ? '<b class="workflow-outcome-current">CURRENT</b>' : ''}</article>
    </div>
    <div class="workflow-state-note"><span class="workflow-info-icon">i</span><span><strong>${htmlEscape(label)}.</strong> ${htmlEscape(statusNote)} Historical changes remain available in the History tab.</span></div>
  </div>`;
}
function requestDetailPairs(request) {
  const funding = String(request.fundingType || '').toUpperCase();
  const account = funding === 'CAPEX' ? `WBS: ${request.wbsNumber || '—'}` : `Cost Center: ${request.costCenter || '—'}`;
  const company = request.companyCode ? `${request.companyCode}${request.companyCodeDescription ? ` — ${request.companyCodeDescription}` : ''}` : '—';
  const plant = [request.plantCode, request.plantName].filter(Boolean).join(' — ') || request.deliveryAddress || '—';
  return [
    ['PO title', request.title || '—'], ['Request date', dateLabel(request.requestDate || request.createdAt)],
    ['Region', request.region || '—'], ['Currency', request.currency || '—'],
    ['Vendor name', request.vendorName || '—'], ['Vendor number', request.vendorNumber || '—'],
    ['Vendor email', request.vendorEmail || '—'], ['Requestor name', request.requestorName || '—'],
    ['Requestor email', request.requestorEmail || '—'], ['Company Code', company], ['Plant Code', plant],
    ['Account assignment', account], ['Delivery frequency', `${request.deliveryFrequency || '—'}${request.deliveryCount ? ` · ${request.deliveryCount} time(s)` : ''}`],
    ['Start delivery', dateLabel(request.startDeliveryDate)], ['End delivery', dateLabel(request.endDeliveryDate)],
  ];
}
function renderRequestDetailsPage(request, source = 'track') {
  if (!request) return;
  state.currentDetailRecord = request;
  state.currentDetailId = request.requestId || state.currentDetailId;
  state.detailSource = source;
  const root = $('#request-detail-page-content');
  if (!root) return;
  const reviewer = source === 'reviewer' && state.reviewerMode;
  const lines = Array.isArray(request.lineItems) ? request.lineItems : [];
  const rawHistory = Array.isArray(request.history) ? request.history : (Array.isArray(request.approvalHistory) ? request.approvalHistory : []);
  const history = rawHistory.map(event => ({ ...event, statusLabel: event.statusLabel || statusDisplayLabelForEvent(event) }));
  const total = requestTotal(request);
  const status = request.status || 'Submitted';
  const statusLabel = request.statusLabel || statusDisplayLabel(status);
  const tabs = [
    ['overview','Overview'], ['line-items',`Line items (${lines.length})`], ['documents','Documents'], ['history','History'], ['comments','Comments']
  ];
  const activeTab = tabs.some(([key]) => key === state.detailTab) ? state.detailTab : 'overview';
  const pairHtml = pairs => pairs.map(([label, value]) => `<div class="request-field-pair"><span>${htmlEscape(label)}</span><strong>${htmlEscape(value)}</strong></div>`).join('');
  const lineTable = `<div class="table-wrap detail-line-table-wrap"><table class="data-table detail-page-lines"><thead><tr><th>#</th><th>TYPE</th><th>GL CODE</th><th>DESCRIPTION</th><th>QTY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead><tbody>${lines.map((line, idx) => `<tr><td>${idx + 1}</td><td>${htmlEscape(line.type || '—')}</td><td>${htmlEscape(line.glCode || '—')}${line.glDescription ? `<small class="detail-gl-name">${htmlEscape(line.glDescription)}</small>` : ''}</td><td>${htmlEscape(manualLineDescription(line) || '—')}</td><td>${htmlEscape(line.quantity ?? 0)}</td><td>${htmlEscape(money(line.unitPrice || 0, request.currency || 'USD'))}</td><td class="detail-money-cell">${htmlEscape(money(line.total ?? Number(line.quantity || 0) * Number(line.unitPrice || 0), request.currency || 'USD'))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="6">PO VALUE</td><td>${htmlEscape(money(total, request.currency || 'USD'))}</td></tr></tfoot></table></div>`;
  const overviewPairs = requestDetailPairs(request);
  let tabContent = '';
  if (activeTab === 'overview') {
    tabContent = `<div class="request-detail-grid${reviewer ? ' request-detail-grid-reviewer' : ''}"><div class="request-detail-main-column">
      <section class="request-detail-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">REQUEST SUMMARY</span><h2>Request information</h2></div></div><div class="request-detail-field-grid">${pairHtml(overviewPairs)}</div></section>
      <section class="request-detail-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">PO BREAKDOWN</span><h2>Line items</h2><p>${lines.length} item(s) · totals calculated per line</p></div><button class="button button-secondary button-small" data-detail-tab="line-items">View all ↗</button></div>${lineTable}</section>
      ${request.requesterNotes ? `<section class="request-detail-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">NOTES</span><h2>Request notes</h2></div><button class="button button-secondary button-small" data-detail-tab="comments">View comments ↗</button></div><p class="request-note-text">${htmlEscape(request.requesterNotes)}</p></section>` : ''}
    </div><aside class="request-detail-side-column">
      <section class="request-status-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">STATUS & APPROVAL TIMELINE</span><h2>Approval workflow</h2></div><button class="button button-quiet button-small" data-detail-action="refresh-details" title="Refresh status">↻ Refresh</button></div><div class="timeline-current-status">${statusPill(status, statusLabel)}<span>Updated ${htmlEscape(dateTimeLabel(request.updatedAt || request.createdAt))}</span></div>${renderCurrentWorkflow(request)}<button class="button button-secondary button-block" data-detail-tab="history">View audit history (${history.length}) →</button></section>
      <section class="request-procurement-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">PROCUREMENT TRACKING</span><h2>References</h2></div></div><div class="procurement-reference-row"><span>ORO</span><strong>${htmlEscape(request.oroNumber || 'Pending')}</strong></div><div class="procurement-reference-row"><span>PO Number</span><strong>${htmlEscape(request.poNumber || 'Pending')}</strong></div>${request.lastUpdatedBy ? `<div class="procurement-reference-row"><span>Last updated by</span><strong>${htmlEscape(request.lastUpdatedBy)}</strong></div>` : ''}</section>
    </aside></div>`;
  } else if (activeTab === 'line-items') {
    tabContent = `<section class="request-detail-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">ITEM BREAKDOWN</span><h2>PO line items</h2><p>${lines.length} item(s) in this request</p></div><div class="detail-total-pill"><span>PO VALUE</span><strong>${htmlEscape(money(total, request.currency || 'USD'))}</strong></div></div>${lineTable}</section>`;
  } else if (activeTab === 'documents') {
    const documents = Array.isArray(request.supportingDocuments) ? request.supportingDocuments : (Array.isArray(request.attachments) ? request.attachments : []);
    tabContent = `<section class="request-detail-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">DOCUMENT CENTRE</span><h2>Supporting documents</h2><p>Files linked to this PO request.</p></div></div>${documents.length ? `<div class="detail-documents-list">${documents.map(file => `<div class="detail-document-row"><span class="detail-document-icon">PDF</span><div><strong>${htmlEscape(file.name || file.filename || 'Attachment')}</strong><small>${htmlEscape(file.sizeLabel || 'Supporting document')}</small></div></div>`).join('')}</div>` : `<div class="detail-empty-state"><span class="detail-empty-icon">▤</span><strong>No saved documents on this request</strong><p>In the current local version, supporting files selected during submission must be manually attached to the email and are not retained as request-file records. This page only lists files that were explicitly saved with the request.</p></div>`}</section>`;
  } else if (activeTab === 'history') {
    tabContent = `<section class="request-detail-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">AUDIT TRAIL</span><h2>Workflow history</h2><p>All recorded status updates and reviewer notes.</p></div></div>${renderDetailTimeline(history, false)}</section>`;
  } else {
    const comments = [];
    if (request.requesterNotes) comments.push({ label: 'Requestor note', text: request.requesterNotes, by: request.requestorName || 'Requestor', at: request.createdAt || request.requestDate });
    history.forEach(event => { if (event.note) comments.push({ label: event.statusLabel || 'Workflow note', text: event.note, by: event.by || 'Procurement', at: event.at }); });
    tabContent = `<section class="request-detail-card"><div class="request-detail-card-head"><div><span class="detail-card-kicker">COMMENTS</span><h2>Request notes & comments</h2><p>Notes captured during request submission and workflow updates.</p></div></div>${comments.length ? `<div class="detail-comments-list">${comments.map(comment => `<article class="detail-comment"><div class="detail-comment-avatar">${htmlEscape((comment.by || 'U').trim().charAt(0).toUpperCase())}</div><div><div class="detail-comment-head"><strong>${htmlEscape(comment.label)}</strong><span>${htmlEscape(dateTimeLabel(comment.at))}</span></div><p>${htmlEscape(comment.text)}</p><small>${htmlEscape(comment.by)}</small></div></article>`).join('')}</div>` : `<div class="detail-empty-state"><span class="detail-empty-icon">☷</span><strong>No comments added</strong><p>Request notes and reviewer comments will appear here when provided.</p></div>`}</section>`;
  }
  const selectedUpdatedBy = request.lastUpdatedBy || '';
  const reviewerNames = Array.isArray(state.master?.reviewerNames) ? [...state.master.reviewerNames] : ['Kirtika','Purushoth'];
  if (selectedUpdatedBy && !reviewerNames.includes(selectedUpdatedBy)) reviewerNames.unshift(selectedUpdatedBy);
  const reviewerControls = reviewer ? `<section class="request-reviewer-workflow"><div class="request-detail-card-head"><div><span class="detail-card-kicker">REVIEWER WORKSPACE</span><h2>Update procurement status</h2><p>Status changes update this Request ID. Earlier corrections remain available in audit history.</p></div><span class="reviewer-only-pill">Reviewer actions</span></div><div class="request-procurement-edit-grid"><div class="field"><label for="detail-oro-number">ORO number</label><input id="detail-oro-number" maxlength="160" value="${attrEscape(request.oroNumber || '')}" placeholder="Enter ORO reference" /></div><div class="field"><label for="detail-po-number">PO number</label><input id="detail-po-number" maxlength="160" value="${attrEscape(request.poNumber || '')}" placeholder="Enter created PO number" /></div><div class="field"><label for="detail-updated-by">Updated by</label><select id="detail-updated-by" class="searchable-native" data-placeholder="Select reviewer name"><option value="">Select reviewer name</option>${reviewerNames.map(name => `<option value="${attrEscape(name)}" ${selected(name, selectedUpdatedBy)}>${htmlEscape(name)}</option>`).join('')}</select><small>Optional. Leave blank to use the generic reviewer attribution.</small></div></div><div class="field reviewer-note-field"><label for="detail-note">Reviewer note</label><textarea id="detail-note" maxlength="1000" placeholder="Optional comment to record with the status update"></textarea></div><div class="reviewer-action-footer"><button class="button button-secondary" data-detail-action="save-tracking">Save ORO / PO Number</button><div class="reviewer-status-actions">${possibleTransitions(request).map(nextStatus => `<button class="button ${nextStatus === 'Rejected' ? 'button-danger' : (nextStatus === 'PO Created' || nextStatus === 'Request Submitted on PP+' ? 'button-primary' : 'button-secondary')}" data-set-status="${attrEscape(nextStatus)}">${htmlEscape(statusDisplayLabel(nextStatus))}</button>`).join('')}</div></div></section>` : '';
  let reviewerControlsAfterContent = reviewerControls;
  if (reviewer && activeTab === 'overview' && tabContent.includes('</aside></div>')) {
    tabContent = tabContent.replace('</aside></div>', `</aside><div class="request-detail-reviewer-column">${reviewerControls}</div></div>`);
    reviewerControlsAfterContent = '';
  }
  root.innerHTML = `<div class="detail-page-backbar"><button class="button button-secondary button-small" data-detail-action="back">← Back to ${htmlEscape(state.detailReturnView === 'track' ? 'Track My Request' : 'requests')}</button><span class="detail-page-crumb">Workspace <b>/</b> ${htmlEscape(source === 'reviewer' ? 'Reviewer Console' : 'Track My Request')} <b>/</b> Request Details</span></div><div class="page-heading request-detail-page-heading"><div><div class="eyebrow"><span class="eyebrow-dot"></span> REQUEST DETAILS</div><h1>${htmlEscape(request.requestId || 'PO Request')} <span class="detail-heading-separator">·</span> ${htmlEscape(request.title || 'Untitled request')}</h1><p>Submitted ${htmlEscape(dateTimeLabel(request.createdAt || request.requestDate))} · Last updated ${htmlEscape(dateTimeLabel(request.updatedAt || request.createdAt))}</p></div><div class="heading-actions"><button class="button button-secondary" data-detail-action="print">▧ Print / PDF</button><button class="button button-secondary" data-detail-action="email-preview">✉ Email preview</button></div></div><section class="request-detail-status-banner"><div><span class="detail-status-label">CURRENT STATUS</span><h2>${htmlEscape(statusLabel)}</h2><span class="detail-status-subtitle">${htmlEscape(request.requestId || '')} · ${htmlEscape(request.title || 'PO request')}</span></div><div class="detail-status-banner-right">${statusPill(status, statusLabel)}${request.lastUpdatedBy ? `<span>Last updated by <strong>${htmlEscape(request.lastUpdatedBy)}</strong></span>` : ''}</div></section><div class="request-detail-metrics"><article><span>Request date</span><strong>${htmlEscape(dateLabel(request.requestDate || request.createdAt))}</strong></article><article><span>Region</span><strong>${htmlEscape(request.region || '—')}</strong></article><article><span>Line items</span><strong>${lines.length}</strong></article><article class="request-detail-value-metric"><span>PO value</span><strong>${htmlEscape(money(total, request.currency || 'USD'))}</strong></article></div><nav class="request-detail-tabs" aria-label="Request detail sections">${tabs.map(([key,label]) => `<button type="button" class="request-detail-tab ${activeTab === key ? 'active' : ''}" data-detail-tab="${key}">${htmlEscape(label)}</button>`).join('')}</nav><div class="request-detail-tab-content">${tabContent}</div>${reviewerControlsAfterContent}<div class="request-detail-page-footer"><span>Request ID: <strong>${htmlEscape(request.requestId || '—')}</strong></span><span>One request record · ${lines.length} line item(s) · Total includes all lines</span></div>`;
  if (reviewer) enhanceSearchableSelects(root);
}

async function showDetails(requestId) {
  const returnView = state.currentView === 'details' ? state.detailReturnView : state.currentView;
  try {
    const data = await api(`/api/requests/${encodeURIComponent(requestId)}`);
    const request = data.request;
    state.currentDetailId = requestId;
    state.currentDetailRecord = request;
    state.detailReturnView = ['overview', 'requests', 'master', 'reports'].includes(returnView) ? returnView : 'requests';
    state.detailSource = 'reviewer';
    state.detailTab = 'overview';
    renderRequestDetailsPage(request, 'reviewer');
    switchView('details');
  } catch (error) { notify('Could not open request', error.message, 'error'); }
}

async function changeStatus(targetStatus) {
  if (!state.reviewerMode || !state.reviewerKey) return notify('Reviewer access required', 'Unlock the Reviewer Console first.', 'error');
  const note = $('#detail-note')?.value.trim() || '';
  const oroNumber = $('#detail-oro-number')?.value.trim() || '';
  const poNumber = $('#detail-po-number')?.value.trim() || '';
  const updatedBy = $('#detail-updated-by')?.value.trim() || '';
  try {
    const result = await api(`/api/requests/${encodeURIComponent(state.currentDetailId)}/status`, { method: 'PUT', body: { status: targetStatus, note, oroNumber, poNumber, updatedBy } });
    await reloadRequests();
    notify('Status updated', `${result.request.requestId} is now ${targetStatus}.`);
    await showDetails(state.currentDetailId);
  } catch (error) {
    if (error.problems?.length) notify('Request needs attention', error.problems[0], 'error');
    else notify('Status update failed', error.message, 'error');
  }
}
async function saveTrackingDetails() {
  if (!state.reviewerMode || !state.reviewerKey) return notify('Reviewer access required', 'Unlock the Reviewer Console first.', 'error');
  const updatedBy = $('#detail-updated-by')?.value.trim() || '';
  try {
    const result = await api(`/api/requests/${encodeURIComponent(state.currentDetailId)}/tracking`, {
      method: 'PUT', body: {
        oroNumber: $('#detail-oro-number')?.value.trim() || '',
        poNumber: $('#detail-po-number')?.value.trim() || '',
        updatedBy: $('#detail-updated-by')?.value.trim() || '',
      }
    });
    await reloadRequests();
    notify('Tracking details saved', `${result.request.requestId}: ORO and PO Number updated.`);
    await showDetails(state.currentDetailId);
  } catch (error) { notify('Could not save tracking details', error.message, 'error'); }
}

// Any file extension is accepted for supporting documents; files are attached to native Outlook drafts when available, otherwise added manually in the mailto fallback.
const SUPPORT_MAX_FILES = 5, SUPPORT_MAX_TOTAL = 10 * 1024 * 1024, SUPPORT_MAX_EACH = 10 * 1024 * 1024;
function supportingExtension(fileName) { return clean(fileName).split('.').pop().toLowerCase(); }
function renderSupportingFiles() {
  const list = $('#supporting-documents-list');
  if (!list) return;
  const total = state.supportingFiles.reduce((sum, file) => sum + file.size, 0);
  const count = $('#supporting-documents-count');
  if (count) count.textContent = `${state.supportingFiles.length} file${state.supportingFiles.length === 1 ? '' : 's'}${total ? ` · ${(total / (1024 * 1024)).toFixed(2)} MB` : ''}`;
  if (!state.supportingFiles.length) {
    list.innerHTML = '<div class="supporting-documents-empty">No supporting documents added.</div>';
    return;
  }
  list.innerHTML = state.supportingFiles.map((file, index) => `<div class="supporting-file-row"><span class="supporting-file-icon">${supportingExtension(file.name) === 'pdf' ? 'PDF' : 'FILE'}</span><div class="supporting-file-copy"><strong>${htmlEscape(file.name)}</strong><small>${(file.size / 1024).toFixed(0)} KB</small></div><button type="button" class="supporting-file-remove" data-remove-supporting-file="${index}" aria-label="Remove ${attrEscape(file.name)}" title="Remove file">×</button></div>`).join('');
}
function syncSupportingFileInput() {
  // `state.supportingFiles` is the source of truth. Keep the native picker empty so users
  // can choose the same filename again after removing it from the attachment list.
  const input = $('#supporting-documents');
  if (input) input.value = '';
}
function handleSupportingFileSelection(event) {
  const files = [...(event.target.files || [])];
  // Clearing the native picker allows selecting the same file again after removal.
  event.target.value = '';
  addSupportingFiles(files);
}
function addSupportingFiles(files) {
  const incoming = [...(files || [])].filter(file => file && typeof file.name === 'string' && Number.isFinite(file.size));
  if (!incoming.length) return;
  const merged = [...state.supportingFiles];
  for (const file of incoming) {
    if (!merged.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) merged.push(file);
  }
  const total = merged.reduce((sum, file) => sum + file.size, 0);
  if (merged.length > SUPPORT_MAX_FILES) { notify('Too many files', 'A maximum of 5 supporting files is allowed.', 'error'); }
  else if (merged.some(file => file.size > SUPPORT_MAX_EACH)) { notify('File too large', 'Each supporting document must be 10 MB or smaller.', 'error'); }
  else if (total > SUPPORT_MAX_TOTAL) { notify('Attachments too large', 'All supporting documents together must be 10 MB or smaller.', 'error'); }
  else state.supportingFiles = merged;
  syncSupportingFileInput(); renderSupportingFiles();
  updateSaveNote(state.editingId ? 'Unsaved edits' : (state.supportingFiles.length ? 'Supporting documents ready to attach manually' : 'Changes are not saved yet'));
}
function openEmailPreview(request, files = [], returnView = state.currentView, trackingCode = '') {
  if (!request || !request.requestId) { notify('Email preview unavailable', 'Open a submitted PO request first.', 'error'); return; }
  const isSameRequest = state.emailPreviewRequest?.requestId === request.requestId;
  state.emailPreviewRequest = request;
  state.emailPreviewFiles = Array.isArray(files) ? [...files] : [];
  state.emailPreviewReturnView = returnView || 'track';
  if (!isSameRequest) state.emailPreviewTrackingCode = clean(trackingCode);
  else if (trackingCode) state.emailPreviewTrackingCode = clean(trackingCode);
  const to = 'grw-global-p2prequests@coca-cola.com';
  const subject = `[TCCC PO REQUEST] PO Creation Request Submitted: ${request.requestId} | ${request.title || 'PO request'}`;
  $('#email-preview-to').textContent = to;
  $('#email-preview-subject').textContent = subject;
  $('#email-preview-request-id').textContent = `Request ID: ${request.requestId}`;
  $('#email-preview-back-label').textContent = state.emailPreviewReturnView === 'track' ? '← Track My Request' : state.emailPreviewReturnView === 'home' ? '← Home' : '← Back';
  if (!isSameRequest) {
    $('#email-preview-cc').value = '';
    $('#email-preview-bcc').value = '';
  }
  $('#email-preview-tracking')?.classList.toggle('hidden', !state.emailPreviewTrackingCode);
  $('#email-preview-tracking-code').textContent = state.emailPreviewTrackingCode || '—';
  const capex = String(request.fundingType || '').toUpperCase() === 'CAPEX';
  const companyCode = [request.companyCode, request.companyCodeDescription, request.companyCodeCountry ? `(${request.companyCodeCountry})` : ''].filter(Boolean).join(' - ') || 'Not supplied';
  const accountAssignment = capex ? `WBS ${request.wbsNumber || '-'}` : `Cost Center ${request.costCenter || '-'}`;
  const infoRows = [
    ['Request ID', request.requestId], ['PO Title', request.title || '-'], ['Region', request.region || '-'],
    ['Request Date', dateLabel(request.requestDate || request.createdAt)], ['Current Status', request.statusLabel || statusDisplayLabel(request.status, request)],
    ['Vendor Name', request.vendorName || '-'], ['Vendor Number', request.vendorNumber || '-'], ['Vendor Email', request.vendorEmail || '-'],
    ['Company Code', companyCode], ['Plant Code', request.plantCode || request.deliveryAddress || '-'],
    ['Requestor Name', request.requestorName || '-'], ['Requestor Email', request.requestorEmail || '-'],
    ['Funding Type', request.fundingType || '-'], ['Account Assignment', accountAssignment], ['Delivery Frequency', request.deliveryFrequency || '-'],
    ['Start Delivery Date', dateLabel(request.startDeliveryDate)], ['End Delivery Date', dateLabel(request.endDeliveryDate)],
    ['Delivery Count', request.deliveryCount ?? request.numberOfTimes ?? '-'], ['Currency', request.currency || '-'],
    ['PO Value', money(requestTotal(request), request.currency || 'USD')]
  ];
  if (request.oroNumber) infoRows.push(['ORO', request.oroNumber]);
  if (request.poNumber) infoRows.push(['PO Number', request.poNumber]);
  if (request.requesterNotes || request.notes) infoRows.push(['Request Notes', request.requesterNotes || request.notes]);
  const lines = Array.isArray(request.lineItems) ? request.lineItems : [];
  const esc = htmlEscape;
  const infoTableRows = [];
  for (let i = 0; i < infoRows.length; i += 2) {
    const first = infoRows[i];
    const second = infoRows[i + 1];
    infoTableRows.push(`<tr><th>${esc(first[0])}</th><td>${esc(first[1] ?? '-')}</td>${second ? `<th>${esc(second[0])}</th><td>${esc(second[1] ?? '-')}</td>` : '<th class="email-info-empty-label"></th><td class="email-info-empty-value"></td>'}</tr>`);
  }
  $('#email-preview-body').innerHTML = `<p class="email-greeting">Hello GRW Team,</p><p class="email-request-line">A new PO request has been submitted and is ready for Procurement review.<br>Could you please raise the PO based on the information below?</p><h3 class="email-section-title">Request Details</h3><div class="email-info-scroll"><table class="email-info-table"><tbody>${infoTableRows.join('')}</tbody></table></div><h3 class="email-section-title">PO Line Items</h3><div class="email-lines-scroll"><table class="email-line-table"><thead><tr>${['No.','Type','GL Code','Description','Delivery Date','Cost Center / WBS','Quantity','Unit Price','Total'].map(label=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${lines.map((line,index)=>`<tr><td>${index+1}</td><td>${esc(line.type || '-')}</td><td>${esc(line.glCode || (capex ? line.wbsGlCode : line.costCenterGlCode) || '-')}</td><td>${esc(manualLineDescription(line) || '-')}</td><td>${esc(dateLabel(line.deliveryDate))}</td><td>${esc(capex ? (line.wbsGlCode || request.wbsNumber || '-') : (line.costCenter || request.costCenter || '-'))}</td><td>${esc(line.quantity ?? 0)}</td><td>${esc(money(line.unitPrice || 0, request.currency || 'USD'))}</td><td>${esc(money(line.total ?? Number(line.quantity || 0)*Number(line.unitPrice || 0), request.currency || 'USD'))}</td></tr>`).join('') || '<tr><td colspan="9">No line items entered.</td></tr>'}</tbody><tfoot><tr><td colspan="8">Total PO Value</td><td>${esc(money(requestTotal(request),request.currency || 'USD'))}</td></tr></tfoot></table></div><p class="email-attachment-instruction">Please review the request details and line items. Attach the request PDF and any listed supporting documents before sending.</p><p class="email-signature">Thank you,<br><strong>${esc(request.requestorName || 'Requestor')}</strong></p>`;
  const metadata = Array.isArray(request.supportingDocuments) ? request.supportingDocuments : (Array.isArray(request.attachments) ? request.attachments : []);
  const fileItems = state.emailPreviewFiles.length ? state.emailPreviewFiles.map(file=>({name:file.name,size:file.size})) : metadata.map(file=>({name:file.name || file.filename || 'Supporting document',size:Number(file.size || 0)}));
  const allFiles = [{name:`${request.requestId}-Details.pdf`, size:null}, ...fileItems];
  $('#email-preview-attachment-count').textContent = `${allFiles.length} file${allFiles.length===1?'':'s'}`;
  $('#email-preview-attachment-note').textContent = 'On Windows with classic Outlook installed, the formatted draft includes the request PDF and selected supporting documents. Other email applications may require manual attachment.';
  $('#email-preview-attachments').innerHTML = allFiles.map((file,index)=>`<div class="email-attachment-row"><span class="email-file-icon ${index===0?'pdf':'support'}">${index===0?'PDF':esc(String(file.name).split('.').pop() || 'FILE').slice(0,4).toUpperCase()}</span><div><strong>${esc(file.name)}</strong><small>${index===0?'Formatted request summary':(file.size ? `${Math.max(1,Math.round(file.size/1024))} KB · Supporting document`:'Supporting document · file metadata only')}</small></div><span class="email-file-ready" title="Attach this file manually">ADD</span></div>`).join('');
  switchView('email');
}
function normalizePreviewRecipients(value, fieldName) {
  const raw = clean(value);
  if (!raw) return '';
  const addresses = raw.split(/[;,]+/).map(item => item.trim()).filter(Boolean);
  const invalid = addresses.filter(address => !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(address));
  if (invalid.length) throw new Error(`Check the ${fieldName} email address(es): ${invalid.join(', ')}`);
  return [...new Set(addresses)].join(', ');
}
function emailPreviewRecipients() {
  return {
    cc: normalizePreviewRecipients($('#email-preview-cc')?.value, 'Cc'),
    bcc: normalizePreviewRecipients($('#email-preview-bcc')?.value, 'Bcc')
  };
}
function buildEmailComposeBody(request, files = []) {
  const capex = String(request.fundingType || '').toUpperCase() === 'CAPEX';
  const companyCode = [request.companyCode, request.companyCodeDescription, request.companyCodeCountry ? `(${request.companyCodeCountry})` : ''].filter(Boolean).join(' - ') || 'Not supplied';
  const accountAssignment = capex ? `WBS ${request.wbsNumber || '-'}` : `Cost Center ${request.costCenter || '-'}`;
  const infoRows = [
    ['Request ID', request.requestId], ['PO Title', request.title || '-'], ['Region', request.region || '-'],
    ['Request Date', dateLabel(request.requestDate || request.createdAt)], ['Current Status', request.statusLabel || statusDisplayLabel(request.status, request)],
    ['Vendor Name', request.vendorName || '-'], ['Vendor Number', request.vendorNumber || '-'], ['Vendor Email', request.vendorEmail || '-'],
    ['Company Code', companyCode], ['Plant Code', request.plantCode || request.deliveryAddress || '-'],
    ['Requestor Name', request.requestorName || '-'], ['Requestor Email', request.requestorEmail || '-'],
    ['Funding Type', request.fundingType || '-'], ['Account Assignment', accountAssignment], ['Delivery Frequency', request.deliveryFrequency || '-'],
    ['Start Delivery Date', dateLabel(request.startDeliveryDate)], ['End Delivery Date', dateLabel(request.endDeliveryDate)],
    ['Delivery Count', request.deliveryCount ?? request.numberOfTimes ?? '-'], ['Currency', request.currency || '-'],
    ['PO Value', money(requestTotal(request), request.currency || 'USD')]
  ];
  if (request.oroNumber) infoRows.push(['ORO', request.oroNumber]);
  if (request.poNumber) infoRows.push(['PO Number', request.poNumber]);
  if (request.requesterNotes || request.notes) infoRows.push(['Request Notes', request.requesterNotes || request.notes]);
  const lines = Array.isArray(request.lineItems) ? request.lineItems : [];
  const lineText = lines.length ? lines.map((line, index) => {
    const code = capex ? (line.wbsGlCode || request.wbsNumber || '-') : (line.costCenterGlCode || line.glCode || '-');
    const costCenterOrWbs = capex ? (line.wbsNumber || line.wbsGlCode || request.wbsNumber || '-') : (line.costCenter || request.costCenter || '-');
    const total = line.total ?? (Number(line.quantity || 0) * Number(line.unitPrice || 0));
    return `${index + 1}. Type: ${line.type || '-'} | GL Code: ${line.glCode || code} | Description: ${manualLineDescription(line) || '-'} | Delivery Date: ${dateLabel(line.deliveryDate)} | Cost Center / WBS: ${costCenterOrWbs} | Quantity: ${line.quantity ?? 0} | Unit Price: ${money(line.unitPrice || 0, request.currency || 'USD')} | Total: ${money(total, request.currency || 'USD')}`;
  }).join('\r\n') : 'No line items entered.';
  const savedFiles = Array.isArray(request.supportingDocuments) ? request.supportingDocuments : (Array.isArray(request.attachments) ? request.attachments : []);
  const selectedFiles = files.length ? files.map(file => file.name || file.filename).filter(Boolean) : savedFiles.map(file => file.name || file.filename).filter(Boolean);
  const attachmentNames = [`${request.requestId}-Details.pdf`, ...selectedFiles];
  return [
    'Hello GRW Team,', '',
    'A new PO request has been submitted and is ready for Procurement review.',
    'Could you please raise the PO based on the information below?', '',
    'REQUEST DETAILS',
    ...infoRows.map(([label, value]) => `${label}: ${String(value ?? '-').replace(/[\r\n]+/g, ' ')}`), '',
    'PO LINE ITEMS',
    'No. | Type | GL Code | Description | Delivery Date | Cost Center / WBS | Quantity | Unit Price | Total',
    lineText, '',
    'ATTACHMENTS TO ADD BEFORE SENDING',
    ...attachmentNames.map(name => `- ${String(name).replace(/[\r\n]+/g, ' ')}`),
    'Please attach the request PDF and listed supporting documents to this message before sending.', '',
    'Thanks,', request.requestorName || 'Requestor'
  ].join('\r\n');
}
async function emailFilesPayload(files = []) {
  const selected = (Array.isArray(files) ? files : []).filter(file => file && typeof file.arrayBuffer === 'function' && typeof file.name === 'string');
  const payload = [];
  for (const file of selected) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    payload.push({ filename: file.name, contentType: file.type || 'application/octet-stream', dataBase64: btoa(binary) });
  }
  return payload;
}
async function openEmailComposer(request = state.emailPreviewRequest, files = state.emailPreviewFiles || [], recipients = null) {
  if (!request || !request.requestId) { notify('Email unavailable', 'Open a submitted PO request first.', 'error'); return false; }
  let cc = '', bcc = '';
  try {
    if (recipients) {
      cc = normalizePreviewRecipients(recipients.cc, 'Cc');
      bcc = normalizePreviewRecipients(recipients.bcc, 'Bcc');
    } else if (state.emailPreviewRequest?.requestId === request.requestId) {
      const checked = emailPreviewRecipients(); cc = checked.cc; bcc = checked.bcc;
    }
  } catch (error) { notify('Check email recipients', error.message, 'error'); return false; }
  const to = 'grw-global-p2prequests@coca-cola.com';
  const subject = `[TCCC PO REQUEST] PO Creation Request Submitted: ${request.requestId} | ${String(request.title || 'PO request').replace(/[\r\n]+/g, ' ')}`;
  const body = buildEmailComposeBody(request, Array.isArray(files) ? files : []);

  // On a locally opened Windows portal, ask the local server to create an HTML-formatted Outlook draft
  // with the request PDF and selected supporting files attached. This only displays the draft; it never sends.
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(String(window.location.hostname || '').toLowerCase());
  if (localHost) {
    try {
      const supportingDocuments = await emailFilesPayload(files);
      const response = await fetch('/api/email/open-outlook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.requestId, cc, bcc, supportingDocuments })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.opened) {
        notify('Formatted Outlook draft opened', `The message includes the request details, line-item table and ${data.attachmentCount || 1} attachment(s). Review it and press Send yourself. Nothing was sent automatically.`);
        return true;
      }
      // Fall back only for environments where desktop Outlook automation is not available (e.g. new Outlook, non-Windows, remote browser).
      if (!['OUTLOOK_UNAVAILABLE', 'LOCAL_ONLY'].includes(data.code) && response.status !== 404 && response.status !== 501 && response.status !== 503) {
        notify('Could not open Outlook draft', data.error || 'Please check the submitted request and try again.', 'error');
        return false;
      }
    } catch (error) {
      // Network/old-version route failures fall back to the standard mail link below.
    }
  }

  // Browser mailto fallback: basic text only. Standard mail links cannot set an HTML body or attach local files.
  const query = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
  if (cc) query.push(`cc=${encodeURIComponent(cc)}`);
  if (bcc) query.push(`bcc=${encodeURIComponent(bcc)}`);
  const composeUrl = `mailto:${to}?${query.join('&')}`;
  if (composeUrl.length > 28000) {
    notify('Email details are too long', 'This request is too large to prefill safely through a mail link. Use the on-screen preview to copy the details into a new message.', 'error');
    return false;
  }
  const link = document.createElement('a');
  link.href = composeUrl; link.rel = 'noopener'; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  notify('Email compose opened', 'Your default email app should open with the GRW recipient, subject and request details. This fallback cannot format HTML tables or attach files automatically, so attach the PDF/supporting documents manually, review, then send yourself. Nothing was sent automatically.');
  return true;
}
function emailDraft(request) {
  openEmailComposer(request, [], {});
}
async function unlockReviewerConsole() {
  if (state.reviewerMode) {
    if (!window.confirm('Exit Reviewer Console and return to the requester workspace?')) return;
    state.reviewerKey = '';
    state.reviewerMode = false;
    localStorage.removeItem(REVIEWER_STORAGE_KEY);
    state.requests = [];
    document.body.classList.remove('reviewer-mode');
    $('#reviewer-access').textContent = 'Reviewer console ↗';
    closeModal(); resetForm(); switchView('home');
    notify('Requester view', 'Reviewer actions are locked again.');
    return;
  }
  openReviewerLogin();
}
function openReviewerLogin() {
  const modal=$('#reviewer-login-modal'); if(!modal)return;
  $('#reviewer-login-error').textContent='';
  $('#reviewer-key-input').value='';
  $('#reviewer-key-input').type='password';
  $('#reviewer-password-toggle').textContent='Show';
  $('#reviewer-password-toggle').setAttribute('aria-label','Show password');
  $('#reviewer-password-toggle').setAttribute('aria-pressed','false');
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
  window.setTimeout(()=>$('#reviewer-key-input')?.focus(),30);
}
function closeReviewerLogin() {
  const modal=$('#reviewer-login-modal'); if(!modal||modal.classList.contains('hidden'))return;
  modal.classList.add('hidden');
  $('#reviewer-login-form')?.reset();
  $('#reviewer-login-error').textContent='';
  $('#reviewer-key-input').type='password';
  $('#reviewer-password-toggle').textContent='Show';
  document.body.style.overflow='';
  $('#reviewer-access')?.focus({preventScroll:true});
}
async function submitReviewerLogin(event) {
  event.preventDefault();
  const input=$('#reviewer-key-input'), submit=$('#reviewer-login-submit'), errorNode=$('#reviewer-login-error');
  const key=clean(input.value);
  if(!key){errorNode.textContent='Enter your reviewer access key.';input.focus();return;}
  submit.disabled=true;submit.textContent='Verifying access…';errorNode.textContent='';
  try {
    await api('/api/reviewer/unlock',{method:'POST',body:{key},headers:{}});
    state.reviewerKey=key;state.reviewerMode=true;
    localStorage.setItem(REVIEWER_STORAGE_KEY,key);
    document.body.classList.add('reviewer-mode');
    $('#reviewer-access').textContent='Exit reviewer mode';
    closeReviewerLogin();
    await reloadRequests();
    switchView('overview');
    notify('Reviewer Console unlocked','Access was verified. You can now review requests, update status and manage procurement tracking.');
  } catch(err) {
    state.reviewerKey='';state.reviewerMode=false;
    localStorage.removeItem(REVIEWER_STORAGE_KEY);
    document.body.classList.remove('reviewer-mode');
    errorNode.textContent=err.message||'Access could not be verified. Check the key and try again.';
    input.value='';input.type='password';input.focus();
    $('#reviewer-password-toggle').textContent='Show';$('#reviewer-password-toggle').setAttribute('aria-pressed','false');
  } finally {
    submit.disabled=false;submit.innerHTML='Unlock Reviewer Console <span>→</span>';
  }
}

async function exportRequestsExcel() {
  try {
    const response = await fetch('/api/requests/export.xlsx', { headers: state.reviewerKey ? { 'X-Reviewer-Key': state.reviewerKey } : {} });
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* keep fallback */ }
      throw new Error(data.error || `Excel export failed (${response.status}).`);
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href; link.download = `po-requests-${localDateInput()}.xlsx`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 30000);
    notify('Excel export ready', 'The workbook contains exactly the 20 approved columns and one row per PO request. PO Value includes all line items.');
  } catch (error) { notify('Could not export Excel', error.message, 'error'); }
}
function syncRegionChange(resetCenter = true) {
  const region = $('#region').value;
  populateCompanyCodeOptions(region, !resetCenter);
  populateCostCenters(region, !resetCenter);
  populateCurrencyOptions(region, true);
  if (resetCenter) $('#cost-center').value = '';
  state.lineItems.forEach(line => { if (resetCenter) line.costCenter = ''; });
  renderLineItems();
  syncSearchableSelects();
}
function attachEvents() {
  $('#reviewer-access').addEventListener('click', unlockReviewerConsole);
  $('#supporting-documents').addEventListener('change', handleSupportingFileSelection);
  const supportingDropzone = $('#supporting-dropzone');
  if (supportingDropzone) {
    ['dragenter', 'dragover'].forEach(type => supportingDropzone.addEventListener(type, event => {
      event.preventDefault(); event.stopPropagation();
      supportingDropzone.classList.add('is-dragging');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }));
    ['dragleave', 'dragend'].forEach(type => supportingDropzone.addEventListener(type, event => {
      event.preventDefault();
      if (!supportingDropzone.contains(event.relatedTarget)) supportingDropzone.classList.remove('is-dragging');
    }));
    supportingDropzone.addEventListener('drop', event => {
      event.preventDefault(); event.stopPropagation(); supportingDropzone.classList.remove('is-dragging');
      addSupportingFiles(event.dataTransfer?.files || []);
    });
  }
  renderSupportingFiles();
  document.addEventListener('click', async event => {
    const reportOpenButton = event.target.closest('[data-report-open]');
    if(reportOpenButton){ event.preventDefault(); if(state.reviewerMode) await showDetails(reportOpenButton.dataset.reportOpen); return; }
    const reportSortButton = event.target.closest('[data-report-sort]');
    if(reportSortButton){ event.preventDefault(); const field=reportSortButton.dataset.reportSort; const current=state.reportSort||'requestDate-desc'; state.reportSort=current===`${field}-asc`?`${field}-desc`:`${field}-asc`; state.reportPage=1; renderReports(); return; }
    const removeSupportingFile = event.target.closest('[data-remove-supporting-file]');
    if (removeSupportingFile) {
      event.preventDefault();
      const index = Number(removeSupportingFile.dataset.removeSupportingFile);
      if (Number.isInteger(index) && index >= 0 && index < state.supportingFiles.length) {
        state.supportingFiles.splice(index, 1);
        syncSupportingFileInput(); renderSupportingFiles();
        updateSaveNote(state.editingId ? 'Unsaved edits' : 'Changes are not saved yet');
      }
      return;
    }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) { event.preventDefault(); switchView(viewButton.dataset.view); return; }
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) {
      const target = pageButton.dataset.page;
      const totalPages = Math.max(1, Math.ceil(filteredRequests().length / state.requestPageSize));
      if (target === 'prev') state.requestPage = Math.max(1, state.requestPage - 1);
      else if (target === 'next') state.requestPage = Math.min(totalPages, state.requestPage + 1);
      renderRequests();
      return;
    }
    const wizardNav = event.target.closest('[data-wizard-nav]');
    if (wizardNav) { event.preventDefault(); goToWizardStep(Number(wizardNav.dataset.wizardNav)); return; }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      event.preventDefault();
      const action = actionButton.dataset.action;
      if (action === 'home-reviewer-console') { if (state.reviewerMode) switchView('overview'); else await unlockReviewerConsole(); return; }
      if (action === 'create') openCreateView();
      if (action === 'toggle-saved-drafts') { renderSavedDraftsPanel($('#saved-drafts-panel').classList.contains('hidden')); return; }
      if (action === 'close-saved-drafts') { $('#saved-drafts-panel')?.classList.add('hidden'); return; }
      if (action === 'resume-local-draft') {
        const draft = getLocalDrafts().find(item => item.id === actionButton.dataset.draftId);
        if (!draft) { notify('Draft not found', 'This draft may have been deleted from this browser.', 'error'); renderSavedDraftsPanel(true); return; }
        openCreateView({ ...draft.request, _localDraftId: draft.id });
        $('#saved-drafts-panel')?.classList.add('hidden');
        state.localDraftId = draft.id; state.editingId = ''; state.editingMode = 'local-draft';
        $('#editing-request-id').value = '';
        notify('Draft resumed', 'Continue entering details, then Save Draft again or submit. Reattach supporting files if needed.');
        return;
      }
      if (action === 'delete-local-draft') {
        const draft = getLocalDrafts().find(item => item.id === actionButton.dataset.draftId);
        if (draft && window.confirm(`Delete the saved draft “${draft.title || 'Untitled Request'}”?`)) { deleteLocalDraft(draft.id); renderSavedDraftsPanel(true); notify('Draft deleted', 'The saved draft was removed from this browser.'); }
        return;
      }
      if (action === 'copy-email-tracking') {
        const code = state.emailPreviewTrackingCode || '';
        if (!code) return;
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => notify('Tracking code copied', 'Keep this code private.')).catch(() => window.prompt('Copy your private tracking code:', code));
        else window.prompt('Copy your private tracking code:', code);
        return;
      }
      if (action === 'open-email-compose' || action === 'download-email-preview') {
        // This action opens the pre-filled mail composer; it never downloads a draft file.
        await openEmailComposer(state.emailPreviewRequest, state.emailPreviewFiles || [], null);
        return;
      }
      if (action === 'email-preview-back') { switchView(state.emailPreviewReturnView || 'track'); return; }
      if (action === 'print-email-preview') { if (state.emailPreviewRequest) printRequestDocument(state.emailPreviewRequest); return; }
      if (action === 'refresh-status') { trackRequest({ page: actionButton.dataset.trackPage === 'true' }); return; }
      if (action === 'cancel-form') { if (state.reviewerMode) switchView('requests'); else { if (window.confirm('Clear the current form and start a new request?')) resetForm(); switchView('create'); } }
      if (action === 'copy-line') {
        if (state.lineItems.length >= 20) { notify('Maximum line items reached', 'A PO creation request can contain no more than 20 line items.', 'error'); return; }
        const tr = event.target.closest('tr[data-line-id]');
        const sourceIndex = state.lineItems.findIndex(line => line.id === tr?.dataset.lineId);
        if (sourceIndex >= 0) {
          const copy = { ...state.lineItems[sourceIndex], id: cryptoId() };
          state.lineItems.splice(sourceIndex + 1, 0, copy);
          renderLineItems();
          updateSaveNote(state.editingId ? 'Unsaved edits' : 'Changes are not saved yet');
          notify('Line item copied', 'A duplicate row was added below the original. Edit its description, GL code, quantity or price as needed.');
        }
        return;
      }
      if (action === 'delete-line') {
        const tr = event.target.closest('tr[data-line-id]');
        state.lineItems = state.lineItems.filter(line => line.id !== tr?.dataset.lineId);
        if (!state.lineItems.length) state.lineItems.push(lineDefault());
        renderLineItems();
        updateSaveNote(state.editingId ? 'Unsaved edits' : 'Changes are not saved yet');
        return;
      }
      if (action === 'select-track-request') {
        const selectedRequest = state.trackSearchResults.find(request => request.requestId === (actionButton.dataset.requestId || ''));
        if (selectedRequest) {
          state.trackProgressRequestId = selectedRequest.requestId;
          $$('[data-track-row]').forEach(row => row.classList.toggle('track-row-selected', row.dataset.trackRow === selectedRequest.requestId));
          $$('[data-action="select-track-request"]').forEach(button => button.setAttribute('aria-pressed', button.dataset.requestId === selectedRequest.requestId ? 'true' : 'false'));
          renderTrackProgress(selectedRequest);
        }
        return;
      }
      if (action === 'open-track-request' || action === 'use-track-id') {
        await openTrackedRequest(actionButton.dataset.requestId || '');
        return;
      }
    }
    const filterButton = event.target.closest('[data-filter-status]');
    if (filterButton) {
      state.requestStatus = filterButton.dataset.filterStatus;
      state.requestRegion = '';
      state.requestPage = 1;
      switchView('requests');
      renderRequests();
    }
    const reviewerTabButton = event.target.closest('[data-reviewer-panel-tab]');
    if (reviewerTabButton) { state.reviewerPanelTab = reviewerTabButton.dataset.reviewerPanelTab || 'overview'; renderReviewerDetailPanel(); return; }
    const reviewerDeleteButton = event.target.closest('[data-review-delete]');
    if (reviewerDeleteButton) { event.stopPropagation(); await deleteReviewerRequest(reviewerDeleteButton.dataset.reviewDelete); return; }
    const reviewerSelectButton = event.target.closest('[data-review-select]');
    if (reviewerSelectButton) {
      state.reviewerSelectedId = reviewerSelectButton.dataset.reviewSelect || '';
      state.reviewerPanelTab = 'overview';
      renderRequests();
      if (reviewerSelectButton.dataset.reviewMode === 'update' && window.matchMedia('(max-width: 900px)').matches) $('#reviewer-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (event.target.closest('#reviewer-panel-save')) { await saveReviewerPanelChanges(); return; }
    if (event.target.closest('#review-search-button')) { state.requestPage = 1; renderRequests(); return; }
    const openButton = event.target.closest('[data-open-request]');
    if (openButton) { await showDetails(openButton.dataset.openRequest); return; }
    const masterEditButton = event.target.closest('[data-master-edit-index]');
    if (masterEditButton) { openMasterEditor(Number(masterEditButton.dataset.masterEditIndex)); return; }
    const masterRemoveButton = event.target.closest('[data-master-remove-index]');
    if (masterRemoveButton) { await removeMasterEntry(Number(masterRemoveButton.dataset.masterRemoveIndex)); return; }
    if (event.target.closest('[data-master-cancel]')) { $('#master-editor').classList.add('hidden'); state.masterEditIndex = null; return; }
    const masterTabButton = event.target.closest('[data-master-tab]');
    if (masterTabButton) {
      state.masterTab = masterTabButton.dataset.masterTab;
      $$('.master-tab').forEach(tab => tab.classList.toggle('active', tab === masterTabButton));
      $('#master-search').value = ''; state.masterSearch = '';
      const labels = {gl:'GL accounts',costCenters:'cost centers',plants:'plant codes',regions:'regions',reviewerNames:'updated-by names',companyCodes:'company codes',currencies:'currencies'};
      $('#master-search').placeholder = `Search ${labels[state.masterTab] || 'master data'}`;
      $('#master-editor').classList.add('hidden'); state.masterEditIndex = null;
      renderMasterTable();
      return;
    }
    if (event.target.closest('#master-add-record')) { openMasterEditor(null); return; }
    if (event.target.closest('#master-refresh')) { try { await reloadMasterData(); notify('Master data refreshed', 'GLs, plants, cost centers, regions, currencies and reviewer names are current.'); } catch(error) { notify('Refresh failed', error.message, 'error'); } return; }
    const setStatusButton = event.target.closest('[data-set-status]');
    if (setStatusButton) { await changeStatus(setStatusButton.dataset.setStatus); return; }
    const detailTabButton = event.target.closest('[data-detail-tab]');
    if (detailTabButton) { state.detailTab = detailTabButton.dataset.detailTab; if (state.currentDetailRecord) renderRequestDetailsPage(state.currentDetailRecord, state.detailSource); return; }
    const detailActionButton = event.target.closest('[data-detail-action]');
    if (detailActionButton) {
      const action = detailActionButton.dataset.detailAction;
      if (action === 'close') { closeModal(); return; }
      if (action === 'back') { switchView(state.detailReturnView || (state.reviewerMode ? 'requests' : 'track')); return; }
      if (action === 'refresh-details') { if (state.detailSource === 'reviewer' && state.reviewerMode) await showDetails(state.currentDetailId); else await openTrackedRequest(state.currentDetailId); return; }
      if (action === 'print') { printRequestDocument(state.currentDetailRecord); return; }
      if (action === 'save-tracking') { await saveTrackingDetails(); return; }
      if (action === 'email-preview' || action === 'email') {
        const record = state.currentDetailRecord || state.requests.find(item => item.requestId === state.currentDetailId);
        if (record) {
          if (action === 'email') emailDraft(record);
          else openEmailPreview(record, [], 'details');
        }
        return;
      }
            return;
    }
  });

  $('#open-sidebar').addEventListener('click', event => { event.preventDefault(); openMobileNav(); });
  $('#close-sidebar').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); closeMobileNav(); });
  $('#mobile-scrim').addEventListener('click', event => { event.preventDefault(); closeMobileNav(); });
  $('#reviewer-login-form').addEventListener('submit', submitReviewerLogin);
  $('#reviewer-login-close').addEventListener('click', closeReviewerLogin);
  $('#reviewer-login-cancel').addEventListener('click', closeReviewerLogin);
  $('#reviewer-login-modal').addEventListener('click', event => { if(event.target === $('#reviewer-login-modal')) closeReviewerLogin(); });
  $('#reviewer-password-toggle').addEventListener('click', () => { const input=$('#reviewer-key-input'); const reveal=input.type==='password'; input.type=reveal?'text':'password'; $('#reviewer-password-toggle').textContent=reveal?'Hide':'Show'; $('#reviewer-password-toggle').setAttribute('aria-label',reveal?'Hide password':'Show password'); $('#reviewer-password-toggle').setAttribute('aria-pressed',String(reveal)); input.focus(); });
  window.addEventListener('resize', () => { if(window.innerWidth > 820) closeMobileNav(); });
  $('#close-detail').addEventListener('click', closeModal);
  $('#detail-modal').addEventListener('click', event => { if (event.target === $('#detail-modal')) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeModal(); closeReviewerLogin(); closeMobileNav(); const menu=$('#open-sidebar'); if(menu) menu.focus({preventScroll:true}); } });
  window.addEventListener('afterprint', restoreAfterReportPrint);

  $('#region').addEventListener('change', () => syncRegionChange(true));
  $('#cost-center').addEventListener('change', () => {
    const center = findCenter($('#cost-center').value);
    if (center?.currency) {
      const currencies = getCurrencies($('#region').value);
      if (currencies.includes(center.currency)) { $('#currency').value = center.currency; refreshSearchableSelect($('#currency')); }
    }
    state.lineItems.forEach(line => { if (!line.costCenter) line.costCenter = $('#cost-center').value; });
    renderLineItems();
  });
  $('#currency').addEventListener('change', () => { renderLineItems(); syncFormSummary(); });
  $$('input[name="funding-type"]').forEach(radio => radio.addEventListener('change', () => setFundingMode(getFundingType())));
  $('#wbs-number').addEventListener('input', () => { state.lineItems.forEach(line => { if (!mappedProjectCategory($('#wbs-number').value)) line.wbsCategory = ''; }); renderLineItems(); });
  $('#add-line').addEventListener('click', () => {
    if (state.lineItems.length >= 20) { notify('Maximum line items reached', 'A PO creation request can contain no more than 20 line items. Create a separate request for additional items.', 'error'); return; }
    state.lineItems.push(lineDefault()); renderLineItems();
  });
  $('#clear-lines').addEventListener('click', () => { state.lineItems = [lineDefault()]; renderLineItems(); notify('Line items cleared', 'A blank line item is ready to fill in.'); });
  $('#clear-form').addEventListener('click', () => { if (window.confirm('Clear all values in this form? Unsaved changes will be lost.')) { resetForm(); notify('Form cleared', 'Enter the request details again.'); } });
  $('#save-draft').addEventListener('click', saveDraft);
  $('#submit-request').addEventListener('click', submitRequest);
  $('#track-search-form').addEventListener('submit', event => { event.preventDefault(); searchSubmittedRequests(); });
  $('#track-refresh-results')?.addEventListener('click', () => { if (!state.trackSearchCriteria) { notify('Nothing to refresh', 'Run a search first, then refresh the latest request statuses.', 'error'); return; } searchSubmittedRequests({ auto: true, manualRefresh: true }); });
  $('#track-auto-refresh-toggle')?.addEventListener('change', event => { configureTrackAutoRefresh(event.target.checked); if (event.target.checked) notify('Auto-refresh enabled', 'Track My Request will refresh every 30 seconds while this page is open.'); });
  $('#track-clear-filters').addEventListener('click', () => {
    $('#track-request-id-search').value = ''; $('#track-requestor-search').value = ''; $('#track-vendor-search').value = ''; $('#track-code-search').value = '';
    $('#track-region-filter').value = ''; $('#track-status-filter').value = ''; $('#track-date-from').value = ''; $('#track-date-to').value = ''; $('#track-sort').value = 'request-desc';
    if (trackAutoSearchTimer) window.clearTimeout(trackAutoSearchTimer); trackAutoSearchTimer = null; clearTrackSearchResults();
  });
  ['track-region-filter','track-status-filter','track-date-from','track-date-to'].forEach(id => {
    $(`#${id}`).addEventListener('change', queueTrackAutoSearch);
  });
  ['track-request-id-search','track-requestor-search','track-vendor-search'].forEach(id => {
    $(`#${id}`).addEventListener('input', event => { const value = event.target.value.trim(); if (value.length >= 3 || value.length === 0) queueTrackAutoSearch(); });
  });
  $('#track-code-search').addEventListener('change', () => { if ($('#track-request-id-search').value.trim().length >= 3) queueTrackAutoSearch(); });
  $('#track-sort').addEventListener('change', () => {
    if (state.trackSearchCriteria) state.trackSearchCriteria.sortBy = $('#track-sort').value;
    if (state.trackSearchResults.length) renderRequestSearchResults({ requests: state.trackSearchResults, total: state.trackSearchTotal, limited: state.trackSearchTotal > state.trackSearchResults.length });
  });
  $('#track-export-results').addEventListener('click', exportTrackSearchResults);
  $('#wizard-prev').addEventListener('click', () => setWizardStep(state.currentWizardStep - 1));
  $('#wizard-next').addEventListener('click', () => nextWizardStep());
  $('#overview-export').addEventListener('click', exportRequestsExcel);
  $('#requests-export').addEventListener('click', exportRequestsExcel);
  $('#report-generate').addEventListener('click', applyReportFilters);
  $('#report-clear-filters').addEventListener('click', clearReportFilters);
  $$('.report-quick-range').forEach(button => button.addEventListener('click', () => selectReportRange(button.dataset.reportRange)));
  ['report-from-date','report-to-date'].forEach(id => $(`#${id}`).addEventListener('change', () => { state.reportDatePreset=''; syncReportQuickRanges(); }));
  $('#report-export-excel').addEventListener('click', exportReportXlsx);
  $('#report-export-pdf').addEventListener('click', printReportSummary);
  $('#report-columns-toggle').addEventListener('click', () => { const menu=$('#report-columns-menu'), show=menu.classList.contains('hidden'); menu.classList.toggle('hidden',!show); $('#report-columns-toggle').setAttribute('aria-expanded',String(show)); });
  $('#report-columns-menu').addEventListener('change', event => { if(event.target.matches('[data-report-column]')) syncReportColumnVisibility(); });
  $('#report-page-size').addEventListener('change', event => { state.reportPageSize=Math.max(1,Number(event.target.value)||10);state.reportPage=1;renderReports(); });
  $('#report-page-prev').addEventListener('click', () => { state.reportPage=Math.max(1,state.reportPage-1);renderReports(); });
  $('#report-page-next').addEventListener('click', () => { const total=reportFilteredRequests().length;state.reportPage=Math.min(Math.ceil(total/state.reportPageSize)||1,state.reportPage+1);renderReports(); });
  ['report-from-date','report-to-date','report-region-filter','report-status-filter'].forEach(id=>{ $(`#${id}`).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();applyReportFilters();}}); });
  ['report-vendor-filter','report-requestor-filter'].forEach(id=>{ $(`#${id}`).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();applyReportFilters();}}); });

  $('#request-search').addEventListener('input', event => { state.requestSearch = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#status-filter').addEventListener('change', event => { state.requestStatus = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#region-filter').addEventListener('change', event => { state.requestRegion = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#vendor-number-filter').addEventListener('input', event => { state.requestVendorNumber = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#requestor-filter').addEventListener('input', event => { state.requestorFilter = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#po-number-filter').addEventListener('input', event => { state.requestPoFilter = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#oro-number-filter').addEventListener('input', event => { state.requestOroFilter = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#request-date-from').addEventListener('change', event => { state.requestDateFrom = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#request-date-to').addEventListener('change', event => { state.requestDateTo = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#reviewer-select-all').addEventListener('change', event => {
    const boxes = $$('#requests-body [data-reviewer-row-check]');
    const visibleIds = boxes.map(box => box.dataset.reviewerRowCheck);
    state.reviewerSelectedRows = event.target.checked
      ? [...new Set([...state.reviewerSelectedRows, ...visibleIds])]
      : state.reviewerSelectedRows.filter(id => !visibleIds.includes(id));
    boxes.forEach(box => { box.checked = event.target.checked; box.closest('tr')?.classList.toggle('reviewer-row-checked', event.target.checked); });
  });
  document.addEventListener('change', event => {
    const box = event.target.closest('[data-reviewer-row-check]');
    if (!box) return;
    const id = box.dataset.reviewerRowCheck;
    state.reviewerSelectedRows = box.checked
      ? [...new Set([...state.reviewerSelectedRows, id])]
      : state.reviewerSelectedRows.filter(item => item !== id);
    box.closest('tr')?.classList.toggle('reviewer-row-checked', box.checked);
    const visible = $$('#requests-body [data-reviewer-row-check]');
    const picked = visible.filter(item => item.checked).length;
    const selectAll = $('#reviewer-select-all');
    if (selectAll) { selectAll.checked = visible.length > 0 && picked === visible.length; selectAll.indeterminate = picked > 0 && picked < visible.length; }
  });
  $('#request-sort').addEventListener('change', event => { state.requestSort = event.target.value; state.requestPage = 1; renderRequests(); });
  $('#request-page-size').addEventListener('change', event => { state.requestPageSize = Math.min(100, Math.max(10, Number(event.target.value) || 10)); state.requestPage = 1; renderRequests(); });
  $('#clear-request-filters').addEventListener('click', () => {
    state.requestSearch = ''; state.requestStatus = 'All statuses'; state.requestRegion = '';
    state.requestVendorNumber = ''; state.requestorFilter = ''; state.requestPoFilter = ''; state.requestOroFilter = '';
    state.requestDateFrom = ''; state.requestDateTo = ''; state.requestSort = 'updated-desc'; state.requestPageSize = 20; state.requestPage = 1;
    renderRequests();
  });
  $('#global-search').addEventListener('input', event => {
    const value = event.target.value;
    state.requestSearch = value;
    state.requestPage = 1;
    if (value && state.currentView !== 'requests') switchView('requests');
    $('#request-search').value = value;
    if (state.currentView === 'requests') renderRequests();
  });
  $('#global-search').addEventListener('keydown', event => { if (event.key === 'Enter') { state.requestSearch = event.target.value; state.requestPage = 1; switchView('requests'); renderRequests(); } });
  $('#master-search').addEventListener('input', event => { state.masterSearch = event.target.value; renderMasterTable(); });

  const formWatchIds = ['po-title','vendor-name','vendor-number','vendor-email','company-code','plant-code','requestor-name','requestor-email','request-notes','delivery-frequency','start-delivery','end-delivery','delivery-count'];
  formWatchIds.forEach(id => {
    const el = $(`#${id}`);
    el.addEventListener('input', () => { syncFormSummary(); updateSaveNote(state.editingId ? 'Unsaved edits' : 'Changes are not saved yet'); });
    el.addEventListener('change', () => { syncFormSummary(); updateSaveNote(state.editingId ? 'Unsaved edits' : 'Changes are not saved yet'); });
  });
  $('#po-form').addEventListener('input', event => {
    const tr = event.target.closest('tr[data-line-id]');
    if (!tr) return;
    const field = event.target.dataset.field;
    const line = state.lineItems.find(item => item.id === tr.dataset.lineId);
    if (!line || !field) return;
    if (field === 'quantity' || field === 'unitPrice') line[field] = event.target.value === '' ? '' : Number(event.target.value);
    else line[field] = event.target.value;
    recalculateLine(line);
    const totalEl = $('[data-line-total]', tr);
    if (totalEl) totalEl.textContent = money(line.total, $('#currency').value || 'USD');
    const glInputs = $$('input[readonly]', tr);
    const wbsInput = glInputs[0];
    const glInput = glInputs[1];
    if (wbsInput && getFundingType() === 'CAPEX' && mappedProjectCategory($('#wbs-number').value)) wbsInput.value = line.wbsGlCode || 'No mapping found';
    if (glInput) { glInput.value = line.glCode || ''; glInput.title = line.glDescription || 'Select a GL code'; }
    syncFormSummary();
    updateSaveNote(state.editingId ? 'Unsaved edits' : 'Changes are not saved yet');
  });
  $('#po-form').addEventListener('change', event => {
    const tr = event.target.closest('tr[data-line-id]');
    if (!tr) return;
    const field = event.target.dataset.field;
    const line = state.lineItems.find(item => item.id === tr.dataset.lineId);
    if (!line || !field) return;
    line[field] = event.target.value;
    if (field === 'type' || field === 'wbsCategory') {
      line.costCenterGlCode = '';
      recalculateLine(line);
      renderLineItems();
    } else if (field === 'costCenterGlCode') {
      const account = (state.master?.glAccounts || []).find(item => `${item.glNumber} - ${item.name}` === event.target.value);
      line.glCode = account?.glNumber || '';
      line.glDescription = account?.name || '';
      recalculateLine(line);
      renderLineItems();
    } else if (field === 'costCenter') {
      updateLineCenterOptions();
      syncFormSummary();
    } else {
      recalculateLine(line);
      syncFormSummary();
    }
    updateSaveNote(state.editingId ? 'Unsaved edits' : 'Changes are not saved yet');
  });
}
const searchableSelects = new WeakMap();
const openSearchableCombos = new Set();
function comboOptionRecords(select) {
  return [...select.options].map((option, index) => ({
    value: option.value,
    label: clean(option.textContent),
    index,
    disabled: option.disabled,
    search: `${option.value} ${option.textContent} ${option.dataset.search || ''}`.toLowerCase(),
  })).filter(option => option.value !== '' && !option.disabled);
}
function comboSelectedLabel(select) {
  const option = select.selectedOptions?.[0];
  return option && option.value !== '' ? clean(option.textContent) : '';
}
function refreshSearchableSelect(select) {
  const combo = searchableSelects.get(select);
  if (!combo) return;
  combo.toggle.disabled = select.disabled;
  combo.input.disabled = select.disabled;
  combo.input.setAttribute('aria-expanded', combo.open ? 'true' : 'false');
  combo.input.setAttribute('aria-disabled', select.disabled ? 'true' : 'false');
  if (!combo.open && document.activeElement !== combo.input) combo.input.value = comboSelectedLabel(select);
  if (combo.open) renderComboOptions(combo, combo.input.value);
}
function syncSearchableSelects(root = document) {
  $$('select.searchable-native', root).forEach(refreshSearchableSelect);
}
function selectAccessibleLabel(select) {
  const explicit = select.getAttribute('aria-label');
  if (explicit) return explicit;
  if (select.id) {
    const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
    if (label) return clean(label.textContent).replace('*', '').trim();
  }
  return 'Search options';
}
function searchableSelectOpen(combo) {
  if (combo.open || combo.select.disabled) return;
  combo.open = true;
  combo.filter = '';
  combo.wrapper.classList.add('is-open');
  combo.input.setAttribute('aria-expanded', 'true');
  combo.input.value = comboSelectedLabel(combo.select);
  combo.activeIndex = -1;
  renderComboOptions(combo, '');
  document.body.appendChild(combo.list);
  combo.list.classList.remove('hidden');
  openSearchableCombos.add(combo);
  positionSearchableList(combo);
  combo.input.select();
}
function positionSearchableList(combo) {
  if (!combo.open) return;
  const rect = combo.wrapper.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const maxHeight = Math.max(100, Math.min(228, window.innerHeight - 20));
  const roomBelow = window.innerHeight - rect.bottom - 8;
  const roomAbove = rect.top - 8;
  const useAbove = roomBelow < 150 && roomAbove > roomBelow;
  combo.list.style.left = `${left}px`;
  combo.list.style.width = `${width}px`;
  combo.list.style.maxHeight = `${Math.min(maxHeight, useAbove ? roomAbove : Math.max(100, roomBelow))}px`;
  combo.list.style.top = useAbove ? `${Math.max(8, rect.top - Math.min(maxHeight, roomAbove) - 4)}px` : `${Math.max(8, rect.bottom + 4)}px`;
}
function closeSearchableSelect(combo, restoreLabel = true) {
  if (!combo.open) return;
  combo.open = false;
  combo.wrapper.classList.remove('is-open');
  combo.input.setAttribute('aria-expanded', 'false');
  combo.list.classList.add('hidden');
  combo.wrapper.appendChild(combo.list);
  combo.list.style.left = '';
  combo.list.style.top = '';
  combo.list.style.width = '';
  combo.list.style.maxHeight = '';
  openSearchableCombos.delete(combo);
  if (restoreLabel) combo.input.value = comboSelectedLabel(combo.select);
}
function chooseComboValue(combo, value, manual = false) {
  if (combo.select.id === 'currency') value = clean(value).toUpperCase();
  let option = [...combo.select.options].find(item => item.value === value);
  if (!option && manual && combo.select.dataset.allowCustom === 'true') {
    option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.dataset.custom = 'true';
    if (combo.select.id === 'company-code') option.dataset.region = $('#region')?.value || '';
    combo.select.appendChild(option);
  }
  if (!option) return;
  combo.select.value = value;
  closeSearchableSelect(combo, false);
  combo.input.value = clean(option.textContent);
  refreshSearchableSelect(combo.select);
  combo.select.dispatchEvent(new Event('input', { bubbles: true }));
  combo.select.dispatchEvent(new Event('change', { bubbles: true }));
}
function renderComboOptions(combo, query = '') {
  const needle = clean(query).toLowerCase();
  const all = comboOptionRecords(combo.select);
  const matched = needle ? all.filter(option => option.search.includes(needle)) : all;
  const maxVisible = 35;
  const visible = matched.slice(0, maxVisible);
  let html = visible.map((option, index) => `<button type="button" class="searchable-option${option.value === combo.select.value ? ' selected' : ''}" role="option" aria-selected="${option.value === combo.select.value ? 'true' : 'false'}" data-combo-value="${attrEscape(option.value)}" data-combo-index="${index}" title="${attrEscape(option.label)}"><span>${htmlEscape(option.label)}</span>${option.value === combo.select.value ? '<b>✓</b>' : ''}</button>`).join('');
  const canManual = combo.select.dataset.allowCustom === 'true' && needle && !all.some(option => option.value.toLowerCase() === clean(query).toLowerCase());
  if (canManual) html += `<button type="button" class="searchable-option searchable-manual-option" data-combo-manual="true" data-combo-value="${attrEscape(clean(query))}"><span>Use “${htmlEscape(clean(query))}” as a manual value</span><b>↵</b></button>`;
  if (!html) html = `<div class="searchable-no-results">No matching options${combo.select.dataset.allowCustom === 'true' ? ' — type a value and use it manually' : ''}.</div>`;
  if (matched.length > maxVisible) html += `<div class="searchable-result-note">Showing ${maxVisible} of ${matched.length} matches. Type more to narrow the list.</div>`;
  combo.list.innerHTML = html;
  combo.items = [...combo.list.querySelectorAll('.searchable-option')];
  combo.activeIndex = -1;
  positionSearchableList(combo);
}
function enhanceSearchableSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  if (searchableSelects.has(select)) { refreshSearchableSelect(select); return; }
  const wrapper = document.createElement('div');
  wrapper.className = 'searchable-select';
  if (select.closest('.line-table')) wrapper.classList.add('compact');
  if (select.closest('.request-toolbar')) wrapper.classList.add('toolbar');
  if (select.dataset.allowCustom === 'true') wrapper.classList.add('allows-custom');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'searchable-control';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-label', selectAccessibleLabel(select));
  input.placeholder = select.dataset.placeholder || clean(select.options[0]?.textContent) || 'Search or select...';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'searchable-toggle';
  toggle.setAttribute('aria-label', `Open ${selectAccessibleLabel(select)} options`);
  toggle.innerHTML = '<span aria-hidden="true">⌄</span>';
  const list = document.createElement('div');
  list.className = 'searchable-options hidden';
  list.setAttribute('role', 'listbox');
  const parent = select.parentNode;
  parent.insertBefore(wrapper, select);
  wrapper.append(input, toggle, list, select);
  if (select.id) {
    const associatedLabel = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
    if (associatedLabel) associatedLabel.addEventListener('click', event => { event.preventDefault(); input.focus(); });
  }
  select.classList.add('searchable-native');
  const combo = { select, wrapper, input, toggle, list, open: false, activeIndex: -1, items: [] };
  searchableSelects.set(select, combo);
  select.addEventListener('change', () => refreshSearchableSelect(select));
  input.addEventListener('focus', () => searchableSelectOpen(combo));
  input.addEventListener('click', () => searchableSelectOpen(combo));
  input.addEventListener('input', () => {
    // Preserve the user's current keystrokes when opening the custom list. Opening a
    // closed combo normally restores its old selected label; without this ordering,
    // clearing a selected value can put that old value straight back into the field.
    const typedValue = input.value;
    if (!clean(typedValue) && combo.select.value) {
      combo.select.value = '';
      combo.select.dispatchEvent(new Event('input', { bubbles: true }));
      combo.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!combo.open) searchableSelectOpen(combo);
    input.value = typedValue;
    renderComboOptions(combo, typedValue);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeSearchableSelect(combo); input.blur(); return; }
    if (event.key === 'Tab') { closeSearchableSelect(combo); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!combo.open) searchableSelectOpen(combo);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      combo.activeIndex = Math.max(0, Math.min(combo.items.length - 1, (combo.activeIndex < 0 ? (delta > 0 ? -1 : combo.items.length) : combo.activeIndex) + delta));
      combo.items.forEach((item, i) => item.classList.toggle('active', i === combo.activeIndex));
      combo.items[combo.activeIndex]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && combo.open) {
      event.preventDefault();
      const active = combo.items[combo.activeIndex] || combo.items[0];
      if (active) chooseComboValue(combo, active.dataset.comboValue || '', active.dataset.comboManual === 'true');
      else if (select.dataset.allowCustom === 'true' && clean(input.value)) chooseComboValue(combo, clean(input.value), true);
    }
  });
  toggle.addEventListener('mousedown', event => event.preventDefault());
  toggle.addEventListener('click', event => {
    event.preventDefault();
    if (combo.open) closeSearchableSelect(combo);
    else { input.focus(); searchableSelectOpen(combo); }
  });
  list.addEventListener('mousedown', event => event.preventDefault());
  list.addEventListener('click', event => {
    const item = event.target.closest('.searchable-option');
    if (!item) return;
    chooseComboValue(combo, item.dataset.comboValue || '', item.dataset.comboManual === 'true');
  });
  refreshSearchableSelect(select);
}
function enhanceSearchableSelects(root = document) {
  if (root.matches?.('select')) enhanceSearchableSelect(root);
  $$('select', root).forEach(enhanceSearchableSelect);
}
function initSearchableSelects() {
  enhanceSearchableSelects(document);
  document.addEventListener('pointerdown', event => {
    for (const combo of [...openSearchableCombos]) {
      if (!combo.wrapper.contains(event.target) && !combo.list.contains(event.target)) {
        const query = clean(combo.input.value);
        const exact = [...combo.select.options].some(option => option.value.toLowerCase() === query.toLowerCase());
        const hasMatches = comboOptionRecords(combo.select).some(option => option.search.includes(query.toLowerCase()));
        if (combo.select.dataset.allowCustom === 'true' && query && !exact && !hasMatches) chooseComboValue(combo, query, true);
        else closeSearchableSelect(combo);
      }
    }
  });
  window.addEventListener('resize', () => openSearchableCombos.forEach(positionSearchableList));
  window.addEventListener('scroll', () => openSearchableCombos.forEach(positionSearchableList), true);
}


const WIZARD_STEPS = [
  { label: 'Basic Details', short: 'Basics' },
  { label: 'Vendor Information', short: 'Vendor' },
  { label: 'Requester & Accounting', short: 'Accounting' },
  { label: 'Delivery Schedule', short: 'Delivery' },
  { label: 'PO Line Items', short: 'Line items' },
  { label: 'Review & Submit', short: 'Review' },
];
function initializeWizard() {
  const form = $('#po-form');
  if (!form || $('#wizard-stepper')) return;
  const cards = [...form.querySelectorAll(':scope > .form-card')];
  const stepper = document.createElement('div');
  stepper.id = 'wizard-stepper';
  stepper.className = 'wizard-stepper';
  stepper.setAttribute('aria-label', 'PO request steps');
  stepper.innerHTML = `<div class="wizard-stepper-buttons">${WIZARD_STEPS.map((step, index) => `<button type="button" class="wizard-step-button" data-wizard-nav="${index}" aria-current="false"><span class="wizard-step-number">${index + 1}</span><span class="wizard-step-label">${htmlEscape(step.label)}</span></button>`).join('')}</div><div class="wizard-step-caption" id="wizard-step-caption">Step 1 of 6 · Basic Details</div>`;
  form.insertBefore(stepper, cards[0]);
  cards.forEach((card, index) => {
    const panel = document.createElement('div');
    panel.className = 'wizard-panel';
    panel.dataset.wizardPanel = String(index);
    card.before(panel);
    panel.appendChild(card);
  });
  const reviewPanel = document.createElement('div');
  reviewPanel.className = 'wizard-panel';
  reviewPanel.dataset.wizardPanel = '5';
  reviewPanel.innerHTML = `<section class="form-card wizard-review-card"><div class="form-section-head"><div class="section-number">06</div><div><h2>Review & submit</h2><p>Confirm the request details and amounts before sending it to Procurement.</p></div><span class="required-key"><i></i> Final check</span></div><div id="wizard-review-content" class="wizard-review-content"></div><label class="wizard-confirm"><input id="wizard-confirm-details" type="checkbox" /> I confirm that the information provided is accurate and complete.</label></section>`;
  const footer = form.querySelector('.form-footer-actions');
  form.insertBefore(reviewPanel, footer);
  const clear = $('#clear-form');
  const previous = document.createElement('button');
  previous.type = 'button'; previous.id = 'wizard-prev'; previous.className = 'button button-secondary'; previous.textContent = '← Back';
  clear.before(previous);
  const next = document.createElement('button');
  next.type = 'button'; next.id = 'wizard-next'; next.className = 'button button-primary'; next.innerHTML = 'Next step <span>→</span>';
  $('#submit-request').before(next);
  $('#submit-request').textContent = 'Submit Request →';
  setWizardStep(0);
}
function wizardStepErrors(step) {
  const request = serializeForm();
  const errors = [];
  if (step === 0) {
    if (!request.region) errors.push('Select a region.');
    if (!request.title) errors.push('Enter a purchase order title.');
    if (!request.currency || !/^[A-Z]{3}$/.test(request.currency)) errors.push('Select a valid 3-letter currency code.');
  } else if (step === 1) {
    if (!request.vendorName) errors.push('Enter the vendor/company name.');
    if (!request.vendorNumber) errors.push('Enter the vendor number.');
    if (!request.companyCode) errors.push('Select a Company Code.');
    if (!request.plantCode) errors.push('Select a Plant Code or choose “I don’t know — Procurement to confirm”.');
    if (request.vendorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.vendorEmail)) errors.push('Enter a valid vendor contact email.');
  } else if (step === 2) {
    if (!request.requestorName) errors.push('Enter the requestor name.');
    if (request.requestorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.requestorEmail)) errors.push('Enter a valid requestor email.');
    if (request.fundingType === 'OPEX' && !request.costCenter) errors.push('Select or enter a cost center for OPEX.');
    if (request.fundingType === 'CAPEX' && !request.wbsNumber) errors.push('Enter the WBS number for CAPEX.');
    if (request.fundingType === 'CAPEX' && request.wbsNumber && !validWbsSuffix(request.wbsNumber)) errors.push('WBS number must end in 90XXX or 00XXX (for example, E-00001234-90100).');
  } else if (step === 3) {
    if (request.startDeliveryDate && request.endDeliveryDate && request.endDeliveryDate < request.startDeliveryDate) errors.push('End delivery date cannot be earlier than start delivery date.');
  } else if (step === 4) {
    if (!request.lineItems.length) errors.push('Add at least one line item.');
    if (request.lineItems.length > 20) errors.push('A PO creation request can contain no more than 20 line items. Split larger requirements into separate requests.');
    request.lineItems.forEach((line, index) => {
      const row = index + 1;
      if (!line.type) errors.push(`Line ${row}: select Goods or Service.`);
      if (!clean(line.description)) errors.push(`Line ${row}: enter a description.`);
      const sourceCode = request.fundingType === 'CAPEX' ? (line.wbsGlCode || line.glCode || line.wbsCategory) : (line.costCenterGlCode || line.glCode);
      if (!clean(sourceCode) || !clean(line.glCode)) errors.push(`Line ${row}: select a valid ${request.fundingType === 'CAPEX' ? 'WBS GL mapping' : 'Cost Center GL Code'} so the GL Code is resolved.`);
      if (!(Number(line.quantity) > 0) || !Number.isFinite(Number(line.quantity))) errors.push(`Line ${row}: quantity must be greater than zero.`);
      if (line.unitPrice === '' || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) errors.push(`Line ${row}: enter a valid unit price.`);
    });
  }
  return errors;
}
function setWizardStep(step) {
  const target = Math.max(0, Math.min(WIZARD_STEPS.length - 1, Number(step) || 0));
  state.currentWizardStep = target;
  $$('.wizard-panel').forEach(panel => panel.classList.toggle('active', Number(panel.dataset.wizardPanel) === target));
  $$('.wizard-step-button').forEach((button, index) => {
    button.classList.toggle('active', index === target);
    button.classList.toggle('completed', index < target);
    button.setAttribute('aria-current', index === target ? 'step' : 'false');
  });
  $('#wizard-prev').classList.toggle('hidden', target === 0);
  $('#wizard-next').classList.toggle('hidden', target === WIZARD_STEPS.length - 1);
  $('#submit-request').classList.toggle('hidden', target !== WIZARD_STEPS.length - 1);
  $('#wizard-confirm-details').checked = false;
  if (target === WIZARD_STEPS.length - 1) renderWizardReview();
  const label = $('#wizard-step-caption');
  if (label) label.textContent = `Step ${target + 1} of ${WIZARD_STEPS.length} · ${WIZARD_STEPS[target].label}`;
  $('#po-form').dataset.currentWizardStep = String(target);
}
function goToWizardStep(target) {
  const next = Math.max(0, Math.min(WIZARD_STEPS.length - 1, target));
  if (next > state.currentWizardStep) {
    for (let step = state.currentWizardStep; step < next; step += 1) {
      const errors = wizardStepErrors(step);
      if (errors.length) { showValidation(errors); return; }
    }
  }
  setWizardStep(next);
  if (next === WIZARD_STEPS.length - 1) window.scrollTo({ top: $('#wizard-stepper').getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
}
function nextWizardStep() { goToWizardStep(state.currentWizardStep + 1); }
function renderWizardReview() {
  const target = $('#wizard-review-content');
  if (!target) return;
  const request = serializeForm();
  const total = request.lineItems.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const account = request.fundingType === 'CAPEX' ? 'WBS Number (CAPEX / Project)' : 'Cost Center (OPEX)';
  const companyCodeLabel = request.companyCode
    ? `${request.companyCode}${request.companyCodeDescription ? ` — ${request.companyCodeDescription}` : ''}`
    : '—';
  const plantLabel = request.plantCode
    ? `${request.plantCode}${request.plantName ? ` — ${request.plantName}` : ''}`
    : '—';
  const lineRows = request.lineItems.map((line, index) => {
    const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    const costCenterLabel = line.costCenter || (request.fundingType === 'OPEX' ? request.costCenter : '') || '—';
    // Display the resolved GL only once. The same value can also be stored in
    // costCenterGlCode / wbsGlCode for mapping, but duplicating those fields in
    // the review table makes the Accounting codes cell noisy and misleading.
    const codingDetails = line.glCode
      ? [`GL: ${line.glCode}${line.glDescription ? ` — ${line.glDescription}` : ''}`]
      : (line.wbsGlCode ? [`GL: ${line.wbsGlCode}`] : []);
    return `<tr>
      <td>${index + 1}</td>
      <td>${htmlEscape(line.type || '—')}</td>
      <td class="review-coding-cell">${codingDetails.length ? codingDetails.map(value => `<span>${htmlEscape(value)}</span>`).join('') : '—'}</td>
      <td>${htmlEscape(line.description || '—')}</td>
      <td>${htmlEscape(dateLabel(line.deliveryDate))}</td>
      <td>${htmlEscape(costCenterLabel)}</td>
      <td>${htmlEscape(line.quantity === '' ? '—' : line.quantity)}</td>
      <td>${htmlEscape(money(line.unitPrice || 0, request.currency || 'USD'))}</td>
      <td>${htmlEscape(money(lineTotal, request.currency || 'USD'))}</td>
    </tr>`;
  }).join('');

  target.innerHTML = `<div class="review-cards-grid">
    <article class="review-summary-block"><div class="review-block-head"><strong>Basic details</strong><button type="button" data-wizard-nav="0">Edit</button></div><dl>
      <dt>PO title</dt><dd>${htmlEscape(request.title || '—')}</dd>
      <dt>Region</dt><dd>${htmlEscape(request.region || '—')}</dd>
      <dt>Request date</dt><dd>${htmlEscape(dateLabel(request.requestDate))}</dd>
      <dt>Currency</dt><dd>${htmlEscape(request.currency || '—')}</dd>
    </dl></article>
    <article class="review-summary-block"><div class="review-block-head"><strong>Vendor information</strong><button type="button" data-wizard-nav="1">Edit</button></div><dl>
      <dt>Vendor / company</dt><dd>${htmlEscape(request.vendorName || '—')}</dd>
      <dt>Vendor number</dt><dd>${htmlEscape(request.vendorNumber || '—')}</dd>
      <dt>Vendor email</dt><dd>${htmlEscape(request.vendorEmail || '—')}</dd>
      <dt>Company Code</dt><dd>${htmlEscape(companyCodeLabel)}</dd>
      <dt>Plant Code</dt><dd>${htmlEscape(plantLabel)}</dd>
    </dl></article>
    <article class="review-summary-block"><div class="review-block-head"><strong>Requestor & accounting</strong><button type="button" data-wizard-nav="2">Edit</button></div><dl>
      <dt>Requestor name</dt><dd>${htmlEscape(request.requestorName || '—')}</dd>
      <dt>Requestor email</dt><dd>${htmlEscape(request.requestorEmail || '—')}</dd>
      <dt>Account assignment</dt><dd>${htmlEscape(account)}</dd>
      <dt>${request.fundingType === 'CAPEX' ? 'WBS number' : 'Cost center'}</dt><dd>${htmlEscape(request.fundingType === 'CAPEX' ? (request.wbsNumber || '—') : (request.costCenter || '—'))}</dd>
      <dt>Request notes</dt><dd>${htmlEscape(request.requesterNotes || '—')}</dd>
    </dl></article>
    <article class="review-summary-block"><div class="review-block-head"><strong>Delivery schedule</strong><button type="button" data-wizard-nav="3">Edit</button></div><dl>
      <dt>Delivery frequency</dt><dd>${htmlEscape(request.deliveryFrequency || '—')}</dd>
      <dt>Start delivery date</dt><dd>${htmlEscape(dateLabel(request.startDeliveryDate))}</dd>
      <dt>End delivery date</dt><dd>${htmlEscape(dateLabel(request.endDeliveryDate))}</dd>
      <dt>No. of deliveries</dt><dd>${htmlEscape(request.deliveryCount || '—')}</dd>
    </dl></article>
    <article class="review-summary-block review-line-summary"><div class="review-block-head"><strong>PO line items</strong><span class="review-card-meta">${request.lineItems.length} line item${request.lineItems.length === 1 ? '' : 's'}</span><button type="button" data-wizard-nav="4">Edit</button></div>
      <div class="table-wrap review-line-table-wrap"><table class="data-table review-line-table"><thead><tr><th>#</th><th>Type</th><th>Accounting codes</th><th>Description</th><th>Delivery Date</th><th>Cost Center</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${lineRows}</tbody><tfoot><tr><td colspan="8">Total PO value</td><td>${htmlEscape(money(total, request.currency || 'USD'))}</td></tr></tfoot></table></div>
    </article>
  </div>
  <section class="review-support-files"><div class="review-support-head"><div class="review-support-title"><strong>Supporting documents</strong><span>${state.supportingFiles.length} file(s) selected to attach manually</span></div><button type="button" data-wizard-nav="1">Edit</button></div>
    ${state.supportingFiles.length ? `<ul>${state.supportingFiles.map(file => `<li><span class="review-support-file-icon">${htmlEscape(supportingExtension(file.name).toUpperCase())}</span><span>${htmlEscape(file.name)}</span><small>${(file.size / 1024).toFixed(0)} KB</small></li>`).join('')}</ul>` : '<p>No supporting documents attached. You can go back to Vendor information to add files.</p>'}
    <small>Open your email application from the GRW mailbox link, then attach the request PDF and selected supporting files manually before sending. The message is never sent automatically.</small>
  </section>`;
}

async function init() {
  initializeWizard();
  renderSavedDraftsPanel();
  initSearchableSelects();
  $('#top-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  try {
    // Reviewer access persists across refresh and ends only when Exit reviewer mode is clicked.
    const savedReviewerKey = localStorage.getItem(REVIEWER_STORAGE_KEY);
    if (savedReviewerKey) {
      state.reviewerKey = savedReviewerKey;
      try {
        await api('/api/reviewer/unlock', { method: 'POST', body: { key: savedReviewerKey }, headers: {} });
        state.reviewerMode = true;
        document.body.classList.add('reviewer-mode');
        $('#reviewer-access').textContent = 'Exit reviewer mode';
      } catch {
        state.reviewerKey = ''; state.reviewerMode = false; localStorage.removeItem(REVIEWER_STORAGE_KEY);
        document.body.classList.remove('reviewer-mode');
      }
    }
    state.master = await api('/api/master-data');
    populateHeaderLookups();
    $('#request-date').value = localDateInput();
    state.lineItems = [lineDefault()];
    renderLineItems();
    state.requests = [];
    attachEvents();
    if (state.reviewerMode) await reloadRequests();
    window.setInterval(() => {
      if (document.hidden) return;
      if (state.reviewerMode) reloadRequests().catch(error => console.warn('Background request refresh failed:', error.message));
    }, 30000);
    // Re-fetch master data on a short cadence so updated currency codes/names/symbols appear without clearing the browser cache.
    window.setInterval(async () => {
      if (document.hidden) return;
      const currentCurrency = clean($('#currency').value).toUpperCase();
      try { await reloadMasterData(); } catch (error) { console.warn('Master-data auto refresh failed:', error.message); }
    }, 30 * 1000);
    if (state.reviewerMode) switchView('overview');
    else { document.body.classList.remove('reviewer-mode'); switchView('home'); }
  } catch (error) {
    console.error('PO Request Portal startup failed:', error);
    document.body.innerHTML = `<div style="max-width:650px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #e1e8e8;border-radius:14px;font:14px system-ui;color:#27434c"><h1 style="margin-top:0">PO Request Portal could not start</h1><p>${htmlEscape(error.message)}</p><p>Restart this copy with <code>launch-windows.bat</code>. The launcher will select a free port if an older copy is still running. If the problem continues, open the browser console for the startup stack trace and check that <code>data/master-data.json</code> is present.</p></div>`;
  }
}

// ---- OneDrive / SharePoint Excel connection (Master Data page)
async function loadExcelSyncStatus() {
  if (!state.reviewerMode || !$('#excel-sync-panel')) return;
  try {
    const s = await api('/api/excel-sync/status');
    state.excelSync = s;
    const badge = $('#excel-sync-badge');
    badge.textContent = s.connected ? 'Connected' : 'Not connected'; badge.className = `excel-sync-badge ${s.connected ? 'on' : 'off'}`;
    const when = s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : 'never';
    $('#excel-sync-summary').textContent = s.connected
      ? `Folder “${s.folderName}” · last synced ${when} · checks Excel every ${s.pollSeconds}s${s.lastError ? ` · last error: ${s.lastError}` : ''}`
      : (s.configured ? 'Paste a OneDrive / SharePoint folder link to store all master data, regions and the request register as Excel files.' : 'Microsoft Graph credentials are not configured on the server (MS_GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET).');
    $('#excel-sync-files').innerHTML = (s.files || []).map(f => `<a class="excel-file-chip" href="${attrEscape(f.webUrl || '#')}" target="_blank" rel="noopener noreferrer">📄 ${htmlEscape(f.name)}</a>`).join('') + (s.connected && s.folderLink ? `<a class="excel-file-chip" href="${attrEscape(s.folderLink)}" target="_blank" rel="noopener noreferrer">📁 Open folder</a>` : '');
    $('#excel-sync-log').innerHTML = (s.log || []).map(l => `<li class="${attrEscape(l.level)}"><time>${htmlEscape(new Date(l.at).toLocaleTimeString())}</time> ${htmlEscape(l.message)}</li>`).join('') || '<li>No activity yet.</li>';
    $('#excel-sync-disconnect').classList.toggle('hidden', !s.connected); $('#excel-sync-now').classList.toggle('hidden', !s.connected);
    $('#excel-sync-connect').textContent = s.connected ? 'Change folder' : 'Connect';
  } catch (error) { $('#excel-sync-summary').textContent = error.message; }
}
async function excelSyncAction(button, path, body, okMessage) {
  const original = button.textContent; button.disabled = true; button.textContent = 'Working…';
  try { await api(path, { method: 'POST', body: body || {} }); await reloadMasterData(); if (state.reviewerMode) await reloadRequests().catch(() => {}); notify('OneDrive Excel', okMessage); }
  catch (error) { notify('OneDrive Excel', error.message, 'error'); }
  finally { button.disabled = false; button.textContent = original; await loadExcelSyncStatus(); }
}
document.addEventListener('click', event => {
  const connect = event.target.closest('#excel-sync-connect');
  if (connect) { const link = $('#excel-sync-link').value.trim(); if (!link) return notify('OneDrive Excel', 'Paste the folder link first.', 'error'); excelSyncAction(connect, '/api/excel-sync/connect', { link }, 'Connected. The Excel files are ready in the folder.'); return; }
  const now = event.target.closest('#excel-sync-now'); if (now) { excelSyncAction(now, '/api/excel-sync/sync-now', {}, 'Synced with Excel.'); return; }
  const off = event.target.closest('#excel-sync-disconnect'); if (off) { if (window.confirm('Disconnect from OneDrive? The portal keeps using its local copy of the data.')) excelSyncAction(off, '/api/excel-sync/disconnect', {}, 'Disconnected.'); }
});

init();
