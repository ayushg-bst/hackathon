#!/usr/bin/env python
"""
Repository Indexing Script for AI-Powered Code Navigator

This script indexes your repository to enable:
1. Semantic code search
2. Definition finding
3. Cross-file referencing
"""

import os
import sys
import time
import logging
from pathlib import Path
from dotenv import load_dotenv
import numpy as np
from sentence_transformers import SentenceTransformer
import sqlite3
import pandas as pd
from chromadb.config import Settings
from chromadb import PersistentClient
import shutil  # Add this to handle directory deletion

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("indexing")

# Load environment variables
load_dotenv()
REPO_PATH = os.getenv("REPO_PATH")

if not REPO_PATH:
    logger.error("REPO_PATH not set in .env file!")
    sys.exit(1)

if not os.path.isdir(REPO_PATH):
    logger.error(f"Repository path not found: {REPO_PATH}")
    sys.exit(1)

# Ensure data directory exists
data_dir = Path("data")
data_dir.mkdir(exist_ok=True)

# Ensure ChromaDB directory is recreated fresh
CHROMA_DB_PATH = "chroma_db"
chroma_db_dir = Path(CHROMA_DB_PATH)

# Delete existing ChromaDB directory if it exists
if chroma_db_dir.exists():
    logger.info(f"Deleting existing ChromaDB directory: {CHROMA_DB_PATH}")
    shutil.rmtree(chroma_db_dir)  # Deletes the directory and its contents

# Create a fresh ChromaDB directory
logger.info(f"Creating fresh ChromaDB directory: {CHROMA_DB_PATH}")
chroma_db_dir.mkdir(exist_ok=True)

# Initialize ChromaDB client
logger.info(f"Initializing ChromaDB at {CHROMA_DB_PATH}...")
chroma_client = PersistentClient(path=CHROMA_DB_PATH)

# Ensure the collection exists
COLLECTION_NAME = "code_embeddings"
logger.info(f"Creating new collection: {COLLECTION_NAME}")
embedding_collection = chroma_client.create_collection(COLLECTION_NAME)  # Always create a new collection

# Initialize embedding model
logger.info("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')

# File extensions to index
CODE_EXTENSIONS = [
    '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.c', '.cpp', '.h', 
    '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.sh',
    '.html', '.css', '.scss', '.sql', '.md', '.json', '.xml', '.yaml', '.yml'
]

def should_index_file(file_path):
    """Determine if a file should be indexed based on extension and path."""
    # Skip hidden files and directories
    if any(part.startswith('.') for part in Path(file_path).parts):
        return False
        
    # Skip node_modules, venv, etc.
    excluded_dirs = ['node_modules', 'venv', 'env', 'dist', 'build', '__pycache__']
    if any(excluded in Path(file_path).parts for excluded in excluded_dirs):
        return False
        
    # Check file extension
    extension = Path(file_path).suffix.lower()
    return extension in CODE_EXTENSIONS

def chunk_file(content, max_chunk_size=1000, overlap=200):
    """Split file content into overlapping chunks for better embedding."""
    if len(content) <= max_chunk_size:
        return [content]
        
    chunks = []
    for i in range(0, len(content), max_chunk_size - overlap):
        chunk = content[i:i + max_chunk_size]
        if len(chunk) > 100:  # Only include chunks with enough content
            chunks.append(chunk)
    return chunks

def find_definitions(file_path, content):
    """Find function and class definitions in the file."""
    extension = Path(file_path).suffix.lower()
    definitions = []
    
    if extension == '.py':
        # Simple regex-based approach for Python
        import re
        # Match function and class definitions
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
                        'file_path': file_path,
                        'line_number': i + 1,
                        'type': 'function' if 'def ' in match.group(0) else 'class'
                    })
    
    elif extension in ['.js', '.jsx', '.ts', '.tsx']:
        # Simple regex for JavaScript/TypeScript
        import re
        patterns = [
            r'function\s+([a-zA-Z0-9_]+)\s*\(', 
            r'class\s+([a-zA-Z0-9_]+)\s*[{\s]',
            r'const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>'
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
                        'file_path': file_path,
                        'line_number': i + 1,
                        'type': def_type
                    })
    
    return definitions

