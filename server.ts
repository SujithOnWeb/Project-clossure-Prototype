import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB inside startServer
  const db = new Database("closure.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      agent_name TEXT,
      task_description TEXT,
      status TEXT,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS runtime_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed Sample Data
  const projectCount = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
  if (projectCount.count === 0) {
    const sampleProjects = [
      { id: 'p1', name: 'Project Phoenix', status: 'In Progress' },
      { id: 'p2', name: 'Project Aurora', status: 'Completed' },
      { id: 'p3', name: 'Project Zenith', status: 'In Progress' }
    ];
    
    const insertProject = db.prepare("INSERT INTO projects (id, name, status) VALUES (?, ?, ?)");
    sampleProjects.forEach(p => insertProject.run(p.id, p.name, p.status));
    
    const insertTask = db.prepare("INSERT INTO agent_tasks (id, project_id, agent_name, task_description, status, result) VALUES (?, ?, ?, ?, ?, ?)");
    insertTask.run('t1', 'p2', 'librarian', 'Generate BRD', 'completed', 'BRD generated and stored at: https://sharepoint.com/docs/aurora-brd.pdf');
    insertTask.run('t2', 'p2', 'coordinator', 'Schedule Meeting', 'completed', 'Meeting scheduled for 2024-03-10 at 10:00 AM. Teams link: https://teams.microsoft.com/l/meetup-join/aurora');
    insertTask.run('t3', 'p2', 'auditor', 'Verify Compliance', 'completed', 'All 12 compliance checks passed. Report: https://devops.azure.com/org/project/_build/results?buildId=456');
    insertTask.run('t4', 'p1', 'librarian', 'Gather Requirements', 'completed', 'Requirements gathered from stakeholder interviews. Notes: https://onenote.com/aurora/notes');
  }

  // 1. GLOBAL MIDDLEWARE
  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    console.log(`[SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // 2. API ROUTES
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    console.log("[API] HIT /api/health");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  apiRouter.get("/config/status", (req, res) => {
    console.log("[API] HIT /api/config/status");
    try {
      const required = [
        "GEMINI_API_KEY",
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
        "AZURE_DEVOPS_ORG",
        "AZURE_DEVOPS_PROJECT",
        "AZURE_DEVOPS_PAT"
      ];
      
      const runtimeConfig = db.prepare("SELECT * FROM runtime_config").all() as { key: string, value: string }[];
      const runtimeMap = new Map(runtimeConfig.map(c => [c.key, c.value]));

      const status = required.map(key => {
        const envVal = process.env[key];
        const runtimeVal = runtimeMap.get(key);
        const isSet = !!(envVal || runtimeVal);
        
        return {
          key,
          isSet,
          value: isSet ? "••••••••" : null,
          source: runtimeVal ? "Runtime Override" : (envVal ? "System Env" : "Not Set")
        };
      });
      res.json(status);
    } catch (error) {
      console.error("[API] Error fetching config status:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  apiRouter.get("/projects", (req, res) => {
    console.log("[API] Fetching projects");
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    res.json(projects);
  });

  apiRouter.post("/projects", (req, res) => {
    const { name } = req.body;
    console.log(`[API] Creating project: ${name}`);
    const id = Math.random().toString(36).substring(7);
    db.prepare("INSERT INTO projects (id, name, status) VALUES (?, ?, ?)").run(id, name, "In Progress");
    res.json({ id, name, status: "In Progress" });
  });

  apiRouter.get("/projects/:id/tasks", (req, res) => {
    console.log(`[API] Fetching tasks for project: ${req.params.id}`);
    try {
      const tasks = db.prepare("SELECT * FROM agent_tasks WHERE project_id = ? ORDER BY created_at DESC").all(req.params.id);
      res.json(tasks);
    } catch (error) {
      console.error("[API] Error fetching tasks:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  apiRouter.post("/projects/:id/tasks", (req, res) => {
    const { agent_name, task_description, status, result } = req.body;
    const project_id = req.params.id;
    console.log(`[API] Creating task for project: ${project_id} by ${agent_name}`);
    const id = Math.random().toString(36).substring(7);
    try {
      db.prepare("INSERT INTO agent_tasks (id, project_id, agent_name, task_description, status, result) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, project_id, agent_name, task_description, status, result);
      res.json({ id, project_id, agent_name, task_description, status, result, created_at: new Date().toISOString() });
    } catch (error) {
      console.error("[API] Error creating task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  apiRouter.put("/tasks/:id", (req, res) => {
    const { task_description, result, status } = req.body;
    const { id } = req.params;
    console.log(`[API] Updating task: ${id}`);
    try {
      db.prepare("UPDATE agent_tasks SET task_description = ?, result = ?, status = ? WHERE id = ?")
        .run(task_description, result, status, id);
      res.json({ success: true });
    } catch (error) {
      console.error("[API] Error updating task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  apiRouter.delete("/tasks/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[API] Deleting task: ${id}`);
    try {
      db.prepare("DELETE FROM agent_tasks WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  apiRouter.post("/config/update", (req, res) => {
    const { key, value } = req.body;
    console.log(`[API] Updating config: ${key}`);
    if (!key) return res.status(400).json({ error: "Key is required" });
    
    db.prepare("INSERT OR REPLACE INTO runtime_config (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  apiRouter.get("/auth/microsoft/url", (req, res) => {
    console.log("[API] Generating Microsoft Auth URL");
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${appUrl}/auth/microsoft/callback`;
    const scope = "offline_access user.read calendars.readwrite";
    const url = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(scope)}`;
    res.json({ url });
  });

  // Mount API Router
  app.use("/api", apiRouter);

  // API 404 Handler
  app.use("/api", (req, res) => {
    console.warn(`[API] 404 - Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: "API route not found" });
  });

  // 3. OTHER ROUTES
  app.get("/test-json", (req, res) => {
    res.json({ message: "Root JSON works", timestamp: new Date().toISOString() });
  });

  // OAuth Callback (Not under /api)
  app.get("/auth/microsoft/callback", (req, res) => {
    const { code } = req.query;
    // In a real app, exchange code for tokens here
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'microsoft' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
