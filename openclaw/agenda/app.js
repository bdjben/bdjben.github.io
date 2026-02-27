// OPENCLAW — Dashboard Controller
(function () {
  'use strict';

  const CATEGORY_MAP = {
    urgent: 'list-urgent',
    active: 'list-active',
    deferred: 'list-deferred',
    'needs-review': 'list-needs-review',
  };

  const COUNT_MAP = {
    urgent: 'count-urgent',
    active: 'count-active',
    deferred: 'count-deferred',
    'needs-review': 'count-needs-review',
  };

  const STATUS_LABEL = {
    overdue: 'OVERDUE',
    waiting: 'WAITING',
    pending: 'PENDING',
    scheduled: 'SCHEDULED',
    'in-progress': 'IN-PROGRESS',
    ready: 'READY',
    planning: 'PLANNING',
    new: 'NEW',
    'action-needed': 'ACTION NEEDED',
    deferred: 'DEFERRED',
    'not-started': 'NOT STARTED',
    unknown: 'UNKNOWN',
    unread: 'UNREAD',
    'worked-around': 'WORKED AROUND',
    completed: 'COMPLETED',
    confirmed: 'CONFIRMED',
    starred: 'STARRED',
    replied: 'REPLIED',
    flagged: 'FLAGGED',
    'needs-action': 'NEEDS ACTION',
    'pending-review': 'PENDING REVIEW',
    'archived': 'ARCHIVED',
  };

  // Data cache for search/sort
  let _lastItemsData = null;
  let _lastCalendarData = null;

  // === Error / Stale-Data Banner ===
  const STALE_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes
  let _lastSuccessData = null; // timestamp from last successful data fetch
  let _fetchErrorActive = false;

  function ensureBanner() {
    let el = document.getElementById('errorBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'errorBanner';
      el.className = 'error-banner';
      document.body.appendChild(el);
    }
    return el;
  }

  function showBanner(msg) {
    const el = ensureBanner();
    el.textContent = msg;
    el.classList.add('visible');
  }

  function hideBanner() {
    const el = document.getElementById('errorBanner');
    if (el) el.classList.remove('visible');
  }

  function onFetchError() {
    _fetchErrorActive = true;
    showBanner('⚠ Data sync failed — showing cached data');
  }

  function onFetchSuccess(lastUpdatedISO) {
    _fetchErrorActive = false;
    if (lastUpdatedISO) _lastSuccessData = new Date(lastUpdatedISO).getTime();
    hideBanner();
  }

  function checkStaleness() {
    // Disabled for demo — static data, no staleness concept
    return;
  }

  // Clock
  function updateClock() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clockDisplay').textContent = h + ':' + m + ':' + s + ' IST';

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    document.getElementById('dateDisplay').textContent =
      days[now.getDay()] + ' ' + String(now.getDate()).padStart(2, '0') + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  }
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(checkStaleness, 30000); // check staleness every 30s

  // === Popup ===
  function showPopup(html) {
    const overlay = document.getElementById('popupOverlay');
    const modal = document.getElementById('popupModal');
    modal.innerHTML = html;
    overlay.classList.add('active');
  }
  function hidePopup() {
    document.getElementById('popupOverlay').classList.remove('active');
  }
  document.getElementById('popupOverlay').addEventListener('click', function(e) {
    if (e.target === this) hidePopup();
  });

  async function moveItem(itemId, targetCategory) {
    console.log('Demo mode: moveItem is a no-op', {itemId, targetCategory});
    hidePopup();
    return;
  }

  function showNeedsReviewPopup(item) {
    let html = '<div class="popup-title">' + escapeHtml(item.title) + '</div>';
    html += '<div class="popup-desc">' + escapeHtml(item.description || '') + '</div>';
    if (item.deadline) html += '<div class="popup-meta">⏱ ' + escapeHtml(item.deadline) + '</div>';
    html += '<div class="popup-actions">';
    html += '<button class="popup-btn popup-btn-green" onclick="window._moveItem(' + item.id + ',\'completed\')">MARK AS COMPLETED</button>';
    html += '<button class="popup-btn popup-btn-red" onclick="window._moveItem(' + item.id + ',\'urgent\')">MOVE TO URGENT</button>';
    html += '<button class="popup-btn popup-btn-cyan" onclick="window._moveItem(' + item.id + ',\'active\')">MOVE TO ACTIVE</button>';
    html += '<button class="popup-btn popup-btn-gray" style="color:var(--teal);border-color:rgba(0,191,165,0.4)" onclick="window._moveItem(' + item.id + ',\'deferred\')">MOVE TO DEFERRED</button>';
    html += '<button class="popup-btn popup-btn-amber" onclick="window._moveItem(' + item.id + ',\'reminders\')">MOVE TO FUTURE REMINDERS</button>';
    html += '<button class="popup-btn popup-btn-gray" onclick="window._hidePopup()">DISMISS</button>';
    html += '</div>';
    showPopup(html);
  }

  function showCompletedPopup(item) {
    let html = '<div class="popup-title">' + escapeHtml(item.title) + '</div>';
    html += '<div class="popup-desc">' + escapeHtml(item.description || '') + '</div>';
    if (item.deadline) html += '<div class="popup-meta">⏱ ' + escapeHtml(item.deadline) + '</div>';
    html += '<div class="popup-actions">';
    html += '<button class="popup-btn popup-btn-amber" onclick="window._moveItem(' + item.id + ',\'needs-review\')">UNMARK — BACK TO REVIEW</button>';
    html += '<button class="popup-btn popup-btn-red" onclick="window._moveItem(' + item.id + ',\'urgent\')">MOVE TO URGENT</button>';
    html += '<button class="popup-btn popup-btn-cyan" onclick="window._moveItem(' + item.id + ',\'active\')">MOVE TO ACTIVE</button>';
    html += '<button class="popup-btn popup-btn-gray" style="color:var(--teal);border-color:rgba(0,191,165,0.4)" onclick="window._moveItem(' + item.id + ',\'deferred\')">MOVE TO DEFERRED</button>';
    html += '<button class="popup-btn popup-btn-amber" onclick="window._moveItem(' + item.id + ',\'reminders\')">MOVE TO FUTURE REMINDERS</button>';
    html += '<button class="popup-btn popup-btn-gray" onclick="window._hidePopup()">DISMISS</button>';
    html += '</div>';
    showPopup(html);
  }

  function showCalendarPopup(evt) {
    let html = '<div class="popup-title">' + escapeHtml(evt.title) + '</div>';
    if (evt.start) html += '<div class="popup-meta">Start: ' + escapeHtml(new Date(evt.start).toLocaleString('en-GB', {timeZone:'Asia/Jerusalem'})) + '</div>';
    if (evt.end) html += '<div class="popup-meta">End: ' + escapeHtml(new Date(evt.end).toLocaleString('en-GB', {timeZone:'Asia/Jerusalem'})) + '</div>';
    if (evt.location) html += '<div class="popup-meta">Location: ' + escapeHtml(evt.location) + '</div>';
    if (evt.description) html += '<div class="popup-desc">' + escapeHtml(evt.description) + '</div>';
    if (evt.status) html += '<div class="popup-meta">Status: ' + escapeHtml(evt.status) + '</div>';
    if (evt.calendar) html += '<div class="popup-meta">Calendar: ' + escapeHtml(evt.calendar) + '</div>';
    showPopup(html);
  }

  function showDeferredPopup(item) {
    let html = '<div class="popup-title">' + escapeHtml(item.title) + '</div>';
    html += '<div class="popup-desc">' + escapeHtml(item.description || '') + '</div>';
    if (item.deadline) html += '<div class="popup-meta">⏱ ' + escapeHtml(item.deadline) + '</div>';
    html += '<div class="popup-actions">';
    html += '<button class="popup-btn popup-btn-red" onclick="window._moveItem(' + item.id + ',\'urgent\')">MOVE TO URGENT</button>';
    html += '<button class="popup-btn popup-btn-cyan" onclick="window._moveItem(' + item.id + ',\'active\')">MOVE TO ACTIVE</button>';
    html += '<button class="popup-btn popup-btn-green" onclick="window._moveItem(' + item.id + ',\'completed\')">MARK AS COMPLETED</button>';
    html += '<button class="popup-btn popup-btn-gray" style="color:var(--amber);border-color:rgba(255,184,0,0.4)" onclick="window._moveItem(' + item.id + ',\'archived\')">REMOVE → ARCHIVE</button>';
    html += '<button class="popup-btn popup-btn-gray" onclick="window._hidePopup()">DISMISS</button>';
    html += '</div>';
    showPopup(html);
  }

  function showRemindersPopup(item) {
    showDeferredPopup(item); // Same buttons
  }

  function showArchivedPopup(item) {
    let html = '<div class="popup-title">' + escapeHtml(item.title) + '</div>';
    html += '<div class="popup-desc">' + escapeHtml(item.description || '') + '</div>';
    if (item.deadline) html += '<div class="popup-meta">⏱ ' + escapeHtml(item.deadline) + '</div>';
    html += '<div class="popup-actions">';
    html += '<button class="popup-btn popup-btn-cyan" onclick="window._moveItem(' + item.id + ',\'active\')">RESTORE TO ACTIVE</button>';
    html += '<button class="popup-btn popup-btn-gray" style="color:var(--teal);border-color:rgba(0,191,165,0.4)" onclick="window._moveItem(' + item.id + ',\'deferred\')">RESTORE TO DEFERRED</button>';
    html += '<button class="popup-btn popup-btn-amber" onclick="window._moveItem(' + item.id + ',\'reminders\')">RESTORE TO FUTURE REMINDERS</button>';
    html += '<button class="popup-btn popup-btn-gray" onclick="window._hidePopup()">DISMISS</button>';
    html += '</div>';
    showPopup(html);
  }

  // Expose for inline onclick
  window._moveItem = moveItem;
  window._hidePopup = hidePopup;

  // Tag emoji map
  const TAG_EMOJI = {
    calendar: '📅', consulting: '💼', email: '📧',
    twitter: '🐦', financial: '💰', travel: '✈️'
  };

  // Build card HTML
  function createCard(item, delay) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.status = item.status || 'unknown';
    card.style.animationDelay = delay + 'ms';

    const statusClass = 'status-' + (item.status || 'unknown').replace(/\s+/g, '-');

    let tagsHtml = '';
    if (item.tags && item.tags.length) {
      for (const tag of item.tags) {
        if (TAG_EMOJI[tag]) tagsHtml += '<span class="tag-badge" title="' + tag + '">' + TAG_EMOJI[tag] + '</span>';
      }
    }

    let html = '<div class="card-title">';
    html += '<span class="status-badge ' + statusClass + '"><span class="status-dot"></span>' + (STATUS_LABEL[item.status] || item.status?.toUpperCase() || 'UNKNOWN') + '</span>';
    html += tagsHtml;
    html += escapeHtml(item.title);
    html += '</div>';
    html += '<div class="card-desc">' + escapeHtml(item.description || '') + '</div>';
    if (item.deadline) {
      html += '<div class="card-deadline">⏱ ' + escapeHtml(item.deadline) + '</div>';
    }
    card.innerHTML = html;
    return card;
  }

  function makeExpandable(card) {
    card.classList.add('expandable');
    // Check after render if text is truncated, add indicator
    requestAnimationFrame(function() {
      const desc = card.querySelector('.card-desc');
      if (desc && desc.scrollHeight > desc.clientHeight + 1) {
        const indicator = document.createElement('span');
        indicator.className = 'expand-indicator';
        indicator.textContent = ' ⋯';
        desc.appendChild(indicator);
      }
    });
    card.addEventListener('click', function() {
      card.classList.toggle('expanded');
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // Render
  function render(data) {
    if (!data || !data.categories) return;
    _lastItemsData = data;

    // Update last refresh
    if (data.lastUpdated) {
      const d = new Date(data.lastUpdated);
      const t = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (refreshState) {
        checkRefreshComplete(t);
      } else {
        document.getElementById('lastRefresh').textContent = t;
      }
    }

    // Override lastRefresh with dynamic "now - 25 min" for demo
    (function setDemoSync() {
      function update25() {
        var now = new Date(Date.now() - 25 * 60000);
        var t = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('lastRefresh').textContent = t;
      }
      update25();
      setInterval(update25, 60000);
    })();

    // Render urgent with sort
    renderUrgentWithSort(data);

    // Render active with sort
    renderActiveWithSort(data);

    // Render deferred with sort + popup handlers
    renderDeferredWithSort(data);

    // Render needs-review with click handlers + stale amber
    const nrCat = data.categories.find(c => c.id === 'needs-review');
    if (nrCat) {
      const nrList = document.getElementById('list-needs-review');
      const nrCount = document.getElementById('count-needs-review');
      if (nrList) {
        nrList.innerHTML = '';
        if (nrCount) nrCount.textContent = nrCat.items.length;
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        let staleCount = 0;
        nrCat.items.forEach(function(item, i) {
          const card = createCard(item, i * 50);
          card.style.cursor = 'pointer';
          card.addEventListener('click', function() { showNeedsReviewPopup(item); });
          if (item.lastUpdated && (now - new Date(item.lastUpdated).getTime()) > SEVEN_DAYS) {
            card.classList.add('stale-amber');
            staleCount++;
          }
          nrList.appendChild(card);
        });
        // Remove old stale count if exists
        const oldStale = document.getElementById('staleCountNR');
        if (oldStale) oldStale.remove();
        if (staleCount > 0) {
          const staleEl = document.createElement('div');
          staleEl.id = 'staleCountNR';
          staleEl.className = 'stale-count';
          staleEl.textContent = staleCount + ' item' + (staleCount > 1 ? 's' : '') + ' older than 7 days';
          nrList.parentElement.appendChild(staleEl);
        }
      }
    }

    // Render completed as expandable
    renderCompleted(data);

    // Render reminders inline under deferred
    renderReminders(data);

    // Render archived
    renderArchived(data);
  }

  // === Completed (expandable, like reminders) ===
  let completedExpanded = false;

  let olderItemsExpanded = false;

  function renderCompleted(data) {
    const toggle = document.getElementById('completed-toggle');
    const list = document.getElementById('list-completed');
    if (!toggle || !list || !data || !data.categories) return;

    const compCat = data.categories.find(c => c.id === 'completed');
    const items = compCat ? compCat.items : [];

    if (items.length === 0 && !completedExpanded) {
      toggle.style.display = 'block';
      toggle.textContent = '▶ COMPLETED (0)';
      list.innerHTML = '';
      return;
    }

    toggle.style.display = 'block';
    const arrow = completedExpanded ? '▼' : '▶';
    toggle.textContent = arrow + ' COMPLETED (' + items.length + ')';

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const recentItems = [];
    const olderItems = [];
    for (const item of items) {
      if (item.lastUpdated && (now - new Date(item.lastUpdated).getTime()) > THIRTY_DAYS) {
        olderItems.push(item);
      } else {
        recentItems.push(item);
      }
    }

    list.innerHTML = '';
    let delay = 0;
    for (const item of recentItems) {
      const card = createCard(item, delay);
      card.style.cursor = 'pointer';
      card.addEventListener('click', (function(it) { return function() { showCompletedPopup(it); }; })(item));
      list.appendChild(card);
      delay += 50;
    }

    if (olderItems.length > 0) {
      const olderToggle = document.createElement('div');
      olderToggle.className = 'older-items-toggle';
      const oArrow = olderItemsExpanded ? '▼' : '▶';
      olderToggle.textContent = oArrow + ' ' + olderItems.length + ' OLDER ITEM' + (olderItems.length > 1 ? 'S' : '');

      const olderContainer = document.createElement('div');
      olderContainer.style.display = olderItemsExpanded ? 'block' : 'none';

      for (const item of olderItems) {
        const card = createCard(item, delay);
        card.style.cursor = 'pointer';
        card.addEventListener('click', (function(it) { return function() { showCompletedPopup(it); }; })(item));
        olderContainer.appendChild(card);
        delay += 50;
      }

      olderToggle.addEventListener('click', function() {
        olderItemsExpanded = !olderItemsExpanded;
        olderContainer.style.display = olderItemsExpanded ? 'block' : 'none';
        const a = olderItemsExpanded ? '▼' : '▶';
        olderToggle.textContent = a + ' ' + olderItems.length + ' OLDER ITEM' + (olderItems.length > 1 ? 'S' : '');
      });

      list.appendChild(olderToggle);
      list.appendChild(olderContainer);
    }

    if (completedExpanded) list.classList.add('expanded');
    else list.classList.remove('expanded');

    toggle.onclick = function() {
      completedExpanded = !completedExpanded;
      list.classList.toggle('expanded', completedExpanded);
      const a = completedExpanded ? '▼' : '▶';
      toggle.textContent = a + ' COMPLETED (' + items.length + ')';
    };
  }

  // === Future Reminders (inline under Deferred) ===
  let remindersExpanded = false;

  function renderReminders(data) {
    const toggle = document.getElementById('reminders-toggle');
    const list = document.getElementById('list-reminders');
    if (!toggle || !list || !data || !data.categories) return;

    const reminderCat = data.categories.find(c => c.id === 'reminders');
    const items = reminderCat ? reminderCat.items : [];

    if (items.length === 0) {
      toggle.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    toggle.style.display = 'block';
    const arrow = remindersExpanded ? '▼' : '▶';
    toggle.textContent = arrow + ' FUTURE REMINDERS (' + items.length + ')';

    // Render items into the list
    list.innerHTML = '';
    let delay = 0;
    for (const item of items) {
      const card = createCard(item, delay);
      card.style.cursor = 'pointer';
      card.addEventListener('click', (function(it) { return function() { showRemindersPopup(it); }; })(item));
      list.appendChild(card);
      delay += 50;
    }

    // Maintain expanded state
    if (remindersExpanded) {
      list.classList.add('expanded');
    } else {
      list.classList.remove('expanded');
    }

    toggle.onclick = function () {
      remindersExpanded = !remindersExpanded;
      list.classList.toggle('expanded', remindersExpanded);
      const a = remindersExpanded ? '▼' : '▶';
      toggle.textContent = a + ' FUTURE REMINDERS (' + items.length + ')';
    };
  }

  // === Archived (expandable, like completed) ===
  let archivedExpanded = false;

  function renderArchived(data) {
    const toggle = document.getElementById('archived-toggle');
    const list = document.getElementById('list-archived');
    if (!toggle || !list || !data || !data.categories) return;

    const archCat = data.categories.find(c => c.id === 'archived');
    const items = archCat ? archCat.items : [];

    toggle.style.display = 'block';
    const arrow = archivedExpanded ? '▼' : '▶';
    toggle.textContent = arrow + ' ARCHIVE (' + items.length + ')';

    list.innerHTML = '';
    let delay = 0;
    for (const item of items) {
      const card = createCard(item, delay);
      card.style.cursor = 'pointer';
      card.addEventListener('click', (function(it) { return function() { showArchivedPopup(it); }; })(item));
      list.appendChild(card);
      delay += 50;
    }

    if (archivedExpanded) list.classList.add('expanded');
    else list.classList.remove('expanded');

    toggle.onclick = function() {
      archivedExpanded = !archivedExpanded;
      list.classList.toggle('expanded', archivedExpanded);
      const a = archivedExpanded ? '▼' : '▶';
      toggle.textContent = a + ' ARCHIVE (' + items.length + ')';
    };
  }

  // Changelog — footer bar + detail panel
  function renderChangelog(data) {
    const bar = document.getElementById('changelogBar');
    if (!bar || !data || !data.entries) return;

    // Filter to last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recent = data.entries.filter(e => new Date(e.timestamp).getTime() > oneDayAgo);

    // Sort newest first
    recent.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Count by type
    let added = 0, modified = 0, removed = 0;
    for (const entry of recent) {
      for (const change of (entry.changes || [])) {
        if (change.type === 'added') added++;
        else if (change.type === 'modified') modified++;
        else if (change.type === 'removed') removed++;
      }
    }

    // Render bar
    let barHtml = '';
    barHtml += '<span class="changelog-bar-label">Recent Changes</span>';
    barHtml += '<span class="changelog-bar-sep">|</span>';
    barHtml += '<span class="changelog-bar-stat"><strong class="count-added">Added:</strong> ' + added + '</span>';
    barHtml += '<span class="changelog-bar-sep">·</span>';
    barHtml += '<span class="changelog-bar-stat"><strong class="count-modified">Modified:</strong> ' + modified + '</span>';
    barHtml += '<span class="changelog-bar-sep">·</span>';
    barHtml += '<span class="changelog-bar-stat"><strong class="count-removed">Removed:</strong> ' + removed + '</span>';
    bar.innerHTML = barHtml;

    // Build detail panel
    let detail = document.getElementById('changelogDetail');
    if (!detail) {
      detail = document.createElement('div');
      detail.id = 'changelogDetail';
      detail.className = 'changelog-detail';
      document.body.appendChild(detail);
    }

    let detailHtml = '<div class="changelog-detail-header">';
    detailHtml += '<span class="changelog-detail-title">RECENT CHANGES — LAST 24 HOURS</span>';
    detailHtml += '<button class="changelog-detail-close" id="closeChangelog">✕ CLOSE</button>';
    detailHtml += '</div>';

    if (recent.length === 0) {
      detailHtml += '<div class="changelog-entry"><div class="changelog-summary" style="color: var(--text-dim); opacity: 0.5;">No changes in the last 24 hours.</div></div>';
    } else {
      for (const entry of recent) {
        const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Jerusalem',
          hour: '2-digit',
          minute: '2-digit'
        });

        detailHtml += '<div class="changelog-entry">';
        detailHtml += '<div class="changelog-time">' + time + ' IST</div>';

        for (const change of (entry.changes || [])) {
          const typeClass = 'type-' + (change.type || 'modified');
          const typeLabel = (change.type || 'modified').toUpperCase();

          detailHtml += '<div class="changelog-change">';
          detailHtml += '<span class="changelog-change-type ' + typeClass + '">' + typeLabel + '</span>';
          detailHtml += '<span class="changelog-item-name">' + escapeHtml(change.itemTitle || '') + '</span>';
          detailHtml += '<div class="changelog-summary">' + escapeHtml(change.summary || '') + '</div>';
          detailHtml += '</div>';
        }

        detailHtml += '</div>';
      }
    }

    detail.innerHTML = detailHtml;

    // Rebind close button
    document.getElementById('closeChangelog').addEventListener('click', function (e) {
      e.stopPropagation();
      detail.classList.remove('expanded');
    });

    // Bar click toggles detail
    bar.onclick = function () {
      detail.classList.toggle('expanded');
    };
  }

  async function fetchChangelog() {
    try {
      const res = await fetch('changelog.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderChangelog(data);
    } catch (e) {
      console.error('Changelog fetch failed:', e);
    }
  }

  // Fetch
  async function fetchItems() {
    try {
      const res = await fetch('items.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      render(data);
      onFetchSuccess(data && data.lastUpdated);
    } catch (e) {
      console.error('Fetch failed:', e);
      onFetchError();
    }
  }

  // === Calendar rendering ===
  function relativeTime(dateStr) {
    const diff = new Date(dateStr).getTime() - Date.now();
    const absDiff = Math.abs(diff);
    const h = Math.floor(absDiff / 3600000);
    const m = Math.floor((absDiff % 3600000) / 60000);
    if (diff < 0) return h > 0 ? h + 'h ' + m + 'm ago' : m + 'm ago';
    if (h > 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
    return h > 0 ? 'in ' + h + 'h ' + m + 'm' : 'in ' + m + 'm';
  }

  function renderCalendar(data) {
    const list = document.getElementById('list-calendar');
    const count = document.getElementById('count-calendar');
    if (!list) return;
    list.innerHTML = '';
    const events = (data && data.events) || [];
    if (count) count.textContent = events.length;

    events.forEach(function(evt, i) {
      const card = document.createElement('div');
      card.className = 'calendar-card';
      card.style.animationDelay = (i * 50) + 'ms';
      let html = '<div class="calendar-card-title">' + escapeHtml(evt.title) + '</div>';
      const startDate = new Date(evt.start);
      const timeStr = startDate.toLocaleString('en-GB', {timeZone:'Asia/Jerusalem', weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
      html += '<div class="calendar-card-time">' + timeStr + ' <span class="calendar-card-relative">(' + relativeTime(evt.start) + ')</span></div>';
      if (evt.location) html += '<div class="calendar-card-location">📍 ' + escapeHtml(evt.location) + '</div>';
      card.innerHTML = html;
      card.addEventListener('click', function() { showCalendarPopup(evt); });
      list.appendChild(card);
    });
  }

  async function fetchCalendar() {
    try {
      const res = await fetch('calendar.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      _lastCalendarData = data;
      renderCalendar(data);
    } catch(e) { console.error('Calendar fetch failed:', e); }
  }

  async function fetchAll() {
    await Promise.all([fetchItems(), fetchChangelog(), fetchCalendar()]);
    checkStaleness();
    if (searchQuery) applySearch();
  }

  // Refresh state tracking
  let refreshState = null; // null | { preLastUpdated, startTime }

  let refreshStatusPoll = null;

  async function doRefresh() {
    console.log('Demo mode: refresh is a no-op');
    showSyncStatus('Demo mode — data is static', '#f5a623');
    setTimeout(() => { restoreSyncDisplay(); }, 3000);
    return;
  }

  function startRefreshStatusPoll() {
    // No-op in demo mode
  }

  function stopRefreshStatusPoll() {
    if (refreshStatusPoll) {
      clearInterval(refreshStatusPoll);
      refreshStatusPoll = null;
    }
  }

  function showRefreshError() {
    const btn = document.getElementById('refreshAll');
    refreshState = null;
    btn.disabled = false;
    btn.style.opacity = '';
    btn.classList.add('refresh-error');
    showSyncStatus('✕ REFRESH FAILED', '#ff3333');
    setTimeout(() => {
      btn.classList.remove('refresh-error');
      restoreSyncDisplay();
    }, 10000);
  }

  function showSyncStatus(text, color) {
    const container = document.getElementById('lastRefresh')?.parentElement;
    if (!container) return;
    const label = container.querySelector('.sync-label') || container.firstChild;
    const valueEl = document.getElementById('lastRefresh');
    if (valueEl) {
      valueEl.textContent = text;
      valueEl.style.color = color || '';
    }
  }

  function restoreSyncDisplay() {
    const valueEl = document.getElementById('lastRefresh');
    if (valueEl) valueEl.style.color = '';
  }

  function checkRefreshComplete(newLastUpdated) {
    if (!refreshState) return;
    const btn = document.getElementById('refreshAll');
    const elapsed = Date.now() - refreshState.startTime;

    // Format new time for comparison
    if (newLastUpdated && newLastUpdated !== refreshState.preLastUpdated) {
      // Refresh complete!
      refreshState = null;
      btn.disabled = false;
      btn.style.opacity = '';
      showSyncStatus('✓ SYNC COMPLETE', '#4caf50');
      setTimeout(() => restoreSyncDisplay(), 5000);
      return;
    }

    if (elapsed > 5 * 60 * 1000) {
      // Timeout
      refreshState = null;
      btn.disabled = false;
      btn.style.opacity = '';
      showSyncStatus('⚠️ REFRESH TIMEOUT', '#f44336');
      setTimeout(() => restoreSyncDisplay(), 5000);
    }
  }

  // Events
  document.getElementById('refreshAll').addEventListener('click', function () {
    this.classList.add('spinning');
    setTimeout(() => this.classList.remove('spinning'), 600);
    doRefresh();
  });

  // === Click-outside-to-close for Recent Changes detail ===
  document.addEventListener('click', function (e) {
    const detail = document.getElementById('changelogDetail');
    const bar = document.getElementById('changelogBar');
    if (detail && detail.classList.contains('expanded')) {
      if (!detail.contains(e.target) && !bar.contains(e.target)) {
        detail.classList.remove('expanded');
      }
    }
  });

  // === Search ===
  let searchActive = false;
  let searchQuery = '';
  let preSearchStates = { reminders: null, completed: null, archived: null };

  const searchContainer = document.getElementById('searchContainer');
  const searchToggle = document.getElementById('searchToggle');
  const searchInput = document.getElementById('searchInput');

  function openSearch() {
    if (searchActive) return;
    searchActive = true;
    preSearchStates.reminders = remindersExpanded;
    preSearchStates.completed = completedExpanded;
    preSearchStates.archived = archivedExpanded;
    searchContainer.classList.add('active');
    searchInput.focus();
  }

  function closeSearch() {
    if (!searchActive) return;
    searchActive = false;
    searchQuery = '';
    searchInput.value = '';
    searchContainer.classList.remove('active');
    remindersExpanded = preSearchStates.reminders ?? false;
    completedExpanded = preSearchStates.completed ?? false;
    archivedExpanded = preSearchStates.archived ?? false;
    applySearch();
  }

  searchToggle.addEventListener('click', function() {
    if (searchActive) closeSearch(); else openSearch();
  });

  searchInput.addEventListener('input', function() {
    searchQuery = this.value.trim().toLowerCase();
    applySearch();
  });

  function itemMatches(item, q) {
    if (!q) return true;
    const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
    return text.includes(q);
  }

  function calendarEventMatches(evt, q) {
    if (!q) return true;
    const text = ((evt.title || '') + ' ' + (evt.description || '')).toLowerCase();
    return text.includes(q);
  }

  function applySearch() {
    if (!_lastItemsData && !_lastCalendarData) return;
    const q = searchQuery;

    // Items sections
    if (_lastItemsData && _lastItemsData.categories) {
      const sectionMap = {
        'urgent': { col: 'col-urgent', list: 'list-urgent', count: 'count-urgent' },
        'active': { col: 'col-active', list: 'list-active', count: 'count-active' },
        'deferred': { col: 'col-deferred', list: 'list-deferred', count: 'count-deferred' },
        'needs-review': { col: 'col-needs-review', list: 'list-needs-review', count: 'count-needs-review' },
      };

      for (const cat of _lastItemsData.categories) {
        const sec = sectionMap[cat.id];
        if (!sec) continue;
        const listEl = document.getElementById(sec.list);
        const colEl = document.getElementById(sec.col);
        const countEl = document.getElementById(sec.count);
        if (!listEl) continue;

        // For sorted sections, use sorted items order
        const items = cat._sortedItems ? cat._sortedItems : cat.items;
        const cards = listEl.querySelectorAll('.card');
        let visible = 0;
        cards.forEach((card, i) => {
          const item = items[i];
          if (!item) return;
          const match = itemMatches(item, q);
          card.style.display = match ? '' : 'none';
          if (match) visible++;
        });

        if (countEl) countEl.textContent = q ? visible + ' of ' + cat.items.length : cat.items.length;
        if (colEl && cat.id !== 'deferred') {
          colEl.style.display = (q && visible === 0) ? 'none' : '';
        }
      }

      // Handle deferred column visibility (deferred + reminders + completed + archived)
      const defCol = document.getElementById('col-deferred');
      if (defCol) {
        // Check deferred cards
        const defList = document.getElementById('list-deferred');
        const defCards = defList ? defList.querySelectorAll('.card') : [];
        let defVisible = 0;
        defCards.forEach(c => { if (c.style.display !== 'none') defVisible++; });

        // Reminders
        const remList = document.getElementById('list-reminders');
        const remCards = remList ? remList.querySelectorAll('.card') : [];
        const remCat = _lastItemsData.categories.find(c => c.id === 'reminders');
        const remItems = remCat ? remCat.items : [];
        let remVisible = 0;
        remCards.forEach((card, i) => {
          const item = remItems[i];
          if (!item) return;
          const match = itemMatches(item, q);
          card.style.display = match ? '' : 'none';
          if (match) remVisible++;
        });
        const remToggle = document.getElementById('reminders-toggle');
        if (remToggle) remToggle.style.display = (q && remVisible === 0) ? 'none' : (remItems.length ? 'block' : 'none');
        if (q && remVisible > 0) { remindersExpanded = true; remList.classList.add('expanded'); }
        if (remToggle && remItems.length) {
          const arrow = remindersExpanded ? '▼' : '▶';
          remToggle.textContent = arrow + ' FUTURE REMINDERS (' + (q ? remVisible + ' of ' + remItems.length : remItems.length) + ')';
        }

        // Completed
        const compList = document.getElementById('list-completed');
        const compCards = compList ? compList.querySelectorAll('.card') : [];
        const compCat = _lastItemsData.categories.find(c => c.id === 'completed');
        const compItems = compCat ? compCat.items : [];
        let compVisible = 0;
        compCards.forEach((card, i) => {
          const item = compItems[i];
          if (!item) return;
          const match = itemMatches(item, q);
          card.style.display = match ? '' : 'none';
          if (match) compVisible++;
        });
        const compToggle = document.getElementById('completed-toggle');
        if (compToggle) compToggle.style.display = (q && compVisible === 0) ? 'none' : 'block';
        if (q && compVisible > 0) { completedExpanded = true; compList.classList.add('expanded'); }
        if (compToggle) {
          const arrow = completedExpanded ? '▼' : '▶';
          compToggle.textContent = arrow + ' COMPLETED (' + (q ? compVisible + ' of ' + compItems.length : compItems.length) + ')';
        }

        // Archived
        const archList = document.getElementById('list-archived');
        const archCards = archList ? archList.querySelectorAll('.card') : [];
        const archCat = _lastItemsData.categories.find(c => c.id === 'archived');
        const archItems = archCat ? archCat.items : [];
        let archVisible = 0;
        archCards.forEach((card, i) => {
          const item = archItems[i];
          if (!item) return;
          const match = itemMatches(item, q);
          card.style.display = match ? '' : 'none';
          if (match) archVisible++;
        });
        const archToggle = document.getElementById('archived-toggle');
        if (archToggle) archToggle.style.display = (q && archVisible === 0) ? 'none' : 'block';
        if (q && archVisible > 0) { archivedExpanded = true; archList.classList.add('expanded'); }
        if (archToggle) {
          const arrow = archivedExpanded ? '▼' : '▶';
          archToggle.textContent = arrow + ' ARCHIVE (' + (q ? archVisible + ' of ' + archItems.length : archItems.length) + ')';
        }

        // Deferred header
        const defHeader = defCol.querySelector('.section-header');
        const defCountEl = document.getElementById('count-deferred');
        const defCat = _lastItemsData.categories.find(c => c.id === 'deferred');
        const defTotal = defCat ? defCat.items.length : 0;
        if (defCountEl) defCountEl.textContent = q ? defVisible + ' of ' + defTotal : defTotal;
        if (defHeader) defHeader.style.display = (q && defVisible === 0) ? 'none' : '';

        // Hide entire deferred column if nothing visible
        const totalColVisible = defVisible + remVisible + compVisible + archVisible;
        defCol.style.display = (q && totalColVisible === 0) ? 'none' : '';
      }
    }

    // Calendar
    if (_lastCalendarData) {
      const calList = document.getElementById('list-calendar');
      const calCol = document.getElementById('col-calendar');
      const calCount = document.getElementById('count-calendar');
      const events = (_lastCalendarData && _lastCalendarData.events) || [];
      const calCards = calList ? calList.querySelectorAll('.calendar-card') : [];
      let calVisible = 0;
      calCards.forEach((card, i) => {
        const evt = events[i];
        if (!evt) return;
        const match = calendarEventMatches(evt, q);
        card.style.display = match ? '' : 'none';
        if (match) calVisible++;
      });
      if (calCount) calCount.textContent = q ? calVisible + ' of ' + events.length : events.length;
      if (calCol) calCol.style.display = (q && calVisible === 0) ? 'none' : '';
    }
  }

  // === Sort for Active / Urgent / Deferred ===
  const SORT_MODES = ['STATUS', 'DEADLINE', 'LAST UPDATED', 'TITLE'];
  let currentSortMode = 0; // index into SORT_MODES
  let urgentSortMode = 0;
  let deferredSortMode = 0;

  const STATUS_TIERS = {
    'action-needed': 1, 'overdue': 1,
    'in-progress': 2, 'starred': 2,
    'scheduled': 3, 'waiting': 3, 'replied': 3,
    'new': 4, 'planning': 4,
    'completed': 5, 'worked-around': 5, 'confirmed': 5, 'flagged': 5, 'needs-action': 5,
  };

  const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

  function parseDeadlineDate(str) {
    if (!str) return null;
    const m = str.match(/([A-Za-z]{3})\s+(\d{1,2})/);
    if (m) {
      const mon = MONTHS[m[1].toLowerCase()];
      if (mon !== undefined) {
        const day = parseInt(m[2]);
        const now = new Date();
        let year = now.getFullYear();
        const d = new Date(year, mon, day);
        if (d < now - 86400000 * 180) year++;
        return new Date(year, mon, day).getTime();
      }
    }
    return null;
  }

  function sortItemsByMode(items, modeIndex) {
    const mode = SORT_MODES[modeIndex];
    const sorted = [...items];
    switch (mode) {
      case 'STATUS':
        sorted.sort((a, b) => {
          const ta = STATUS_TIERS[a.status] || 5;
          const tb = STATUS_TIERS[b.status] || 5;
          if (ta !== tb) return ta - tb;
          return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0);
        });
        break;
      case 'DEADLINE':
        sorted.sort((a, b) => {
          const da = parseDeadlineDate(a.deadline);
          const db = parseDeadlineDate(b.deadline);
          if (da && db) return da - db;
          if (da) return -1;
          if (db) return 1;
          return 0;
        });
        break;
      case 'LAST UPDATED':
        sorted.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
        break;
      case 'TITLE':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
    }
    return sorted;
  }

  function sortActiveItems(items) {
    const mode = SORT_MODES[currentSortMode];
    const sorted = [...items];
    switch (mode) {
      case 'STATUS':
        sorted.sort((a, b) => {
          const ta = STATUS_TIERS[a.status] || 5;
          const tb = STATUS_TIERS[b.status] || 5;
          if (ta !== tb) return ta - tb;
          return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0);
        });
        break;
      case 'DEADLINE':
        sorted.sort((a, b) => {
          const da = parseDeadlineDate(a.deadline);
          const db = parseDeadlineDate(b.deadline);
          if (da && db) return da - db;
          if (da) return -1;
          if (db) return 1;
          return 0;
        });
        break;
      case 'LAST UPDATED':
        sorted.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
        break;
      case 'TITLE':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
    }
    return sorted;
  }

  document.getElementById('sortControl').addEventListener('click', function() {
    currentSortMode = (currentSortMode + 1) % SORT_MODES.length;
    document.getElementById('sortLabel').textContent = SORT_MODES[currentSortMode];
    if (_lastItemsData) {
      renderActiveWithSort(_lastItemsData);
      if (searchQuery) applySearch();
    }
  });

  document.getElementById('sortControlUrgent').addEventListener('click', function() {
    urgentSortMode = (urgentSortMode + 1) % SORT_MODES.length;
    document.getElementById('sortLabelUrgent').textContent = SORT_MODES[urgentSortMode];
    if (_lastItemsData) {
      renderUrgentWithSort(_lastItemsData);
      if (searchQuery) applySearch();
    }
  });

  document.getElementById('sortControlDeferred').addEventListener('click', function() {
    deferredSortMode = (deferredSortMode + 1) % SORT_MODES.length;
    document.getElementById('sortLabelDeferred').textContent = SORT_MODES[deferredSortMode];
    if (_lastItemsData) {
      renderDeferredWithSort(_lastItemsData);
      if (searchQuery) applySearch();
    }
  });

  function renderActiveWithSort(data) {
    const activeCat = data.categories.find(c => c.id === 'active');
    if (!activeCat) return;
    const sorted = sortActiveItems(activeCat.items);
    const list = document.getElementById('list-active');
    const count = document.getElementById('count-active');
    if (!list) return;
    list.innerHTML = '';
    if (count) count.textContent = sorted.length;
    activeCat._sortedItems = sorted;
    sorted.forEach((item, i) => {
      const card = createCard(item, i * 50);
      makeExpandable(card);
      list.appendChild(card);
    });
  }

  function renderUrgentWithSort(data) {
    const urgentCat = data.categories.find(c => c.id === 'urgent');
    if (!urgentCat) return;
    const sorted = sortItemsByMode(urgentCat.items, urgentSortMode);
    const list = document.getElementById('list-urgent');
    const count = document.getElementById('count-urgent');
    if (!list) return;
    list.innerHTML = '';
    if (count) count.textContent = sorted.length;
    urgentCat._sortedItems = sorted;
    sorted.forEach((item, i) => {
      const card = createCard(item, i * 50);
      makeExpandable(card);
      list.appendChild(card);
    });
  }

  function renderDeferredWithSort(data) {
    const defCat = data.categories.find(c => c.id === 'deferred');
    if (!defCat) return;
    const sorted = sortItemsByMode(defCat.items, deferredSortMode);
    const list = document.getElementById('list-deferred');
    const count = document.getElementById('count-deferred');
    if (!list) return;
    list.innerHTML = '';
    if (count) count.textContent = sorted.length;
    defCat._sortedItems = sorted;
    sorted.forEach((item, i) => {
      const card = createCard(item, i * 50);
      card.style.cursor = 'pointer';
      card.addEventListener('click', (function(it) { return function(e) { if (!card.classList.contains('expanded')) showDeferredPopup(it); }; })(item));
      list.appendChild(card);
    });
  }

  // === Keyboard & Swipe Navigation ===
  const DASHBOARDS = ['../agenda/', '../crm/', '../project-view/', '../system-monitor/'];
  const currentIdx = 0; // Ben

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !searchActive && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openSearch();
      return;
    }
    if (e.key === 'Escape' && searchActive) {
      closeSearch();
      return;
    }
    if (e.key === 'ArrowRight') {
      (window.parent || window).location.href = DASHBOARDS[(currentIdx + 1) % DASHBOARDS.length];
    } else if (e.key === 'ArrowLeft') {
      (window.parent || window).location.href = DASHBOARDS[(currentIdx - 1 + DASHBOARDS.length) % DASHBOARDS.length];
    }
  });


  // Middle-click to advance to next dashboard
  document.addEventListener('mousedown', function (e) {
    if (e.button === 1) {
      e.preventDefault();
      (window.parent || window).location.href = DASHBOARDS[(currentIdx + 1) % DASHBOARDS.length];
    }
  });
  // Two-finger swipe detection — one navigation per gesture
  let swipeAccumX = 0;
  let swipeTimeout = null;
  let swipeFired = false;
  const SWIPE_THRESHOLD = 60;
  document.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 3) {
      if (swipeFired) return;
      swipeAccumX += e.deltaX;
      clearTimeout(swipeTimeout);
      swipeTimeout = setTimeout(function () { swipeAccumX = 0; swipeFired = false; }, 500);

      if (swipeAccumX > SWIPE_THRESHOLD) {
        swipeFired = true;
        (window.parent || window).location.href = DASHBOARDS[(currentIdx + 1) % DASHBOARDS.length];
      } else if (swipeAccumX < -SWIPE_THRESHOLD) {
        swipeFired = true;
        (window.parent || window).location.href = DASHBOARDS[(currentIdx - 1 + DASHBOARDS.length) % DASHBOARDS.length];
      }
    }
  }, { passive: true });

  // Touch swipe navigation
  (function() {
    var startX = 0;
    document.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) (window.parent || window).location.href = DASHBOARDS[(currentIdx + 1) % DASHBOARDS.length];
        else (window.parent || window).location.href = DASHBOARDS[(currentIdx - 1 + DASHBOARDS.length) % DASHBOARDS.length];
      }
    }, { passive: true });
  })();

  // Auto-poll every 30 seconds
  setInterval(fetchAll, 30 * 1000);

  // Init
  fetchAll();
})();
