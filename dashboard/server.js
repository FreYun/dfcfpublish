#!/usr/bin/env node
// Agent Message Dashboard Server
// Usage: node server.js [port]  (default: 18888)

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PORT = parseInt(process.argv[2] || "18888");
const PUBLISH_QUEUE = "/home/rooot/.openclaw/publish-queue";
const AGENTS_DIR = "/home/rooot/.openclaw/agents";
const CRON_DIR = "/home/rooot/.openclaw/cron";

// Server-side cache: refresh at most every 10s
let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 10000;

function redis(cmd) {
  try {
    return execSync(`redis-cli ${cmd}`, { encoding: "utf8", timeout: 3000 }).trim();
  } catch { return ""; }
}

function getMessages(limit = 200) {
  // Get all message IDs from all inboxes
  const inboxKeys = redis('KEYS "agentmsg:inbox:*"').split("\n").filter(Boolean);
  const msgIds = new Set();

  for (const key of inboxKeys) {
    const entries = redis(`XREVRANGE ${key} + - COUNT ${limit}`).split("\n").filter(Boolean);
    for (let i = 0; i < entries.length; i++) {
      if (entries[i] === "message_id" && entries[i + 1]) {
        msgIds.add(entries[i + 1]);
      }
    }
  }

  // Also from outboxes
  const outboxKeys = redis('KEYS "agentmsg:outbox:*"').split("\n").filter(Boolean);
  for (const key of outboxKeys) {
    const entries = redis(`XREVRANGE ${key} + - COUNT ${limit}`).split("\n").filter(Boolean);
    for (let i = 0; i < entries.length; i++) {
      if (entries[i] === "message_id" && entries[i + 1]) {
        msgIds.add(entries[i + 1]);
      }
    }
  }

  // Fetch all message details in one Redis call using Lua script
  const fields = ["message_id", "from", "to", "type", "status", "content", "created_at", "reply_to_message_id", "trace", "metadata"];
  const messages = [];
  const idList = [...msgIds];

  // Lua script: batch HMGET and return JSON array of arrays
  const luaScript = `
    local r={}
    for i,id in ipairs(ARGV) do
      local d=redis.call("HMGET","agentmsg:detail:"..id,${fields.map(f => `"${f}"`).join(",")})
      r[#r+1]=cjson.encode(d)
    end
    return cjson.encode(r)
  `.replace(/\n/g, " ");

  try {
    const args = idList.join(" ");
    const raw = execSync(`redis-cli --json EVAL '${luaScript}' 0 ${args}`, {
      encoding: "utf8", timeout: 10000, maxBuffer: 10 * 1024 * 1024
    }).trim();
    const outer = JSON.parse(JSON.parse(raw));
    for (const item of outer) {
      const vals = typeof item === "string" ? JSON.parse(item) : item;
      const msg = {};
      for (let i = 0; i < fields.length; i++) {
        if (vals[i] !== null && vals[i] !== false) msg[fields[i]] = vals[i];
      }
      if (msg.message_id) {
        try { msg.trace = JSON.parse(msg.trace || "[]"); } catch { msg.trace = []; }
        try { msg.metadata = JSON.parse(msg.metadata || "{}"); } catch { msg.metadata = {}; }
        messages.push(msg);
      }
    }
  } catch (e) {
    // Fallback: fetch one by one with --json
    for (const id of idList) {
      try {
        const raw = execSync(`redis-cli --json HMGET agentmsg:detail:${id} ${fields.join(" ")}`, {
          encoding: "utf8", timeout: 3000
        }).trim();
        const vals = JSON.parse(raw);
        const msg = {};
        for (let i = 0; i < fields.length; i++) {
          if (vals[i] !== null) msg[fields[i]] = vals[i];
        }
        if (msg.message_id) {
          try { msg.trace = JSON.parse(msg.trace || "[]"); } catch { msg.trace = []; }
          try { msg.metadata = JSON.parse(msg.metadata || "{}"); } catch { msg.metadata = {}; }
          messages.push(msg);
        }
      } catch {}
    }
  }

  // Sort by created_at desc
  messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return messages;
}

function getAgentStats() {
  const inboxKeys = redis('KEYS "agentmsg:inbox:*"').split("\n").filter(Boolean);
  const outboxKeys = redis('KEYS "agentmsg:outbox:*"').split("\n").filter(Boolean);

  const stats = {};
  for (const key of inboxKeys) {
    const agent = key.replace("agentmsg:inbox:", "");
    if (!stats[agent]) stats[agent] = { inbox: 0, outbox: 0 };
    stats[agent].inbox = parseInt(redis(`XLEN ${key}`)) || 0;
  }
  for (const key of outboxKeys) {
    const agent = key.replace("agentmsg:outbox:", "");
    if (!stats[agent]) stats[agent] = { inbox: 0, outbox: 0 };
    stats[agent].outbox = parseInt(redis(`XLEN ${key}`)) || 0;
  }
  return stats;
}

