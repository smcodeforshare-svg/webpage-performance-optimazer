# Catalog of Detection Rules & Performance Fixes

This document describes all automated rules evaluated by Auditor Pro v3.0, including detection criteria, evidence, and proposed replacement patterns.

---

## 1. React & Next.js Rules

### Rule: `react-lifecycle / missing-abort-controller`
- **Severity:** High &bull; **Confidence:** Verified
- **Issue:** Asynchronous network request (`fetch()` or `axios()`) executed inside `useEffect` without an `AbortController` and cleanup return function.
- **Why it matters:** Rapid prop or state changes trigger new requests while previous requests continue executing in the background. Responses arrive out-of-order, causing race conditions, unmount memory leaks, and redundant network bandwidth consumption.
- **Replacement Pattern:**
  ```jsx
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function fetchData() {
      try {
        const response = await fetch('/api/data', { signal: controller.signal });
        const data = await response.json();
        if (isMounted) setData(data);
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    }
    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [deps]);
  ```

---

### Rule: `network-waterfall / waterfall-fetch-in-effect`
- **Severity:** High &bull; **Confidence:** Strongly Supported
- **Issue:** Sequential `await fetch()` calls inside an async function where the second call does not depend on data returned by the first call.
- **Why it matters:** Increases total wait time to `T1 + T2`. Parallelizing allows both requests to be multiplexed over HTTP/2 concurrently.
- **Replacement Pattern:**
  ```jsx
  const [res1, res2] = await Promise.all([
    fetch('/api/user-stats'),
    fetch('/api/revenue-stats')
  ]);
  const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
  ```

---

### Rule: `react-rendering / unmemoized-expensive-calculation`
- **Severity:** Medium &bull; **Confidence:** Strongly Supported
- **Issue:** Heavy `.filter().sort().map()` chains executed directly in component render body.
- **Why it matters:** Re-calculates on every unrelated re-render, creating main-thread jank and frame drops.
- **Replacement Pattern:**
  ```jsx
  const sortedItems = useMemo(() => {
    return items.filter(i => i.active).sort((a, b) => b.price - a.price);
  }, [items]);
  ```

---

### Rule: `react-reconciliation / unstable-array-index-key`
- **Severity:** Medium &bull; **Confidence:** Strongly Supported
- **Issue:** Array map iteration uses array `index` as the React `key` prop.
- **Why it matters:** Causes React reconciler to reuse wrong DOM nodes during sorting, filtering, or deletion, leading to state corruption and DOM churn.
- **Replacement Pattern:**
  ```jsx
  {items.map(item => <ItemCard key={item.id} data={item} />)}
  ```

---

## 2. Python & Backend Rules

### Rule: `python-async-blocking / sync-requests-in-async-def`
- **Severity:** Critical &bull; **Confidence:** Verified
- **Issue:** Synchronous blocking call (`requests.get()`) executed inside an `async def` FastAPI/Starlette endpoint.
- **Why it matters:** The asyncio event loop runs on a single thread. A blocking network call freezes the entire worker process, stalling all other concurrent user requests.
- **Replacement Pattern:**
  ```python
  import httpx

  @app.get("/api/data")
  async def get_data():
      async with httpx.AsyncClient(timeout=10.0) as client:
          response = await client.get("https://remote.api/data")
          return response.json()
  ```

---

### Rule: `python-missing-timeout / requests-without-timeout`
- **Severity:** High &bull; **Confidence:** Verified
- **Issue:** Calling `requests.get()` without an explicit `timeout=` parameter.
- **Why it matters:** Python `requests` defaults to `timeout=None`. If the remote server stops responding or drops packets, the worker thread hangs indefinitely, exhausting thread pools.
- **Replacement Pattern:**
  ```python
  response = requests.get(url, timeout=10.0)
  ```

---

### Rule: `python-n-plus-one / database-query-in-loop`
- **Severity:** Critical &bull; **Confidence:** Strongly Supported
- **Issue:** Database query executed inside an iteration loop.
- **Why it matters:** Triggers N individual database round-trips for N records instead of 1 batched query.
- **Replacement Pattern:**
  ```python
  # Batch query using IN clause or joinedload:
  users = session.query(User).filter(User.id.in_(user_ids)).all()
  ```

---

## 3. CSS & Styling Rules

### Rule: `css-paint-layout / layout-triggering-animation`
- **Severity:** High &bull; **Confidence:** Verified
- **Issue:** Animating layout properties (`top`, `left`, `width`, `height`, `margin`) in `@keyframes`.
- **Why it matters:** Forces CPU reflow and GPU repaint on every 16ms animation frame, degrading Cumulative Layout Shift (CLS) and causing stuttering.
- **Replacement Pattern:**
  ```css
  /* Offload to GPU compositor thread: */
  @keyframes slideBanner {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(100px, 0, 0); }
  }
  ```

---

### Rule: `css-network-blocking / render-blocking-at-import`
- **Severity:** High &bull; **Confidence:** Verified
- **Issue:** `@import url(...)` at the top of a stylesheet.
- **Why it matters:** Delays initial page render until the imported stylesheet is discovered and downloaded sequentially.
- **Replacement Pattern:**
  ```html
  <!-- Load concurrently in HTML <head>: -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?..." />
  ```
