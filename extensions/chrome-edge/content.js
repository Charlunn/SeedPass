if (!globalThis.__PASSWORDER_CONTENT_SCRIPT_LOADED__) {
  globalThis.__PASSWORDER_CONTENT_SCRIPT_LOADED__ = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "passworder-fill") {
      return false;
    }

    const input = findPasswordInput();
    if (!input) {
      sendResponse({ filled: false });
      return true;
    }

    setInputValue(input, message.password);
    sendResponse({ filled: true });
    return true;
  });
}

function findPasswordInput() {
  const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
  const visible = inputs.filter(isVisible);
  return visible.find((input) => input === document.activeElement) ?? visible[0] ?? null;
}

function isVisible(element) {
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

function setInputValue(input, value) {
  const descriptor =
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") ??
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");

  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
