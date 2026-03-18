#!/usr/bin/env python3
"""
Semantic search in .agents/ knowledge base using TF-IDF and semantic tags.
Hybrid scoring: 70% TF-IDF + 30% semantic tag matching.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Any
from collections import defaultdict
import re


def tokenize(text: str) -> List[str]:
    """Simple tokenization: lowercase, split on whitespace and punctuation"""
    text = text.lower()
    text = re.sub(r'[^\w\s\-]', ' ', text)
    tokens = text.split()
    return [t for t in tokens if len(t) > 2]


def search(index_path: Path, query: str, scope: str = None, limit: int = 5,  # type: ignore
          page: int = 1) -> Dict[str, Any]:
    """
    Semantic search with TF-IDF and semantic tags.
    
    Args:
        index_path: Path to index.json
        query: Search query string
        scope: Comma-separated scopes to filter by (optional)
        limit: Results per page
        page: Page number for pagination
    
    Returns:
        Search results with pagination info
    """
    
    # Validate query
    if not query or len(query.strip()) < 2:
        return {
            'success': False,
            'error': 'SEARCH_EMPTY_QUERY',
            'message': 'Query must be at least 2 characters',
            'results': [],
            'total_results': 0
        }
    
    # Load index
    if not index_path.exists():
        return {
            'success': False,
            'error': 'SEARCH_INDEX_NOT_FOUND',
            'message': f'Index not found at {index_path}. Run build-index first.',
            'results': [],
            'total_results': 0
        }
    
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            index = json.load(f)
    except Exception as e:
        return {
            'success': False,
            'error': 'INDEX_LOAD_FAILED',
            'message': f'Failed to load index: {str(e)}',
            'results': [],
            'total_results': 0
        }
    
    # Parse scopes
    scopes = set()
    if scope:
        scopes = set(s.strip() for s in scope.split(','))
        valid_scopes = set(index.get('categories', []))
        invalid = scopes - valid_scopes
        if invalid:
            return {
                'success': False,
                'error': 'SEARCH_INVALID_SCOPE',
                'message': f'Invalid scopes: {", ".join(invalid)}. Valid: {", ".join(valid_scopes)}',
                'results': [],
                'total_results': 0
            }
    
    # Tokenize query
    query_tokens = tokenize(query)
    if not query_tokens:
        return {
            'success': False,
            'error': 'SEARCH_EMPTY_QUERY',
            'message': 'Query contains no valid tokens',
            'results': [],
            'total_results': 0
        }
    
    # Calculate TF-IDF scores
    vocabulary = index.get('vocabulary', {})
    documents = index.get('documents', [])
    tfidf_scores: Dict[str, float] = defaultdict(float)
    
    for doc in documents:
        doc_id = doc['id']
        tf_vector = doc.get('tfidf_vector', {})
        
        score = 0.0
        for token in query_tokens:
            if token in tf_vector:
                tf = tf_vector[token]
                idf = vocabulary.get(token, {}).get('idf', 0)
                score += tf * idf
        
        if score > 0:
            tfidf_scores[doc_id] = score / len(query_tokens)
    
    # Calculate semantic tag matches
    semantic_scores: Dict[str, float] = defaultdict(float)
    semantic_tags_index = index.get('semantic_tags_index', {})
    
    for token in query_tokens:
        if token in semantic_tags_index:
            for doc_id in semantic_tags_index[token]:
                semantic_scores[doc_id] += 1.0
    
    # Normalize semantic scores
    if semantic_scores:
        max_semantic = max(semantic_scores.values())
        for doc_id in semantic_scores:
            semantic_scores[doc_id] /= max_semantic
    
    # Hybrid scoring: 70% TF-IDF + 30% semantic tags
    final_scores: Dict[str, float] = {}
    for doc in documents:
        doc_id = doc['id']
        
        # Apply scope filter
        if scopes and doc.get('category') not in scopes:
            continue
        
        tfidf = tfidf_scores.get(doc_id, 0.0)
        semantic = semantic_scores.get(doc_id, 0.0)
        
        score = (tfidf * 0.7) + (semantic * 0.3)
        
        if score > 0:
            final_scores[doc_id] = score
    
    if not final_scores:
        return {
            'success': True,
            'query': query,
            'scope': scope,
            'error': 'NO_RESULTS',
            'message': f'No results found for query: {query}',
            'results': [],
            'total_results': 0,
            'pagination': {
                'page': 1,
                'limit': limit,
                'total_pages': 0
            }
        }
    
    # Sort by score
    sorted_results = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Pagination
    total_results = len(sorted_results)
    total_pages = (total_results + limit - 1) // limit
    
    if page < 1 or page > total_pages:
        return {
            'success': False,
            'error': 'INVALID_PAGE',
            'message': f'Invalid page {page}. Valid range: 1-{total_pages}',
            'results': [],
            'total_results': total_results,
            'pagination': {
                'page': page,
                'limit': limit,
                'total_pages': total_pages
            }
        }
    
    start = (page - 1) * limit
    end = start + limit
    page_results = sorted_results[start:end]
    
    # Build result objects
    results = []
    doc_map = {doc['id']: doc for doc in documents}
    
    for doc_id, score in page_results:
        doc = doc_map.get(doc_id)
        if doc:
            results.append({
                'id': doc_id,
                'path': doc['path'],
                'title': doc['title'],
                'category': doc['category'],
                'semantic_tags': doc.get('semantic_tags', []),
                'relevance_score': round(score, 4),
                'word_count': doc.get('word_count', 0)
            })
    
    return {
        'success': True,
        'query': query,
        'scope': scope,
        'results': results,
        'total_results': total_results,
        'pagination': {
            'page': page,
            'limit': limit,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Semantic search in .agents/ knowledge base')
    parser.add_argument('--query', type=str, required=True,
                       help='Search query')
    parser.add_argument('--index', type=str, default='.agents/index.json',
                       help='Path to index.json')
    parser.add_argument('--scope', type=str, default=None,
                       help='Comma-separated scopes to search')
    parser.add_argument('--limit', type=int, default=5,
                       help='Results per page (default: 5)')
    parser.add_argument('--page', type=int, default=1,
                       help='Page number (default: 1)')
    
    args = parser.parse_args()
    
    index_path = Path(args.index)
    result = search(index_path, args.query, args.scope, args.limit, args.page)
    
    print(json.dumps(result, indent=2))
    
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
