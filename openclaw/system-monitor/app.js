// OPENCLAW — Operations Monitor Controller
(function () {
  'use strict';

  // === Error / Stale-Data Banner ===
  const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
  let _lastSuccessData = null;
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
    else _lastSuccessData = Date.now();
    hideBanner();
  }

  function checkStaleness() {
    // Disabled for demo — static data, no staleness concept
    return;
  }

  // === Clock ===
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
  setInterval(checkStaleness, 10000); // check staleness every 10s

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function timeAgo(iso) {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) return null;
    if (ms < 60000) return Math.round(ms / 1000) + 's ago';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm ago';
    if (ms < 86400000) return (ms / 3600000).toFixed(1) + 'h ago';
    return Math.round(ms / 86400000) + 'd ago';
  }

  function timeUntil(iso) {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return null;
    if (ms < 60000) return 'in ' + Math.round(ms / 1000) + 's';
    if (ms < 3600000) return 'in ' + Math.round(ms / 60000) + 'm';
    if (ms < 86400000) return 'in ' + (ms / 3600000).toFixed(1) + 'h';
    return 'in ' + Math.round(ms / 86400000) + 'd';
  }

  function matchCronMapping(name, cronMapping) {
    for (var pattern in cronMapping) {
      if (pattern.endsWith('*')) {
        if (name.startsWith(pattern.slice(0, -1))) return cronMapping[pattern];
      } else if (name === pattern) {
        return cronMapping[pattern];
      }
    }
    return null;
  }

  // === Health colors ===
  const HEALTH_CONFIG = {
    'fully-staffed': { color: 'var(--green)', label: 'FULLY STAFFED', dot: '🟢' },
    'understaffed':  { color: 'var(--amber)', label: 'UNDERSTAFFED', dot: '🟡' },
    'unstaffed':     { color: 'var(--red)',   label: 'UNSTAFFED',    dot: '🔴' },
    'idle':          { color: 'var(--blue)',  label: 'IDLE / READY', dot: '🔵' },
  };

  const IMPL_LABELS = {
    cron: '⏱ CRON',
    skill: '🛠 SKILL',
    manual: '👤 MANUAL',
    info: 'ℹ️ INFO',
  };

  // === Division display order for the scheduled ops panel ===
  const DIVISION_ORDER = ['intelligence', 'communications', 'security', 'operations', 'personal-lifestyle', 'agent-deployments'];
  const DIVISION_DISPLAY = {
    intelligence: { label: 'INTELLIGENCE', color: '#1d9bf0' },
    communications: { label: 'BRIEFINGS / AGENDA', color: 'var(--cyan)' },
    security: { label: 'SECURITY', color: 'var(--teal)' },
    operations: { label: 'OPERATIONS', color: 'var(--green)' },
    'personal-lifestyle': { label: 'PERSONAL / LIFESTYLE', color: 'var(--purple)' },
    'agent-deployments': { label: 'AGENT DEPLOYMENTS', color: 'var(--blue)' },
  };

  // === Agent-structure cache (populated by fetchStructure, used by renderCrons) ===
  let _structureCache = null;
  let _mainSessionModel = null;  // Dynamic model from live session data

  // Build a lookup map: cronId → { displayName, description, friendlySchedule }
  function buildCronLookup(structure) {
    var lookup = {};
    if (!structure || !structure.divisions) return lookup;
    for (var i = 0; i < structure.divisions.length; i++) {
      var div = structure.divisions[i];
      for (var j = 0; j < (div.units || []).length; j++) {
        var unit = div.units[j];
        for (var k = 0; k < (unit.members || []).length; k++) {
          var m = unit.members[k];
          if (m.id && m.impl === 'cron') {
            lookup[m.id] = {
              displayName: m.name || m.id,
              description: m.description || '',
              friendlySchedule: m.schedule || ''
            };
          }
        }
      }
    }
    return lookup;
  }

  // === System Panel ===
  function renderSystem(data) {
    const panel = document.getElementById('system-panel');
    if (!panel || !data || !data.system) return;
    const s = data.system;
    const rows = [
      ['OpenClaw Version', s.openclawVersion || '—', 'ok'],
      ['Model', s.model || '—', ''],
      ['Host', s.host || '—', ''],
      ['Signal', s.signalStatus || '—', s.signalStatus === 'connected' ? 'ok' : 'warn'],
      ['Browser', s.browserStatus || '—', s.browserStatus === 'running' ? 'ok' : 'warn'],
      ['Dashboard', s.dashboardStatus || '—', s.dashboardStatus === 'all-ok' ? 'ok' : 'warn'],
    ];
    panel.innerHTML = rows.map(function (r) {
      return '<div class="sys-row"><span class="sys-label">' + escapeHtml(r[0]) +
        '</span><span class="sys-value ' + r[2] + '">' + escapeHtml(r[1]) + '</span></div>';
    }).join('');
    if (data.lastUpdated) {
      document.getElementById('lastRefresh').textContent = formatTime(data.lastUpdated);
    }
    // Override lastRefresh with dynamic "now - 25 min" for demo
    (function setDemoSync() {
      function update25() {
        var now = new Date(Date.now() - 25 * 60000);
        document.getElementById('lastRefresh').textContent = formatTime(now.toISOString());
      }
      update25();
      setInterval(update25, 60000);
    })();
  }

  // === Error Log ===
  function renderErrors(data) {
    const list = document.getElementById('list-errors');
    const count = document.getElementById('count-errors');
    if (!list) return;
    const errors = (data && data.errors) || [];
    if (count) count.textContent = errors.length;
    if (errors.length === 0) {
      list.innerHTML = '<div class="card error-card" style="opacity:1;border-left-color:var(--green);">' +
        '<div class="card-desc" style="opacity:0.7; color: var(--green);">No errors in the last 24 hours.</div></div>';
      return;
    }
    list.innerHTML = '';
    errors.slice(0, 20).forEach(function (err, i) {
      const card = document.createElement('div');
      card.className = 'card error-card';
      card.style.animationDelay = (i * 40) + 'ms';
      card.style.borderLeftColor = 'var(--red)';

      const source = (err.source || 'unknown').toUpperCase();
      const badgeClass = err.source === 'cron' ? 'badge-error' : 'badge-error';
      const time = err.timestamp ? formatTime(err.timestamp) : '—';

      card.innerHTML = '<div class="card-title" onclick="toggleDesc(this)">' +
        '<span class="expand-arrow">▶</span>' +
        '<span class="status-badge ' + badgeClass + '"><span class="status-dot"></span>' + source + '</span>' +
        '<span style="color:var(--text-dim); font-size:0.8em;">' + time + '</span>' +
        '</div><div class="card-desc">' + escapeHtml(err.message || '') + '</div>';
      list.appendChild(card);
    });
  }

  // === Parse raw cron expression into human-readable text ===
  function parseCronExpression(expr) {
    if (!expr || typeof expr !== 'string') return '';
    // Strip timezone suffix like " (Asia/Jerusalem)"
    var clean = expr.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!clean) return '';

    var parts = clean.split(/\s+/);
    if (parts.length < 5) return 'Scheduled';
    var min = parts[0], hour = parts[1], dom = parts[2], mon = parts[3], dow = parts[4];

    // Helper: format hour as AM/PM
    function fmtHour(h) {
      h = parseInt(h, 10);
      if (h === 0) return '12 AM';
      if (h === 12) return '12 PM';
      return h < 12 ? (h + ' AM') : ((h - 12) + ' PM');
    }
    // Helper: format time HH:MM as AM/PM
    function fmtTime(h, m) {
      h = parseInt(h, 10); m = parseInt(m, 10);
      var suffix = h < 12 ? 'AM' : 'PM';
      var hd = h % 12 || 12;
      return m === 0 ? (hd + ' ' + suffix) : (hd + ':' + (m < 10 ? '0' : '') + m + ' ' + suffix);
    }
    // Helper: day-of-week range label
    function fmtDow(d) {
      var names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      if (d === '*') return null;
      // Range like 0-4
      var rangeMatch = d.match(/^(\d)-(\d)$/);
      if (rangeMatch) {
        var s = parseInt(rangeMatch[1]), e = parseInt(rangeMatch[2]);
        if (s === 0 && e === 4) return 'Sun–Thu';
        if (s === 0 && e === 5) return 'Sun–Fri';
        if (s === 1 && e === 5) return 'Mon–Fri';
        return (names[s] || s) + '–' + (names[e] || e);
      }
      // List like 0,6
      if (d.indexOf(',') !== -1) {
        return d.split(',').map(function(x){ return names[parseInt(x)] || x; }).join(', ');
      }
      // Single digit
      if (/^\d$/.test(d)) return names[parseInt(d)] || d;
      return null;
    }
    // Helper: hour range label
    function fmtHourRange(h) {
      var rangeMatch = h.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) return fmtHour(rangeMatch[1]) + '–' + fmtHour(rangeMatch[2]);
      return null;
    }

    // Ignore dom and mon for common cases (both *)
    if (dom !== '*' || mon !== '*') return 'Scheduled';

    var dowLabel = fmtDow(dow);

    // Case: */N in minute field (e.g. */15 or */30)
    var everyMinMatch = min.match(/^\*\/(\d+)$/);
    if (everyMinMatch) {
      var interval = parseInt(everyMinMatch[1]);
      var hourRange = fmtHourRange(hour);
      var base = 'Every ' + interval + ' min';
      var parts2 = [base];
      if (hourRange) parts2.push(hourRange);
      if (dowLabel) parts2.push(dowLabel);
      return parts2.join(', ');
    }

    // Minute must be a number from here on
    var minNum = parseInt(min, 10);
    if (isNaN(minNum) && min !== '0') return 'Scheduled';

    // Case: single hour (e.g. 0 14 * * * or 30 10 * * 0-5)
    if (/^\d+$/.test(hour)) {
      var timeStr = fmtTime(hour, min);
      var parts3 = ['Daily at ' + timeStr];
      if (dowLabel) parts3 = ['Daily at ' + timeStr + ', ' + dowLabel];
      return parts3.join('');
    }

    // Case: hour range with fixed minute (e.g. 20 6-22 * * * → "Hourly at :20, 6 AM–10 PM")
    var hourRangeMatch = hour.match(/^(\d+)-(\d+)$/);
    if (hourRangeMatch) {
      var hrStart = parseInt(hourRangeMatch[1]), hrEnd = parseInt(hourRangeMatch[2]);
      var prefix = minNum === 0 ? 'Hourly' : ('Hourly at :' + (minNum < 10 ? '0' : '') + minNum);
      var rangeStr = fmtHour(hrStart) + '–' + fmtHour(hrEnd);
      var parts4 = [prefix, rangeStr];
      if (dowLabel) parts4.push(dowLabel);
      return parts4.join(', ');
    }

    // Case: comma-separated hours (e.g. 0 11,19 * * * or 0 8,10,12,14,16,18,20,22 * * 0-4)
    if (hour.indexOf(',') !== -1) {
      var hours = hour.split(',').map(function(x){ return parseInt(x, 10); });
      // Detect evenly-spaced pattern (every N hours)
      var isEven = hours.length > 2;
      if (isEven) {
        var gaps = [];
        for (var gi = 1; gi < hours.length; gi++) gaps.push(hours[gi] - hours[gi-1]);
        var allSame = gaps.every(function(g){ return g === gaps[0]; });
        if (allSame && gaps[0] > 0) {
          var hStart = fmtHour(hours[0]), hEnd = fmtHour(hours[hours.length-1]);
          var parts5 = ['Every ' + gaps[0] + 'h, ' + hStart + '–' + hEnd];
          if (dowLabel) parts5.push(dowLabel);
          return parts5.join(', ');
        }
      }
      // List of hours
      var timeList = hours.map(function(h){ return fmtTime(h, min); }).join(' & ');
      var parts6 = ['Daily at ' + timeList];
      if (dowLabel) parts6 = ['Daily at ' + timeList + ', ' + dowLabel];
      return parts6.join('');
    }

    return 'Scheduled';
  }

  // === Scheduled Operations (live cron data, grouped by division) ===
  function renderCrons(cronApiData, cronLookup) {
    const list = document.getElementById('list-crons');
    const count = document.getElementById('count-crons');
    if (!list || !cronApiData) return;

    const jobs = cronApiData.jobs || [];
    const cronMapping = cronApiData.cronMapping || {};
    cronLookup = cronLookup || {};

    // Update RESOURCE MONITOR button color based on error status
    var hasAnyError = false;
    for (var ei = 0; ei < jobs.length; ei++) {
      if (jobs[ei].enabled && jobs[ei].lastStatus === 'error') { hasAnyError = true; break; }
    }
    var sitrepBtn = document.getElementById('viewSitrep');
    if (sitrepBtn) {
      if (hasAnyError) sitrepBtn.classList.add('resource-monitor-error');
      else sitrepBtn.classList.remove('resource-monitor-error');
    }
    var modalTitle = document.querySelector('.sitrep-modal .modal-title');
    if (modalTitle) {
      if (hasAnyError) modalTitle.classList.add('resource-monitor-error');
      else modalTitle.classList.remove('resource-monitor-error');
    }

    // Group jobs by division
    var divGroups = {}; // divId -> [job, ...]
    var unassigned = [];
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var divId = matchCronMapping(job.name, cronMapping) || matchCronMapping(job.id, cronMapping);
      if (divId) {
        if (!divGroups[divId]) divGroups[divId] = [];
        divGroups[divId].push(job);
      } else {
        unassigned.push(job);
      }
    }

    // Build ordered division list
    var orderedIds = DIVISION_ORDER.slice();
    for (var d in divGroups) {
      if (orderedIds.indexOf(d) === -1) orderedIds.push(d);
    }
    if (unassigned.length > 0) orderedIds.push('__other__');

    var totalCount = 0;
    var html = '';

    for (var di = 0; di < orderedIds.length; di++) {
      var divId = orderedIds[di];
      var divJobs = divId === '__other__' ? unassigned : (divGroups[divId] || []);
      if (divJobs.length === 0) continue;

      var display = DIVISION_DISPLAY[divId] || { label: divId === '__other__' ? 'OTHER' : divId.toUpperCase(), color: 'var(--text-dim)' };
      var divIcon = divId === '__other__' ? '❓' : (
        divId === 'intelligence' ? '📡' :
        divId === 'communications' ? '📋' :
        divId === 'security' ? '🔐' :
        divId === 'operations' ? '⚙️' :
        divId === 'personal-lifestyle' ? '💪' :
        divId === 'agent-deployments' ? '' : '📋'
      );
      totalCount += divJobs.length;

      html += '<div class="cron-division">';
      html += '<div class="cron-division-header" style="border-left-color:' + display.color + '">';
      html += '<span class="cron-division-icon">' + divIcon + '</span>';
      html += '<span class="cron-division-label" style="color:' + display.color + '">' + display.label + '</span>';
      html += '<span class="cron-division-count">' + divJobs.length + '</span>';
      html += '</div>';

      for (var ji = 0; ji < divJobs.length; ji++) {
        var j = divJobs[ji];

        // Look up friendly info from agent-structure
        var info = cronLookup[j.name] || cronLookup[j.id] || null;
        var displayName = (info && info.displayName) ? info.displayName : j.name;
        var description = (info && info.description) ? info.description : '';
        var friendlySchedule = (info && info.friendlySchedule) ? info.friendlySchedule : parseCronExpression(j.schedule || '');

        // Determine real status
        var badgeClass, statusLabel;
        if (!j.enabled) {
          badgeClass = 'badge-disabled';
          statusLabel = 'DISABLED';
        } else if (j.lastStatus === 'error') {
          badgeClass = 'badge-error';
          statusLabel = j.consecutiveErrors > 1 ? 'ERR×' + j.consecutiveErrors : 'ERROR';
        } else if (j.lastStatus === 'ok') {
          badgeClass = 'badge-ok';
          statusLabel = 'OK';
        } else {
          badgeClass = 'badge-scheduled';
          statusLabel = 'SCHEDULED';
        }

        var lastStr = timeAgo(j.lastRunAt);
        var nextStr = timeUntil(j.nextRunAt);

        html += '<div class="card cron-card" style="border-left-color:' + display.color + '">';
        html += '<div class="card-title" onclick="toggleDesc(this)">';
        html += '<span class="expand-arrow">▶</span>';
        html += '<span class="status-badge ' + badgeClass + '"><span class="status-dot"></span>' + statusLabel + '</span>';
        html += escapeHtml(displayName);
        html += '<span class="impl-tag">⏱ CRON</span>';
        html += '</div>';
        // Description (hidden until click)
        html += '<div class="card-desc">' + escapeHtml(description) + '</div>';
        // Meta line: schedule + last/next run times (always visible)
        var metaParts = [];
        if (friendlySchedule) metaParts.push('<span class="cron-schedule-val">' + escapeHtml(friendlySchedule) + '</span>');
        if (lastStr) metaParts.push('Last: <span class="cron-time-val">' + lastStr + '</span>');
        if (nextStr) metaParts.push('Next: <span class="cron-time-val">' + nextStr + '</span>');
        if (metaParts.length > 0) {
          html += '<div class="card-meta cron-time-meta expanded">' + metaParts.join(' &nbsp;·&nbsp; ') + '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    if (html === '') {
      html = '<div class="card" style="opacity:0.5;"><div class="card-desc" style="opacity:0.7;color:var(--text-dim);">No cron jobs found.</div></div>';
    }

    list.innerHTML = html;
    if (count) count.textContent = totalCount;
  }

  // === Skills Panel (3-state: learned / loaded / learnable) ===
  function renderSkills(skillsData) {
    const list = document.getElementById('list-skills');
    const count = document.getElementById('count-skills');
    if (!list) return;

    const skills = (skillsData && skillsData.skills) || [];
    if (count) count.textContent = skills.length;

    if (skills.length === 0) {
      list.innerHTML = '<div class="card skill-card" style="opacity:0.5;">' +
        '<div class="card-desc" style="opacity:0.7; color: var(--text-dim);">No skills discovered.</div></div>';
      return;
    }

    var html = '';
    var currentState = '';
    var stateLabels = { learned: 'LEARNED', loaded: 'LOADED', learnable: 'LEARNABLE' };

    for (var i = 0; i < skills.length; i++) {
      var skill = skills[i];

      // Group header when state changes
      if (skill.state !== currentState) {
        currentState = skill.state;
        var stateCount = 0;
        for (var j = 0; j < skills.length; j++) {
          if (skills[j].state === currentState) stateCount++;
        }
        html += '<div class="skill-group-header skill-group-' + currentState + '">';
        html += '<span class="skill-group-label">' + stateLabels[currentState] + '</span>';
        html += '<span class="skill-group-count">' + stateCount + '</span>';
        html += '<span class="skill-group-line"></span>';
        html += '</div>';
      }

      var badgeClass = 'badge-skill-' + skill.state;
      var stateLabel = stateLabels[skill.state];
      var cardClass = 'card skill-card skill-card-' + skill.state;

      html += '<div class="' + cardClass + '" style="animation-delay:' + (i * 30) + 'ms">';
      html += '<div class="skill-row">';
      html += '<span class="status-badge ' + badgeClass + '"><span class="status-dot"></span>' + stateLabel + '</span>';
      html += '<span class="skill-name">' + escapeHtml(skill.name) + '</span>';
      html += '<span class="skill-type-tag skill-type-' + skill.type + '">' + skill.type + '</span>';
      html += '</div>';
      html += '</div>';
    }

    list.innerHTML = html;
  }

  // === ORG CHART MODAL ===
  function renderOrgChart(structure) {
    const tree = document.getElementById('structureTree');
    if (!tree || !structure) return;

    let html = '';

    // Director card (top, centered)
    const dir = structure.director || {};
    html += '<div class="org-director">';
    html += '<div class="org-director-card" onclick="toggleDirectorDesc(this)">';
    html += '<div class="org-director-name">' + escapeHtml(dir.name || 'Director') + '</div>';
    html += '<div class="org-director-meta">';
    html += '<span class="status-badge badge-active"><span class="status-dot"></span>ACTIVE</span>';
    html += '</div>';
    html += '<div class="org-director-desc">';
    var displayModel = _mainSessionModel || dir.model;
    if (displayModel) html += '<div class="org-model">' + escapeHtml(displayModel) + '</div>';
    html += escapeHtml(dir.description || '');
    html += '</div>';
    html += '</div>';
    html += '<div class="org-connector-down"></div>';
    html += '</div>';

    // Division grid (exclude special-ops — rendered as footer bar)
    html += '<div class="org-divisions-grid">';

    for (const div of (structure.divisions || []).filter(d => d.id !== 'agent-deployments')) {
      const hc = HEALTH_CONFIG[div.health] || HEALTH_CONFIG['idle'];
      const display = DIVISION_DISPLAY[div.id] || { label: div.name.toUpperCase(), color: 'var(--text-dim)' };

      html += '<div class="org-division-card" data-div-id="' + div.id + '">';
      html += '<div class="org-division-header" style="border-top-color:' + display.color + '">';
      html += '<div class="org-division-icon-row" onclick="toggleDivMandate(this)">';
      html += '<span class="org-div-icon">' + (div.icon || '📋') + '</span>';
      html += '<span class="org-div-name" style="color:' + display.color + '">' + escapeHtml(div.name) + '</span>';
      html += '</div>';
      html += '<div class="org-health-badge" style="color:' + hc.color + '; border-color:' + hc.color + '">';
      html += hc.dot + ' ' + hc.label;
      html += '</div>';
      html += '</div>';

      html += '<div class="org-division-mandate">' + escapeHtml(div.mandate || '') + '</div>';

      // Units
      html += '<div class="org-units">';
      for (const unit of (div.units || [])) {
        const isPlanned = unit.type === 'planned';
        const isInfo = unit.type === 'info';
        const isManual = unit.type === 'manual';
        const isTeam = unit.type === 'team';

        html += '<div class="org-unit ' + (isPlanned ? 'org-planned' : '') + (isInfo ? 'org-info' : '') + '">';

        if (isTeam) {
          html += '<div class="org-unit-name">' + escapeHtml(unit.name) + '</div>';
          for (const m of (unit.members || [])) {
            const implLabel = IMPL_LABELS[m.impl] || '';
            const badgeClass = m.status === 'active' ? 'badge-active' :
              m.status === 'loaded' ? 'badge-loaded' :
              m.status === 'scheduled' ? 'badge-scheduled' : 'badge-idle';

            html += '<div class="org-member">';
            html += '<div class="org-member-name" onclick="toggleOrgDesc(this,\'org-member-desc\')">';
            html += escapeHtml(m.name);
            if (implLabel) html += ' <span class="impl-tag">' + implLabel + '</span>';
            html += ' <span class="status-badge ' + badgeClass + '"><span class="status-dot"></span>' + (m.status || '').toUpperCase() + '</span>';
            html += '</div>';
            if (m.schedule) html += '<div class="org-member-schedule">' + escapeHtml(m.schedule) + '</div>';
            html += '<div class="org-member-desc">' + escapeHtml(m.description || '') + '</div>';
            html += '</div>';
          }
        } else if (isPlanned) {
          html += '<div class="org-unit-name org-planned-label" onclick="toggleOrgDesc(this,\'org-member-desc\')">▫ ' + escapeHtml(unit.name) + ' <span class="planned-tag">PLANNED</span></div>';
          html += '<div class="org-member-desc">' + escapeHtml(unit.description || '') + '</div>';
        } else if (isManual) {
          html += '<div class="org-unit-name" onclick="toggleOrgDesc(this,\'org-member-desc\')">▸ ' + escapeHtml(unit.name) + ' <span class="impl-tag">👤 MANUAL</span></div>';
          html += '<div class="org-member-desc">' + escapeHtml(unit.description || '') + '</div>';
        } else if (isInfo) {
          html += '<div class="org-unit-name" onclick="toggleOrgDesc(this,\'org-member-desc\')">▸ ' + escapeHtml(unit.name) + '</div>';
          html += '<div class="org-member-desc">' + escapeHtml(unit.description || '') + '</div>';
        }

        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    tree.innerHTML = html;
  }

  // === Special Operations Footer Bar (LIVE sessions) ===
  function renderSpecOpsBar(structure, sessionsData) {
    const bar = document.getElementById('specopsBar');
    if (!bar) return;

    const sessions = (sessionsData && sessionsData.sessions) || [];
    const nonMainSessions = sessions.filter(function(s) { return s.kind !== 'main'; });
    const runningCount = nonMainSessions.filter(function(s) { return s.status === 'running'; }).length;
    const recentCount = nonMainSessions.length;
    const activeCount = sessions.length;
    const isRunning = runningCount > 0;
    const statusColor = isRunning ? 'var(--green)' : 'var(--blue)';
    const statusLabel = isRunning ? 'RUNNING' : 'IDLE';
    const statusDot = isRunning ? '🟢' : '🔵';

    let barHtml = '';
    barHtml += '<span class="specops-bar-label">Agent Deployments</span>';
    barHtml += '<span class="specops-bar-sep">|</span>';
    barHtml += '<span class="specops-bar-stat"><strong>Running:</strong> ' + runningCount + (recentCount > runningCount ? ' &nbsp;<span style="color:var(--text-dim);">(' + recentCount + ' recent)</span>' : '') + '</span>';
    barHtml += '<span class="specops-bar-sep">|</span>';
    barHtml += '<span class="specops-bar-health" style="color:' + statusColor + ';border-color:' + statusColor + '">' + statusDot + ' ' + statusLabel + '</span>';

    bar.innerHTML = barHtml;

    // Build detail panel
    let detail = document.getElementById('specopsDetail');
    if (!detail) {
      detail = document.createElement('div');
      detail.id = 'specopsDetail';
      detail.className = 'specops-detail';
      document.body.appendChild(detail);
    }

    let detailHtml = '<div class="specops-detail-header">';
    detailHtml += '<span class="specops-detail-title">AGENT DEPLOYMENTS — ' + statusLabel + '</span>';
    detailHtml += '<button class="specops-detail-close" id="closeSpecOps">✕ CLOSE</button>';
    detailHtml += '</div>';
    detailHtml += '<div class="specops-detail-grid">';

    if (sessions.length === 0) {
      detailHtml += '<div class="specops-detail-card" style="grid-column: 1 / -1;">';
      detailHtml += '<div class="specops-detail-card-desc" style="opacity:0.6;">No active sessions in the last 2 hours.</div>';
      detailHtml += '</div>';
    } else {
      // Build parent→children tree from spawnedBy field
      var childrenOf = {}; // parentKey → [session, ...]
      var roots = [];
      for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        var parent = s.spawnedBy || '';
        // Check if parent is also in our session list
        var parentInList = false;
        if (parent) {
          for (var j = 0; j < sessions.length; j++) {
            if (sessions[j].key === parent) { parentInList = true; break; }
          }
        }
        if (parent && parentInList) {
          if (!childrenOf[parent]) childrenOf[parent] = [];
          childrenOf[parent].push(s);
        } else {
          roots.push(s);
        }
      }

      function renderSessionCard(s, depth) {
        var isDone = s.status === 'completed';
        var kindColor = s.kind === 'main' ? 'var(--cyan)' : s.kind === 'subagent' ? 'var(--green)' : 'var(--amber)';
        var cardColor = isDone ? 'var(--text-dim)' : kindColor;
        var kindLabel = s.kind.toUpperCase();
        var statusTag = isDone ? ' <span style="color:var(--text-dim);font-size:0.75em;margin-left:6px;">✓ DONE</span>' : ' <span style="color:var(--green);font-size:0.75em;margin-left:6px;">● RUNNING</span>';
        if (s.kind === 'main') statusTag = '';
        var tokStr = s.tokens ? (s.tokens > 1000 ? Math.round(s.tokens / 1000) + 'k' : s.tokens) : '—';
        var indent = depth * 24;
        var prefix = depth > 0 ? '<span style="color:var(--text-dim);margin-right:6px;">└─</span>' : '';
        var cardOpacity = isDone ? 'opacity:0.6;' : '';
        var html = '';
        html += '<div class="specops-detail-card" style="border-left-color:' + cardColor + ';margin-left:' + indent + 'px;' + cardOpacity + '">';
        html += '<div class="specops-detail-card-title">';
        html += prefix;
        html += '<span class="status-badge" style="background:' + cardColor + '22;color:' + cardColor + ';border:1px solid ' + cardColor + '44;padding:2px 8px;border-radius:3px;font-size:0.75em;margin-right:8px;">' + kindLabel + '</span>';
        html += escapeHtml(s.label);
        html += statusTag;
        html += '</div>';
        html += '<div class="specops-detail-card-desc">';
        html += '<span style="color:var(--text-dim);">' + (isDone ? 'Completed:' : 'Age:') + '</span> ' + escapeHtml(s.age) + ' ago';
        html += ' &nbsp;·&nbsp; <span style="color:var(--text-dim);">Model:</span> ' + escapeHtml(s.model || '—');
        html += ' &nbsp;·&nbsp; <span style="color:var(--text-dim);">Tokens:</span> ' + tokStr;
        html += '</div>';
        html += '</div>';
        // Render children recursively
        var kids = childrenOf[s.key] || [];
        for (var c = 0; c < kids.length; c++) {
          html += renderSessionCard(kids[c], depth + 1);
        }
        return html;
      }

      for (var r = 0; r < roots.length; r++) {
        detailHtml += renderSessionCard(roots[r], 0);
      }
    }

    detailHtml += '</div>';
    detail.innerHTML = detailHtml;

    document.getElementById('closeSpecOps').addEventListener('click', function (e) {
      e.stopPropagation();
      detail.classList.remove('expanded');
    });

    bar.onclick = function () {
      detail.classList.toggle('expanded');
    };
  }

  // === Global toggle functions ===
  window.toggleDesc = function (titleEl) {
    const card = titleEl.parentElement;
    const desc = card.querySelector('.card-desc');
    const meta = card.querySelector('.card-meta');
    const arrow = titleEl.querySelector('.expand-arrow');
    if (desc) desc.classList.toggle('expanded');
    if (meta) meta.classList.toggle('expanded');
    if (arrow) arrow.classList.toggle('open');
  };

  window.toggleOrgDesc = function (el, targetClass) {
    const parent = el.closest('.org-member, .org-unit, .org-division-card, .org-director');
    if (!parent) return;
    const target = parent.querySelector('.' + targetClass);
    if (target) target.classList.toggle('expanded');
  };

  window.toggleDirectorDesc = function (el) {
    const desc = el.querySelector('.org-director-desc');
    if (desc) desc.classList.toggle('expanded');
  };

  window.toggleDivMandate = function (el) {
    const card = el.closest('.org-division-card');
    if (!card) return;
    const mandate = card.querySelector('.org-division-mandate');
    if (mandate) mandate.classList.toggle('expanded');
  };

  // === SITREP Modal Controls ===
  const modal = document.getElementById('sitrepModal');
  // === Token Usage Rendering ===
  function formatTokens(n) {
    if (!n || n === 0) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function formatCost(c) {
    if (!c || c === 0) return '—';
    if (c >= 100) return '$' + c.toFixed(0);
    if (c >= 10) return '$' + c.toFixed(1);
    return '$' + c.toFixed(2);
  }

  function renderUsageCell(d) {
    if (!d || (!d.tokens && !d.cost)) return '<div class="usage-zero">—</div>';
    return '<div class="usage-tokens">' + formatTokens(d.tokens) + '</div><div class="usage-cost">' + formatCost(d.cost) + '</div>';
  }

  function renderUsageTable(data) {
    var container = document.getElementById('usage-table-container');
    var scanned = document.getElementById('usage-last-scanned');
    if (!container) return;
    if (!data || !data.models) { container.innerHTML = '<div style="color:var(--text-dim);opacity:0.5;">No usage data available.</div>'; return; }

    var periods = ['today', 'yesterday', '7days', 'mtd'];
    var headers = ['MODEL', 'TODAY', 'YESTERDAY', '7 DAYS', 'MTD'];
    var html = '<table class="usage-table"><thead><tr>';
    for (var h = 0; h < headers.length; h++) html += '<th>' + headers[h] + '</th>';
    html += '</tr></thead><tbody>';

    // Filter out models with zero MTD tokens
    var models = data.models.filter(function(m) { return m.mtd && m.mtd.tokens > 0; });
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      html += '<tr><td>' + escapeHtml(m.short) + '</td>';
      for (var p = 0; p < periods.length; p++) html += '<td>' + renderUsageCell(m[periods[p]]) + '</td>';
      html += '</tr>';
    }

    // Total row
    html += '<tr class="usage-total-row"><td>ALL MODELS</td>';
    for (var p = 0; p < periods.length; p++) html += '<td>' + renderUsageCell(data.totals[periods[p]]) + '</td>';
    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
    if (scanned) scanned.textContent = data.lastScanned ? 'Last scanned: ' + data.lastScanned : '';
  }

  // === Auth Status Toggle ===
  let _showingAuth = false;

  async function fetchAuthStatus() {
    try {
      var res = await fetch('auth-status.json');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { console.error('Auth status fetch failed:', e); return null; }
  }

  function renderAuthStatus(data) {
    var panel = document.getElementById('auth-status-panel');
    if (!panel || !data) return;
    var icon = data.mode === 'token' ? '🪪' : data.mode === 'api_key' ? '💳' : '❓';
    var label = data.mode === 'token' ? 'Subscription Token' : data.mode === 'api_key' ? 'API Key' : data.label || data.mode;
    panel.innerHTML = '<div style="padding:1vh 1vw;border:1px solid var(--cyan)22;border-radius:4px;background:var(--cyan)06;margin-top:0.5vh;">' +
      '<div class="section-header" style="margin-bottom:0.4vh;"><span class="header-line"></span><span class="header-text">AUTH STATUS</span><span class="header-line"></span></div>' +
      '<div style="font-size:0.95em;color:var(--text);letter-spacing:0.05em;">' + escapeHtml(label) + ' ' + icon + '</div>' +
      '</div>';
  }

  // Auth status always visible on load
  (async function initAuthDisplay() {
    var data = await fetchAuthStatus();
    if (data) renderAuthStatus(data);
  })();

  async function fetchUsage() {
    try {
      var res = await fetch('usage.json');
      if (!res.ok) return;
      var data = await res.json();
      renderUsageTable(data);
    } catch (e) { console.error('Usage fetch failed:', e); }
  }

  document.getElementById('viewSitrep').addEventListener('click', function () {
    modal.classList.add('visible');
    fetchUsage();
    fetchModels();
    fetchLiveCrons();
  });
  document.getElementById('closeSitrep').addEventListener('click', function () {
    modal.classList.remove('visible');
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.remove('visible');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      modal.classList.remove('visible');
    }
  });

  // === Error Log Expander ===
  const errorExpander = document.getElementById('errorExpander');
  const errorList = document.getElementById('list-errors');
  if (errorExpander && errorList) {
    errorExpander.addEventListener('click', function () {
      const visible = errorList.style.display !== 'none';
      errorList.style.display = visible ? 'none' : 'block';
      this.textContent = visible ? '▶ Expand to view' : '▼ Click to collapse';
      this.classList.toggle('open', !visible);
    });
  }

  // === Refresh Button ===
  const refreshBtn = document.getElementById('refreshAll');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      this.classList.add('spinning');
      setTimeout(() => this.classList.remove('spinning'), 600);
      fetchAll();
    });
  }

  // === Click-outside-to-close for Agent Deployments detail + Improvements Queue ===
  document.addEventListener('click', function (e) {
    const detail = document.getElementById('specopsDetail');
    const bar = document.getElementById('specopsBar');
    if (detail && detail.classList.contains('expanded')) {
      if (!detail.contains(e.target) && !bar.contains(e.target)) {
        detail.classList.remove('expanded');
      }
    }
    // Collapse improvements panel when clicking outside
    const impOverlay = document.getElementById('improvementsOverlay');
    const impList = document.getElementById('list-improvements');
    if (impOverlay && impList && impList.style.display !== 'none') {
      if (!impOverlay.contains(e.target)) {
        impList.style.display = 'none';
      }
    }
  });

  // === Keyboard & Swipe Navigation ===
  const DASHBOARDS = ['../agenda/', '../crm/', '../project-view/', '../system-monitor/'];
  const currentIdx = 3; // System Monitor

  document.addEventListener('keydown', function (e) {
    // Don't navigate if modal is open
    if (modal.classList.contains('visible')) return;
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
      if (modal.classList.contains('visible')) return;
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

  // === Data Fetching ===
  let _fetchAllHadError = false;

  async function fetchStatus() {
    const res = await fetch('status.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderSystem(data);
    return data;
  }

  async function fetchStructure() {
    const res = await fetch('agent-structure.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    _structureCache = data;
    renderOrgChart(data);
  }

  async function fetchBenReminders() {
    try {
      const res = await fetch('ben-reminders.json');
      if (!res.ok) return new Set();
      const data = await res.json();
      const ids = new Set();
      (data.items || []).forEach(function (item) {
        if (item.cronJobId) ids.add(item.cronJobId);
      });
      return ids;
    } catch (e) {
      console.error('BEN reminders fetch failed:', e);
      return new Set();
    }
  }

  async function fetchLiveCrons() {
    try {
      const [cronRes, benIds] = await Promise.all([fetch('crons.json'), fetchBenReminders()]);
      if (!cronRes.ok) throw new Error('HTTP ' + cronRes.status);
      const data = await cronRes.json();
      // Filter out crons already displayed in BEN Future Reminders section
      if (benIds.size > 0) {
        data.jobs = (data.jobs || []).filter(function (job) {
          return !benIds.has(job.id) && !benIds.has(job.name);
        });
      }
      const lookup = _structureCache ? buildCronLookup(_structureCache) : {};
      renderCrons(data, lookup);
    } catch (e) { console.error('Crons fetch failed:', e); }
  }

  async function fetchSessions() {
    try {
      const res = await fetch('sessions.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      // Extract main session model for dynamic display
      const mainSession = (data.sessions || []).find(s => s.kind === 'main');
      if (mainSession && mainSession.model) {
        _mainSessionModel = mainSession.model;
        // Update displayed model in org chart if already rendered
        const modelEl = document.querySelector('.org-director-desc .org-model');
        if (modelEl) modelEl.textContent = _mainSessionModel;
      }
      renderSpecOpsBar(null, data);
    } catch (e) { console.error('Sessions fetch failed:', e); }
  }

  async function fetchSkills() {
    try {
      const res = await fetch('skills.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderSkills(data);
    } catch (e) { console.error('Skills fetch failed:', e); }
  }

  async function fetchErrors() {
    const res = await fetch('errors.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderErrors(data);
  }

  // === Model Nicknames ===
  function renderModels(data) {
    const panel = document.getElementById('models-panel');
    if (!panel) return;
    const aliased = (data && data.aliased) || [];
    const unaliased = (data && data.unaliased) || [];

    if (aliased.length === 0 && unaliased.length === 0) {
      panel.innerHTML = '<div style="color:var(--text-dim);opacity:0.5;font-size:0.8em;padding:0.4vh 0;">No models configured.</div>';
      return;
    }

    // Sort: default first, then fallbacks alphabetically by alias
    aliased.sort(function(a, b) {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      // Both fallbacks (or both non-default) — sort by alias alphabetically
      return (a.alias || '').localeCompare(b.alias || '');
    });

    var html = '';

    for (var i = 0; i < aliased.length; i++) {
      var m = aliased[i];
      // Strip provider prefix for display (show short ID)
      var shortId = m.id.replace(/^[^/]+\//, '');
      var tags = '';
      if (m.isDefault) tags += '<span class="model-tag default">DEFAULT</span>';
      if (m.isFallback) tags += '<span class="model-tag fallback">FALLBACK</span>';

      html += '<div class="model-row">';
      html += '<span class="model-alias">' + escapeHtml(m.alias) + '</span>';
      html += '<span class="model-arrow">→</span>';
      html += '<span class="model-id" title="' + escapeHtml(m.id) + '">' + escapeHtml(shortId) + '</span>';
      if (tags) html += '<span class="model-tags">' + tags + '</span>';
      html += '</div>';
    }

    for (var j = 0; j < unaliased.length; j++) {
      var u = unaliased[j];
      var shortId2 = u.id.replace(/^[^/]+\//, '');
      var tags2 = '';
      if (u.isDefault) tags2 += '<span class="model-tag default">DEFAULT</span>';
      if (u.isFallback) tags2 += '<span class="model-tag fallback">FALLBACK</span>';

      html += '<div class="model-row model-unaliased">';
      html += '<span class="model-id" title="' + escapeHtml(u.id) + '" style="min-width:auto;flex:1;">' + escapeHtml(shortId2) + '</span>';
      if (tags2) html += '<span class="model-tags">' + tags2 + '</span>';
      html += '</div>';
    }

    panel.innerHTML = html;
  }

  async function fetchModels() {
    try {
      const res = await fetch('models.json');
      if (!res.ok) return;
      const data = await res.json();
      renderModels(data);
    } catch (e) { console.error('Models fetch failed:', e); }
  }

  async function fetchAll() {
    try {
      // Fetch structure first so cronLookup is populated before renderCrons runs
      await fetchStructure();
      const results = await Promise.all([fetchStatus(), fetchErrors(), fetchSessions(), fetchSkills(), fetchModels(), fetchLiveCrons()]);
      _fetchAllHadError = false;
      // results[0] is status data
      const statusData = results[0];
      onFetchSuccess(statusData && statusData.lastUpdated);
    } catch (e) {
      console.error('Fetch failed:', e);
      if (!_fetchAllHadError) onFetchError();
      _fetchAllHadError = true;
    }
    checkStaleness();
  }

  // === Improvements Queue ===
  const SEV_ORDER = {critical: 0, high: 1, medium: 2, low: 3};
  const STATUS_ORDER = {pending: 0, approved: 1, stale: 2, implemented: 3, rejected: 4};

  function renderImprovements(data) {
    const list = document.getElementById('list-improvements');
    const badge = document.getElementById('impCountBadge');
    if (!list || !badge) return;
    const items = (data && data.items) || [];
    const pending = items.filter(i => i.status === 'pending').length;
    badge.textContent = pending;
    badge.className = 'imp-count-badge' + (pending === 0 ? ' zero' : '');

    items.sort((a, b) => {
      const sd = (STATUS_ORDER[a.status]||9) - (STATUS_ORDER[b.status]||9);
      if (sd !== 0) return sd;
      return (SEV_ORDER[a.severity]||9) - (SEV_ORDER[b.severity]||9);
    });

    if (items.length === 0) {
      list.innerHTML = '<div style="color:var(--text-dim);font-size:0.8em;padding:0.5vh 0;">No items in queue.</div>';
      return;
    }

    let html = '';
    for (const item of items) {
      const rationale = (item.rationale || '').length > 120 ? item.rationale.substring(0, 120) + '…' : (item.rationale || '');
      const ts = item.timestamp ? new Date(item.timestamp).toLocaleString('en-IL', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      html += '<div class="imp-item status-' + item.status + '">';
      html += '<div class="imp-item-top">';
      html += '<span class="imp-badge imp-sev-' + item.severity + '">' + escapeHtml(item.severity) + '</span>';
      html += '<span class="imp-badge imp-cat">' + escapeHtml(item.category) + '</span>';
      html += '<span class="imp-title">' + escapeHtml(item.title) + '</span>';
      html += '</div>';
      if (rationale) html += '<div class="imp-rationale">' + escapeHtml(rationale) + '</div>';
      html += '<div class="imp-meta">' + escapeHtml(ts);
      if (item.status !== 'pending') html += ' · ' + item.status.toUpperCase();
      html += '</div>';
      if (item.status === 'pending') {
        html += '<div class="imp-actions">';
        html += '<button class="imp-btn imp-btn-approve" onclick="window._impAction(\'' + item.id + '\',\'approve\')">✅ APPROVE</button>';
        html += '<button class="imp-btn imp-btn-reject" onclick="window._impAction(\'' + item.id + '\',\'reject\')">❌ REJECT</button>';
        html += '</div>';
      }
      html += '</div>';
    }
    list.innerHTML = html;
  }

  window._impAction = async function(id, action) {
    try {
      /* disabled in static mode */return;
      await fetchImprovements();
    } catch (e) { console.error('Improvement action failed:', e); }
  };

  async function fetchImprovements() {
    try {
      const res = await fetch('improvements.json');
      if (!res.ok) return;
      const data = await res.json();
      renderImprovements(data);
    } catch (e) { console.error('Improvements fetch failed:', e); }
  }

  // Toggle improvements panel visibility
  const impToggle = document.getElementById('improvementsToggle');
  const impList = document.getElementById('list-improvements');
  if (impToggle && impList) {
    // Default: collapsed
    impList.style.display = 'none';
    let impExpanded = false;
    impToggle.addEventListener('click', () => {
      impExpanded = !impExpanded;
      impList.style.display = impExpanded ? '' : 'none';
    });
  }

  setInterval(fetchImprovements, 30 * 1000);
  fetchImprovements();

  setInterval(fetchAll, 30 * 1000);
  setInterval(fetchSessions, 10 * 1000);
  setInterval(fetchLiveCrons, 30 * 1000);
  fetchAll();
})();
