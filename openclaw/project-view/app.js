// OPENCLAW — Project View Controller
(function () {
  'use strict';

  const STATUS_LABEL = {
    'in-progress': 'IN-PROGRESS',
    'action-needed': 'ACTION NEEDED',
    'overdue': 'OVERDUE',
    'planning': 'PLANNING',
    'new': 'NEW',
    'scheduled': 'SCHEDULED',
    'not-started': 'NOT STARTED',
    'pending': 'PENDING',
    'unread': 'UNREAD',
    'active': 'ACTIVE',
  };

  const SCAN_LABELS = {
    'openclaw-general': 'OpenClaw — General',
    'openclaw-agents': 'OpenClaw — Agents & AI',
    'socialmedia': '@SocialMedia Intel',
  };

  // === Error / Stale-Data Banner ===
  const STALE_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes
  let _lastSuccessData = null;
  let _fetchErrorActive = false;
  let refreshState = null; // null | { preLastUpdated, startTime }

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

  // === Refresh Control ===
  async function doRefresh() {
    const btn = document.getElementById('refreshAll');
    try {
      console.log('Static demo — refresh disabled'); const res = {ok: false};
      const data = await res.json();
      if (data.status === 'throttled') {
        showSyncStatus('Already refreshing...', '#f5a623');
        setTimeout(() => { if (!refreshState) restoreSyncDisplay(); }, 3000);
        return;
      }
      // Enter refreshing state
      const lastEl = document.getElementById('lastRefresh');
      refreshState = {
        preLastUpdated: lastEl ? lastEl.textContent : null,
        startTime: Date.now()
      };
      btn.disabled = true;
      btn.style.opacity = '0.5';
      showSyncStatus('⟳ REFRESHING...', '#f5a623');
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }

  function showSyncStatus(text, color) {
    const container = document.getElementById('lastRefresh')?.parentElement;
    if (!container) return;
    const valueEl = document.getElementById('lastRefresh');
    if (valueEl) {
      valueEl.textContent = text;
      valueEl.style.color = color || '';
    }
  }

  function restoreSyncDisplay() {
    const valueEl = document.getElementById('lastRefresh');
    if (valueEl && cachedProjects && cachedProjects.lastUpdated) {
      const d = new Date(cachedProjects.lastUpdated);
      const t = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      valueEl.textContent = t;
      valueEl.style.color = '';
    }
  }

  function checkRefreshComplete(newLastUpdated) {
    if (!refreshState) return;
    const btn = document.getElementById('refreshAll');
    const elapsed = Date.now() - refreshState.startTime;

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
  setInterval(checkStaleness, 30000); // check staleness every 30s

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // === Track expanded state (all expanded by default) ===
  const expandedCategories = new Set();
  let initialRender = true;

  // === Render Project Categories ===
  function renderProjects(data, xscansData) {
    const grid = document.getElementById('projectGrid');
    if (!grid || !data || !data.categories) return;

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

    grid.innerHTML = '';

    data.categories.forEach(function (cat, catIdx) {
      const card = document.createElement('div');
      card.className = 'project-category';
      card.style.animationDelay = (catIdx * 100) + 'ms';
      card.style.borderTopColor = cat.color || 'var(--cyan)';

      // On first render, expand all categories and track them
      if (initialRender) {
        expandedCategories.add(cat.id);
      }
      const isExpanded = expandedCategories.has(cat.id);

      // Determine item count
      let itemCount = cat.items ? cat.items.length : 0;
      if (cat.id === 'xtwitter' && xscansData && xscansData.scans) {
        itemCount = Object.keys(xscansData.scans).length;
      }

      // Header
      let html = '<div class="project-cat-header" data-cat-id="' + cat.id + '">';
      html += '<div class="project-cat-left">';
      html += '<span class="project-cat-icon">' + (cat.icon || '📋') + '</span>';
      html += '<span class="project-cat-name" style="color:' + (cat.color || 'var(--cyan)') + '">' + escapeHtml(cat.name) + '</span>';
      html += '</div>';
      html += '<div class="project-cat-right">';
      html += '<span class="project-cat-count" style="color:' + (cat.color || 'var(--cyan)') + ';border-color:' + (cat.color || 'var(--cyan)') + '33">' + itemCount + '</span>';
      html += '<span class="project-expand-arrow' + (isExpanded ? ' open' : '') + '">▶</span>';
      html += '</div>';
      html += '</div>';

      // Items container
      html += '<div class="project-cat-items' + (isExpanded ? ' expanded' : '') + '">';

      if (cat.id === 'xtwitter') {
        // Special rendering for X/Twitter Intel — use x-scans data
        if (xscansData && xscansData.scans) {
          const topics = Object.keys(xscansData.scans);
          for (const topic of topics) {
            const scan = xscansData.scans[topic];
            const label = SCAN_LABELS[topic] || topic;
            const statusClass = 'status-' + (scan.status || 'no-data');

            html += '<div class="xscan-item">';
            html += '<div class="xscan-topic">' + escapeHtml(label);
            html += ' <span class="status-badge ' + statusClass + '"><span class="status-dot"></span>' + (scan.status || 'NO DATA').toUpperCase() + '</span>';
            html += '</div>';
            html += '<div class="xscan-summary">' + escapeHtml(scan.summary || 'No data yet.') + '</div>';

            if (scan.highlights && scan.highlights.length > 0) {
              html += '<div class="xscan-highlights">';
              for (const h of scan.highlights.slice(0, 3)) {
                html += '<div class="xscan-highlight">' + escapeHtml(typeof h === 'string' ? h : h.content || '') + '</div>';
              }
              html += '</div>';
            }

            if (scan.lastRun) {
              const d = new Date(scan.lastRun);
              const timeStr = d.toLocaleString('en-GB', {
                timeZone: 'Asia/Jerusalem',
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              });
              html += '<div class="xscan-time">Last scan: ' + timeStr + ' IST</div>';
            }
            html += '</div>';
          }
        }
        if (!xscansData || !xscansData.scans || Object.keys(xscansData.scans).length === 0) {
          html += '<div class="project-item" style="opacity:0.4;border-left-color:var(--gray-dim);">';
          html += '<div class="project-item-title" style="color:var(--text-dim);">No scan data yet.</div>';
          html += '</div>';
        }
      } else {
        // Standard items rendering
        for (const item of (cat.items || [])) {
          const statusClass = 'status-' + (item.status || 'unknown').replace(/\s+/g, '-');
          html += '<div class="project-item" data-status="' + (item.status || 'unknown') + '">';
          html += '<div class="project-item-title">';
          html += '<span class="status-badge ' + statusClass + '"><span class="status-dot"></span>' + (STATUS_LABEL[item.status] || item.status?.toUpperCase() || '—') + '</span>';
          html += escapeHtml(item.title);
          html += '</div>';
          if (item.description) {
            html += '<div class="project-item-desc">' + escapeHtml(item.description) + '</div>';
          }
          if (item.deadline) {
            html += '<div class="project-item-deadline">⏱ ' + escapeHtml(item.deadline) + '</div>';
          }
          html += '</div>';
        }
        if (!cat.items || cat.items.length === 0) {
          html += '<div class="project-item" style="opacity:0.4;border-left-color:var(--gray-dim);">';
          html += '<div class="project-item-title" style="color:var(--text-dim);">No items.</div>';
          html += '</div>';
        }
      }

      html += '</div>';

      card.innerHTML = html;
      grid.appendChild(card);
    });

    initialRender = false;

    // Attach click handlers to headers
    document.querySelectorAll('.project-cat-header').forEach(function (header) {
      header.addEventListener('click', function () {
        const catId = this.dataset.catId;
        const items = this.nextElementSibling;
        const arrow = this.querySelector('.project-expand-arrow');

        if (items.classList.contains('expanded')) {
          items.classList.remove('expanded');
          if (arrow) arrow.classList.remove('open');
          expandedCategories.delete(catId);
        } else {
          items.classList.add('expanded');
          if (arrow) arrow.classList.add('open');
          expandedCategories.add(catId);
        }
      });
    });
  }

  // === Data Fetching ===
  let cachedProjects = null;
  let cachedXScans = null;

  async function fetchProjects() {
    cachedProjects = {
  "lastUpdated": "2026-02-25T06:30:00+02:00",
  "categories": [
    {
      "id": "consulting",
      "name": "Consulting / Advisory",
      "icon": "🤝",
      "color": "#4CAF50",
      "items": [
        {
          "id": "techbridge-ai-strategy",
          "name": "TechBridge AI Strategy",
          "client": "TechBridge Solutions",
          "status": "active",
          "startDate": "2026-01-15",
          "description": "AI adoption roadmap and implementation strategy for mid-size SaaS company",
          "tags": ["ai", "strategy", "saas"],
          "lastUpdated": "2026-02-24T14:00:00+02:00"
        },
        {
          "id": "meridian-data-ops",
          "name": "Meridian Data Ops Transformation",
          "client": "Meridian Analytics",
          "status": "active",
          "startDate": "2026-01-20",
          "description": "Redesigning data pipeline architecture and team workflows",
          "tags": ["data", "operations", "transformation"],
          "lastUpdated": "2026-02-25T05:00:00+02:00"
        },
        {
          "id": "quantumleap-architecture",
          "name": "QuantumLeap Technical Architecture",
          "client": "QuantumLeap Technologies",
          "status": "active",
          "startDate": "2026-02-01",
          "description": "System architecture review and scalability planning for Series B startup",
          "tags": ["architecture", "scalability", "startup"],
          "lastUpdated": "2026-02-23T16:00:00+02:00"
        },
        {
          "id": "zenith-health-data",
          "name": "Zenith Healthcare Data Strategy",
          "client": "Zenith Health",
          "status": "active",
          "startDate": "2026-02-10",
          "description": "HIPAA-compliant data strategy and analytics infrastructure",
          "tags": ["healthcare", "data", "compliance"],
          "lastUpdated": "2026-02-24T11:00:00+02:00"
        },
        {
          "id": "brightpath-edtech",
          "name": "BrightPath Ed-Tech Consulting",
          "client": "BrightPath Education",
          "status": "completed",
          "startDate": "2025-11-01",
          "endDate": "2026-01-31",
          "description": "Learning platform architecture and AI tutoring integration",
          "tags": ["edtech", "ai", "completed"],
          "lastUpdated": "2026-02-01T10:00:00+02:00"
        }
      ]
    },
    {
      "id": "content",
      "name": "Content / Publishing",
      "icon": "✍️",
      "color": "#2196F3",
      "items": [
        {
          "id": "weekly-newsletter",
          "name": "Weekly Industry Newsletter",
          "status": "active",
          "description": "Curated weekly newsletter on AI, data, and consulting trends — 2,400 subscribers",
          "tags": ["newsletter", "content", "recurring"],
          "lastUpdated": "2026-02-24T08:00:00+02:00"
        },
        {
          "id": "blog-series-ai-ops",
          "name": "Blog Series: AI in Operations",
          "status": "in-progress",
          "description": "5-part blog series on practical AI adoption for operations teams. 3/5 published.",
          "tags": ["blog", "ai", "thought-leadership"],
          "lastUpdated": "2026-02-22T14:00:00+02:00"
        },
        {
          "id": "conference-talk-prep",
          "name": "TechSummit 2026 Talk Prep",
          "status": "planning",
          "description": "Preparing keynote on 'The Operator's AI Stack' for TechSummit SF, March 2026",
          "tags": ["speaking", "conference", "ai"],
          "lastUpdated": "2026-02-20T10:00:00+02:00"
        }
      ]
    },
    {
      "id": "internal",
      "name": "Internal Tools",
      "icon": "🔧",
      "color": "#FF9800",
      "items": [
        {
          "id": "openclaw-dashboards",
          "name": "OpenClaw Dashboard Suite",
          "status": "active",
          "description": "4-dashboard system for personal operations: AGENDA, System Monitor, Project View, Consulting",
          "tags": ["openclaw", "dashboards", "infrastructure"],
          "lastUpdated": "2026-02-25T06:00:00+02:00"
        },
        {
          "id": "client-onboarding-automation",
          "name": "Client Onboarding Automation",
          "status": "in-progress",
          "description": "Automated workflow for new client intake: forms, contracts, calendar setup, workspace provisioning",
          "tags": ["automation", "clients", "workflow"],
          "lastUpdated": "2026-02-23T12:00:00+02:00"
        },
        {
          "id": "invoice-system",
          "name": "Invoice Generation System",
          "status": "active",
          "description": "Automated invoice creation, PDF generation, and email dispatch via consulting dashboard",
          "tags": ["invoicing", "automation", "finance"],
          "lastUpdated": "2026-02-24T16:00:00+02:00"
        }
      ]
    },
    {
      "id": "research",
      "name": "Research / Exploration",
      "icon": "🔬",
      "color": "#9C27B0",
      "items": [
        {
          "id": "mcp-protocol-study",
          "name": "MCP Protocol Deep Dive",
          "status": "in-progress",
          "description": "Studying Model Context Protocol for potential tool-use improvements in client engagements",
          "tags": ["research", "mcp", "ai"],
          "lastUpdated": "2026-02-21T15:00:00+02:00"
        },
        {
          "id": "local-llm-benchmarks",
          "name": "Local LLM Performance Benchmarks",
          "status": "planning",
          "description": "Benchmarking Ollama models for cost-effective client deployments",
          "tags": ["research", "llm", "benchmarks"],
          "lastUpdated": "2026-02-19T10:00:00+02:00"
        }
      ]
    }
  ]
};
  }

  async function fetchXScans() {
    cachedXScans = {
  "scans": {}
};
  }

  async function fetchAll() {
    try {
      await Promise.all([fetchProjects(), fetchXScans()]);
      onFetchSuccess(cachedProjects && cachedProjects.lastUpdated);
    } catch (e) {
      console.error('Fetch failed:', e);
      onFetchError();
    }
    renderProjects(cachedProjects, cachedXScans);
    checkStaleness();
  }

  // === Refresh Button ===
  const refreshBtn = document.getElementById('refreshAll');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      this.classList.add('spinning');
      setTimeout(() => this.classList.remove('spinning'), 600);
      doRefresh();
    });
  }

  // === Keyboard & Swipe Navigation ===
  const DASHBOARDS = ['../agenda/', '../crm/', './', '../system-monitor/'];
  const currentIdx = 2; // Project View

  document.addEventListener('keydown', function (e) {
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
  // static: no auto-refresh
  fetchAll();
})();
