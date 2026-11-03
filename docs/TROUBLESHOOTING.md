# Troubleshooting & FAQ

### 1. `start.bat` says "Node.js is not found in your system PATH"
- **Solution:** Install Node.js 18 or newer from [https://nodejs.org/](https://nodejs.org/). Ensure the checkbox **"Add to PATH"** is selected during installation, then reopen your command prompt.

### 2. Playwright Chromium download fails or hangs
- **Diagnosis:** Corporate proxy, strict firewall, or offline network.
- **Solution:** Auditor Pro automatically detects when Chromium is missing and seamlessly activates its high-precision synthetic timing fallback engine. Your audit will still measure TTFB, DNS, TLS, page download latency, and full request inventories without crashing.
- To retry downloading Playwright Chromium manually:
  ```bash
  npx playwright install chromium
  ```

### 3. Port 4890 is already in use
- **Solution:** Double-click `stop.bat` to terminate any hanging server processes, or specify an alternative port via environment variable:
  ```bash
  set PORT=5000
  npm start
  ```

### 4. "Directory does not exist" or "Security violation: Access forbidden"
- **Reason:** Auditor Pro strictly forbids scanning root drives (e.g. `C:\`, `/`) or system operating system folders (`C:\Windows`, `/etc`) for security.
- **Solution:** Enter the path directly to your project workspace directory (e.g. `D:\projects\my-app`).

### 5. Why are line numbers different after applying a fix?
- **Explanation:** When code lines are inserted or replaced, line numbers for downstream code may shift. Always re-run the scan after applying a patch to get refreshed line numbers and re-verified hashes.

### 6. Can I use this on remote or third-party websites?
- **Notice:** Only audit websites and repositories that you own or are explicitly authorized to test. Emulated audits generate network traffic and may trigger rate-limiting on third-party servers.
