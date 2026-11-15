// mentor.js: Mentor: dashboard and answer sheet viewer

    // ============================================================
    // 8. MENTOR PORTAL: ATTENDANCE, MARKS & ANSWER SHEET VIEWER
    // ============================================================
    function setupMentorDashboard() {
      const examSelect = document.getElementById("mentorExamFilter");
      examSelect.innerHTML = `<option value="latest">Latest Exam (${escapeHtml(allExams[0]?.title || "None")})</option>`;
      allExams.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.innerText = `${e.title} (${e.subject})`;
        examSelect.appendChild(opt);
      });
      renderMentorDashboard();
    }

    function renderMentorDashboard() {
      const myMentees = allProfiles.filter(
        p => p.role === "student" && p.mentor_id === currentUser.id && (p.batch_year || "2026-27") === activeBatchYear
      );
      document.getElementById("mentorTotalMenteesCount").innerText = myMentees.length;
      renderMentorStudentPicker(myMentees);

      const filterVal = document.getElementById("mentorExamFilter").value;
      const targetExam = filterVal === "latest" ? allExams[0] : allExams.find(e => e.id === filterVal);

      const tbody = document.getElementById("mentorMenteesTableBody");
      tbody.innerHTML = "";

      if (myMentees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No students have been assigned to you yet.</td></tr>`;
        document.getElementById("mentorAttendedCount").innerText = "0 / 0";
        document.getElementById("mentorAvgAccuracy").innerText = "--";
        return;
      }

      let attendedCount = 0;
      let totalAcc = 0;

      myMentees.forEach(stu => {
        const attempt = targetExam 
          ? allAttempts.find(a => a.student_id === stu.id && a.exam_id === targetExam.id)
          : allAttempts.find(a => a.student_id === stu.id);

        if (attempt) {
          attendedCount++;
          totalAcc += Number(attempt.accuracy || 0);
        }

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
          <td class="p-3 font-mono font-bold">${escapeHtml(stu.admission_no)}</td>
          <td class="p-3 font-bold text-slate-900">${escapeHtml(stu.full_name)}</td>
          <td class="p-3">${escapeHtml(targetExam ? targetExam.title : "No Exam Scheduled")}</td>
          <td class="p-3">
            ${attempt 
              ? `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">✓ Attended</span>`
              : `<span class="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-bold text-[11px]">✕ Not Attended</span>`
            }
          </td>
          <td class="p-3 font-bold text-slate-900">
            ${attempt ? `${attempt.score} / ${attempt.total_questions} (${attempt.accuracy}%)` : "--"}
          </td>
          <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
            <button onclick="selectMentorStudent('${stu.id}')" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-blue-700 font-bold text-xs border border-slate-200 transition">History</button>
            ${attempt 
              ? `<button onclick="openStudentAnswerSheet('${attempt.id}')" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition">View Answers</button>`
              : `<span class="text-xs text-slate-400">No submission</span>`
            }
          </td>
        `;
        tbody.appendChild(tr);
      });

      document.getElementById("mentorAttendedCount").innerText = `${attendedCount} / ${myMentees.length}`;
      document.getElementById("mentorAvgAccuracy").innerText = attendedCount > 0 ? `${Math.round(totalAcc / attendedCount)}%` : "--";
    }

    function openStudentAnswerSheet(attemptId) {
      const attempt = allAttempts.find(a => a.id === attemptId);
      if (!attempt) return;

      const student = allProfiles.find(p => p.id === attempt.student_id);
      const exam = examById(attempt.exam_id);

      document.getElementById("modalAnswerStudentName").innerText = `${student?.full_name || "Student"} (Adm: ${student?.admission_no || "--"})`;
      document.getElementById("modalAnswerExamMeta").innerText = `${exam?.title || "Mock Exam"} • Score: ${attempt.score}/${attempt.total_questions} (${attempt.accuracy}%)`;

      const body = document.getElementById("modalAnswerBody");
      body.innerHTML = "";

      if (!exam || !exam.questions) {
        body.innerHTML = `<p class="text-xs text-slate-500">Question details unavailable.</p>`;
      } else {
        const ansMap = attempt.answers || {};
        exam.questions.forEach((q, idx) => {
          const fClass = q.fontClass || getFontClassForSubject(exam.subject);
          const chosen = ansMap[idx];
          const isRight = chosen === q.correctIndex;

          const card = document.createElement("div");
          card.className = `p-4 rounded-2xl border ${isRight ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"} space-y-1.5`;
          card.innerHTML = `
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="${isRight ? "text-emerald-700" : "text-red-700"}">Q.${idx + 1} • ${isRight ? "Correct" : "Wrong"}</span>
              <span class="text-slate-500">Key: Option ${String.fromCharCode(65 + q.correctIndex)}</span>
            </div>
            <p class="text-sm font-bold text-slate-900 ${fClass}">${escapeHtml(q.stem)}</p>
            <p class="text-xs text-slate-700 ${fClass}">
              <b>Student Selected:</b> ${chosen !== undefined ? escapeHtml(q.options[chosen]) : "Unanswered"}
            </p>
            <p class="text-xs text-emerald-800 ${fClass}">
              <b>Correct Answer:</b> ${escapeHtml(q.options[q.correctIndex])}
            </p>
          `;
          body.appendChild(card);
        });
      }

      document.getElementById("answerSheetModal").classList.remove("hidden");
    }

    function closeAnswerModal() {
      document.getElementById("answerSheetModal").classList.add("hidden");
    }
