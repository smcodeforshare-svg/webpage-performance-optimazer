# Architecture & Technical Design

## Overview
Local Project Performance & API Auditor Pro v3.0 operates as a local-first desktop developer tool. It combines dynamic browser runtime telemetry via Playwright Chromium with deep static code analysis across JavaScript/TypeScript, React, Next.js, Python, CSS, and package manifests.

## Core Architectural Layers

### 1. Security & Process Boundary Layer (`src/security/`)
- **Strict 127.0.0.1 Binding:** All HTTP and WebSocket endpoints listen strictly on loopback (`127.0.0.1`), ensuring no outside LAN or remote access is possible.
- **Path Resolution & Jail:** The `PathValidator` enforces that every file access, read, or patch is resolved to an absolute path that starts strictly with the validated project root. Path traversal attempts (`../../`) throw immediate errors.
- **Credential Masking:** The `Redaction` engine strips credentials from HTTP headers (`Authorization`, `Cookie`, `X-Api-Key`), masks sensitive query parameters in URLs (`token=`, `apikey=`, `password=`), and sanitizes source snippets before optional AI analysis or export.

### 2. Browser Telemetry & Synthetic Prober (`src/browser/`)
- **Playwright Chromium Engine:**
  - Injects `PerformanceObserver` instances during document creation to capture `FCP`, `LCP`, `CLS`, and `longtask` records without altering page timing.
  - Intercepts network request and response lifecycle events to capture transfer sizes, status codes, timings, and headers.
  - Emulates desktop viewports (1920x1080) and mobile devices (iPhone 14, 390x844, DPR 3, touch events).
  - Supports cold cache (isolated context) and warm cache (reload) workflows.
- **Synthetic Timing Fallback:**
  - If Playwright or Chromium is not yet installed, the synthetic prober executes native HTTP/HTTPS socket queries with socket-level timestamping (`dnsLookup`, `connect`, `secureConnect`, `firstByte`, `download`), parsing HTML for asset dependencies without crashing.

### 3. Source Analysis & AST Engine (`src/source-analysis/`)
- **LineMapper:** Computes character offset indexes and provides 1-indexed line and column positions. Computes SHA-256 hashes of source files to detect staleness.
- **AstEngine:** Scans for balanced scopes and function/component boundaries using token delimiter tracking. Extracts imports and enclosing symbol names.
- **Specialized Rule Engines:**
  - `ReactRules`: Hook lifecycles, missing cancellation, waterfalls, rendering calculations, and timer leaks.
  - `NextjsRules`: Client vs server components, image components, dynamic imports.
  - `PythonRules`: Invokes `python-ast-scanner.py` using Python's standard `ast` library to identify blocking calls in async functions, missing timeouts, and N+1 query patterns.
  - `CssRules`: Keyframes layout property animations, render-blocking `@import`, and selector complexity.
  - `DependencyRules`: Heavy packages (`moment`, `lodash`), redundant HTTP clients, and bundle chunk analysis.

### 4. Correlation Engine (`src/network/call-source-correlator.js`)
- Maps runtime HTTP/API requests (e.g. `GET /api/products`) back to the exact component, function, and source file line that originated the call.
- Correlates runtime waterfalls and duplicate requests with actionable source locations.

### 5. Safe Patching & Rollback Pipeline (`src/patches/`)
- Generates standard unified diffs (`.patch`).
- Checks source file staleness using cryptographic hashes.
- Automatically creates atomic backups in `.auditor-backups/<backup-id>/` before writing changes.
- Supports instant one-click restoration to any prior state.
