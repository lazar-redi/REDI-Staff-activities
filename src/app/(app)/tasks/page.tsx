"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task, Profile, Activity, TaskComment } from "@/lib/types";
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  Search,
  CheckCircle2,
  Send,
  X,
} from "lucide-react";

const STATUS_OPTIONS = ["todo", "in_progress", "review", "done"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;

const statusColor: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
};

const priorityColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  critical: "bg-red-100 text-red-600",
};

type TaskForm = {
  title: string;
  description: string;
  status: Task["status"];
  priority: Task["priority"];
  activity_id: string;
  assigned_to: string;
  due_date: string;
};

const emptyTask: TaskForm = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  activity_id: "",
  assigned_to: "",
  due_date: "",
};

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyTask);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async () => {
    const [tasksRes, membersRes, activitiesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, assignee:assigned_to(id, full_name), creator:created_by(id, full_name), activity:activity_id(id, title)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("activities").select("id, title").order("title"),
    ]);
    setTasks((tasksRes.data as Task[]) || []);
    setMembers((membersRes.data as Profile[]) || []);
    setActivities((activitiesRes.data as Activity[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadComments(taskId: string) {
    const { data } = await supabase
      .from("task_comments")
      .select("*, author:author_id(id, full_name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    setComments((data as TaskComment[]) || []);
  }

  function openTask(t: Task) {
    setSelectedTask(t);
    loadComments(t.id);
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;
    setSendingComment(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("task_comments").insert({
      task_id: selectedTask.id,
      author_id: user.id,
      content: newComment.trim(),
    });
    setNewComment("");
    setSendingComment(false);
    loadComments(selectedTask.id);
  }

  async function resolveTask(task: Task) {
    await supabase
      .from("tasks")
      .update({ status: "done", resolved_at: new Date().toISOString() })
      .eq("id", task.id);
    load();
    if (selectedTask?.id === task.id) {
      setSelectedTask({ ...task, status: "done" });
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyTask);
    setShowForm(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || "",
      status: t.status,
      priority: t.priority,
      activity_id: t.activity_id || "",
      assigned_to: t.assigned_to || "",
      due_date: t.due_date || "",
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      ...form,
      activity_id: form.activity_id || null,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      resolved_at: form.status === "done" ? new Date().toISOString() : null,
    };

    if (editing) {
      await supabase.from("tasks").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("tasks").insert({ ...payload, created_by: user.id });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    load();
    if (selectedTask?.id === id) setSelectedTask(null);
  }

  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus ? t.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Assign, track and resolve tasks</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition text-sm"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-6">
        <div className={`flex-1 ${selectedTask ? "hidden lg:block" : ""}`}>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <p className="text-gray-500">No tasks found</p>
              <button onClick={openCreate} className="text-blue-600 hover:underline text-sm mt-2">
                Create your first task
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openTask(t)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-sm transition ${
                    selectedTask?.id === t.id ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className={`font-medium ${t.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
                          {t.title}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[t.status]}`}>
                          {t.status.replace("_", " ")}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[t.priority]}`}>
                          {t.priority}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-400 mt-1">
                        {t.assignee && <span>Assigned to {t.assignee.full_name}</span>}
                        {t.activity && <span>Activity: {t.activity.title}</span>}
                        {t.due_date && <span>Due {new Date(t.due_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {t.status !== "done" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); resolveTask(t); }}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Mark done"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedTask && (
          <div className="w-full lg:w-96 bg-white rounded-xl border border-gray-100 flex flex-col max-h-[70vh]">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare size={14} /> Task Discussion
              </h3>
              <button onClick={() => setSelectedTask(null)} className="lg:hidden p-1 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="font-medium text-gray-900 text-sm">{selectedTask.title}</p>
              {selectedTask.description && (
                <p className="text-xs text-gray-500 mt-1">{selectedTask.description}</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {comments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No comments yet. Start the discussion!
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-gray-900 text-xs">
                      {c.author?.full_name || "Unknown"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs bg-gray-50 rounded-lg px-3 py-2">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
            <form onSubmit={sendComment} className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={sendingComment || !newComment.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{editing ? "Edit Task" : "New Task"}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
                <select
                  value={form.activity_id}
                  onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- No activity --</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Unassigned --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
