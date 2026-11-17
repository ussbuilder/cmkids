// auth.js: Supabase sign-in, session, change password, and admin management of logins

    const LOGIN_EMAIL_DOMAIN = "cmkids-portal.com";   // must match setup/portal-admin.ts and the SQL script
    const MIN_PASSWORD_LENGTH = 6;

    // A login ID such as "101s19877" becomes "101s19877@cmkids-portal.com". Characters other than a-z and 0-9
    // are encoded (for example "/" -> "_2f"), identical to the SQL function login_email() and the Edge Function.
    const ADMIN_LOGIN_ID = "cm19877";
    const ADMIN_EMAIL = "nabeelp.jinan@gmail.com";   // the admin signs in with this real address; everyone else uses the made-up domain
    function loginEmail(loginId) {
      if (String(loginId || "").trim().toLowerCase() === ADMIN_LOGIN_ID) return ADMIN_EMAIL;
      const local = Array.from(String(loginId || "").trim().toLowerCase())
        .map(ch => /^[a-z0-9]$/.test(ch) ? ch : "_" + ch.codePointAt(0).toString(16).padStart(2, "0"))
        .join("");
      return local + "@" + LOGIN_EMAIL_DOMAIN;
    }

    // Starting password for students: their admission number, padded with zeros to 6 characters
    function defaultStudentPassword(admNo) {
      const a = String(admNo || "").trim();
      return a.length >= MIN_PASSWORD_LENGTH ? a : a.padStart(MIN_PASSWORD_LENGTH, "0");
    }

    // ------------------------------------------------------------
    // Session start / restore
    // ------------------------------------------------------------
    window.addEventListener("DOMContentLoaded", async () => {
      if (!supabaseClient) {
        setCloudStatus(false);
        showAuthView();
        showLoginError("Could not reach the server. Check your internet connection and reload the page.");
        return;
      }

      supabaseClient.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT" && currentUser) {
          resetLocalData();
          clearInterval(timerInterval);
          currentUser = null;
          showAuthView();
        }
      });

      try {
        const { data } = await supabaseClient.auth.getSession();
        if (data && data.session) {
          const profile = await loadMyProfile(data.session.user.id);
          if (profile) {
            await syncAllFromCloud();
            completeLogin(profile);
            return;
          }
          await supabaseClient.auth.signOut();
        }
      } catch (e) {
        console.warn("Session restore failed:", e);
      }
      showAuthView();
    });

    async function loadMyProfile(authUserId) {
      const { data, error } = await supabaseClient.from("profiles").select("*").eq("auth_user_id", authUserId).maybeSingle();
      if (error) { console.warn("Profile lookup failed:", error.message); return null; }
      return data || null;
    }

    function showLoginError(msg) {
      const box = document.getElementById("loginErrorBox");
      if (!box) return;
      box.innerText = msg;
      box.classList.remove("hidden");
    }

    async function executeRoleLogin() {
      if (!selectedLoginRole) return;
      const enteredId = document.getElementById("loginUserIdInput").value.trim();
      const password = document.getElementById("loginPasswordInput").value;
      document.getElementById("loginErrorBox").classList.add("hidden");

      if (!enteredId || !password) {
        showLoginError("Enter your User ID and password.");
        return;
      }
      if (!supabaseClient) {
        showLoginError("Could not reach the server. Reload the page and try again.");
        return;
      }

      const btn = document.getElementById("btnLoginSubmit");
      btn.innerText = "Verifying...";
      btn.disabled = true;
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: loginEmail(enteredId), password });
        if (error || !data || !data.user) {
          // Same message for "unknown ID" and "wrong password" so IDs cannot be probed
          showLoginError("Incorrect User ID or password.");
          return;
        }
        const profile = await loadMyProfile(data.user.id);
        if (!profile || profile.role !== selectedLoginRole) {
          await supabaseClient.auth.signOut();
          showLoginError(profile ? "This account does not belong to the " + selectedLoginRole + " portal. Choose the correct portal above." : "This login is not set up for the portal yet. Please contact the exam cell.");
          return;
        }
        document.getElementById("loginPasswordInput").value = "";
        await syncAllFromCloud();
        completeLogin(profile);
      } catch (err) {
        showLoginError("Sign in failed: " + (err && err.message ? err.message : err));
      } finally {
        btn.innerText = "Sign In →";
        btn.disabled = false;
      }
    }

    function resetLocalData() {
      allProfiles = [];
      schoolDirectory = [];
      questionBank = [];
      scheduledExams = [];
      allExams = [];
      allAttempts = [];
      quizDrafts = [];
      cloudGeminiApiKey = "";
      cloudDeletePassword = "";
    }

    async function logoutUser() {
      clearInterval(timerInterval);
      try { if (supabaseClient) await supabaseClient.auth.signOut(); } catch (e) {}
      resetLocalData();
      currentUser = null;
      selectedLoginRole = null;
      document.getElementById("roleLoginForm").classList.add("hidden");
      document.getElementById("loginPasswordInput").value = "";
      ["Admin", "Student", "Mentor"].forEach(r => {
        document.getElementById("roleCard" + r).className = "p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-slate-50/60 flex flex-col items-center justify-center space-y-2 transition group";
      });
      const nudge = document.getElementById("pwdNudge");
      if (nudge) nudge.classList.add("hidden");
      showAuthView();
    }

    function toggleLoginPasswordVisibility() {
      const input = document.getElementById("loginPasswordInput");
      input.type = input.type === "password" ? "text" : "password";
    }

    // ------------------------------------------------------------
    // Change password (button in the top bar, every role)
    // ------------------------------------------------------------
    async function showPasswordNudge() {
      const el = document.getElementById("pwdNudge");
      if (!el || !supabaseClient) return;
      el.classList.add("hidden");
      try {
        const { data } = await supabaseClient.auth.getSession();
        const meta = data && data.session && data.session.user ? data.session.user.user_metadata : null;
        if (currentUser && currentUser.role !== "admin" && !(meta && meta.pwd_changed)) el.classList.remove("hidden");
      } catch (e) {}
    }

    function openChangePasswordModal() {
      ["cpCurrent", "cpNew", "cpConfirm"].forEach(id => { document.getElementById(id).value = ""; });
      const err = document.getElementById("cpError");
      err.classList.add("hidden");
      document.getElementById("changePasswordModal").classList.remove("hidden");
      setTimeout(() => document.getElementById("cpCurrent").focus(), 50);
    }

    function closeChangePasswordModal() {
      document.getElementById("changePasswordModal").classList.add("hidden");
    }

    async function submitChangePassword() {
      const cur = document.getElementById("cpCurrent").value;
      const nw = document.getElementById("cpNew").value;
      const conf = document.getElementById("cpConfirm").value;
      const err = document.getElementById("cpError");
      const btn = document.getElementById("btnChangePassword");
      const fail = m => { err.innerText = m; err.classList.remove("hidden"); };
      err.classList.add("hidden");

      if (!cur || !nw || !conf) return fail("Fill in all three boxes.");
      if (nw.length < MIN_PASSWORD_LENGTH) return fail(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      if (nw === cur) return fail("The new password must be different from the current one.");
      if (nw !== conf) return fail("The new password and its confirmation do not match.");
      if (!currentUser || !supabaseClient) return fail("You are not signed in.");

      btn.disabled = true;
      btn.innerText = "Saving...";
      try {
        const check = await supabaseClient.auth.signInWithPassword({ email: loginEmail(currentUser.login_id), password: cur });
        if (check.error) return fail("Your current password is not correct.");
        const upd = await supabaseClient.auth.updateUser({ password: nw, data: { pwd_changed: true } });
        if (upd.error) return fail("Could not change the password: " + upd.error.message);
        closeChangePasswordModal();
        const nudge = document.getElementById("pwdNudge");
        if (nudge) nudge.classList.add("hidden");
        alert("Your password was changed. Use the new password next time you sign in.");
      } catch (e) {
        fail("Could not change the password: " + (e && e.message ? e.message : e));
      } finally {
        btn.disabled = false;
        btn.innerText = "Change Password";
      }
    }

    // ------------------------------------------------------------
    // Admin: create / reset / delete logins through the "portal-admin" Edge Function
    // ------------------------------------------------------------
    async function callPortalAdmin(body) {
      if (!supabaseClient) return { error: "Not connected to the server." };
      try {
        const { data, error } = await supabaseClient.functions.invoke("portal-admin", { body });
        if (error) {
          let msg = error.message || "Request failed";
          try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
          if (/not found|404|failed to send/i.test(msg)) msg += " (Is the portal-admin Edge Function deployed? See PHASE1_SETUP.md.)";
          return { error: msg };
        }
        return data || {};
      } catch (e) {
        return { error: e && e.message ? e.message : String(e) };
      }
    }

    // profiles: array of profile rows; passwordFor(profile) returns the starting password
    async function provisionLogins(profiles, passwordFor) {
      const out = { created: 0, skipped: 0, failed: [] };
      for (let i = 0; i < profiles.length; i += 100) {
        const chunk = profiles.slice(i, i + 100);
        const res = await callPortalAdmin({
          action: "create_users",
          users: chunk.map(p => ({ profile_id: p.id, password: passwordFor(p) }))
        });
        if (res.error) {
          chunk.forEach(p => out.failed.push({ profile: p, error: res.error }));
          continue;
        }
        (res.results || []).forEach(r => {
          const p = chunk.find(x => String(x.id) === String(r.profile_id));
          if (r.ok && r.skipped) out.skipped++;
          else if (r.ok) out.created++;
          else out.failed.push({ profile: p, error: r.error || "failed" });
        });
      }
      return out;
    }

    async function deleteLogins(profileIds) {
      if (!profileIds || profileIds.length === 0) return;
      const res = await callPortalAdmin({ action: "delete_users", profile_ids: profileIds });
      if (res.error) console.warn("Could not remove logins:", res.error);
    }

    function describeProvisionFailures(out) {
      const names = out.failed.slice(0, 5).map(f => (f.profile ? f.profile.full_name : "?") + ": " + f.error).join("\n");
      return `${out.failed.length} login(s) could not be created:\n${names}${out.failed.length > 5 ? "\n..." : ""}`;
    }

    async function createMissingLogins() {
      const btn = document.getElementById("btnCreateMissingLogins");
      const status = document.getElementById("loginsStatus");
      const missing = allProfiles.filter(p => !p.auth_user_id && p.role !== "admin");
      if (missing.length === 0) {
        status.innerText = "Everyone already has a login.";
        return;
      }
      const students = missing.filter(p => p.role === "student");
      const mentors = missing.filter(p => p.role === "mentor");

      let mentorPassword = null;
      if (mentors.length > 0) {
        mentorPassword = prompt(`${mentors.length} mentor(s) have no login yet. Type one starting password for them (at least ${MIN_PASSWORD_LENGTH} characters). They can change it after signing in:`);
        if (mentorPassword === null) return;
        if (mentorPassword.length < MIN_PASSWORD_LENGTH) { alert(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
      }

      btn.disabled = true;
      status.innerText = `Creating ${missing.length} login(s)...`;
      const out = await provisionLogins(missing, p => p.role === "student" ? defaultStudentPassword(p.admission_no) : mentorPassword);
      btn.disabled = false;
      await syncAllFromCloud();
      renderBatchStudentsTable();
      status.innerText = `${out.created} created, ${out.skipped} already existed, ${out.failed.length} failed.`;
      if (out.failed.length) alert(describeProvisionFailures(out));
      else alert(`${out.created} login(s) created.\n\nStudents: password = admission number, zero-padded to ${MIN_PASSWORD_LENGTH} characters (for example 101 -> 000101).` + (mentors.length ? "\nMentors: the password you typed." : ""));
    }

    async function resetStudentPassword(studentId) {
      const stu = allProfiles.find(p => p.id === studentId);
      if (!stu) return;
      const pw = defaultStudentPassword(stu.admission_no);
      if (!confirm(`Reset ${stu.full_name}'s password to the default (${pw})? They will need to change it again themselves.`)) return;
      let res;
      if (stu.auth_user_id) res = await callPortalAdmin({ action: "set_password", profile_id: stu.id, password: pw });
      else {
        const out = await provisionLogins([stu], () => pw);
        res = out.failed.length ? { error: out.failed[0].error } : {};
        await syncAllFromCloud();
      }
      if (res.error) alert("Could not reset the password: " + res.error);
      else alert(`${stu.full_name}'s password is now ${pw}.`);
    }

    async function setMentorPassword(mentorId) {
      const m = allProfiles.find(p => p.id === mentorId);
      if (!m) return;
      const pw = prompt(`New password for ${m.full_name} (at least ${MIN_PASSWORD_LENGTH} characters):`);
      if (pw === null) return;
      if (pw.length < MIN_PASSWORD_LENGTH) { alert(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
      let res;
      if (m.auth_user_id) res = await callPortalAdmin({ action: "set_password", profile_id: m.id, password: pw });
      else {
        const out = await provisionLogins([m], () => pw);
        res = out.failed.length ? { error: out.failed[0].error } : {};
        await syncAllFromCloud();
      }
      if (res.error) alert("Could not set the password: " + res.error);
      else alert(`${m.full_name}'s password was set.`);
    }
