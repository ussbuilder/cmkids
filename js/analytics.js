// analytics.js: Analytics: student performance panel and admin analytics

    // ------------------------------------------------------------
    // Student performance panel (used by Admin and Mentor dashboards)
    // ------------------------------------------------------------
    function renderStudentPerformance(studentId, prefix) {
      const panel = document.getElementById(prefix + "Panel");
      if (!panel) return;
      destroyChart(prefix + "Trend");
      destroyChart(prefix + "Subj");

      const stu = allProfiles.find(p => p.id === studentId);
      if (!stu) {
        panel.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">Select a student to view their performance history.</p>`;
        return;
      }

      const mentor = allProfiles.find(m => m.id === stu.mentor_id);
      const header = `
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 border-b border-slate-100">
          <h4 class="text-base font-black text-slate-900">${escapeHtml(stu.full_name)}</h4>
          <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">Adm ${escapeHtml(stu.admission_no)}</span>
          <span class="text-xs text-slate-500">Class ${escapeHtml(stu.class_div || "-")}</span>
          <span class="text-xs text-slate-500">Batch ${escapeHtml(stu.batch_year || "2026-27")}</span>
          <span class="text-xs text-slate-500">Mentor: ${escapeHtml(mentor ? mentor.full_name : "Unassigned")}</span>
        </div>`;

      const attempts = allAttempts
        .filter(a => a.student_id === studentId)
        .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));

      if (attempts.length === 0) {
        panel.innerHTML = header + `<p class="text-xs text-slate-400 py-6 text-center">This student has not attempted any exam yet.</p>`;
        return;
      }

      const accs = attempts.map(attemptAccuracy);
      const latestPerExam = latestPerStudentExam(attempts);
      const overallAvg = avgOf(latestPerExam.map(attemptAccuracy));
      const best = Math.max(...accs);
      const lastAcc = accs[accs.length - 1];
      const prevAvg = accs.length > 1 ? avgOf(accs.slice(0, -1)) : null;
      const delta = prevAvg === null ? null : lastAcc - prevAvg;

      const subjMap = {};
      latestPerExam.forEach(a => {
        const ex = examById(a.exam_id);
        const subj = ex ? ex.subject : "Deleted exam";
        (subjMap[subj] = subjMap[subj] || []).push(attemptAccuracy(a));
      });
      const subjects = Object.keys(subjMap);

      const rows = [...attempts].reverse().map(a => {
        const ex = examById(a.exam_id);
        const acc = attemptAccuracy(a);
        return `<tr class="hover:bg-slate-50">
          <td class="p-2.5 whitespace-nowrap">${escapeHtml(fmtDateTime(a.completed_at))}</td>
          <td class="p-2.5 font-bold text-slate-900">${escapeHtml(ex ? ex.title : "(exam deleted)")}</td>
          <td class="p-2.5">${escapeHtml(ex ? ex.subject : "-")}</td>
          <td class="p-2.5 font-bold">${a.score} / ${a.total_questions}</td>
          <td class="p-2.5 font-bold ${acc >= 60 ? "text-emerald-600" : "text-red-600"}">${acc}%</td>
          <td class="p-2.5 text-right">${ex
            ? `<button onclick="openStudentAnswerSheet('${a.id}')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]">Answers</button>`
            : `<span class="text-slate-400">n/a</span>`}</td>
        </tr>`;
      }).join("");

      panel.innerHTML = header + `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          ${statCard("Attempts", String(attempts.length), `${latestPerExam.length} different exam(s)`)}
          ${statCard("Average Accuracy", fmtPct(overallAvg), "latest attempt per exam")}
          ${statCard("Best Score", best + "%", "")}
          ${statCard("Latest vs Earlier", delta === null ? "--" : (Math.round(delta) > 0 ? "+" : "") + Math.round(delta) + "%", `latest ${lastAcc}%`)}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div class="p-4 rounded-2xl border border-slate-200">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Accuracy over time</p>
            <div class="relative h-60"><canvas id="${prefix}TrendCanvas"></canvas></div>
          </div>
          <div class="p-4 rounded-2xl border border-slate-200">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Average by subject</p>
            <div class="relative h-60"><canvas id="${prefix}SubjCanvas"></canvas></div>
          </div>
        </div>
        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left text-xs text-slate-600">
            <thead class="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr><th class="p-2.5">Date</th><th class="p-2.5">Exam</th><th class="p-2.5">Subject</th><th class="p-2.5">Score</th><th class="p-2.5">Accuracy</th><th class="p-2.5 text-right">Sheet</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rows}</tbody>
          </table>
        </div>`;

      drawChart(prefix + "Trend", prefix + "TrendCanvas", {
        type: "line",
        data: {
          labels: attempts.map(a => { const ex = examById(a.exam_id); return fmtDate(a.completed_at) + " · " + shortText(ex ? ex.title : "exam", 16); }),
          datasets: [{ label: "Accuracy %", data: accs, borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.12)", fill: true, tension: 0.25, pointRadius: 4 }]
        },
        options: chartBaseOptions({ plugins: { legend: { display: false } } })
      });
      drawChart(prefix + "Subj", prefix + "SubjCanvas", {
        type: "bar",
        data: {
          labels: subjects,
          datasets: [{ label: "Avg accuracy %", data: subjects.map(s => Math.round(avgOf(subjMap[s]))), backgroundColor: subjects.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) }]
        },
        options: chartBaseOptions({ plugins: { legend: { display: false } } })
      });
    }

    // ------------------------------------------------------------
    // Admin analytics tab
    // ------------------------------------------------------------
    function renderAdminAnalytics() {
      if (!currentUser || currentUser.role !== "admin") return;
      const batchSel = document.getElementById("anBatchSelect");
      const mentorSel = document.getElementById("anMentorSelect");
      const stuSel = document.getElementById("anStudentSelect");

      const batches = new Set([activeBatchYear]);
      allProfiles.forEach(p => { if (p.role === "student") batches.add(p.batch_year || "2026-27"); });
      const prevBatch = batchSel.value || selectedBatchFilter;
      batchSel.innerHTML = Array.from(batches).sort().reverse()
        .map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}${b === activeBatchYear ? " (Active)" : ""}</option>`).join("");
      batchSel.value = batches.has(prevBatch) ? prevBatch : activeBatchYear;

      const mentors = allProfiles.filter(p => p.role === "mentor");
      const prevMentor = mentorSel.value;
      mentorSel.innerHTML = `<option value="">All mentors</option><option value="__none">Unassigned</option>` +
        mentors.map(m => `<option value="${m.id}">${escapeHtml(m.full_name)}</option>`).join("");
      mentorSel.value = Array.from(mentorSel.options).some(o => o.value === prevMentor) ? prevMentor : "";

      let students = allProfiles.filter(p => p.role === "student" && (p.batch_year || "2026-27") === batchSel.value);
      if (mentorSel.value === "__none") students = students.filter(s => !s.mentor_id);
      else if (mentorSel.value) students = students.filter(s => s.mentor_id === mentorSel.value);

      const ids = new Set(students.map(s => s.id));
      const scoped = latestPerStudentExam(allAttempts.filter(a => ids.has(a.student_id)));
      anScope = { students, scoped };

      const examsAsc = [...allExams].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const statsFor = ex => {
        const accs = scoped.filter(a => a.exam_id === ex.id).map(attemptAccuracy);
        return { n: accs.length, avg: avgOf(accs), hi: accs.length ? Math.max(...accs) : null, lo: accs.length ? Math.min(...accs) : null };
      };
      const examStats = new Map(allExams.map(e => [e.id, statsFor(e)]));
      const examsWithData = examsAsc.filter(e => examStats.get(e.id).n > 0);

      // Summary cards
      const overall = avgOf(scoped.map(attemptAccuracy));
      const liveExam = allExams.find(e => e.isActive) || allExams[0];
      const liveN = liveExam ? examStats.get(liveExam.id).n : 0;
      document.getElementById("anSummaryCards").innerHTML =
        statCard("Students in view", String(students.length), `Batch ${batchSel.value}`) +
        statCard("Exams with results", String(examsWithData.length), `${allExams.length} exam(s) in history`) +
        statCard("Overall average", fmtPct(overall), "latest attempt per exam") +
        statCard("Latest exam attended", `${liveN} / ${students.length}`, liveExam ? shortText(liveExam.title, 28) : "no exam yet");

      // Overall trend chart
      drawChart("anTrend", "anTrendCanvas", {
        type: "line",
        data: {
          labels: examsWithData.map(e => fmtDate(e.createdAt) + " · " + shortText(e.title, 14)),
          datasets: [{ label: "Average accuracy %", data: examsWithData.map(e => Math.round(examStats.get(e.id).avg)), borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.12)", fill: true, tension: 0.25, pointRadius: 4 }]
        },
        options: chartBaseOptions({ plugins: { legend: { display: false } } })
      });

      // Subject-wise trend chart + table
      const subjects = Array.from(new Set(examsWithData.map(e => e.subject)));
      drawChart("anSubject", "anSubjectCanvas", {
        type: "line",
        data: {
          labels: examsWithData.map(e => fmtDate(e.createdAt) + " · " + shortText(e.title, 14)),
          datasets: subjects.map((s, i) => ({
            label: s,
            data: examsWithData.map(e => e.subject === s ? Math.round(examStats.get(e.id).avg) : null),
            borderColor: CHART_COLORS[i % CHART_COLORS.length],
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
            spanGaps: true, tension: 0.25, pointRadius: 4
          }))
        },
        options: chartBaseOptions()
      });

      const subjRows = subjects.map(s => {
        const exs = examsWithData.filter(e => e.subject === s);
        const avgs = exs.map(e => examStats.get(e.id).avg);
        const subjAttempts = scoped.filter(a => { const ex = examById(a.exam_id); return ex && ex.subject === s; }).length;
        return `<tr class="hover:bg-slate-50">
          <td class="p-2.5 font-bold text-slate-900">${escapeHtml(s)}</td>
          <td class="p-2.5">${exs.length}</td>
          <td class="p-2.5">${subjAttempts}</td>
          <td class="p-2.5 font-bold">${fmtPct(avgOf(avgs))}</td>
          <td class="p-2.5 text-emerald-700 font-bold">${fmtPct(Math.max(...avgs))}</td>
          <td class="p-2.5 text-red-600 font-bold">${fmtPct(Math.min(...avgs))}</td>
        </tr>`;
      }).join("");
      document.getElementById("anSubjectTable").innerHTML = subjRows ||
        `<tr><td colspan="6" class="p-5 text-center text-slate-400">No exam results yet for this selection.</td></tr>`;

      // Exam history table
      const examRows = allExams.map(e => {
        const st = examStats.get(e.id);
        return `<tr class="hover:bg-slate-50">
          <td class="p-2.5 whitespace-nowrap">${escapeHtml(fmtDate(e.createdAt))}</td>
          <td class="p-2.5 font-bold text-slate-900">${escapeHtml(e.title)}</td>
          <td class="p-2.5">${escapeHtml(e.subject)}</td>
          <td class="p-2.5">${e.isActive
            ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">LIVE</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">ARCHIVED</span>`}</td>
          <td class="p-2.5">${e.questions.length}</td>
          <td class="p-2.5">${st.n} / ${students.length}</td>
          <td class="p-2.5 font-bold">${fmtPct(st.avg)}</td>
          <td class="p-2.5">${fmtPct(st.hi)} / ${fmtPct(st.lo)}</td>
          <td class="p-2.5 text-right"><button onclick="toggleExamDetail('${e.id}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-blue-700 font-bold text-[11px] border border-slate-200">Results</button></td>
        </tr>`;
      }).join("");
      document.getElementById("anExamTable").innerHTML = examRows ||
        `<tr><td colspan="9" class="p-5 text-center text-slate-400">No exams published yet.</td></tr>`;
      document.getElementById("anExamDetail").innerHTML = "";

      // Student picker + overview table
      const prevStu = stuSel.value;
      const sortedStudents = [...students].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
      stuSel.innerHTML = `<option value="">-- Select a student --</option>` +
        sortedStudents.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)} (Adm ${escapeHtml(s.admission_no)})</option>`).join("");
      stuSel.value = ids.has(prevStu) ? prevStu : "";
      renderStudentPerformance(stuSel.value, "anStu");

      const overview = students.map(s => {
        const mine = allAttempts.filter(a => a.student_id === s.id).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
        const mineAccs = mine.map(attemptAccuracy);
        const avg = avgOf(latestPerStudentExam(mine).map(attemptAccuracy));
        const last = mineAccs.length ? mineAccs[mineAccs.length - 1] : null;
        const delta = mineAccs.length > 1 ? last - avgOf(mineAccs.slice(0, -1)) : null;
        const mentor = allProfiles.find(m => m.id === s.mentor_id);
        return { s, n: mine.length, avg, last, delta, mentor };
      }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

      document.getElementById("anStudentsTable").innerHTML = overview.map(o => `<tr class="hover:bg-slate-50">
          <td class="p-2.5 font-mono font-bold">${escapeHtml(o.s.admission_no)}</td>
          <td class="p-2.5 font-bold text-slate-900">${escapeHtml(o.s.full_name)}</td>
          <td class="p-2.5">${escapeHtml(o.s.class_div || "-")}</td>
          <td class="p-2.5">${escapeHtml(o.mentor ? o.mentor.full_name : "Unassigned")}</td>
          <td class="p-2.5">${o.n}</td>
          <td class="p-2.5 font-bold">${fmtPct(o.avg)}</td>
          <td class="p-2.5">${o.last === null ? "--" : o.last + "%"}</td>
          <td class="p-2.5">${trendBadge(o.delta)}</td>
          <td class="p-2.5 text-right"><button onclick="selectAnalyticsStudent('${o.s.id}')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]">View</button></td>
        </tr>`).join("") ||
        `<tr><td colspan="9" class="p-5 text-center text-slate-400">No students in this selection.</td></tr>`;
    }

    function selectAnalyticsStudent(id) {
      const sel = document.getElementById("anStudentSelect");
      sel.value = id;
      renderStudentPerformance(id, "anStu");
      sel.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function toggleExamDetail(examId) {
      const box = document.getElementById("anExamDetail");
      const ex = examById(examId);
      if (!ex) return;
      const { students, scoped } = anScope;
      const byStudent = new Map(scoped.filter(a => a.exam_id === examId).map(a => [a.student_id, a]));
      const rows = students.map(s => ({ s, a: byStudent.get(s.id) }))
        .sort((x, y) => (y.a ? attemptAccuracy(y.a) : -1) - (x.a ? attemptAccuracy(x.a) : -1));
      box.innerHTML = `
        <div class="mt-4 p-4 rounded-2xl border border-blue-200 bg-blue-50/40">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-black text-slate-900">${escapeHtml(ex.title)} <span class="text-xs font-semibold text-slate-500">(${escapeHtml(ex.subject)} • ${escapeHtml(fmtDate(ex.createdAt))})</span></p>
            <button onclick="document.getElementById('anExamDetail').innerHTML=''" class="text-xs font-bold text-slate-500 hover:text-slate-800">Close ✕</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="uppercase font-bold text-slate-700 border-b border-slate-200"><tr><th class="p-2">Adm</th><th class="p-2">Student</th><th class="p-2">Status</th><th class="p-2">Score</th><th class="p-2 text-right">Sheet</th></tr></thead>
              <tbody class="divide-y divide-slate-100">${rows.map(r => `<tr>
                <td class="p-2 font-mono font-bold">${escapeHtml(r.s.admission_no)}</td>
                <td class="p-2 font-bold text-slate-900">${escapeHtml(r.s.full_name)}</td>
                <td class="p-2">${r.a ? `<span class="text-emerald-700 font-bold">Attended</span>` : `<span class="text-red-600 font-bold">Not attended</span>`}</td>
                <td class="p-2 font-bold">${r.a ? `${r.a.score} / ${r.a.total_questions} (${attemptAccuracy(r.a)}%)` : "--"}</td>
                <td class="p-2 text-right">${r.a ? `<button onclick="openStudentAnswerSheet('${r.a.id}')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]">Answers</button>` : ""}</td>
              </tr>`).join("")}</tbody>
            </table>
          </div>
        </div>`;
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // ------------------------------------------------------------
    // Mentor: student performance picker
    // ------------------------------------------------------------
    function renderMentorStudentPicker(mentees) {
      const sel = document.getElementById("mnStudentSelect");
      if (!sel) return;
      const prev = sel.value;
      const sorted = [...mentees].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
      sel.innerHTML = `<option value="">-- Select a mentee --</option>` +
        sorted.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)} (Adm ${escapeHtml(s.admission_no)})</option>`).join("");
      sel.value = sorted.some(s => s.id === prev) ? prev : "";
      renderStudentPerformance(sel.value, "mnStu");
    }

    function selectMentorStudent(id) {
      const sel = document.getElementById("mnStudentSelect");
      sel.value = id;
      renderStudentPerformance(id, "mnStu");
      sel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
