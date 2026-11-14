import {importKey, open, saveIdentity, loadIdentity, forgetIdentity} from "./vault.js";

const $ = id => document.getElementById(id);
async function appBox() {
  const r = await fetch(`app.enc?t=${Date.now()}`, {cache: "no-store", credentials: "omit"});
  if (!r.ok) throw new Error("fetch");
  return r.json();
}
function render(html) {
  document.open();
  document.write(html);
  document.close();
}

function showGate(message) {
  $("boot").hidden = true;
  $("gate").hidden = false;
  if (message) {$("error").textContent = message; $("error").hidden = false;}
  $("key").focus();
}

async function unlock(text) {
  $("error").hidden = true;
  $("submit").disabled = true;
  $("submit").textContent = "验证中…";
  try {
    const id = await importKey(text, false);
    const html = await open(await appBox(), id);
    await saveIdentity(id).catch(() => {});
    render(html);
  } catch (error) {
    $("error").textContent = error?.message === "fetch" ? "暂时无法加载，请稍后再试" : "密钥不对或已作废";
    $("error").hidden = false;
    $("submit").disabled = false;
    $("submit").textContent = "解锁";
  }
}

async function start() {
  let box;
  try {box = await appBox();} catch {$("boot").textContent = "暂时无法加载，请稍后刷新。"; return;}
  const saved = await loadIdentity();
  if (saved?.key) {
    try {return render(await open(box, saved));} catch {await forgetIdentity(); return showGate("保存的密钥已作废，请输入新密钥");}
  }
  showGate();
}

$("form").addEventListener("submit", event => {event.preventDefault(); unlock($("key").value);});
$("file").addEventListener("change", async () => {
  const f = $("file").files?.[0];
  if (!f) return;
  if (f.size > 4096) {$("error").textContent = "这不是密钥文件"; $("error").hidden = false; return;}
  await unlock(await f.text());
  $("file").value = "";
});
start();
