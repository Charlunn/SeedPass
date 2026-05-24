import initCore, { derivePassword } from "./pkg/passworder_core.js";

const VAULT_KEY = "passworder:vault";
const SETTINGS_KEY = "passworder:site-settings";
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
  if (command !== "fill-password") {
    return;
  }

  try {
    const site = await getCurrentSite();
    const settings = await getSiteSettings(site.identity);
    await fillCurrentTab(site, getSiteRecord(settings));
  } catch {
    // Shortcut failures should not expose secrets or noisy errors.
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
    case "get-site-settings": {
      const site = await getCurrentSite();
      const settings = await getSiteSettings(site.identity);
      return { site, settings, records: getSiteRecords(settings) };
    }
    case "save-site-settings":
      return {
        settings: await saveSiteRecord(message.siteIdentity, {
          id: message.recordId,
          account: message.account ?? "",
          note: message.note ?? "",
          mode: message.mode ?? "domain",
          policy: normalizePolicy(message.policy)
        })
      };
    case "delete-site-record":
      return { settings: await deleteSiteRecord(message.siteIdentity, message.recordId) };
    case "fill-password": {
      const site = await getCurrentSite();
      const settings = await saveSiteRecord(site.identity, {
        id: message.recordId,
        account: message.account ?? "",
        note: message.note ?? "",
        mode: message.mode ?? "domain",
        policy: normalizePolicy(message.policy)
      });
      const record = getSiteRecord(settings, message.recordId);
      await fillCurrentTab(site, record);
      return {};
    }
    case "inline-state":
      return getInlineState(sender);
    case "inline-fill":
      return deriveForSender(sender, message.recordId);
    case "inline-unlock-and-fill":
      await unlockVault({
        unlockPassword: message.pin,
        timeoutMinutes: message.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES
      });
      return deriveForSender(sender, message.recordId);
    default:
      throw new Error("\u672a\u77e5\u7684\u63d2\u4ef6\u8bf7\u6c42\u3002");
  }
}

async function getState() {
  const vault = await storageGet(VAULT_KEY);
  return {
    hasVault: Boolean(vault),
    unlocked: isUnlocked(),
    unlockedUntil: isUnlocked() ? unlockedUntil : 0,
    defaultTimeoutMinutes: DEFAULT_TIMEOUT_MINUTES
  };
}

async function getInlineState(sender) {
  const site = getSiteFromSender(sender);
  const settings = await getSiteSettings(site.identity);
  const state = await getState();
  return { site, settings, records: getSiteRecords(settings), ...state };
}

async function setupVault(message) {
  const baseSecret = requireNonEmpty(message.baseSecret, "\u57fa\u5bc6\u7801");
  const unlockPassword = requirePin(message.unlockPassword);
  const timeoutMinutes = normalizeTimeout(message.timeoutMinutes);
  const vault = await encryptVault(baseSecret, unlockPassword);
  await storageSet(VAULT_KEY, vault);
  unlockFor(baseSecret, timeoutMinutes);
  return getState();
}

async function unlockVault(message) {
  const unlockPassword = requirePin(message.unlockPassword);
  const timeoutMinutes = normalizeTimeout(message.timeoutMinutes);
  const vault = await storageGet(VAULT_KEY);
  if (!vault) {
    throw new Error("\u5c1a\u672a\u521b\u5efa\u4fdd\u9669\u5e93\u3002");
  }
  const baseSecret = await decryptVault(vault, unlockPassword);
  unlockFor(baseSecret, timeoutMinutes);
  return getState();
}

async function deriveForSender(sender, recordId) {
  assertUnlocked();
  const site = getSiteFromSender(sender);
  const settings = await getSiteSettings(site.identity);
  const record = getSiteRecord(settings, recordId);
  const password = await derivePasswordForSite(site.identity, record);
  return { password, site, settings };
}

async function fillCurrentTab(site, record) {
  const password = await derivePasswordForSite(site.identity, record);

  await chrome.scripting.executeScript({
    target: { tabId: site.tabId },
    files: ["content.js"]
  });
  const response = await chrome.tabs.sendMessage(site.tabId, {
    type: "passworder-fill",
    password
  });
  if (!response?.filled) {
    throw new Error("\u6ca1\u6709\u627e\u5230\u53ef\u89c1\u7684\u5bc6\u7801\u8f93\u5165\u6846\u3002");
  }
}

async function derivePasswordForSite(siteIdentityValue, record) {
  assertUnlocked();
  await ensureCore();
  const normalizedPolicy = normalizePolicy(record.policy);
  const generationName = record.mode === "account"
    ? requireNonEmpty(record.account, "\u8d26\u53f7\u6807\u8bc6")
    : siteIdentityValue;

  return derivePassword(
    unlockedSecret,
    generationName,
    undefined,
    undefined,
    210000,
    normalizedPolicy.length,
    normalizedPolicy.lowercase,
    normalizedPolicy.uppercase,
    normalizedPolicy.digits,
    normalizedPolicy.symbols
  );
}

function unlockFor(baseSecret, timeoutMinutes) {
  unlockedSecret = baseSecret;
  unlockedUntil = Date.now() + timeoutMinutes * 60_000;
  if (lockTimer) {
    clearTimeout(lockTimer);
  }
  lockTimer = setTimeout(lockNow, timeoutMinutes * 60_000);
}

function lockNow() {
  unlockedSecret = null;
  unlockedUntil = 0;
  if (lockTimer) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
}

function isUnlocked() {
  if (!unlockedSecret || Date.now() >= unlockedUntil) {
    lockNow();
    return false;
  }
  return true;
}

