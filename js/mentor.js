// mentor.js: Mentor dashboard, optional mentee profile details, WhatsApp notifications & queue, answer sheet viewer

    let editingMenteeId = null;
    let editingMenteePhotoData = "";
    let waTargetSingleStudentId = null;
    let waQueueItems = []; // [{ student, phone, sent: false }]

    // ============================================================
    // 8. MENTOR PORTAL: ATTENDANCE, MARKS & ANSWER SHEET VIEWER
    // ============================================================
    function setupMentorDashboard() {
      if (typeof renderLiveExamBanners === "function") renderLiveExamBanners();
      const examSelect = document.getElementById("mentorExamFilter");
      const liveExam = allExams.find(e => e.isActive) || allExams[0];
      examSelect.innerHTML = `<option value="latest">${liveExam && liveExam.isActive ? "● LIVE" : "Latest"}: ${escapeHtml(liveExam?.title || "None")}</option>`;
      allExams.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.innerText = `${e.isActive ? "● LIVE • " : ""}${e.title} (${e.subject} — ${fmtDateTime(e.createdAt)})`;
        examSelect.appendChild(opt);
      });
      renderMentorDashboard();
    }

    function getMentorActiveMentees() {
      return allProfiles.filter(
        p => p.role === "student" && p.mentor_id === currentUser.id && (p.batch_year || "2026-27") === activeBatchYear
      );
    }

    function renderMentorDashboard() {
      if (typeof renderLiveExamBanners === "function") renderLiveExamBanners();
      const myMentees = getMentorActiveMentees();
      document.getElementById("mentorTotalMenteesCount").innerText = myMentees.length;
      renderMentorStudentPicker(myMentees);

      const filterVal = document.getElementById("mentorExamFilter").value;
      const targetExam = filterVal === "latest"
        ? (allExams.find(e => e.isActive) || allExams[0])
        : allExams.find(e => e.id === filterVal);

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

        const hasWa = Boolean(normalizeWhatsappNumber(stu.whatsapp_no));
        const avatarHtml = stu.photo_url
          ? `<img src="${escapeHtml(stu.photo_url)}" alt="" class="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0" />`
          : `<div class="h-9 w-9 rounded-full bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center shrink-0">${escapeHtml((stu.full_name || "S").charAt(0).toUpperCase())}</div>`;

        const metaParts = [];
        if (stu.parent_name) metaParts.push(`Parent: ${escapeHtml(stu.parent_name)}`);
        if (stu.place) metaParts.push(escapeHtml(stu.place));
        if (stu.whatsapp_no) metaParts.push(`📱 ${escapeHtml(stu.whatsapp_no)}`);

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
          <td class="p-3 font-mono font-bold">${escapeHtml(stu.admission_no)}</td>
          <td class="p-3">
            <div class="flex items-center space-x-2.5">
              ${avatarHtml}
              <div>
                <p class="font-bold text-slate-900">${escapeHtml(stu.full_name)}</p>
                ${metaParts.length ? `<p class="text-[11px] text-slate-500">${metaParts.join(" • ")}</p>` : ""}
                ${stu.remarks ? `<p class="text-[11px] text-amber-700 italic">"${escapeHtml(shortText(stu.remarks, 55))}"</p>` : ""}
              </div>
            </div>
          </td>
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
            <button onclick="openMenteeProfileModal('${stu.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition" title="Add/Edit WhatsApp, Photo, Parent, Place, Remarks">
              Details
            </button>
            ${hasWa
              ? `<button onclick="openMentorWhatsappModal('${stu.id}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition" title="Send WhatsApp notification or message">
                  💬 WhatsApp
                </button>`
              : `<button onclick="openMenteeProfileModal('${stu.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-xs border border-amber-200 transition" title="Add WhatsApp number first">
                  + WhatsApp
                </button>`
            }
            <button onclick="selectMentorStudent('${stu.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-blue-700 font-bold text-xs border border-slate-200 transition">History</button>
            ${attempt 
              ? `<button onclick="openStudentAnswerSheet('${attempt.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition">Answers</button>`
              : ""
            }
          </td>
        `;
        tbody.appendChild(tr);
      });

      document.getElementById("mentorAttendedCount").innerText = `${attendedCount} / ${myMentees.length}`;
      document.getElementById("mentorAvgAccuracy").innerText = attendedCount > 0 ? `${Math.round(totalAcc / attendedCount)}%` : "--";
    }

    // ============================================================
    // OPTIONAL MENTEE PROFILE DETAILS (WHATSAPP, PHOTO, PARENT, PLACE, REMARKS)
    // ============================================================
    function openMenteeProfileModal(studentId) {
      const stu = allProfiles.find(p => p.id === studentId);
      if (!stu) return;

      editingMenteeId = studentId;
      editingMenteePhotoData = stu.photo_url || "";

      document.getElementById("mpModalTitle").innerText = `${stu.full_name} (Adm: ${stu.admission_no})`;
      document.getElementById("mpModalSubtitle").innerText = `Login ID: ${stu.login_id} • All fields below are optional`;
      document.getElementById("mpWhatsappInput").value = stu.whatsapp_no || "";
      document.getElementById("mpParentInput").value = stu.parent_name || "";
      document.getElementById("mpPlaceInput").value = stu.place || "";
      document.getElementById("mpRemarksInput").value = stu.remarks || "";
      document.getElementById("mpPhotoFileInput").value = "";

      renderMenteePhotoPreview(stu.full_name, editingMenteePhotoData);
      document.getElementById("menteeProfileModal").classList.remove("hidden");
    }

    function closeMenteeProfileModal() {
      editingMenteeId = null;
      document.getElementById("menteeProfileModal").classList.add("hidden");
    }

    function renderMenteePhotoPreview(fullName, photoUrl) {
      const box = document.getElementById("mpPhotoPreview");
      const removeBtn = document.getElementById("btnRemoveMenteePhoto");
      if (photoUrl) {
        box.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="" class="h-full w-full object-cover" />`;
        removeBtn.classList.remove("hidden");
      } else {
        box.innerHTML = escapeHtml((fullName || "S").charAt(0).toUpperCase());
        removeBtn.classList.add("hidden");
      }
    }

    function clearMenteePhoto() {
      editingMenteePhotoData = "";
      const stu = allProfiles.find(p => p.id === editingMenteeId);
      renderMenteePhotoPreview(stu ? stu.full_name : "S", "");
    }

    // Compresses uploaded image to a lightweight 180x180 JPEG data URL so it saves cleanly in Supabase
    function handleMenteePhotoFile(input) {
      const file = input.files && input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const size = 180;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");

          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

          editingMenteePhotoData = canvas.toDataURL("image/jpeg", 0.78);
          const stu = allProfiles.find(p => p.id === editingMenteeId);
          renderMenteePhotoPreview(stu ? stu.full_name : "S", editingMenteePhotoData);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    async function saveMenteeProfileDetails() {
      if (!editingMenteeId) return;
      const stu = allProfiles.find(p => p.id === editingMenteeId);
      if (!stu) return;

      const updates = {
        whatsapp_no: document.getElementById("mpWhatsappInput").value.trim() || null,
        parent_name: document.getElementById("mpParentInput").value.trim() || null,
        place: document.getElementById("mpPlaceInput").value.trim() || null,
        remarks: document.getElementById("mpRemarksInput").value.trim() || null,
        photo_url: editingMenteePhotoData || null
      };

      const btn = document.getElementById("btnSaveMenteeProfile");
      btn.disabled = true;
      btn.innerText = "Saving...";

      try {
        if (supabaseClient) {
          const { error } = await supabaseClient
            .from("profiles")
            .update(updates)
            .eq("id", editingMenteeId);

          if (error) {
            alert("Could not save details: " + error.message);
            return;
          }
        }
        Object.assign(stu, updates);
        closeMenteeProfileModal();
        renderMentorDashboard();
      } finally {
        btn.disabled = false;
        btn.innerText = "Save Details";
      }
    }

    // ============================================================
    // WHATSAPP NOTIFICATIONS & STEP-BY-STEP SEND ALL QUEUE
    // ============================================================
    function normalizeWhatsappNumber(raw) {
      if (!raw) return "";
      let digits = String(raw).replace(/\D/g, "");
      if (digits.startsWith("00")) digits = digits.slice(2);
      if (digits.length === 11 && digits.startsWith("0")) digits = "91" + digits.slice(1);
      else if (digits.length === 10) digits = "91" + digits;
      return digits.length >= 11 ? digits : "";
    }

    function getPortalLoginUrl() {
      return window.location.href.split("#")[0].split("?")[0];
    }

    function buildWhatsappMessageForStudent(template, stu) {
      const liveExam = allExams.find(e => e.isActive) || allExams[0];
      const examLabel = liveExam
        ? `${liveExam.title} (${liveExam.subject}, ${liveExam.durationMinutes} mins)`
        : "CMKids Daily Mock Exam";
      const link = getPortalLoginUrl();

      return String(template || "")
        .replace(/\{name\}/gi, stu.full_name || "Student")
        .replace(/\{id\}/gi, stu.login_id || "")
        .replace(/\{exam\}/gi, examLabel)
        .replace(/\{link\}/gi, link);
    }

    function buildWhatsappUrl(phoneDigits, messageText) {
      return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageText)}`;
    }

    function applyWhatsappPreset(mode) {
      const examBtn = document.getElementById("waPresetExamBtn");
      const customBtn = document.getElementById("waPresetCustomBtn");
      const ta = document.getElementById("waMessageTemplateInput");

      if (mode === "exam") {
        examBtn.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition";
        customBtn.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition";
        ta.value =
`Assalamu Alaikum / Hello {name},

