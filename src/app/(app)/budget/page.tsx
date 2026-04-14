"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BudgetLine, Activity } from "@/lib/types";
import { Plus, Trash2, DollarSign, TrendingUp } from "lucide-react";

export default function BudgetPage() {
  const supabase = createClient();
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    activity_id: "",
    description: "",
    category: "general",
    amount: 0,
    spent: 0,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [linesRes, activitiesRes] = await Promise.all([
      supabase
        .from("budget_lines")
        .select("*, activity:activity_id(id, title)")
        .order("created_at", { ascending: false }),
      supabase.from("activities").select("id, title, total_budget, spent_budget").order("title"),
    ]);
    setBudgetLines((linesRes.data as BudgetLine[]) || []);
    setActivities((activitiesRes.data as Activity[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("budget_lines").insert({ ...form, created_by: user.id });

    if (form.activity_id) {
      const activity = activities.find((a) => a.id === form.activity_id);
      if (activity) {
        await supabase
          .from("activities")
          .update({
            total_budget: Number(activity.total_budget) + form.amount,
            spent_budget: Number(activity.spent_budget) + form.spent,
          })
          .eq("id", form.activity_id);
      }
    }

    setSaving(false);
    setShowForm(false);
    setForm({ activity_id: "", description: "", category: "general", amount: 0, spent: 0 });
    load();
  }

  async function handleDelete(line: BudgetLine) {
    if (!confirm("Delete this budget line?")) return;
    await supabase.from("budget_lines").delete().eq("id", line.id);
    load();
  }

  const totalBudget = budgetLines.reduce((s, l) => s + Number(l.amount), 0);
  const totalSpent = budgetLines.reduce((s, l) => s + Number(l.spent), 0);
  const remaining = totalBudget - totalSpent;
  const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const byCategory: Record<string, { amount: number; spent: number }> = {};
  budgetLines.forEach((l) => {
    if (!byCategory[l.category]) byCategory[l.category] = { amount: 0, spent: 0 };
    byCategory[l.category].amount += Number(l.amount);
    byCategory[l.category].spent += Number(l.spent);
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
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-500 mt-1">Track budget lines per activity</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition text-sm"
        >
          <Plus size={16} /> Add Budget Line
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2.5 rounded-xl">
              <DollarSign size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-xl font-bold text-gray-900">${totalBudget.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2.5 rounded-xl">
              <TrendingUp size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Spent</p>
              <p className="text-xl font-bold text-gray-900">${totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${remaining >= 0 ? "bg-green-100" : "bg-red-100"}`}>
              <DollarSign size={18} className={remaining >= 0 ? "text-green-600" : "text-red-600"} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Remaining</p>
              <p className={`text-xl font-bold ${remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${Math.abs(remaining).toLocaleString()}
                {remaining < 0 && " over"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {totalBudget > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall spending</span>
            <span className="text-sm text-gray-500">{spentPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                spentPercent > 90 ? "bg-red-500" : spentPercent > 70 ? "bg-orange-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(spentPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {Object.keys(byCategory).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">By Category</h2>
          <div className="space-y-3">
            {Object.entries(byCategory).map(([cat, data]) => {
              const pct = data.amount > 0 ? (data.spent / data.amount) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="capitalize text-gray-700 font-medium">{cat}</span>
                    <span className="text-gray-500">
                      ${data.spent.toLocaleString()} / ${data.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-violet-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Budget Lines</h2>
        </div>
        {budgetLines.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No budget lines yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Description</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Activity</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Category</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Budget</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Spent</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">%</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {budgetLines.map((l) => {
                  const pct = Number(l.amount) > 0 ? (Number(l.spent) / Number(l.amount)) * 100 : 0;
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-3 font-medium text-gray-900">{l.description}</td>
                      <td className="px-5 py-3 text-gray-500">{l.activity?.title || "?"}</td>
                      <td className="px-5 py-3">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full capitalize">
                          {l.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-900">${Number(l.amount).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-gray-900">${Number(l.spent).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`text-xs font-medium ${
                            pct > 90 ? "text-red-600" : pct > 70 ? "text-orange-600" : "text-green-600"
                          }`}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(l)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Add Budget Line</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity *</label>
                <select
                  value={form.activity_id}
                  onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">Select activity</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="general">General</option>
                  <option value="personnel">Personnel</option>
                  <option value="equipment">Equipment</option>
                  <option value="travel">Travel</option>
                  <option value="services">Services</option>
                  <option value="supplies">Supplies</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget Amount</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spent</label>
                  <input
                    type="number"
                    value={form.spent}
                    onChange={(e) => setForm({ ...form, spent: Number(e.target.value) })}
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
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
                  {saving ? "Saving..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
