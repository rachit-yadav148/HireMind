import Application from "../models/Application.js";

function startOfDayMs(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Nearest calendar day to today first, then farther (tie-break by date ascending). */
function sortByNearestEventDate(apps) {
  const today = startOfDayMs(new Date());
  return [...apps].sort((a, b) => {
    const da = startOfDayMs(a.date);
    const db = startOfDayMs(b.date);
    const diff = Math.abs(da - today) - Math.abs(db - today);
    if (diff !== 0) return diff;
    return da - db;
  });
}

export async function list(req, res) {
  try {
    const apps = await Application.find({ userId: req.userId }).lean();
    res.json(sortByNearestEventDate(apps));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function create(req, res) {
  try {
    const { company, role, status, date, notes } = req.body;
    if (!company?.trim() || !role?.trim()) {
      return res.status(400).json({ message: "Company and role are required" });
    }
    const app = await Application.create({
      userId: req.userId,
      company: company.trim(),
      role: role.trim(),
      status: status || "Applied",
      date: date ? new Date(date) : new Date(),
      notes: notes || "",
    });
    res.status(201).json(app);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function update(req, res) {
  try {
    const { company, role, status, date, notes } = req.body;
    const app = await Application.findOne({ _id: req.params.id, userId: req.userId });
    if (!app) return res.status(404).json({ message: "Application not found" });
    if (company != null) app.company = company.trim();
    if (role != null) app.role = role.trim();
    if (status != null) app.status = status;
    if (date != null) app.date = new Date(date);
    if (notes != null) app.notes = notes;
    await app.save();
    res.json(app);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function remove(req, res) {
  try {
    const app = await Application.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!app) return res.status(404).json({ message: "Application not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
