# Lightweight HITL and observability UI for Personal AI Infrastructure

**Python's Textual framework paired with SQLite in WAL mode is the optimal stack for building a terminal-based, SSH-compatible AI agent observability dashboard with HITL approval workflows.** This combination uniquely satisfies every stated requirement — keyboard-only navigation, tmux compatibility, real-time metrics, historical viewing, and interactive approve/reject flows — while staying true to KISS principles. No existing AI observability tool offers a ready-made TUI dashboard, but the best path forward is a custom Textual frontend backed by either a direct SQLite store or LangFuse's API as the data layer. The research evaluated **25+ frameworks and tools** across Python, Go, Rust, Node.js, existing observability platforms, and terminal multiplexer approaches to reach this conclusion.

## Textual dominates the Python TUI landscape

Textual by Textualize (~**34,700 GitHub stars**, MIT license, actively maintained through March 2026) is purpose-built for the exact use case described. Its widget library covers every dashboard need: `DataTable` for agent status and session lists, `Button`/`Input`/`Checkbox` for HITL approval forms, `TabbedContent` for organizing views, `Sparkline` for inline metric charts, `RichLog` for streaming agent activity, and `Header`/`Footer` for app chrome. The third-party `textual-plotext` package adds full charting beyond sparklines.

Three mechanisms make real-time dashboards natural. **Reactive attributes** (`reactive()`) trigger automatic UI updates when bound variables change — ideal for live metric counters. **Timers** (`set_interval()`) schedule polling callbacks at configurable rates. **Workers** (`run_worker()`) execute background async or threaded tasks without blocking the event loop, critical for fetching data from SQLite or APIs. This reactive model is substantially more elegant than manual `invalidate()` calls in prompt_toolkit or alarm-based scheduling in urwid.

Textual is explicitly documented as SSH-compatible and works flawlessly in tmux, screen, and mosh sessions. Its TCSS styling system (a CSS dialect for terminals) supports grid/flexbox-like layouts, theming with CSS variables, and live editing in dev mode. For HITL workflows, modal screens (`Screen.push_screen()`) present approval dialogs with full context, while the `BINDINGS` class variable enables single-key shortcuts like `a` for approve and `r` for reject. Production examples include Bloomberg's Memray profiler, the Harlequin database client, and Toad (a terminal front-end for AI coding tools).

**Rich**, Textual's sibling library (~55,700 stars), is fundamentally output-only — it renders beautiful tables and layouts via `Rich.Live` but has **no keyboard input handling**, making it unsuitable as a standalone dashboard framework. Its creator explicitly built Textual to fill this gap. **urwid** (20+ years old, curses-based) works but requires 5-10x more code for equivalent functionality, lacks modern widgets, and has stagnated. **prompt_toolkit** powers ipython and AWS CLI but is optimized for prompts and editors, not dashboards — no built-in table widget, sparse full-screen documentation. **blessed** is assembly-language-level terminal programming: manual coordinate management, no widgets, no layout engine.

## Non-Python frameworks: powerful but add integration complexity

**Bubbletea** (Go, ~40,400 stars) is the strongest non-Python contender. Its Elm-like MVU architecture, extensive ecosystem (Bubbles components, Lipgloss styling, ntcharts for visualization, Huh? for forms), and corporate backing by Charm make it production-grade. The killer differentiator is **Wish**, Charm's SSH server library that lets operators `ssh dashboard@server` and get a per-session TUI instance with PTY handling and window resize support — no binary distribution needed.

**Ratatui** (Rust, ~10,000 stars) delivers the best raw performance with sub-millisecond rendering, zero-cost abstractions, and built-in chart/gauge/sparkline widgets proven by production tools like kdash (Kubernetes dashboard) and bottom (system monitor). **tview** (Go, ~11,000 stars) offers the fastest path to a working dashboard with its retained-mode widgets including `Form`, `Table`, and `Modal`. **Ink** (Node.js, ~27,000 stars) brings React's component model to terminals — low learning curve for React teams but lacks native charting widgets.

The critical tradeoff: **every non-Python framework requires an IPC bridge** to communicate with the Python-based agent system. This means implementing gRPC, REST, WebSockets, or message queue communication between a compiled binary (Go/Rust) and the Python agent — adding architectural complexity, a separate build pipeline, and a second language to maintain. For a system following KISS principles with a Python agent backend, this overhead is significant. Textual eliminates it entirely by running in the same Python process or sharing SQLite directly.

