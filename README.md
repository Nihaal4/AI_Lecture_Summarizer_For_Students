project:
  name: Lecture Summarizer
  repository: PROJECT_ZEUS
  description: >
    Lecture Summarizer is a full-stack AI-powered web application that converts
    lecture audio files or YouTube lecture videos into structured study material.
    The system automatically transcribes audio, generates summaries, extracts
    keywords, and creates short-answer practice questions to help students study
    efficiently.

overview:
  purpose: >
    The goal of this project is to reduce the time students spend revising long
    lectures by converting them into concise, exam-oriented notes with supporting
    transcripts and questions.
  target_users:
    - College students
    - University students
    - Self-learners using recorded or online lectures

features:
  authentication:
    - User signup and login
    - Secure password hashing
    - Session persistence using local storage
  lecture_processing:
    - Upload audio files (mp3, wav, m4a, mp4, ogg)
    - Process lectures from YouTube URLs
    - Background job queue for non-blocking processing
  ai_capabilities:
    - Speech-to-text transcription using Whisper
    - Summarization with selectable length (short, medium, detailed)
    - Keyword extraction using TF-IDF
    - AI-generated short-answer questions using LLaMA 3.1 via Groq
  user_experience:
    - Dark and light mode
    - Lecture history with search, sort, and filter
    - Favorite lectures
    - Rename lectures
    - View full or partial transcript
    - Export notes as TXT or PDF
  analytics:
    - Lecture count per user
    - Total words summarized
    - Estimated time saved

technology_stack:
  frontend:
    framework: React
    bundler: Vite
    routing: React Router
    styling: Tailwind CSS
    icons: Lucide React
    pdf_export: jsPDF
  backend:
    language: Python
    version: 3.12
    framework: Flask
    cors: Flask-CORS
    database: MongoDB
    orm: PyMongo
  ai_and_ml:
    transcription: faster-whisper
    summarization: HuggingFace Transformers (T5-small)
    keyword_extraction: scikit-learn TF-IDF
    question_generation: Groq API (LLaMA 3.1)
  media_processing:
    youtube_audio: yt-dlp
    audio_normalization: FFmpeg

system_requirements:
  operating_system:
    - Windows 10 or 11
    - macOS
    - Linux
  hardware:
    minimum_ram: 8GB
    recommended_ram: 16GB
    cpu: Multi-core processor recommended
    storage: 10GB free disk space
  software:
    python: 3.12.x
    nodejs: 18.x or newer
    mongodb: Community Server
    ffmpeg: Installed and added to PATH
    git: Latest stable version

project_structure:
  root:
    - backend
    - lecture-summarizer
  backend:
    files:
      - app.py
      - .env
    directories:
      - venv
      - uploads
      - results
  frontend:
    directory: lecture-summarizer
    files:
      - package.json
      - vite.config.js
    src:
      - App.jsx
      - main.jsx
      - index.css

environment_variables:
  backend:
    GROQ_API_KEY: >
      API key for Groq used to generate short-answer questions.
      Must be stored in a .env file and never committed to GitHub.

backend_setup:
  steps:
    - Create a Python virtual environment
    - Activate the virtual environment
    - Install required Python dependencies
    - Create .env file with GROQ_API_KEY
    - Ensure MongoDB service is running
    - Start the Flask server
  run_command: python app.py
  server_url: http://127.0.0.1:5000

frontend_setup:
  steps:
    - Navigate to lecture-summarizer directory
    - Install npm dependencies
    - Start Vite development server
  run_command: npm run dev
  client_url: http://localhost:5173

api_endpoints:
  authentication:
    - POST /api/signup
    - POST /api/login
  lecture_management:
    - POST /upload
    - GET /api/lectures
    - GET /result/{lectureId}
    - DELETE /api/lectures/{lectureId}
    - PATCH /api/lectures/{lectureId}/favorite
    - PATCH /api/lectures/{lectureId}/rename
  user_stats:
    - GET /api/user/{userId}/stats

data_handling:
  database:
    users_collection: Stores user credentials and metadata
    lectures_collection: Stores lecture metadata and user preferences
  file_storage:
    uploads: Original audio files
    results: JSON files containing transcripts, summaries, and questions

execution_flow:
  - User uploads audio or provides YouTube URL
  - Audio is normalized using FFmpeg
  - Whisper transcribes audio into text
  - Text is summarized and keywords extracted
  - AI generates practice questions
  - Results are stored and made available to the user

security_notes:
  - Passwords are hashed before storage
  - Environment variables are not committed to source control
  - Audio processing is performed locally

recommended_gitignore:
  entries:
    - venv/
    - node_modules/
    - uploads/
    - results/
    - .env
    - __pycache__/
    - dist/

license:
  type: Educational and academic use
  notes: >
    This project is intended for learning, research, and academic demonstrations.

author:
  name: Nihaal Varma
  role: Computer Science Undergraduate
  focus_areas:
    - Full Stack Development
    - Artificial Intelligence
    - Machine Learning
