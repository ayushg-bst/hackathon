from sentence_transformers import SentenceTransformer
import chromadb
from pathlib import Path
import os
from tqdm import tqdm
import numpy as np

def generate_embeddings(repo_path_str, db_path, model_name='all-MiniLM-L6-v2', chunk_size=500, chunk_overlap=50, batch_size=100):
    """
    Generate embeddings for code files in a repository and store them in ChromaDB.
    
    Args:
        repo_path_str (str): Path to the repository
        db_path (str): Path to store the ChromaDB database
        model_name (str): Name of the SentenceTransformer model to use
        chunk_size (int): Size of text chunks in characters
        chunk_overlap (int): Overlap between chunks in characters
        batch_size (int): Number of chunks to process at once
    """
    # Convert string paths to Path objects
    repo_path = Path(repo_path_str)
    
    # Initialize ChromaDB client
    client = chromadb.PersistentClient(path=db_path)
    
    # Get or create a collection
    collection = client.get_or_create_collection(
        name="code_embeddings",
        metadata={"hnsw:space": "cosine"}
    )
    
    # Load the sentence transformer model
    print(f"Loading model: {model_name}")
    model = SentenceTransformer(model_name)
    
    # Lists to batch data
    documents = []
    metadatas = []
    ids = []
    
    # Find all files in the repository
    all_files = list(repo_path.rglob('*'))
    
    # Skip files to ignore (common binary files, hidden files, etc.)
    def should_skip_file(file_path):
        # Skip directories
        if not file_path.is_file():
            return True
            
        # Skip hidden files and directories
        if any(part.startswith('.') for part in file_path.parts):
            return True
            
        # Skip common binary and large files
        extensions_to_skip = {
            '.pyc', '.pyd', '.dll', '.so', '.dylib', '.exe', '.bin',
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff',
            '.mp4', '.mp3', '.avi', '.mov', '.mkv', '.wav',
            '.zip', '.tar', '.gz', '.7z', '.rar',
            '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'
        }
        
        if file_path.suffix.lower() in extensions_to_skip:
            return True
            
        # Skip files larger than 1MB
        try:
            if file_path.stat().st_size > 1_000_000:
                return True
        except:
            return True
            
        return False
    
    # Filter files
    files_to_process = [f for f in all_files if not should_skip_file(f)]
    
    print(f"Processing {len(files_to_process)} files...")
    
    # Process files with progress bar
    for file_path in tqdm(files_to_process):
        try:
            # Read file content
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            
            # Skip empty files
            if not content.strip():
                continue
                
            # Get relative path for ID and metadata
            relative_path_str = str(file_path.relative_to(repo_path))
            
            # Chunk the content
            for i in range(0, len(content), chunk_size - chunk_overlap):
                # Extract chunk
                chunk = content[i:i + chunk_size]
                
                # Skip empty chunks
                if not chunk.strip():
                    continue
                
                # Calculate positions
                start_char = i
                end_char = min(i + chunk_size, len(content))
                
                # Create unique ID
                chunk_id = f"{relative_path_str}:{start_char}-{end_char}"
                
                # Add to batch
                documents.append(chunk)
                metadatas.append({
                    "file_path": relative_path_str,
                    "start_char": start_char,
                    "end_char": end_char
                })
                ids.append(chunk_id)
                
                # Process batch if it reaches the batch size
                if len(documents) >= batch_size:
                    batch_embeddings = model.encode(documents)
                    collection.add(
                        embeddings=batch_embeddings.tolist(),
                        documents=documents,
                        metadatas=metadatas,
                        ids=ids
                    )
                    
                    # Clear batch lists
                    documents = []
                    metadatas = []
                    ids = []
                    
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            continue
    
    # Process any remaining items
    if documents:
        try:
            batch_embeddings = model.encode(documents)
            collection.add(
                embeddings=batch_embeddings.tolist(),
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
        except Exception as e:
            print(f"Error processing final batch: {e}")
    
    print(f"Embedding generation complete. Database stored at {db_path}")
    
    # Return collection count for verification
    return collection.count()

if __name__ == "__main__":
    # Example usage
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate code embeddings for a repository")
    parser.add_argument("repo_path", help="Path to the repository")
    parser.add_argument("--db_path", default="./chroma_db", help="Path to store the ChromaDB database")
    parser.add_argument("--model", default="all-MiniLM-L6-v2", help="SentenceTransformer model to use")
    parser.add_argument("--chunk_size", type=int, default=500, help="Size of text chunks")
    parser.add_argument("--chunk_overlap", type=int, default=50, help="Overlap between chunks")
    
    args = parser.parse_args()
    
    count = generate_embeddings(
        args.repo_path, 
        args.db_path, 
        model_name=args.model,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap
    )
    
    print(f"Total chunks embedded: {count}") 