/* Icon-only refinement for TCCC PO Request Portal v2.6.0.
   This file intentionally leaves navigation, profile controls, labels, forms and workflows untouched. */
(() => {
  'use strict';

  const svgPaths = {
    'clipboard-list': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h3"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    'building-2': '<path d="M3 21h18M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 8h4a1 1 0 0 1 1 1v12M8 7h2M8 11h2M8 15h2M17 12h1M17 16h1"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6M16 3.2a4 4 0 0 1 0 7.6"/>',
    'calculator': '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8v4H8zM8 14h1M12 14h1M16 14h.01M8 18h1M12 18h1M16 18h.01"/>',
    'calendar-clock': '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18M12 13v3l2 1M12 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>',
    'package': '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.6 7.7 4.3 7.7-4.3M12 12v9M8 5.3l8 4.5"/>',
    'clipboard-check': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8 13l2.2 2.2L16 9.5"/>',
    'paperclip': '<path d="m21 11.5-8.7 8.7a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    'chart-pie': '<path d="M11 3a9 9 0 1 0 10 10h-10z"/><path d="M14 3.3V10h6.7A9 9 0 0 0 14 3.3Z"/>',
    'chart-column': '<path d="M3 3v18h18M7 16v-4M12 16V6M17 16V9M22 16V4"/>',
    'database': '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    'search': '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    'shield-check': '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    'circle-check': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    'message-circle': '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'truck': '<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7.5" cy="19" r="1.8"/><circle cx="17.5" cy="19" r="1.8"/>',
    'map-pin': '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
    'help-circle': '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.5 1.5c-1.1 1-2.1 1.4-2.1 3M12 17h.01"/>',
    'zap': '<path d="m13 2-3 8H5l6 12 3-8h5L13 2Z"/>',
    'wallet': '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2M7 5V3h10v2"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    'layers': '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    'sliders': '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    'file-spreadsheet': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18M15 9v12M9 14h12"/>',
    'box': '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>'
  };

  function svg(name) {
    const paths = svgPaths[name] || svgPaths['file-text'];
    return `<svg class="po-topic-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${paths}</svg>`;
  }

  function iconForText(value) {
    const text = String(value || '').toLowerCase();
    if (/vendor|supplier/.test(text)) return 'building-2';
    if (/requestor|requester|people|team|user/.test(text)) return 'users';
    if (/accounting|cost center|wbs|funding|currency|value|spend|amount/.test(text)) return 'calculator';
    if (/delivery|schedule|calendar|date/.test(text)) return 'calendar-clock';
    if (/line items|goods|services|package/.test(text)) return 'package';
    if (/document|attachment|supporting file|file/.test(text)) return 'paperclip';
    if (/review|submit|checklist|approval|approve/.test(text)) return 'clipboard-check';
    if (/status|workflow|progress|timeline/.test(text)) return 'chart-pie';
    if (/master data|database|reference library|lookup/.test(text)) return 'database';
    if (/report|trend|region wise|regional|insight|export|chart/.test(text)) return 'chart-column';
    if (/track|search|find|filter|request register|requests/.test(text)) return 'search';
    if (/email|mail|recipient|message/.test(text)) return 'mail';
    if (/region|location|plant|company code/.test(text)) return 'map-pin';
    if (/quick action|next action|shortcut/.test(text)) return 'zap';
    if (/note|comment|clarification/.test(text)) return 'message-circle';
    if (/rejected|reject/.test(text)) return 'x-circle';
    if (/pending|awaiting|review queue/.test(text)) return 'clock';
    if (/created|completed|success|ready/.test(text)) return 'circle-check';
    if (/help|remember|important|before you submit|before proceeding/.test(text)) return 'info';
    if (/reference|codes|account/.test(text)) return 'layers';
    return 'clipboard-list';
  }


  const fieldIconById = {
    'region': 'globe', 'request-date': 'calendar-clock', 'currency': 'wallet', 'po-title': 'file-text',
    'vendor-name': 'building-2', 'vendor-number': 'clipboard-list', 'vendor-email': 'mail',
    'company-code': 'building-2', 'plant-code': 'map-pin', 'requestor-name': 'users',
    'requestor-email': 'mail', 'cost-center': 'calculator', 'wbs-number': 'layers',
    'request-notes': 'message-circle', 'delivery-frequency': 'calendar-clock',
    'start-delivery': 'calendar-clock', 'end-delivery': 'calendar-clock', 'delivery-count': 'package'
  };

  function iconForFieldLabel(value) {
    const text = String(value || '').toLowerCase().replace(/\*/g, '').trim();
    if (/e-?mail|recipient|mail address/.test(text)) return 'mail';
    if (/vendor number|request id|reference number/.test(text)) return 'clipboard-list';
    if (/request date|start delivery|end delivery|frequency|delivery date|date/.test(text)) return 'calendar-clock';
    if (/wbs/.test(text)) return 'layers';
    if (/currency|unit price|po value|total value|amount|cost center gl|gl code|funding|account assignment/.test(text)) return 'calculator';
    if (/region/.test(text)) return 'globe';
    if (/plant|location/.test(text)) return 'map-pin';
    if (/vendor|supplier|company code|company name/.test(text)) return 'building-2';
    if (/requestor|requester|updated by|employee name/.test(text)) return 'users';
    if (/quantity|\bqty\b|delivery count|no\. of deliveries|line items|type/.test(text)) return 'package';
    if (/title|description|notes|comment/.test(text)) return 'file-text';
    if (/status|progress|timeline/.test(text)) return 'chart-pie';
    if (/document|attachment|file/.test(text)) return 'paperclip';
    if (/reject/.test(text)) return 'x-circle';
    if (/review|submit|approve|checklist/.test(text)) return 'clipboard-check';
    return iconForText(text);
  }

  function positionFieldIcon(field, icon) {
    if (!field || !icon) return;
    // Prefer the visible searchable-select button where a native select has been enhanced.
    const control = field.querySelector(':scope > .searchable-select > .searchable-control')
      || field.querySelector(':scope > input:not([type="file"]), :scope > select, :scope > textarea');
    if (!control) return;
    const fieldRect = field.getBoundingClientRect();
    const controlRect = control.getBoundingClientRect();
    const top = controlRect.top - fieldRect.top + (controlRect.height - icon.offsetHeight) / 2;
    if (Number.isFinite(top)) icon.style.top = `${Math.max(0, top)}px`;
  }

  function decorateFieldIcons() {
    document.querySelectorAll('.wizard-panel .field').forEach(field => {
      const label = field.querySelector(':scope > label[for]');
      if (!label) return;
      field.classList.add('po-field-icon-host');
      let icon = field.querySelector(':scope > .field-leading-icon');
      if (!icon) {
        const iconName = fieldIconById[label.htmlFor] || iconForFieldLabel(label.textContent);
        icon = badge(iconName, 'field-leading-icon');
        field.appendChild(icon);
      }
      positionFieldIcon(field, icon);
    });

    document.querySelectorAll('.choice-card').forEach(card => {
      if (card.querySelector(':scope > .choice-topic-icon')) return;
      const copy = card.querySelector('.choice-copy');
      if (!copy) return;
      const input = card.querySelector('input[name="funding-type"]');
      card.insertBefore(badge(input?.value === 'CAPEX' ? 'layers' : 'calculator', 'choice-topic-icon'), copy);
    });

    document.querySelectorAll('.review-summary-block dt').forEach(dt => {
      if (dt.querySelector(':scope > .po-review-field-icon')) return;
      const icon = document.createElement('span');
      icon.className = 'po-review-field-icon';
      icon.innerHTML = svg(iconForFieldLabel(dt.textContent));
      icon.setAttribute('aria-hidden', 'true');
      dt.prepend(icon);
    });

    document.querySelectorAll('.review-block-head').forEach(head => {
      const title = head.querySelector('strong');
      if (!title || head.querySelector(':scope > .review-card-heading-icon')) return;
      head.insertBefore(badge(iconForText(title.textContent), 'review-card-heading-icon'), title);
    });
    document.querySelectorAll('.review-support-title').forEach(title => {
      const heading = title.querySelector('strong');
      if (!heading || title.querySelector(':scope > .review-card-heading-icon')) return;
      title.insertBefore(badge('paperclip', 'review-card-heading-icon'), heading);
    });

    document.querySelectorAll('.line-table thead th:not(.col-line-number), .review-line-table thead th').forEach(th => {
      if (th.querySelector(':scope > .po-column-icon')) return;
      const icon = document.createElement('span');
      icon.className = 'po-column-icon';
      icon.innerHTML = svg(iconForFieldLabel(th.textContent));
      icon.setAttribute('aria-hidden', 'true');
      th.prepend(icon);
    });
  }

  function badge(name, className) {
    const el = document.createElement('span');
    el.className = className;
    el.innerHTML = svg(name);
    el.setAttribute('aria-hidden', 'true');
    el.dataset.poIcon = name;
    return el;
  }

  function replaceIcon(el, name) {
    if (!el || el.dataset.poIcon === name) return;
    el.innerHTML = svg(name);
    el.dataset.poIcon = name;
    el.setAttribute('aria-hidden', 'true');
  }

  function addHeadingIcon(container, className, selector) {
    if (!container || container.querySelector(`:scope > .${className}`)) return;
    const copy = Array.from(container.children).find(child => child.matches(selector) || child.querySelector('h2, h3, strong'));
    if (!copy) return;
    const title = copy.querySelector('h2, h3, strong')?.textContent || copy.textContent;
    const icon = badge(iconForText(title), className);
    container.insertBefore(icon, copy);
    copy.classList.add('po-icon-heading-copy');
  }

  function decorate() {
    document.querySelectorAll('.form-section-head').forEach(head => {
      if (head.querySelector(':scope > .topic-section-icon')) return;
      const sectionNumber = head.querySelector(':scope > .section-number');
      const title = head.querySelector('h2')?.textContent || '';
      if (sectionNumber) head.insertBefore(badge(iconForText(title), 'topic-section-icon'), sectionNumber);
    });

    document.querySelectorAll('.panel-heading').forEach(head => addHeadingIcon(head, 'topic-heading-icon', ':scope > div'));
    document.querySelectorAll('.request-detail-card-head').forEach(head => addHeadingIcon(head, 'topic-heading-icon', ':scope > div'));
    document.querySelectorAll('.support-documents-head').forEach(head => addHeadingIcon(head, 'topic-section-icon', ':scope > div'));

    document.querySelectorAll('.metric-icon').forEach(el => {
      const context = el.closest('.metric-card')?.querySelector('.metric-top')?.textContent || el.closest('.master-metric')?.textContent || '';
      replaceIcon(el, iconForText(context));
    });
    document.querySelectorAll('.quick-icon').forEach(el => replaceIcon(el, iconForText(el.closest('.quick-action')?.textContent || 'quick action')));
    document.querySelectorAll('.report-icon').forEach(el => replaceIcon(el, iconForText(el.closest('.report-card')?.querySelector('h2')?.textContent || 'report')));
    document.querySelectorAll('.summary-rail-icon').forEach(el => replaceIcon(el, 'clipboard-list'));
    document.querySelectorAll('.track-summary-icon, .track-register-icon, .track-initial-icon, .track-page-icon, .track-discovery-mark').forEach(el => replaceIcon(el, 'search'));
    document.querySelectorAll('.track-search-icon').forEach(el => replaceIcon(el, 'search'));
    document.querySelectorAll('.email-preview-icon').forEach(el => replaceIcon(el, 'mail'));
    document.querySelectorAll('.email-side-icon').forEach(el => replaceIcon(el, iconForText(el.closest('.email-side-head')?.textContent || 'attachment')));
    document.querySelectorAll('.notice-icon').forEach(el => replaceIcon(el, 'info'));
    document.querySelectorAll('.help-icon').forEach(el => replaceIcon(el, 'help-circle'));
    document.querySelectorAll('.ref-icon').forEach(el => replaceIcon(el, 'building-2'));
    document.querySelectorAll('.empty-illustration').forEach(el => replaceIcon(el, iconForText(el.parentElement?.textContent || 'request')));
    document.querySelectorAll('.detail-empty-icon').forEach(el => replaceIcon(el, iconForText(el.parentElement?.textContent || 'document')));
    document.querySelectorAll('.timeline-empty-icon').forEach(el => replaceIcon(el, 'clock'));
    decorateFieldIcons();
  }

  function start() {
    decorate();
    // Re-align leading icons when responsive breakpoints, zoom, or field heights change.
    window.addEventListener('resize', () => {
      document.querySelectorAll('.wizard-panel .field.po-field-icon-host').forEach(field => {
        positionFieldIcon(field, field.querySelector(':scope > .field-leading-icon'));
      });
    }, { passive: true });
    const observer = new MutationObserver(() => {
      if (start.queued) return;
      start.queued = true;
      requestAnimationFrame(() => {
        start.queued = false;
        decorate();
      });
    });
    // The wizard hides inactive steps with a class. Reposition their icons after
    // a step becomes visible so measurements never remain at zero from display:none.
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
