# app.py

"""
LectureSummarizer backend (Flask)
Endpoints:
 - POST /api/signup        -> create user
 - POST /api/login         -> login user
 - GET  /api/lectures      -> list lectures (optionally by userId)
 - DELETE /api/lectures/<lectureId> -> delete lecture (removes DB doc, result JSON, audio file)
 - POST /upload            -> accept audio file OR YouTube URL + title, return lectureId
 - GET  /result/<id>       -> return full JSON result for lectureId
 - GET  /download_audio/<id> -> download original audio
 - GET  /api/user/<id>/stats -> returns user stats (count, total_words, joined)
"""
import threading
import os
import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import List

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

from pymongo import MongoClient
from groq import Groq
from yt_dlp import YoutubeDL

# ML libs
import whisper
from transformers import pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

# NLP helpers
import nltk
from nltk.tokenize import sent_tokenize

# ---------- NLTK setup ----------
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt")

# ---------- Groq client ----------
groq_client = Groq()  # expects GROQ_API_KEY in your environment

# ---------- Config ----------
UPLOAD_DIR = Path("uploads")
RESULTS_DIR = Path("results")
ALLOWED_EXT = {"mp3", "wav", "m4a", "mp4", "ogg"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ---------- MongoDB ----------
MONGO_URI = "mongodb://localhost:27017"  # change to Atlas URI if needed
client = MongoClient(MONGO_URI)
db = client["lecture_summarizer_db"]

users_col = db["users"]
lectures_col = db["lectures"]

# ---------- Load ML models ----------
print("Loading Whisper model (this may take a while on first run)...")
whisper_model = whisper.load_model("small")

print("Loading summarizer (T5-small)...")
summarizer = pipeline(
    "summarization",
    model="t5-small",
    tokenizer="t5-small",
    device=-1,  # CPU; change if GPU available
)

# ---------- Flask app ----------
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 600 * 1024 * 1024  # 600 MB
CORS(app, resources={r"/*": {"origins": "*"}})


# ---------- Utility functions ----------

def update_progress(lecture_id: str, progress: str):
    fp = RESULTS_DIR / f"{lecture_id}.json"
    if not fp.exists():
        return

    with open(fp, "r+", encoding="utf-8") as f:
        data = json.load(f)
        data["progress"] = progress
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

def process_lecture_background(
    lecture_id: str,
    title: str,
    saved_path: Path,
    user_id: str | None,
    summary_length: str
):
    try:
        update_progress(lecture_id, "Transcribing audio")
        trans = transcribe_audio(saved_path)
        full_text = trans.get("text", "")
        segments = trans.get("segments", [])

        update_progress(lecture_id, "Summarizing lecture")
        summary = summarize_long_text(full_text, summary_length)

        update_progress(lecture_id, "Extracting keywords")
        seg_texts = [s.get("text", "") for s in segments if s.get("text")]
        keywords = extract_keywords_tfidf(seg_texts or [full_text])

        update_progress(lecture_id, "Generating questions")
        questions = generate_questions_ai(summary, how_many=15)

        final_doc = {
            "lectureId": lecture_id,
            "title": title,
            "uploadedAt": datetime.utcnow().isoformat() + "Z",
            "audioPath": str(saved_path),
            "status": "done",
            "progress": "Completed",
            "transcript": segments,
            "full_transcript": full_text,
            "summary": {"short": summary},
            "keywords": keywords,
            "questions": questions,
        }

        lectures_col.insert_one({
    "lectureId": lecture_id,
    "userId": user_id,
    "title": title,
    "uploadedAt": final_doc["uploadedAt"],
    "audioPath": str(saved_path),
    "summary": final_doc["summary"],
    "keywords": keywords,
    "questions": questions,
    "isFavorite": False,   # ⭐ ADD THIS
})


        with open(RESULTS_DIR / f"{lecture_id}.json", "w", encoding="utf-8") as f:
            json.dump(final_doc, f, indent=2)

    except Exception as e:
        update_progress(lecture_id, f"Failed: {str(e)}")

def allowed_file(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[-1].lower() in ALLOWED_EXT
    )


def save_uploaded_file(storage_file, dest_dir: Path) -> Path:
    filename = secure_filename(storage_file.filename)
    dest = dest_dir / f"{uuid.uuid4().hex}_{filename}"
    storage_file.save(dest)
    return dest


def download_youtube_audio(youtube_url: str, dest_dir: Path) -> Path:
    """
    Download audio from a YouTube URL as MP3 into dest_dir.
    Returns the local file path.
    """
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(dest_dir / "%(id)s.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "quiet": True,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)
        audio_path = dest_dir / f"{info['id']}.mp3"
        return audio_path


def transcribe_audio(path: str) -> dict:
    """
    Run whisper transcription. Returns the raw whisper result (text + segments).
    """
    result = whisper_model.transcribe(str(path))
    return result  # keys: text, segments, language, etc.


def chunk_text_by_sentences(text: str, max_sentences_per_chunk: int = 40) -> List[str]:
    sents = sent_tokenize(text)
    chunks = []
    for i in range(0, len(sents), max_sentences_per_chunk):
        chunk = " ".join(sents[i : i + max_sentences_per_chunk])
        chunks.append(chunk)
    return chunks


def summarize_long_text(text: str, summary_length: str) -> str:
    length_map = {
    "short": 100,
    "medium": 180,
    "detailed": 300,
    }
    max_len = length_map.get(summary_length, 180)

    if not text or not text.strip():
        return ""

    chunks = chunk_text_by_sentences(text, max_sentences_per_chunk=40)

    small_summaries = []
    for c in chunks:
        try:
            out = summarizer(
    c,
    max_length=max_len,
    min_length=max(30, max_len // 3),
    truncation=True
)

            small_summaries.append(out[0]["summary_text"])
        except Exception:
            small_summaries.append(c[:600])

    combined = " ".join(small_summaries)
    if len(combined.split()) > max_len * 1.5:
        try:
            final = summarizer(
            combined,
            max_length=max_len,
            min_length=max(40, max_len // 3),
            truncation=True
            )
            return final[0]["summary_text"]
        except Exception:
            return combined[:1500]
    else:
        return combined


def extract_keywords_tfidf(texts: List[str], top_k: int = 8) -> List[str]:
    if not texts:
        return []

    doc = " ".join(texts)
    vect = TfidfVectorizer(
        stop_words="english",
        max_features=2000,
        token_pattern=r"(?u)\b[A-Za-z][A-Za-z]+\b",
    )
    X = vect.fit_transform([doc])
    feature_array = vect.get_feature_names_out()
    tfidf_sorting = X.toarray().flatten().argsort()[::-1]

    top_n = tfidf_sorting[: top_k * 5]
    candidates = [feature_array[idx] for idx in top_n]

    seen = set()
    keywords = []
    for w in candidates:
        wl = w.lower()
        if wl not in seen:
            keywords.append(w)
            seen.add(wl)
        if len(keywords) >= top_k:
            break
    return keywords


def generate_questions_ai(summary: str, how_many: int = 15) -> List[dict]:
    """
    Use Groq Llama 3.1 to generate ONLY short-answer questions (no MCQ).
    Each question will have a simple 1–2 sentence answer.
    Default changed to 15.
    """
    prompt = f"""
You are an exam question generator for college students.

Given this lecture summary, generate {how_many} good, conceptual **short-answer** questions.

Requirements:
- Generate ONLY short-answer questions (NO MCQs, NO options).
- Each question should test a different important concept or detail.
- For every question, give a simple, direct answer in 1–2 sentences.
- KEEP THE OUTPUT STRICTLY IN VALID JSON.

Lecture summary:
\"\"\"{summary}\"\"\"


Respond ONLY in valid JSON with this structure:

{{
  "short_answer": [
    {{
      "question": "Question 1?",
      "answer": "Short, simple answer 1."
    }},
    {{
      "question": "Question 2?",
      "answer": "Short, simple answer 2."
    }}
  ]
}}
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        content = completion.choices[0].message.content.strip()
        data = json.loads(content)
    except Exception as e:
        print("Groq error or JSON parse error:", e)
        return []

    questions: List[dict] = []

    # Short-answer questions only
    for item in data.get("short_answer", []):
        if isinstance(item, str):
            q_text = item
            ans_text = ""
        else:
            q_text = item.get("question", "")
            ans_text = item.get("answer", "")
        if q_text:
            questions.append(
                {
                    "type": "short",
                    "question": q_text,
                    "answer": ans_text,
                }
            )
    return questions


def find_user_by_email(email: str):
    return users_col.find_one({"email": email})


# ---------- Auth endpoints ----------
@app.route("/api/signup", methods=["POST"])
def api_signup():
    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if find_user_by_email(email):
        return jsonify({"error": "User already exists"}), 400

    hashed = generate_password_hash(password)

    user_doc = {
        "name": name,
        "email": email,
        "password": hashed,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    res = users_col.insert_one(user_doc)

    return jsonify(
        {
            "id": str(res.inserted_id),
            "name": name,
            "email": email,
        }
    ), 201


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(force=True)
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    user = find_user_by_email(email)
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify(
        {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
        }
    ), 200


@app.route("/api/lectures", methods=["GET"])
def api_lectures():
    """
    List lectures. If ?userId=<id> is provided, filter for that user.
    Otherwise return all (for admin/testing).
    """
    user_id = request.args.get("userId")
    query = {}
    if user_id:
        query["userId"] = user_id

    cursor = lectures_col.find(query).sort("uploadedAt", -1)
    items = []
    for doc in cursor:
        items.append(
            {
                "lectureId": doc.get("lectureId"),
                "title": doc.get("title"),
                "uploadedAt": doc.get("uploadedAt"),
                "isFavorite": doc.get("isFavorite", False),
            }
        )

    return jsonify(items), 200


@app.route("/api/lectures/<lecture_id>", methods=["DELETE"])
def api_delete_lecture(lecture_id):
    """
    Delete lecture metadata and related files (result JSON + audio if exists).
    """
    doc = lectures_col.find_one({"lectureId": lecture_id})
    # remove DB doc if present
    result = lectures_col.delete_one({"lectureId": lecture_id})
    # remove results JSON file
    fp = RESULTS_DIR / f"{lecture_id}.json"
    try:
        if fp.exists():
            with open(fp, "r", encoding="utf-8") as fh:
                content = json.load(fh)
            audio_path = content.get("audioPath")
            # delete JSON file
            fp.unlink(missing_ok=True)
            # delete audio file if exists
            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except Exception:
                    pass
    except Exception as e:
        print("Error cleaning files on delete:", e)

    return jsonify({"deleted": True}), 200


@app.route("/api/user/<user_id>/stats", methods=["GET"])
def api_user_stats(user_id):
    """
    Return basic stats for the user.
    {
      count: <number of lectures>,
      total_words: <sum of words in full_transcript>,
      joined: <user.created_at>
    }
    """
    # count lectures
    count = lectures_col.count_documents({"userId": user_id})
    total_words = 0
    cursor = lectures_col.find({"userId": user_id})
    for doc in cursor:
        # try to open results file for accurate full_transcript length
        lecture_id = doc.get("lectureId")
        fp = RESULTS_DIR / f"{lecture_id}.json"
        if fp.exists():
            try:
                with open(fp, "r", encoding="utf-8") as fh:
                    j = json.load(fh)
                full = j.get("full_transcript", "") or ""
            except Exception:
                full = ""
        else:
            full = ""
        total_words += len((full or "").split())

    from bson import ObjectId

    try:
        user = users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    joined = user.get("created_at") if user else None


    return jsonify({"count": count, "total_words": total_words, "joined": joined}), 200

@app.route("/api/lectures/<lecture_id>/favorite", methods=["PATCH"])
def toggle_favorite(lecture_id):
    data = request.get_json(force=True)
    is_fav = bool(data.get("isFavorite", False))

    res = lectures_col.update_one(
        {"lectureId": lecture_id},
        {"$set": {"isFavorite": is_fav}}
    )

    if res.matched_count == 0:
        return jsonify({"error": "Lecture not found"}), 404

    return jsonify({"ok": True, "isFavorite": is_fav}), 200

@app.route("/api/lectures/<lecture_id>/rename", methods=["PATCH"])
def rename_lecture(lecture_id):
    data = request.get_json(force=True)
    new_title = data.get("title", "").strip()

    if not new_title:
        return jsonify({"error": "Title required"}), 400

    lectures_col.update_one(
        {"lectureId": lecture_id},
        {"$set": {"title": new_title}}
    )

    fp = RESULTS_DIR / f"{lecture_id}.json"
    if fp.exists():
        with open(fp, "r+", encoding="utf-8") as f:
            doc = json.load(f)
            doc["title"] = new_title
            f.seek(0)
            json.dump(doc, f, indent=2)
            f.truncate()

    return jsonify({"ok": True, "title": new_title}), 200

# Helpers for ObjectId
def looks_like_objectid(s):
    # naive check: 24 hex chars
    return isinstance(s, str) and len(s) == 24


def uuid_to_objectid(s):
    # try to import ObjectId
    try:
        from bson.objectid import ObjectId
        return ObjectId(s)
    except Exception:
        return s


# ---------- Main processing endpoints ----------
@app.route("/upload", methods=["POST"])
def upload():
    user_id = request.form.get("userId")
    title = request.form.get("title", "Lecture").strip()
    summary_length = request.form.get("summaryLength", "medium")


    saved_path = None

    # --- File upload ---
    if "audio" in request.files:
        f = request.files["audio"]
        if not f.filename or not allowed_file(f.filename):
            return jsonify({"error": "Invalid or missing audio file"}), 400
        saved_path = save_uploaded_file(f, UPLOAD_DIR)

    # --- YouTube URL ---
    elif "youtubeUrl" in request.form:
        youtube_url = request.form.get("youtubeUrl", "").strip()
        if not youtube_url:
            return jsonify({"error": "YouTube URL required"}), 400
        saved_path = download_youtube_audio(youtube_url, UPLOAD_DIR)

    else:
        return jsonify({"error": "No audio or YouTube URL provided"}), 400

    # --- Create job ---
    lecture_id = uuid.uuid4().hex
    now = datetime.utcnow().isoformat() + "Z"

    init_doc = {
        "lectureId": lecture_id,
        "title": title,
        "uploadedAt": now,
        "audioPath": str(saved_path),
        "status": "processing",
        "progress": "Queued",
        "summaryLength": summary_length,
    }

    with open(RESULTS_DIR / f"{lecture_id}.json", "w", encoding="utf-8") as f:
        json.dump(init_doc, f, indent=2)

    threading.Thread(
        target=process_lecture_background,
        args=(lecture_id, title, saved_path, user_id, summary_length),
        daemon=True,
    ).start()

    return jsonify({
        "lectureId": lecture_id,
        "status": "processing"
    }), 202



@app.route("/result/<lecture_id>", methods=["GET"])
def result_endpoint(lecture_id):
    fp = RESULTS_DIR / f"{lecture_id}.json"
    if not fp.exists():
        return jsonify({"error": "not found"}), 404
    with open(fp, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    return jsonify(doc)


@app.route("/download_audio/<lecture_id>", methods=["GET"])
def download_audio(lecture_id):
    fp = RESULTS_DIR / f"{lecture_id}.json"
    if not fp.exists():
        return jsonify({"error": "not found"}), 404
    with open(fp, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    audio_path = doc.get("audioPath")
    if not audio_path or not os.path.exists(audio_path):
        return jsonify({"error": "audio not found"}), 404
    return send_file(audio_path, as_attachment=True)


# ---------- Run ----------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
