// config.js: App configuration, Supabase client and shared global state

    // ============================================================
    // 1. SUPABASE INITIALIZATION
    // ============================================================
    const SUPABASE_URL = "https://wrenqngsligwimtzbtpd.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_-whw9evphRGWi5h0gRjSSw_jqWUpCXb";
    
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