| Framework | Stars | Language | Charts | HITL widgets | SSH serving | Python integration |
|-----------|-------|----------|--------|-------------|-------------|-------------------|
| **Textual** | 34.7K | Python | Sparkline + plotext | Full (modals, forms) | Passthrough | Native |
| **Bubbletea** | 40.4K | Go | ntcharts | Huh? forms | Wish (native) | gRPC/REST required |
| **Ratatui** | 10K+ | Rust | Built-in rich set | 3rd party only | Passthrough | FFI complex |
| **tview** | 11K | Go | None built-in | Form, Modal, Table | Passthrough | gRPC/REST required |
| **Ink** | 27K | Node.js | None built-in | Ink UI components | Passthrough | WebSocket/REST |

## No observability tool offers a ready-made TUI, but LangFuse comes closest

None of the **10 AI/LLM observability platforms** evaluated ship a terminal dashboard. However, two recent developments shift the landscape. **LangFuse** shipped a full CLI in February 2026 (`langfuse-cli`) wrapping its entire OpenAPI-based REST API — `lf traces list`, `lf traces tree`, `lf scores list/summary`, `lf sessions list` with Rich table output, JSON, and jq filtering. **Phoenix by Arize** shipped its own CLI in January 2026 with trace queries and pretty-print tree views. Both prove their APIs can power a custom TUI frontend.

LangFuse is the strongest backend candidate. It is **fully open source (MIT)**, self-hostable via Docker Compose, and offers the most comprehensive API: traces, observations, sessions, scores, and a dedicated Metrics API with configurable time granularity (hour/day/week/month). Its HITL features include annotation queues, boolean/numeric/categorical scoring, and feedback workflows. The infrastructure cost is moderate — ClickHouse + Redis + S3-compatible storage + web container.

Phoenix is the **lightest-weight** option, running as a single Python process with **SQLite by default** (zero config). It lacks LangFuse's mature Metrics API and HITL annotation queues but supports OpenTelemetry natively, making it vendor-neutral. LangSmith (LangChain) offers excellent HITL via LangGraph integration but is **enterprise-only for self-hosting** and architecturally heavy. W&B, Helicone, AgentOps, and Braintrust all lack terminal interfaces and have varying self-hosting limitations. **Humanloop was sunset in September 2025** following Anthropic's acquisition — do not build on it.

A notable discovery is **otel-tui**, a Go-based TUI that receives OpenTelemetry data (OTLP gRPC/HTTP) and displays traces, logs, and metrics in a terminal dashboard inspired by k9s. Combined with **OpenLLMetry** (LLM-specific OTEL instrumentation), this provides a basic LLM observability TUI out of the box — though it is generic OTEL, not purpose-built for agent monitoring with HITL.

The recommended architecture offers two tiers based on complexity appetite:

- **Simple (KISS-aligned)**: Python agent → writes to SQLite directly → Textual TUI reads SQLite via polling. Zero external infrastructure.
- **Feature-rich**: Python agent → LangFuse SDK → self-hosted LangFuse → Textual TUI consumes LangFuse API. Adds observability depth (cost tracking, prompt management, evaluations) at the cost of running ClickHouse + Redis.

## SQLite with WAL mode is the right storage layer

**SQLite in WAL (Write-Ahead Logging) mode** is the ideal storage for a local observability tool. WAL enables concurrent reads (dashboard polling) during writes (agent logging) without blocking — the exact access pattern needed. Required PRAGMA configuration: `journal_mode=WAL`, `busy_timeout=5000` (5-second retry on contention), `synchronous=NORMAL` (faster writes, safe for WAL), `cache_size=-64000` (64MB cache).

This pattern is **production-proven by Overstory**, a multi-agent orchestration system that uses 5 SQLite databases in WAL mode with the same concurrent reader/writer architecture. Their `ov dashboard` is a long-running TUI reader that never blocks the short-lived hook commands writing metrics and events.

