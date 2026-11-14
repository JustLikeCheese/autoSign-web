// 浏览器和 Node 共用的加解密（只用 WebCrypto）。
//
// 一把 256 位随机长密钥，写成一行文本：autosign-<43 位 base64url>。
// 每个文件 AES-256-GCM、随机 IV；密文里带 kid（密钥 SHA-256 的前 8 位十六进制），
// 用来分辨「密钥不对 / 已作废」。没有密钥只能看到密文。
// 作废 = 换新密钥，发布端用旧钥解开、新钥重加密全部文件，旧钥对新文件无效。
const te = new TextEncoder();
const td = new TextDecoder();
const PREFIX = "autosign-";

export const b64 = bytes => {
  let s = "";
  const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const toUrl = bytes => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromUrl = s => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

export function generateKey() {
  return PREFIX + toUrl(crypto.getRandomValues(new Uint8Array(32)));
}

// 从任意文本里找出密钥（允许整份密钥文件内容、前后空白）
export async function importKey(text, extractable = false) {
  const m = String(text || "").match(/autosign-([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/);
  if (!m) throw new Error("不是有效的密钥");
  const raw = fromUrl(m[1]);
  if (raw.length !== 32) throw new Error("不是有效的密钥");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const kid = Array.from(digest.slice(0, 4), b => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", extractable, ["encrypt", "decrypt"]);
  raw.fill(0);
  return {kid, key};
}

export async function seal(text, id) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: te.encode(id.kid)}, id.key, te.encode(text));
  return {v: 3, kid: id.kid, iv: b64(iv), ct: b64(ct)};
}

export class WrongKeyError extends Error {}

export async function open(box, id) {
  if (!box || box.v !== 3) throw new Error("密文格式不对");
  if (box.kid !== id.kid) throw new WrongKeyError("密钥不对或已作废");
  try {
    const pt = await crypto.subtle.decrypt({name: "AES-GCM", iv: unb64(box.iv), additionalData: te.encode(box.kid)}, id.key, unb64(box.ct));
    return td.decode(pt);
  } catch {
    throw new WrongKeyError("密钥不对或已作废");
  }
}

// ---- 浏览器端：把密钥存成不可导出的 CryptoKey（IndexedDB），页面脚本读不出原文 ----
const DB = "autosign", STORE = "keys";
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {d.close(); resolve(req?.result);};
    t.onerror = () => {d.close(); reject(t.error);};
  });
}
export const saveIdentity = id => tx("readwrite", s => s.put({kid: id.kid, key: id.key}, "current"));
export const loadIdentity = () => tx("readonly", s => s.get("current")).catch(() => null);
export const forgetIdentity = () => tx("readwrite", s => s.delete("current")).catch(() => null);
