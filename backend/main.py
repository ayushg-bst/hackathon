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
    chroma_client = chromadb.PersistentClient(path=DB_PATH)
    embedding_collection = chroma_client.get_collection("code_embeddings")
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

# Load ctags data at startup
@app.on_event("startup")
async def startup_event():
    """Run when the server starts up"""
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
        
        # Query ChromaDB collection
        results = embedding_collection.query(
            query_embeddings=[query_embedding],
            n_results=10,
            include=['documents', 'metadatas', 'distances']
        )
        
        # Process the results
        processed_results = []
        
        # Check if results contain expected keys
        if not all(key in results for key in ['documents', 'metadatas', 'distances']):
            raise HTTPException(status_code=500, detail="Unexpected response format from database")
        
        # Extract and format results
        for i in range(len(results['documents'][0])):
            try:
                document = results['documents'][0][i]
                metadata = results['metadatas'][0][i]
                distance = results['distances'][0][i] if 'distances' in results else None
                
                processed_results.append({
                    'file_path': metadata.get('file_path', 'Unknown'),
                    'content': document,
                    'start_char': metadata.get('start_char', 0),
                    'end_char': metadata.get('end_char', 0),
                    'distance': distance
                })
            except (IndexError, KeyError) as e:
                print(f"Error processing result {i}: {str(e)}")
                continue
        
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
        
        # Step 1: Semantic Search for relevant context
        query_embedding = embedding_model.encode(question).tolist()
        search_results = embedding_collection.query(
            query_embeddings=[query_embedding],
            n_results=5,  # Get top 5 most relevant snippets
            include=['documents', 'metadatas', 'distances']
        )
        
        # Process search results into context
        if len(search_results['documents']) > 0 and len(search_results['documents'][0]) > 0:
            context_code += "--- Relevant Code Snippets ---\n\n"
            
            for i in range(len(search_results['documents'][0])):
                try:
                    document = search_results['documents'][0][i]
                    metadata = search_results['metadatas'][0][i]
                    file_path = metadata.get('file_path', 'Unknown file')
                    
                    context_code += f"File: {file_path}\n```\n{document}\n```\n\n"
                except (IndexError, KeyError) as e:
                    print(f"Error processing search result {i}: {str(e)}")
                    continue
        
        # Step 2: Add specific file context if provided
        if context_file_path:
            try:
                # Construct the full path
                full_path = Path(REPO_PATH) / context_file_path
                
                if full_path.exists() and full_path.is_file():
                    file_content = full_path.read_text(encoding='utf-8', errors='ignore')
                    
                    context_code += f"\n--- Specific File Context: {context_file_path} ---\n\n```\n{file_content}\n```\n\n"
                else:
                    print(f"Requested context file does not exist: {context_file_path}")
            except Exception as e:
                print(f"Error reading context file: {str(e)}")
        
        # Step 3: Construct prompt for Gemini
        prompt = f"""System: You are an AI assistant analyzing a codebase. Use the following code context to answer the user's question. If the context is insufficient, say so.

Code Context:
--- BEGIN CONTEXT ---
{context_code}
--- END CONTEXT ---

User Question: {question}

Answer:
"""
        
        # Step 4: Call Gemini API
        try:
            response = qa_model.generate_content(prompt)
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