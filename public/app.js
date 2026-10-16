"use strict";
const $ = id => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";
const messages = {task_started:"开始执行 Bugku 签到任务",tests_passed:"离线测试通过",tests_failed:"离线测试未通过",login_success:"登录成功",checked_in:"签到成功",already_done:"当日已签到，无需重复操作",captcha_retry:"验证码未通过，重新获取后重试",checkin_failed:"签到失败，请登录 GitHub 查看详情",checkin_skipped:"签到步骤未执行",network_failure:"请求超时或网络连接失败",captcha_failed:"验证码达到重试上限",task_finished:"本次执行结束"};
const stepNames = {python:"准备环境",dependencies:"安装依赖",tests:"离线测试",checkin:"登录签到"};
const labels = {checked_in:"签到成功",already_done:"当日已签到",failed:"执行异常",unknown:"等待结果",skipped:"未执行"};
let data = {runs:[]}, filter = "all", selectedId = null;

function icon(name) {
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "icon"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svgNS, "use"); use.setAttribute("href", `icons.svg#${name}`); svg.append(use);
  return svg;
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function date(value, options) {return new Intl.DateTimeFormat("zh-CN", {timeZone:"Asia/Taipei", ...options}).format(new Date(value));}
function runLink(id) {
  const owner = location.hostname.endsWith(".github.io") ? location.hostname.slice(0, -".github.io".length) : "";
  if (!owner) return "https://github.com/";
  const base = `https://github.com/${owner}/autoSign/actions`;
  return /^\d+$/.test(String(id)) ? `${base}/runs/${id}` : base;
}

