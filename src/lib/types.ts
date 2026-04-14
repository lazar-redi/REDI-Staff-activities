export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "admin" | "manager" | "member";
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  status: "planned" | "in_progress" | "completed" | "on_hold" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  start_date: string | null;
  deadline: string | null;
  person_in_charge: string | null;
  resources: string | null;
  total_budget: number;
  spent_budget: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  person?: Profile;
}

export interface BudgetLine {
  id: string;
  activity_id: string;
  description: string;
  category: string;
  amount: number;
  spent: number;
  created_by: string;
  created_at: string;
  activity?: Activity;
}

export interface Task {
  id: string;
  activity_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "critical";
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
  creator?: Profile;
  activity?: Activity;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  channel: string;
  content: string;
  created_at: string;
  sender?: Profile;
}