function assertUnlocked() {
  if (!isUnlocked()) {
    throw new Error("\u4fdd\u9669\u5e93\u5df2\u9501\u5b9a\u3002");
  }
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
    throw new Error("\u4e0d\u652f\u6301\u7684\u4fdd\u9669\u5e93\u683c\u5f0f\u3002");
  }

  const salt = fromBase64(vault.salt);
  const nonce = fromBase64(vault.nonce);
  const ciphertext = fromBase64(vault.ciphertext);
  const key = await deriveVaultKey(password, salt, vault.iterations);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      ciphertext
    );
    return decode(new Uint8Array(plaintext));
  } catch {
    throw new Error("\u89e3\u9501\u5931\u8d25\u3002");
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
  if (!tab?.id || !tab.url) {
    throw new Error("\u6ca1\u6709\u6d3b\u52a8\u6807\u7b7e\u9875\u3002");
  }

  const url = new URL(tab.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("\u5f53\u524d\u9875\u9762\u4e0d\u662f\u666e\u901a\u7f51\u7ad9\u3002");
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
  if (parts.length <= 2) {
    return lower;
  }

  const secondLevelExceptions = new Set(["co", "com", "net", "org", "gov", "edu"]);
  const tld = parts.at(-1);
  const sld = parts.at(-2);
  if (tld && tld.length === 2 && sld && secondLevelExceptions.has(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

async function getSiteSettings(siteIdentityValue) {
  const all = (await storageGet(SETTINGS_KEY)) ?? {};
  return normalizeSiteSettings(all[siteIdentityValue]);
}

async function saveSiteSettings(siteIdentityValue, settings) {
  if (!siteIdentityValue) {
    return;
  }
  const all = (await storageGet(SETTINGS_KEY)) ?? {};
  all[siteIdentityValue] = settings;
  await storageSet(SETTINGS_KEY, all);
}

async function saveSiteRecord(siteIdentityValue, record) {
  const current = await getSiteSettings(siteIdentityValue);
  const records = getSiteRecords(current);
  const now = Date.now();
  const next = normalizeRecord({
    ...record,
    id: record.id || crypto.randomUUID(),
    createdAt: records.find((item) => item.id === record.id)?.createdAt ?? now,
    updatedAt: now
  });
  const index = records.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    records[index] = next;
  } else {
    records.unshift(next);
  }
  const settings = {
    account: next.account,
    policy: next.policy,
    records
  };
  await saveSiteSettings(siteIdentityValue, settings);
  return settings;
}

async function deleteSiteRecord(siteIdentityValue, recordId) {
  const current = await getSiteSettings(siteIdentityValue);
  const records = getSiteRecords(current).filter((record) => record.id !== recordId);
  const settings = {
    account: records[0]?.account ?? "",
    policy: records[0]?.policy ?? DEFAULT_POLICY,
    records
  };
  await saveSiteSettings(siteIdentityValue, settings);
  return settings;
}

function normalizeSiteSettings(settings = {}) {
  if (Array.isArray(settings.records)) {
    const records = settings.records.map(normalizeRecord);
    return {
      account: settings.account ?? records[0]?.account ?? "",
      policy: normalizePolicy(settings.policy ?? records[0]?.policy ?? DEFAULT_POLICY),
      records
    };
  }
  return {
    account: settings.account ?? "",
    policy: normalizePolicy(settings.policy ?? DEFAULT_POLICY),
    records: [
      normalizeRecord({
        account: settings.account ?? "",
        note: "",
        mode: "domain",
        policy: settings.policy ?? DEFAULT_POLICY
      })
    ]
  };
}

function getSiteRecords(settings = {}) {
  return normalizeSiteSettings(settings).records;
}

function getSiteRecord(settings, recordId) {
  const records = getSiteRecords(settings);
  return records.find((record) => record.id === recordId) ?? records[0] ?? normalizeRecord();
}

function normalizeRecord(record = {}) {
  const mode = record.mode === "account" ? "account" : "domain";
  const account = String(record.account ?? "").trim();
  return {
    id: record.id || "",
    account,
    note: String(record.note ?? "").trim(),
    mode,
    policy: normalizePolicy(record.policy ?? DEFAULT_POLICY),
    createdAt: Number(record.createdAt ?? 0),
    updatedAt: Number(record.updatedAt ?? 0)
  };
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
    throw new Error("\u5bc6\u7801\u957f\u5ea6\u5fc5\u987b\u662f 8 \u5230 64 \u4e4b\u95f4\u7684\u6574\u6570\u3002");
  }
  if (
    !normalized.lowercase &&
    !normalized.uppercase &&
    !normalized.digits &&
    !normalized.symbols
  ) {
    throw new Error("\u81f3\u5c11\u9700\u8981\u542f\u7528\u4e00\u79cd\u5b57\u7b26\u7c7b\u578b\u3002");
  }
  return normalized;
}

function normalizeTimeout(value) {
  const timeout = Number(value ?? DEFAULT_TIMEOUT_MINUTES);
  return [5, 15, 30, 60].includes(timeout) ? timeout : DEFAULT_TIMEOUT_MINUTES;
}

function requireNonEmpty(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${label}\u4e0d\u80fd\u4e3a\u7a7a\u3002`);
  }
  return normalized;
}

function requirePin(value) {
  const pin = requireNonEmpty(value, "PIN");
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN \u5fc5\u987b\u662f 6 \u4f4d\u6570\u5b57\u3002");
  }
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
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
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
