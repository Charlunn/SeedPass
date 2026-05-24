const WORDLIST = [
  "anchor",
  "apricot",
  "atlas",
  "bamboo",
  "beacon",
  "breeze",
  "cactus",
  "canyon",
  "cedar",
  "cinder",
  "cobalt",
  "coral",
  "cotton",
  "cricket",
  "delta",
  "ember",
  "falcon",
  "fennel",
  "forest",
  "galaxy",
  "garden",
  "harbor",
  "hazel",
  "helium",
  "island",
  "jacket",
  "juniper",
  "lantern",
  "lemon",
  "lizard",
  "magnet",
  "marble",
  "matrix",
  "meadow",
  "meteor",
  "nectar",
  "nickel",
  "oasis",
  "olive",
  "onyx",
  "orbit",
  "paddle",
  "paper",
  "pepper",
  "planet",
  "quartz",
  "rabbit",
  "raven",
  "river",
  "rocket",
  "saffron",
  "saturn",
  "silver",
  "sparrow",
  "spiral",
  "summit",
  "timber",
  "tundra",
  "velvet",
  "violet",
  "walnut",
  "willow",
  "winter",
  "zephyr"
];

const DEFAULT_POLICY = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true
};

const elements = {
  status: document.querySelector("#status"),
  message: document.querySelector("#message"),
  setupView: document.querySelector("#setup-view"),
  unlockView: document.querySelector("#unlock-view"),
  fillView: document.querySelector("#fill-view"),
  setupSecret: document.querySelector("#setup-secret"),
  setupTimeout: document.querySelector("#setup-timeout"),
  unlockTimeout: document.querySelector("#unlock-timeout"),
  siteIdentity: document.querySelector("#site-identity"),
  siteHostname: document.querySelector("#site-hostname"),
  account: document.querySelector("#account"),
  policyLength: document.querySelector("#policy-length"),
  policyLowercase: document.querySelector("#policy-lowercase"),
  policyUppercase: document.querySelector("#policy-uppercase"),
  policyDigits: document.querySelector("#policy-digits"),
  policySymbols: document.querySelector("#policy-symbols")
};

const pinGroups = {
  setup: createPinBoxes("setup"),
  setupConfirm: createPinBoxes("setup-confirm"),
  unlock: createPinBoxes("unlock")
};

let currentSite = null;

document.querySelector("#generate-secret").addEventListener("click", () => {
  elements.setupSecret.value = generateMnemonic(24);
});

document.querySelector("#setup-submit").addEventListener("click", async () => {
  await runAction(async () => {
    const pin = readPin("setup");
    const confirm = readPin("setupConfirm");
    if (pin !== confirm) {
      throw new Error("两次输入的 PIN 不一致。");
    }
    await sendMessage({
      type: "setup-vault",
      baseSecret: elements.setupSecret.value,
      unlockPassword: pin,
      timeoutMinutes: Number(elements.setupTimeout.value)
    });
    clearPin("setup");
    clearPin("setupConfirm");
    await refresh();
    showMessage("保险库已加密保存并解锁。");
  });
});

document.querySelector("#unlock-submit").addEventListener("click", async () => {
  await unlockFromPopup();
});

for (const box of pinGroups.unlock) {
  box.addEventListener("passworder-pin-complete", unlockFromPopup);
}

document.querySelector("#fill-submit").addEventListener("click", async () => {
  await runAction(async () => {
    const policy = readPolicy();
    await sendMessage({
      type: "fill-password",
      account: elements.account.value.trim(),
      policy
    });
    showMessage("密码已填充。");
  });
});

document.querySelector("#lock-submit").addEventListener("click", async () => {
  await runAction(async () => {
    await sendMessage({ type: "lock" });
    await refresh();
    showMessage("已锁定。");
  });
});

for (const input of [
  elements.account,
  elements.policyLength,
  elements.policyLowercase,
  elements.policyUppercase,
  elements.policyDigits,
  elements.policySymbols
]) {
  input.addEventListener("change", saveSettings);
}

await refresh();

async function unlockFromPopup() {
  await runAction(async () => {
    await sendMessage({
      type: "unlock",
      unlockPassword: readPin("unlock"),
      timeoutMinutes: Number(elements.unlockTimeout.value)
    });
    clearPin("unlock");
    await refresh();
    showMessage("已解锁。");
  });
}

