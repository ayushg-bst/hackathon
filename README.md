# AI-Powered Code Navigator

A powerful tool for exploring, understanding, and navigating large codebases with AI assistance.

## Objective

AI-Powered Code Navigator helps developers explore and understand unfamiliar codebases by providing intelligent code search, file exploration, definition finding, and context-aware code explanations.

## Features

- **Intelligent Code Search**: Semantic search to find relevant code across the repository
- **File Browser**: Navigate the repository structure with ease
- **Definition Finder**: Locate function and class definitions quickly
- **Context-Aware Explanations**: Get AI-powered explanations about selected code
- **Cross-File Referencing**: Seamlessly navigate between related files
- **Responsive UI**: Works well on various screen sizes

## Technical Stack

### Frontend
- React.js
- Vite for build/development
- Monaco Editor for code display
- Axios for API communication

### Backend
- FastAPI (Python)
- Vectorized embeddings for semantic search
- File parsing and code analysis tools

### AI/ML
- Gemini API for code explanations and queries
- Text embeddings for semantic code search
- NLP techniques for code understanding

### Code Intelligence
- Syntax highlighting
- Path normalization
- Repository indexing

## Setup Instructions

### Clone the Repository
```bash
git clone <repository-url>
cd ai-powered-code-navigator
```

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with necessary variables
echo "REPO_PATH=/path/to/your/repository" > .env
echo "GOOGLE_API_KEY=your_gemini_api_key" >> .env
```

> **Important**: The `REPO_PATH` should point to the absolute path of the repository you want to explore.

### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

## Running the Application

### 1. Index the Repository
First, run the indexing script to prepare the repository for searching:
```bash
cd backend
python run_indexing.py
```

### 2. Start the Backend Server
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 3. Start the Frontend Development Server
```bash
cd frontend
npm run dev
```

### 4. Access the Application
Open your browser and navigate to:
```
http://localhost:5173
```

## API Key Requirement

This application requires a Google API key with access to the Gemini API for AI features. You can obtain one from the [Google AI Studio](https://makersuite.google.com/app/apikey).

Place this key in your `.env` file to enable the AI-powered code explanations and search features. 