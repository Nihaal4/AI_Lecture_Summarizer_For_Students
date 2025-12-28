/* Full App.jsx with theme fixed — top-level `dark` state passed to all pages/components.
   This file is the same as the version you had but with the key fix:
   -> No component reads getDarkMode() on its own; every component uses the `dark` prop.
   This guarantees immediate re-render on toggle.
*/

import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { Bell, LogOut, Home, FileText, Clock, User, Sun, Moon, Trash2, Search, SortAsc, SortDesc } from "lucide-react";

// ---------- Config ----------
const AUTH_KEY = "ls_auth_user";
const DARK_KEY = "ls_dark_mode";
const API_BASE = "http://127.0.0.1:5000"; // Flask backend
// ---------- Export helpers ----------
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
  const lines = doc.splitTextToSize(content, 180);
  doc.text(lines, 10, 10);
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

// ---------- Utility (frontend) ----------
function formatDateISO(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function highlightText(text = "", keywords = []) {
  if (!text) return text;
  if (!keywords || keywords.length === 0) return text;

  // sort keywords by length desc to avoid partial overlaps
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  // escape for regex
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let out = text;
  sorted.forEach((k) => {
    const re = new RegExp(`(${esc(k)})`, "gi");
    out = out.replace(re, "<mark class='px-1 py-0 rounded bg-yellow-200 dark:bg-yellow-600 text-black dark:text-white'>$1</mark>");
  });

  return out;
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
  return (
    <Link
      to={to}
      className={
        dark
          ? "flex items-center gap-3 px-3 py-2 rounded transition-colors hover:bg-slate-700"
          : "flex items-center gap-3 px-3 py-2 rounded transition-colors hover:bg-slate-100 hover:text-slate-900"
      }
    >
      <Icon
        className={
          dark
            ? "w-5 h-5 text-slate-300"
            : "w-5 h-5 text-slate-600"
        }
      />
      <span
        className={
          dark
            ? "text-sm text-white"
            : "text-sm text-slate-700"
        }
      >
        {label}
      </span>
    </Link>
  );
}


function Layout({ children, onToggleDark, dark }) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  return (
    <div className={`min-h-screen text-base md:text-xl ${dark ? "bg-slate-900 text-white" : "bg-white text-slate-800"}`}>
      <div className="max-w-6xl mx-auto p-6 grid grid-cols-12 gap-6">
        <aside className={dark ? "col-span-3 bg-slate-800 rounded-2xl p-4 border border-slate-700 text-white" : "col-span-3 bg-white rounded-2xl p-4 border border-slate-200 text-slate-900"}>
          <div className="mb-6">
            <Brand dark={dark} />
          </div>

          <nav className="flex flex-col gap-1">
            <NavItem to="/dashboard" icon={Home} label="Home" dark={dark} />
            <NavItem to="/summarize" icon={FileText} label="Summarize" dark={dark} />
            <NavItem to="/history" icon={Clock} label="History" dark={dark} />
            <NavItem to="/profile" icon={User} label="Profile" dark={dark} />
          </nav>

          <div className={`mt-6 border-t pt-4 ${dark ? "border-slate-700" : "border-slate-200"}`}>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className={dark ? "w-full flex items-center gap-2 px-3 py-2 rounded-md bg-red-800 text-red-200 hover:bg-red-700" : "w-full flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100"}
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>

        <main className="col-span-9">
          <div className="flex items-center justify-between mb-6">
            <div className={dark ? "text-2xl font-semibold text-white" : "text-2xl font-semibold text-slate-900"}>
              Welcome, <span className="capitalize">{user?.name || "Student"}</span>
            </div>
            <div className="flex items-center gap-4">
              <Bell className={dark ? "w-5 h-5 text-slate-300" : "w-5 h-5 text-slate-500"} />
              <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>{user?.email}</div>

              <button
                title="Toggle dark mode"
                onClick={() => onToggleDark(!dark)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

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
    <div className={dark ? "min-h-screen flex items-center justify-center bg-slate-900 p-6" : "min-h-screen flex items-center justify-center bg-slate-50 p-6"}>
      <div className={dark ? "w-full max-w-xl bg-slate-800 rounded-2xl shadow p-8 text-white" : "w-full max-w-xl bg-white rounded-2xl shadow p-8 text-slate-900"}>
        <h2 className="text-2xl font-semibold mb-2">Create your account</h2>
        <p className={dark ? "text-sm text-slate-300 mb-6" : "text-sm text-slate-500 mb-6"}>
          Sign up to generate summaries from lecture recordings.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 border rounded-lg bg-slate-700 text-white border-slate-600" : "w-full mt-1 px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300"}
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 border rounded-lg bg-slate-700 text-white border-slate-600" : "w-full mt-1 px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300"}
              placeholder="you@college.edu"
              required
            />
          </div>
          <div>
            <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 border rounded-lg bg-slate-700 text-white border-slate-600" : "w-full mt-1 px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300"}
              placeholder="Choose a password"
              required
            />
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}

          <div className="flex items-center justify-between">
            <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium">
              Create account
            </button>
            <Link to="/login" className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
              Already have an account?
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
    <div className={dark ? "min-h-screen flex items-center justify-center bg-slate-900 p-6" : "min-h-screen flex items-center justify-center bg-slate-50 p-6"}>
      <div className={dark ? "w-full max-w-md bg-slate-800 rounded-2xl shadow p-8 text-white" : "w-full max-w-md bg-white rounded-2xl shadow p-8 text-slate-900"}>
        <h2 className="text-2xl font-semibold mb-2">Welcome back</h2>
        <p className={dark ? "text-sm text-slate-300 mb-6" : "text-sm text-slate-500 mb-6"}>
          Log in to access your lecture summaries.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 border rounded-lg bg-slate-700 text-white border-slate-600" : "w-full mt-1 px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300"}
              placeholder="you@college.edu"
              required
            />
          </div>
          <div>
            <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={dark ? "w-full mt-1 px-3 py-2 border rounded-lg bg-slate-700 text-white border-slate-600" : "w-full mt-1 px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300"}
              placeholder="Your password"
              required
            />
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}

          <div className="flex items-center justify-between">
            <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium">
              Log in
            </button>
            <Link to="/signup" className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
              Create account
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
        const estMinutesSaved = Math.round((count * 8) + totalWords / 300);
        setStats({ count, totalWords, estMinutesSaved });
      })
      .catch(() => {});
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card
          title="Quick Summarize"
          desc="Upload a short lecture clip or give a YouTube link and get a concise summary and study aids."
          linkTo="/summarize"
          dark={dark}
        />
        <Card
          title="History"
          desc="All your processed lectures and exports. Search, sort and delete from here."
          linkTo="/history"
          dark={dark}
        />
        <div className={dark ? "p-4 rounded-lg shadow-sm bg-slate-800 border-slate-700 text-white" : "p-4 rounded-lg shadow-sm bg-white border text-slate-900"}>
          <div className="text-sm font-semibold">Your stats</div>
          <div className="mt-3">
            <div className="text-2xl font-bold">{stats.count}</div>
            <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>summaries completed</div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-semibold">{stats.estMinutesSaved} min</div>
            <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>estimated time saved</div>
          </div>
        </div>
      </div>

      <div className={dark ? "rounded-lg p-6 border bg-slate-800 border-slate-700 text-white" : "rounded-lg p-6 border bg-gradient-to-r from-indigo-50 to-white border text-slate-900"}>
        <h3 className="text-lg font-semibold mb-2">Getting started</h3>
        <p className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
          Upload a lecture recording (MP3/WAV) or provide a YouTube classroom link on the
          Summarize page. The app will transcribe, summarize and generate keywords & questions.
          For best demo performance, try using 2–10 minute recordings to get results quickly.
        </p>
      </div>
    </div>
  );
}

