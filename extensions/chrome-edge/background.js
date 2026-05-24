import initCore, { derivePassword } from "./pkg/passworder_core.js";

const VAULT_KEY = "seedpass:vault";
const LEGACY_VAULT_KEY = "passworder:vault";
const RECORDS_KEY = "seedpass:records";
const LEGACY_SETTINGS_KEY = "passworder:site-settings";
const LANGUAGE_KEY = "seedpass:language";
const DEFAULT_TIMEOUT_MINUTES = 15;
const DEFAULT_POLICY = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true
};

let coreReady;
let unlockedSecret = null;
let unlockedUntil = 0;
let lockTimer = null;

async function ensureCore() {
  if (!coreReady) {
    coreReady = initCore({
      module_or_path: chrome.runtime.getURL("pkg/passworder_core_bg.wasm")
    });
  }
  return coreReady;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse({ ok: true, ...response }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-password") return;
  try {
    const site = await getCurrentSite();
    const records = await getRecordsForSite(site.identity);
    const record = records[0] ?? createDefaultRecord(site.identity);
    await fillCurrentTab(site, record);
  } catch {
    // Keep shortcut failures quiet.
  }
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "get-state":
      return getState();
    case "setup-vault":
      return setupVault(message);
    case "unlock":
      return unlockVault(message);
    case "lock":
      lockNow();
      return getState();
    case "get-language":
      return { language: await getLanguage() };
    case "set-language":
      await storageSet(LANGUAGE_KEY, normalizeLanguage(message.language));
      return { language: await getLanguage() };
    case "get-site-records": {
      const site = await getCurrentSite();
      return { site, records: await getRecordsForSite(site.identity) };
    }
    case "get-all-records":
      return { records: await getAllRecords() };
    case "save-record":
      return { record: await saveRecord(normalizeRecord(message.record)) };
    case "delete-record":
      await deleteRecord(message.recordId);
      return {};
    case "fill-record": {
      const site = await getCurrentSite();
      const record = await requireRecord(message.recordId, site.identity);
      await fillCurrentTab(site, record);
      return {};
    }
    case "inline-state":
      return getInlineState(sender);
    case "inline-fill": {
      const site = getSiteFromSender(sender);
      const record = await requireRecord(message.recordId, site.identity);
      return { password: await deriveForRecord(record), site, record };
    }
    case "inline-unlock-and-fill": {
      await unlockVault({
        unlockPassword: message.pin,
        timeoutMinutes: message.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES
      });
      const site = getSiteFromSender(sender);
      const record = await requireRecord(message.recordId, site.identity);
      return { password: await deriveForRecord(record), site, record };
    }
    default:
      throw new Error("Unknown extension request.");
  }
}

async function getState() {
  const vault = await getVault();
  return {
    hasVault: Boolean(vault),
    unlocked: isUnlocked(),
    unlockedUntil: isUnlocked() ? unlockedUntil : 0,
    defaultTimeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
    language: await getLanguage()
  };
}

async function getInlineState(sender) {
  const site = getSiteFromSender(sender);
  const records = await getRecordsForSite(site.identity);
  return { ...(await getState()), site, records };
}

async function setupVault(message) {
  const baseSecret = requireNonEmpty(message.baseSecret, "Seed / 基密码");
  const unlockPassword = requirePin(message.unlockPassword);
  const timeoutMinutes = normalizeTimeout(message.timeoutMinutes);
  const vault = await encryptVault(baseSecret, unlockPassword);
  await storageSet(VAULT_KEY, vault);
  await chrome.storage.local.remove(LEGACY_VAULT_KEY);
  unlockFor(baseSecret, timeoutMinutes);
  return getState();
}

async function unlockVault(message) {
  const unlockPassword = requirePin(message.unlockPassword);
  const timeoutMinutes = normalizeTimeout(message.timeoutMinutes);
  const vault = await getVault();
  if (!vault) throw new Error("Vault is not set up. / 尚未创建保险库。");
  const baseSecret = await decryptVault(vault, unlockPassword);
  unlockFor(baseSecret, timeoutMinutes);
  return getState();
}

