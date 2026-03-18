#!/usr/bin/env python3
"""
Prune logs older than 24 hours and manage error archives.
Logs are stored in .agents/skills/expert-developer/scripts/tools/logs.json
Errors are stored in .agents/skills/expert-developer/scripts/tools/errors/error-log.json
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any


def parse_iso_timestamp(ts: str) -> datetime:
    """Parse ISO 8601 timestamp"""
    try:
        # Handle both formats: with and without 'Z'
        ts_clean = ts.rstrip('Z')
        if '.' in ts_clean:
            return datetime.fromisoformat(ts_clean).replace(tzinfo=timezone.utc)
        else:
            return datetime.fromisoformat(ts_clean).replace(tzinfo=timezone.utc)
    except:
        return datetime.now(timezone.utc)


def prune_logs(logs_path: Path, max_age_hours: int = 24, verbose: bool = False) -> Dict[str, Any]:
    """
    Prune log entries older than max_age_hours.
    
    Args:
        logs_path: Path to logs.json
        max_age_hours: Maximum age in hours (default: 24)
        verbose: Show detailed progress
    
    Returns:
        Pruning statistics
    """
    
    if not logs_path.exists():
        return {
            'success': True,
            'message': 'No logs file found',
            'logs_pruned': 0,
            'logs_retained': 0,
            'log_file': str(logs_path)
        }
    
    try:
        with open(logs_path, 'r', encoding='utf-8') as f:
            logs_data = json.load(f)
    except Exception as e:
        return {
            'success': False,
            'error': 'LOG_READ_FAILED',
            'message': f'Failed to read logs: {str(e)}',
            'logs_pruned': 0,
            'logs_retained': 0
        }
    
    if not isinstance(logs_data, dict) or 'logs' not in logs_data:
        return {
            'success': True,
            'message': 'Logs file has invalid format',
            'logs_pruned': 0,
            'logs_retained': 0
        }
    
    logs = logs_data.get('logs', [])
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=max_age_hours)
    
    retained = []
    pruned = 0
    
    for log in logs:
        timestamp_str = log.get('timestamp', '')
        timestamp = parse_iso_timestamp(timestamp_str)
        
        if timestamp > cutoff:
            retained.append(log)
        else:
            pruned += 1
            if verbose:
                print(f"[PRUNE] Removed log from {timestamp_str}")
    
    # Update logs data
    logs_data['logs'] = retained
    logs_data['last_pruned'] = datetime.now(timezone.utc).isoformat() + 'Z'
    logs_data['pruned_count'] = logs_data.get('pruned_count', 0) + pruned
    
    # Write back
    try:
        with open(logs_path, 'w', encoding='utf-8') as f:
            json.dump(logs_data, f, indent=2)
        
        if verbose:
            print(f"[OK] Pruned {pruned} logs, retained {len(retained)}")
        
        return {
            'success': True,
            'logs_pruned': pruned,
            'logs_retained': len(retained),
            'log_file': str(logs_path),
            'cutoff_time': cutoff.isoformat() + 'Z'
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': 'LOG_WRITE_FAILED',
            'message': f'Failed to write logs: {str(e)}',
            'logs_pruned': 0,
            'logs_retained': len(retained)
        }


def prune_errors(errors_path: Path, max_age_hours: int = 24, verbose: bool = False) -> Dict[str, Any]:
    """
    Prune error entries older than max_age_hours.
    
    Args:
        errors_path: Path to error-log.json
        max_age_hours: Maximum age in hours (default: 24)
        verbose: Show detailed progress
    
    Returns:
        Pruning statistics
    """
    
    if not errors_path.exists():
        return {
            'success': True,
            'message': 'No errors file found',
            'errors_pruned': 0,
            'errors_retained': 0,
            'error_file': str(errors_path)
        }
    
    try:
        with open(errors_path, 'r', encoding='utf-8') as f:
            errors_data = json.load(f)
    except Exception as e:
        return {
            'success': False,
            'error': 'ERROR_READ_FAILED',
            'message': f'Failed to read errors: {str(e)}',
            'errors_pruned': 0,
            'errors_retained': 0
        }
    
    if not isinstance(errors_data, dict) or 'errors' not in errors_data:
        return {
            'success': True,
            'message': 'Errors file has invalid format',
            'errors_pruned': 0,
            'errors_retained': 0
        }
    
    errors = errors_data.get('errors', [])
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=max_age_hours)
    
    retained = []
    pruned = 0
    
    for error in errors:
        timestamp_str = error.get('timestamp', '')
        timestamp = parse_iso_timestamp(timestamp_str)
        
        if timestamp > cutoff:
            retained.append(error)
        else:
            pruned += 1
            if verbose:
                print(f"[PRUNE] Removed error from {timestamp_str}")
    
    # Update errors data
    errors_data['errors'] = retained
    errors_data['last_pruned'] = datetime.now(timezone.utc).isoformat() + 'Z'
    errors_data['pruned_count'] = errors_data.get('pruned_count', 0) + pruned
    
    # Write back
    try:
        with open(errors_path, 'w', encoding='utf-8') as f:
            json.dump(errors_data, f, indent=2)
        
        if verbose:
            print(f"[OK] Pruned {pruned} errors, retained {len(retained)}")
        
        return {
            'success': True,
            'errors_pruned': pruned,
            'errors_retained': len(retained),
            'error_file': str(errors_path),
            'cutoff_time': cutoff.isoformat() + 'Z'
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': 'ERROR_WRITE_FAILED',
            'message': f'Failed to write errors: {str(e)}',
            'errors_pruned': 0,
            'errors_retained': len(retained)
        }


def main() -> None:
    import argparse
    
    parser = argparse.ArgumentParser(description='Prune logs and errors older than 24 hours')
    parser.add_argument('--logs', type=str, default='.agents/skills/expert-developer/scripts/tools/logs.json',
                       help='Path to logs.json')
    parser.add_argument('--errors', type=str, default='.agents/skills/expert-developer/scripts/tools/errors/error-log.json',
                       help='Path to error-log.json')
    parser.add_argument('--max-age', type=int, default=24,
                       help='Maximum age in hours (default: 24)')
    parser.add_argument('--verbose', action='store_true',
                       help='Show detailed progress')
    
    args = parser.parse_args()
    
    logs_path = Path(args.logs)
    errors_path = Path(args.errors)
    
    result = {
        'success': True,
        'logs': prune_logs(logs_path, args.max_age, args.verbose),
        'errors': prune_errors(errors_path, args.max_age, args.verbose)
    }
    
    print(json.dumps(result, indent=2))
    
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
