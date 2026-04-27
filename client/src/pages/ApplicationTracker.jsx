import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import { Filter } from "../components/Icons";

const STATUSES = ["Applied", "Online Test", "Interview", "Offer", "Rejected"];

const STATUS_CONFIG = {
  Applied:       { color: "bg-blue-500/15 text-blue-300 border-blue-500/30",     dot: "bg-blue-400" },
  "Online Test": { color: "bg-purple-500/15 text-purple-300 border-purple-500/30", dot: "bg-purple-400" },
  Interview:     { color: "bg-amber-500/15 text-amber-300 border-amber-500/30",   dot: "bg-amber-400" },
  Offer:         { color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  Rejected:      { color: "bg-red-500/15 text-red-300 border-red-500/30",         dot: "bg-red-400" },
};

function startOfDayMs(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function sortByNearestEventDate(list) {
  const today = startOfDayMs(new Date());
  return [...list].sort((a, b) => {
    const da = startOfDayMs(a.date);
    const db = startOfDayMs(b.date);
    const diff = Math.abs(da - today) - Math.abs(db - today);
    if (diff !== 0) return diff;
    return da - db;
  });
}

function toInputDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ApplicationTracker() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company: "",
    role: "",
    status: "Applied",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [editingDateId, setEditingDateId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "", role: "", dateFrom: "", dateTo: "" });

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status) n++;
    if (filters.role.trim()) n++;
    if (filters.dateFrom) n++;
    if (filters.dateTo) n++;
    return n;
  }, [filters]);

  const displayRows = useMemo(() => {
    let list = [...rows];
    if (filters.status) list = list.filter((r) => r.status === filters.status);
    if (filters.role.trim()) {
      const q = filters.role.trim().toLowerCase();
      list = list.filter((r) => r.role.toLowerCase().includes(q));
    }
    if (filters.dateFrom) {
      const from = startOfDayMs(filters.dateFrom);
      list = list.filter((r) => startOfDayMs(r.date) >= from);
    }
    if (filters.dateTo) {
      const to = startOfDayMs(filters.dateTo);
      list = list.filter((r) => startOfDayMs(r.date) <= to);
    }
    return sortByNearestEventDate(list);
  }, [rows, filters]);

  // Pipeline counts
  const pipelineCounts = useMemo(() => {
    const counts = {};
    STATUSES.forEach((s) => { counts[s] = 0; });
    rows.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });
    return counts;
  }, [rows]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/applications");
      setRows(data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.post("/applications", form);
      setForm({ company: "", role: "", status: "Applied", date: new Date().toISOString().slice(0, 10), notes: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add");
    }
  }

  async function updateStatus(id, status) {
    try {
      await api.patch(`/applications/${id}`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Update failed");
    }
  }

  async function updateEventDate(id, dateStr) {
    try {
      await api.patch(`/applications/${id}`, { date: dateStr });
      setEditingDateId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update date");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this application?")) return;
    try {
      await api.delete(`/applications/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  }

  function clearFilters() {
    setFilters({ status: "", role: "", dateFrom: "", dateTo: "" });
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
        className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6"
      >
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
            <span className="text-xl">📊</span>
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Application Tracker</h1>
            <p className="text-slate-400 mt-0.5 text-sm">Track roles, status, and notes in one place.</p>
          </div>
        </div>

        {/* Pipeline summary */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STATUSES.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, status: f.status === s ? "" : s }))}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                    filters.status === s
                      ? `${cfg.color} ring-1 ring-offset-0`
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-[11px] text-slate-400 font-medium truncate">{s}</span>
                  </div>
                  <span className="text-xl font-bold text-white">{pipelineCounts[s]}</span>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add form */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleAdd}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 mb-5 grid md:grid-cols-2 lg:grid-cols-6 gap-4 items-end"
      >
        <div className="lg:col-span-2">
          <label className="block text-xs text-slate-400 mb-1.5">Company</label>
          <input
            required
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            placeholder="e.g. Google"
            className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs text-slate-400 mb-1.5">Role</label>
          <input
            required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="e.g. SWE Intern"
            className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Event Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-5">
          <label className="block text-xs text-slate-400 mb-1.5">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes"
            className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
          />
        </div>
        <div>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full font-semibold bg-gradient-to-r from-brand-500 to-violet-500 hover:from-brand-400 hover:to-violet-400 text-white px-5 py-2.5 rounded-xl text-sm shadow-lg transition-shadow"
          >
            + Add
          </motion.button>
        </div>
      </motion.form>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setFilterOpen((o) => !o)}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border transition-colors ${
            filterOpen || activeFilterCount > 0
              ? "bg-brand-500/15 border-brand-500/40 text-brand-200"
              : "bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-600"
          }`}
        >
          <Filter className="w-4 h-4 shrink-0" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-slate-400 hover:text-white underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
        {displayRows.length > 0 && (
          <span className="text-xs text-slate-600 ml-auto">{displayRows.length} application{displayRows.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden mb-4"
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Role contains</label>
                <input
                  type="search"
                  value={filters.role}
                  onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Engineer"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Event date from</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Event date to</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/30"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr>
                {["Company", "Role", "Status", "Event Date", "Notes", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                      <div className="h-4 w-4 border-2 border-slate-600 border-t-brand-400 rounded-full animate-spin" />
                      Loading applications…
                    </div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                    {rows.length === 0
                      ? "No applications yet — add your first one above 👆"
                      : "No applications match the current filters."}
                  </td>
                </tr>
              ) : (
                displayRows.map((r, idx) => {
                  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG["Applied"];
                  return (
                    <motion.tr
                      key={r._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3.5 text-white font-semibold">{r.company}</td>
                      <td className="px-4 py-3.5 text-slate-300 max-w-[180px] truncate">{r.role}</td>
                      <td className="px-4 py-3.5">
                        <select
                          value={r.status}
                          onChange={(e) => updateStatus(r._id, e.target.value)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${cfg.color}`}
                          style={{ background: "transparent" }}
                        >
                          {STATUSES.map((s) => <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 tabular-nums min-w-[130px]">
                        {editingDateId === r._id ? (
                          <DateEditor
                            initial={toInputDate(r.date)}
                            onSave={(d) => updateEventDate(r._id, d)}
                            onCancel={() => setEditingDateId(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingDateId(r._id); setEditingNotesId(null); }}
                            className="text-left text-brand-400 hover:text-brand-300 hover:underline underline-offset-2 text-sm"
                          >
                            {r.date ? new Date(r.date).toLocaleDateString() : "—"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 max-w-[200px] truncate">
                        {editingNotesId === r._id ? (
                          <NotesEditor
                            initial={r.notes}
                            onSave={async (notes) => {
                              await api.patch(`/applications/${r._id}`, { notes });
                              setEditingNotesId(null);
                              load();
                            }}
                            onCancel={() => setEditingNotesId(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingNotesId(r._id); setEditingDateId(null); }}
                            className="text-left text-slate-500 hover:text-brand-300 truncate max-w-full text-sm transition-colors"
                          >
                            {r.notes || <span className="text-slate-700 italic">add notes…</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(r._id)}
                          className="text-slate-600 hover:text-red-400 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function DateEditor({ initial, onSave, onCancel }) {
  const [v, setV] = useState(initial || "");
  return (
    <div className="flex flex-col gap-1">
      <input
        type="date"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="w-full min-w-[130px] bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => v && onSave(v)} disabled={!v} className="text-xs text-brand-400 disabled:opacity-40">Save</button>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500">Cancel</button>
      </div>
    </div>
  );
}

function NotesEditor({ initial, onSave, onCancel }) {
  const [v, setV] = useState(initial || "");
  return (
    <div className="flex flex-col gap-1">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(v)} className="text-xs text-brand-400">Save</button>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500">Cancel</button>
      </div>
    </div>
  );
}