function Card({ title, desc, linkTo, dark }) {
  return (
    <div className={dark ? "p-4 rounded-lg border shadow-sm bg-slate-800 border-slate-700 text-white" : "p-4 rounded-lg border shadow-sm bg-white border-slate-200 text-slate-900"}>
      <div>
        <div className="text-sm text-indigo-600 font-semibold">{title}</div>
        <div className={dark ? "mt-2 text-sm text-slate-300" : "mt-2 text-sm text-slate-600"}>{desc}</div>
      </div>
      <div className="mt-4">
        <Link to={linkTo} className={dark ? "text-indigo-300 text-sm font-medium" : "text-indigo-600 text-sm font-medium"}>
          Open →
        </Link>
      </div>
    </div>
  );
}

// ---------- Summarize Page (with progress bar + file/YT toggle) ----------
function SummarizePage({ dark }) {
  const [mode, setMode] = useState("file"); // "file" | "youtube"
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [lectureId, setLectureId] = useState(null);


  const [isProcessing, setIsProcessing] = useState(false);
  const [viewKeyPoints, setViewKeyPoints] = useState(false);

const submit = async (e) => {
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
  fd.append(
    "title",
    title || (mode === "file" ? file?.name || "Lecture" : "YouTube lecture")
  );

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

      // Show real backend progress
      setStatus(data.progress || data.status);

      if (data.status === "done" || data.progress?.startsWith("Failed")) {
        setResult(data);
        setIsProcessing(false);
        clearInterval(poller);
      }
    } catch (e) {
      setStatus("Error while fetching progress");
    }
  }, 2000);

  return () => clearInterval(poller);
}, [lectureId]);


  return (
    <div className={dark ? "bg-slate-800 p-6 rounded-lg border border-slate-700 text-white" : "bg-white p-6 rounded-lg border border-slate-200 text-slate-900"}>
      <h3 className="text-lg font-semibold mb-2">Summarize a lecture</h3>
      <p className={dark ? "text-sm text-slate-300 mb-4" : "text-sm text-slate-600 mb-4"}>
        Either upload an MP3/WAV file or paste a YouTube lecture link. For best results, use 2–10 minute recordings.
      </p>

      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        {/* Mode toggle */}
        <div className="col-span-2 flex gap-3 mb-2">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`px-3 py-1 rounded border text-sm ${
              mode === "file"
                ? "bg-indigo-600 text-white border-indigo-600"
                : dark
                ? "bg-slate-700 text-white border-slate-600"
                : "bg-white text-slate-700 border-slate-300"
            }`}
          >
            Upload audio file
          </button>
          <button
            type="button"
            onClick={() => setMode("youtube")}
            className={`px-3 py-1 rounded border text-sm ${
              mode === "youtube"
                ? "bg-indigo-600 text-white border-indigo-600"
                : dark
                ? "bg-slate-700 text-white border-slate-600"
                : "bg-white text-slate-700 border-slate-300"
            }`}
          >
            YouTube link
          </button>
        </div>

        {/* Title */}
        <div>
          <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>Lecture title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`mt-1 w-full px-3 py-2 border rounded ${dark ? "bg-slate-700 text-white border-slate-600" : "bg-white text-slate-900 border-slate-300"}`}
            placeholder="e.g. Data Structures - Recursion"
          />
        </div>

        {/* File OR YouTube input */}
        {mode === "file" ? (
          <div>
            <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>Audio file</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="mt-1 w-full"
            />
          </div>
        ) : (
          <div>
            <label className={dark ? "block text-sm text-slate-300" : "block text-sm text-slate-600"}>YouTube lecture URL</label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className={`mt-1 w-full px-3 py-2 border rounded ${dark ? "bg-slate-700 text-white border-slate-600" : "bg-white text-slate-900 border-slate-300"}`}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
        )}

        <div className="col-span-2 flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60"
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Summarize"}
            </button>
            <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-500"}>{status}</div>
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div className="w-full">
              <div className={dark ? "w-full h-2 rounded bg-slate-700 overflow-hidden" : "w-full h-2 rounded bg-slate-200 overflow-hidden"}>
                <div className="h-2 rounded bg-indigo-500 w-1/2" />
              </div>
              <div className={dark ? "text-xs mt-1 text-slate-300" : "text-xs mt-1 text-slate-500"}>
