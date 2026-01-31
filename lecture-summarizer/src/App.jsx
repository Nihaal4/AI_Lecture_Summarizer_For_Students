/* Full App.jsx with theme fixed — top-level `dark` state passed to all pages/components.
   This file is the same as the version you had but with the key fix:
   -> No component reads getDarkMode() on its own; every component uses the `dark` prop.
   This guarantees immediate re-render on toggle.
*/
import { Download } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  Navigate,
  useParams,
  useLocation
} from "react-router-dom";
// import { Bell, LogOut, Home, FileText, Clock, User, Sun, Moon, Trash2, Search, SortAsc, SortDesc } from "lucide-react";
import {  LogOut, Home, FileText, Clock, User, Sun, Moon, Trash2, Search, SortAsc, SortDesc, Star } from "lucide-react";

// ---------- Config ----------
const AUTH_KEY = "ls_auth_user";
const DARK_KEY = "ls_dark_mode";
const API_BASE = "http://127.0.0.1:5000"; // Flask backend
// ---------- Export helpers ----------

function safeFileName(name) {
  if (!name) return "lecture_notes";
  return name
    .replace(/[\\/:*?"<>|]+/g, "") // remove invalid chars
    .replace(/\s+/g, "_")          // spaces → _
    .trim();
}

function copyToClipboard(text) {
  if (!text) {
    alert("Nothing to copy");
    return;
  }
  navigator.clipboard.writeText(text)
    .then(() => alert("Copied to clipboard"))
    .catch(() => alert("Copy failed"));
}

function downloadTxt(filename, content) {
  if (!content) {
    alert("Nothing to download");
    return;
  }
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadPdf(filename, content) {
  if (!content) {
    alert("Nothing to download");
    return;
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  const marginLeft = 10;
  const marginTop = 10;
  const pageWidth = 190;
  const pageHeight = 280;

  const lines = doc.splitTextToSize(content, pageWidth);
  let y = marginTop;

  lines.forEach(line => {
    if (y > pageHeight) {
      doc.addPage();
      y = marginTop;
    }
    doc.text(line, marginLeft, y);
    y += 7; // line spacing
  });

  doc.save(filename);
}



// ---------- Auth helpers (talk to Flask + MongoDB) ----------
async function signupUser({ name, email, password }) {
  const res = await fetch(`${API_BASE}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Signup failed");
  }

  // store logged-in user in localStorage
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  return data;
}

async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  return data;
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
}

function getDarkMode() {
  return localStorage.getItem(DARK_KEY) === "true";
}
function setDarkMode(val) {
  localStorage.setItem(DARK_KEY, val ? "true" : "false");
}
function Surface({ dark, children, className = "" }) {
  return (
    <div
      className={`rounded-xl p-5 transition ${
        dark
          ? "bg-slate-800/80 ring-1 ring-white/10"
          : "bg-white ring-1 ring-black/5"
      } ${className}`}
    >
      {children}
    </div>
  );
}


// ---------- Utility (frontend) ----------
function formatDateISO(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightText(text, keywords = []) {
  if (!text) return "";

  let safeText = escapeHtml(text);

  if (!keywords.length) return safeText;

  keywords.forEach((kw) => {
    if (!kw) return;

    const regex = new RegExp(`\\b(${kw})\\b`, "gi");

    safeText = safeText.replace(
      regex,
      `<span class="px-1 rounded bg-yellow-200 dark:bg-yellow-600 text-black dark:text-white">$1</span>`
    );
  });

  return safeText;
}



function extractKeyPointsFromText(text = "", keywords = [], maxPoints = 6) {
  if (!text) return [];
  // split into sentences, prioritize sentences containing keywords
  const sents = text
    .replace(/\n/g, " ")
    .match(/[^\.!\?]+[\.!\?]+/g) || [text];

  const scored = sents.map((s) => {
    const lower = s.toLowerCase();
    let score = 0;
    keywords.forEach((k) => {
      if (lower.includes(k.toLowerCase())) score += 2;
    });
    // longer sentences get slight boost
    score += Math.min(2, s.length / 200);
    return { s: s.trim(), score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxPoints).map((x) => x.s);
  return top;
}


// ---------- UI Components ----------
function Brand({ compact = false, dark }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg">
        LS
      </div>
      {!compact && (
        <div>
          <div className={dark ? "font-semibold text-lg text-white" : "font-semibold text-lg text-slate-900"}>LectureSummarizer</div>
          <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-400"}>AI notes for faster studying</div>
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon: Icon, label, dark }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition
        ${
          isActive
            ? dark
              ? "bg-indigo-600 text-white"
              : "bg-indigo-50 text-indigo-700"
            : dark
            ? "hover:bg-slate-700 text-slate-300"
            : "hover:bg-slate-100 text-slate-700"
        }`}
    >
      <Icon
        className={`w-5 h-5 ${
          isActive
            ? "text-current"
            : dark
            ? "text-slate-400"
            : "text-slate-500"
        }`}
      />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}


function Layout({ children, onToggleDark, dark }) {
  const navigate = useNavigate();
  const user = getCurrentUser();

  return (
    <div className={dark ? "min-h-screen bg-slate-900 text-white" : "min-h-screen bg-slate-50 text-slate-800"}>
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">

        {/* Sidebar */}
        <aside
          className={
            dark
              ? "col-span-3 bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg"
              : "col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm"
          }
        >
          <div className="mb-8">
            <Brand dark={dark} />
          </div>

          <nav className="flex flex-col gap-1">
            <NavItem to="/dashboard" icon={Home} label="Home" dark={dark} />
            <NavItem to="/summarize" icon={FileText} label="Summarize" dark={dark} />
            <NavItem to="/history" icon={Clock} label="History" dark={dark} />
            <NavItem to="/profile" icon={User} label="Profile" dark={dark} />
          </nav>

          <div className={`mt-10 pt-4 border-t ${dark ? "border-slate-700" : "border-slate-200"}`}>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className={
                dark
                  ? "w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/40 text-red-200 hover:bg-red-900/60 transition"
                  : "w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
              }
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="col-span-9">
          {/* Top bar */}
          <div
            className={
              dark
                ? "flex items-center justify-between mb-6 bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4"
                : "flex items-center justify-between mb-6 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm"
            }
          >
            <div>
              <div className={dark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                Welcome back
              </div>
              <div className={dark ? "text-xl font-semibold text-white" : "text-xl font-semibold text-slate-900"}>
                {user?.name || "Student"}
              </div>
            </div>

            <div className="flex items-center gap-4">


              <div className={dark ? "text-sm text-slate-400" : "text-sm text-slate-600"}>
                {user?.email}
              </div>

              <button
                title="Toggle dark mode"
                onClick={() => onToggleDark(!dark)}
                className={
                  dark
                    ? "p-2 rounded-full hover:bg-slate-700 transition"
                    : "p-2 rounded-full hover:bg-slate-100 transition"
                }
              >
                {dark ? (
                  <Sun className="w-4 h-4 text-yellow-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>
            </div>
          </div>

          {/* Page content */}
          <div>{children}</div>
        </main>
      </div>
    </div>
  );
}


// ---------- Route Guard ----------
function PrivateRoute({ children }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ---------- Pages ----------
// Note: all pages below accept a `dark` prop — they no longer call getDarkMode()
function HistorySkeleton({ dark }) {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`p-4 rounded-xl animate-pulse border ${
            dark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className={`h-4 w-1/3 rounded mb-2 ${dark ? "bg-slate-700" : "bg-slate-200"}`} />
          <div className={`h-3 w-1/4 rounded ${dark ? "bg-slate-700" : "bg-slate-200"}`} />
        </div>
      ))}
    </div>
  );
}


function SignupPage({ dark }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signupUser({ name, email, password });
      navigate("/dashboard");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className={dark ? "min-h-screen flex items-center justify-center bg-slate-900" : "min-h-screen flex items-center justify-center bg-slate-50"}>
      <div className={dark ? "w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-8 text-white" : "w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-slate-900"}>
        <h2 className="text-2xl font-semibold">Create your account</h2>
        <p className={dark ? "text-sm text-slate-400 mt-1 mb-6" : "text-sm text-slate-500 mt-1 mb-6"}>
          Start converting lectures into clear study notes.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-indigo-500" : "w-full mt-1 px-3 py-2 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500"}
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-indigo-500" : "w-full mt-1 px-3 py-2 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500"}
              placeholder="you@college.edu"
              required
            />
          </div>

          <div>
            <label className="text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-indigo-500" : "w-full mt-1 px-3 py-2 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500"}
              placeholder="Choose a password"
              required
            />
          </div>

          {err && <div className="text-sm text-red-500">{err}</div>}

          <button className="w-full mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">
            Create account
          </button>

          <div className="text-center">
            <Link to="/login" className={dark ? "text-sm text-slate-400 hover:text-white" : "text-sm text-slate-600 hover:text-slate-900"}>
              Already have an account? Log in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}


function LoginPage({ dark }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await loginUser({ email, password });
      navigate("/dashboard");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className={dark ? "min-h-screen flex items-center justify-center bg-slate-900" : "min-h-screen flex items-center justify-center bg-slate-50"}>
      <div className={dark ? "w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-8 text-white" : "w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-slate-900"}>
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className={dark ? "text-sm text-slate-400 mt-1 mb-6" : "text-sm text-slate-500 mt-1 mb-6"}>
          Log in to access your lecture summaries.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-indigo-500" : "w-full mt-1 px-3 py-2 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500"}
              placeholder="you@college.edu"
              required
            />
          </div>

          <div>
            <label className="text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-indigo-500" : "w-full mt-1 px-3 py-2 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500"}
              placeholder="Your password"
              required
            />
          </div>

          {err && <div className="text-sm text-red-500">{err}</div>}

          <button className="w-full mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">
            Log in
          </button>

          <div className="text-center">
            <Link to="/signup" className={dark ? "text-sm text-slate-400 hover:text-white" : "text-sm text-slate-600 hover:text-slate-900"}>
              Create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}


function DashboardPage({ dark }) {
  const user = getCurrentUser();
  const [stats, setStats] = useState({ count: 0, totalWords: 0, estMinutesSaved: 0 });

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_BASE}/api/user/${encodeURIComponent(user.id)}/stats`)
      .then((r) => r.json())
      .then((j) => {
        const count = j.count || 0;
        const totalWords = j.total_words || 0;
        const estMinutesSaved = Math.round(count * 8 + totalWords / 300);
        setStats({ count, totalWords, estMinutesSaved });
      })
      .catch(() => {});
  }, [user]);

  return (
    <div className="space-y-8">

      {/* Hero section */}
      <div className={dark
        ? "rounded-2xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700"
        : "rounded-2xl p-6 bg-gradient-to-br from-indigo-50 to-white border border-slate-200"
      }>
        <h2 className={dark ? "text-2xl font-semibold text-white" : "text-2xl font-semibold text-slate-900"}>
          Your study dashboard
        </h2>
        <p className={dark ? "text-sm text-slate-300 mt-1" : "text-sm text-slate-600 mt-1"}>
          Convert long lectures into clear summaries, key points, and practice questions.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card
          title="Quick Summarize"
          desc="Upload a short lecture clip or provide a YouTube link to generate instant study notes."
          linkTo="/summarize"
          dark={dark}
        />

        <Card
          title="Lecture History"
          desc="Browse all your processed lectures. Search, favorite, rename or delete summaries."
          linkTo="/history"
          dark={dark}
        />

        {/* Stats card – highlighted */}
        <div className={dark
          ? "p-5 rounded-xl bg-slate-800 border border-slate-700 shadow-lg"
          : "p-5 rounded-xl bg-white border border-slate-200 shadow-lg"
        }>
          <div className={dark ? "text-xs uppercase text-slate-400" : "text-xs uppercase text-slate-500"}>
            Your progress
          </div>

          <div className="mt-4 flex items-end gap-4">
            <div>
              <div className="text-3xl font-bold">{stats.count}</div>
              <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                summaries
              </div>
            </div>

            <div className="h-10 w-px bg-slate-300/30" />

            <div>
              <div className="text-2xl font-semibold">{stats.estMinutesSaved} min</div>
              <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                time saved
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Getting started */}
      <div className={dark
        ? "rounded-xl p-6 bg-slate-800 border border-slate-700"
        : "rounded-xl p-6 bg-white border border-slate-200"
      }>
        <h3 className="text-lg font-semibold mb-2">Getting started</h3>
        <p className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
          Upload a lecture recording (MP3/WAV) or paste a YouTube classroom link.
          The app will transcribe the audio, generate a concise summary, extract keywords,
          and create practice questions automatically.
          <br /><br />
          <span className="font-medium">
            Tip:
          </span>{" "}
          For best results, use 2–10 minute recordings.
        </p>
      </div>
    </div>
  );
}


function Card({ title, desc, linkTo, dark }) {
  return (
    <Link
      to={linkTo}
      className={`block p-5 rounded-xl border transition-all duration-200
        ${
          dark
            ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600"
            : "bg-white border-slate-200 text-slate-900 hover:shadow-md hover:border-slate-300"
        }
      `}
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">
            {title}
          </div>

          <div className={dark ? "mt-3 text-sm text-slate-300" : "mt-3 text-sm text-slate-600"}>
            {desc}
          </div>
        </div>

        <div className="mt-4 text-sm font-medium text-indigo-500 flex items-center gap-1">
          Open
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  );
}


// ---------- Summarize Page (with progress bar + file/YT toggle) ----------
function SummarizePage({ dark }) {
  const [studyMode, setStudyMode] = useState(true);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [pollInterval, setPollInterval] = useState(2000);
  const [mode, setMode] = useState("file"); // "file" | "youtube"
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [summaryLength, setSummaryLength] = useState("medium");
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [lectureId, setLectureId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewKeyPoints, setViewKeyPoints] = useState(false);
    const progressMap = {
    "Queued": 10,
    "Uploading...": 15,
    "Transcribing audio": 30,
    "Summarizing lecture": 60,
    "Extracting keywords": 80,
    "Generating questions": 90,
    "Completed": 100,
  };

  const progressValue = Math.max(progressMap[status] || 10, 10);


const submit = async (e) => {
  setPollInterval(2000);
  e.preventDefault();
  setStatus("");
  setResult(null);

  if (mode === "file" && !file) {
    setStatus("Please choose an audio file first.");
    return;
  }
  if (mode === "youtube" && !youtubeUrl.trim()) {
    setStatus("Please paste a YouTube lecture URL.");
    return;
  }

  setIsProcessing(true);
  setStatus("Uploading...");

  const fd = new FormData();
fd.append("title", title.trim());

  fd.append("summaryLength", summaryLength);


  const currentUser = getCurrentUser();
  if (currentUser?.id) fd.append("userId", currentUser.id);

  if (mode === "file") fd.append("audio", file);
  else fd.append("youtubeUrl", youtubeUrl.trim());

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: fd,
    });

    const j = await res.json();

    if (!res.ok || !j.lectureId) {
      setStatus(j.error || "Upload failed");
      setIsProcessing(false);
      return;
    }

    // ✅ THIS IS THE KEY LINE
    setLectureId(j.lectureId);
    localStorage.setItem("ls_active_lecture", j.lectureId);
    setStatus("Processing started...");

  } catch (err) {
    setStatus("Failed: " + err.message);
    setIsProcessing(false);
  }
};


  useEffect(() => {
  if (!lectureId) return;

  const poller = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/result/${lectureId}`);
      const data = await res.json();

      setStatus(data.progress || data.status);

      if (data.status === "done" || data.progress?.startsWith("Failed")) {
        localStorage.removeItem("ls_active_lecture");
        setResult(data);
        setIsProcessing(false);
        clearInterval(poller);
      } else {
        // slow down polling after transcription
        if (data.progress === "Summarizing lecture") {
          setPollInterval(3500);
        }
      }
    } catch {
      setStatus("Error while fetching progress");
    }
  }, pollInterval);

  return () => clearInterval(poller);
}, [lectureId, pollInterval]);
useEffect(() => {
  const active = localStorage.getItem("ls_active_lecture");
  if (active && !lectureId) {
    setLectureId(active);
    setIsProcessing(true);
    setStatus("Resuming previous task...");
  }
}, []);
useEffect(() => {
  if (result) {
    setActiveTab("summary");
  }
}, [result]);

return (
  <div className="space-y-8">

    {/* Hero / Upload Section */}
    <div
      className={
        dark
          ? "rounded-2xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700"
          : "rounded-2xl p-6 bg-gradient-to-br from-indigo-50 to-white border border-slate-200"
      }
    >
      <h3 className="text-xl font-semibold mb-1">Summarize a lecture</h3>
      <p className={dark ? "text-sm text-slate-300 mb-6" : "text-sm text-slate-600 mb-6"}>
        Upload an audio file or paste a YouTube lecture link. We’ll turn it into clean study notes.
      </p>

      <form onSubmit={submit} className="grid grid-cols-2 gap-5">

        {/* Mode toggle */}
        <div className="col-span-2 flex gap-2">
          {["file", "youtube"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition
                ${
                  mode === m
                    ? "bg-indigo-600 text-white"
                    : dark
                    ? "bg-slate-700 text-white hover:bg-slate-600"
                    : "bg-white text-slate-700 border hover:bg-slate-50"
                }`}
            >
              {m === "file" ? "Upload audio" : "YouTube link"}
            </button>
          ))}
        </div>

        {/* Title */}
        <div>
          <label className="text-sm opacity-70">Lecture title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. DBMS – Indexing"
            className={`mt-1 w-full px-4 py-2 rounded-lg border ${
              dark
                ? "bg-slate-700 border-slate-600 text-white"
                : "bg-white border-slate-300"
            }`}
          />
        </div>

        {/* Summary Length */}
        <div>
          <label className="text-sm opacity-70">Summary length</label>
          <select
            value={summaryLength}
            onChange={(e) => setSummaryLength(e.target.value)}
            className={`mt-1 w-full px-4 py-2 rounded-lg border ${
              dark
                ? "bg-slate-700 border-slate-600 text-white"
                : "bg-white border-slate-300"
            }`}
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>

        {/* File / YouTube input */}
        {mode === "file" ? (
          <div className="col-span-2">
            <input
              type="file"
              id="audio-upload"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
            />
            <label
              htmlFor="audio-upload"
              className={`block w-full text-center px-6 py-6 rounded-xl cursor-pointer border-dashed border-2 transition
                ${
                  dark
                    ? "border-slate-600 hover:bg-slate-700"
                    : "border-slate-300 hover:bg-slate-50"
                }`}
            >
              📁 Click to upload audio
              {file && (
                <div className="mt-2 text-xs opacity-70">
                  Selected: {file.name}
                </div>
              )}
            </label>
          </div>
        ) : (
          <div className="col-span-2">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className={`w-full px-4 py-3 rounded-lg border ${
                dark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300"
              }`}
            />
          </div>
        )}

        {/* Submit + Status */}
        <div className="col-span-2 space-y-3">
          <button
            disabled={isProcessing}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-60"
          >
            {isProcessing ? "Processing lecture..." : "Generate summary"}
          </button>

          {status && (
            <div className="text-sm opacity-70">{status}</div>
          )}

          {isProcessing && (
            <div className="w-full h-2 rounded bg-slate-300/20 overflow-hidden">
              <div
                className="h-2 bg-indigo-500 transition-all"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          )}
        </div>
      </form>
    </div>

    {/* RESULT SECTION (unchanged logic, cleaner container) */}
{result && (
  <div
    className={`rounded-2xl p-6 border space-y-6 ${
      dark
        ? "bg-slate-800 border-slate-700"
        : "bg-white border-slate-200"
    }`}
  >
    {/* Tabs */}
    <div className="flex gap-2">
      {[
        ["summary", "Summary"],
        ["points", "Key Points"],
        ["questions", "Questions"],
        ["transcript", "Transcript"],
      ].map(([key, label]) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition
            ${
              activeTab === key
                ? "bg-indigo-600 text-white"
                : dark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
        >
          {label}
        </button>
      ))}
    </div>

    {/* ================= TAB CONTENT ================= */}

    {/* SUMMARY */}
    {activeTab === "summary" && (
      <div>
        <h4 className="font-medium mb-2">Summary</h4>
        <div
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: highlightText(result.summary?.short || "", result.keywords || []),
          }}
        />
      </div>
    )}

    {/* KEY POINTS */}
    {activeTab === "points" && (
      <div>
        <h4 className="font-medium mb-2">Key Points</h4>
        <ul className="list-disc ml-5 space-y-2 text-sm">
          {extractKeyPointsFromText(
            result.summary?.short || result.full_transcript || "",
            result.keywords || [],
            10
          ).map((p, i) => (
            <li
              key={i}
              dangerouslySetInnerHTML={{
                __html: highlightText(p, result.keywords || []),
              }}
            />
          ))}
        </ul>
      </div>
    )}

    {/* QUESTIONS */}
    {activeTab === "questions" && result.questions?.length > 0 && (
      <div>
        <h4 className="font-medium mb-3">Practice Questions</h4>
        <div className="space-y-4">
          {result.questions.map((q, idx) => (
            <div key={idx} className="text-sm">
              <div className="font-semibold">
                Q{idx + 1}. {q.question}
              </div>
              {q.answer && (
                <div className="mt-1 text-xs text-emerald-500">
                  <span className="font-semibold">Answer:</span> {q.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* TRANSCRIPT */}
    {activeTab === "transcript" && (
      <div>
        <h4 className="font-medium mb-2">Transcript (preview)</h4>
<div
  className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
    dark
      ? "text-slate-200"
      : "text-slate-800"
  }`}
>
  {showFullTranscript
    ? result.full_transcript
    : result.full_transcript?.slice(0, 1200) + "..."}
</div>
<button
  onClick={() => setShowFullTranscript(v => !v)}
  className="mt-3 text-sm text-indigo-600 hover:underline"
>
  {showFullTranscript ? "Show less" : "View full transcript"}
</button>


      </div>
    )}
  </div>
)}

  </div>
);

}

// ---------- History ----------
function HistoryPage({ dark }) {
  const [showFavorites, setShowFavorites] = useState(false);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("Loading...");
  const user = getCurrentUser();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest"); // newest, oldest, title
  // const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    if (!user?.id) {
      setStatus("Please log in to see your lecture history.");
      return;
    }

    const url = `${API_BASE}/api/lectures?userId=${encodeURIComponent(user.id)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setItems(data);
        if (data.length === 0) {
          setStatus("No processed lectures yet. Try uploading a sample on Summarize page.");
        } else {
          setStatus("");
        }
      })
      .catch((err) => {
        console.error(err);
        setStatus("Failed to load history.");
      });
  }, [user]);

const filtered = useMemo(() => {
  let arr = [...items];

  if (showFavorites) {
    arr = arr.filter(it => it.isFavorite);
  }

  if (search.trim()) {
    const s = search.toLowerCase();
    arr = arr.filter(it =>
      (it.title || "").toLowerCase().includes(s) ||
      (it.lectureId || "").includes(s)
    );
  }

  if (sort === "newest") {
    arr.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  } else if (sort === "oldest") {
    arr.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
  } else if (sort === "title") {
    arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  return arr;
}, [items, search, sort, showFavorites]);


  async function handleDelete(lectureId) {
    if (!window.confirm("Delete this summary permanently?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Delete failed");
      }
      // remove locally
      setItems((prev) => prev.filter((it) => it.lectureId !== lectureId));
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  }
  async function toggleFavorite(lectureId, current) {
  try {
    await fetch(`${API_BASE}/api/lectures/${lectureId}/favorite`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !current }),
    });

    setItems(prev =>
      prev.map(it =>
        it.lectureId === lectureId
          ? { ...it, isFavorite: !current }
          : it
      )
    );
  } catch {
    alert("Failed to update favorite");
  }
}


return (
  <div className="space-y-6">

    {/* Header */}
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-semibold">
        Lecture history
      </h3>
    </div>

    {/* Controls */}
    <div
      className={
        dark
          ? "rounded-xl p-4 bg-slate-800 border border-slate-700 flex flex-wrap gap-3 items-center"
          : "rounded-xl p-4 bg-white border border-slate-200 flex flex-wrap gap-3 items-center"
      }
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded border w-64">
        <Search className="w-4 h-4 opacity-60" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lectures..."
          className="bg-transparent outline-none text-sm w-full"
        />
      </div>

      {/* Sort */}
      <div className="flex gap-2">
        <button
          onClick={() => setSort("newest")}
          className={`px-3 py-1 rounded text-sm ${
            sort === "newest"
              ? "bg-indigo-600 text-white"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          Newest
        </button>
        <button
          onClick={() => setSort("oldest")}
          className={`px-3 py-1 rounded text-sm ${
            sort === "oldest"
              ? "bg-indigo-600 text-white"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          Oldest
        </button>
        <button
          onClick={() => setSort("title")}
          className={`px-3 py-1 rounded text-sm ${
            sort === "title"
              ? "bg-indigo-600 text-white"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          Title
        </button>
      </div>

      {/* Favorites */}
      <button
        onClick={() => setShowFavorites(v => !v)}
        className={`ml-auto px-3 py-1 rounded text-sm flex items-center gap-1 ${
          showFavorites
            ? "bg-yellow-400 text-black"
            : "opacity-70 hover:opacity-100"
        }`}
      >
        <Star className="w-4 h-4" />
        Favorites
      </button>
    </div>

    {/* Loading */}
    {status && (
      <div className="space-y-3">
        <HistorySkeleton dark={dark} />
        <div className="text-sm opacity-60 animate-pulse">{status}</div>
      </div>
    )}

    {/* Empty favorites */}
    {!status && showFavorites && filtered.length === 0 && (
      <div className="text-sm opacity-60">
        ⭐ No favorite lectures yet
      </div>
    )}

    {/* List */}
    {!status && filtered.length > 0 && (
      <div className="space-y-3">
        {filtered.map(it => (
          <div
            key={it.lectureId}
            className={`group rounded-xl p-4 border transition hover:shadow-md ${
              dark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center">

              {/* Info */}
              <div>
                <div className="font-medium">{it.title}</div>
                <div className="text-xs opacity-60">
                  {formatDateISO(it.uploadedAt)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">

                {/* Favorite */}
                <button
                  onClick={() => toggleFavorite(it.lectureId, it.isFavorite)}
                >
                  <Star
                    className={`w-5 h-5 ${
                      it.isFavorite
                        ? "fill-yellow-400 text-yellow-400"
                        : "opacity-60"
                    }`}
                  />
                </button>

                {/* Open */}
                <Link
                  to={`/history/${it.lectureId}`}
                  className="text-indigo-600 text-sm"
                >
                  Open
                </Link>

                {/* Audio */}
                <a
                  href={`${API_BASE}/download_audio/${it.lectureId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 text-sm"
                >
                  Audio
                </a>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(it.lectureId)}
                  className="text-red-500 text-sm"
                >
                  Delete
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

}

function HistoryDetailPage({ dark }) {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/result/${id}`)
      .then((r) => r.json())
      .then((j) => setDoc(j))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
  if (doc?.title) setNewTitle(doc.title);
}, [doc]);
  if (loading) return <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-500"}>Loading...</div>;
  if (!doc) return <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-500"}>Not found...</div>;
  const summaryText = doc.summary?.short || "";
async function saveTitle() {
  await fetch(`${API_BASE}/api/lectures/${id}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: newTitle }),
  });
  setDoc({ ...doc, title: newTitle });
  setEditing(false);
}


const keyPointsArr = extractKeyPointsFromText(
  doc.summary?.short || doc.full_transcript || "",
  doc.keywords || [],
  8
);

const keyPointsText = keyPointsArr.map(p => `• ${p}`).join("\n");

const keywordsText = (doc.keywords || []).join(", ");

const questionsText = (doc.questions || [])
  .map((q, i) => `Q${i + 1}. ${q.question}${q.answer ? `\n   Answer: ${q.answer}` : ""}`)
  .join("\n\n");

const exportText = `
LECTURE TITLE
${doc.title || "Lecture Notes"}

========================
SUMMARY
========================
${summaryText}

========================
KEY POINTS
========================
${keyPointsText}

========================
KEYWORDS
========================
${keywordsText || "N/A"}

${questionsText ? `
========================
PRACTICE QUESTIONS
========================
${questionsText}
` : ""}
`.trim();


return (
  <div className="space-y-6">

    {/* Header */}
    <div className="flex items-start justify-between gap-4">
      {/* Title */}
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className={`px-3 py-2 border rounded-lg text-sm w-72 ${
              dark
                ? "bg-slate-700 text-white border-slate-600"
                : "bg-white text-slate-900 border-slate-300"
            }`}
          />
          <button onClick={saveTitle} className="text-sm text-indigo-600">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="text-sm opacity-60">
            Cancel
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 cursor-pointer"
          onDoubleClick={() => setEditing(true)}
          title="Double click to rename"
        >
          <h2 className="text-2xl font-semibold">
            {doc.title}
          </h2>
          <span
            onClick={() => setEditing(true)}
            className="opacity-60 hover:opacity-100"
          >
            ✏️
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`${API_BASE}/download_audio/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1 rounded border text-sm"
        >
          🎧 Audio
        </a>

        <button
          onClick={() => copyToClipboard(exportText)}
          className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
        >
          Copy
        </button>

        <button
          onClick={() => {
            const baseName = safeFileName(doc.title);
            downloadTxt(`${baseName}.txt`, exportText);
          }}
          className="px-3 py-1 rounded border text-sm"
        >
          TXT
        </button>

        <button
          onClick={() => {
            const baseName = safeFileName(doc.title);
            downloadPdf(`${baseName}.pdf`, exportText);
          }}
          className="px-3 py-1 rounded border text-sm"
        >
          PDF
        </button>
      </div>
    </div>

    {/* Summary + Keywords */}
    <div className="grid grid-cols-2 gap-4">
      <section
        className={`rounded-xl p-4 border ${
          dark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <h4 className="font-medium mb-2">Summary</h4>
        <div
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: highlightText(doc.summary?.short || "", doc.keywords || []),
          }}
        />
      </section>

      <section
        className={`rounded-xl p-4 border ${
          dark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <h4 className="font-medium mb-2">Keywords</h4>
        <div className="flex flex-wrap gap-2">
          {(doc.keywords || []).map(k => (
            <span
              key={k}
              className={`px-2 py-1 text-xs rounded ${
                dark
                  ? "bg-indigo-700 text-white"
                  : "bg-indigo-50 text-indigo-700"
              }`}
            >
              {k}
            </span>
          ))}
        </div>
      </section>
    </div>

    {/* Key Points */}
    <section
      className={`rounded-xl p-5 border ${
        dark
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-slate-200"
      }`}
    >
      <h4 className="font-medium mb-3">Key points</h4>
      <ul className="list-disc ml-5 space-y-2 text-sm">
        {extractKeyPointsFromText(
          doc.summary?.short || doc.full_transcript || "",
          doc.keywords || [],
          10
        ).map((p, i) => (
          <li
            key={i}
            dangerouslySetInnerHTML={{
              __html: highlightText(p, doc.keywords || []),
            }}
          />
        ))}
      </ul>
    </section>

    {/* Transcript */}
<section
  className={`rounded-xl p-5 border ${
    dark
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-slate-200"
  }`}
>
  <div className="flex items-center justify-between mb-2">
    <h4 className="font-medium">Transcript</h4>

    <button
      onClick={() => setShowFullTranscript(v => !v)}
      className="text-sm text-indigo-600 hover:underline"
    >
      {showFullTranscript ? "Show less" : "View full transcript"}
    </button>
  </div>

  <div
    className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
      dark ? "text-slate-200" : "text-slate-800"
    }`}
  >
    {showFullTranscript
      ? doc.full_transcript
      : doc.full_transcript?.slice(0, 1200) + "..."}
  </div>
</section>


    {/* Practice Questions */}
    {doc.questions && doc.questions.length > 0 && (
      <section
        className={`rounded-xl p-5 border ${
          dark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <h4 className="font-medium mb-3">Practice questions</h4>
        <div className="space-y-4">
          {doc.questions.map((q, idx) => (
            <div key={idx} className="text-sm">
              <div className="font-semibold">
                Q{idx + 1}. {q.question}
              </div>
              {q.answer && (
                <div className="mt-1 text-xs text-emerald-500">
                  <span className="font-semibold">Answer:</span> {q.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    )}
  </div>
);

}

function ProfilePage({ dark }) {
  const user = getCurrentUser();
  const [stats, setStats] = useState({ count: 0, total_words: 0, est_minutes: 0, joined: "" });

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_BASE}/api/user/${encodeURIComponent(user.id)}/stats`)
      .then((r) => r.json())
      .then((j) => {
        setStats({
          count: j.count || 0,
          total_words: j.total_words || 0,
          est_minutes: Math.round((j.count || 0) * 8 + (j.total_words || 0) / 300),
          joined: j.joined || "",
        });
      })
      .catch(() => {});
  }, [user]);

return (
  <div className="max-w-3xl space-y-6">

    {/* Header */}
    <div
      className={`rounded-xl p-6 border ${
        dark
          ? "bg-slate-800 border-slate-700 text-white"
          : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
          {user?.name?.[0]?.toUpperCase() || "U"}
        </div>

        {/* User Info */}
        <div>
          <div className="text-xl font-semibold">{user?.name}</div>
          <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-500"}>
            {user?.email}
          </div>
        </div>
      </div>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-3 gap-4">
      <div
        className={`p-4 rounded-xl border ${
          dark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="text-xs opacity-70">Summaries</div>
        <div className="text-2xl font-bold mt-1">{stats.count}</div>
      </div>

      <div
        className={`p-4 rounded-xl border ${
          dark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="text-xs opacity-70">Words summarized</div>
        <div className="text-2xl font-bold mt-1">{stats.total_words}</div>
      </div>

      <div
        className={`p-4 rounded-xl border ${
          dark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="text-xs opacity-70">Time saved</div>
        <div className="text-2xl font-bold mt-1">{stats.est_minutes} min</div>
      </div>
    </div>

    {/* Account Details */}
    <div
      className={`rounded-xl p-6 border ${
        dark
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-slate-200"
      }`}
    >
      <h4 className="font-medium mb-4">Account details</h4>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="opacity-60">Name</div>
          <div className="font-medium">{user?.name}</div>
        </div>

        <div>
          <div className="opacity-60">Email</div>
          <div className="font-medium">{user?.email}</div>
        </div>

        <div>
          <div className="opacity-60">Joined</div>
          <div className="font-medium">
            {stats.joined
              ? new Date(stats.joined).toLocaleDateString()
              : "—"}
          </div>
        </div>
      </div>
    </div>

  </div>
);

}

// ---------- App ----------
export default function App() {
  const [dark, setDarkState] = useState(getDarkMode());

  useEffect(() => {
    setDarkMode(dark);
  }, [dark]);

return (
  <Router>
    <div
      className={`min-h-screen transition-colors duration-300 ${
        dark ? "bg-slate-900" : "bg-slate-50"
      }`}
    >
      <Routes>
        <Route path="/signup" element={<SignupPage dark={dark} />} />
        <Route path="/login" element={<LoginPage dark={dark} />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Layout onToggleDark={(v) => setDarkState(v)} dark={dark}>
                <DashboardPage dark={dark} />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/summarize"
          element={
            <PrivateRoute>
              <Layout onToggleDark={(v) => setDarkState(v)} dark={dark}>
                <SummarizePage dark={dark} />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/history"
          element={
            <PrivateRoute>
              <Layout onToggleDark={(v) => setDarkState(v)} dark={dark}>
                <HistoryPage dark={dark} />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/history/:id"
          element={
            <PrivateRoute>
              <Layout onToggleDark={(v) => setDarkState(v)} dark={dark}>
                <HistoryDetailPage dark={dark} />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Layout onToggleDark={(v) => setDarkState(v)} dark={dark}>
                <ProfilePage dark={dark} />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center text-sm opacity-60">
              Page not found
            </div>
          }
        />
      </Routes>
    </div>
  </Router>
);

}
