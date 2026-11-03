# Local Project Performance & API Auditor Pro — Advanced Version 3.0

> **A production-quality, Windows-compatible, local-first web application for auditing website loading performance, Core Web Vitals, API requests, React components, Next.js applications, Python-backed services, PHP/WordPress themes, jQuery, CSS, dependencies, and source code bottlenecks.**

---

## ⚡ What makes Version 3.0 different?

Most performance tools merely report *what* is slow (e.g. "LCP is 3.8s"). Auditor Pro v3.0 identifies:
1. **Which exact file, component, function, endpoint, or selector** is causing the bottleneck.
2. The **exact project-relative and complete absolute file paths** (e.g. `D:\projects\my-app\src\components\ProductList.jsx` lines `42–68`).
3. **One-click direct editor launcher** (`[VS Code]`, `[Notepad]`, and `[Copy Path]`) that opens files jumped to the exact line number.
4. **Multi-File API Architecture Tracing**: Traces each API endpoint across client callers, server route handlers, controllers, services, and database queries, displaying exact code syntax blocks for every file involved.
5. The **existing source code block** sliced directly from the file.
6. The **corrected replacement code** ready to substitute.
7. The **exact replacement instructions, required imports, and side effects**.
8. **Why the fix helps**, expected latency/render reductions, and trade-offs.
9. Safe **patch preview, unified diffs, atomic backups (`.auditor-backups/`), and instant rollback**.

---

## 📋 System Requirements

- **Operating System:** Windows 10, Windows 11, macOS, or Linux.
- **Node.js:** Node.js 18.0.0 or newer (Node.js 20+ LTS recommended).
- **Python (Optional):** Python 3.8+ for deep Python AST analysis (a pure JS parser fallback is included if Python is not installed).
- **Browser Automation:** Playwright Chromium (automatically installed by `start.bat`).

---

## 🚀 Quick Start (Windows)

### 1. One-Click Startup
Double-click `start.bat` in the project root:
```bat
start.bat
```
`start.bat` will automatically:
1. Check that Node.js and npm are installed.
2. Install dependencies via `npm install` if missing.
3. Download Playwright Chromium if needed (`npx playwright install chromium`).
4. Start the server on `http://127.0.0.1:4890`.
5. Automatically open the dashboard in your default browser.
6. Keep the terminal window open with error diagnostics if anything fails.