def index_repository():
    """Index the entire repository for search and navigation."""
    start_time = time.time()
    indexed_files = 0
    processed_chunks = 0
    
    # Initialize databases
    embeddings_db = sqlite3.connect('data/embeddings.db')
    embeddings_db.execute('''CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY,
        file_path TEXT,
        content TEXT,
        start_char INTEGER,
        end_char INTEGER,
        embedding BLOB
    )''')
    
    definitions_db = sqlite3.connect('data/definitions.db')
    definitions_db.execute('''CREATE TABLE IF NOT EXISTS definitions (
        id INTEGER PRIMARY KEY,
        name TEXT,
        file_path TEXT,
        line_number INTEGER,
        type TEXT
    )''')
    
    # Clear existing data
    embeddings_db.execute("DELETE FROM embeddings")
    definitions_db.execute("DELETE FROM definitions")
    
    logger.info(f"Indexing repository at {REPO_PATH}...")
    
    all_embeddings = []
    all_definitions = []
    
    # Walk through the repository
    for root, dirs, files in os.walk(REPO_PATH):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, REPO_PATH)
            
            if not should_index_file(full_path):
                continue
                
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Find definitions
                file_definitions = find_definitions(rel_path, content)
                all_definitions.extend(file_definitions)
                
                # Process file content in chunks for embedding
                chunks = chunk_file(content)
                for i, chunk in enumerate(chunks):
                    start_char = 0 if i == 0 else i * 800  # Approximate char position
                    end_char = start_char + len(chunk)
                    
                    # Generate embedding
                    embedding = model.encode(chunk).tolist()
                    
                    # Add embedding to ChromaDB collection
                    embedding_collection.add(
                        documents=[chunk],
                        metadatas=[{"file_path": rel_path, "start_char": start_char, "end_char": end_char}],
                        ids=[f"{rel_path}_{start_char}_{end_char}"]
                    )
                    
                    processed_chunks += 1
                
                indexed_files += 1
                if indexed_files % 50 == 0:
                    logger.info(f"Indexed {indexed_files} files, {processed_chunks} chunks")
                    
            except Exception as e:
                logger.error(f"Error processing {rel_path}: {str(e)}")
    
    # Debug log: Check the number of embeddings in the collection
    logger.info(f"Total embeddings in collection '{COLLECTION_NAME}': {embedding_collection.count()}")
    
    # Batch insert embeddings
    cursor = embeddings_db.cursor()
    for embed_data in all_embeddings:
        cursor.execute(
            "INSERT INTO embeddings (file_path, content, start_char, end_char, embedding) VALUES (?, ?, ?, ?, ?)",
            (embed_data['file_path'], embed_data['content'], embed_data['start_char'], 
             embed_data['end_char'], embed_data['embedding'])
        )
    embeddings_db.commit()
    
    # Batch insert definitions
    cursor = definitions_db.cursor()
    for def_data in all_definitions:
        cursor.execute(
            "INSERT INTO definitions (name, file_path, line_number, type) VALUES (?, ?, ?, ?)",
            (def_data['name'], def_data['file_path'], def_data['line_number'], def_data['type'])
        )
    definitions_db.commit()
    
    # Create indexes for faster queries
    embeddings_db.execute("CREATE INDEX IF NOT EXISTS idx_file_path ON embeddings (file_path)")
    definitions_db.execute("CREATE INDEX IF NOT EXISTS idx_name ON definitions (name)")
    definitions_db.execute("CREATE INDEX IF NOT EXISTS idx_file ON definitions (file_path)")
    
    embeddings_db.close()
    definitions_db.close()
    
    end_time = time.time()
    minutes = (end_time - start_time) / 60
    
    logger.info(f"Repository indexing complete!")
    logger.info(f"Indexed {indexed_files} files with {processed_chunks} chunks")
    logger.info(f"Created {len(all_definitions)} definition entries")
    logger.info(f"Time elapsed: {minutes:.2f} minutes")

if __name__ == "__main__":
    try:
        index_repository()
    except KeyboardInterrupt:
        logger.info("Indexing interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Indexing failed: {str(e)}")
        sys.exit(1)