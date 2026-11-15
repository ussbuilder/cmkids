// builder.js: Admin: question builder (AI generation, paste parser, editor, question bank)

    // ============================================================
    // 6. QUESTION BUILDER & REAL GEMINI AI INTEGRATION
    // ============================================================
    function updateAiKeyStatusDisplay() {
      const localKey = localStorage.getItem("cmkids_gemini_api_key");
      const activeKey = localKey || cloudGeminiApiKey;
      const box = document.getElementById("aiKeyStatusBox");
      const txt = document.getElementById("aiKeyStatusText");
      const usageEl = document.getElementById("todayAiUsageCount");
      if (usageEl) usageEl.innerText = getTodayAiUsageCount();

      if (activeKey) {
        box.className = "p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2";
        txt.className = "text-xs font-bold text-emerald-900";
        txt.innerText = localKey ? "✓ Gemini AI Connected (Browser Key)" : "✓ Gemini AI Connected (Cloud Key)";
      } else {
        box.className = "p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2";
        txt.className = "text-xs font-bold text-amber-900";
        txt.innerText = "⚠ No API Key Found — Click Override Key";
        document.getElementById("customApiKeyWrapper").classList.remove("hidden");
      }
    }

    function toggleCustomApiKeyInput() {
      document.getElementById("customApiKeyWrapper").classList.toggle("hidden");
    }

    function saveGeminiApiKey(val) {
      if (val && val.trim()) {
        localStorage.setItem("cmkids_gemini_api_key", val.trim());
      } else {
        localStorage.removeItem("cmkids_gemini_api_key");
      }
      updateAiKeyStatusDisplay();
    }

    function setInputMode(mode) {
      if (mode === "bulk") {
        document.getElementById("bulkPasteSection").classList.remove("hidden");
        document.getElementById("autoGenerateSection").classList.add("hidden");
        document.getElementById("modeBtnBulk").className = "py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 shadow-sm transition";
        document.getElementById("modeBtnGen").className = "py-1.5 rounded-lg text-xs font-bold text-slate-600 transition";
      } else {
        document.getElementById("bulkPasteSection").classList.add("hidden");
        document.getElementById("autoGenerateSection").classList.remove("hidden");
        document.getElementById("modeBtnGen").className = "py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 shadow-sm transition";
        document.getElementById("modeBtnBulk").className = "py-1.5 rounded-lg text-xs font-bold text-slate-600 transition";
        updateAiKeyStatusDisplay();
      }
    }

    function fillSampleBulkText() {
      document.getElementById("bulkQuestionsInput").value = 
`1. സസ്യങ്ങളിൽ പ്രകാശസംശ്ലേഷണത്തിന് ആവശ്യമായ സൗരോർജ്ജം ആഗിരണം ചെയ്യുന്നത് ഏത് ഘടകമാണ്?
A) ഹരിതകം (Chlorophyll)
B) ജലം
C) ഓക്സിജൻ
D) വേരുകൾ
Ans: A
Exp: ഇലകളിലുള്ള ഹരിതകമാണ് സൂര്യപ്രകാശത്തെ ആഗിരണം ചെയ്യുന്നത്.

2. താഴെ പറയുന്നവയിൽ സ്വയംപോഷി അല്ലാത്ത ജീവി ഏത്?
A) ആൽമരം
B) പന്നൽ സസ്യം
C) കൂൺ (Mushroom)
D) നെല്ല്
Ans: C
Exp: കൂൺ ഒരു ഫംഗസ് ആണ്. ഇതിന് ഹരിതകം ഇല്ലാത്തതിനാൽ സ്വന്തമായി ആഹാരം ഉണ്ടാക്കാൻ കഴിയില്ല.`;
    }

    function parseBulkQuestions() {
      const subject = document.getElementById("genSubject").value;
      const topic = document.getElementById("genTopic").value.trim() || `${subject} Practice Test`;
      const duration = Math.max(1, parseInt(document.getElementById("genDuration").value) || 15);
      const rawText = document.getElementById("bulkQuestionsInput").value.trim();

      if (!rawText) {
        alert("Please paste your questions first.");
        return;
      }

      const blocks = rawText.split(/\n\s*\n/);
      const parsedQuestions = [];
      const parseWarnings = [];
      const fontClass = getFontClassForSubject(subject);

      blocks.forEach(block => {
        const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 5) {
          parseWarnings.push(`Block starting "${(lines[0] || "").slice(0, 40)}" skipped: needs a question line, 4 option lines and an Ans line.`);
          return;
        }

        const stem = lines[0].replace(/^\d+[\.\)]\s*/, "");
        const optA = (lines[1] || "").replace(/^[Aa][\.\)]\s*/, "");
        const optB = (lines[2] || "").replace(/^[Bb][\.\)]\s*/, "");
        const optC = (lines[3] || "").replace(/^[Cc][\.\)]\s*/, "");
        const optD = (lines[4] || "").replace(/^[Dd][\.\)]\s*/, "");

        let correctIndex = 0;
        let answerFound = false;
        let explanation = "";

        lines.slice(5).forEach(extra => {
          if (/^ans/i.test(extra)) {
            const m = extra.match(/^ans(?:wer)?\s*[:\-.]?\s*\(?\s*([A-Da-d])\b/i);
            if (m) {
              correctIndex = "ABCD".indexOf(m[1].toUpperCase());
              answerFound = true;
            }
          } else if (/^exp/i.test(extra)) {
            explanation = extra.split(":").slice(1).join(":").trim();
          }
        });

        if (!answerFound) {
          parseWarnings.push(`"${stem.slice(0, 40)}" has no valid "Ans: A/B/C/D" line, so it defaulted to option A. Please fix it in the editor.`);
        }

        parsedQuestions.push({
          stem,
          options: [optA, optB, optC, optD],
          correctIndex,
          explanation,
          fontClass
        });
      });

      if (parsedQuestions.length === 0) {
        alert("Could not parse questions. Click 'Insert Format Example' to see the expected layout.");
        return;
      }

      currentAdminDraft = {
        subject,
        topic,
        durationMinutes: duration,
        summaryPoints: [],
        questions: parsedQuestions
      };

      renderAdminEditor(currentAdminDraft);
      if (parseWarnings.length) {
        alert(`Loaded ${parsedQuestions.length} question(s) with ${parseWarnings.length} warning(s):\n\n` + parseWarnings.join("\n"));
      }
    }

    function getTodayAiUsageCount() {
      const todayKey = "cmkids_ai_runs_" + new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
      return parseInt(localStorage.getItem(todayKey) || "0", 10);
    }

    function incrementTodayAiUsageCount() {
      const todayKey = "cmkids_ai_runs_" + new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
      const nextVal = getTodayAiUsageCount() + 1;
      localStorage.setItem(todayKey, String(nextVal));
      const el = document.getElementById("todayAiUsageCount");
      if (el) el.innerText = nextVal;
    }

    async function triggerAIGeneration() {
      const subject = document.getElementById("genSubject").value;
      const topic = document.getElementById("genTopic").value.trim();
      const count = Math.max(1, Math.min(50, parseInt(document.getElementById("genCount").value) || 10));
      const duration = Math.max(1, parseInt(document.getElementById("genDuration").value) || 15);
      const sourceNotes = document.getElementById("genSourceText").value.trim();

      if (!topic && !sourceNotes) {
        alert("Please enter a Topic / Exam Title or paste Source Notes first.");
        return;
      }

      const apiKey = localStorage.getItem("cmkids_gemini_api_key") || cloudGeminiApiKey;
      if (!apiKey) {
        alert("Gemini API key is missing. Click 'Override Key' and paste your AIza... key.");
        return;
      }

      let targetLanguage = "Malayalam";
      if (subject === "English") targetLanguage = "English";
      else if (subject === "Hindi") targetLanguage = "Hindi";
      else if (subject === "Urdu") targetLanguage = "Urdu";
      else if (subject === "Arabic") targetLanguage = "Arabic";
      else if (subject === "Sanskrit") targetLanguage = "Sanskrit";

      const promptText = `You are an expert Kerala SCERT Upper Primary (Class 7) question setter preparing mock exams for the Kerala CMKids Scholarship Exam (formerly USS).
Create exactly ${count} high-quality, distinct multiple-choice questions (MCQs) and a concise pre-exam revision summary.

Subject: ${subject}
Topic / Chapter: ${topic || "General Practice"}
Target Language for ALL output (summary, question stems, options, and explanations): ${targetLanguage}
${sourceNotes ? `\nSource Study Notes / Rules provided by teacher (base questions heavily on these concepts and examples):\n"""\n${sourceNotes}\n"""` : ""}

Strict Requirements:
1. Write EVERYTHING (summaryPoints, stem, options, explanation) strictly in ${targetLanguage}. Do NOT mix languages unless teaching a vocabulary/translation term.
2. Every question must be unique, conceptual, and calibrated to Class 7 Kerala syllabus / CMKids scholarship difficulty (avoid trivial or repetitive filler).
3. Provide exactly 4 plausible options per question.
4. "correctIndex" must be an integer 0, 1, 2, or 3 indicating the single correct option.
5. "summaryPoints" must be an array of 3 to 5 crisp, helpful revision bullet points for students to read before starting the exam.
6. Return ONLY valid raw JSON matching this exact schema (no markdown backticks, no extra text):
{
  "summaryPoints": ["point 1", "point 2", "point 3"],
  "questions": [
    {
      "stem": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Clear rationale explaining why the correct answer is right."
    }
  ]
}`;

      const btn = document.getElementById("btnGenerateQuestions");
      btn.disabled = true;

      // Live elapsed timer & 45s timeout protection
      const TIMEOUT_SECONDS = 45;
      let elapsedSeconds = 0;
      btn.innerHTML = `<span class="inline-block animate-spin mr-2">⚙</span> Generating ${count} ${targetLanguage} MCQs... (0s / ${TIMEOUT_SECONDS}s)`;

      const elapsedTimer = setInterval(() => {
        elapsedSeconds++;
        btn.innerHTML = `<span class="inline-block animate-spin mr-2">⚙</span> Generating ${count} ${targetLanguage} MCQs... (${elapsedSeconds}s / ${TIMEOUT_SECONDS}s)`;
      }, 1000);

      // Prioritize fast high-quota Lite model first, then standard Flash
      const candidateModels = GEMINI_MODELS;
      let parsedResult = null;
      let lastErrorMsg = "";

      for (const modelName of candidateModels) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_SECONDS * 1000);

        try {
          incrementTodayAiUsageCount();
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
            {
              method: "POST",
              signal: controller.signal,
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                generationConfig: {
                  temperature: 0.7,
                  responseMimeType: "application/json"
                }
              })
            }
          );
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (response.status === 429) {
              lastErrorMsg = "Rate limit reached (429). Please wait 60 seconds and try again.";
            } else if (response.status === 503) {
              lastErrorMsg = "Google AI servers temporarily busy (503). Please click Generate again.";
            } else {
              lastErrorMsg = errData?.error?.message || `HTTP ${response.status}`;
            }
            continue;
          }

          const data = await response.json();
          const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawOutput) {
            lastErrorMsg = "Empty response from Gemini.";
            continue;
          }

          const cleanedJson = rawOutput.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
          parsedResult = JSON.parse(cleanedJson);
          if (parsedResult && Array.isArray(parsedResult.questions) && parsedResult.questions.length > 0) {
            break;
          }
        } catch (err) {
          clearTimeout(timeoutId);
          lastErrorMsg = err.name === "AbortError"
            ? `Request timed out after ${TIMEOUT_SECONDS}s (server busy). Try generating 10 questions or retry in a moment.`
            : err.message;
        }
      }

      clearInterval(elapsedTimer);
      btn.disabled = false;
      btn.innerHTML = `<span>✨ Generate Real Questions & Summary</span>`;

      if (!parsedResult || !Array.isArray(parsedResult.questions)) {
        alert(`AI Generation failed: ${lastErrorMsg}`);
        return;
      }

      const fontClass = getFontClassForSubject(subject);
      const formattedQuestions = parsedResult.questions.map(q => ({
        stem: q.stem || "",
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["A", "B", "C", "D"],
        correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
        explanation: q.explanation || "",
        fontClass
      }));

      currentAdminDraft = {
        subject,
        topic: topic || `${subject} Mock Test`,
        durationMinutes: duration,
        summaryPoints: Array.isArray(parsedResult.summaryPoints) ? parsedResult.summaryPoints : [],
        questions: formattedQuestions
      };

      renderAdminEditor(currentAdminDraft);
    }

    function addBlankDraftQuestion() {
      const subject = document.getElementById("genSubject").value;
      const topic = document.getElementById("genTopic").value.trim() || `${subject} Mock Test`;
      const duration = Math.max(1, parseInt(document.getElementById("genDuration").value) || 15);

      if (!currentAdminDraft) {
        currentAdminDraft = { subject, topic, durationMinutes: duration, summaryPoints: [], questions: [] };
      }

      syncSummaryToDraft();
      currentAdminDraft.questions.push({
        stem: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        explanation: "",
        fontClass: getFontClassForSubject(subject)
      });

      renderAdminEditor(currentAdminDraft);
    }

    function getFontClassForSubject(subject) {
      if (subject === "Arabic") return "arabic-font";
      if (subject === "Urdu") return "urdu-font";
      if (subject === "Hindi" || subject === "Sanskrit") return "devanagari-font";
      if (subject === "English") return "";
      return "malayalam-font";
    }

    function renderAdminEditor(draft) {
      const summaryEl = document.getElementById("editSummaryPoints");
      summaryEl.className = `w-full text-sm rounded-lg border-slate-300 p-2.5 bg-white border font-normal ${getFontClassForSubject(draft.subject)}`;
      summaryEl.value = (draft.summaryPoints || []).join("\n");

      const container = document.getElementById("questionsEditorContainer");
      container.innerHTML = "";

      draft.questions.forEach((q, idx) => {
        const fClass = q.fontClass || getFontClassForSubject(draft.subject);
        const qCard = document.createElement("div");
        qCard.className = "p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3";
        qCard.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Q.${idx + 1}</span>
            <button onclick="removeDraftQuestion(${idx})" class="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
          </div>
          <div>
            <input type="text" placeholder="Enter question stem..." value="${escapeHtml(q.stem)}" onchange="currentAdminDraft.questions[${idx}].stem = this.value" class="w-full text-sm font-semibold rounded-lg border-slate-300 p-2 bg-white border ${fClass}"/>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            ${q.options.map((opt, optIdx) => `
              <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200">
                <input type="radio" name="draft_correct_${idx}" value="${optIdx}" ${q.correctIndex === optIdx ? 'checked' : ''} onchange="currentAdminDraft.questions[${idx}].correctIndex = ${optIdx}" class="text-blue-600"/>
                <input type="text" placeholder="Option ${String.fromCharCode(65 + optIdx)}" value="${escapeHtml(opt)}" onchange="currentAdminDraft.questions[${idx}].options[${optIdx}] = this.value" class="w-full text-xs border-0 p-0 focus:ring-0 ${fClass}"/>
              </div>
            `).join("")}
          </div>
          <div>
            <input type="text" placeholder="Explanation / Rationale..." value="${escapeHtml(q.explanation || '')}" onchange="currentAdminDraft.questions[${idx}].explanation = this.value" class="w-full text-xs rounded-lg border-slate-300 p-2 bg-white border ${fClass} text-slate-600"/>
          </div>
        `;
        container.appendChild(qCard);
      });

      document.getElementById("verifiedQuestionCount").innerText = draft.questions.length;
      refreshBuilderButtons();
      document.getElementById("scheduleActionBar").classList.remove("hidden");
    }

    function syncSummaryToDraft() {
      if (!currentAdminDraft) return;
      currentAdminDraft.summaryPoints = document.getElementById("editSummaryPoints").value
        .split("\n").map(l => l.trim()).filter(Boolean);
    }

    function removeDraftQuestion(idx) {
      syncSummaryToDraft();
      currentAdminDraft.questions.splice(idx, 1);
      renderAdminEditor(currentAdminDraft);
    }

    async function saveDraftToQuestionBank() {
      if (!currentAdminDraft || currentAdminDraft.questions.length === 0) return;
      const points = document.getElementById("editSummaryPoints").value.trim().split("\n").filter(Boolean);
      const topicTitle = document.getElementById("genTopic").value.trim() || currentAdminDraft.topic;

      if (supabaseClient) {
        await supabaseClient.from("question_bank").insert([{
          subject: currentAdminDraft.subject,
          topic_name: topicTitle,
          summary_points: points,
          questions: currentAdminDraft.questions
        }]);
      }

      await syncAllFromCloud();
      document.getElementById("repoCount").innerText = questionBank.length;
      alert("Saved permanently to Question Bank Repository!");
    }

    async function updateExistingQuestionBank() {
      if (!currentAdminDraft || !currentAdminDraft.bankId) return;
      if (currentAdminDraft.questions.length === 0) {
        alert("Cannot save an empty question bank. Use 'Delete Bank' in the Repository tab to remove the entire topic.");
        return;
      }

      const points = document.getElementById("editSummaryPoints").value.trim().split("\n").filter(Boolean);
      const topicTitle = document.getElementById("genTopic").value.trim() || currentAdminDraft.topic;

      if (supabaseClient) {
        const { error } = await supabaseClient
          .from("question_bank")
          .update({
            subject: currentAdminDraft.subject,
            topic_name: topicTitle,
            summary_points: points,
            questions: currentAdminDraft.questions
          })
          .eq("id", currentAdminDraft.bankId);

        if (error) {
          alert("Error updating bank: " + error.message);
          return;
        }
      }

      await syncAllFromCloud();
      document.getElementById("repoCount").innerText = questionBank.length;
      alert(`Updated "${topicTitle}" (${currentAdminDraft.questions.length} MCQs) in Question Bank!`);
    }

    async function publishAndScheduleExam() {
      if (!currentAdminDraft || currentAdminDraft.questions.length === 0) return;
      const points = document.getElementById("editSummaryPoints").value.trim().split("\n").filter(Boolean);
      const topicTitle = document.getElementById("genTopic").value.trim() || currentAdminDraft.topic;
      const liveDuration = Math.max(1, parseInt(document.getElementById("genDuration").value) || currentAdminDraft.durationMinutes || 15);

      await publishExamRecord({
        title: topicTitle,
        subject: currentAdminDraft.subject,
        duration: liveDuration,
        points,
        questions: currentAdminDraft.questions,
        draftId: currentAdminDraft.draftId || null
      });
    }

    function renderQuestionBank() {
      const grid = document.getElementById("questionBankGrid");
      grid.innerHTML = "";

      if (questionBank.length === 0) {
        grid.innerHTML = `<p class="text-xs text-slate-400 col-span-3">No saved topics in repository yet.</p>`;
      } else {
        questionBank.forEach((item, idx) => {
          const card = document.createElement("div");
          card.className = "p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 flex flex-col justify-between";
          card.innerHTML = `
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">${escapeHtml(item.subject)}</span>
                <span class="text-[11px] text-slate-500 font-semibold">${item.questions.length} MCQs</span>
              </div>
              <h4 class="text-sm font-bold text-slate-900">${escapeHtml(item.topic)}</h4>
            </div>
            <div class="flex items-center space-x-2 pt-2">
              <button onclick="scheduleFromRepo(${idx})" class="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
                Edit / Manage
              </button>
              <button onclick="deleteQuestionBankTopic('${item.id}')" class="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition">
                Delete Bank
              </button>
            </div>
          `;
          grid.appendChild(card);
        });
      }

      // Render Published Exams list for cleanup
      const examGrid = document.getElementById("publishedExamsAdminGrid");
      if (examGrid) {
        examGrid.innerHTML = "";
        if (allExams.length === 0) {
          examGrid.innerHTML = `<p class="text-xs text-slate-400 col-span-3">No exams published yet.</p>`;
        } else {
          allExams.forEach(ex => {
            const eCard = document.createElement("div");
            eCard.className = "p-4 rounded-xl border bg-slate-50 space-y-3 " + (ex.isActive ? "border-emerald-300" : "border-slate-200");
            eCard.innerHTML = `
              <div class="flex items-start justify-between gap-2">
                <div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">${escapeHtml(ex.subject)}</span>
                  ${ex.isActive
                    ? `<span class="ml-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">LIVE</span>`
                    : `<span class="ml-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600">ARCHIVED</span>`}
                  <h4 class="text-sm font-bold text-slate-900 mt-1">${escapeHtml(ex.title)}</h4>
                  <p class="text-[11px] text-slate-500">${ex.questions.length} MCQs • ${ex.durationMinutes} Mins • ${escapeHtml(fmtDate(ex.createdAt))}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                ${ex.isActive
                  ? `<span class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">Live for students</span>`
                  : `<button onclick="makeExamLive('${ex.id}')" class="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition">Make live</button>`}
                <button onclick="deleteScheduledExam('${ex.id}')" class="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition shrink-0">Delete</button>
              </div>
            `;
            examGrid.appendChild(eCard);
          });
        }
      }
    }

    async function deleteQuestionBankTopic(bankId) {
      const bankItem = questionBank.find(b => b.id === bankId);
      const topicName = bankItem ? bankItem.topic : "this topic";
      if (!confirm(`Delete the entire question bank "${topicName}"? This cannot be undone.`)) return;
      if (supabaseClient) {
        await supabaseClient.from("question_bank").delete().eq("id", bankId);
      }
      await syncAllFromCloud();
      document.getElementById("repoCount").innerText = questionBank.length;
      renderQuestionBank();
    }

    async function deleteScheduledExam(examId) {
      const examItem = allExams.find(x => x.id === examId);
      const examTitle = examItem ? examItem.title : "this exam";
      if (!confirm(`Permanently delete exam "${examTitle}"? This also removes it from the exam history, and mentors/admin will no longer be able to open answer sheets for it. Students who have not attempted it will also stop seeing it.`)) return;
      if (supabaseClient) {
        await supabaseClient.from("scheduled_exams").delete().eq("id", examId);
      }
      await syncAllFromCloud();
      renderQuestionBank();
    }

    function scheduleFromRepo(idx) {
      const item = questionBank[idx];
      const liveDuration = Math.max(1, parseInt(document.getElementById("genDuration").value) || 15);
      currentAdminDraft = {
        bankId: item.id,
        subject: item.subject,
        topic: item.topic,
        durationMinutes: liveDuration,
        summaryPoints: item.summaryPoints || [],
        questions: JSON.parse(JSON.stringify(item.questions || []))
      };
      document.getElementById("genSubject").value = item.subject;
      document.getElementById("genTopic").value = item.topic;
      const updateBtn = document.getElementById("btnUpdateExistingBank");
      if (updateBtn) updateBtn.classList.remove("hidden");
      switchAdminTab("generate");
      renderAdminEditor(currentAdminDraft);
    }

    function buildCombinedMegaMock() {
      if (questionBank.length === 0) {
        alert("Save some topics to the repository first.");
        return;
      }
      let combinedQ = [];
      questionBank.forEach(b => combinedQ.push(...b.questions));

      currentAdminDraft = {
        subject: "Combined Mock Exam",
        topic: "Combined Multi-Subject Mega Mock",
        durationMinutes: 45,
        summaryPoints: ["Comprehensive CMKids scholarship model exam covering multiple subjects."],
        questions: combinedQ
      };
      const updateBtn = document.getElementById("btnUpdateExistingBank");
      if (updateBtn) updateBtn.classList.add("hidden");
      document.getElementById("genSubject").value = "Combined Mock Exam";
      document.getElementById("genTopic").value = currentAdminDraft.topic;
      document.getElementById("genDuration").value = 45;
      switchAdminTab("generate");
      renderAdminEditor(currentAdminDraft);
    }
