import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Calendar, 
  ShieldCheck, 
  CheckCircle2, 
  Plus, 
  Loader2, 
  ChevronRight,
  Terminal,
  AlertCircle,
  ExternalLink,
  History,
  Settings as SettingsIcon,
  LayoutDashboard,
  Key,
  Check,
  X,
  Edit,
  Trash2,
  Save,
  MessageSquare
} from 'lucide-react';
import { Agent, Project, Task } from './types';
import { generateDocumentation, auditProject, executeAgentTask } from './services/geminiService';

const AGENTS: Agent[] = [
  {
    id: 'librarian',
    name: 'The Librarian',
    role: 'Documentation Wizard',
    emoji: '📚',
    description: 'Reads user stories from DevOps, generates BRD/Design docs, and updates the Knowledge Base.',
    status: 'idle'
  },
  {
    id: 'coordinator',
    name: 'The Coordinator',
    role: 'Personal Assistant',
    emoji: '📅',
    description: 'Schedules transition meetings with T2 teams via Microsoft Outlook and Teams.',
    status: 'idle'
  },
  {
    id: 'auditor',
    name: 'The Auditor',
    role: 'Detail-Oriented Inspector',
    emoji: '🕵️‍♀️',
    description: 'Manages handover of operations, verifies code repos, and checks ops readiness.',
    status: 'idle'
  },
  {
    id: 'closer',
    name: 'The Closer',
    role: 'The Big Boss',
    emoji: '✨',
    description: 'Finalizes the project, archives assets, and sends out the final closure report.',
    status: 'idle'
  }
];