Processing step: {status}

              </div>
            </div>
          )}
        </div>
      </form>

{result && (() => {
  const summaryText = result.summary?.short || "";
  const keyPointsArr = extractKeyPointsFromText(
    result.summary?.short || result.full_transcript || "",
    result.keywords || [],
    8
  );
  const keyPointsText = keyPointsArr.map(p => `• ${p}`).join("\n");

const keywordsText = (result.keywords || []).join(", ");

const questionsText = (result.questions || [])
  .map((q, i) => `Q${i + 1}. ${q.question}${q.answer ? `\n   Answer: ${q.answer}` : ""}`)
  .join("\n\n");

const exportText = `
LECTURE TITLE
${result.title || "Lecture Notes"}

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
    <div className="mt-6 grid grid-cols-2 gap-4">

          {/* View toggle */}
          <div className="col-span-2 flex items-center justify-between">
            <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>Viewing:</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewKeyPoints(false)}
                className={`px-3 py-1 rounded ${!viewKeyPoints ? "bg-indigo-600 text-white" : dark ? "bg-slate-700 text-white" : "bg-white text-slate-900"}`}
              >
                View Summary
              </button>
              <button
                onClick={() => setViewKeyPoints(true)}
                className={`px-3 py-1 rounded ${viewKeyPoints ? "bg-indigo-600 text-white" : dark ? "bg-slate-700 text-white" : "bg-white text-slate-900"}`}
              >
                Key Points
              </button>
            </div>
          </div>
          {/* ⭐ Export Actions */}
<div className="col-span-2 flex justify-end gap-2 mb-2">
  <button
    onClick={() => copyToClipboard(exportText)}
    className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
  >
    Copy
  </button>

  <button
    onClick={() => downloadTxt("lecture-notes.txt", exportText)}
    className="px-3 py-1 rounded border text-sm"
  >
    TXT
  </button>

  <button
    onClick={() => downloadPdf("lecture-notes.pdf", exportText)}
    className="px-3 py-1 rounded border text-sm"
  >
    PDF
  </button>
</div>


          {/* Summary or Key Points */}
          <div className={dark ? "bg-slate-800 p-4 rounded border border-slate-700 col-span-2 text-white" : "bg-white p-4 rounded border border-slate-200 col-span-2 text-slate-900"}>
            <h4 className="font-medium">{viewKeyPoints ? "Key points" : "Short summary"}</h4>
            {!viewKeyPoints ? (
              <div className="text-sm mt-2" dangerouslySetInnerHTML={{ __html: highlightText(result.summary?.short || "", result.keywords || []) }} />
            ) : (
              <div className="mt-2">
                <ul className="list-disc ml-5 space-y-2 text-sm">
                  {extractKeyPointsFromText(result.summary?.short || result.full_transcript || "", result.keywords || [], 8).map((p, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: highlightText(p, result.keywords || []) }} />
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Keywords */}
          <div className={dark ? "bg-slate-800 p-4 rounded border border-slate-700 text-white" : "bg-white p-4 rounded border border-slate-200 text-slate-900"}>
            <h4 className="font-medium">Keywords</h4>
            <div className="flex gap-2 flex-wrap mt-2">
              {(result.keywords || []).map((k) => (
                <span key={k} className={dark ? "px-2 py-1 text-xs bg-indigo-700 rounded text-white" : "px-2 py-1 text-xs bg-indigo-50 rounded text-indigo-700"}>
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div className={dark ? "col-span-2 bg-slate-800 p-4 rounded border border-slate-700 text-white" : "col-span-2 bg-white p-4 rounded border border-slate-200 text-slate-900"}>
            <h4 className="font-medium">Transcript (first 1000 chars)</h4>
            <pre className={dark ? "mt-2 p-3 border rounded bg-slate-900 max-h-64 overflow-auto text-sm text-white" : "mt-2 p-3 border rounded bg-slate-50 max-h-64 overflow-auto text-sm text-slate-900"}>{result.full_transcript?.slice(0, 1000)}</pre>
          </div>

          {/* Predicted questions */}
          {result.questions && result.questions.length > 0 && (
            <div className={dark ? "col-span-2 bg-slate-800 p-4 rounded border border-slate-700 text-white" : "col-span-2 bg-white p-4 rounded border border-slate-200 text-slate-900"}>
              <h4 className="font-medium">Predicted practice questions</h4>
              <div className="mt-3 space-y-4">
                {result.questions.map((q, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="font-semibold">
                      Q{idx + 1}. {q.question}
                    </div>

                    {q.answer && (
                      <div className={dark ? "mt-1 text-xs text-emerald-300" : "mt-1 text-xs text-emerald-700"}>
                        <span className="font-semibold">Answer:</span> {q.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        );
})()}

    </div>
  );
}

// ---------- History ----------
function HistoryPage({ dark }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("Loading...");
  const user = getCurrentUser();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest"); // newest, oldest, title
  const [filtered, setFiltered] = useState([]);

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

  useEffect(() => {
    // filter & sort client-side
    let arr = [...items];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((it) => (it.title || "").toLowerCase().includes(s) || (it.lectureId || "").includes(s));
    }
    if (sort === "newest") {
      arr.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    } else if (sort === "oldest") {
      arr.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
    } else if (sort === "title") {
      arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    setFiltered(arr);
  }, [items, search, sort]);

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

  return (
    <div>
      <h3 className={dark ? "text-lg font-semibold mb-3 text-white" : "text-lg font-semibold mb-3 text-slate-900"}>Processed lectures</h3>

      <div className="flex items-center gap-3 mb-3">
        <div className={dark ? "flex items-center gap-2 border rounded p-2 bg-slate-800 border-slate-700" : "flex items-center gap-2 border rounded p-2 bg-white border-slate-200"}>
          <Search className={dark ? "w-4 h-4 text-slate-300" : "w-4 h-4 text-slate-500"} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or id..." className={dark ? "bg-transparent outline-none text-sm text-white" : "bg-transparent outline-none text-sm text-slate-800"} />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setSort("newest")} className={sort === "newest" ? "px-3 py-1 rounded bg-indigo-600 text-white" : dark ? "px-3 py-1 rounded bg-slate-700 text-white" : "px-3 py-1 rounded bg-white text-slate-800"}><SortDesc className="w-4 h-4 inline-block mr-1" />Newest</button>
          <button onClick={() => setSort("oldest")} className={sort === "oldest" ? "px-3 py-1 rounded bg-indigo-600 text-white" : dark ? "px-3 py-1 rounded bg-slate-700 text-white" : "px-3 py-1 rounded bg-white text-slate-800"}><SortAsc className="w-4 h-4 inline-block mr-1" />Oldest</button>
          <button onClick={() => setSort("title")} className={sort === "title" ? "px-3 py-1 rounded bg-indigo-600 text-white" : dark ? "px-3 py-1 rounded bg-slate-700 text-white" : "px-3 py-1 rounded bg-white text-slate-800"}>Title</button>
        </div>
      </div>

      {status && <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-500"}>{status}</div>}

      {!status && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((it) => (
            <div
              key={it.lectureId}
              className={dark ? "p-3 border rounded flex justify-between items-center bg-slate-800 border-slate-700 text-white" : "p-3 border rounded flex justify-between items-center bg-white border-slate-200 text-slate-900"}
            >
              <div>
                <div className="font-medium">{it.title}</div>
                <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                  {formatDateISO(it.uploadedAt)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to={`/history/${it.lectureId}`}
                  className={dark ? "text-indigo-300 text-sm" : "text-indigo-600 text-sm"}
                >
                  Open
                </Link>
                <button onClick={() => handleDelete(it.lectureId)} className={dark ? "flex items-center gap-2 text-sm text-red-300" : "flex items-center gap-2 text-sm text-red-600"}>
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryDetailPage({ dark }) {
  const path = window.location.pathname;
  const id = path.split("/").pop();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/result/${id}`)
      .then((r) => r.json())
      .then((j) => setDoc(j))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-500"}>Loading...</div>;
  if (!doc) return <div className={dark ? "text-sm text-slate-300" : "text-sm text-slate-500"}>Not found...</div>;
  const summaryText = doc.summary?.short || "";

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
    <div>
      <div className="flex items-center justify-between mb-3">
  <h3 className={dark ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
    {doc.title}
  </h3>

  <div className="flex gap-2">
    <button
      onClick={() => copyToClipboard(exportText)}
      className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
    >
      Copy
    </button>

    <button
      onClick={() => downloadTxt("lecture-notes.txt", exportText)}
      className="px-3 py-1 rounded border text-sm"
    >
      TXT
    </button>

    <button
      onClick={() => downloadPdf("lecture-notes.pdf", exportText)}
      className="px-3 py-1 rounded border text-sm"
    >
      PDF
    </button>
  </div>
</div>


      <div className="grid grid-cols-2 gap-4">
        <div className={dark ? "bg-slate-800 p-4 rounded border border-slate-700 text-white" : "bg-white p-4 rounded border border-slate-200 text-slate-900"}>
          <h4 className="font-medium">Short summary</h4>
          <div className="text-sm mt-2" dangerouslySetInnerHTML={{ __html: highlightText(doc.summary?.short || "", doc.keywords || []) }} />
        </div>

        <div className={dark ? "bg-slate-800 p-4 rounded border border-slate-700 text-white" : "bg-white p-4 rounded border border-slate-200 text-slate-900"}>
          <h4 className="font-medium">Keywords</h4>
          <div className="flex gap-2 flex-wrap mt-2">
            {(doc.keywords || []).map((k) => (
              <span key={k} className={dark ? "px-2 py-1 text-xs bg-indigo-700 rounded text-white" : "px-2 py-1 text-xs bg-indigo-50 rounded text-indigo-700"}>
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className={dark ? "font-medium text-white" : "font-medium text-slate-900"}>Transcript (first 2000 chars)</h4>

        <pre className={dark ? "mt-2 p-3 border rounded bg-slate-900 max-h-96 overflow-auto text-sm text-white" : "mt-2 p-3 border rounded bg-slate-50 max-h-96 overflow-auto text-sm text-slate-900"}>
          {doc.full_transcript?.slice(0, 2000)}
        </pre>

        <div className="mt-4">
          <h4 className={dark ? "font-medium text-white" : "font-medium text-slate-900"}>Key points</h4>
          <div className={dark ? "mt-2 p-4 rounded border bg-slate-800 border-slate-700 text-white" : "mt-2 p-4 rounded border bg-white border-slate-200 text-slate-900"}>
            <ul className="list-disc ml-5 space-y-2 text-sm">
              {extractKeyPointsFromText(doc.summary?.short || doc.full_transcript || "", doc.keywords || [], 10).map((p, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: highlightText(p, doc.keywords || []) }} />
              ))}
            </ul>
          </div>
        </div>
      </div>

      {doc.questions && doc.questions.length > 0 && (
        <div className={dark ? "mt-6 bg-slate-800 p-4 rounded border border-slate-700 text-white" : "mt-6 bg-white p-4 rounded border border-slate-200 text-slate-900"}>
          <h4 className="font-medium">Predicted practice questions</h4>
          <div className="mt-3 space-y-4">
            {doc.questions.map((q, idx) => (
              <div key={idx} className="text-sm">
                <div className="font-semibold">
                  Q{idx + 1}. {q.question}
                </div>

                {q.answer && (
                  <div className={dark ? "mt-1 text-xs text-emerald-300" : "mt-1 text-xs text-emerald-700"}>
                    <span className="font-semibold">Answer:</span> {q.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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
    <div className={dark ? "bg-slate-800 p-6 rounded-lg border border-slate-700 text-white max-w-2xl" : "bg-white p-6 rounded-lg border border-slate-200 text-slate-900 max-w-2xl"}>
      <h3 className="text-lg font-semibold">Profile</h3>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>Name</div>
          <div className="text-sm font-medium">{user?.name}</div>
        </div>
        <div>
          <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>Email</div>
          <div className="text-sm font-medium">{user?.email}</div>
        </div>

        <div>
          <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>Joined</div>
          <div className="text-sm font-medium">{stats.joined ? new Date(stats.joined).toLocaleDateString() : "—"}</div>
        </div>

        <div>
          <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>Summaries</div>
          <div className="text-sm font-medium">{stats.count}</div>
        </div>

        <div>
          <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>Total words summarized</div>
          <div className="text-sm font-medium">{stats.total_words}</div>
        </div>

        <div>
          <div className={dark ? "text-xs text-slate-300" : "text-xs text-slate-500"}>Estimated time saved</div>
          <div className="text-sm font-medium">{stats.est_minutes} min</div>
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
    setDarkState(dark);
  }, [dark]);

  return (
    <Router>
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

        {/* fallback */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center">
              Page not found
            </div>
          }
        />
      </Routes>
    </Router>
  );
}
