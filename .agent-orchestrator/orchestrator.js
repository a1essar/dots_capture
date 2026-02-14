#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

// --- Config (env) ---
const ORCH_DIR = path.resolve(__dirname);
const PROJECT_ROOT = path.resolve(process.env.PROJECT_ROOT || process.cwd());
const TASKS_FILE = path.join(ORCH_DIR, "tasks.json");
const CONTEXT_FILE = path.join(ORCH_DIR, "context.json");
const PROMPTS_DIR = path.join(ORCH_DIR, "prompts");
const MAX_ITERATIONS = Math.max(1, parseInt(process.env.MAX_ITERATIONS || "50", 10));
const MAX_RETRIES = Math.max(1, parseInt(process.env.MAX_RETRIES || "3", 10));
const AGENT_TIMEOUT_SEC = Math.max(60, parseInt(process.env.AGENT_TIMEOUT || "300", 10));
const MODEL = process.env.MODEL || "auto";
const MAX_STAGNATION = Math.max(1, parseInt(process.env.MAX_STAGNATION || "5", 10));
const STALE_TASK_SECONDS = parseInt(process.env.STALE_TASK_SECONDS || "600", 10);
const LOG_JSONL = process.env.LOG_JSONL || path.join(ORCH_DIR, "log.jsonl");
const RAW_LOG_FILE = process.env.RAW_LOG_FILE || path.join(ORCH_DIR, "raw.log");
const ISSUE_TRIAGE = process.env.ISSUE_TRIAGE === "1" || process.env.ISSUE_TRIAGE === "true";

const VALID_STATUSES = new Set(["todo", "in_progress", "ready_to_test", "in_test", "done", "blocked", "blocked_by_issue"]);

let currentIter = 0; // used by signal handler for exit logging