async function fillCurrentTab(site, record) {
  const password = await deriveForRecord(record);
  await chrome.scripting.executeScript({
    target: { tabId: site.tabId },
    files: ["content.js"]
  });
  const response = await chrome.tabs.sendMessage(site.tabId, {
    type: "seedpass-fill",
    password
  });
  if (!response?.filled) {
    throw new Error("No visible password field found. / 没有找到可见的密码输入框。");
  }
}

async function deriveForRecord(record) {
  assertUnlocked();
  await ensureCore();
  const policy = normalizePolicy(record.policy);
  const generationValue = generationInput(record);
  return derivePassword(
    unlockedSecret,
    generationValue,
    undefined,
    undefined,
    210000,
    policy.length,
    policy.lowercase,
    policy.uppercase,
    policy.digits,
    policy.symbols
  );
}

function generationInput(record) {
  if (record.mode === "account") {
    return requireNonEmpty(record.accountLabel, "Account label / 账号标识");
  }
  return record.siteIdentity;
}

async function getVault() {
  return (await storageGet(VAULT_KEY)) ?? (await storageGet(LEGACY_VAULT_KEY));
}

async function getAllRecords() {
  const records = (await storageGet(RECORDS_KEY)) ?? [];
  if (records.length > 0) return records;
  return migrateLegacySettings();
}

async function getRecordsForSite(siteIdentityValue) {
  const records = await getAllRecords();
  return records
    .filter((record) => record.siteIdentity === siteIdentityValue)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function requireRecord(recordId, siteIdentityValue) {
  const records = await getRecordsForSite(siteIdentityValue);
  const record = records.find((item) => item.id === recordId) ?? records[0];
  if (record) return record;
  const created = createDefaultRecord(siteIdentityValue);
  return saveRecord(created);
}

async function saveRecord(record) {
  const records = await getAllRecords();
  const now = Date.now();
  const next = {
    ...record,
    id: record.id || crypto.randomUUID(),
    createdAt: record.createdAt || now,
    updatedAt: now
  };
  const index = records.findIndex((item) => item.id === next.id);
  if (index >= 0) records[index] = next;
  else records.push(next);
  await storageSet(RECORDS_KEY, records);
  return next;
}

async function deleteRecord(recordId) {
  const records = await getAllRecords();
  await storageSet(
    RECORDS_KEY,
    records.filter((record) => record.id !== recordId)
  );
}

async function migrateLegacySettings() {
  const legacy = (await storageGet(LEGACY_SETTINGS_KEY)) ?? {};
  const records = Object.entries(legacy).map(([siteIdentityValue, settings]) =>
    normalizeRecord({
      siteIdentity: siteIdentityValue,
      accountLabel: settings.account ?? "",
      note: settings.account ? "Imported legacy label / 旧版本账号标识" : "",
      mode: "domain",
      policy: settings.policy ?? DEFAULT_POLICY
    })
  );
  if (records.length > 0) await storageSet(RECORDS_KEY, records);
  return records;
}

function createDefaultRecord(siteIdentityValue) {
  return normalizeRecord({
    siteIdentity: siteIdentityValue,
    accountLabel: "",
    note: "",
    mode: "domain",
    policy: DEFAULT_POLICY
  });
}

function normalizeRecord(record = {}) {
  const siteIdentityValue = requireNonEmpty(record.siteIdentity, "Site / 网站");
  const mode = record.mode === "account" ? "account" : "domain";
  const accountLabel = String(record.accountLabel ?? "").trim();
  if (mode === "account" && !accountLabel) {
    throw new Error("Account label is required for account mode. / 按账号标识生成时必须填写账号标识。");
  }
  return {
    id: record.id || "",
    siteIdentity: siteIdentityValue,
    accountLabel,
    note: String(record.note ?? "").trim(),
    mode,
    policy: normalizePolicy(record.policy),
    createdAt: Number(record.createdAt ?? 0),
    updatedAt: Number(record.updatedAt ?? 0)
  };
}

function unlockFor(baseSecret, timeoutMinutes) {
  unlockedSecret = baseSecret;
  unlockedUntil = Date.now() + timeoutMinutes * 60_000;
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(lockNow, timeoutMinutes * 60_000);
}

function lockNow() {
  unlockedSecret = null;
  unlockedUntil = 0;
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
}

function isUnlocked() {
  if (!unlockedSecret || Date.now() >= unlockedUntil) {
    lockNow();
    return false;
  }
  return true;
}

function assertUnlocked() {
  if (!isUnlocked()) throw new Error("Vault is locked. / 保险库已锁定。");
}

async function encryptVault(baseSecret, password) {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = await deriveVaultKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    encode(baseSecret)
  );
  return {
    version: 2,
    unlock: "six-digit-pin",
    kdf: "PBKDF2-HMAC-SHA256",
    iterations: 600000,
    salt: toBase64(salt),
    cipher: "AES-256-GCM",
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

async function decryptVault(vault, password) {
  if (![1, 2].includes(vault.version) || vault.cipher !== "AES-256-GCM") {
    throw new Error("Unsupported vault format. / 不支持的保险库格式。");
  }
  const key = await deriveVaultKey(password, fromBase64(vault.salt), vault.iterations);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(vault.nonce) },
      key,
      fromBase64(vault.ciphertext)
    );
    return decode(new Uint8Array(plaintext));
  } catch {
    throw new Error("Unlock failed. / 解锁失败。");
  }
}

