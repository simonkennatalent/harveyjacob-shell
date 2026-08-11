const SB_URL = "https://acehnasjmgzysntxhrmy.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZWhuYXNqbWd6eXNudHhocm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyOTUwOTQsImV4cCI6MjEwMTg3MTA5NH0.ll1Wj-MnEjD6krfsOY8dK9sANu2s1JVRw6bYwFLSBlg";
const sb = window.supabase.createClient(SB_URL, SB_KEY);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const THREADS = {
  timesheets: { label: "Timesheets", c: "#378add" },
  payroll: { label: "Payroll run", c: "#1d9e75" },
  money: { label: "Money / paid", c: "#639922" },
  approvals: { label: "Approvals", c: "#ba7517" },
  credit_control: { label: "Credit control", c: "#7f77dd" },
};
const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"]];
const TABS = [["timeline", "Timeline"], ["reports", "Reports"], ["team", "Team"], ["clients", "Clients"], ["candidates", "Candidates"], ["payroll_companies", "Payroll Companies"], ["todo", "Todo"], ["inbox", "Inbox"], ["settings", "Settings"]];

let TEAM = [], STEPS = [], REPORTS = [], TAB = "timeline";

async function boot() {
  const { data } = await sb.auth.getSession();
  if (data.session) showApp(data.session); else showLogin();
  sb.auth.onAuthStateChange((_e, s) => { if (s) showApp(s); else showLogin(); });
}
function showLogin() { $("login").classList.remove("hide"); $("app").classList.add("hide"); }
async function doLogin() {
  const msg = $("liMsg");
  msg.textContent = "Signing in…";
  const { error } = await sb.auth.signInWithPassword({ email: $("liEmail").value.trim(), password: $("liPw").value });
  if (error) msg.innerHTML = '<span style="color:#b91c1c">' + esc(error.message) + "</span>";
}
async function showApp(session) {
  $("login").classList.add("hide"); $("app").classList.remove("hide");
  $("who").textContent = session.user.email;
  buildNav(); await loadAll(); render();
}
async function loadAll() {
  const [t, s, r] = await Promise.all([
    sb.from("team").select("*").order("sort").order("name"),
    sb.from("timeline_steps").select("*").order("day").order("sort"),
    sb.from("reports").select("*").order("sort").order("name"),
  ]);
  TEAM = t.data || []; STEPS = s.data || []; REPORTS = r.data || [];
}
function buildNav() {
  $("nav").innerHTML = TABS.map(([k, l]) => `<button class="navb${k === TAB ? " on" : ""}" data-tab="${k}">${l}</button>`).join("");
  $("nav").querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { TAB = b.dataset.tab; buildNav(); render(); }));
}
function render() {
  const v = $("view");
  if (TAB === "timeline") return renderTimeline(v);
  if (TAB === "team") return renderTeam(v);
  if (TAB === "reports") return renderReports(v);
  const names = { clients: "Clients", candidates: "Candidates", payroll_companies: "Payroll Companies", todo: "Todo", inbox: "Inbox", settings: "Settings" };
  v.innerHTML = `<h1>${names[TAB] || TAB}</h1><p class="sub">Part of the build.</p><div class="card muted">The Timeline, Team and Reports are live now. ${names[TAB] || "This section"} is next in the build.</div>`;
}

