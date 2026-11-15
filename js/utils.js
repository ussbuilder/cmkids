// utils.js: Shared helpers: formatting, escaping, scoring and chart utilities

    // ============================================================
    // NEW: SHARED HELPERS (exam history, analytics, drafts, AI reformat)
    // ============================================================
    const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
    const CHART_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#475569", "#ea580c"];
    let anScope = { students: [], scoped: [] };

    function examById(id) { return allExams.find(e => e.id === id); }

    function attemptAccuracy(a) {
      if (a.accuracy !== null && a.accuracy !== undefined && a.accuracy !== "") return Number(a.accuracy);
      return a.total_questions ? Math.round((a.score / a.total_questions) * 100) : 0;
    }

    function latestPerStudentExam(attempts) {
      const seen = new Set();
      const out = [];
      [...attempts]
        .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
        .forEach(a => {
          const k = a.student_id + "|" + a.exam_id;
          if (!seen.has(k)) { seen.add(k); out.push(a); }
        });
      return out;
    }

    function avgOf(arr) { return arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null; }
    function fmtPct(v) { return v === null || v === undefined ? "--" : Math.round(v) + "%"; }
    function fmtDate(d) {
      return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "--";
    }
    function fmtDateTime(d) {
      return d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "--";
    }
    function shortText(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; }

    function destroyChart(key) {
      if (analyticsCharts[key]) { analyticsCharts[key].destroy(); delete analyticsCharts[key]; }
    }
    function drawChart(key, canvasId, config) {
      destroyChart(key);
      const el = document.getElementById(canvasId);
      if (!el || !window.Chart) return;
      analyticsCharts[key] = new Chart(el, config);
    }
    function chartBaseOptions(extra) {
      return Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, ticks: { callback: v => v + "%" } } },
        plugins: { legend: { display: true, position: "bottom" } }
      }, extra || {});
    }

    function trendBadge(delta) {
      if (delta === null || delta === undefined || isNaN(delta)) return `<span class="text-slate-400">--</span>`;
      const r = Math.round(delta);
      if (r > 0) return `<span class="font-bold text-emerald-600">▲ +${r}%</span>`;
      if (r < 0) return `<span class="font-bold text-red-600">▼ ${r}%</span>`;
      return `<span class="font-bold text-slate-500">● 0%</span>`;
    }

    function statCard(label, value, sub) {
      return `<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">${escapeHtml(label)}</p>
        <p class="text-2xl font-black text-slate-900 mt-1">${escapeHtml(value)}</p>
        ${sub ? `<p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(sub)}</p>` : ""}
      </div>`;
    }

    function escapeHtml(text) {
      if (text === null || text === undefined) return "";
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
