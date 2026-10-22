"use strict";
const $ = id => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";
const messages = {task_started:"开始执行签到任务",tests_passed:"离线测试通过",tests_failed:"离线测试未通过",login_success:"登录成功",checked_in:"签到成功",already_done:"当日已签到，无需重复操作",captcha_retry:"验证码未通过，重新获取后重试",checkin_failed:"签到失败，请登录 GitHub 查看详情",checkin_skipped:"签到步骤未执行",network_failure:"请求超时或网络连接失败",captcha_failed:"验证码达到重试上限",task_finished:"本次执行结束"};
Object.assign(messages, {http_failure:"网站接口返回异常状态",invalid_response:"接口返回格式异常",login_failed:"登录被拒绝或会话已失效",reward_unconfirmed:"未找到当天的每日登录奖励",configuration_failed:"签到账号配置缺失或无效",runtime_failed:"运行库或 OCR 初始化失败"});
const stepNames = {python:"准备程序",dependencies:"准备运行库",tests:"离线测试",checkin:"登录签到"};
const stageNames = {configuration:"检查账号配置",runtime:"初始化运行环境",login_page:"访问登录页",captcha:"获取或识别验证码",login:"登录账号",checkin:"提交签到",reward:"核验每日奖励"};
const labels = {checked_in:"签到成功",already_done:"当日已签到",failed:"执行异常",unknown:"等待结果",skipped:"未执行"};
const platforms = {bugku:"BUGKU CTF", nssctf:"NSSCTF"};
const platformNames = {bugku:"Bugku CTF", nssctf:"NSSCTF"};
const platformOf = run => run.platform || "bugku";
let data = {runs:[]}, filter = "all", selectedId = null, platform = "bugku";
function failureStage(run) {
  const failed = (run.steps || []).find(step => step.status === "failure");
  return (Object.hasOwn(stageNames, run.stage) ? stageNames[run.stage] : null) || stepNames[failed?.name] || "签到任务";
}
function failureTitle(run) {return `${platformNames[platformOf(run)]} · ${run.status === "cancelled" ? "运行已取消" : run.result === "skipped" ? "签到未执行" : `${failureStage(run)}失败`}`;}
function failureReason(run) {
  const code = run.error_code || (run.logs || []).find(log => log.level === "error")?.code;
  const reason = code === "checkin_failed" || !Object.hasOwn(messages, code) ? "具体原因未记录，请到 GitHub 查看完整日志" : messages[code];
  const http = Number.isInteger(run.http_status) && run.http_status >= 100 && run.http_status <= 599 ? `（HTTP ${run.http_status}）` : "";
  return reason + http;
}

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
const themeNames = {system:"跟随系统", dark:"深色模式", light:"浅色模式"};
const themeOptions = [...document.querySelectorAll("[data-theme-mode]")];
let currentTheme = "system";
function applyTheme(mode, persist = false) {
  if (!["system", "dark", "light"].includes(mode)) mode = "system";
  currentTheme = mode;
  if (mode === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  $("theme-label").textContent = themeNames[mode];
  themeOptions.forEach(option => option.setAttribute("aria-checked", String(option.dataset.themeMode === mode)));
  const dark = mode === "dark" || (mode === "system" && systemTheme.matches);
  $("theme-icon").replaceChildren(icon(mode === "system" ? "monitor" : dark ? "moon" : "sun"));
  $("theme").setAttribute("aria-description", `${mode === "system" ? "跟随系统" : "手动选择"}，当前${dark ? "深色" : "浅色"}`);
  if (persist) {try {localStorage.setItem("autosign-theme", mode);} catch {}}
}
let initialTheme = "system";
try {initialTheme = localStorage.getItem("autosign-theme") || "system";} catch {}
applyTheme(initialTheme);
function closeThemeMenu(restoreFocus = false) {
  $("theme-menu").hidden = true; $("theme").setAttribute("aria-expanded", "false");
  if (restoreFocus) $("theme").focus();
}
function openThemeMenu() {
  $("theme-menu").hidden = false; $("theme").setAttribute("aria-expanded", "true");
  themeOptions.find(option => option.dataset.themeMode === currentTheme).focus();
}
$("theme").addEventListener("click", () => {if ($("theme-menu").hidden) openThemeMenu(); else closeThemeMenu();});
$("theme").addEventListener("keydown", event => {
  if (["ArrowDown", "ArrowUp"].includes(event.key)) {event.preventDefault(); openThemeMenu();}
});
themeOptions.forEach(option => option.addEventListener("click", () => {applyTheme(option.dataset.themeMode, true); closeThemeMenu(true);}));
$("theme-menu").addEventListener("keydown", event => {
  const index = themeOptions.indexOf(document.activeElement);
  let next;
  if (event.key === "ArrowDown") next = (index + 1) % themeOptions.length;
  if (event.key === "ArrowUp") next = (index - 1 + themeOptions.length) % themeOptions.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = themeOptions.length - 1;
  if (next !== undefined) {event.preventDefault(); themeOptions[next].focus();}
  if (event.key === "Tab") closeThemeMenu(true);
});
document.addEventListener("keydown", event => {if (event.key === "Escape" && !$("theme-menu").hidden) {event.preventDefault(); closeThemeMenu(true);}});
document.addEventListener("click", event => {if (!event.target.closest(".theme-picker")) closeThemeMenu();});
document.addEventListener("focusin", event => {if (!event.target.closest(".theme-picker")) closeThemeMenu();});
systemTheme.addEventListener("change", () => {if (currentTheme === "system") applyTheme("system");});

let toastTimer;
function dismissToast() {clearTimeout(toastTimer); $("toast").hidden = true;}
function scheduleToastDismiss() {
  clearTimeout(toastTimer);
  if ($("toast").dataset.state === "success" && !$("toast").matches(":hover, :focus-within")) toastTimer = setTimeout(dismissToast, 5500);
}
function showToast(state, title, description) {
  clearTimeout(toastTimer);
  $("toast").dataset.state = state;
  $("toast-icon").replaceChildren(icon(state === "loading" ? "refresh-cw" : state === "error" ? "triangle-alert" : "circle-check"));
  $("toast-title").textContent = title; $("toast-description").textContent = description;
  $("toast-retry").hidden = state !== "error"; $("toast").hidden = false;
  scheduleToastDismiss();
}
$("toast-close").addEventListener("click", () => {$("refresh").focus(); dismissToast();});
$("toast").addEventListener("mouseenter", () => clearTimeout(toastTimer));
$("toast").addEventListener("mouseleave", scheduleToastDismiss);
$("toast").addEventListener("focusin", () => clearTimeout(toastTimer));
$("toast").addEventListener("focusout", event => {if (!$("toast").contains(event.relatedTarget)) scheduleToastDismiss();});
$("toast-retry").addEventListener("click", () => {$("toast-close").focus(); refresh({notify:true});});

function render() {
  const runs = data.runs.filter(run => platformOf(run) === platform), last = runs[0], recent = runs.slice(0,30), succeeded = recent.filter(run => run.status === "success").length;
  $("service-label").textContent = platforms[platform];
  const overview = $("failure-overview"); overview.replaceChildren();
  for (const site of Object.keys(platforms)) {
    const failed = data.runs.find(run => platformOf(run) === site);
    if (!failed || failed.status === "success") continue;
    const item = el("div", undefined, "failure-item"), copy = el("div"), button = el("button", "查看失败日志", "button");
    copy.append(el("strong", failureTitle(failed)), el("p", failureReason(failed)));
    button.type = "button"; button.setAttribute("aria-label", `查看 ${platformNames[site]} 失败日志`);
    button.addEventListener("click", () => {platform = site; selectedId = failed.id; render(); $("details").scrollIntoView({block:"nearest"});});
    item.append(icon("triangle-alert"), copy, button); overview.append(item);
  }
  overview.hidden = !overview.childElementCount;
  document.querySelectorAll("[data-platform]").forEach(button => {
    const latest = data.runs.find(run => platformOf(run) === button.dataset.platform);
    button.dataset.state = latest ? latest.status === "success" ? "success" : "failure" : "waiting";
    button.querySelector("small").textContent = latest ? latest.status === "success" ? labels[latest.result] || "执行结束" : latest.status === "cancelled" ? "已取消" : latest.result === "skipped" ? "未执行" : `${failureStage(latest)}失败` : "等待首次运行";
    button.setAttribute("aria-pressed", String(button.dataset.platform === platform));
  });
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
  $("hero-title").textContent = last ? success ? labels[last.result] || "运行已结束" : failureTitle(last) : "等待首次运行";
  $("hero-description").textContent = last ? success ? platform === "nssctf" ? "已核验当天的每日登录奖励通知。" : "最近一次签到任务已顺利完成。" : failureReason(last) : "下一次签到完成后，记录将自动同步。";
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
    badge.append(icon(run.status === "success" ? "check" : "circle-x"), document.createTextNode(run.status === "failure" ? `${failureStage(run)}失败` : labels[run.result] || "执行结束")); result.append(badge);
    const action = el("td"), button = el("button", undefined, "row-button"); button.type = "button"; button.setAttribute("aria-label", `查看运行 ${run.id} 的日志`); button.append(icon("arrow-up-right"));
    button.addEventListener("click", () => showDetails(run.id)); action.append(button); row.append(time, result, action); body.append(row);
  }
  if (selectedId) showDetails(selectedId);
  else {$("detail-error").hidden = true; $("steps").replaceChildren(); $("log-lines").replaceChildren(el("p", "等待运行数据…", "log-empty")); $("detail-time").textContent = "选择一条运行记录查看详情"; $("detail-id").textContent = "尚未选择运行记录"; $("log-result").textContent = "—"; $("detail-link").href = runLink();}
}

