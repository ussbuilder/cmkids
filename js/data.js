// data.js: Startup, cloud sync, login and logout

    // ============================================================
    // 3. INITIAL LOAD & SESSION RESTORATION
    // ============================================================
    window.addEventListener("DOMContentLoaded", async () => {
      await syncAllFromCloud();
      
      const savedSession = localStorage.getItem("cmkids_active_user");
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          const validUser = allProfiles.find(p => p.login_id === parsed.login_id && p.role === parsed.role);
          if (validUser) {
            completeLogin(validUser);
            return;
          }
        } catch (e) {}
      }
      showAuthView();
    });

    function setCloudStatus(ok) {
      const badge = document.getElementById("cloudStatusBadge");
      if (!badge) return;
      badge.className = "hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border " +
        (ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200");
      badge.innerHTML = ok
        ? '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>Cloud Connected</span>'
        : '<span class="w-2 h-2 rounded-full bg-red-500"></span><span>Cloud Offline</span>';
    }

    async function syncAllFromCloud() {
      if (!supabaseClient) { setCloudStatus(false); return; }

      try {
        // 1. App Settings (active_batch, gemini_api_key & delete_password)
        const { data: settingsRows } = await supabaseClient.from("app_settings").select("*");
        if (settingsRows) {
          const batchRow = settingsRows.find(s => s.key === "active_batch");
          if (batchRow && batchRow.value) {
            activeBatchYear = batchRow.value;
            selectedBatchFilter = batchRow.value;
          }
          const keyRow = settingsRows.find(s => s.key === "gemini_api_key");
          if (keyRow && keyRow.value) {
            cloudGeminiApiKey = keyRow.value.trim();
          }
          const delRow = settingsRows.find(s => s.key === "delete_password");
          if (delRow && delRow.value) {
            cloudDeletePassword = delRow.value.trim();
          }
        }

        // 2. Profiles (Admins, Mentors, Students)
        const { data: profiles, error: profilesError } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
        setCloudStatus(!profilesError);
        if (profiles) {
          allProfiles = profiles;
        }

        if (!allProfiles.some(p => p.login_id === "CM19877")) {
          allProfiles.push({
            id: "admin-master",
            full_name: "Exam Cell Admin",
            role: "admin",
            login_id: "CM19877",
            admission_no: "ADMIN_MASTER",
            batch_year: "ALL"
          });
        }

        // 3. School Directory
        const { data: dir } = await supabaseClient.from("school_directory").select("*").order("admission_no", { ascending: true });
        if (dir) schoolDirectory = dir;

        // 4. Scheduled Exams
        const { data: exams } = await supabaseClient.from("scheduled_exams").select("*").order("created_at", { ascending: false });
        if (exams) {
          allExams = exams.map(e => ({
            id: e.id,
            title: e.title,
            subject: e.subject,
            durationMinutes: e.duration_minutes,
            summaryPoints: e.summary_points || [],
            questions: e.questions || [],
            isActive: e.is_active !== false,
            createdAt: e.created_at || e.scheduled_at
          }));
          scheduledExams = allExams.filter(e => e.isActive).slice(0, 1); // students only ever see the newest live exam
        }

        // 5. Question Bank
        const { data: bank } = await supabaseClient.from("question_bank").select("*").order("created_at", { ascending: false });
        if (bank) {
          questionBank = bank.map(b => ({
            id: b.id,
            subject: b.subject,
            topic: b.topic_name,
            summaryPoints: b.summary_points || [],
            questions: b.questions || []
          }));
        }

        // 6. Exam Attempts
        const { data: attempts } = await supabaseClient.from("exam_attempts").select("*").order("completed_at", { ascending: false });
        if (attempts) allAttempts = attempts;

        // 7. Quiz drafts (table is created by supabase_setup.sql)
        const { data: drafts, error: draftsError } = await supabaseClient.from("quiz_drafts").select("*").order("updated_at", { ascending: false });
        if (draftsError) {
          draftsTableMissing = true;
        } else {
          draftsTableMissing = false;
          quizDrafts = drafts || [];
        }

      } catch (err) {
        console.warn("Cloud sync notice:", err);
        setCloudStatus(false);
      }
    }

    // ============================================================
    // 4. STRICT ROLE-LOCKED LOGIN FLOW
    // ============================================================
    function showAuthView() {
      document.getElementById("authView").classList.remove("hidden");
      document.getElementById("adminView").classList.add("hidden");
      document.getElementById("studentView").classList.add("hidden");
      document.getElementById("mentorView").classList.add("hidden");
      document.getElementById("userSessionBar").classList.add("hidden");
    }

    function selectLoginRole(role) {
      selectedLoginRole = role;
      document.getElementById("loginErrorBox").classList.add("hidden");
      document.getElementById("loginUserIdInput").value = "";

      ["Admin", "Student", "Mentor"].forEach(r => {
        const el = document.getElementById("roleCard" + r);
        el.className = "p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-slate-50/60 flex flex-col items-center justify-center space-y-2 transition group";
      });

      const activeCard = document.getElementById("roleCard" + role.charAt(0).toUpperCase() + role.slice(1));
      activeCard.className = "p-4 rounded-2xl border-2 border-blue-600 bg-blue-50 flex flex-col items-center justify-center space-y-2 shadow-sm transition";

      const labelMap = {
        admin: "Enter Admin User ID",
        student: "Enter Student User ID",
        mentor: "Enter Mentor User ID"
      };
      document.getElementById("selectedRolePromptLabel").innerText = labelMap[role];
      document.getElementById("roleLoginForm").classList.remove("hidden");
      document.getElementById("loginUserIdInput").focus();
    }

    async function executeRoleLogin() {
      if (!selectedLoginRole) return;
      const enteredId = document.getElementById("loginUserIdInput").value.trim();
      const errorBox = document.getElementById("loginErrorBox");
      errorBox.classList.add("hidden");

      const btn = document.getElementById("btnLoginSubmit");
      btn.innerText = "Verifying...";
      btn.disabled = true;

      await syncAllFromCloud();

      const matchedUser = allProfiles.find(
        p => p.login_id && p.login_id.toLowerCase() === enteredId.toLowerCase() && p.role === selectedLoginRole
      );

      btn.innerText = "Sign In →";
      btn.disabled = false;

      if (!matchedUser) {
        errorBox.innerText = "User not found";
        errorBox.classList.remove("hidden");
        return;
      }

      localStorage.setItem("cmkids_active_user", JSON.stringify(matchedUser));
      completeLogin(matchedUser);
    }

    function completeLogin(user) {
      currentUser = user;
      document.getElementById("authView").classList.add("hidden");
      document.getElementById("userSessionBar").classList.remove("hidden");
      document.getElementById("headerUserName").innerText = user.full_name;
      document.getElementById("headerUserRole").innerText = user.role.toUpperCase();

      if (user.role === "admin") {
        document.getElementById("adminView").classList.remove("hidden");
        refreshBatchDropdowns();
        renderMentorsChips();
        renderBatchStudentsTable();
        renderQuestionBank();
        updateAiKeyStatusDisplay();
        renderDrafts();
        document.getElementById("directoryCountBadge").innerText = schoolDirectory.length;
        document.getElementById("repoCount").innerText = questionBank.length;
      } else if (user.role === "student") {
        document.getElementById("studentView").classList.remove("hidden");
        setupStudentDashboard();
      } else if (user.role === "mentor") {
        document.getElementById("mentorView").classList.remove("hidden");
        setupMentorDashboard();
      }
    }

    function logoutUser() {
      clearInterval(timerInterval);
      currentUser = null;
      selectedLoginRole = null;
      localStorage.removeItem("cmkids_active_user");
      document.getElementById("roleLoginForm").classList.add("hidden");
      ["Admin", "Student", "Mentor"].forEach(r => {
        document.getElementById("roleCard" + r).className = "p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-slate-50/60 flex flex-col items-center justify-center space-y-2 transition group";
      });
      showAuthView();
    }
