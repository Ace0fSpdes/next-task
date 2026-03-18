#!/usr/bin/env python3
"""
Build semantic search index from .agents/ documents with TF-IDF weighting
and YAML frontmatter extraction.
"""

import json
import yaml
import math
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
from typing import Dict, List, Tuple, Any
import re


def tokenize(text: str) -> List[str]:
    """Simple tokenization: lowercase, split on whitespace and punctuation"""
    text = text.lower()
    text = re.sub(r'[^\w\s\-]', ' ', text)
    tokens = text.split()
    return [t for t in tokens if len(t) > 2]


def extract_yaml_frontmatter(content: str) -> Tuple[Dict[str, Any], str]:
    """Extract YAML frontmatter from markdown file"""
    if not content.startswith('---'):
        return {}, content
    
    try:
        parts = content.split('---', 2)
        if len(parts) < 3:
            return {}, content
        
        metadata = yaml.safe_load(parts[1])
        body = parts[2]
        
        if metadata is None:
            metadata = {}
        
        return metadata, body
    except yaml.YAMLError:
        return {}, content


def calculate_tf(tokens: List[str]) -> Dict[str, float]:
    """Calculate term frequency from token list"""
    if not tokens:
        return {}
    
    tf_dict: Dict[str, int] = defaultdict(int)
    for token in tokens:
        tf_dict[token] += 1
    
    doc_length = len(tokens)
    return {term: count / doc_length for term, count in tf_dict.items()}


def build_index(docs_dir: Path, output_path: Path, verbose: bool = False) -> Dict[str, Any]:
    """Build TF-IDF index from markdown documents"""
    
    documents: List[Dict[str, Any]] = []
    vocabulary: Dict[str, Dict[str, Any]] = defaultdict(lambda: {'df': 0, 'docs': []})
    
    if verbose:
        print(f"[INFO] Scanning {docs_dir} for markdown files...")
    
    md_files = list(docs_dir.rglob('*.md'))
    
    if not md_files:
        return {
            'success': False,
            'error': 'NO_DOCUMENTS',
            'message': 'No markdown files found in ' + str(docs_dir),
            'documents_indexed': 0
        }
    
    if verbose:
        print(f"[INFO] Found {len(md_files)} markdown files")
    
    for md_file in md_files:
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            metadata, body = extract_yaml_frontmatter(content)
            
            body_tokens = tokenize(body)
            title_tokens = tokenize(metadata.get('title', md_file.stem))
            all_tokens = body_tokens + title_tokens
            
            if not all_tokens:
                if verbose:
                    print(f"[WARN] No tokens in {md_file.name}, skipping")
                continue
            
            tf = calculate_tf(all_tokens)
            
            doc: Dict[str, Any] = {
                'id': md_file.stem,
                'path': str(md_file.relative_to(docs_dir)),
                'title': metadata.get('title', md_file.stem),
                'semantic_tags': metadata.get('semantic_tags', []),
                'keywords': metadata.get('keywords', []),
                'category': metadata.get('category', 'uncategorized'),
                'created_at': metadata.get('created_at', datetime.now(timezone.utc).isoformat()),
                'updated_at': metadata.get('updated_at', datetime.now(timezone.utc).isoformat()),
                'word_count': len(all_tokens),
                'tfidf_vector': tf
            }
            
            documents.append(doc)
            
            for term in set(all_tokens):
                vocab_entry = vocabulary[term]
                vocab_entry['df'] = vocab_entry['df'] + 1
                docs_list = vocab_entry['docs']
                if doc['id'] not in docs_list:
                    docs_list.append(doc['id'])
            
            if verbose:
                print(f"[OK] Indexed {md_file.name} ({len(all_tokens)} tokens)")
        
        except Exception as e:
            if verbose:
                print(f"[ERROR] Failed to process {md_file.name}: {str(e)}")
            continue
    
    if not documents:
        return {
            'success': False,
            'error': 'NO_DOCUMENTS',
            'message': 'No valid documents to index',
            'documents_indexed': 0
        }
    
    total_docs = len(documents)
    for term in vocabulary:
        vocab_entry = vocabulary[term]
        df_val = vocab_entry['df']
        df_int = df_val if isinstance(df_val, int) else 1
        vocab_entry['idf'] = math.log(total_docs / df_int) if df_int > 0 else 0
    
    semantic_tags_index: Dict[str, List[str]] = defaultdict(list)
    for doc in documents:
        for tag in doc.get('semantic_tags', []):
            if doc['id'] not in semantic_tags_index[tag]:
                semantic_tags_index[tag].append(doc['id'])
    
    category_index: Dict[str, List[str]] = defaultdict(list)
    for doc in documents:
        cat = doc.get('category', 'uncategorized')
        if doc['id'] not in category_index[cat]:
            category_index[cat].append(doc['id'])
    
    index: Dict[str, Any] = {
        'version': '1.0.0',
        'last_updated': datetime.now(timezone.utc).isoformat().replace('+00:00', '') + 'Z',
        'total_documents': total_docs,
        'documents': documents,
        'vocabulary': {k: {'df': v['df'], 'idf': v['idf']} for k, v in vocabulary.items()},
        'semantic_tags_index': dict(semantic_tags_index),
        'category_index': dict(category_index),
        'categories': list(set(doc['category'] for doc in documents))
    }
    
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, default=str)
        
        if verbose:
            print(f"[OK] Index written to {output_path}")
            print(f"[STATS] Documents: {total_docs}, Terms: {len(vocabulary)}, Categories: {len(index['categories'])}")
        
        return {
            'success': True,
            'documents_indexed': total_docs,
            'vocabulary_size': len(vocabulary),
            'categories': index['categories'],
            'semantic_tags': list(semantic_tags_index.keys()),
            'index_path': str(output_path)
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': 'INDEX_WRITE_FAILED',
            'message': f'Failed to write index: {str(e)}',
            'documents_indexed': 0
        }


def main() -> None:
    parser = argparse.ArgumentParser(description='Build semantic search index from .agents/ documents')
    parser.add_argument('--docs-dir', type=str, default='.agents',
                       help='Directory containing documents to index')
    parser.add_argument('--output', type=str, default='.agents/index.json',
                       help='Output index file path')
    parser.add_argument('--verbose', action='store_true',
                       help='Show detailed progress')
    
    args = parser.parse_args()
    
    docs_path = Path(args.docs_dir)
    output_path = Path(args.output)
    
    result = build_index(docs_path, output_path, args.verbose)
    
    print(json.dumps(result, indent=2))
    
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
