if (!globalThis.__PASSWORDER_CONTENT_SCRIPT_LOADED__) {
  globalThis.__PASSWORDER_CONTENT_SCRIPT_LOADED__ = true;

  let activeInput = null;
  let panel = null;
  let hideTimer = null;
  let selectedRecordId = "";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "passworder-fill") {
      return false;
    }

    const input = activeInput && isFillablePasswordInput(activeInput)
      ? activeInput
      : findPasswordInput();
    if (!input) {
      sendResponse({ filled: false });
      return true;
    }

    fillInput(input, message.password);
    hidePanel();
    sendResponse({ filled: true });
    return true;
  });

  document.addEventListener("focusin", (event) => {
    if (!isFillablePasswordInput(event.target)) {
      return;
    }
    activeInput = event.target;
    showSuggestion(activeInput);
  });

  document.addEventListener("focusout", () => {
    scheduleHide();
  });

  window.addEventListener("scroll", () => positionPanel(), true);
  window.addEventListener("resize", () => positionPanel());

  async function showSuggestion(input) {
    clearHideTimer();
    activeInput = input;
    const state = await sendMessage({ type: "inline-state" }).catch((error) => ({
      ok: false,
      error: error.message
    }));

    panel = panel ?? createPanel();
    renderPanel(state);
    positionPanel();
  }

  function renderPanel(state) {
    if (!panel) {
      return;
    }

    const title = panel.querySelector("[data-title]");
    const body = panel.querySelector("[data-body]");
    title.textContent = "SeedPass";

    if (!state.ok) {
      body.innerHTML = "";
      body.append(textBlock(state.error || "\u63d2\u4ef6\u6682\u65f6\u4e0d\u53ef\u7528\u3002"));
      return;
    }

    if (!state.hasVault) {
      body.innerHTML = "";
      body.append(textBlock("\u8bf7\u5148\u70b9\u51fb\u63d2\u4ef6\u56fe\u6807\u521b\u5efa\u672c\u5730\u4fdd\u9669\u5e93\u3002"));
      return;
    }

    if (state.unlocked) {
      body.innerHTML = "";
      body.append(textBlock(`\u5df2\u89e3\u9501\uff1a${state.site.identity}`));
      for (const record of state.records ?? []) {
        body.append(recordButton(record, true));
      }
      return;
    }

    body.innerHTML = "";
    body.append(textBlock(`\u4e3a ${state.site.identity} \u8f93\u5165 6 \u4f4d PIN \u5feb\u901f\u89e3\u9501`));
    for (const record of state.records ?? []) {
      body.append(recordButton(record, false));
    }
    const pinRow = document.createElement("div");
    pinRow.className = "passworder-pin-row";
    const boxes = Array.from({ length: 6 }, () => {
      const box = document.createElement("input");
      box.type = "password";
      box.inputMode = "numeric";
      box.maxLength = 1;
      box.autocomplete = "off";
      box.className = "passworder-pin-box";
      pinRow.append(box);
      return box;
    });
    body.append(pinRow);

    const status = document.createElement("div");
    status.className = "passworder-status";
    body.append(status);
    wirePinBoxes(boxes, async (pin) => {
      status.textContent = "\u6b63\u5728\u89e3\u9501...";
      try {
        const response = await sendMessage({
          type: "inline-unlock-and-fill",
          recordId: selectedRecordId,
          pin,
          timeoutMinutes: state.defaultTimeoutMinutes
        });
        fillInput(activeInput, response.password);
        status.textContent = "\u5df2\u586b\u5145\u3002";
        setTimeout(hidePanel, 400);
      } catch (error) {
        status.textContent = error.message;
        boxes.forEach((box) => {
          box.value = "";
        });
        boxes[0]?.focus();
      }
    });
    boxes[0]?.focus();
  }

  async function fillFromUnlocked(recordId = "") {
    try {
      const response = await sendMessage({ type: "inline-fill", recordId });
      fillInput(activeInput, response.password);
      hidePanel();
    } catch (error) {
      renderPanel({ ok: false, error: error.message });
    }
  }

  function createPanel() {
    const root = document.createElement("div");
    root.id = "passworder-inline-panel";
    root.innerHTML = `
      <style>
        #passworder-inline-panel {
          background:
            radial-gradient(circle at top right, rgba(255, 176, 66, 0.22), transparent 42%),
            linear-gradient(145deg, #fffaf0, #eee2cf);
          border: 1px solid rgba(74, 51, 24, 0.2);
          border-radius: 18px;
          box-shadow: 0 18px 48px rgba(25, 20, 12, 0.2);
          color: #1a1712;
          font-family: "Microsoft YaHei", "Noto Sans SC", sans-serif;
          font-size: 13px;
          max-width: min(340px, calc(100vw - 16px));
          padding: 12px;
          position: fixed;
          width: max-content;
          z-index: 2147483647;
        }
        #passworder-inline-panel [data-title] {
          color: #9b4d15;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .passworder-inline-text {
          color: #5f503e;
          line-height: 1.45;
          margin-bottom: 8px;
          max-width: 300px;
          overflow-wrap: anywhere;
        }
        .passworder-inline-action {
          background: #1d2b24;
          border: 1px solid transparent;
          border-radius: 999px;
          color: #fff6e8;
          cursor: pointer;
          display: block;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
          margin-top: 7px;
          min-height: 38px;
          padding: 8px 12px;
          text-align: left;
          white-space: normal;
          width: 100%;
        }
        .passworder-pin-row {
          display: grid;
          gap: 7px;
          grid-template-columns: repeat(6, 1fr);
          margin-top: 8px;
        }
        .passworder-pin-box {
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(55, 42, 24, 0.28);
          border-radius: 10px;
          box-sizing: border-box;
          font-size: 18px;
          height: 38px;
          outline: none;
          text-align: center;
          width: 100%;
        }
        .passworder-pin-box:focus {
          background: #fffdf7;
          border-color: rgba(155, 77, 21, 0.52);
          box-shadow: 0 0 0 3px rgba(155, 77, 21, 0.12);
        }
        .passworder-status {
          color: #9f1d16;
          font-size: 12px;
          margin-top: 7px;
          min-height: 16px;
        }
      </style>
      <div data-title></div>
      <div data-body></div>
    `;
    root.addEventListener("mousedown", (event) => {
      event.preventDefault();
      clearHideTimer();
    });
    document.documentElement.append(root);
    return root;
  }

  function positionPanel() {
    if (!panel || !activeInput || !isFillablePasswordInput(activeInput)) {
      return;
    }
    const rect = activeInput.getBoundingClientRect();
    const top = Math.min(rect.bottom + 8, window.innerHeight - panel.offsetHeight - 8);
    const left = Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8);
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.left = `${Math.max(8, left)}px`;
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (!panel?.contains(document.activeElement)) {
        hidePanel();
      }
    }, 180);
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hidePanel() {
    clearHideTimer();
    panel?.remove();
    panel = null;
  }

  function textBlock(text) {
    const element = document.createElement("div");
    element.className = "passworder-inline-text";
    element.textContent = text;
    return element;
  }

  function actionButton(text, onClick) {
    const button = document.createElement("button");
    button.className = "passworder-inline-action";
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  }

  function recordButton(record, unlocked) {
    const label = record.account || record.note || "\u9ed8\u8ba4\uff1a\u6309\u7f51\u7ad9\u751f\u6210";
    const mode = record.mode === "account" ? "\u6309\u8d26\u53f7\u6807\u8bc6\u751f\u6210" : "\u6309\u7f51\u7ad9\u751f\u6210";
    return actionButton(`${label} \u00b7 ${mode}`, () => {
      selectedRecordId = record.id || "";
      if (unlocked) {
        fillFromUnlocked(selectedRecordId);
      }
    });
  }

  function wirePinBoxes(boxes, onComplete) {
    boxes.forEach((box, index) => {
      box.addEventListener("input", () => {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        if (box.value && index < boxes.length - 1) {
          boxes[index + 1].focus();
        }
        const pin = boxes.map((item) => item.value).join("");
        if (/^\d{6}$/.test(pin)) {
          onComplete(pin);
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
        const pin = boxes.map((item) => item.value).join("");
        if (/^\d{6}$/.test(pin)) {
          onComplete(pin);
        }
      });
    });
  }

  function findPasswordInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
    const visible = inputs.filter(isFillablePasswordInput);
    return visible.find((input) => input === document.activeElement) ?? visible[0] ?? null;
  }

  function isFillablePasswordInput(element) {
    if (!(element instanceof HTMLInputElement) || element.type !== "password") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      !element.disabled &&
      !element.readOnly
    );
  }

  function fillInput(input, value) {
    if (!input || !value) {
      return;
    }
    const descriptor =
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");

    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function sendMessage(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) {
      throw new Error(response?.error ?? "\u63d2\u4ef6\u8bf7\u6c42\u5931\u8d25\u3002");
    }
    return response;
  }
}
