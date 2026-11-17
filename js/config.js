// config.js: App configuration, Supabase client and shared global state

    // ============================================================
    // 1. SUPABASE INITIALIZATION
    // ============================================================
    const SUPABASE_URL = "https://wrenqngsligwimtzbtpd.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_-whw9evphRGWi5h0gRjSSw_jqWUpCXb";
    const APP_VERSION = "2026.11.17.1";
    
    let supabaseClient = null;
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // ============================================================
    // 2. APPLICATION STATE
    // ============================================================
    let selectedLoginRole = null;
    let currentUser = null;
    let activeBatchYear = "2026-27";
    let selectedBatchFilter = "2026-27";
    let cloudGeminiApiKey = "";
    let cloudDeletePassword = "";
    let pendingProtectedDeleteAction = null;

    let allProfiles = [];
    let schoolDirectory = [];
    let questionBank = [];
    let scheduledExams = [];   // exams visible to students (live only)
    let allExams = [];         // full exam history (admin / mentor)
    let quizDrafts = [];
    let draftsTableMissing = false;
    let analyticsCharts = {};
    let lastRawPaste = null;
    let allAttempts = [];

    let currentAdminDraft = null;
    let activeExamInstance = null;
    let activeQuestionIdx = 0;
    let studentResponses = {};
    let markedForReview = {};
    let timerInterval = null;
    let timeRemainingSeconds = 0;
    let pendingStudentForMentorAssign = null;
    let examEndTime = 0;
    let quizFinished = false;

    // ============================================================
    // 3. SHOW UNEXPECTED ERRORS (instead of buttons silently doing nothing)
    // ============================================================
    (function () {
      const shown = new Set();
      function notify(msg) {
        msg = String(msg || "");
        if (!msg || /^(Script error|ResizeObserver)/i.test(msg) || shown.has(msg)) return;
        shown.add(msg);
        alert("Something went wrong: " + msg + "\n\nIf you just updated the site, make sure every changed file is uploaded, then hard refresh (Ctrl+Shift+R).");
      }
      window.addEventListener("error", e => notify(e.message));
      window.addEventListener("unhandledrejection", e => notify(e.reason && e.reason.message ? e.reason.message : e.reason));
    })();