/* ---------------- TIMELINE (the living map) ---------------- */
function stepCard(s) {
  const c = (THREADS[s.thread] || {}).c || "#999";
  const ppl = Array.isArray(s.people) ? s.people : [];
  const chips = [];
  if (s.system) chips.push(`<span class="chip">${esc(s.system)}</span>`);
  ppl.forEach((p) => chips.push(`<span class="chip" style="background:#e7f5ef;color:#0f6e56">${esc(p)}</span>`));
  return `<div class="step" data-step="${s.id}" style="border-left-color:${c}">
    <div class="t">${esc(s.title)}</div>
    ${s.action_out ? `<div class="meta">&rarr; ${esc(s.action_out)}</div>` : ""}
    <div>${chips.join("")}</div>
  </div>`;
}
function renderTimeline(v) {
  const legend = Object.entries(THREADS).map(([, t]) => `<span style="font-size:11px;color:#5b6b73;margin-right:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${t.c};vertical-align:-1px"></span> ${t.label}</span>`).join("");
  const cols = DAYS.map(([d, label]) => {
    const steps = STEPS.filter((s) => s.day === d);
    return `<div><div class="colhd">${label}</div>${steps.map(stepCard).join("")}<button class="btn ghost sm" style="width:100%;margin-top:8px" data-add="${d}">+ Add</button></div>`;
  }).join("");
  const ongoing = STEPS.filter((s) => s.day === "ongoing");
  v.innerHTML = `<h1>Timeline</h1><p class="sub">The living map of our week. Click any step to edit &mdash; what comes in, what goes out, the templates used, and who's involved.</p>
    <div style="margin-bottom:12px">${legend}</div>
    <div class="board">${cols}</div>
    <div class="card" style="margin-top:16px;background:#f5f3fb;border-color:#ddd6f3">
      <div class="row"><b style="color:#3c3489">Ongoing / weekly &mdash; Credit control &amp; factoring</b><div class="sp"></div><button class="btn ghost sm" data-add="ongoing">+ Add</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px">${ongoing.map(stepCard).join("")}</div>
    </div>`;
  v.querySelectorAll("[data-step]").forEach((el) => (el.onclick = () => editStep(el.dataset.step)));
  v.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => editStep(null, b.dataset.add)));
}
function editStep(id, day) {
  const s = id ? STEPS.find((x) => x.id === id) : { day: day || "mon", thread: "payroll", title: "", info_in: "", action_out: "", template_used: "", email_template: "", sms_template: "", system: "", people: [], notes: "" };
  const ppl = Array.isArray(s.people) ? s.people : [];
  const dayOpts = [...DAYS, ["ongoing", "Ongoing / weekly"]].map(([d, l]) => `<option value="${d}"${s.day === d ? " selected" : ""}>${l}</option>`).join("");
  const threadOpts = Object.entries(THREADS).map(([k, t]) => `<option value="${k}"${s.thread === k ? " selected" : ""}>${t.label}</option>`).join("");
  const teamChecks = TEAM.length
    ? TEAM.map((m) => `<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;text-transform:none;letter-spacing:0;font-weight:400;margin:0 12px 6px 0"><input type="checkbox" class="pplChk" style="width:auto" value="${esc(m.name)}"${ppl.includes(m.name) ? " checked" : ""}> ${esc(m.name)}</label>`).join("")
    : '<span class="muted">Add team members in the Team tab, then assign them here.</span>';
  modal(`<div class="row"><h2 style="margin:0">${id ? "Edit step" : "New step"}</h2><div class="sp"></div>${id ? '<button class="btn danger sm" id="mDel">Delete</button>' : ""}</div>
    <label>Title</label><input id="mTitle" value="${esc(s.title)}">
    <div class="row" style="gap:10px"><div style="flex:1"><label>Day</label><select id="mDay">${dayOpts}</select></div><div style="flex:1"><label>Thread</label><select id="mThread">${threadOpts}</select></div></div>
    <label>Info / action IN</label><textarea id="mIn" rows="2">${esc(s.info_in)}</textarea>
    <label>Report / action OUT</label><textarea id="mOut" rows="2">${esc(s.action_out)}</textarea>
    <div class="row" style="gap:10px"><div style="flex:1"><label>Template used</label><input id="mTpl" value="${esc(s.template_used)}"></div><div style="flex:1"><label>System</label><input id="mSys" value="${esc(s.system)}" placeholder="Xero, Satago, Close Brothers…"></div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><label>Email template sent</label><input id="mEmail" value="${esc(s.email_template)}"></div><div style="flex:1"><label>SMS template sent</label><input id="mSms" value="${esc(s.sms_template)}"></div></div>
    <label>People involved</label><div>${teamChecks}</div>
    <label>Notes</label><textarea id="mNotes" rows="2">${esc(s.notes)}</textarea>
    <div class="row" style="margin-top:18px"><div class="sp"></div><button class="btn ghost" id="mCancel">Cancel</button><button class="btn primary" id="mSave">Save</button></div>`);
  $("mCancel").onclick = closeModal;
  if ($("mDel")) $("mDel").onclick = async () => { await sb.from("timeline_steps").delete().eq("id", id); closeModal(); await loadAll(); render(); };
  $("mSave").onclick = async () => {
    const people = [...document.querySelectorAll(".pplChk:checked")].map((c) => c.value);
    const p = { day: $("mDay").value, thread: $("mThread").value, title: $("mTitle").value.trim(), info_in: $("mIn").value.trim() || null, action_out: $("mOut").value.trim() || null, template_used: $("mTpl").value.trim() || null, system: $("mSys").value.trim() || null, email_template: $("mEmail").value.trim() || null, sms_template: $("mSms").value.trim() || null, people, notes: $("mNotes").value.trim() || null, updated_at: new Date().toISOString() };
    if (!p.title) { $("mTitle").focus(); return; }
    if (id) await sb.from("timeline_steps").update(p).eq("id", id);
    else { p.sort = STEPS.filter((x) => x.day === p.day).length + 1; await sb.from("timeline_steps").insert(p); }
    closeModal(); await loadAll(); render();
  };
}