### 2. Manual Startup (Cross-Platform)
On Windows PowerShell, macOS, or Linux:
```cmd
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Launch the server
npm start
```
Open [http://127.0.0.1:4890](http://127.0.0.1:4890) in your browser.

### 3. Graceful Shutdown (Windows)
Double-click `stop.bat` to terminate any running Auditor server processes on port 4890.

---

## 🔍 How to Run Audits

### Scenario A: Auditing a Website URL
1. Enter your website target (e.g. `http://localhost:3000` or `http://localhost/my-php-site`) in the **Website Target URL** input.
2. Select **Desktop** or **Mobile Viewport (iPhone 14)**.
3. Choose **Cold Cache** or **Warm Cache Mode**.
4. Select number of test runs (1 run for quick check, 3 or 5 for statistical median).
5. Click **Run Comprehensive Audit**.

### Scenario B: Auditing a Local Source Repository
1. Enter your project's local directory path in **Local Project Directory Path**, for example:
   - `D:\xampp\htdocs\my-wordpress-theme`
   - `D:\projects\my-react-app`
   - `D:\projects\my-nextjs-app`
   - `C:\workspace\python-fastapi-service`
2. Click **Run Comprehensive Audit**.
3. Auditor Pro traverses the source tree, runs AST and pattern rules across React, Next.js, PHP, jQuery, Plain JS, TypeScript/TSX, Python, CSS, and `package.json`, and outputs itemized findings.

### Scenario C: Correlated Combined Audit with Multi-File API Tracing (Most Powerful)
Provide **both** the Target URL **and** the Project Directory:
- Auditor Pro records runtime API calls (e.g. `GET /api/products`).
- Traces whether each API is contained in a single file or broken across multiple files (Client Caller, Route Handler, Controller, Service, Database Model).
- Displays exact code syntax blocks, line numbers, and absolute file paths for every file involved in the API.
- Correlates each runtime request with clickable `[VS Code]` and `[Notepad]` links.

---

## 🛠 Supported Analysis Rules & Bottlenecks

### 1. React & Next.js
- **Missing Request Cancellation:** Identifies `fetch()` or `axios()` inside `useEffect` without `AbortController` and unmount cleanup. Proposes complete replacement block with `AbortError` handling.
- **Sequential Network Waterfalls:** Identifies multiple independent sequential `await fetch()` calls that could be parallelized with `Promise.all()`.
- **Unmemoized Render Calculations:** Detects `.filter().sort().map()` chains in component bodies re-evaluating on every render; wraps in `useMemo`.
- **Uncleaned Timers & Listeners:** Detects `setInterval` or `addEventListener` in effects without cleanup return functions (memory leaks).
- **Unstable Array Index Keys:** Detects `map((item, index) => <div key={index}>)` and substitutes stable unique identifiers.
- **Next.js Client Boundaries:** Flags unnecessary `'use client'` on components without hooks or browser APIs, converting them to zero-bundle Server Components (RSC).
- **Unoptimized `<img>` Tags:** Replaces raw HTML `<img>` with Next.js `next/image` for WebP/AVIF compression and responsive sizing.
- **Heavy Static Components:** Flags large visualization/editor libraries (e.g. Chart.js, Monaco) imported statically instead of with `next/dynamic`.

### 2. PHP & WordPress (.php)
- **N+1 Database Queries in Loops:** Detects `$wpdb->get_results()`, `$wpdb->get_row()`, and `get_post_meta()` inside `foreach` or `while` loops; proposes batched `WHERE IN (...)` or pre-warmed object cache (`update_meta_cache()`).
- **Blocking Remote Calls:** Flags `file_get_contents("http...")` and unconfigured cURL calls without timeouts; proposes `wp_remote_get()` with explicit timeouts.
- **Unbounded Queries:** Identifies `SELECT` queries without a `LIMIT` clause that risk memory exhaustion on growing database tables.
- **Loop Function Overhead:** Detects `count($array)` recalculated on every iteration of `for` loops; pre-calculates count before loop entry.
- **Direct Variable Concatenation in SQL:** Identifies unescaped `$wpdb` calls and wraps them in `$wpdb->prepare()`.

### 3. jQuery, Plain JavaScript (.js) & TypeScript / TSX (.ts, .tsx)
- **Repeated DOM Queries in Loops:** Detects `$('.item')` or `$('#btn')` re-queried repeatedly inside loops; caches the selection into a variable before the loop.
- **Missing Event Delegation:** Flags `$('.card-btn').on('click')` directly bound to element collections; converts to delegated events `$(document).on('click', '.card-btn', ...)`.
- **Synchronous AJAX:** Detects `$.ajax({ async: false })` which freezes the browser's UI thread and blocks rendering.
- **Layout Animations:** Flags `$elem.animate({ top: ..., left: ..., width: ... })` which triggers continuous CPU reflow; replaces with hardware-accelerated CSS `transform: translate3d()`.
- **Unthrottled Scroll / Resize Listeners:** Detects `$(window).on('scroll')`, `$(window).on('resize')`, and `window.addEventListener('scroll')` without throttling; wraps in `requestAnimationFrame` with `{ passive: true }`.
- **Quadratic O(N²) Object Spread in `.reduce()`:** Detects `{ ...acc, [item.id]: item }` in TypeScript/TSX `.reduce()` calls and optimizes to in-place linear O(N) assignment.
- **`innerHTML +=` in Loops:** Detects string concatenation to `innerHTML` inside loops that destroys and re-parses the DOM tree on every iteration.

### 4. Python & Backend
- **Async Event Loop Blocking:** Detects synchronous blocking `requests.get()` inside `async def` endpoints that freeze the single-threaded asyncio loop. Proposes non-blocking `httpx.AsyncClient` or `aiohttp`.
- **N+1 Database Queries:** Flags queries (`session.query()`, `Model.objects.filter()`) executed inside loops. Proposes batched `WHERE IN` or joined loading.
- **Missing Request Timeouts:** Flags `requests.get()` without `timeout=...`, preventing permanent thread starvation on network drops.

### 5. Multi-File API Architecture & Code Syntax Tracing
- Traces each API endpoint and determines whether it is implemented in a single file or broken across multiple files (Client Caller &rarr; Server Route Handler &rarr; Controller &rarr; Service &rarr; Database Model).
- Displays the complete absolute path for each file involved.
- Provides one-click `[VS Code]` and `[Notepad]` opening for each file in the call chain.
- Shows the exact multi-line code syntax block for each component of the API.
- Included in both the live dashboard (Network & APIs tab) and all exported reports (HTML, PDF, JSON, CSV).

### 6. CSS & Styling
- **Layout-Triggering Animations:** Detects `@keyframes` animating `top`, `left`, `width`, `height`, or `margin` that trigger reflow/repaint on every frame; replaces with GPU-accelerated `transform` (3D translate/scale).
- **Render-Blocking `@import`:** Flags `@import url(...)` at the top of stylesheets that introduce network waterfalls.
- **Excessive Selector Specificity:** Flags selectors with &ge; 5 combinators.

### 7. Dependencies & Bundles
- **Legacy & Bloated Packages:** Identifies monolithic `moment` (saves ~65KB by migrating to `date-fns` or native `Intl`) and default `lodash` imports.
- **Redundant Libraries:** Warns when multiple HTTP libraries (e.g. `axios` and `node-fetch`) are both present.
- **Oversized Build Chunks:** Examines `.next/`, `dist/`, or `build/` outputs and flags JavaScript chunks exceeding 250KB.

---

## 🔒 Safe Patch Workflow & Rollback

Auditor Pro never silently modifies project files. It enforces a strict, atomic safety pipeline:
1. **Read-Only Inspection:** Generates a unified diff preview (`--- a/... +++ b/...`) without touching the filesystem.
2. **Staleness Verification:** Computes the SHA-256 hash of the target file. If the file was edited after the audit was run, the patch is marked stale and blocked until a re-scan.
3. **Explicit User Approval:** Requires user confirmation before any disk write.
4. **Atomic Backup:** Automatically snapshots the original file to `.auditor-backups/<backup-id>/` along with a cryptographic `manifest.json`.
5. **Post-Write Verification:** Re-reads the file to verify integrity.
6. **One-Click Rollback:** Allows instant restoration of previous versions from the Backups panel.
7. **Downloadable `.patch`:** Provides standard unified diff files for review with `git apply`.

---

## 🧪 Running Automated Tests

Run the full automated test suite anytime:
```bash
npm test
```
Or directly with Node:
```bash
node tests/run-all-tests.js
```
The test suite validates:
- URL protocol validation and credential stripping.
- Directory traversal prevention and system path safety.
- AST pattern scanning for React, Next.js, PHP, jQuery, Plain JS, TypeScript/TSX, Python, CSS, and dependencies.
- Multi-file API architecture detection and code syntax block extraction.
- Line number accuracy and slice mapping.
- Unified diff generation, backup snapshot creation, and atomic rollback.
- Export formatting for JSON, CSV, HTML, and PDF.

---

## 📄 License

MIT License. Designed for local developer environments.
