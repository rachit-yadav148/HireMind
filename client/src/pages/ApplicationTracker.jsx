import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { Filter } from "../components/Icons";

const STATUSES = ["Applied", "Online Test", "Interview", "Offer", "Rejected"];

function startOfDayMs(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Nearest calendar day to today first, then farther. */
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
  const [filters, setFilters] = useState({
    status: "",
    role: "",
    dateFrom: "",
    dateTo: "",
  });

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
    if (filters.status) {
      list = list.filter((r) => r.status === filters.status);
    }
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

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.post("/applications", form);
      setForm({
        company: "",
        role: "",
        status: "Applied",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
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
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Application Tracker</h1>
        <p className="text-slate-400 mt-1">Track roles, status, and notes in one place.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2 max-w-xl">
          {error}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 mb-6 grid md:grid-cols-2 lg:grid-cols-6 gap-4 items-end"
      >
        <div className="lg:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Company</label>
          <input
            required
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Role</label>
          <input
            required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Event Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-6">
          <label className="block text-xs text-slate-400 mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            placeholder="Optional"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-6">
          <button
            type="submit"
            className="font-semibold bg-brand-500 hover:bg-brand-400 text-white px-5 py-2.5 rounded-xl"
          >
            Add application
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setFilterOpen((o) => !o)}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors ${
            filterOpen || activeFilterCount > 0
              ? "bg-brand-500/15 border-brand-500/40 text-brand-200"
              : "bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-600"
          }`}
          aria-expanded={filterOpen}
          aria-label="Toggle filters"
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
      </div>

      {filterOpen && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role contains</label>
            <input
              type="search"
              value={filters.role}
              onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
              placeholder="e.g. Engineer"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Event date from</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Event date to</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            />
          </div>
          <p className="sm:col-span-2 lg:col-span-4 text-xs text-slate-500">
            Only rows matching every active filter are shown. Order stays: closest event day to today
            first.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Event Date</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {rows.length === 0
                      ? "No applications yet. Add one above."
                      : "No applications match the current filters."}
                  </td>
                </tr>
              ) : (
                displayRows.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">{r.company}</td>
                    <td className="px-4 py-3 text-slate-300">{r.role}</td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        onChange={(e) => updateStatus(r._id, e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white max-w-[140px]"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-400 tabular-nums min-w-[140px]">
                      {editingDateId === r._id ? (
                        <DateEditor
                          initial={toInputDate(r.date)}
                          onSave={(d) => updateEventDate(r._id, d)}
                          onCancel={() => setEditingDateId(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDateId(r._id);
                            setEditingNotesId(null);
                          }}
                          className="text-left text-brand-400 hover:text-brand-300 hover:underline"
                          title="Edit event date"
                        >
                          {r.date ? new Date(r.date).toLocaleDateString() : "—"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={r.notes}>
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
                          onClick={() => {
                            setEditingNotesId(r._id);
                            setEditingDateId(null);
                          }}
                          className="text-left text-brand-400 hover:text-brand-300 truncate max-w-full"
                        >
                          {r.notes || "—"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(r._id)}
                        className="text-red-400 hover:text-red-300 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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
        className="w-full min-w-[130px] bg-slate-950 border border-slate-600 rounded px-2 py-1 text-xs text-white"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => v && onSave(v)}
          disabled={!v}
          className="text-xs text-brand-400 disabled:opacity-40"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500">
          Cancel
        </button>
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
        className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-xs text-white"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(v)} className="text-xs text-brand-400">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
