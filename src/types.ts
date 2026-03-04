export type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

export interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  description: string;
  status: AgentStatus;
  lastAction?: string;
}

export interface Project {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  agent_name: string;
  task_description: string;
  status: string;
  result: string;
  created_at: string;
}
