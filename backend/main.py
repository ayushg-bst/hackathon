from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse
import uvicorn
from dotenv import load_dotenv
import os
from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel
import google.generativeai as genai
import json
from indexing.ctags_indexer import parse_ctags_json
import re

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(title="Code Navigator API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load repository path from environment variable or use default
REPO_PATH = os.getenv("REPO_PATH", "../path/to/your/local/repo")

# ChromaDB and embedding model configuration
DB_PATH = "./chroma_db"

# Initialize ChromaDB client globally
try:
    print(f"Initializing ChromaDB PersistentClient with DB_PATH: {DB_PATH}")
    chroma_client = chromadb.PersistentClient(path=DB_PATH)
    embedding_collection = chroma_client.get_collection("code_embeddings")
    # Check if the embedding collection is populated
    if embedding_collection.count() == 0:
        print("Warning: The embedding collection is empty. Ensure embeddings are indexed properly.")
    # Load the same model used for indexing
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print(f"Warning: Could not initialize ChromaDB or embedding model: {str(e)}")
    # We'll handle this in the endpoint if these variables are None

# Configure Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
    try:
        qa_model = genai.GenerativeModel('gemini-1.5-flash')
    except Exception as e:
        print(f"Warning: Could not initialize Gemini model: {str(e)}")
        qa_model = None
else:
    print("Warning: GOOGLE_API_KEY not set. Gemini API will not be available.")
    qa_model = None

# Global ctags data cache
ctags_data = {}

# Global variable to store the summarized codebase
codebase_summary = ""

# Function to load ctags data
def load_ctags_data():
    """Load ctags data from the tags file and store in global cache"""
    global ctags_data
    try:
        print("Loading ctags data...")
        ctags_data = parse_ctags_json()
        print(f"Loaded {len(ctags_data)} symbols from ctags")
    except Exception as e:
        print(f"Error loading ctags data: {str(e)}")
        ctags_data = {}

def find_definitions(file_path: Path, content: str):
    """
    Find function and class definitions in the file.
    Supports Python, JavaScript, TypeScript, and Java.
    """
    extension = file_path.suffix.lower()
    definitions = []
    
    if extension == '.py':
        # Simple regex-based approach for Python
        import re
        patterns = [
            r'def\s+([a-zA-Z0-9_]+)\s*\(', 
            r'class\s+([a-zA-Z0-9_]+)\s*[:\(]'
        ]
        lines = content.split('\n')
        for i, line in enumerate(lines):
            for pattern in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    name = match.group(1)
                    definitions.append({
                        'name': name,
                        'file_path': str(file_path),
                        'line_number': i + 1,
                        'type': 'function' if 'def ' in match.group(0) else 'class'
                    })
    
    elif extension in ['.js', '.jsx', '.ts', '.tsx']:
        # Simple regex for JavaScript/TypeScript
        import re
        patterns = [
            r'function\s+([a-zA-Z0-9_]+)\s*\(', 
            r'class\s+([a-zA-Z0-9_]+)\s*[{\s]',
            r'const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>',
            r'([a-zA-Z0-9_]+)\s*=\s*function\s*\('
        ]
        lines = content.split('\n')
        for i, line in enumerate(lines):
            for pattern in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    name = match.group(1)
                    def_type = 'class' if 'class ' in match.group(0) else 'function'
                    definitions.append({
                        'name': name,
                        'file_path': str(file_path),
                        'line_number': i + 1,
                        'type': def_type
                    })
    
    elif extension == '.java':
        # Enhanced regex for Java
        import re
        patterns = [
            r'(public|private|protected)?\s*(static)?\s*(void|[a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*\(',
            r'public\s+class\s+([a-zA-Z0-9_]+)'
        ]
        lines = content.split('\n')
        for i, line in enumerate(lines):
            for pattern in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    name = match.group(4) if len(match.groups()) > 3 else match.group(1)
                    def_type = 'class' if 'class ' in match.group(0) else 'method'
                    definitions.append({
                        'name': name,
                        'file_path': str(file_path),
                        'line_number': i + 1,
                        'type': def_type
                    })
    
    return definitions

def summarize_codebase(repo_path: str) -> str:
    """
    Summarize the codebase by extracting key information such as function and class definitions,
    docstrings, and file-level comments.
    """
    summary = ""
    try:
        for root, dirs, files in os.walk(repo_path):
            for file in files:
                full_path = Path(root) / file
                if full_path.is_file():
                    try:
                        # Skip unsupported file types
                        if full_path.suffix.lower() not in ['.py', '.js', '.jsx', '.ts', '.tsx', '.java']:
                            print(f"Skipping unsupported file type: {full_path}")
                            continue
                        
                        content = full_path.read_text(encoding='utf-8', errors='ignore')
                        summary += f"\n--- File: {full_path.relative_to(repo_path)} ---\n"
                        
                        # Extract function and class definitions
                        definitions = find_definitions(full_path, content)
                        for definition in definitions:
                            summary += f"{definition['type'].capitalize()} {definition['name']} (Line {definition['line_number']})\n"
                        
                        # Extract file-level docstrings or comments
                        if content.strip().startswith('"""') or content.strip().startswith("'''"):
                            docstring_end = content.find('"""', 3) if '"""' in content[3:] else content.find("'''", 3)
                            if docstring_end != -1:
                                summary += f"Docstring: {content[:docstring_end+3].strip()}\n"
                    except Exception as e:
                        print(f"Error summarizing file {full_path}: {str(e)}")
    except Exception as e:
        print(f"Error summarizing codebase: {str(e)}")
    return summary

# Load ctags data and generate codebase summary at startup
@app.on_event("startup")
async def startup_event():
    """Run when the server starts up"""
    global codebase_summary
    print("Generating codebase summary during startup...")
    codebase_summary = summarize_codebase(REPO_PATH)
    print("Codebase summary generated.")
    load_ctags_data()

# Define Pydantic models
class SearchQuery(BaseModel):
    query: str

class QueryRequest(BaseModel):
    question: str
    context_file_path: str = None

@app.get("/")
async def root():
    return {"message": "Code Navigator Backend Ready"}

@app.get("/browse/{sub_path:path}")
async def browse_repository(sub_path: str = ""):
    # Print debugging information
    print(f"Received browse request for path: {sub_path}")
    print(f"Full REPO_PATH: {REPO_PATH}")
    # Clean up the sub_path - remove any leading slashes
    sub_path = sub_path.lstrip('/')
    print(f"Normalized sub_path: {sub_path}")
    try:
        # Construct the full target path
        target_path = Path(REPO_PATH) / sub_path
        print(f"Target path: {target_path}, exists: {target_path.exists()}")
        # Check if the path exists
        if not target_path.exists():
            error_msg = f"Path not found: {sub_path}"
            print(f"Error: {error_msg}")
            raise HTTPException(status_code=404, detail=error_msg)
        # Handle directory
        if target_path.is_dir():
            try:
                items = []
                print(f"Reading directory: {target_path}")
                for item in target_path.iterdir():
                    # Skip hidden files (starting with .)
                    if not item.name.startswith('.'):
                        items.append({
                            "name": item.name,
                            "is_dir": item.is_dir()
                        })
                print(f"Found {len(items)} items in directory")
                return JSONResponse({
                    "path": sub_path,
                    "items": items
                })
            except Exception as e:
                error_msg = f"Error reading directory: {str(e)}"
                print(f"Error: {error_msg}")
                raise HTTPException(status_code=500, detail=error_msg)
        # Handle file
        elif target_path.is_file():
            try:
                print(f"Reading file: {target_path}")
                # Skip binary files or very large files
                if target_path.stat().st_size > 1024 * 1024:  # Skip files larger than 1MB
                    error_msg = f"File too large to display: {sub_path}"
                    print(f"Warning: {error_msg}")
                    return JSONResponse({
                        "path": sub_path,
                        "content": f"File too large to display. Size: {target_path.stat().st_size / 1024:.1f} KB"
                    })
                content = target_path.read_text(encoding='utf-8', errors='replace')
                return JSONResponse({
                    "path": sub_path,
                    "content": content
                })
            except UnicodeDecodeError:
                # Handle binary files
                error_msg = f"Cannot display binary file: {sub_path}"
                print(f"Warning: {error_msg}")
                return JSONResponse({
                    "path": sub_path,
                    "content": "This appears to be a binary file and cannot be displayed."
                })
            except Exception as e:
                error_msg = f"Error reading file: {str(e)}"
                print(f"Error: {error_msg}")
                raise HTTPException(status_code=500, detail=error_msg)
        # Handle other cases
        else:
            error_msg = f"Path is neither a file nor a directory: {sub_path}"
            print(f"Error: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        error_msg = f"Unexpected error processing path {sub_path}: {str(e)}"
        print(f"Error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/search")
async def search_code(search_query: SearchQuery):
    try:
        # Get query text from request body
        query_text = search_query.query
        
        # Check if ChromaDB and model are initialized
        if 'embedding_collection' not in globals() or 'embedding_model' not in globals():
            raise HTTPException(
                status_code=500, 
                detail="Search functionality is not available. Database or embedding model not initialized."
            )
        
        # Generate embedding for the query
        query_embedding = embedding_model.encode(query_text).tolist()
        
        # Query ChromaDB collection - fetch more results initially for filtering
        results = embedding_collection.query(
            query_embeddings=[query_embedding],
            n_results=30,  # Fetch more results than we need to allow for filtering
            include=['documents', 'metadatas', 'distances']
        )
        
        # Process the results
        processed_results = []
        # Check if results contain expected keys
        if not all(key in results for key in ['documents', 'metadatas', 'distances']):
            raise HTTPException(status_code=500, detail="Unexpected response format from database")
        
        # Normalize query for case-insensitive matching
        normalized_query = query_text.lower()
        query_terms = normalized_query.split()
        
        # Extract and format results
        for i in range(len(results['documents'][0])):
            try:
                document = results['documents'][0][i]
                metadata = results['metadatas'][0][i]
                distance = results['distances'][0][i] if 'distances' in results else None
                
                # Check if the document contains any of the query terms (case-insensitive)
                normalized_document = document.lower()
                
                # Calculate a keyword match score (0-1)
                keyword_match_score = 0
                term_matches = 0
                for term in query_terms:
                    if term in normalized_document:
                        term_matches += 1
                
                if query_terms:
                    keyword_match_score = term_matches / len(query_terms)
                
                # Only include results that have at least one query term
                if term_matches > 0:
                    # Calculate a combined relevance score
                    # - Lower distance means better semantic match (so we use 1-distance)
                    # - Higher keyword_match_score means better keyword match
                    semantic_score = 1 - (distance or 0)
                    combined_score = (semantic_score * 0.6) + (keyword_match_score * 0.4)
                    
                    # Find the best snippet that contains the query
                    snippet = document
                    if len(document) > 500:
                        # If document is long, try to find a better snippet that includes query terms
                        best_pos = -1
                        for term in query_terms:
                            pos = normalized_document.find(term)
                            if pos != -1 and (best_pos == -1 or pos < best_pos):
                                best_pos = pos
                        
                        if best_pos != -1:
                            # Extract a window of text centered around the first occurrence
                            start = max(0, best_pos - 150)
                            end = min(len(document), best_pos + 350)
                            snippet = document[start:end]
                            # Add ellipsis if we're not showing the full document
                            if start > 0:
                                snippet = "..." + snippet
                            if end < len(document):
                                snippet = snippet + "..."
                    
                    processed_results.append({
                        'file_path': metadata.get('file_path', 'Unknown'),
                        'content': snippet,
                        'start_char': metadata.get('start_char', 0),
                        'end_char': metadata.get('end_char', 0),
                        'distance': distance,
                        'score': combined_score,
                        'query': query_text  # Include original query for highlighting
                    })
            except (IndexError, KeyError) as e:
                print(f"Error processing result {i}: {str(e)}")
                continue
        
        # Sort results by combined score (higher is better)
        processed_results.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        # Limit to top 10 results
        processed_results = processed_results[:10]
        
        return processed_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error performing search: {str(e)}")

@app.post("/query")
async def answer_code_question(query_request: QueryRequest):
    try:
        # Get query details
        question = query_request.question
        context_file_path = query_request.context_file_path
        
        # Check if API and model are available
        if not GOOGLE_API_KEY or not qa_model:
            raise HTTPException(
                status_code=500,
                detail="Gemini API is not configured. Please set the GOOGLE_API_KEY environment variable."
            )
        
        # Check if embedding models are available
        if 'embedding_collection' not in globals() or 'embedding_model' not in globals():
            raise HTTPException(
                status_code=500, 
                detail="Search functionality is not available. Database or embedding model not initialized."
            )
        
        # Initialize context
        context_code = ""
        print(f"Starting semantic search for question: {question}")
        
        # Step 1: Add pre-generated summarized codebase to the context
        print("Adding pre-generated summarized codebase to the context...")
        context_code += codebase_summary
        
        # Step 2: Add specific file context if provided
        if context_file_path:
            try:
                full_path = Path(REPO_PATH) / context_file_path
                print(f"Adding specific file context for: {context_file_path}")
                if full_path.exists() and full_path.is_file():
                    file_content = full_path.read_text(encoding='utf-8', errors='ignore')
                    context_code += f"\n--- Specific File Context: {context_file_path} ---\n\n```\n{file_content}\n```\n"
                else:
                    print(f"Requested context file does not exist: {context_file_path}")
            except Exception as e:
                print(f"Error reading context file: {str(e)}")
        
        # Step 3: Construct prompt for Gemini
        print(f"Constructing prompt for Gemini with context length: {len(context_code)} characters")
        prompt = f"""System: You are an AI assistant analyzing a codebase. Use the following code context to answer the user's question. 
If the context is insufficient, say so clearly and explain what information is missing.

Code Context:
--- BEGIN CONTEXT ---
{context_code}
--- END CONTEXT ---

User Question: {question}

Answer:"""
        
        # Step 4: Call Gemini API
        try:
            response = qa_model.generate_content(prompt)  # Sends the query to Gemini
            answer = response.text
            
            return {"answer": answer}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error calling Gemini API: {str(e)}")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

@app.get("/index/definition/{symbol_name}")
async def get_definition(symbol_name: str):
    """
    Get all definitions for a specific symbol name from the ctags index
    Args:
        symbol_name: The name of the symbol to look up
    Returns:
        A list of definitions for the symbol, or 404 if not found
    """
    # Check if we have ctags data
    if not ctags_data:
        # Try to load it if not already loaded
        load_ctags_data()
        if not ctags_data:
            return JSONResponse(
                status_code=404,
                content={"message": "Ctags index not available. Run indexing first."}
            )
    # Look up the symbol in the ctags data
    if symbol_name in ctags_data:
        return {"definitions": ctags_data[symbol_name]}
    else:
        return JSONResponse(
            status_code=404,
            content={"message": f"Symbol '{symbol_name}' not found in the index"}
        )

@app.get("/config")
async def get_config():
    """Return configuration information like the repository path"""
    return {
        "repo_path": REPO_PATH
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)