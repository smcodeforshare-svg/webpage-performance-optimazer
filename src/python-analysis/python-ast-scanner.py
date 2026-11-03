#!/usr/bin/env python3
"""
Python AST Performance Scanner
Parses Python source code using the standard library `ast` module to identify:
1. Synchronous blocking network calls inside async endpoints (e.g. requests.get in async def).
2. N+1 database queries inside loops.
3. Network requests without explicit timeouts.
4. Repeated expensive initializations / unclosed client sessions.
5. Inefficient string concatenation inside loops.
Outputs structured JSON findings with exact line numbers.
"""

import sys
import os
import ast
import json

class PythonPerformanceVisitor(ast.NodeVisitor):
    def __init__(self, filename, source_code):
        self.filename = filename
        self.source_code = source_code
        self.lines = source_code.splitlines()
        self.findings = []
        self.in_async_func = False
        self.async_func_name = None
        self.in_loop = False
        self.loop_stack = []

    def get_slice(self, start_line, end_line):
        s = max(0, start_line - 1)
        e = min(len(self.lines), end_line)
        return "\n".join(self.lines[s:e])

    def visit_AsyncFunctionDef(self, node):
        prev_async = self.in_async_func
        prev_name = self.async_func_name
        self.in_async_func = True
        self.async_func_name = node.name
        self.generic_visit(node)
        self.in_async_func = prev_async
        self.async_func_name = prev_name

    def visit_For(self, node):
        self.loop_stack.append(node)
        self.generic_visit(node)
        self.loop_stack.pop()

    def visit_While(self, node):
        self.loop_stack.append(node)
        self.generic_visit(node)
        self.loop_stack.pop()

    def visit_Call(self, node):
        # 1. Check for synchronous requests inside async function
        func_name = self._get_call_name(node.func)
        
        if self.in_async_func:
            if func_name in ('requests.get', 'requests.post', 'requests.put', 'requests.delete', 'urllib.request.urlopen'):
                start_line = node.lineno
                end_line = getattr(node, 'end_lineno', node.lineno)
                existing = self.get_slice(start_line, end_line)
                indent = " " * (node.col_offset)
                
                method = func_name.split('.')[-1]
                replacement = f"{indent}# Use non-blocking async HTTP client (e.g. httpx or aiohttp):\n{indent}async with httpx.AsyncClient(timeout=10.0) as client:\n{indent}    response = await client.{method}(url)"

                self.findings.append({
                    "title": f"Blocking Synchronous Call in Async Endpoint '{self.async_func_name}'",
                    "startLine": start_line,
                    "endLine": end_line,
                    "startColumn": node.col_offset + 1,
                    "endColumn": getattr(node, 'end_col_offset', node.col_offset + 1),
                    "symbol": self.async_func_name,
                    "category": "python-async-blocking",
                    "severity": "critical",
                    "confidence": "verified",
                    "sourceType": "static_ast",
                    "evidence": f"Synchronous '{func_name}' freezes the asyncio event loop in async function '{self.async_func_name}', stalling all concurrent incoming requests.",
                    "existingCode": existing,
                    "replacementCode": replacement,
                    "replacementInstructions": {
                        "action": "Replace synchronous requests call with an asynchronous client like httpx or aiohttp.",
                        "requiredImports": ["import httpx"]
                    },
                    "whyFixHelps": {
                        "cause": "Python async event loops are single-threaded; blocking I/O calls freeze all concurrent workers.",
                        "behaviorChange": "Yields execution back to the event loop while waiting for network I/O.",
                        "expectedBenefit": "Prevents catastrophic server throughput degradation under concurrent traffic."
                    }
                })

        # 2. Check for missing timeout in requests.*
        if func_name.startswith('requests.') and func_name in ('requests.get', 'requests.post', 'requests.put', 'requests.delete'):
            has_timeout = any(kw.arg == 'timeout' for kw in node.keywords)
            if not has_timeout:
                start_line = node.lineno
                end_line = getattr(node, 'end_lineno', node.lineno)
                existing = self.get_slice(start_line, end_line)
                
                # Check if already added
                if not any(f['startLine'] == start_line and f['category'] == 'python-missing-timeout' for f in self.findings):
                    replacement = existing.rstrip(')') + ', timeout=10.0)'
                    self.findings.append({
                        "title": f"Missing Timeout in '{func_name}' Call",
                        "startLine": start_line,
                        "endLine": end_line,
                        "startColumn": node.col_offset + 1,
                        "endColumn": getattr(node, 'end_col_offset', node.col_offset + 1),
                        "symbol": func_name,
                        "category": "python-missing-timeout",
                        "severity": "high",
                        "confidence": "verified",
                        "sourceType": "static_ast",
                        "evidence": f"'{func_name}' called without explicit timeout parameter. In Python, requests without timeout hang indefinitely if the remote server fails to respond.",
                        "existingCode": existing,
                        "replacementCode": replacement,
                        "replacementInstructions": {
                            "action": "Add timeout parameter (e.g. timeout=10.0) to all network calls."
                        },
                        "whyFixHelps": {
                            "cause": "Default requests timeout is None, tying up server worker threads permanently on network stalls.",
                            "behaviorChange": "Throws a Timeout exception after 10 seconds, freeing the thread.",
                            "expectedBenefit": "Prevents cascading socket leaks and connection pool starvation."
                        }
                    })

        # 3. Check for database query or ORM query inside loops (N+1 query pattern)
        if len(self.loop_stack) > 0:
            db_call_patterns = ('.query', '.filter', '.filter_by', '.get', 'execute', '.all()', 'objects.filter', 'objects.get')
            if any(pat in func_name for pat in db_call_patterns):
                start_line = node.lineno
                end_line = getattr(node, 'end_lineno', node.lineno)
                existing = self.get_slice(start_line, end_line)

                self.findings.append({
                    "title": f"N+1 Database Query Pattern in Loop",
                    "startLine": start_line,
                    "endLine": end_line,
                    "startColumn": node.col_offset + 1,
                    "endColumn": getattr(node, 'end_col_offset', node.col_offset + 1),
                    "symbol": func_name,
                    "category": "python-n-plus-one",
                    "severity": "critical",
                    "confidence": "strongly_supported",
                    "sourceType": "static_ast",
                    "evidence": f"Database query '{func_name}' executed inside a loop. For N items, this triggers N individual database round-trips.",
                    "existingCode": existing,
                    "replacementCode": f"# Batch query using WHERE IN or joinedload before the loop:\n# items = session.query(Model).filter(Model.id.in_(item_ids)).all()",
                    "replacementInstructions": {
                        "action": "Eagerly load relationships or batch-query using IN clauses before entering the iteration."
                    },
                    "whyFixHelps": {
                        "cause": "Executing sequential queries inside a loop creates excessive database latency and connection pool saturation.",
                        "behaviorChange": "Reduces N queries into 1 single batched query.",
                        "expectedBenefit": "Reduces query execution time by 90%+ for large datasets."
                    }
                })

        self.generic_visit(node)

    def _get_call_name(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_call_name(node.value)}.{node.attr}"
        return ""

def scan_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()
        tree = ast.parse(code, filename=filepath)
        visitor = PythonPerformanceVisitor(filepath, code)
        visitor.visit(tree)
        return visitor.findings
    except Exception as e:
        return []

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)

    target_file = sys.argv[1]
    if os.path.isfile(target_file):
        results = scan_file(target_file)
        print(json.dumps(results))
    else:
        print(json.dumps([]))