function readPostMeta(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m);
    const contentMatch = content.match(/^content:\s*"(.+?)"/m);
    return {
      title: titleMatch ? titleMatch[1] : "",
      summary: contentMatch ? contentMatch[1].slice(0, 60) : ""
    };
  } catch { return { title: "", summary: "" }; }
}

function getPublishQueue() {
  const result = { pending: [], publishing: [], published: [] };
  for (const status of Object.keys(result)) {
    const dir = path.join(PUBLISH_QUEUE, status);
    try {
      const entries = fs.readdirSync(dir)
        .filter(f => !f.startsWith("."))
        .sort()
        .reverse();
      result[status] = entries.map(f => {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        let meta = { title: "", summary: "" };
        if (stat.isDirectory()) {
          const postMd = path.join(fullPath, "post.md");
          if (fs.existsSync(postMd)) meta = readPostMeta(postMd);
        } else if (f.endsWith(".md")) {
          meta = readPostMeta(fullPath);
        }
        return { name: f, ...meta };
      });
    } catch {}
  }
  return result;
}

function getCronJobs() {
  try {
    const data = fs.readFileSync(path.join(CRON_DIR, "jobs.json"), "utf8");
    return JSON.parse(data);
  } catch { return []; }
}

function getRecentCronRuns(limit = 30) {
  const runsDir = path.join(CRON_DIR, "runs");
  const runs = [];
  try {
    const files = fs.readdirSync(runsDir).filter(f => f.endsWith(".jsonl")).sort().reverse().slice(0, 5);
    for (const file of files) {
      const lines = fs.readFileSync(path.join(runsDir, file), "utf8").split("\n").filter(Boolean);
      for (const line of lines.slice(-limit)) {
        try { runs.push(JSON.parse(line)); } catch {}
      }
    }
  } catch {}
  runs.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return runs.slice(0, limit);
}

function getAgentSessions() {
  const agents = {};
  try {
    const dirs = fs.readdirSync(AGENTS_DIR);
    for (const dir of dirs) {
      const sessFile = path.join(AGENTS_DIR, dir, "sessions", "sessions.json");
      try {
        const data = JSON.parse(fs.readFileSync(sessFile, "utf8"));
        const sessions = Array.isArray(data) ? data : Object.values(data);
        const latest = sessions
          .filter(s => s.updatedAt)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        agents[dir] = {
          sessionCount: sessions.length,
          lastActive: latest ? new Date(latest.updatedAt).toISOString() : null,
          activeSession: latest?.sessionId || null
        };
      } catch {}
    }
  } catch {}
  return agents;
}

function getHeartbeatAgents() {
  try {
    const conf = JSON.parse(fs.readFileSync("/home/rooot/.openclaw/openclaw.json", "utf8"));
    const agents = new Set();
    for (const a of (conf.agents?.list || [])) {
      if (a.heartbeat) agents.add(a.id);
    }
    return agents;
  } catch { return new Set(); }
}

function getAllSessions() {
  const sessions = [];
  const hbAgents = getHeartbeatAgents();
  try {
    const dirs = fs.readdirSync(AGENTS_DIR);
    for (const dir of dirs) {
      const sessFile = path.join(AGENTS_DIR, dir, "sessions", "sessions.json");
      try {
        const data = JSON.parse(fs.readFileSync(sessFile, "utf8"));
        for (const [key, sess] of Object.entries(data)) {
          // Skip parent cron keys (keep only :run: entries to avoid duplicates)
          if (key.includes(":cron:") && !key.includes(":run:")) continue;

          // Parse source from key
          let source = "unknown";
          if (key.includes(":feishu:")) source = "feishu";
          else if (key.includes(":cron:")) source = "cron";
          else if (key.endsWith(":main")) {
            source = hbAgents.has(dir) ? "heartbeat" : "local";
          }
          else if (key.includes(":agent:")) source = "agent";

          // Parse chat type
          let chatType = sess.chatType || "";
          if (key.includes(":group:")) chatType = "group";
          else if (key.includes(":direct:")) chatType = "direct";

          sessions.push({
            agent: dir,
            sessionId: sess.sessionId || "",
            key,
            source,
            chatType,
            updatedAt: sess.updatedAt || 0,
            updatedAtISO: sess.updatedAt ? new Date(sess.updatedAt).toISOString() : null,
            channel: sess.lastChannel || "",
            accountId: sess.lastAccountId || dir,
          });
        }
      } catch {}
    }
  } catch {}
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  return sessions;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/data") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });
    const now = Date.now();
    if (!cachedData || now - cacheTime > CACHE_TTL) {
      cachedData = JSON.stringify({
        timestamp: new Date().toISOString(),
        messages: getMessages(100),
        agentStats: getAgentStats(),
        publishQueue: getPublishQueue(),
        cronJobs: getCronJobs(),
        cronRuns: getRecentCronRuns(30),
        agentSessions: getAgentSessions(),
        allSessions: getAllSessions()
      });
      cacheTime = now;
    }
    res.end(cachedData);
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html"), "utf8"));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`📮 Agent Message Dashboard: http://localhost:${PORT}`);
});
