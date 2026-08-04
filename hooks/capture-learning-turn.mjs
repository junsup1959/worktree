import { createHash, randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const MAX_STDIN_BYTES = 2 * 1024 * 1024;
const MAX_PROMPT_CHARS = 64_000;
const MAX_ANSWER_CHARS = 128_000;
const MAX_CANDIDATES = 1_000;
const CANDIDATE_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;
const PENDING_RETENTION_MS = 24 * 60 * 60 * 1_000;
const LOCK_STALE_MS = 60_000;
const LOCK_RETRIES = 40;
const LOCK_RETRY_MS = 25;

const SECRET_PATTERNS = [
  {
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/g,
    replacement: "[REDACTED_OPENAI_KEY]",
  },
  {
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    pattern: /\bAKIA[A-Z0-9]{16}\b/g,
    replacement: "[REDACTED_AWS_ACCESS_KEY]",
  },
  {
    pattern: /(Authorization\s*:\s*Bearer\s+)[^\s"'`]+/gi,
    replacement: "$1[REDACTED_TOKEN]",
  },
  {
    pattern:
      /((?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|passwd|secret)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
    replacement: "$1[REDACTED_SECRET]",
  },
];

function candidateKey(sessionId, turnId) {
  return createHash("sha256")
    .update(`${sessionId}\0${turnId}`, "utf8")
    .digest("hex");
}

function asRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required hook field: ${fieldName}`);
  }
  return value;
}

function isOptedOut(prompt) {
  return /(?:\[no[-_ ]?learn\]|\[학습\s*제외\]|#no[-_]?learn)/iu.test(prompt);
}

function projectPaths(event) {
  const cwd = asRequiredString(event.cwd, "cwd");

  if (!path.isAbsolute(cwd)) {
    throw new Error("Hook field cwd must be an absolute path");
  }

  const learningDir = path.join(path.resolve(cwd), ".jsfwork", "learning");

  return {
    learningDir,
    pendingDir: path.join(learningDir, "pending"),
    candidatesFile: path.join(learningDir, "candidates.jsonl"),
    candidatesLockFile: path.join(learningDir, "candidates.lock"),
    errorsFile: path.join(learningDir, "hook-errors.jsonl"),
  };
}

function sanitizeText(value, maxChars) {
  let text = value.replaceAll("\0", "");
  let redactionCount = 0;

  for (const { pattern, replacement } of SECRET_PATTERNS) {
    text = text.replace(pattern, (...args) => {
      redactionCount += 1;

      if (replacement.includes("$1")) {
        return replacement.replace("$1", args[1]);
      }

      return replacement;
    });
  }

  let truncated = false;

  if (text.length > maxChars) {
    const omitted = text.length - maxChars;
    const headLength = Math.floor(maxChars * 0.7);
    const tailLength = maxChars - headLength;
    text = `${text.slice(0, headLength)}\n\n[TRUNCATED ${omitted} CHARS]\n\n${text.slice(-tailLength)}`;
    truncated = true;
  }

  return { text, redactionCount, truncated };
}

async function readHookInput() {
  const chunks = [];
  let bytes = 0;

  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;

    if (bytes > MAX_STDIN_BYTES) {
      throw new Error(`Hook input exceeded ${MAX_STDIN_BYTES} bytes`);
    }

    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function savePrompt(event, paths) {
  const sessionId = asRequiredString(event.session_id, "session_id");
  const turnId = asRequiredString(event.turn_id, "turn_id");
  const prompt = asRequiredString(event.prompt, "prompt");
  const key = candidateKey(sessionId, turnId);
  const pendingPath = path.join(paths.pendingDir, `${key}.json`);

  if (isOptedOut(prompt)) {
    await unlink(pendingPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    return;
  }

  const sanitized = sanitizeText(prompt, MAX_PROMPT_CHARS);

  const pending = {
    schema_version: 1,
    session_id: sessionId,
    turn_id: turnId,
    captured_at: new Date().toISOString(),
    original_prompt: sanitized.text,
    prompt_redactions: sanitized.redactionCount,
    prompt_truncated: sanitized.truncated,
  };

  await mkdir(paths.pendingDir, { recursive: true });

  try {
    await writeFile(pendingPath, `${JSON.stringify(pending)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }
}

async function saveAnswerSnapshot(event, paths) {
  const sessionId = asRequiredString(event.session_id, "session_id");
  const turnId = asRequiredString(event.turn_id, "turn_id");
  const key = candidateKey(sessionId, turnId);
  const pendingPath = path.join(paths.pendingDir, `${key}.json`);

  let pending;

  try {
    pending = JSON.parse(await readFile(pendingPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }

  if (pending.opted_out) {
    await unlink(pendingPath);
    return;
  }

  if (
    typeof event.last_assistant_message !== "string" ||
    event.last_assistant_message.length === 0
  ) {
    return;
  }

  const sanitized = sanitizeText(
    event.last_assistant_message,
    MAX_ANSWER_CHARS,
  );

  const updated = {
    ...pending,
    answer_captured_at: new Date().toISOString(),
    final_answer: sanitized.text,
    final_answer_redactions: sanitized.redactionCount,
    final_answer_truncated: sanitized.truncated,
  };

  await writeFile(pendingPath, `${JSON.stringify(updated)}\n`, "utf8");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireLock(lockPath) {
  await mkdir(path.dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      return async () => {
        await handle.close().catch(() => {});
        await unlink(lockPath).catch(() => {});
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;

      const metadata = await stat(lockPath).catch(() => null);
      if (metadata && Date.now() - metadata.mtimeMs > LOCK_STALE_MS) {
        await unlink(lockPath).catch(() => {});
        continue;
      }
      await wait(LOCK_RETRY_MS);
    }
  }

  throw new Error(`Timed out waiting for candidate store lock: ${lockPath}`);
}

async function readCandidates(filePath) {
  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const lines = content.split(/\r?\n/u).filter((line) => line.trim());
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid candidate JSONL at line ${index + 1}`, {
        cause: error,
      });
    }
  });
}

async function storeCandidate(candidate, paths) {
  const releaseLock = await acquireLock(paths.candidatesLockFile);
  let temporaryPath;

  try {
    const cutoff = Date.now() - CANDIDATE_RETENTION_MS;
    const retained = (await readCandidates(paths.candidatesFile)).filter(
      (entry) => Date.parse(entry?.captured_at) >= cutoff,
    );
    const byId = new Map(
      retained.map((entry) => [entry.candidate_id, entry]),
    );
    byId.set(candidate.candidate_id, candidate);

    const bounded = [...byId.values()]
      .sort((left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at))
      .slice(-MAX_CANDIDATES);
    temporaryPath = `${paths.candidatesFile}.${process.pid}-${randomUUID()}.tmp`;
    await writeFile(
      temporaryPath,
      bounded.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );
    await rename(temporaryPath, paths.candidatesFile);
    temporaryPath = null;
  } finally {
    if (temporaryPath) await unlink(temporaryPath).catch(() => {});
    await releaseLock();
  }
}

async function finalizePendingFile(pendingPath, paths, sessionId) {
  const claimedPath = `${pendingPath}.${process.pid}-${randomUUID()}.claim`;

  try {
    await rename(pendingPath, claimedPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }

  let pending;
  let restoreOnFailure = true;

  try {
    pending = JSON.parse(await readFile(claimedPath, "utf8"));
  } catch (error) {
    try {
      await rename(claimedPath, pendingPath);
    } catch (restoreError) {
      if (restoreError?.code !== "ENOENT") {
        error.cause = restoreError;
      }
    }
    throw error;
  }

  if (pending.session_id !== sessionId) {
    await rename(claimedPath, pendingPath);
    return;
  }

  try {
    if (
      pending.opted_out ||
      typeof pending.final_answer !== "string" ||
      pending.final_answer.length === 0
    ) {
      restoreOnFailure = false;
      await unlink(claimedPath);
      return;
    }

    const candidate = {
      schema_version: 1,
      candidate_id: candidateKey(pending.session_id, pending.turn_id),
      review_status: "unreviewed",
      captured_at: pending.answer_captured_at,
      original_prompt: pending.original_prompt,
      final_answer: pending.final_answer,
      sanitization: {
        prompt_redactions: pending.prompt_redactions,
        final_answer_redactions: pending.final_answer_redactions,
        prompt_truncated: pending.prompt_truncated,
        final_answer_truncated: pending.final_answer_truncated,
      },
    };

    await storeCandidate(candidate, paths);
    restoreOnFailure = false;
    await unlink(claimedPath);
  } catch (error) {
    if (restoreOnFailure) {
      try {
        await rename(claimedPath, pendingPath);
      } catch (restoreError) {
        if (restoreError?.code !== "ENOENT") {
          error.cause = restoreError;
        }
      }
    }
    throw error;
  }
}

async function cleanupStalePending(paths) {
  let entries;
  try {
    entries = await readdir(paths.pendingDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  const cutoff = Date.now() - PENDING_RETENTION_MS;
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json(?:\..+\.claim)?$/u.test(entry.name)) {
      continue;
    }
    const filePath = path.join(paths.pendingDir, entry.name);
    const metadata = await stat(filePath).catch(() => null);
    if (metadata?.mtimeMs < cutoff) {
      await unlink(filePath).catch(() => {});
    }
  }
}

async function finalizeSession(event, paths) {
  const sessionId = asRequiredString(event.session_id, "session_id");
  let entries;

  try {
    entries = await readdir(paths.pendingDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/u.test(entry.name)) {
      continue;
    }

    await finalizePendingFile(
      path.join(paths.pendingDir, entry.name),
      paths,
      sessionId,
    );
  }
}

async function recordError(error, paths) {
  if (!paths) {
    return;
  }

  try {
    await mkdir(paths.learningDir, { recursive: true });
    await appendFile(
      paths.errorsFile,
      `${JSON.stringify({
        captured_at: new Date().toISOString(),
        name: error?.name ?? "Error",
        message: String(error?.message ?? error).slice(0, 1_000),
      })}\n`,
      "utf8",
    );
  } catch {
    // The hook is fail-open even when local diagnostics cannot be written.
  }
}

async function main() {
  const event = await readHookInput();
  activeEventName = event.hook_event_name;
  activePaths = projectPaths(event);

  switch (event.hook_event_name) {
    case "UserPromptSubmit":
      await cleanupStalePending(activePaths);
      await finalizeSession(event, activePaths);
      await savePrompt(event, activePaths);
      break;
    case "Stop":
      await saveAnswerSnapshot(event, activePaths);
      break;
    case "SessionEnd":
      await finalizeSession(event, activePaths);
      await cleanupStalePending(activePaths);
      break;
    default:
      break;
  }
}

let activeEventName;
let activePaths;

try {
  await main();
} catch (error) {
  await recordError(error, activePaths);
} finally {
  if (activeEventName === "Stop") {
    process.stdout.write("{}\n");
  }
}
