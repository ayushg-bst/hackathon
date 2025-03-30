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
cp .env.example .env
# Then edit the .env file to set your repository path and API key
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

This step creates the necessary database files in the `backend/data` directory that power the search and definition finding features. The indexing process may take several minutes for large repositories.

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

## Current Issues

The application currently has the following known issues:

1. **Search Result Navigation**: Clicking on search results may sometimes fail to load the corresponding file in the CodeViewer component.

2. **Editor Rendering**: The Monaco Editor component may occasionally fail to render content properly due to race conditions with React's component lifecycle.

3. **Path Handling**: Inconsistencies between absolute and relative paths can cause navigation issues, especially when processing search results.

4. **Large Repository Performance**: The indexing process and search can be slow for very large repositories.

5. **Limited Definition Finding**: The current implementation only detects function and class definitions using regex patterns, which may miss some definitions in complex code structures.

## Future Scope

Planned enhancements for future versions:

1. **Enhanced Code Analysis**: Integration with language servers for more accurate code intelligence across multiple languages.

2. **Git Integration**: Better integration with version control systems to show file history and changes.

3. **Multi-Repository Support**: Ability to index and search across multiple repositories at once.

4. **Performance Optimizations**: Improved indexing speed and search performance for large codebases.

5. **Code Generation**: AI-powered code completion and generation features.

6. **Collaborative Features**: Real-time collaboration tools for team exploration and annotation.

7. **Customizable UI**: User-configurable layout and theme options.

8. **Extended AI Capabilities**: Support for more AI models beyond Gemini and additional features like bug detection and refactoring suggestions.

9. **IDE Extensions**: Integration with popular IDEs like VS Code, JetBrains IDEs, etc.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 