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
  setupPassword: document.querySelector("#setup-password"),
  setupTimeout: document.querySelector("#setup-timeout"),
  unlockPassword: document.querySelector("#unlock-password"),
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

let currentSite = null;

document.querySelector("#generate-secret").addEventListener("click", () => {
  elements.setupSecret.value = generateMnemonic(24);
});

document.querySelector("#setup-submit").addEventListener("click", async () => {
  await runAction(async () => {
    await sendMessage({
      type: "setup-vault",
      baseSecret: elements.setupSecret.value,
      unlockPassword: elements.setupPassword.value,
      timeoutMinutes: Number(elements.setupTimeout.value)
    });
    elements.setupPassword.value = "";
    await refresh();
    showMessage("Vault encrypted and unlocked.");
  });
});

document.querySelector("#unlock-submit").addEventListener("click", async () => {
  await runAction(async () => {
    await sendMessage({
      type: "unlock",
      unlockPassword: elements.unlockPassword.value,
      timeoutMinutes: Number(elements.unlockTimeout.value)
    });
    elements.unlockPassword.value = "";
    await refresh();
    showMessage("Unlocked.");
  });
});

document.querySelector("#fill-submit").addEventListener("click", async () => {
  await runAction(async () => {
    const policy = readPolicy();
    await sendMessage({
      type: "fill-password",
      account: elements.account.value.trim(),
      policy
    });
    showMessage("Password filled.");
  });
});

document.querySelector("#lock-submit").addEventListener("click", async () => {
  await runAction(async () => {
    await sendMessage({ type: "lock" });
    await refresh();
    showMessage("Locked.");
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

async function refresh() {
  const state = await sendMessage({ type: "get-state" });
  hideAll();

  if (!state.hasVault) {
    elements.status.textContent = "No vault yet. Create one locally.";
    elements.setupView.classList.remove("hidden");
    return;
  }

  if (!state.unlocked) {
    elements.status.textContent = "Vault locked.";
    elements.unlockView.classList.remove("hidden");
    return;
  }

  elements.status.textContent = `Unlocked until ${new Date(state.unlockedUntil).toLocaleTimeString()}.`;
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
    throw new Error(response?.error ?? "Extension request failed.");
  }
  return response;
}

function generateMnemonic(words) {
  const bytes = crypto.getRandomValues(new Uint8Array(words));
  return Array.from({ length: words }, (_, index) => WORDLIST[bytes[index] % WORDLIST.length]).join(
    " "
  );
}
