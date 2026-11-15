// student.js: Student: due/live exam list, quiz engine, autosave, results

    function progressKey() {
      return `cmkids_progress_${currentUser ? currentUser.id : "x"}_${activeExamInstance ? activeExamInstance.id : "x"}`;
    }

    function saveExamProgress() {
      if (!activeExamInstance || quizFinished) return;
      try {
        localStorage.setItem(progressKey(), JSON.stringify({
          endTime: examEndTime,
          responses: studentResponses,
          marked: markedForReview,
          idx: activeQuestionIdx
        }));
      } catch (e) {}
    }

    window.addEventListener("beforeunload", (ev) => {
      const quizCard = document.getElementById("studentQuizActiveCard");
      if (quizCard && !quizCard.classList.contains("hidden") && !quizFinished) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    });

    // ============================================================
    // 7. STUDENT PORTAL & ONLINE MCQ EXAM CONDUCTOR
    // ============================================================
    function setupStudentDashboard() {
      document.getElementById("bannerStudentAdm").innerText = `Adm No: ${currentUser.admission_no}`;
      document.getElementById("bannerStudentBatch").innerText = `Batch ${currentUser.batch_year || "2026-27"}`;
      document.getElementById("bannerStudentWelcome").innerText = `Welcome, ${currentUser.full_name}!`;

      const mentor = allProfiles.find(m => m.id === currentUser.mentor_id);
      document.getElementById("studentAssignedMentorDisplay").innerText = mentor ? `Mentor: ${escapeHtml(mentor.full_name)}` : "Mentor: General School Pool";

      updateStudentBanner();

      returnToStudentList();
      renderStudentExamsList();
    }

    // Live exam (always shown) + older exams this student has not attempted yet ("dues").
    // A due exam disappears for the student as soon as they attempt it.
    function studentVisibleExams() {
      if (!currentUser) return [];
      const live = allExams.filter(e => e.isActive).slice(0, 1);
      const liveIds = new Set(live.map(e => e.id));
      const attempted = new Set(allAttempts.filter(a => a.student_id === currentUser.id).map(a => a.exam_id));
      const enrolledAt = currentUser.created_at ? new Date(currentUser.created_at).getTime() : null;
      const dues = allExams.filter(e =>
        !liveIds.has(e.id) &&
        !attempted.has(e.id) &&
        (enrolledAt === null || !e.createdAt || new Date(e.createdAt).getTime() >= enrolledAt)
      );
      return [...live.map(e => ({ exam: e, isLive: true })), ...dues.map(e => ({ exam: e, isLive: false }))];
    }

    function updateStudentBanner() {
      if (!currentUser) return;
      const visible = studentVisibleExams();
      const live = visible.find(v => v.isLive);
      const dueCount = visible.filter(v => !v.isLive).length;
      const myLive = live ? latestPerStudentExam(allAttempts.filter(a => a.student_id === currentUser.id && a.exam_id === live.exam.id))[0] : null;
      let text = myLive ? `Live exam score: ${myLive.score} / ${myLive.total_questions}` : (live ? "Live exam: not attempted yet" : "No exam live");
      if (dueCount > 0) text += ` • ${dueCount} due`;
      document.getElementById("studentAvgScoreDisplay").innerText = text;
    }

    function renderStudentExamsList() {
      const container = document.getElementById("studentExamsList");
      container.innerHTML = "";

      const visible = studentVisibleExams();
      if (visible.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 col-span-2 py-6 text-center">No mock exams scheduled yet. Check back soon.</p>`;
        return;
      }

      visible.forEach(({ exam, isLive }) => {
        const myAttempt = latestPerStudentExam(allAttempts.filter(a => a.student_id === currentUser.id && a.exam_id === exam.id))[0];
        const card = document.createElement("div");
        card.className = "p-5 rounded-2xl border bg-white hover:border-blue-300 shadow-sm transition space-y-4 " + (isLive ? "border-emerald-300" : "border-amber-300");
        card.innerHTML = `
          <div class="flex items-start justify-between">
            <div>
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">${escapeHtml(exam.subject)}</span>
              ${isLive
                ? `<span class="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">LIVE</span>`
                : `<span class="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">DUE</span>`}
              <h4 class="text-base font-bold text-slate-900 mt-2">${escapeHtml(exam.title)}</h4>
            </div>
            <span class="text-xs font-bold text-slate-500">${exam.durationMinutes} Mins</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>${exam.questions.length} MCQs ${myAttempt ? `• <b class="text-emerald-600">Score: ${myAttempt.score}/${myAttempt.total_questions}</b>` : ""}</span>
            <button onclick="openPreQuizSummary('${exam.id}')" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition">
              ${myAttempt ? "Re-attempt Exam →" : "Attend Exam →"}
            </button>
          </div>
        `;
        container.appendChild(card);
      });
    }

    function openPreQuizSummary(examId) {
      const visibleMatch = studentVisibleExams().find(v => v.exam.id === examId);
      activeExamInstance = visibleMatch ? visibleMatch.exam : null;
      if (!activeExamInstance) return;

      document.getElementById("studentAvailableTestsCard").classList.add("hidden");
      document.getElementById("studentPreQuizSummaryCard").classList.remove("hidden");

      document.getElementById("preQuizSubjectBadge").innerText = activeExamInstance.subject;
      document.getElementById("preQuizTopicTitle").innerText = activeExamInstance.title;

      const summaryList = document.getElementById("preQuizSummaryList");
      summaryList.className = `space-y-2 text-sm text-slate-800 leading-relaxed ${getFontClassForSubject(activeExamInstance.subject)}`;
      summaryList.innerHTML = "";
      if (activeExamInstance.summaryPoints && activeExamInstance.summaryPoints.length > 0) {
        activeExamInstance.summaryPoints.forEach(pt => {
          const li = document.createElement("li");
          li.className = "flex items-start space-x-2";
          li.innerHTML = `<span class="text-amber-600 font-bold">•</span><span>${escapeHtml(pt)}</span>`;
          summaryList.appendChild(li);
        });
      } else {
        summaryList.innerHTML = `<li>Click 'Start Quiz' below when you are ready to begin the timed exam.</li>`;
      }
    }

    function returnToStudentList() {
      clearInterval(timerInterval);
      document.getElementById("studentAvailableTestsCard").classList.remove("hidden");
      document.getElementById("studentPreQuizSummaryCard").classList.add("hidden");
      document.getElementById("studentQuizActiveCard").classList.add("hidden");
      document.getElementById("studentQuizResultsCard").classList.add("hidden");
      if (currentUser && currentUser.role === "student") {
        renderStudentExamsList();
        updateStudentBanner();
      }
    }

    function launchActiveQuiz() {
      document.getElementById("studentPreQuizSummaryCard").classList.add("hidden");
      document.getElementById("studentQuizActiveCard").classList.remove("hidden");

      quizFinished = false;
      studentResponses = {};
      markedForReview = {};
      activeQuestionIdx = 0;
      examEndTime = Date.now() + (activeExamInstance.durationMinutes || 15) * 60 * 1000;

      try {
        const saved = JSON.parse(localStorage.getItem(progressKey()) || "null");
        if (saved && saved.endTime > Date.now()) {
          examEndTime = saved.endTime;
          studentResponses = saved.responses || {};
          markedForReview = saved.marked || {};
          activeQuestionIdx = Math.min(saved.idx || 0, activeExamInstance.questions.length - 1);
        }
      } catch (e) {}
      timeRemainingSeconds = Math.max(0, Math.ceil((examEndTime - Date.now()) / 1000));

      document.getElementById("quizActiveTitle").innerText = activeExamInstance.title;
      document.getElementById("totalQNum").innerText = activeExamInstance.questions.length;

      startTimer();
      renderCurrentQuizQuestion();
      renderPalette();
    }

    function startTimer() {
      clearInterval(timerInterval);
      updateTimerDisplay();
      timerInterval = setInterval(() => {
        timeRemainingSeconds = Math.max(0, Math.ceil((examEndTime - Date.now()) / 1000));
        updateTimerDisplay();
        if (timeRemainingSeconds <= 0) {
          clearInterval(timerInterval);
          alert("Time is up! Submitting exam automatically.");
          finishQuizEvaluation();
        }
      }, 1000);
    }

    function updateTimerDisplay() {
      const mins = Math.floor(timeRemainingSeconds / 60);
      const secs = timeRemainingSeconds % 60;
      document.getElementById("quizTimer").innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function renderCurrentQuizQuestion() {
      const q = activeExamInstance.questions[activeQuestionIdx];
      const fClass = q.fontClass || getFontClassForSubject(activeExamInstance.subject);

      document.getElementById("currentQNum").innerText = activeQuestionIdx + 1;
      document.getElementById("displayQuestionIndex").innerText = activeQuestionIdx + 1;

      const stemEl = document.getElementById("quizQuestionStem");
      stemEl.className = `text-base sm:text-lg font-bold text-slate-900 leading-relaxed ${fClass}`;
      stemEl.innerText = q.stem;

      const btnRev = document.getElementById("btnMarkReview");
      if (markedForReview[activeQuestionIdx]) {
        btnRev.className = "text-xs font-bold text-white bg-amber-500 px-2.5 py-1 rounded-lg";
        btnRev.innerText = "Marked for Review ✓";
      } else {
        btnRev.className = "text-xs font-semibold text-amber-600 hover:text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg";
        btnRev.innerText = "Mark for Review";
      }

      const optContainer = document.getElementById("quizOptionsContainer");
      optContainer.innerHTML = "";
      q.options.forEach((opt, idx) => {
        const isSelected = studentResponses[activeQuestionIdx] === idx;
        const optCard = document.createElement("div");
        optCard.onclick = () => { studentResponses[activeQuestionIdx] = idx; renderCurrentQuizQuestion(); };
        optCard.className = `p-3.5 rounded-xl border text-sm font-semibold cursor-pointer transition flex items-center space-x-3 ${
          isSelected ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
        }`;
        optCard.innerHTML = `
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}">
            ${String.fromCharCode(65 + idx)}
          </span>
          <span class="${fClass}">${escapeHtml(opt)}</span>
        `;
        optContainer.appendChild(optCard);
      });

      saveExamProgress();
      document.getElementById("btnPrevQ").disabled = activeQuestionIdx === 0;
      if (activeQuestionIdx === activeExamInstance.questions.length - 1) {
        document.getElementById("btnNextQ").innerText = "Submit Exam";
        document.getElementById("btnNextQ").onclick = submitQuizPrematurely;
      } else {
        document.getElementById("btnNextQ").innerText = "Next Question →";
        document.getElementById("btnNextQ").onclick = () => navigateQuestion(1);
      }

      renderPalette();
    }

    function toggleMarkForReview() {
      markedForReview[activeQuestionIdx] = !markedForReview[activeQuestionIdx];
      renderCurrentQuizQuestion();
    }

    function navigateQuestion(direction) {
      const nextIdx = activeQuestionIdx + direction;
      if (nextIdx >= 0 && nextIdx < activeExamInstance.questions.length) {
        activeQuestionIdx = nextIdx;
        renderCurrentQuizQuestion();
      }
    }

    function renderPalette() {
      const palette = document.getElementById("quizPaletteGrid");
      palette.innerHTML = "";

      activeExamInstance.questions.forEach((_, idx) => {
        const btn = document.createElement("button");
        btn.onclick = () => { activeQuestionIdx = idx; renderCurrentQuizQuestion(); };

        let colorClasses = "bg-slate-100 text-slate-700 hover:bg-slate-200";
        if (markedForReview[idx]) colorClasses = "bg-amber-400 text-slate-900 font-bold";
        else if (studentResponses[idx] !== undefined) colorClasses = "bg-emerald-500 text-white font-bold";

        if (idx === activeQuestionIdx) colorClasses += " ring-2 ring-blue-600 ring-offset-2";

        btn.className = `h-9 w-9 rounded-xl text-xs font-bold flex items-center justify-center transition ${colorClasses}`;
        btn.innerText = idx + 1;
        palette.appendChild(btn);
      });
    }

    function submitQuizPrematurely() {
      if (confirm("Are you sure you want to finish and submit your exam?")) {
        clearInterval(timerInterval);
        finishQuizEvaluation();
      }
    }

    async function finishQuizEvaluation() {
      if (quizFinished) return;
      quizFinished = true;
      clearInterval(timerInterval);
      try { localStorage.removeItem(progressKey()); } catch (e) {}
      document.getElementById("studentQuizActiveCard").classList.add("hidden");
      document.getElementById("studentQuizResultsCard").classList.remove("hidden");

      let correctCount = 0;
      const total = activeExamInstance.questions.length;

      activeExamInstance.questions.forEach((q, idx) => {
        if (studentResponses[idx] === q.correctIndex) correctCount++;
      });

      const accuracy = Math.round((correctCount / total) * 100);

      document.getElementById("resScore").innerText = `${correctCount} / ${total}`;
      document.getElementById("resAccuracy").innerText = `${accuracy}%`;
      document.getElementById("resStatus").innerText = accuracy >= 60 ? "Passed" : "Needs Review";

      if (supabaseClient) {
        const { error: attemptSaveError } = await supabaseClient.from("exam_attempts").insert([{
          exam_id: activeExamInstance.id,
          student_id: currentUser.id,
          student_login_id: currentUser.login_id,
          score: correctCount,
          total_questions: total,
          accuracy: accuracy,
          answers: studentResponses
        }]);
        if (attemptSaveError) {
          alert("Your result could not be saved to the server: " + attemptSaveError.message + "\nPlease tell your teacher and note your score from this screen.");
        }
        await syncAllFromCloud();
      }

      const container = document.getElementById("resultsDetailedQuestionsContainer");
      container.innerHTML = "";

      activeExamInstance.questions.forEach((q, idx) => {
        const fClass = q.fontClass || getFontClassForSubject(activeExamInstance.subject);
        const userChoice = studentResponses[idx];
        const isRight = userChoice === q.correctIndex;

        const card = document.createElement("div");
        card.className = `p-5 rounded-2xl border ${isRight ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'} space-y-2`;
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold px-2 py-0.5 rounded ${isRight ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              Q.${idx + 1} • ${isRight ? 'Correct' : 'Incorrect'}
            </span>
            <span class="text-xs text-slate-500">Correct: Option ${String.fromCharCode(65 + q.correctIndex)}</span>
          </div>
          <p class="text-sm font-bold text-slate-900 ${fClass}">${escapeHtml(q.stem)}</p>
          <div class="text-xs space-y-1 text-slate-700 ${fClass}">
            <p><span class="font-bold">Your Answer:</span> ${userChoice !== undefined ? escapeHtml(q.options[userChoice]) : 'Unanswered'}</p>
            <p><span class="font-bold text-emerald-700">Correct Answer:</span> ${escapeHtml(q.options[q.correctIndex])}</p>
          </div>
          ${q.explanation ? `<div class="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 ${fClass}"><span class="font-bold text-slate-800">Rationale:</span> ${escapeHtml(q.explanation)}</div>` : ''}
        `;
        container.appendChild(card);
      });
    }