const systemTheme = matchMedia("(prefers-color-scheme: dark)");
function applyTheme(mode, persist = false) {
  if (!["system", "dark", "light"].includes(mode)) mode = "system";
  if (mode === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  $("theme").value = mode;
  const dark = mode === "dark" || (mode === "system" && systemTheme.matches);
  $("theme-icon").replaceChildren(icon(mode === "system" ? "monitor" : dark ? "moon" : "sun"));
  $("theme").title = `${mode === "system" ? "跟随系统" : "手动选择"}，当前${dark ? "深色" : "浅色"}`;
  if (persist) {try {localStorage.setItem("autosign-theme", mode);} catch {}}
}
let initialTheme = "system";
try {initialTheme = localStorage.getItem("autosign-theme") || "system";} catch {}
applyTheme(initialTheme);
$("theme").addEventListener("change", event => applyTheme(event.target.value, true));
systemTheme.addEventListener("change", () => {if ($("theme").value === "system") applyTheme("system");});

function render() {
  const runs = data.runs, last = runs[0], recent = runs.slice(0,30), succeeded = recent.filter(run => run.status === "success").length;
  $("run-count").replaceChildren(document.createTextNode(String(runs.length)), el("small", "次"));
  $("record-count").textContent = String(runs.length);
  $("success-rate").replaceChildren(document.createTextNode(recent.length ? String(Math.round(succeeded / recent.length * 100)) : "—"), el("small", "%"));
  $("success-detail").textContent = recent.length ? `${succeeded} 次成功 / ${recent.length} 次运行` : "还没有运行记录";
  $("duration").replaceChildren(document.createTextNode(last ? String(Math.round(last.duration_seconds)) : "—"), el("small", "秒"));
  const now = new Date(), local = new Date(now.getTime() + 8 * 3600000);
  const next = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 17));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  $("next-run").textContent = `${date(next, {month:"2-digit", day:"2-digit"})} · 每天自动执行`;
  $("updated-at").textContent = data.updated_at ? `最近同步 ${date(data.updated_at, {month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"})}` : "尚未同步运行数据";
  const success = last?.status === "success";
  document.querySelector(".status-panel").dataset.state = last ? success ? "success" : "failure" : "waiting";
  $("hero-icon").replaceChildren(icon(last ? success ? "circle-check" : "circle-x" : "clock-3"));
  $("hero-title").textContent = last ? labels[last.result] || "运行已结束" : "等待首次运行";
  $("hero-description").textContent = last ? success ? "最近一次签到任务已顺利完成。" : "本次执行需要关注，请查看下方日志。" : "下一次签到完成后，记录将自动同步。";
  $("hero-status").textContent = last ? success ? "运行成功" : "需要关注" : "等待同步";
  $("hero-time").textContent = last ? date(last.finished_at, {hour:"2-digit", minute:"2-digit", second:"2-digit"}) : "08:17";
  $("hero-date").textContent = last ? `${date(last.finished_at, {year:"numeric", month:"2-digit", day:"2-digit"})} · 台北时间` : "每天 · 台北时间";
  const visible = runs.filter(run => filter === "all" || (filter === "success" ? run.status === "success" : run.status !== "success"));
  if (!selectedId || !runs.some(run => run.id === selectedId)) selectedId = last?.id || null;
  const body = $("runs"); body.replaceChildren();
  if (!visible.length) {
    const row = el("tr"), cell = el("td", runs.length ? "没有符合条件的记录" : "等待首次签到记录", "empty");
    cell.colSpan = 3; row.append(cell); body.append(row);
  }
  for (const run of visible) {
    const row = el("tr"); row.classList.toggle("record-selected", run.id === selectedId); row.dataset.runId = run.id;
    const time = el("td", date(run.started_at, {month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"}));
    const context = el("small"); context.append(icon(run.trigger === "schedule" ? "clock-3" : "play"), document.createTextNode(run.trigger === "schedule" ? "定时执行" : "手动执行")); time.append(context);
    const result = el("td"), badge = el("span", undefined, `result-badge ${run.status === "success" ? "" : "bad"}`);
    badge.append(icon(run.status === "success" ? "check" : "circle-x"), document.createTextNode(labels[run.result] || "执行结束")); result.append(badge);
    const action = el("td"), button = el("button", undefined, "row-button"); button.type = "button"; button.setAttribute("aria-label", `查看运行 ${run.id} 的日志`); button.append(icon("arrow-up-right"));
    button.addEventListener("click", () => showDetails(run.id)); action.append(button); row.append(time, result, action); body.append(row);
  }
  if (selectedId) showDetails(selectedId);
  else {$("steps").replaceChildren(); $("log-lines").replaceChildren(el("p", "等待运行数据…", "log-empty"));}
}

function showDetails(id) {
  const run = data.runs.find(item => item.id === id); if (!run) return;
  selectedId = id;
  document.querySelectorAll("tr[data-run-id]").forEach(row => row.classList.toggle("record-selected", row.dataset.runId === id));
  $("detail-time").textContent = date(run.started_at, {year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"});
  $("detail-link").href = runLink(run.id); $("detail-id").textContent = `RUN #${run.id}`;
  $("log-result").textContent = run.status === "success" ? "执行完成" : "需要关注";
  $("steps").replaceChildren();
  for (const step of run.steps || []) {
    if (!stepNames[step.name]) continue;
    const node = el("div", undefined, "step"), status = el("span", undefined, `step-icon ${step.status === "failure" ? "bad" : ""}`);
    status.append(icon(step.status === "success" ? "circle-check" : step.status === "skipped" ? "minus" : "circle-x"));
    const copy = el("div", undefined, "step-copy"); copy.append(el("span", stepNames[step.name]), el("small", `${Math.round(step.duration_seconds)} 秒`)); node.append(status, copy); $("steps").append(node);
  }
  $("log-lines").replaceChildren();
  let index = 0;
  for (const log of run.logs || []) {
    if (!messages[log.code]) continue;
    const level = ["info", "warning", "error"].includes(log.level) ? log.level : "info";
    const node = el("div", undefined, `log-line ${level}`), levelIcon = el("span", undefined, "log-level");
    levelIcon.append(icon(level === "warning" ? "triangle-alert" : level === "error" ? "circle-x" : "chevron-right"));
    node.append(el("span", String(++index).padStart(2,"0"), "line-number"), levelIcon, el("span", messages[log.code], "log-message")); $("log-lines").append(node);
  }
}

async function refresh() {
  $("refresh").disabled = true; $("refresh-icon").classList.add("spin");
  try {
    const response = await fetch(`status.json?t=${Date.now()}`, {cache:"no-store", credentials:"omit"});
    if (!response.ok) throw new Error("fetch");
    const next = await response.json();
    if (next.schema_version !== 1 || !Array.isArray(next.runs)) throw new Error("format");
    const previous = data; data = next;
    try {render();} catch (error) {data = previous; throw error;}
    $("notice").hidden = true;
  } catch {
    $("notice-text").textContent = "暂时无法获取最新记录。已加载的数据会保留，请稍后刷新。"; $("notice").hidden = false;
    if (!data.runs.length) {
      $("hero-title").textContent = "暂时无法读取数据"; $("hero-description").textContent = "请稍后刷新，或前往 GitHub 查看运行记录。"; $("hero-status").textContent = "连接异常";
      $("runs").replaceChildren(); const row = el("tr"), cell = el("td", "数据读取失败", "empty"); cell.colSpan = 3; row.append(cell); $("runs").append(row);
    }
  } finally {$("refresh").disabled = false; $("refresh-icon").classList.remove("spin");}
}
document.querySelector("[data-actions]").href = runLink();
$("refresh").addEventListener("click", refresh);
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(item => {item.classList.toggle("selected", item === button); item.setAttribute("aria-pressed", String(item === button));});
  render();
}));
refresh(); setInterval(() => {if (!document.hidden) refresh();}, 60000);
