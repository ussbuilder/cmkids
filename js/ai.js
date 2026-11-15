// ai.js: Admin: Gemini helper and AI reformat of pasted questions

    // ------------------------------------------------------------
    // AI: reformat pasted questions into the bulk-paste format
    // ------------------------------------------------------------
    async function callGeminiText(promptText, timeoutSeconds) {
      const apiKey = localStorage.getItem("cmkids_gemini_api_key") || cloudGeminiApiKey;
      if (!apiKey) return { text: null, error: "Gemini API key is missing. Open Generate with AI > Override Key and paste your AIza... key." };

      let lastError = "";
      for (const modelName of GEMINI_MODELS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
        try {
          incrementTodayAiUsageCount();
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
            {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.2 }
              })
            }
          );
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (response.status === 429) lastError = "Rate limit reached (429). Wait a minute and try again.";
            else if (response.status === 503) lastError = "Google AI servers are busy (503). Try again.";
            else lastError = errData?.error?.message || `HTTP ${response.status}`;
            continue;
          }
          const data = await response.json();
          const out = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
          if (!out.trim()) { lastError = "Empty response from Gemini."; continue; }
          return { text: out, error: null };
        } catch (err) {
          clearTimeout(timeoutId);
          lastError = err.name === "AbortError" ? `Timed out after ${timeoutSeconds}s. Try a smaller batch of questions.` : err.message;
        }
      }
      return { text: null, error: lastError || "AI request failed." };
    }

    async function reformatPastedWithAI() {
      const ta = document.getElementById("bulkQuestionsInput");
      const raw = ta.value.trim();
      const status = document.getElementById("aiReformatStatus");
      const btn = document.getElementById("btnAiReformat");
      if (!raw) { alert("Paste your questions into the box first."); return; }
      if (raw.length > 30000) { alert("That is a lot of text. Please reformat in smaller batches (about 30 questions at a time)."); return; }

      const subject = document.getElementById("genSubject").value;
      const promptText = `You are a formatting assistant for a school exam system. Convert the pasted quiz content below into the exact plain-text format described. Do NOT translate anything: keep every word in its original language and script (Malayalam, English, Hindi, Urdu, Arabic, Sanskrit). Output ONLY the formatted questions, with no commentary, no markdown and no code fences.

FORMAT (separate questions with exactly one blank line):
1. Question text
A) option text
B) option text
C) option text
D) option text
Ans: B
Exp: short explanation (this line is optional)

RULES:
- Number the questions 1, 2, 3 and so on.
- Every question has exactly 4 options labelled A) B) C) D), each on its own line. Remove any old labels such as (a), 1), i. or ①.
- The question text and each option must each be on a single line (join wrapped lines).
- "Ans:" must be a single letter A, B, C or D. Use the answer key from the source if there is one (keys may be listed at the end, or shown with ticks, bold, asterisks or "Answer:").
- If the source gives no answer for a question, work out the correct answer yourself and begin that question's Exp line with "[AI-inferred answer - please verify]".
- If a question has fewer than 4 options, add plausible wrong options. If it has more than 4, keep the correct one plus the 3 best distractors. In both cases begin the Exp line with "[AI-adjusted options - please verify]".
- Keep explanations from the source in the Exp line. If there is none, leave the Exp line out.
- Do not invent new questions and skip anything that is not a question.
- Subject for context: ${subject}.

SOURCE:
"""
${raw}
"""`;

      btn.disabled = true;
      const TIMEOUT = 60;
      let secs = 0;
      btn.innerText = `✨ Reformatting... (0s / ${TIMEOUT}s)`;
      status.className = "text-[11px] font-semibold text-slate-500";
      status.innerText = "";
      const timer = setInterval(() => { secs++; btn.innerText = `✨ Reformatting... (${secs}s / ${TIMEOUT}s)`; }, 1000);

      const { text, error } = await callGeminiText(promptText, TIMEOUT);

      clearInterval(timer);
      btn.disabled = false;
      btn.innerText = "✨ Reformat with AI";

      if (error || !text) {
        status.className = "text-[11px] font-semibold text-red-600";
        status.innerText = "AI reformat failed: " + error;
        return;
      }

      let cleaned = text.replace(/\r/g, "").trim()
        .replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
      const qCount = (cleaned.match(/^\s*\d+[\.\)]\s+/gm) || []).length;
      const ansCount = (cleaned.match(/^\s*Ans\s*:/gim) || []).length;
      if (qCount === 0) {
        status.className = "text-[11px] font-semibold text-red-600";
        status.innerText = "The AI reply did not look like questions, so your text was left unchanged.";
        return;
      }

      lastRawPaste = raw;
      ta.value = cleaned;
      const inferred = (cleaned.match(/\[AI-inferred answer/gi) || []).length;
      const adjusted = (cleaned.match(/\[AI-adjusted options/gi) || []).length;
      status.className = "text-[11px] font-semibold text-emerald-700";
      status.innerHTML = `Reformatted ${qCount} question(s) (${ansCount} with answers)` +
        (inferred ? `, <b>${inferred} AI-inferred answer(s)</b>` : "") +
        (adjusted ? `, <b>${adjusted} with adjusted options</b>` : "") +
        `. Review the text, then click Load. <button type="button" onclick="undoAiReformat()" class="underline font-bold text-blue-700">Undo</button>`;
    }

    function undoAiReformat() {
      if (lastRawPaste === null) return;
      document.getElementById("bulkQuestionsInput").value = lastRawPaste;
      lastRawPaste = null;
      const status = document.getElementById("aiReformatStatus");
      status.className = "text-[11px] font-semibold text-slate-500";
      status.innerText = "Restored your original text.";
    }
