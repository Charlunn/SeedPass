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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
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
    await fillCurrentTab(site, settings.account ?? "", settings.policy ?? DEFAULT_POLICY);
  } catch {
    // 快捷键失败时不弹出敏感信息或噪声错误。
  }
});

async function handleMessage(message) {
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
      return { site, settings };
    }
    case "save-site-settings":
      await saveSiteSettings(message.siteIdentity, {
        account: message.account ?? "",
        policy: normalizePolicy(message.policy)
      });
      return {};
    case "fill-password": {
      const site = await getCurrentSite();
      const policy = normalizePolicy(message.policy);
      await saveSiteSettings(site.identity, {
        account: message.account ?? "",
        policy
      });
      await fillCurrentTab(site, message.account ?? "", policy);
      return {};
    }
    default:
      throw new Error("未知的插件请求。");
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

async function setupVault(message) {
  const baseSecret = requireNonEmpty(message.baseSecret, "基密码");
  const unlockPassword = requireNonEmpty(message.unlockPassword, "解锁密码");
  const timeoutMinutes = normalizeTimeout(message.timeoutMinutes);
  const vault = await encryptVault(baseSecret, unlockPassword);
  await storageSet(VAULT_KEY, vault);
  unlockFor(baseSecret, timeoutMinutes);
  return getState();
}

async function unlockVault(message) {
  const unlockPassword = requireNonEmpty(message.unlockPassword, "解锁密码");
  const timeoutMinutes = normalizeTimeout(message.timeoutMinutes);
  const vault = await storageGet(VAULT_KEY);
  if (!vault) {
    throw new Error("尚未创建保险库。");
  }
  const baseSecret = await decryptVault(vault, unlockPassword);
  unlockFor(baseSecret, timeoutMinutes);
  return getState();
}

async function fillCurrentTab(site, account, policy) {
  assertUnlocked();
  await ensureCore();

  const password = derivePassword(
    unlockedSecret,
    site.identity,
    account || undefined,
    undefined,
    210000,
    policy.length,
    policy.lowercase,
    policy.uppercase,
    policy.digits,
    policy.symbols
  );

  await chrome.scripting.executeScript({
    target: { tabId: site.tabId },
    files: ["content.js"]
  });
  const response = await chrome.tabs.sendMessage(site.tabId, {
    type: "passworder-fill",
    password
  });
  if (!response?.filled) {
    throw new Error("没有找到可见的密码输入框。");
  }
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
    throw new Error("保险库已锁定。");
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
    version: 1,
    kdf: "PBKDF2-HMAC-SHA256",
    iterations: 600000,
    salt: toBase64(salt),
    cipher: "AES-256-GCM",
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

async function decryptVault(vault, password) {
  if (vault.version !== 1 || vault.cipher !== "AES-256-GCM") {
    throw new Error("不支持的保险库格式。");
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
    throw new Error("解锁失败。");
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
  if (!tab?.id || !tab.url) {
    throw new Error("没有活动标签页。");
  }

  const url = new URL(tab.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("当前页面不是普通网站。");
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
  return all[siteIdentityValue] ?? { account: "", policy: DEFAULT_POLICY };
}

async function saveSiteSettings(siteIdentityValue, settings) {
  if (!siteIdentityValue) {
    return;
  }
  const all = (await storageGet(SETTINGS_KEY)) ?? {};
  all[siteIdentityValue] = settings;
  await storageSet(SETTINGS_KEY, all);
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
    throw new Error("密码长度必须是 8 到 64 之间的整数。");
  }
  if (
    !normalized.lowercase &&
    !normalized.uppercase &&
    !normalized.digits &&
    !normalized.symbols
  ) {
    throw new Error("至少需要启用一种字符类型。");
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
    throw new Error(`${label}不能为空。`);
  }
  return normalized;
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
