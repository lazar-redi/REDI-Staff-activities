"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FolderKanban,
  CheckSquare,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { Activity, Task } from "@/lib/types";

export default function DashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    activities: 0,
    tasks: 0,
    completedTasks: 0,
    totalBudget: 0,
    spentBudget: 0,
    overdueTasks: 0,
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [activitiesRes, tasksRes, budgetRes, recentRes, upcomingRes] =
        await Promise.all([
          supabase.from("activities").select("id", { count: "exact" }),
          supabase.from("tasks").select("id, status, due_date", { count: "exact" }),
          supabase.from("activities").select("total_budget, spent_budget"),
          supabase
            .from("activities")
            .select("*, profiles:person_in_charge(full_name)")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("tasks")
            .select("*, assignee:assigned_to(full_name)")
            .neq("status", "done")
            .order("due_date", { ascending: true })
            .limit(5),
        ]);

      const tasks = tasksRes.data || [];
      const budgetData = budgetRes.data || [];

      setStats({
        activities: activitiesRes.count || 0,
        tasks: tasksRes.count || 0,
        completedTasks: tasks.filter((t) => t.status === "done").length,
        totalBudget: budgetData.reduce(
          (s, a) => s + Number(a.total_budget || 0),
          0
        ),
        spentBudget: budgetData.reduce(
          (s, a) => s + Number(a.spent_budget || 0),
          0
        ),
        overdueTasks: tasks.filter(
          (t) =>
            t.due_date &&
            new Date(t.due_date) < new Date() &&
            t.status !== "done"
        ).length,
      });
      setRecentActivities((recentRes.data as Activity[]) || []);
      setUpcomingTasks((upcomingRes.data as Task[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    {
      label: "Activities",
      value: stats.activities,
      icon: FolderKanban,
      color: "bg-blue-500",
      href: "/activities",
    },
    {
      label: "Tasks",
      value: stats.tasks,
      icon: CheckSquare,
      color: "bg-violet-500",
      href: "/tasks",
    },
    {
      label: "Budget Used",
      value:
        stats.totalBudget > 0
          ? `${Math.round((stats.spentBudget / stats.totalBudget) * 100)}%`
          : "0%",
      icon: DollarSign,
      color: "bg-emerald-500",
      href: "/budget",
    },
    {
      label: "Overdue",
      value: stats.overdueTasks,
      icon: AlertTriangle,
      color: "bg-red-500",
      href: "/tasks",
    },
  ];

  const statusColor: Record<string, string> = {
    planned: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    on_hold: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-700",
    todo: "bg-gray-100 text-gray-700",
    review: "bg-purple-100 text-purple-700",
    done: "bg-green-100 text-green-700",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Overview of REDI Staff Activities
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {card.value}
                </p>
              </div>
              <div
                className={`${card.color} p-3 rounded-xl text-white`}
              >
                <card.icon size={20} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              Recent Activities
            </h2>
            <Link
              href="/activities"
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {recentActivities.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">
              No activities yet. Create your first one!
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((a) => (
                <Link
                  key={a.id}
                  href="/activities"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {a.deadline
                        ? `Due ${new Date(a.deadline).toLocaleDateString()}`
                        : "No deadline"}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusColor[a.status]}`}
                  >
                    {a.status.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-violet-500" />
              Upcoming Tasks
            </h2>
            <Link
              href="/tasks"
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">
              No pending tasks. Great job!
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((t) => (
                <Link
                  key={t.id}
                  href="/tasks"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {t.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t.due_date
                        ? `Due ${new Date(t.due_date).toLocaleDateString()}`
                        : "No due date"}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusColor[t.status]}`}
                  >
                    {t.status.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
