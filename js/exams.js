// exams.js: Admin: publishing exams, live/archived state, quiz drafts

    let isPublishingExam = false;

    // ------------------------------------------------------------
    // Live Exam Status Banner (shared by Admin & Mentor dashboards)
    // ------------------------------------------------------------
    function renderLiveExamBanners() {
      const live = allExams.find(e => e.isActive);
      const html = live
        ? `<div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
             <div class="flex items-center flex-wrap gap-2">
               <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white">
                 <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> LIVE EXAM
               </span>
               <span class="text-sm font-black text-slate-900">${escapeHtml(live.title)}</span>
               <span class="text-xs font-bold px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200">${escapeHtml(live.subject)}</span>
               <span class="text-xs font-semibold text-slate-600">${live.questions.length} MCQs • ${live.durationMinutes} Mins</span>
             </div>
             <p class="text-[11px] font-bold text-emerald-900 shrink-0">Published: ${escapeHtml(fmtDateTime(live.createdAt))}</p>
           </div>`
        : `<div class="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
             <div class="flex items-center gap-2">
               <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-white">NO LIVE EXAM</span>
               <span class="text-xs font-semibold text-amber-950">No exam is currently live for students.</span>
             </div>
           </div>`;

      const adminBanner = document.getElementById("adminLiveExamBanner");
      if (adminBanner) adminBanner.innerHTML = html;
      const mentorBanner = document.getElementById("mentorLiveExamBanner");
      if (mentorBanner) mentorBanner.innerHTML = html;
    }

    // ------------------------------------------------------------
    // Publishing (only one live exam; history is kept; prevents duplicates)
    // ------------------------------------------------------------
    async function publishExamRecord({ title, subject, duration, points, questions, draftId }) {
      if (isPublishingExam) return false;
      if (!supabaseClient) { alert("Cloud is not connected, so the exam cannot be published."); return false; }

      // Guard 1: Check if this exact draft was already published
      if (draftId) {
        const existingDraft = quizDrafts.find(x => x.id === draftId);
        if (existingDraft && existingDraft.last_published_at) {
          const when = fmtDateTime(existingDraft.last_published_at);
          if (!confirm(`⚠️ This draft ("${title}") was ALREADY published on ${when}.\n\nPublishing it again will create a duplicate exam and students who haven't attended will see it twice as due.\n\nAre you sure you want to publish a duplicate copy?`)) {
            return false;
          }
        }
      }

      // Guard 2: Check if an identical exam is already live right now
      const identicalLive = allExams.find(
        e => e.isActive &&
          String(e.title || "").trim().toLowerCase() === String(title || "").trim().toLowerCase() &&
          e.subject === subject &&
          (e.questions || []).length === (questions || []).length
      );
      if (identicalLive) {
        alert(`"${title}" (${subject}) is ALREADY live (published ${fmtDateTime(identicalLive.createdAt)}). Duplicate publishing blocked.`);
        return false;
      }

      const liveNow = allExams.filter(e => e.isActive);
      if (liveNow.length > 0) {
        const names = liveNow.map(e => `"${e.title}"`).join(", ");
        if (!confirm(`Publishing "${title}" makes ${names} no longer live.\nStudents who have not attempted it yet will still see it as a due exam; everyone else will not. Results stay available to mentors and admin.\n\nContinue?`)) return false;
      }

      isPublishingExam = true;
      try {
        const nowIso = new Date().toISOString();
        const { data: newExam, error } = await supabaseClient.from("scheduled_exams").insert([{
          title,
          subject,
          duration_minutes: duration,
          scheduled_at: nowIso,
          summary_points: points,
          questions,
          is_active: true
        }]).select().single();
        if (error || !newExam) { alert("Could not publish the exam: " + (error ? error.message : "unknown error")); return false; }

        const { error: deactError } = await supabaseClient
          .from("scheduled_exams").update({ is_active: false }).eq("is_active", true).neq("id", newExam.id);
        if (deactError) alert("Exam published, but older exams could not be hidden from students: " + deactError.message);

        if (draftId) {
          await supabaseClient.from("quiz_drafts").update({ last_published_at: nowIso }).eq("id", draftId);
        }

        await syncAllFromCloud();
        renderLiveExamBanners();
        renderQuestionBank();
        renderDrafts();
        alert(`Exam "${title}" (${duration} mins, ${questions.length} MCQs) published! Students can now attend.`);
        return true;
      } finally {
        isPublishingExam = false;
      }
    }

    async function makeExamLive(examId) {
      const ex = examById(examId);
      if (!ex || !supabaseClient) return;
      if (!confirm(`Make "${ex.title}" the live exam? Any other live exam will be hidden from students.`)) return;
      const { error } = await supabaseClient.from("scheduled_exams").update({ is_active: true }).eq("id", examId);
      if (error) { alert("Could not update: " + error.message); return; }
      await supabaseClient.from("scheduled_exams").update({ is_active: false }).eq("is_active", true).neq("id", examId);
      await syncAllFromCloud();
      renderLiveExamBanners();
      renderQuestionBank();
      renderDrafts();
    }

    async function hideExamFromStudents(examId) {
      const ex = examById(examId);
      if (!ex || !supabaseClient) return;
      if (!confirm(`Hide "${ex.title}" from students? Results stay available to mentors and admin.`)) return;
      const { error } = await supabaseClient.from("scheduled_exams").update({ is_active: false }).eq("id", examId);
      if (error) { alert("Could not update: " + error.message); return; }
      await syncAllFromCloud();
      renderLiveExamBanners();
      renderQuestionBank();
      renderDrafts();
    }

    // ------------------------------------------------------------
    // Quiz drafts
    // ------------------------------------------------------------
    function draftsErrorMessage(error) {
      const msg = (error && error.message) || "";
      if ((error && error.code === "42P01") || /quiz_drafts/i.test(msg) || /schema cache/i.test(msg)) {
        return "The quiz_drafts table is not set up yet. Open Supabase > SQL Editor and run the contents of supabase_setup.sql, then try again.";
      }
      return msg || "Unknown error";
    }

    async function saveQuizDraft() {
      if (!currentAdminDraft || currentAdminDraft.questions.length === 0) {
        alert("Add at least one question before saving a draft.");
        return;
      }
      if (!supabaseClient) { alert("Cloud is not connected."); return; }

      const points = document.getElementById("editSummaryPoints").value.trim().split("\n").map(l => l.trim()).filter(Boolean);
      const title = document.getElementById("genTopic").value.trim() || currentAdminDraft.topic || `${currentAdminDraft.subject} Quiz`;
      const duration = Math.max(1, parseInt(document.getElementById("genDuration").value) || currentAdminDraft.durationMinutes || 15);
      const payload = {
        title,
        subject: currentAdminDraft.subject,
        duration_minutes: duration,
        summary_points: points,
        questions: currentAdminDraft.questions,
        updated_at: new Date().toISOString()
      };

      let error;
      if (currentAdminDraft.draftId) {
        ({ error } = await supabaseClient.from("quiz_drafts").update(payload).eq("id", currentAdminDraft.draftId));
      } else {
        const res = await supabaseClient.from("quiz_drafts").insert([payload]).select().single();
        error = res.error;
        if (!error && res.data) currentAdminDraft.draftId = res.data.id;
      }
      if (error) { alert("Could not save draft: " + draftsErrorMessage(error)); return; }

      currentAdminDraft.topic = title;
      await syncAllFromCloud();
      renderDrafts();
      refreshBuilderButtons();
      alert(`Draft "${title}" saved (${currentAdminDraft.questions.length} MCQs). Find it under the Drafts tab.`);
    }

    function renderDrafts() {
      renderLiveExamBanners();
      const grid = document.getElementById("draftsGrid");
      const countEl = document.getElementById("draftCount");
      if (countEl) countEl.innerText = quizDrafts.length;
      const notice = document.getElementById("draftsSetupNotice");
      if (notice) notice.classList.toggle("hidden", !draftsTableMissing);
      if (!grid) return;

      grid.innerHTML = "";
      if (quizDrafts.length === 0) {
        grid.innerHTML = `<p class="text-xs text-slate-400 col-span-3">No drafts yet. Build a quiz in Question Builder and click "Save as Draft".</p>`;
        return;
      }

      const liveExam = allExams.find(e => e.isActive);

      quizDrafts.forEach(d => {
        const qCount = (d.questions || []).length;
        const isPublished = Boolean(d.last_published_at);
        const isCurrentlyLive = Boolean(
          liveExam &&
          String(liveExam.title || "").trim().toLowerCase() === String(d.title || "").trim().toLowerCase() &&
          liveExam.subject === d.subject
        );

        const card = document.createElement("div");
        card.className = `p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isCurrentlyLive
            ? "border-emerald-300 bg-emerald-50/40"
            : isPublished
              ? "border-blue-200 bg-blue-50/20"
              : "border-slate-200 bg-slate-50"
        }`;
        card.innerHTML = `
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-1.5 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">${escapeHtml(d.subject)}</span>
                ${isCurrentlyLive
                  ? `<span class="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white">● LIVE NOW</span>`
                  : isPublished
                    ? `<span class="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">✓ PUBLISHED</span>`
                    : `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">UNPUBLISHED</span>`}
              </div>
              <span class="text-[11px] text-slate-500 font-semibold">${qCount} MCQs • ${d.duration_minutes} min</span>
            </div>
            <h4 class="text-sm font-bold text-slate-900">${escapeHtml(d.title)}</h4>
            <p class="text-[11px] text-slate-500">Edited ${escapeHtml(fmtDateTime(d.updated_at || d.created_at))}</p>
            ${isPublished ? `<p class="text-[11px] text-emerald-700 font-bold">Published: ${escapeHtml(fmtDateTime(d.last_published_at))}</p>` : ""}
          </div>
          <div class="flex items-center gap-2">
            ${isPublished
              ? `<button onclick="publishDraft('${d.id}')" class="flex-1 py-1.5 rounded-lg bg-slate-200 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-300 text-xs font-bold transition" title="Already published — click only if you intentionally want to re-publish">✓ Published (Re-publish)</button>`
              : `<button onclick="publishDraft('${d.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition">Publish</button>`}
            <button onclick="editDraft('${d.id}')" class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition">Edit</button>
            <button onclick="deleteDraft('${d.id}')" class="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition">Delete</button>
          </div>`;
        grid.appendChild(card);
      });
    }

    function editDraft(id) {
      const d = quizDrafts.find(x => x.id === id);
      if (!d) return;
      currentAdminDraft = {
        draftId: d.id,
        subject: d.subject,
        topic: d.title,
        durationMinutes: d.duration_minutes,
        summaryPoints: d.summary_points || [],
        questions: JSON.parse(JSON.stringify(d.questions || []))
      };
      document.getElementById("genSubject").value = d.subject;
      document.getElementById("genTopic").value = d.title;
      document.getElementById("genDuration").value = d.duration_minutes;
      switchAdminTab("generate");
      renderAdminEditor(currentAdminDraft);
    }

    async function publishDraft(id) {
      const d = quizDrafts.find(x => x.id === id);
      if (!d) return;
      if (!d.questions || d.questions.length === 0) { alert("This draft has no questions."); return; }
      await publishExamRecord({
        title: d.title,
        subject: d.subject,
        duration: d.duration_minutes,
        points: d.summary_points || [],
        questions: d.questions,
        draftId: d.id
      });
    }

    async function deleteDraft(id) {
      const d = quizDrafts.find(x => x.id === id);
      if (!d || !confirm(`Delete draft "${d.title}"? This cannot be undone.`)) return;
      if (supabaseClient) {
        const { error } = await supabaseClient.from("quiz_drafts").delete().eq("id", id);
        if (error) { alert("Could not delete: " + draftsErrorMessage(error)); return; }
      }
      await syncAllFromCloud();
      renderDrafts();
    }

    function refreshBuilderButtons() {
      const updBank = document.getElementById("btnUpdateExistingBank");
      if (updBank) updBank.classList.toggle("hidden", !(currentAdminDraft && currentAdminDraft.bankId));
      const draftBtn = document.getElementById("btnSaveDraft");
      if (draftBtn) draftBtn.innerText = currentAdminDraft && currentAdminDraft.draftId ? "Update Draft" : "Save as Draft";
    }