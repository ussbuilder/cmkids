// admin.js: Admin: enrollment, batches, mentors, Excel import, protected deletes

    // ============================================================
    // 5. ADMIN: BATCH YEAR, EXCEL DIRECTORY & MENTOR MANAGEMENT
    // ============================================================
    function switchAdminTab(tab) {
      const tabs = {
        enrollment: ["adminTabEnrollment", "tabBtnEnrollment"],
        generate: ["adminTabGenerate", "tabBtnGenerate"],
        drafts: ["adminTabDrafts", "tabBtnDrafts"],
        bank: ["adminTabBank", "tabBtnBank"],
        analytics: ["adminTabAnalytics", "tabBtnAnalytics"]
      };
      Object.values(tabs).forEach(([paneId, btnId]) => {
        document.getElementById(paneId).classList.add("hidden");
        document.getElementById(btnId).className = "px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 transition";
      });
      const [paneId, btnId] = tabs[tab] || tabs.enrollment;
      document.getElementById(paneId).classList.remove("hidden");
      document.getElementById(btnId).className = "px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 text-white shadow-sm transition";

      if (tab === "bank") renderQuestionBank();
      else if (tab === "drafts") renderDrafts();
      else if (tab === "analytics") renderAdminAnalytics();
    }

    function refreshBatchDropdowns() {
      const batches = new Set([activeBatchYear, "2026-27"]);
      allProfiles.forEach(p => {
        if (p.role === "student" && p.batch_year) batches.add(p.batch_year);
      });

      const selector = document.getElementById("batchSelector");
      selector.innerHTML = "";
      Array.from(batches).sort().reverse().forEach(b => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.innerText = b === activeBatchYear ? `${b} (Active)` : `${b} (Archived)`;
        if (b === selectedBatchFilter) opt.selected = true;
        selector.appendChild(opt);
      });

      document.getElementById("activeBatchBadge").innerText = activeBatchYear;
      document.getElementById("searchTargetBatchLabel").innerText = selectedBatchFilter;
    }

    function changeSelectedBatch(batchVal) {
      selectedBatchFilter = batchVal;
      document.getElementById("searchTargetBatchLabel").innerText = batchVal;
      renderBatchStudentsTable();
    }

    async function createNewBatchYear() {
      const newBatch = prompt("Enter new batch year name (e.g., 2027-28):");
      if (!newBatch || !newBatch.trim()) return;
      const cleanBatch = newBatch.trim();

      activeBatchYear = cleanBatch;
      selectedBatchFilter = cleanBatch;

      if (supabaseClient) {
        await supabaseClient.from("app_settings").upsert([{ key: "active_batch", value: cleanBatch }]);
      }

      refreshBatchDropdowns();
      renderBatchStudentsTable();
      alert(`New batch "${cleanBatch}" created and set as active. All previous batch student records remain safely preserved.`);
    }

    function detectExcelColumns(keys) {
      const norm = k => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
      const admKey = keys.find(k => /^(adm|admn|admission|regno|registration)/.test(norm(k))) || keys[0];
      const nameKey = keys.find(k => k !== admKey && /name/.test(norm(k)))
        || keys.find(k => k !== admKey && /student/.test(norm(k)))
        || keys.find(k => k !== admKey) || keys[1];
      const classKey = keys.find(k => k !== admKey && k !== nameKey && /^(class|div|std|standard|division)/.test(norm(k)))
        || keys.find(k => k !== admKey && k !== nameKey);
      return { admKey, nameKey, classKey };
    }

    function handleSchoolExcelUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

        if (!rows || rows.length === 0) {
          alert("The uploaded file appears empty.");
          return;
        }

        const detected = detectExcelColumns(Object.keys(rows[0]));
        if (!confirm(`Detected columns:\n  Admission No -> "${detected.admKey}"\n  Name -> "${detected.nameKey}"\n  Class -> "${detected.classKey || "(none)"}"\n\nImport ${rows.length} rows?`)) {
          event.target.value = "";
          return;
        }

        const formattedRows = [];
        rows.forEach(r => {
          const keys = Object.keys(r);
          const { admKey, nameKey, classKey } = detectExcelColumns(keys);

          const admVal = String(r[admKey] || "").trim();
          const nameVal = String(r[nameKey] || "").trim();
          const classVal = classKey ? String(r[classKey] || "").trim() : "";

          if (admVal && nameVal) {
            formattedRows.push({
              admission_no: admVal,
              full_name: nameVal,
              class_div: classVal
            });
          }
        });

        if (formattedRows.length === 0) {
          alert("Could not detect Admission Number and Name columns. Ensure your Excel has headers like 'Admission No' and 'Name'.");
          return;
        }

        if (supabaseClient) {
          const { error } = await supabaseClient.from("school_directory").upsert(formattedRows, { onConflict: "admission_no" });
          if (error) {
            alert("Error uploading to Supabase: " + error.message);
            return;
          }
        }

        await syncAllFromCloud();
        document.getElementById("directoryCountBadge").innerText = schoolDirectory.length;
        alert(`Successfully imported ${formattedRows.length} students into the School Master Directory!`);
      };
      reader.readAsArrayBuffer(file);
    }

    async function clearSchoolDirectory() {
      if (!confirm("Clear the temporary full-school Excel directory? (Enrolled CMKids batch students and their test records will NOT be deleted.)")) return;
      
      if (supabaseClient) {
        await supabaseClient.from("school_directory").delete().neq("admission_no", "___NONE___");
      }
      schoolDirectory = [];
      document.getElementById("directoryCountBadge").innerText = "0";
      document.getElementById("directorySearchResults").innerHTML = "";
      alert("Temporary School Directory cleared.");
    }

    async function addNewMentor() {
      const rawName = document.getElementById("newMentorNameInput").value.trim();
      if (!rawName) return;

      const cleanPrefix = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const generatedUserId = `${cleanPrefix}19877`;
      const pwInput = document.getElementById("newMentorPasswordInput");
      const mentorPw = pwInput ? pwInput.value : "";
      if (mentorPw.length < MIN_PASSWORD_LENGTH) {
        alert(`Set a starting password of at least ${MIN_PASSWORD_LENGTH} characters for this mentor.`);
        return;
      }

      if (allProfiles.some(p => p.login_id === generatedUserId)) {
        alert(`Mentor with User ID "${generatedUserId}" already exists.`);
        return;
      }

      const newMentor = {
        full_name: rawName,
        role: "mentor",
        login_id: generatedUserId,
        admission_no: `M_${generatedUserId}`,
        batch_year: "ALL"
      };

      if (supabaseClient) {
        const { data, error } = await supabaseClient.from("profiles").insert([newMentor]).select().single();
        if (error) {
          alert("Error adding mentor: " + error.message);
          return;
        }
        allProfiles.unshift(data);
      } else {
        newMentor.id = "m-" + Date.now();
        allProfiles.unshift(newMentor);
      }

      let loginNote = "";
      if (supabaseClient) {
        const out = await provisionLogins([allProfiles[0]], () => mentorPw);
        if (out.failed.length) loginNote = "\n\nWARNING: the login could not be created (" + out.failed[0].error + "). Use the 'Create missing logins' button later.";
        await syncAllFromCloud();
      }
      document.getElementById("newMentorNameInput").value = "";
      if (pwInput) pwInput.value = "";
      renderMentorsChips();
      alert(`Mentor "${rawName}" added!\nLogin User ID: ${generatedUserId}\nPassword: the one you typed (they can change it after signing in).${loginNote}`);
    }

    function renderMentorsChips() {
      const container = document.getElementById("mentorsChipList");
      container.innerHTML = "";
      const mentors = allProfiles.filter(p => p.role === "mentor");

      mentors.forEach(m => {
        const chip = document.createElement("span");
        chip.className = "inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-900";
        chip.innerHTML = `
          <span>${escapeHtml(m.full_name)}</span>
          <span class="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-700">${escapeHtml(m.login_id)}</span>
          <button type="button" onclick="setMentorPassword('${m.id}')" title="Set password" class="ml-1 text-indigo-600 hover:text-indigo-800">🔑</button>
          <button type="button" onclick="requestDeleteMentor('${m.id}')" title="Delete Mentor" class="ml-1 text-red-500 hover:text-red-700 font-black">✕</button>
        `;
        container.appendChild(chip);
      });
    }

    function searchSchoolDirectory(query) {
      const resultsDiv = document.getElementById("directorySearchResults");
      const q = query.trim().toLowerCase();
      if (!q) {
        resultsDiv.innerHTML = "";
        return;
      }

      const matches = schoolDirectory.filter(
        s => s.admission_no.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q)
      ).slice(0, 15);

      if (matches.length === 0) {
        resultsDiv.innerHTML = `<p class="text-xs text-slate-400 py-2">No matching student found in uploaded School Directory.</p>`;
        return;
      }

      const mentors = allProfiles.filter(p => p.role === "mentor");
      const mentorOptionsHtml = `<option value="">-- Assign Mentor Later --</option>` + 
        mentors.map(m => `<option value="${m.id}">${escapeHtml(m.full_name)} (${escapeHtml(m.login_id)})</option>`).join("");

      resultsDiv.innerHTML = "";
      matches.forEach(stu => {
        const generatedId = `${stu.admission_no.toLowerCase().replace(/\s+/g, "")}s19877`;
        const alreadyInBatch = allProfiles.some(
          p => p.role === "student" && p.admission_no === stu.admission_no && p.batch_year === selectedBatchFilter
        );

        const row = document.createElement("div");
        row.className = "p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3";
        row.innerHTML = `
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">${escapeHtml(stu.admission_no)}</span>
              <span class="text-sm font-bold text-slate-900">${escapeHtml(stu.full_name)}</span>
              ${stu.class_div ? `<span class="text-xs text-slate-500">(${escapeHtml(stu.class_div)})</span>` : ""}
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">Student Login ID: <span class="font-mono font-bold text-blue-700">${generatedId}</span></p>
          </div>
          <div class="flex items-center space-x-2">
            ${alreadyInBatch 
              ? `<span class="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">✓ Enrolled in ${selectedBatchFilter}</span>`
              : `
                <select id="dir_mentor_${escapeHtml(stu.admission_no)}" class="text-xs rounded-lg border-slate-300 bg-white border px-2.5 py-2">
                  ${mentorOptionsHtml}
                </select>
                <button data-adm="${escapeHtml(stu.admission_no)}" onclick="enrollStudentFromDirectory(this.dataset.adm)" class="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap">
                  + Add to Batch
                </button>
              `
            }
          </div>
        `;
        resultsDiv.appendChild(row);
      });
    }

    async function enrollStudentFromDirectory(admNo) {
      const dirStudent = schoolDirectory.find(d => d.admission_no === admNo);
      if (!dirStudent) return;
      const fullName = dirStudent.full_name;
      const classDiv = dirStudent.class_div || "";
      const mentorSelect = document.getElementById(`dir_mentor_${admNo}`);
      const selectedMentorId = mentorSelect ? mentorSelect.value : null;
      await createBatchStudentRecord(admNo, fullName, classDiv, selectedMentorId || null);
      searchSchoolDirectory(document.getElementById("directorySearchInput").value);
    }

    function openManualStudentModal() {
      const mentors = allProfiles.filter(p => p.role === "mentor");
      const sel = document.getElementById("manMentorSelect");
      sel.innerHTML = `<option value="">-- Assign Mentor Later --</option>` + 
        mentors.map(m => `<option value="${m.id}">${escapeHtml(m.full_name)} (${escapeHtml(m.login_id)})</option>`).join("");
      document.getElementById("manualStudentModal").classList.remove("hidden");
    }

    async function submitManualStudent() {
      const admNo = document.getElementById("manAdmNo").value.trim();
      const fullName = document.getElementById("manFullName").value.trim();
      const classDiv = document.getElementById("manClassDiv").value.trim();
      const mentorId = document.getElementById("manMentorSelect").value || null;

      await createBatchStudentRecord(admNo, fullName, classDiv, mentorId);
      document.getElementById("manualStudentModal").classList.add("hidden");
      document.getElementById("manAdmNo").value = "";
      document.getElementById("manFullName").value = "";
      document.getElementById("manClassDiv").value = "";
    }

    async function createBatchStudentRecord(admNo, fullName, classDiv, mentorId) {
      const generatedUserId = `${admNo.toLowerCase().replace(/\s+/g, "")}s19877`;

      if (allProfiles.some(p => p.login_id === generatedUserId)) {
        alert(`Student User ID "${generatedUserId}" is already registered.`);
        return;
      }

      const newStudent = {
        full_name: fullName,
        role: "student",
        admission_no: admNo,
        login_id: generatedUserId,
        class_div: classDiv,
        batch_year: selectedBatchFilter,
        mentor_id: mentorId
      };

      if (supabaseClient) {
        const { data, error } = await supabaseClient.from("profiles").insert([newStudent]).select().single();
        if (error) {
          alert("Error enrolling student: " + error.message);
          return;
        }
        allProfiles.unshift(data);
      } else {
        newStudent.id = "stu-" + Date.now();
        allProfiles.unshift(newStudent);
      }

      let loginNote = "";
      if (supabaseClient) {
        const out = await provisionLogins([allProfiles[0]], p => defaultStudentPassword(p.admission_no));
        if (out.failed.length) loginNote = "\n\nWARNING: the login could not be created (" + out.failed[0].error + "). Use the 'Create missing logins' button later.";
        await syncAllFromCloud();
      }
      renderBatchStudentsTable();
      alert(`Enrolled ${fullName} into Batch ${selectedBatchFilter}!\nStudent Login ID: ${generatedUserId}\nFirst password: ${defaultStudentPassword(admNo)}${loginNote}`);
    }

    function renderBatchStudentsTable() {
      const tbody = document.getElementById("batchStudentsTableBody");
      tbody.innerHTML = "";

      const batchStudents = allProfiles.filter(
        p => p.role === "student" && (p.batch_year || "2026-27") === selectedBatchFilter
      );
      document.getElementById("batchStudentsCount").innerText = batchStudents.length;

      if (batchStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No students enrolled in Batch ${selectedBatchFilter} yet. Use the search bar above to add students.</td></tr>`;
        return;
      }

      batchStudents.forEach(stu => {
        const mentor = allProfiles.find(m => m.id === stu.mentor_id);
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
          <td class="p-3 font-mono font-bold">${escapeHtml(stu.admission_no)}</td>
          <td class="p-3 font-bold text-slate-900">${escapeHtml(stu.full_name)}</td>
          <td class="p-3">${escapeHtml(stu.class_div || "-")}</td>
          <td class="p-3 font-mono font-bold text-blue-700">${escapeHtml(stu.login_id)}</td>
          <td class="p-3">
            ${mentor 
              ? `<span class="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-bold text-[11px]">${escapeHtml(mentor.full_name)}</span>` 
              : `<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold text-[11px]">Unassigned</span>`
            }
          </td>
          <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
            <button onclick="openAssignMentorModal('${stu.id}')" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-blue-700 font-bold text-xs border border-slate-200 transition">
              ${mentor ? "Change Mentor" : "Assign Mentor"}
            </button>
            <button onclick="resetStudentPassword('${stu.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-amber-700 font-bold text-xs border border-slate-200 transition" title="Reset to the default password">
              Reset Password
            </button>
            <button onclick="requestDeleteStudent('${stu.id}')" class="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs border border-red-200 transition">
              Delete
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function openAssignMentorModal(studentId) {
      pendingStudentForMentorAssign = allProfiles.find(p => p.id === studentId);
      if (!pendingStudentForMentorAssign) return;

      document.getElementById("assignMentorStudentLabel").innerText = 
        `Assign mentor for ${pendingStudentForMentorAssign.full_name} (Adm: ${pendingStudentForMentorAssign.admission_no}):`;

      const mentors = allProfiles.filter(p => p.role === "mentor");
      const sel = document.getElementById("assignMentorSelect");
      sel.innerHTML = `<option value="">-- Unassigned --</option>` + 
        mentors.map(m => `<option value="${m.id}" ${pendingStudentForMentorAssign.mentor_id === m.id ? "selected" : ""}>${escapeHtml(m.full_name)} (${escapeHtml(m.login_id)})</option>`).join("");

      document.getElementById("assignMentorModal").classList.remove("hidden");
    }

    async function confirmMentorAssignment() {
      if (!pendingStudentForMentorAssign) return;
      const newMentorId = document.getElementById("assignMentorSelect").value || null;

      pendingStudentForMentorAssign.mentor_id = newMentorId;

      if (supabaseClient) {
        await supabaseClient
          .from("profiles")
          .update({ mentor_id: newMentorId })
          .eq("id", pendingStudentForMentorAssign.id);
      }

      document.getElementById("assignMentorModal").classList.add("hidden");
      renderBatchStudentsTable();
    }

    // ============================================================
    // PROTECTED DELETION (STUDENTS, MENTORS & PAST BATCHES)
    // ============================================================
    function openDeletePasswordModal(summaryText, onVerifiedCallback) {
      pendingProtectedDeleteAction = onVerifiedCallback;
      document.getElementById("deleteTargetSummaryText").innerText = summaryText;
      document.getElementById("specialDeletePasswordInput").value = "";
      document.getElementById("deletePasswordError").classList.add("hidden");
      document.getElementById("deletePasswordModal").classList.remove("hidden");
      setTimeout(() => document.getElementById("specialDeletePasswordInput").focus(), 50);
    }

    function closeDeletePasswordModal() {
      pendingProtectedDeleteAction = null;
      document.getElementById("deletePasswordModal").classList.add("hidden");
    }

    async function confirmProtectedDeletion() {
      const enteredPass = document.getElementById("specialDeletePasswordInput").value.trim();
      const errBox = document.getElementById("deletePasswordError");

      if (!cloudDeletePassword) {
        errBox.innerText = "Special deletion password not configured in Supabase (app_settings).";
        errBox.classList.remove("hidden");
        return;
      }

      if (enteredPass !== cloudDeletePassword) {
        errBox.innerText = "Incorrect Special Admin Password";
        errBox.classList.remove("hidden");
        return;
      }

      const action = pendingProtectedDeleteAction;
      closeDeletePasswordModal();
      if (action) await action();
    }

    function requestDeleteStudent(studentId) {
      const stu = allProfiles.find(p => p.id === studentId);
      if (!stu) return;

      openDeletePasswordModal(
        `Permanently delete student "${escapeHtml(stu.full_name)}" (Adm: ${escapeHtml(stu.admission_no)}, Batch: ${stu.batch_year || "2026-27"}) and all their exam records?`,
        async () => {
          if (supabaseClient) {
            await deleteLogins([studentId]);
            await supabaseClient.from("exam_attempts").delete().eq("student_id", studentId);
            await supabaseClient.from("profiles").delete().eq("id", studentId);
          }
          await syncAllFromCloud();
          renderBatchStudentsTable();
          alert(`Student "${escapeHtml(stu.full_name)}" deleted.`);
        }
      );
    }

    function requestDeleteMentor(mentorId) {
      const mentor = allProfiles.find(p => p.id === mentorId);
      if (!mentor) return;

      openDeletePasswordModal(
        `Permanently delete mentor "${escapeHtml(mentor.full_name)}" (${mentor.login_id})? Assigned students will be kept and marked Unassigned.`,
        async () => {
          if (supabaseClient) {
            await deleteLogins([mentorId]);
            await supabaseClient.from("profiles").update({ mentor_id: null }).eq("mentor_id", mentorId);
            await supabaseClient.from("profiles").delete().eq("id", mentorId);
          }
          await syncAllFromCloud();
          renderMentorsChips();
          renderBatchStudentsTable();
          alert(`Mentor "${escapeHtml(mentor.full_name)}" deleted.`);
        }
      );
    }

    function requestDeleteEntireBatch() {
      const targetBatch = selectedBatchFilter;
      const batchStudents = allProfiles.filter(
        p => p.role === "student" && (p.batch_year || "2026-27") === targetBatch
      );

      if (batchStudents.length === 0 && targetBatch === "2026-27") {
        alert(`Default batch "2026-27" is already empty and cannot be removed.`);
        return;
      }

      const summaryMsg = batchStudents.length > 0
        ? `Permanently delete ALL ${batchStudents.length} students, exam attempts, and remove Batch "${targetBatch}"?`
        : `Batch "${targetBatch}" has 0 students. Remove Batch "${targetBatch}" from the batch list?`;

      openDeletePasswordModal(
        summaryMsg,
        async () => {
          const ids = batchStudents.map(s => s.id);
          if (supabaseClient) {
            if (ids.length > 0) {
              await deleteLogins(ids);
              await supabaseClient.from("exam_attempts").delete().in("student_id", ids);
              await supabaseClient.from("profiles").delete().in("id", ids);
            }

            if (activeBatchYear === targetBatch) {
              const remainingBatches = Array.from(new Set(
                allProfiles
                  .filter(p => p.role === "student" && p.batch_year && p.batch_year !== targetBatch)
                  .map(p => p.batch_year)
                  .concat(["2026-27"])
              )).sort().reverse();
              const fallbackBatch = remainingBatches[0] || "2026-27";

              await supabaseClient.from("app_settings").upsert([{ key: "active_batch", value: fallbackBatch }]);
              activeBatchYear = fallbackBatch;
              selectedBatchFilter = fallbackBatch;
            } else {
              selectedBatchFilter = activeBatchYear;
            }
          } else {
            if (activeBatchYear === targetBatch) activeBatchYear = "2026-27";
            selectedBatchFilter = activeBatchYear;
          }

          await syncAllFromCloud();
          refreshBatchDropdowns();
          renderBatchStudentsTable();
          alert(`Batch "${targetBatch}" has been removed.`);
        }
      );
    }