For aggregate analytics (token usage over time, cost trends, performance summaries), **DuckDB** serves as a complementary analytical engine — **20-50x faster** than SQLite for `GROUP BY`, `AVG()`, `SUM()`, and window functions on large datasets. DuckDB can read SQLite databases directly, enabling a hybrid where SQLite handles transactional writes and DuckDB powers the dashboard's aggregate views. Other storage options evaluated — LevelDB/LMDB (key-value only, no SQL), TinyDB (too slow), plain JSON/JSONL (no query capability) — were all inferior.

The schema should include four core tables: `sessions` (one row per agent run), `events` (granular time-series log of tool calls, LLM calls, errors), `approvals` (HITL queue doubling as audit log with `status` field cycling through pending/approved/rejected), and `learnings` (knowledge feedback loop with proposed/approved/rejected lifecycle). JSON columns provide flexible metadata storage for varying event types. Indexing on `(session_id, timestamp)` and `(status)` supports both time-range queries and approval queue polling efficiently.

## HITL approval workflows in a TUI follow the interrupt-queue-resume pattern

The most mature HITL pattern for Python agent systems is **LangGraph's interrupt/Command mechanism**. The agent calls `interrupt()` when it needs human approval, which pauses graph execution and persists state via a checkpointer. The dashboard detects the interruption (by polling the approvals table or LangGraph's state), displays the proposal with full context, and collects the human decision. The agent resumes via `Command(resume={...})` with the decision (approve, reject, or edit with modified arguments).

For the TUI, implement a **queue-based approval panel**:

```
┌─────────────────────────────────────────────────┐
│  APPROVAL QUEUE                      [3 pending] │
├─────────────────────────────────────────────────┤
│ ▶ [PENDING] execute_sql: DELETE FROM records...  │
│   [PENDING] write_file: /src/config.py           │
│   [PENDING] send_email: to user@example.com      │
├─────────────────────────────────────────────────┤
│  Agent: researcher-01 | Session: abc123          │
│  Tool: execute_sql                               │
│  Args: {"query": "DELETE FROM records..."}       │
│  Reasoning: "User asked to clean old data"       │
├─────────────────────────────────────────────────┤
│  [a]pprove  [r]eject  [e]dit  [s]kip            │
└─────────────────────────────────────────────────┘
```

Arrow keys navigate the queue, single-key shortcuts execute decisions, and a terminal bell alerts when new items arrive. The SQLite `approvals` table serves as both the live queue (filtering `WHERE status='pending'`) and the historical audit log. Polling at **0.5-1 second intervals** for the approval queue ensures near-instant visibility; metrics and session lists can poll at 2-5 seconds. Textual's `set_interval()` with `run_worker()` for database queries keeps the UI responsive.

CrewAI and AutoGen offer alternative HITL hooks. CrewAI uses `human_input=True` on tasks with webhook integration (`humanInputWebhook` URL for external UIs). AutoGen v0.4 uses `HandoffTermination` where the agent group chat terminates, the application collects input, and restarts with the human response. Both can write to the same SQLite approval queue for dashboard integration.

## Terminal multiplexer and web alternatives fill niche roles

**ttyd** (C binary, actively maintained) bridges any TUI application to a browser via WebSocket + xterm.js, enabling `ttyd textual-app` to serve the Textual dashboard accessible from any browser without SSH. Resource overhead is trivial (~5-10MB RAM). This is the recommended **hybrid access strategy**: run the Textual app in tmux for native SSH access, and optionally front it with ttyd for browser access. GoTTY is superseded and unmaintained.

**wtfutil** (Go, 50+ widgets, YAML-configured) is excellent for quick monitoring dashboards via `cmdrunner` widgets that execute shell commands and display output. It cannot handle interactive HITL workflows but works well as a supplementary metrics display. **Sampler** (12,500 stars, YAML-configured sparklines and gauges) is beautifully simple but **unmaintained since ~2019-2020** — functional but a liability. **grafatui** (Rust) renders Grafana-style dashboards in the terminal from Prometheus data but requires a Prometheus backend.

Among lightweight web frameworks, **NiceGUI** (FastAPI + Vue.js + socket.io, ~60-120MB RAM) offers the best HITL experience with true event-driven WebSocket communication and bidirectional state binding — if browser-based access is acceptable. **Gradio** is lighter (~80-150MB) with periodic timer-based refresh. **Streamlit** (~150MB+) has known memory leak issues with long-running dashboards and a confusing re-execution model. **Datasette** pairs naturally with SQLite for historical data exploration via its `datasette-dashboards` plugin but lacks real-time capability and interactivity. **Retool** is massively over-engineered for this use case.