/* ---------------- TEAM ---------------- */
function renderTeam(v) {
  v.innerHTML = `<div class="row"><div><h1>Team</h1><p class="sub">The people the map refers to. Add everyone involved in the week.</p></div><div class="sp"></div><button class="btn primary" id="addTeam">+ Add person</button></div>
    <div class="card"><table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Login</th><th></th></tr></thead><tbody>${
      TEAM.length ? TEAM.map((m) => `<tr><td><b>${esc(m.name)}</b></td><td class="muted">${esc(m.role || "")}</td><td class="muted">${esc(m.email || "")}</td><td>${m.is_login ? '<span class="chip" style="background:#e7f5ef;color:#0f6e56">yes</span>' : '<span class="muted">&mdash;</span>'}</td><td style="text-align:right"><button class="btn ghost sm" data-teamedit="${m.id}">Edit</button></td></tr>`).join("")
        : '<tr><td colspan="5" class="muted">No team yet. Add the first person.</td></tr>'}</tbody></table></div>`;
  $("addTeam").onclick = () => editTeam(null);
  v.querySelectorAll("[data-teamedit]").forEach((b) => (b.onclick = () => editTeam(b.dataset.teamedit)));
}
function editTeam(id) {
  const m = id ? TEAM.find((x) => x.id === id) : { name: "", role: "", email: "", is_login: false };
  modal(`<div class="row"><h2 style="margin:0">${id ? "Edit person" : "Add person"}</h2><div class="sp"></div>${id ? '<button class="btn danger sm" id="tDel">Delete</button>' : ""}</div>
    <label>Name</label><input id="tName" value="${esc(m.name)}">
    <label>Role</label><input id="tRole" value="${esc(m.role || "")}" placeholder="Director, Payroll, Credit Control, Bookkeeper…">
    <label>Email</label><input id="tEmail" value="${esc(m.email || "")}">
    <label style="text-transform:none;letter-spacing:0;font-weight:400;margin-top:14px"><input type="checkbox" id="tLogin" style="width:auto"${m.is_login ? " checked" : ""}> Has a login</label>
    <div class="row" style="margin-top:18px"><div class="sp"></div><button class="btn ghost" id="tCancel">Cancel</button><button class="btn primary" id="tSave">Save</button></div>`);
  $("tCancel").onclick = closeModal;
  if ($("tDel")) $("tDel").onclick = async () => { await sb.from("team").delete().eq("id", id); closeModal(); await loadAll(); render(); };
  $("tSave").onclick = async () => {
    const p = { name: $("tName").value.trim(), role: $("tRole").value.trim() || null, email: $("tEmail").value.trim() || null, is_login: $("tLogin").checked };
    if (!p.name) { $("tName").focus(); return; }
    if (id) await sb.from("team").update(p).eq("id", id);
    else { p.sort = TEAM.length + 1; await sb.from("team").insert(p); }
    closeModal(); await loadAll(); render();
  };
}

