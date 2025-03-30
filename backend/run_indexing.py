from indexing.embedder import generate_embeddings
from indexing.ctags_indexer import run_ctags
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get repository path from environment variable or use default
REPO_PATH = os.getenv("REPO_PATH", "../path/to/your/local/repo")
DB_PATH = "./chroma_db"

if __name__ == "__main__":
    print(f"Starting indexing process for repository: {REPO_PATH}")
    print(f"Embeddings will be stored in: {DB_PATH}")
    
    # Create database directory if it doesn't exist
    os.makedirs(DB_PATH, exist_ok=True)
    
    # Generate embeddings
    count = generate_embeddings(REPO_PATH, DB_PATH)
    
    print(f"Embedding indexing complete! {count} chunks embedded and stored in the database.")
    
    # Run ctags indexing
    print("Running Ctags indexing...")
    ctags_success = run_ctags(REPO_PATH)
    if ctags_success:
        print("Ctags indexing completed successfully.")
    else:
        print("Ctags indexing failed. Make sure ctags is installed on your system.")
        
    print("All indexing processes finished.") 