async function refresh() {
  const state = await sendMessage({ type: "get-state" });
  hideAll();

  if (!state.hasVault) {
    elements.status.textContent = "还没有本地保险库，请先创建。";
    elements.setupView.classList.remove("hidden");
    focusPin("setup");
    return;
  }

  if (!state.unlocked) {
    elements.status.textContent = "保险库已锁定。";
    elements.unlockView.classList.remove("hidden");
    focusPin("unlock");
    return;
  }

  elements.status.textContent = `已解锁，有效至 ${new Date(
    state.unlockedUntil
  ).toLocaleTimeString("zh-CN")}。`;
  elements.fillView.classList.remove("hidden");
  await loadSiteSettings();
}

async function loadSiteSettings() {
  const response = await sendMessage({ type: "get-site-settings" });
  currentSite = response.site;
  elements.siteIdentity.textContent = currentSite.identity;
  elements.siteHostname.textContent = currentSite.hostname;

  const settings = response.settings ?? {};
  elements.account.value = settings.account ?? "";
  writePolicy(settings.policy ?? DEFAULT_POLICY);
}

async function saveSettings() {
  if (!currentSite) {
    return;
  }

  try {
    await sendMessage({
      type: "save-site-settings",
      siteIdentity: currentSite.identity,
      account: elements.account.value.trim(),
      policy: readPolicy()
    });
  } catch (error) {
    showMessage(error.message, true);
  }
}

function readPolicy() {
  return {
    length: Number(elements.policyLength.value),
    lowercase: elements.policyLowercase.checked,
    uppercase: elements.policyUppercase.checked,
    digits: elements.policyDigits.checked,
    symbols: elements.policySymbols.checked
  };
}

function writePolicy(policy) {
  elements.policyLength.value = policy.length ?? DEFAULT_POLICY.length;
  elements.policyLowercase.checked = policy.lowercase ?? DEFAULT_POLICY.lowercase;
  elements.policyUppercase.checked = policy.uppercase ?? DEFAULT_POLICY.uppercase;
  elements.policyDigits.checked = policy.digits ?? DEFAULT_POLICY.digits;
  elements.policySymbols.checked = policy.symbols ?? DEFAULT_POLICY.symbols;
}

function createPinBoxes(name) {
  const row = document.querySelector(`[data-pin="${name}"]`);
  const boxes = Array.from({ length: 6 }, (_, index) => {
    const input = document.createElement("input");
    input.type = "password";
    input.inputMode = "numeric";
    input.maxLength = 1;
    input.autocomplete = "off";
    input.className = "pin-box";
    input.ariaLabel = `PIN 第 ${index + 1} 位`;
    row.append(input);
    return input;
  });

  boxes.forEach((box, index) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(0, 1);
      if (box.value && index < boxes.length - 1) {
        boxes[index + 1].focus();
      }
      if (/^\d{6}$/.test(readPinByBoxes(boxes))) {
        box.dispatchEvent(new Event("passworder-pin-complete"));
      }
    });
    box.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !box.value && index > 0) {
        boxes[index - 1].focus();
      }
    });
    box.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      for (let i = 0; i < boxes.length; i += 1) {
        boxes[i].value = text[i] ?? "";
      }
      if (/^\d{6}$/.test(readPinByBoxes(boxes))) {
        boxes.at(-1).dispatchEvent(new Event("passworder-pin-complete"));
      }
    });
  });

  return boxes;
}

function readPin(name) {
  const pin = readPinByBoxes(pinGroups[name]);
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("请输入 6 位数字 PIN。");
  }
  return pin;
}

function readPinByBoxes(boxes) {
  return boxes.map((box) => box.value).join("");
}

function clearPin(name) {
  for (const box of pinGroups[name]) {
    box.value = "";
  }
}

function focusPin(name) {
  setTimeout(() => pinGroups[name][0]?.focus(), 0);
}

async function runAction(action) {
  setBusy(true);
  showMessage("");
  try {
    await action();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  for (const button of document.querySelectorAll("button")) {
    button.disabled = busy;
  }
}

function hideAll() {
  elements.setupView.classList.add("hidden");
  elements.unlockView.classList.add("hidden");
  elements.fillView.classList.add("hidden");
}

function showMessage(message, isError = false) {
  elements.message.textContent = message;
  elements.message.style.color = isError ? "#9f1d16" : "#685842";
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error ?? "插件请求失败。");
  }
  return response;
}

function generateMnemonic(words) {
  const bytes = crypto.getRandomValues(new Uint8Array(words));
  return Array.from({ length: words }, (_, index) => WORDLIST[bytes[index] % WORDLIST.length]).join(
    " "
  );
}
