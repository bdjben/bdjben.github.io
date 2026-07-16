const expectedKeyHash = "15251eddd244759762fc4a39f2cc144fb467f24e240351b59f261618374beeae";
const accessStorageKey = "ben-client-portal-access";

const loginView = document.querySelector("[data-portal-login]");
const documentsView = document.querySelector("[data-portal-documents]");
const loginForm = document.querySelector("[data-portal-form]");
const clientKeyInput = document.querySelector("#client-key");
const statusMessage = document.querySelector("[data-portal-status]");
const signOutButton = document.querySelector("[data-portal-sign-out]");

const setStoredAccess = (value) => {
  try {
    if (value) {
      window.sessionStorage.setItem(accessStorageKey, "granted");
    } else {
      window.sessionStorage.removeItem(accessStorageKey);
    }
  } catch {
    // The portal remains usable for the current page when storage is unavailable.
  }
};

const hasStoredAccess = () => {
  try {
    return window.sessionStorage.getItem(accessStorageKey) === "granted";
  } catch {
    return false;
  }
};

const showDocuments = ({ focus = true } = {}) => {
  loginView.hidden = true;
  documentsView.hidden = false;
  statusMessage.textContent = "";
  clientKeyInput.value = "";
  window.history.replaceState(null, "", "#documents");

  if (focus) {
    documentsView.focus({ preventScroll: true });
    documentsView.scrollIntoView({ behavior: "auto", block: "start" });
  }
};

const showLogin = () => {
  documentsView.hidden = true;
  loginView.hidden = false;
  statusMessage.textContent = "";
  clientKeyInput.value = "";
  window.history.replaceState(null, "", window.location.pathname);
  clientKeyInput.focus();
};

const sha256 = async (value) => {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable");
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const enteredKey = clientKeyInput.value.trim();

  if (!enteredKey) {
    statusMessage.textContent = "Enter your Client Key to continue.";
    clientKeyInput.focus();
    return;
  }

  try {
    const enteredKeyHash = await sha256(enteredKey);

    if (enteredKeyHash === expectedKeyHash) {
      setStoredAccess(true);
      showDocuments();
      return;
    }

    statusMessage.textContent = "That Client Key was not recognized. Check it and try again.";
    clientKeyInput.select();
  } catch {
    statusMessage.textContent = "This browser could not verify the Client Key. Try a current browser or contact Ben.";
  }
});

signOutButton.addEventListener("click", () => {
  setStoredAccess(false);
  showLogin();
});

if (hasStoredAccess()) {
  showDocuments({ focus: false });
}