📢 *New CMKids Scholarship Mock Exam is Live!*
📝 *Exam:* {exam}
🆔 *Your Login ID:* {id}

Attend your exam now at:
{link}

– Mentor (${currentUser ? currentUser.full_name : "AKHMUP School"})`;
      } else {
        customBtn.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition";
        examBtn.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition";
        ta.value =
`Hello {name},

Please remember to complete your CMKids Scholarship preparation tasks today.
Portal Link: {link}

– ${currentUser ? currentUser.full_name : "Mentor"}`;
      }
      refreshWhatsappQueuePreview();
    }

    function openMentorWhatsappModal(singleStudentId) {
      waTargetSingleStudentId = singleStudentId || null;
      applyWhatsappPreset("exam");

      const singleBox = document.getElementById("waSingleControls");
      const queueBox = document.getElementById("waQueueControls");

      if (waTargetSingleStudentId) {
        const stu = allProfiles.find(p => p.id === waTargetSingleStudentId);
        const phone = stu ? normalizeWhatsappNumber(stu.whatsapp_no) : "";
        if (!stu || !phone) {
          alert("Please add a valid WhatsApp number in Details first.");
          return;
        }
        document.getElementById("waModalTitle").innerText = `💬 Message ${stu.full_name}`;
        document.getElementById("waModalSubtitle").innerText = "Opens WhatsApp with the message pre-filled for this student.";
        document.getElementById("waSingleRecipientLabel").innerText = `${stu.full_name} (Adm: ${stu.admission_no})`;
        document.getElementById("waSinglePhoneLabel").innerText = `+${phone}`;
        singleBox.classList.remove("hidden");
        queueBox.classList.add("hidden");
      } else {
        const mentees = getMentorActiveMentees();
        waQueueItems = mentees.map(stu => ({
          student: stu,
          phone: normalizeWhatsappNumber(stu.whatsapp_no),
          sent: false
        }));

        const validCount = waQueueItems.filter(x => x.phone).length;
        if (validCount === 0) {
          alert("None of your assigned mentees have a WhatsApp number saved yet. Click 'Details' on a student to add their WhatsApp number.");
          return;
        }

        document.getElementById("waModalTitle").innerText = `💬 Send WhatsApp to All Mentees (${validCount})`;
        document.getElementById("waModalSubtitle").innerText = "Step-by-step queue: tap Send Next to open each student's WhatsApp chat one by one.";
        singleBox.classList.add("hidden");
        queueBox.classList.remove("hidden");
        renderWhatsappQueueList();
      }

      document.getElementById("mentorWhatsappModal").classList.remove("hidden");
    }

    function closeMentorWhatsappModal() {
      document.getElementById("mentorWhatsappModal").classList.add("hidden");
    }

    function refreshWhatsappQueuePreview() {
      if (!waTargetSingleStudentId && waQueueItems.length > 0) {
        renderWhatsappQueueList();
      }
    }

    function renderWhatsappQueueList() {
      const container = document.getElementById("waQueueListContainer");
      const progressLabel = document.getElementById("waQueueProgressLabel");
      const nextBtn = document.getElementById("btnWaSendNext");
      if (!container) return;

      const sendable = waQueueItems.filter(x => x.phone);
      const sentCount = sendable.filter(x => x.sent).length;
      const nextIdx = waQueueItems.findIndex(x => x.phone && !x.sent);

      progressLabel.innerText = `Progress: ${sentCount} of ${sendable.length} sent`;
      if (nextIdx >= 0) {
        nextBtn.disabled = false;
        nextBtn.innerText = `Send Next (${sentCount + 1}/${sendable.length}): ${waQueueItems[nextIdx].student.full_name} →`;
      } else {
        nextBtn.disabled = true;
        nextBtn.innerText = "✓ All Mentees Sent";
      }

      container.innerHTML = waQueueItems.map((item, idx) => {
        const isCurrent = idx === nextIdx;
        if (!item.phone) {
          return `<div class="p-2.5 flex items-center justify-between text-xs bg-slate-50 text-slate-400">
            <span>${escapeHtml(item.student.full_name)} <span class="font-mono">(Adm ${escapeHtml(item.student.admission_no)})</span></span>
            <span class="text-[11px] font-semibold">No WhatsApp number</span>
          </div>`;
        }
        return `<div class="p-2.5 flex items-center justify-between text-xs ${isCurrent ? "bg-emerald-50/80 font-bold" : ""}">
          <div>
            <span class="text-slate-900">${escapeHtml(item.student.full_name)}</span>
            <span class="font-mono text-[11px] text-slate-500 ml-1.5">+${item.phone}</span>
          </div>
          <div class="flex items-center space-x-2">
            ${item.sent ? `<span class="text-[11px] font-bold text-emerald-700">✓ Sent</span>` : ""}
            <button type="button" onclick="sendQueueItemAt(${idx})" class="px-2.5 py-1 rounded-lg ${item.sent ? "bg-slate-100 text-slate-600" : "bg-emerald-600 text-white"} font-bold text-[11px]">
              ${item.sent ? "Resend" : "Send"}
            </button>
          </div>
        </div>`;
      }).join("");
    }

    function sendQueueItemAt(idx) {
      const item = waQueueItems[idx];
      if (!item || !item.phone) return;
      const template = document.getElementById("waMessageTemplateInput").value;
      const msg = buildWhatsappMessageForStudent(template, item.student);
      item.sent = true;
      renderWhatsappQueueList();
      window.open(buildWhatsappUrl(item.phone, msg), "_blank", "noopener,noreferrer");
    }

    function sendNextInWhatsappQueue() {
      const nextIdx = waQueueItems.findIndex(x => x.phone && !x.sent);
      if (nextIdx >= 0) sendQueueItemAt(nextIdx);
    }

    function sendSingleWhatsappNow() {
      const stu = allProfiles.find(p => p.id === waTargetSingleStudentId);
      const phone = stu ? normalizeWhatsappNumber(stu.whatsapp_no) : "";
      if (!stu || !phone) return;
      const template = document.getElementById("waMessageTemplateInput").value;
      const msg = buildWhatsappMessageForStudent(template, stu);
      window.open(buildWhatsappUrl(phone, msg), "_blank", "noopener,noreferrer");
    }

    // ============================================================
    // ANSWER SHEET MODAL
    // ============================================================
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