// --- Helpers: JSON I/O and validation ---
function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filePath}: ${e.message}`);
  }
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, filePath);
}

function readTasks() {
  if (!fs.existsSync(TASKS_FILE)) {
    throw new Error(`Tasks file not found: ${TASKS_FILE}`);
  }
  const data = readJson(TASKS_FILE);
  if (!Array.isArray(data.tasks)) {
    throw new Error("tasks.json must have a 'tasks' array");
  }
  const taskIds = new Set();
  for (const t of data.tasks) {
    if (!t.id || typeof t.id !== "string") {
      throw new Error("Each task must have a string 'id'");
    }
    if (taskIds.has(t.id)) {
      throw new Error(`Duplicate task id: ${t.id}`);
    }
    taskIds.add(t.id);
    const s = (t.status || "todo").toLowerCase();
    if (!VALID_STATUSES.has(s)) {
      throw new Error(`Invalid status for task ${t.id}: ${t.status}`);
    }
    t.status = s;
    if (!Array.isArray(t.dependencies)) {
      t.dependencies = [];
    }
    t.retries = Math.max(0, parseInt(t.retries, 10) || 0);
    t.max_retries = Math.max(1, parseInt(t.max_retries, 10) || MAX_RETRIES);
    t.priority = typeof t.priority === "number" ? t.priority : Infinity;
  }
  for (const t of data.tasks) {
    for (const depId of t.dependencies) {
      if (!taskIds.has(depId)) {
        throw new Error(`Task ${t.id} depends on unknown task: ${depId}`);
      }
    }
  }
  return data;
}

function statusSnapshot(tasks) {
  return tasks.tasks.map((t) => `${t.id}:${t.status}:${t.retries}`).join("|");
}

function snapshotHash(tasks) {
  return crypto.createHash("sha256").update(statusSnapshot(tasks)).digest("hex").slice(0, 16);
}

// --- Task selection: deterministic, respects status, deps, priority, retries, order ---
function getDoneSet(tasks) {
  const set = new Set();
  for (const t of tasks.tasks) {
    if (t.status === "done") set.add(t.id);
  }
  return set;
}

function isEligibleForDev(task, doneSet) {
  if (task.status !== "todo" && task.status !== "in_progress") return false;
  if (task.retries >= task.max_retries) return false;
  if (task.status === "blocked" || task.status === "blocked_by_issue") return false;
  for (const depId of task.dependencies) {
    if (!doneSet.has(depId)) return false;
  }
  return true;
}

function isEligibleForQA(task, _doneSet) {
  if (task.status === "blocked_by_issue") return false;
  return task.status === "ready_to_test" || task.status === "in_test";
}

function selectNextTask(tasks, logEvent) {
  const doneSet = getDoneSet(tasks);
  const indexById = new Map();
  for (let i = 0; i < tasks.tasks.length; i++) indexById.set(tasks.tasks[i].id, i);

  const sortCandidates = (candidates) => {
    candidates.sort((a, b) => {
      const pri = (a.priority ?? Infinity) - (b.priority ?? Infinity);
      if (pri !== 0) return pri;
      const ret = (a.retries ?? 0) - (b.retries ?? 0);
      if (ret !== 0) return ret;
      const idxA = indexById.get(a.id) ?? Infinity;
      const idxB = indexById.get(b.id) ?? Infinity;
      if (idxA !== idxB) return idxA - idxB;
      return (a.id || "").localeCompare(b.id || "");
    });
  };

  // IMPORTANT: always pick tasks in this status order to avoid "stuck" tasks between restarts.
  // in_test → ready_to_test → in_progress → todo
  const statusOrder = ["in_test", "ready_to_test", "in_progress", "todo"];
  for (const status of statusOrder) {
    const role = status === "in_test" || status === "ready_to_test" ? "qa" : "dev";
    const candidates =
      role === "qa"
        ? tasks.tasks.filter((t) => t.status === status && isEligibleForQA(t, doneSet))
        : tasks.tasks.filter((t) => t.status === status && isEligibleForDev(t, doneSet));

    if (candidates.length === 0) continue;
    sortCandidates(candidates);
    const chosen = candidates[0];
    if (logEvent) {
      logEvent("task_selected", {
        role,
        task_id: chosen.id,
        reason: status,
        status: chosen.status,
        priority: chosen.priority,
        retries: chosen.retries,
      });
    }
    return { role, task: chosen };
  }

  return null;
}

// --- Retries / blocking: orchestrator updates tasks.json ---
function updateTaskInFile(taskId, updates) {
  const data = readJson(TASKS_FILE);
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const now = new Date().toISOString();
  Object.assign(task, updates, { updated_at: now });
  writeJsonAtomic(TASKS_FILE, data);
}

function incrementRetriesAndMaybeBlock(taskId, logEvent) {
  const data = readJson(TASKS_FILE);
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const retriesBefore = task.retries || 0;
  const maxRetries = task.max_retries ?? MAX_RETRIES;
  const retriesAfter = retriesBefore + 1;
  task.retries = retriesAfter;
  task.updated_at = new Date().toISOString();
  if (retriesAfter >= maxRetries) {
    task.status = "blocked";
    writeJsonAtomic(TASKS_FILE, data);
    if (logEvent) {
      logEvent("task_blocked", { task_id: taskId, reason: "max_retries", retries: retriesAfter });
    }
  } else {
    writeJsonAtomic(TASKS_FILE, data);
  }
  if (logEvent) {
    logEvent("task_transition", {
      task_id: taskId,
      retries_before: retriesBefore,
      retries_after: retriesAfter,
      status_after: task.status,
    });
  }
}

// --- Stale recovery: revert in_progress/in_test to todo ---
function recoverStaleTasks(logEvent) {
  if (STALE_TASK_SECONDS <= 0) return false;
  const data = readJson(TASKS_FILE);
  const now = Date.now();
  let changed = false;
  for (const t of data.tasks) {
    if (t.status !== "in_progress" && t.status !== "in_test") continue;
    if (t.status === "blocked_by_issue") continue;
    const updated = t.updated_at ? new Date(t.updated_at).getTime() : 0;
    if (updated && now - updated > STALE_TASK_SECONDS * 1000) {
      const statusBefore = t.status;
      t.status = "todo";
      t.retries = (t.retries || 0) + 1;
      t.updated_at = new Date().toISOString();
      if (t.retries >= (t.max_retries ?? MAX_RETRIES)) {
        t.status = "blocked";
      }
      changed = true;
      if (logEvent) {
        logEvent("task_transition", {
          task_id: t.id,
          status_before: statusBefore,
          status_after: t.status,
          reason: "stale_recovery",
        });
      }
    }
  }
  if (changed) writeJsonAtomic(TASKS_FILE, data);
  return changed;
}

// --- Issue triage (ISSUE_TRIAGE=1): context, parse, upsert, bugfix task, block/unblock ---
function readContext() {
  if (!fs.existsSync(CONTEXT_FILE)) return { known_issues: [] };
  const data = readJson(CONTEXT_FILE);
  if (!Array.isArray(data.known_issues)) data.known_issues = [];
  return data;
}

function writeContext(data) {
  writeJsonAtomic(CONTEXT_FILE, data);
}

function parseBlockerFromNotes(notes) {
  if (!notes || typeof notes !== "string") return null;
  const signatureMatch = notes.match(/BLOCKER_SIGNATURE:\s*(.+?)(?=\n|$)/);
  const severityMatch = notes.match(/BLOCKER_SEVERITY:\s*(blocker|major|minor)/);
  const affectedMatch = notes.match(/AFFECTED_TASKS:\s*(.+?)(?=\n|$)/);
  const filesMatch = notes.match(/SUSPECTED_FILES:\s*(.+?)(?=\n|$)/);
  if (!signatureMatch || !severityMatch) return null;
  const signature = signatureMatch[1].trim();
  const severity = severityMatch[1].toLowerCase();
  const affectedTasks = affectedMatch
    ? affectedMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const suspectedFiles = filesMatch
    ? filesMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  return { signature, severity, affectedTasks, suspectedFiles };
}

function nextIssueId(issues) {
  let n = 0;
  for (const i of issues) {
    const m = (i.id || "").match(/^KI-(\d+)$/);
    if (m) n = Math.max(n, parseInt(m[1], 10));
  }
  return `KI-${n + 1}`;
}

function nextBugfixTaskId(tasks) {
  let n = 0;
  for (const t of tasks.tasks) {
    const m = (t.id || "").match(/^BUGFIX-(\d+)$/);
    if (m) n = Math.max(n, parseInt(m[1], 10));
  }
  return `BUGFIX-${n + 1}`;
}

function upsertIssue(context, signature, severity, affectedTasks, suspectedFiles, logEvent) {
  const now = new Date().toISOString();
  let issue = context.known_issues.find((i) => i.signature === signature);
  if (issue) {
    issue.last_seen_at = now;
    issue.occurrences = (issue.occurrences || 0) + 1;
    issue.affected_tasks = [...new Set([...(issue.affected_tasks || []), ...affectedTasks])];
    if (suspectedFiles.length) issue.suspected_files = [...new Set([...(issue.suspected_files || []), ...suspectedFiles])];
    if (logEvent) logEvent("issue_detected", { issue_id: issue.id, signature: signature.slice(0, 80), occurrences: issue.occurrences });
  } else {
    issue = {
      id: nextIssueId(context.known_issues),
      signature,
      status: "open",
      severity,
      owner_task_id: null,
      affected_tasks: [...new Set(affectedTasks)],
      suspected_files: suspectedFiles,
      created_at: now,
      last_seen_at: now,
      occurrences: 1,
    };
    context.known_issues.push(issue);
    if (logEvent) logEvent("issue_created", { issue_id: issue.id, signature: signature.slice(0, 80) });
  }
  return issue;
}

function ensureBugfixTask(tasks, issue, logEvent) {
  if (issue.owner_task_id) {
    const exists = tasks.tasks.some((t) => t.id === issue.owner_task_id);
    if (exists) return issue.owner_task_id;
  }
  const bugfixId = nextBugfixTaskId(tasks);
  const taskIds = new Set(tasks.tasks.map((t) => t.id));
  if (taskIds.has(bugfixId)) return issue.owner_task_id;

  const desc = `Blocker: ${issue.signature}\n\nAcceptance: fix the root cause so affected flows pass. Verify with e2e/Playwright.\nSuspected: ${(issue.suspected_files || []).join(", ") || "—"}`;
  const newTask = {
    id: bugfixId,
    title: `Bugfix: ${issue.signature.slice(0, 60)}${issue.signature.length > 60 ? "…" : ""}`,
    description: desc,
    spec: "",
    status: "todo",
    priority: 0,
    dependencies: [],
    notes: "",
    retries: 0,
    max_retries: tasks.tasks[0]?.max_retries ?? MAX_RETRIES,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const data = readJson(TASKS_FILE);
  data.tasks.push(newTask);
  writeJsonAtomic(TASKS_FILE, data);
  issue.owner_task_id = bugfixId;
  if (logEvent) logEvent("bugfix_task_created", { issue_id: issue.id, task_id: bugfixId });
  return bugfixId;
}

function blockAffectedTasks(tasks, issue, logEvent) {
  const taskIds = new Set(tasks.tasks.map((t) => t.id));
  const data = readJson(TASKS_FILE);
  const blocked = [];
  for (const tid of issue.affected_tasks || []) {
    if (!taskIds.has(tid)) continue;
    const t = data.tasks.find((x) => x.id === tid);
    if (!t || t.status === "done") continue;
    t.status = "blocked_by_issue";
    t.blocked_by = [issue.id];
    t.updated_at = new Date().toISOString();
    blocked.push(tid);
  }
  if (blocked.length) {
    writeJsonAtomic(TASKS_FILE, data);
    if (logEvent) logEvent("tasks_blocked_by_issue", { issue_id: issue.id, task_ids: blocked });
  }
}

function unblockWhenFixed(tasks, context, logEvent) {
  const now = new Date().toISOString();
  const doneSet = new Set(tasks.tasks.filter((t) => t.status === "done").map((t) => t.id));
  let changed = false;
  for (const issue of context.known_issues) {
    if (issue.status !== "open" || !issue.owner_task_id) continue;
    if (!doneSet.has(issue.owner_task_id)) continue;
    issue.status = "fixed";
    issue.fixed_at = now;
    const data = readJson(TASKS_FILE);
    for (const t of data.tasks) {
      if (t.blocked_by && t.blocked_by.includes(issue.id)) {
        t.status = "todo";
        t.blocked_by = (t.blocked_by || []).filter((id) => id !== issue.id);
        if (t.blocked_by.length === 0) delete t.blocked_by;
        t.updated_at = now;
        changed = true;
      }
    }
    if (changed) writeJsonAtomic(TASKS_FILE, data);
    if (logEvent) logEvent("issue_fixed_unblocked", { issue_id: issue.id, owner_task_id: issue.owner_task_id });
  }
}

function triageOpenIssues(logEvent) {
  const context = readContext();
  let tasks = readTasks();
  for (const issue of context.known_issues) {
    if (issue.status !== "open") continue;
    ensureBugfixTask(tasks, issue, logEvent);
    tasks = readTasks();
    blockAffectedTasks(tasks, issue, logEvent);
  }
  tasks = readTasks();
  unblockWhenFixed(tasks, context, logEvent);
  writeContext(context);
}

function triageFromTaskResult(role, taskAfter, logEvent) {
  if (role !== "qa" || !taskAfter || (taskAfter.status !== "todo" && taskAfter.status !== "done")) return;
  const parsed = parseBlockerFromNotes(taskAfter.notes);
  if (!parsed || parsed.severity !== "blocker") return;
  const context = readContext();
  const issue = upsertIssue(
    context,
    parsed.signature,
    parsed.severity,
    parsed.affectedTasks.length ? parsed.affectedTasks : [taskAfter.id],
    parsed.suspectedFiles,
    logEvent
  );
  const tasks = readTasks();
  ensureBugfixTask(tasks, issue, logEvent);
  blockAffectedTasks(tasks, issue, logEvent);
  writeContext(context);
}

// --- Logging: JSONL + raw ---
function appendJsonl(filePath, obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n";
  fs.appendFileSync(filePath, line, "utf8");
}

let exitingBySignal = false;
function exitOnSignal(signalName, signalCode) {
  if (exitingBySignal) {
    process.exit(128 + signalCode);
  }
  exitingBySignal = true;
  try {
    appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "signal", signal: signalName, iter: currentIter });
  } catch (e) {
    console.error("[orchestrator] Failed to log signal exit:", e.message);
  }
  process.exit(128 + signalCode);
}

function createLogger(iter) {
  return function logEvent(event, fields = {}) {
    appendJsonl(LOG_JSONL, { event, iter, ...fields });
  };
}

function appendRaw(text) {
  fs.appendFileSync(RAW_LOG_FILE, text, "utf8");
}

// --- Prompt building ---
function buildPrompt(role, task) {
  const templatePath = path.join(PROMPTS_DIR, `${role}.md`);
  let content = fs.readFileSync(templatePath, "utf8");
  const specRel = task.spec || "";
  const specPath = specRel ? path.join(ORCH_DIR, specRel) : "";
  const replacements = {
    "{{TASK_ID}}": task.id || "",
    "{{TASK_TITLE}}": task.title || "",
    "{{TASK_DESCRIPTION}}": task.description || "",
    "{{SPEC_PATH}}": specPath,
    "{{CONTEXT_PATH}}": CONTEXT_FILE,
  };
  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
  }
  return content;
}

// --- Agent runner: spawn with timeout, SIGTERM then SIGKILL, capture stdout/stderr ---
function runAgent(prompt, role, taskId, logEvent) {
  const startMs = Date.now();
  logEvent("agent_start", { role, task_id: taskId, timeout_sec: AGENT_TIMEOUT_SEC, model: MODEL });
  console.log("[orchestrator] Running " + role + " agent (timeout " + AGENT_TIMEOUT_SEC + "s, model " + MODEL + ")...");

  appendRaw(`\n===== AGENT RUN START ${new Date().toISOString()} =====\n`);
  appendRaw(`role=${role} task_id=${taskId} timeout_seconds=${AGENT_TIMEOUT_SEC} model=${MODEL}\n`);

  return new Promise((resolve) => {
    const child = spawn("agent", ["-p", "--force", "--model", MODEL], {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killTimer = null;

    const timeoutMs = AGENT_TIMEOUT_SEC * 1000;
    const graceMs = 5000;

    const finish = (exitCode, wasTimeout) => {
      if (killTimer) clearTimeout(killTimer);
      const durationMs = Date.now() - startMs;
      appendRaw(stdout);
      if (stderr) appendRaw("\n" + stderr);
      appendRaw(`\n===== AGENT RUN END ${new Date().toISOString()} exit_code=${exitCode} timed_out=${wasTimeout} duration_ms=${durationMs} =====\n`);

      logEvent("agent_end", {
        role,
        task_id: taskId,
        exit_code: exitCode,
        timed_out: wasTimeout,
        duration_ms: durationMs,
      });
      resolve({ exitCode, timedOut: wasTimeout, durationMs });
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      appendRaw(`Spawn error: ${err.message}\n`);
      finish(-1, false);
    });

    child.on("exit", (code, signal) => {
      if (timedOut) return;
      finish(code ?? -1, false);
    });

    child.stdin.end(prompt, "utf8");

    killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      const killTimer2 = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch (_) {}
      }, graceMs);
      killTimer2.unref?.();
    }, timeoutMs);
    killTimer.unref?.();
  });
}

// --- Main loop (async so we can await runAgent) ---
async function run() {
  try {
    fs.appendFileSync(RAW_LOG_FILE, "", "utf8");
  } catch (_) {
    const d = path.dirname(RAW_LOG_FILE);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(RAW_LOG_FILE, "", "utf8");
  }

  process.on("SIGINT", () => exitOnSignal("SIGINT", 2));
  process.on("SIGTERM", () => exitOnSignal("SIGTERM", 15));

  const orchStart = { event: "orchestrator_start", config: { PROJECT_ROOT, ORCH_DIR, MAX_ITERATIONS, MAX_RETRIES, AGENT_TIMEOUT_SEC, MODEL, MAX_STAGNATION, STALE_TASK_SECONDS, ISSUE_TRIAGE }, paths: { TASKS_FILE, CONTEXT_FILE, LOG_JSONL, RAW_LOG_FILE } };
  appendJsonl(LOG_JSONL, orchStart);
  console.log("[orchestrator] Started. PROJECT_ROOT=" + PROJECT_ROOT + " MAX_ITERATIONS=" + MAX_ITERATIONS + " AGENT_TIMEOUT=" + AGENT_TIMEOUT_SEC + "s");

  if (!fs.existsSync(TASKS_FILE)) {
    appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "tasks_file_not_found", path: TASKS_FILE });
    console.error("ERROR: Tasks file not found:", TASKS_FILE);
    process.exit(1);
  }

  try {
    require("child_process").execSync("which agent", { stdio: "pipe" });
  } catch (_) {
    appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "cursor_cli_not_found" });
    console.error("ERROR: Cursor CLI (agent) not found. Install from https://cursor.com/docs/cli/installation");
    process.exit(1);
  }

  let iter = 0;
  let stagnationCount = 0;
  let lastHash = null;

  while (iter < MAX_ITERATIONS) {
    iter++;
    currentIter = iter;
    let tasks;
    try {
      tasks = readTasks();
    } catch (e) {
      appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "read_tasks_error", message: e.message, iter });
      console.error("ERROR:", e.message);
      process.exit(1);
    }

    const hash = snapshotHash(tasks);
    const logEvent = createLogger(iter);
    appendJsonl(LOG_JSONL, { event: "iteration_start", iter, snapshot: statusSnapshot(tasks), snapshot_hash: hash });

    if (hash === lastHash) {
      stagnationCount++;
      if (stagnationCount >= MAX_STAGNATION) {
        appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "max_stagnation", iter, stagnation_count: stagnationCount });
        console.log("[orchestrator] Stopping: max stagnation reached.");
        process.exit(0);
      }
    } else {
      stagnationCount = 0;
    }
    lastHash = hash;

    if (STALE_TASK_SECONDS > 0) {
      recoverStaleTasks(logEvent);
      tasks = readTasks();
    }
    if (ISSUE_TRIAGE) {
      triageOpenIssues(logEvent);
      tasks = readTasks();
    }

    const selection = selectNextTask(tasks, logEvent);
    console.log("[orchestrator] Iteration " + iter + " — selecting task...");
    if (!selection) {
      const doneCount = tasks.tasks.filter((t) => t.status === "done").length;
      const blockedCount = tasks.tasks.filter((t) => t.status === "blocked").length;
      appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "no_eligible_tasks", iter, done_count: doneCount, blocked_count: blockedCount });
      console.log("[orchestrator] No eligible tasks. Exiting.");
      process.exit(0);
    }

    const { role, task } = selection;
    const taskId = task.id;
    console.log("[orchestrator] Selected " + role + " task: " + taskId + " — " + (task.title || ""));

    if (task.spec && !fs.existsSync(path.join(ORCH_DIR, task.spec))) {
      appendJsonl(LOG_JSONL, { event: "spec_missing", task_id: taskId, spec: task.spec, iter });
    }

    const prompt = buildPrompt(role, task);
    const statusBefore = task.status;
    const retriesBefore = task.retries;

    const { exitCode, timedOut } = await runAgent(prompt, role, taskId, logEvent);

    tasks = readTasks();
    let taskAfter = tasks.tasks.find((t) => t.id === taskId);
    if (ISSUE_TRIAGE) {
      triageFromTaskResult(role, taskAfter || null, logEvent);
      tasks = readTasks();
      taskAfter = tasks.tasks.find((t) => t.id === taskId);
    }
    const statusAfter = taskAfter ? taskAfter.status : statusBefore;
    const retriesAfter = taskAfter ? taskAfter.retries : retriesBefore;

    logEvent("task_transition", {
      task_id: taskId,
      status_before: statusBefore,
      status_after: statusAfter,
      retries_before: retriesBefore,
      retries_after: retriesAfter,
    });

    const noProgress =
      (role === "dev" && statusAfter !== "ready_to_test") ||
      (role === "qa" && statusAfter !== "done");
    const shouldIncrementRetry =
      statusAfter !== "blocked" &&
      statusAfter !== "blocked_by_issue" &&
      (noProgress || statusAfter === "todo" || timedOut || exitCode !== 0);
    if (shouldIncrementRetry) {
      incrementRetriesAndMaybeBlock(taskId, logEvent);
    }
  }

  appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "max_iterations", iter });
  console.log("[orchestrator] Reached MAX_ITERATIONS. Stopping.");
  process.exit(0);
}

run().catch((err) => {
  appendJsonl(LOG_JSONL, { event: "orchestrator_stop", reason: "fatal_error", message: err.message });
  console.error(err);
  process.exit(1);
});
