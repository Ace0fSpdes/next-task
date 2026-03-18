#!/usr/bin/env python3
"""
Ingest semantic metadata for project documentation without modifying source files.

This script reads semantic metadata from a JSON file and integrates it into the
semantic search index, allowing project documentation to be discoverable without
adding YAML frontmatter to the original files.

Usage:
    python ingest-semantic-metadata.py --metadata-file .agents/semantic-metadata.json
"""

import json
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
from typing import Dict, List, Any
import re


def tokenize(text: str) -> List[str]:
    """Simple tokenization: lowercase, split on whitespace and punctuation"""
    text = text.lower()
    text = re.sub(r'[^\w\s\-]', ' ', text)
    tokens = text.split()
    return [t for t in tokens if len(t) > 2]


def load_existing_index(index_path: Path) -> Dict[str, Any]:
    """Load existing index.json if it exists"""
    if index_path.exists():
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARNING] Could not load existing index: {e}", file=sys.stderr)
            return {
                "metadata": {
                    "version": "1.0",
                    "built_at": datetime.now(timezone.utc).isoformat(),
                    "documents_indexed": 0
                },
                "vocabulary": {},
                "semantic_tags": defaultdict(list),
                "categories": defaultdict(list),
                "documents": {}
            }
    return {
        "metadata": {
            "version": "1.0",
            "built_at": datetime.now(timezone.utc).isoformat(),
            "documents_indexed": 0
        },
        "vocabulary": {},
        "semantic_tags": defaultdict(list),
        "categories": defaultdict(list),
        "documents": {}
    }


def ingest_metadata(metadata_file: Path, index_path: Path, verbose: bool = False) -> Dict[str, Any]:
    """Ingest semantic metadata into search index"""

    # Load metadata file
    if not metadata_file.exists():
        return {
            "success": False,
            "error": "METADATA_FILE_NOT_FOUND",
            "message": f"Metadata file not found: {metadata_file}",
            "ingested": 0
        }

    try:
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
    except Exception as e:
        return {
            "success": False,
            "error": "METADATA_LOAD_FAILED",
            "message": f"Failed to load metadata file: {e}",
            "ingested": 0
        }

    # Load existing index
    index = load_existing_index(index_path)

    ingested_count = 0
    skipped_count = 0
    errors: List[str] = []

    # Process metadata entries
    project_docs = metadata.get("project_documents", [])
    
    if verbose:
        print(f"[INFO] Processing {len(project_docs)} metadata entries...")

    for entry in project_docs:
        try:
            doc_id = entry.get("path", "").replace("/", "_").replace("\\", "_").replace(".md", "")
            if not doc_id:
                errors.append(f"Entry missing 'path' field: {entry}")
                skipped_count += 1
                continue

            # Skip if document already indexed with full content
            if doc_id in index.get("documents", {}):
                if verbose:
                    print(f"[SKIP] {entry.get('path')} - already indexed")
                skipped_count += 1
                continue

            # Add to documents
            doc_entry = {
                "path": entry.get("path"),
                "title": entry.get("title", ""),
                "category": entry.get("category", "project"),
                "semantic_tags": entry.get("semantic_tags", []),
                "summary": entry.get("summary", ""),
                "word_count": 0,  # Not available from metadata
                "content": entry.get("summary", "")  # Use summary as searchable content
            }

            index["documents"][doc_id] = doc_entry

            # Index semantic tags
            for tag in entry.get("semantic_tags", []):
                if isinstance(index["semantic_tags"], dict):
                    if tag not in index["semantic_tags"]:
                        index["semantic_tags"][tag] = []
                    if doc_id not in index["semantic_tags"][tag]:
                        index["semantic_tags"][tag].append(doc_id)

            # Index category
            category = entry.get("category", "project")
            if isinstance(index["categories"], dict):
                if category not in index["categories"]:
                    index["categories"][category] = []
                if doc_id not in index["categories"][category]:
                    index["categories"][category].append(doc_id)

            # Index keywords as vocabulary
            keywords = entry.get("keywords", [])
            for keyword in keywords:
                keyword_tokens = tokenize(keyword)
                for token in keyword_tokens:
                    if token not in index["vocabulary"]:
                        index["vocabulary"][token] = {
                            "documents": 0,
                            "tf_idf": 0.0
                        }
                    if token in [t for doc_tokens in [
                        tokenize(str(index.get("documents", {}).get(d, {}).get("content", "")))
                        for d in index.get("documents", {})
                    ] for t in doc_tokens]:
                        index["vocabulary"][token]["documents"] += 1

            ingested_count += 1
            if verbose:
                print(f"[OK] Ingested {entry.get('path')} ({len(entry.get('semantic_tags', []))} tags)")

        except Exception as e:
            errors.append(f"Error processing entry {entry}: {e}")
            skipped_count += 1

    # Update metadata
    index["metadata"]["built_at"] = datetime.now(timezone.utc).isoformat()
    index["metadata"]["documents_indexed"] = len(index.get("documents", {}))

    # Save updated index
    try:
        output_path = Path(index_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, default=str)
        
        if verbose:
            print(f"[OK] Index updated at {output_path}")
    except Exception as e:
        return {
            "success": False,
            "error": "INDEX_WRITE_FAILED",
            "message": f"Failed to write index: {e}",
            "ingested": ingested_count
        }

    return {
        "success": True,
        "ingested": ingested_count,
        "skipped": skipped_count,
        "total_documents_in_index": len(index.get("documents", {})),
        "total_vocabulary": len(index.get("vocabulary", {})),
        "errors": errors if errors else None,
        "index_path": str(index_path)
    }


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Ingest semantic metadata for project documentation into search index'
    )
    parser.add_argument(
        '--metadata-file',
        type=str,
        default='.agents/semantic-metadata.json',
        help='Path to semantic metadata JSON file'
    )
    parser.add_argument(
        '--index-file',
        type=str,
        default='.agents/index.json',
        help='Path to semantic search index'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show detailed progress'
    )

    args = parser.parse_args()

    metadata_path = Path(args.metadata_file)
    index_path = Path(args.index_file)

    result = ingest_metadata(metadata_path, index_path, args.verbose)

    print(json.dumps(result, indent=2))

    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