async function deriveVaultKey(password, salt, iterations = 600000) {
  const material = await crypto.subtle.importKey("raw", encode(password), "PBKDF2", false, [
    "deriveKey"
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function getCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return getSiteFromTab(tab);
}

function getSiteFromSender(sender) {
  return getSiteFromTab(sender?.tab);
}

function getSiteFromTab(tab) {
  if (!tab?.id || !tab.url) throw new Error("No active tab. / 没有活动标签页。");
  const url = new URL(tab.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Current page is not a website. / 当前页面不是普通网站。");
  }
  return {
    tabId: tab.id,
    url: tab.url,
    hostname: url.hostname,
    identity: siteIdentity(url.hostname)
  };
}

function siteIdentity(hostname) {
  const lower = hostname.toLowerCase();
  const parts = lower.split(".").filter(Boolean);
  if (parts.length <= 2) return lower;
  const secondLevelExceptions = new Set(["co", "com", "net", "org", "gov", "edu"]);
  const tld = parts.at(-1);
  const sld = parts.at(-2);
  if (tld && tld.length === 2 && sld && secondLevelExceptions.has(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function normalizePolicy(policy = {}) {
  const normalized = {
    length: Number(policy.length ?? DEFAULT_POLICY.length),
    lowercase: Boolean(policy.lowercase ?? DEFAULT_POLICY.lowercase),
    uppercase: Boolean(policy.uppercase ?? DEFAULT_POLICY.uppercase),
    digits: Boolean(policy.digits ?? DEFAULT_POLICY.digits),
    symbols: Boolean(policy.symbols ?? DEFAULT_POLICY.symbols)
  };
  if (!Number.isInteger(normalized.length) || normalized.length < 8 || normalized.length > 64) {
    throw new Error("Password length must be 8-64. / 密码长度必须是 8 到 64。");
  }
  if (
    !normalized.lowercase &&
    !normalized.uppercase &&
    !normalized.digits &&
    !normalized.symbols
  ) {
    throw new Error("Enable at least one character type. / 至少启用一种字符类型。");
  }
  return normalized;
}

async function getLanguage() {
  const saved = await storageGet(LANGUAGE_KEY);
  return normalizeLanguage(saved ?? "auto");
}

function normalizeLanguage(value) {
  return ["auto", "zh", "en"].includes(value) ? value : "auto";
}

function normalizeTimeout(value) {
  const timeout = Number(value ?? DEFAULT_TIMEOUT_MINUTES);
  return [5, 15, 30, 60].includes(timeout) ? timeout : DEFAULT_TIMEOUT_MINUTES;
}

function requireNonEmpty(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requirePin(value) {
  const pin = requireNonEmpty(value, "PIN");
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN must be 6 digits. / PIN 必须是 6 位数字。");
  return pin;
}

function storageGet(key) {
  return chrome.storage.local.get(key).then((result) => result[key]);
}

function storageSet(key, value) {
  return chrome.storage.local.set({ [key]: value });
}

function randomBytes(size) {
  return crypto.getRandomValues(new Uint8Array(size));
}

function encode(value) {
  return new TextEncoder().encode(value);
}

function decode(value) {
  return new TextDecoder().decode(value);
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