function showDetails(id) {
  const run = data.runs.find(item => item.id === id && platformOf(item) === platform); if (!run) return;
  selectedId = id;
  document.querySelectorAll("tr[data-run-id]").forEach(row => row.classList.toggle("record-selected", row.dataset.runId === id));
  $("detail-time").textContent = date(run.started_at, {year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"});
  $("detail-link").href = runLink(run.id); $("detail-id").textContent = `RUN #${run.id}`;
  $("log-result").textContent = run.status === "success" ? "执行完成" : "需要关注";
  $("detail-error").hidden = run.status === "success";
  $("detail-error").textContent = run.status === "success" ? "" : `${failureTitle(run)}：${failureReason(run)}`;
  $("steps").replaceChildren();
  for (const step of run.steps || []) {
    if (!stepNames[step.name]) continue;
    const node = el("div", undefined, "step"), status = el("span", undefined, `step-icon ${step.status === "failure" ? "bad" : ""}`); node.dataset.state = step.status;
    status.append(icon(step.status === "success" ? "circle-check" : step.status === "skipped" ? "minus" : "circle-x"));
    const copy = el("div", undefined, "step-copy"); copy.append(el("span", stepNames[step.name]), el("small", `${({success:"成功",failure:"失败",skipped:"未执行",cancelled:"已取消"})[step.status] || "未执行"} · ${Math.round(step.duration_seconds)} 秒`)); node.append(status, copy); $("steps").append(node);
  }
  $("log-lines").replaceChildren();
  let index = 0;
  for (const log of run.logs || []) {
    if (!messages[log.code]) continue;
    const level = ["info", "warning", "error"].includes(log.level) ? log.level : "info";
    const node = el("div", undefined, `log-line ${level}`), levelIcon = el("span", undefined, "log-level");
    levelIcon.append(icon(level === "warning" ? "triangle-alert" : level === "error" ? "circle-x" : "chevron-right"));
    const message = level === "error" ? `${failureTitle(run)}：${failureReason(run)}` : platform === "nssctf" && log.code === "checked_in" ? "当日登录奖励领取成功" : platform === "nssctf" && log.code === "already_done" ? "当日登录奖励已领取，核验通过" : messages[log.code];
    node.append(el("span", String(++index).padStart(2,"0"), "line-number"), levelIcon, el("span", message, "log-message")); $("log-lines").append(node);
  }
}

let refreshing = false;
async function refresh({notify = false} = {}) {
  if (refreshing) return;
  refreshing = true;
  $("refresh").disabled = true; $("refresh").setAttribute("aria-busy", "true"); $("refresh-icon").classList.add("spin"); $("refresh-label").textContent = "同步中…";
  if (notify) showToast("loading", "正在同步", "正在获取最新签到状态…");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`status.json?t=${Date.now()}`, {cache:"no-store", credentials:"omit", signal:controller.signal});
    if (!response.ok) throw new Error("fetch");
    const next = await response.json();
    if (next.schema_version !== 1 || !Array.isArray(next.runs)) throw new Error("format");
    const changed = JSON.stringify(next) !== JSON.stringify(data), previous = data; data = next;
    try {render();} catch (error) {data = previous; throw error;}
    $("notice").hidden = true;
    if (notify) showToast("success", "刷新完成", `${changed ? "已同步最新记录" : "记录已是最新"} · ${date(new Date(), {hour:"2-digit", minute:"2-digit", second:"2-digit"})} 台北时间`);
  } catch {
    if (notify) showToast("error", "刷新未完成", "暂时无法获取最新状态，现有记录已保留。请稍后重试。");
    $("notice-text").textContent = "暂时无法获取最新记录。已加载的数据会保留，请稍后刷新。"; $("notice").hidden = false;
    if (!data.runs.length) {
      $("hero-title").textContent = "暂时无法读取数据"; $("hero-description").textContent = "请稍后刷新，或前往 GitHub 查看运行记录。"; $("hero-status").textContent = "连接异常";
      $("runs").replaceChildren(); const row = el("tr"), cell = el("td", "数据读取失败", "empty"); cell.colSpan = 3; row.append(cell); $("runs").append(row);
    }
  } finally {clearTimeout(timeout); refreshing = false; $("refresh").disabled = false; $("refresh").setAttribute("aria-busy", "false"); $("refresh-icon").classList.remove("spin"); $("refresh-label").textContent = "刷新";}
}
document.querySelector("[data-actions]").href = runLink();
$("manual-checkin").href = runLink().replace(/\/actions$/, "/actions/workflows/bugku-checkin.yml");
$("manual-checkin").addEventListener("click", () => showToast("success", "请在 GitHub 确认", "选择立即执行或预约一次，两个平台都会执行。运行结果完成后同步回面板。"));
$("refresh").addEventListener("click", () => refresh({notify:true}));
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(item => {item.classList.toggle("selected", item === button); item.setAttribute("aria-pressed", String(item === button));});
  render();
}));
document.querySelectorAll("[data-platform]").forEach(button => button.addEventListener("click", () => {
  platform = button.dataset.platform; selectedId = null; render();
}));
refresh(); setInterval(() => {if (!document.hidden) refresh();}, 60000);
