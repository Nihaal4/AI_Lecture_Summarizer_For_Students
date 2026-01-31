# 📚 Lecture Summarizer – AI-Powered Study Assistant

Lecture Summarizer is a full-stack AI web application that converts lecture audio or YouTube lecture videos into **clean study notes**, **summaries**, **keywords**, and **practice questions**.  
It is designed specifically for **college students** to save time and improve exam preparation.

---

## 🚀 Features

- 🎧 Upload lecture audio **or** paste a YouTube lecture link
- 🧠 Automatic transcription using **Whisper (faster-whisper)**
- ✍️ AI-generated summaries (short / medium / detailed)
- 🔑 Keyword extraction using **TF-IDF**
- ❓ AI-generated **short-answer practice questions**
- ⭐ Favorite lectures for quick access
- 📜 Full transcript with expandable view
- 📥 Export notes as **TXT / PDF**
- 🌙 Dark / Light mode
- 🔐 User authentication (signup / login)
- 📊 User statistics (lectures summarized, words processed, time saved)

---

## 🛠️ Tech Stack

### Frontend
- React (Vite)
- React Router
- Tailwind CSS
- Lucide Icons
- jsPDF

### Backend
- Python 3.12
- Flask
- Flask-CORS
- MongoDB (PyMongo)
- faster-whisper (Whisper transcription)
- HuggingFace Transformers (T5 summarization)
- scikit-learn (TF-IDF)
- Groq API (LLaMA 3.1 for question generation)
- yt-dlp (YouTube audio download)
- FFmpeg (audio processing)

---

PROJECT_ZEUS/
├── backend/
│   ├── app.py              # Flask backend application
│   ├── .env                # Environment variables (not committed)
│   ├── venv/               # Python virtual environment
│   ├── uploads/            # Uploaded audio files
│   └── results/            # Processed lecture results (JSON)
│
└── lecture-summarizer/
    ├── src/
    │   ├── App.jsx         # Main React application
    │   ├── main.jsx        # React entry point
    │   └── index.css       # Global styles (Tailwind CSS)
    │
    ├── public/             # Static assets
    ├── package.json        # Frontend dependencies and scripts
    └── vite.config.js      # Vite configuration



---

## 🔧 Prerequisites

- **Python 3.12**
- **Node.js 18+**
- **MongoDB Community Server**
- **FFmpeg** (added to system PATH)
- **Groq API Key**

---

## ⚙️ Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
Create .env file:

GROQ_API_KEY=your_groq_api_key_here
Run backend:

python app.py
Backend runs on:

http://127.0.0.1:5000
🎨 Frontend Setup (Vite)
cd lecture-summarizer
npm install
npm run dev
Frontend runs on:

http://localhost:5173
🔌 API Endpoints
Auth
POST /api/signup

POST /api/login

Lectures
POST /upload

GET /api/lectures?userId=

GET /result/<lectureId>

DELETE /api/lectures/<lectureId>

PATCH /api/lectures/<lectureId>/favorite

PATCH /api/lectures/<lectureId>/rename

User
GET /api/user/<userId>/stats

📌 Notes
Whisper and summarization run as background jobs (non-blocking).

Results are cached and stored as JSON files for fast access.

MongoDB stores user and lecture metadata only.

Audio and transcripts are processed locally (no third-party upload).

🧠 Ideal Use Case
Students converting long lectures into exam-ready notes

YouTube lecture summarization

Revision and practice question generation

📄 License
This project is intended for educational and academic use.

✨ Author
Nihaal Varma
Computer Science Undergraduate
AI & Full-Stack Developer