export default function App() {
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [logs, setLogs] = useState<string[]>(["System initialized. A-Team standing by."]);
  const [configStatus, setConfigStatus] = useState<{key: string, isSet: boolean, value: string | null, source: string}[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskData, setEditTaskData] = useState<{description: string, result: string}>({description: '', result: ''});
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskData, setNewTaskData] = useState({agent: 'librarian', description: '', result: ''});

  useEffect(() => {
    fetchProjects();
    fetchConfigStatus();
    checkHealth();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchTasks(selectedProject.id);
    }
  }, [selectedProject]);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      console.log("System Health:", data);
    } catch (e) {
      console.error("Health check failed", e);
    }
  };

  const fetchConfigStatus = async () => {
    const url = '/api/config/status';
    try {
      console.log(`Fetching config from: ${url}`);
      const res = await fetch(url);
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error(`Non-JSON response from ${url}:`, text.substring(0, 200));
        throw new Error(`Server returned ${res.status} ${res.statusText} with content-type ${contentType}`);
      }
      const data = await res.json();
      setConfigStatus(data);
    } catch (e) {
      console.error("Failed to fetch config status", e);
      addLog(`System: Failed to sync configuration status. Check console for details.`);
    }
  };

  const updateConfig = async (key: string, value: string) => {
    try {
      await fetch('/api/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      setEditingKey(null);
      setEditValue('');
      fetchConfigStatus();
      addLog(`Configuration updated: ${key}`);
    } catch (e) {
      addLog(`Error updating configuration: ${e}`);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error("Failed to fetch projects", e);
      addLog(`System: Error loading projects.`);
    }
  };

  const fetchTasks = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
      addLog(`System: Error loading tasks for project.`);
    }
  };

  const createProject = async () => {
    if (!newProjectName) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      });
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setProjects([data, ...projects]);
      setSelectedProject(data);
      setIsCreating(false);
      setNewProjectName('');
      addLog(`New project created: ${data.name}`);
    } catch (e) {
      console.error("Failed to create project", e);
      addLog(`System: Error creating new project.`);
    }
  };

  const updateTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_description: editTaskData.description,
          result: editTaskData.result,
          status: 'completed'
        })
      });
      setEditingTask(null);
      if (selectedProject) fetchTasks(selectedProject.id);
      addLog(`Task updated: ${taskId}`);
    } catch (e) {
      addLog(`Error updating task: ${e}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this step?')) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (selectedProject) fetchTasks(selectedProject.id);
      addLog(`Task deleted: ${taskId}`);
    } catch (e) {
      addLog(`Error deleting task: ${e}`);
    }
  };

  const addNewTask = async () => {
    if (!selectedProject || !newTaskData.description) return;
    
    const agentId = newTaskData.agent;
    const agent = agents.find(a => a.id === agentId);
    
    updateAgentStatus(agentId, 'working', 'Executing custom step...');
    setIsAddingTask(false);
    addLog(`${agentId.toUpperCase()} agent executing custom step: ${newTaskData.description}`);

    try {
      const { result } = await executeAgentTask(agent?.name || agentId, agent?.role || 'Agent', newTaskData.description);
      
      await fetch(`/api/projects/${selectedProject.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentId,
          task_description: newTaskData.description,
          status: 'completed',
          result: result
        })
      });
      
      setNewTaskData({agent: 'librarian', description: '', result: ''});
      fetchTasks(selectedProject.id);
      updateAgentStatus(agentId, 'completed', 'Custom step finished');
      addLog(`${agentId.toUpperCase()} agent completed custom step.`);
    } catch (e) {
      updateAgentStatus(agentId, 'error', 'Failed custom step');
      addLog(`Error executing custom step: ${e}`);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const updateAgentStatus = (id: string, status: Agent['status'], lastAction?: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status, lastAction } : a));
  };

  const runAgent = async (agentId: string) => {
    if (!selectedProject) return;
    
    updateAgentStatus(agentId, 'working', 'Processing...');
    addLog(`${agentId.toUpperCase()} agent started for project ${selectedProject.name}`);

    try {
      let result = '';
      let description = '';

      // Simulate agent work with Gemini or API calls
      if (agentId === 'librarian') {
        description = "Generating project documentation and BRD";
        const docs = await generateDocumentation("User wants a login system with SSO. User wants a dashboard with charts. User wants export to PDF.");
        result = `Documentation generated successfully. Stored at: https://sharepoint.com/docs/${selectedProject.id}-brd.pdf`;
        addLog("Librarian: Documentation generated successfully.");
      } else if (agentId === 'coordinator') {
        description = "Scheduling project handover meeting";
        addLog("Coordinator: Initiating Microsoft OAuth flow...");
        const res = await fetch('/api/auth/microsoft/url');
        const { url } = await res.json();
        window.open(url, 'microsoft_auth', 'width=600,height=700');
        result = "OAuth flow initiated. Meeting scheduled for next Tuesday at 2 PM. Link: https://teams.microsoft.com/l/meetup-join/closure";
      } else if (agentId === 'auditor') {
        description = "Performing final project audit and compliance check";
        const audit = await auditProject(["Code Repo Handover", "Access Rights Verified", "Ops Readiness Check"]);
        result = `Audit complete. ${audit.length} items verified. Report: https://devops.azure.com/org/project/_build/results?buildId=${Math.floor(Math.random() * 1000)}`;
        addLog(`Auditor: Audit complete. ${audit.length} items verified.`);
      } else if (agentId === 'closer') {
        description = "Finalizing project and archiving assets";
        addLog("Closer: Finalizing project and archiving assets...");
        await new Promise(r => setTimeout(r, 2000));
        result = "Project archived. All cloud resources decommissioned. Final report sent to stakeholders.";
      }

      // Save task to DB
      await fetch(`/api/projects/${selectedProject.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentId,
          task_description: description,
          status: 'completed',
          result: result
        })
      });

      fetchTasks(selectedProject.id);
      updateAgentStatus(agentId, 'completed', 'Task finished');
      addLog(`${agentId.toUpperCase()} agent completed task.`);
    } catch (error) {
      updateAgentStatus(agentId, 'error', 'Failed');
      addLog(`Error in ${agentId} agent: ${error}`);
    }
  };

  const renderAgentActions = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Agent Steps & Progress</span>
          </div>
          <button 
            onClick={() => setIsAddingTask(true)}
            className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
            title="Add Manual Step"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
          <AnimatePresence>
            {isAddingTask && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-800/50 border border-emerald-500/30 rounded-xl p-4 space-y-3"
              >
                <select 
                  value={newTaskData.agent}
                  onChange={e => setNewTaskData({...newTaskData, agent: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                >
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input 
                  placeholder="What should the agent do? (e.g. 'Check Azure costs')"
                  value={newTaskData.description}
                  onChange={e => setNewTaskData({...newTaskData, description: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={addNewTask} 
                    disabled={!newTaskData.description}
                    className="flex-1 bg-emerald-500 text-black py-2 rounded-lg text-[10px] font-bold hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Execute Step
                  </button>
                  <button onClick={() => setIsAddingTask(false)} className="flex-1 bg-zinc-700 text-zinc-400 py-2 rounded-lg text-[10px] font-bold">Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {tasks.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center opacity-30">
              <MessageSquare className="w-8 h-8 mb-2" />
              <p className="text-[10px] uppercase tracking-widest">No steps recorded yet</p>
            </div>
          ) : (
            tasks.map((task) => {
              const agent = agents.find(a => a.id === task.agent_name);
              const isEditing = editingTask === task.id;

              return (
                <motion.div
                  key={task.id}
                  layout
                  className="group bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-xl mt-0.5">{agent?.emoji || '🤖'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{task.agent_name}</span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isEditing ? (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingTask(task.id);
                                  setEditTaskData({ description: task.task_description, result: task.result });
                                }}
                                className="p-1 text-zinc-500 hover:text-emerald-400"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => deleteTask(task.id)}
                                className="p-1 text-zinc-500 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => updateTask(task.id)} className="p-1 text-emerald-400"><Save className="w-3 h-3" /></button>
                              <button onClick={() => setEditingTask(null)} className="p-1 text-zinc-500"><X className="w-3 h-3" /></button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <input 
                            value={editTaskData.description}
                            onChange={e => setEditTaskData({...editTaskData, description: e.target.value})}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                          />
                          <textarea 
                            value={editTaskData.result}
                            onChange={e => setEditTaskData({...editTaskData, result: e.target.value})}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 h-16 resize-none"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-zinc-300 font-medium mb-2 leading-relaxed">{task.task_description}</p>
                          <div className="text-[10px] text-zinc-500 bg-black/30 rounded p-2 border border-zinc-800/50 break-words">
                            {task.result?.split(' ').map((word, i) => {
                              if (word.startsWith('http')) {
                                return (
                                  <a key={i} href={word} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-0.5">
                                    <ExternalLink className="w-2 h-2" />
                                    Link
                                  </a>
                                );
                              }
                              return word + ' ';
                            })}
                          </div>
                        </>
                      )}
                      
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[9px] text-zinc-600 font-mono">
                          {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-emerald-500" />
                          <span className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-tighter">Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <main className="relative max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar: Projects */}
      <div className="lg:col-span-3 space-y-6">
        <div className="flex items-center gap-2 text-zinc-400 mb-4 px-2">
          <History className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Active Missions</span>
        </div>
        <div className="space-y-2">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedProject?.id === p.id 
                  ? 'bg-zinc-800/50 border-emerald-500/50 shadow-lg' 
                  : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="font-medium mb-1">{p.name}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">{p.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {p.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Agents */}
      <div className="lg:col-span-6 space-y-8">
        {!selectedProject ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-zinc-800 rounded-3xl">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-zinc-400">Select a project to begin closure</h3>
              <p className="text-sm text-zinc-600">The A-Team is ready for deployment.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold">{selectedProject.name}</h2>
                <p className="text-zinc-500">Closure Mission ID: {selectedProject.id}</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Agents Active
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {agents.map((agent, idx) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all overflow-hidden"
                >
                  {/* Progress Bar */}
                  {agent.status === 'working' && (
                    <motion.div 
                      className="absolute bottom-0 left-0 h-1 bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}

                  <div className="flex items-start gap-6">
                    <div className="text-4xl">{agent.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-bold">{agent.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                          agent.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          agent.status === 'working' ? 'bg-amber-500/20 text-amber-400' :
                          agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
                          'bg-zinc-800 text-zinc-500'
                        }`}>
                          {agent.status}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 mb-4">{agent.description}</p>
                      
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => runAgent(agent.id)}
                          disabled={agent.status === 'working'}
                          className="flex items-center gap-2 bg-zinc-100 text-black px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50"
                        >
                          {agent.status === 'working' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                          {agent.status === 'completed' ? 'Rerun Agent' : 'Deploy Agent'}
                        </button>
                        {agent.lastAction && (
                          <span className="text-xs text-zinc-500 italic flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {agent.lastAction}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {renderAgentActions()}
          </>
        )}
      </div>

      {/* Right Sidebar: Agent Steps & Progress */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 h-[80vh] flex flex-col">
          {renderAgentActions()}
        </div>
      </div>
    </main>
  );

  const renderSettings = () => (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-2">Environment Configuration</h2>
        <p className="text-zinc-500">Manage the credentials and API keys for your A-Team agents. Values set here override system defaults.</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <Key className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold">System Variables</h3>
          </div>

          <div className="space-y-4">
            {configStatus.map((config) => (
              <div key={config.key} className="flex flex-col p-4 bg-black/30 border border-zinc-800 rounded-xl transition-all hover:border-zinc-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-mono font-bold mb-1">{config.key}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                      Source: {config.source}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {config.isSet ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        <Check className="w-3 h-3" />
                        ACTIVE
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                        <X className="w-3 h-3" />
                        MISSING
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        setEditingKey(config.key);
                        setEditValue('');
                      }}
                      className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                    >
                      Update
                    </button>
                  </div>
                </div>

                {editingKey === config.key && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-4 border-t border-zinc-800 flex gap-2"
                  >
                    <input 
                      type="password"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      placeholder={`Enter value for ${config.key}`}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <button 
                      onClick={() => updateConfig(config.key, editValue)}
                      className="bg-emerald-500 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-400"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditingKey(null)}
                      className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-emerald-500 mt-1" />
              <div>
                <h4 className="font-bold text-emerald-400 mb-1">Runtime Overrides</h4>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Values entered here are stored in the local database and will override any system-level environment variables. 
                  This is useful for quick testing or when you don't have access to the platform's secrets panel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      <header className="relative border-b border-zinc-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <ShieldCheck className="text-black w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">PROJECT CLOSURE A-TEAM</h1>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Automated Operations Unit</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
              <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === 'dashboard' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
              <button 
                onClick={() => setView('settings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                Configuration
              </button>
            </nav>
          </div>

          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-zinc-100 text-black px-4 py-2 rounded-full font-medium hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </header>

      {view === 'dashboard' ? renderDashboard() : renderSettings()}

      {/* Create Project Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6">Initiate New Mission</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Project Name</label>
                  <input 
                    autoFocus
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="e.g. Project Phoenix"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={createProject}
                    className="flex-1 bg-zinc-100 text-black py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
                  >
                    Confirm Deployment
                  </button>
                  <button 
                    onClick={() => setIsCreating(false)}
                    className="flex-1 bg-zinc-800 text-zinc-400 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors"
                  >
                    Abort
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