/* ---------------- REPORTS ---------------- */
function renderReports(v) {
  v.innerHTML = `<div class="row"><div><h1>Reports</h1><p class="sub">The spreadsheets and accounting reports we check. Name each, when it happens, who checks it and who it's sent to.</p></div><div class="sp"></div><button class="btn primary" id="addRep">+ Add report</button></div>
    <div class="card"><table><thead><tr><th>Report</th><th>When</th><th>Checked by</th><th>Sent to</th><th></th></tr></thead><tbody>${
      REPORTS.length ? REPORTS.map((r) => { const chk = TEAM.find((t) => t.id === r.checked_by); const sent = Array.isArray(r.sent_to) ? r.sent_to : [];
        return `<tr><td><b>${esc(r.name)}</b>${r.file_path ? ' <span class="chip">file</span>' : ""}</td><td class="muted">${esc(r.cadence || "")}</td><td class="muted">${esc(chk ? chk.name : "")}</td><td class="muted">${sent.map(esc).join(", ")}</td><td style="text-align:right"><button class="btn ghost sm" data-repedit="${r.id}">Edit</button></td></tr>`;
      }).join("") : '<tr><td colspan="5" class="muted">No reports yet. Add the first one.</td></tr>'}</tbody></table></div>`;
  $("addRep").onclick = () => editReport(null);
  v.querySelectorAll("[data-repedit]").forEach((b) => (b.onclick = () => editReport(b.dataset.repedit)));
}
function editReport(id) {
  const r = id ? REPORTS.find((x) => x.id === id) : { name: "", cadence: "", checked_by: null, sent_to: [], notes: "", file_path: null };
  const sent = Array.isArray(r.sent_to) ? r.sent_to : [];
  const chkOpts = '<option value="">&mdash;</option>' + TEAM.map((m) => `<option value="${m.id}"${r.checked_by === m.id ? " selected" : ""}>${esc(m.name)}</option>`).join("");
  const sentChecks = TEAM.length
    ? TEAM.map((m) => `<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;text-transform:none;letter-spacing:0;font-weight:400;margin:0 12px 6px 0"><input type="checkbox" class="sentChk" style="width:auto" value="${esc(m.name)}"${sent.includes(m.name) ? " checked" : ""}> ${esc(m.name)}</label>`).join("")
    : '<span class="muted">Add team first.</span>';
  modal(`<div class="row"><h2 style="margin:0">${id ? "Edit report" : "Add report"}</h2><div class="sp"></div>${id ? '<button class="btn danger sm" id="rDel">Delete</button>' : ""}</div>
    <label>Report name</label><input id="rName" value="${esc(r.name)}">
    <div class="row" style="gap:10px"><div style="flex:1"><label>When it happens</label><input id="rCad" value="${esc(r.cadence || "")}" placeholder="Weekly Friday, Month-end…"></div><div style="flex:1"><label>Checked by</label><select id="rChk">${chkOpts}</select></div></div>
    <label>Sent to</label><div>${sentChecks}</div>
    <label>File</label><input type="file" id="rFile" style="border:none;padding:6px 0">
    <div id="rFileNote" class="muted">${r.file_path ? "Current: " + esc(r.file_path) : ""}</div>
    <label>Notes</label><textarea id="rNotes" rows="2">${esc(r.notes || "")}</textarea>
    <div class="row" style="margin-top:18px"><div class="sp"></div><button class="btn ghost" id="rCancel">Cancel</button><button class="btn primary" id="rSave">Save</button></div>`);
  $("rCancel").onclick = closeModal;
  if ($("rDel")) $("rDel").onclick = async () => { await sb.from("reports").delete().eq("id", id); closeModal(); await loadAll(); render(); };
  $("rSave").onclick = async () => {
    const btn = $("rSave"); btn.disabled = true; btn.textContent = "Saving…";
    const sent_to = [...document.querySelectorAll(".sentChk:checked")].map((c) => c.value);
    let file_path = r.file_path || null;
    const f = $("rFile").files && $("rFile").files[0];
    if (f) { const path = Date.now() + "_" + f.name.replace(/[^\w.\-]/g, "_"); const up = await sb.storage.from("reports").upload(path, f, { upsert: true }); if (!up.error) file_path = path; }
    const p = { name: $("rName").value.trim(), cadence: $("rCad").value.trim() || null, checked_by: $("rChk").value || null, sent_to, notes: $("rNotes").value.trim() || null, file_path };
    if (!p.name) { btn.disabled = false; btn.textContent = "Save"; $("rName").focus(); return; }
    if (id) await sb.from("reports").update(p).eq("id", id);
    else { p.sort = REPORTS.length + 1; await sb.from("reports").insert(p); }
    closeModal(); await loadAll(); render();
  };
}

/* ---------------- modal helpers ---------------- */
function modal(html) { closeModal(); const o = document.createElement("div"); o.className = "ov"; o.id = "ov"; o.innerHTML = `<div class="modal">${html}</div>`; document.body.appendChild(o); o.addEventListener("click", (e) => { if (e.target === o) closeModal(); }); }
function closeModal() { const o = $("ov"); if (o) o.remove(); }

/* ---------------- init ---------------- */
$("liBtn").onclick = doLogin;
$("liPw").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
$("signout").onclick = () => sb.auth.signOut();
boot();