## Regarding the Tempest AI dashboard

The Tempest AI dashboard (davepl/tempest_ai, 115 stars) by Dave Plummer (original Windows Task Manager creator) is **not a TUI — it is a self-contained web dashboard** served at `localhost:8765` from a Python HTTP server with embedded HTML/CSS/JavaScript. It displays real-time gauges, mini charts with log-compressed time scales, and metric cards for DQN training (loss, reward, epsilon, FPS, replay buffer). Its architecture pattern — separate training threads emitting metrics to a collection layer that feeds a dashboard — is a useful reference, but the web-only approach does not satisfy SSH/tmux-only access requirements.

## Final recommendation and ranked alternatives

**Primary recommendation: Textual (Python) + SQLite (WAL mode) + optional LangFuse backend**

This stack hits every requirement with minimal complexity:

| Requirement | How it's met |
|-------------|-------------|
| Live session activity/metrics | Textual reactive attributes + `set_interval()` polling SQLite |
| Past session viewing | SQLite queries with session_id filtering |
| Aggregated activity by time range | SQL `GROUP BY` with `strftime()` or DuckDB analytics |
| Learning effectiveness | Learnings table with status tracking and outcome correlation |
| Proposed learning feedback | Learnings table with `status='proposed'` |
| HITL approve/reject | Modal screens with single-key shortcuts, approvals table |
| Single pane of glass | Textual `TabbedContent` + split layouts |
| SSH/mosh/tmux | Native terminal app, explicit Textual SSH support |
| Keyboard-only, arrow nav | Built-in focus management, `BINDINGS`, command palette |
| KISS/low-tech | Python-only, SQLite file, zero infrastructure beyond the app |

**Top 5 alternatives considered but not recommended as primary:**

1. **Bubbletea (Go)** — Strongest non-Python option with Wish SSH serving as a genuine differentiator. Rejected as primary because it requires Go expertise and gRPC/REST bridge to the Python agent, violating KISS. Best suited if the team has Go experience and needs multi-user SSH serving.

2. **Ratatui (Rust)** — Best raw performance and richest built-in chart widgets, proven by kdash and bottom. Rejected because Rust's learning curve is the steepest of all options, FFI with Python is complex, and the performance advantages are irrelevant for a dashboard polling SQLite at 1-second intervals.

3. **LangFuse as full backend** — Most comprehensive observability API with CLI access. Rejected as the *primary* approach (though recommended as optional enhancement) because it requires running ClickHouse + Redis + S3, which contradicts KISS for a personal infrastructure tool. The SQLite-direct approach achieves 80% of the value at 10% of the infrastructure cost.

4. **NiceGUI (Python web)** — Best lightweight web framework for HITL with true WebSocket event-driven interaction. Rejected because it requires a browser, breaking the SSH-only access requirement and terminal-native keyboard feel. Would be the top recommendation if browser access were acceptable.

5. **wtfutil + custom cmdrunner modules** — Extremely KISS (single binary + YAML) for display-only dashboards. Rejected because it cannot handle interactive HITL approval workflows — it is a monitoring display, not an interactive application. Useful as a supplementary quick-glance dashboard alongside the main Textual app.

## Conclusion

The convergence of Textual's maturity, Python-native integration, and SQLite's concurrent-access capabilities via WAL mode creates a stack that is **genuinely minimal yet fully capable**. The architecture mirrors production patterns proven by Overstory (multi-agent SQLite-based observability), k9s/lazydocker (polling-based TUI dashboards), and Ralph TUI (AI agent loop orchestration). The recommended refresh strategy — 0.5-1s for approval queues, 2-5s for metrics, 5s for session lists — balances responsiveness against resource use. For teams wanting to add structured observability later, LangFuse's API slots cleanly behind the same Textual frontend, replacing direct SQLite reads with API calls. And ttyd provides zero-effort browser access to the terminal app when SSH is unavailable. This is the lowest-complexity path to a single-pane-of-glass AI agent dashboard that actually works over SSH in a tmux session.