(() => {
  // Umschalten: true wenn du die Node-API verwenden willst (siehe server.js).
  const USE_API = false;
  const API_BASE = "http://localhost:8080";

  const form = document.getElementById("authForm");
  const statusText = document.getElementById("statusText");
  const tabs = document.querySelectorAll(".tab");
  const nameField = document.querySelector('[data-field="name"]');
  const confirmField = document.querySelector('[data-field="confirm"]');
  const rememberBox = form.querySelector('input[name="remember"]');

  const state = { mode: "login" };

  const toHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  async function hashPassword(value) {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(value);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return toHex(hash);
    }
    return btoa(value); // Fallback für alte Browser (nicht sicher, aber besser als Klartext im Demo-Modus).
  }

  const localStore = {
    key: "harbor.users",
    read() {
      try {
        return JSON.parse(localStorage.getItem(this.key) || "[]");
      } catch (_) {
        return [];
      }
    },
    write(list) {
      localStorage.setItem(this.key, JSON.stringify(list));
    },
    async register({ name, email, password }) {
      const users = this.read();
      const normalizedEmail = email.toLowerCase();
      if (users.some((u) => u.email === normalizedEmail)) {
        throw new Error("Diese E-Mail ist bereits registriert.");
      }
      const user = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        name,
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      this.write(users);
      return { name: user.name, email: user.email };
    },
    async login({ email, password }) {
      const users = this.read();
      const normalizedEmail = email.toLowerCase();
      const user = users.find((u) => u.email === normalizedEmail);
      if (!user) {
        throw new Error("Kein Konto gefunden. Bitte registrieren.");
      }
      const hash = await hashPassword(password);
      if (hash !== user.passwordHash) {
        throw new Error("Falsches Passwort.");
      }
      return { name: user.name, email: user.email };
    },
  };

  const apiStore = {
    async register(payload) {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Registrierung fehlgeschlagen.");
      }
      return data;
    },
    async login(payload) {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Login fehlgeschlagen.");
      }
      return data;
    },
  };

  const dataLayer = USE_API ? apiStore : localStore;

  function setStatus(message, tone = "default") {
    statusText.textContent = message;
    statusText.className = "status__text";
    if (tone === "success") statusText.classList.add("is-success");
    if (tone === "error") statusText.classList.add("is-error");
  }

  function toggleMode(mode, { silentStatus = false } = {}) {
    state.mode = mode;
    tabs.forEach((tab) => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle("tab--active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    nameField.style.display = mode === "register" ? "flex" : "none";
    confirmField.style.display = mode === "register" ? "flex" : "none";
    form.elements.password.placeholder =
      mode === "register" ? "Mindestens 8 Zeichen" : "Dein Passwort";
    if (!silentStatus) {
      setStatus(mode === "login" ? "Bereit." : "Fast geschafft: noch ein paar Angaben.");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => toggleMode(tab.dataset.mode));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      name: data.get("name")?.toString().trim(),
      email: data.get("email")?.toString().trim(),
      password: data.get("password")?.toString() || "",
      confirm: data.get("confirm")?.toString() || "",
    };

    if (!payload.email || !payload.password) {
      setStatus("Bitte E-Mail und Passwort ausfüllen.", "error");
      return;
    }

    if (state.mode === "register") {
      if (!payload.name) {
        setStatus("Name darf nicht leer sein.", "error");
        return;
      }
      if (payload.password.length < 8) {
        setStatus("Passwort sollte mindestens 8 Zeichen haben.", "error");
        return;
      }
      if (payload.password !== payload.confirm) {
        setStatus("Passwörter stimmen nicht überein.", "error");
        return;
      }
    }

    setStatus("Wird geprüft ...");

    try {
      const result =
        state.mode === "login"
          ? await dataLayer.login({ email: payload.email, password: payload.password })
          : await dataLayer.register({
              name: payload.name,
              email: payload.email,
              password: payload.password,
            });

      if (rememberBox.checked && state.mode === "login") {
        localStorage.setItem("harbor.lastEmail", payload.email.toLowerCase());
      }

      setStatus(
        state.mode === "login"
          ? `Willkommen zurück, ${result.name || "du"}!`
          : "Konto angelegt. Du kannst dich jetzt einloggen.",
        "success"
      );

      form.reset();
      const savedEmail = localStorage.getItem("harbor.lastEmail");
      if (savedEmail) {
        form.elements.email.value = savedEmail;
      }
      if (state.mode === "register") {
        toggleMode("login", { silentStatus: true });
      }
    } catch (error) {
      setStatus(error.message || "Unbekannter Fehler.", "error");
    }
  });

  function bootstrap() {
    const savedEmail = localStorage.getItem("harbor.lastEmail");
    if (savedEmail) {
      form.elements.email.value = savedEmail;
    }
    toggleMode("login");
  }

  bootstrap();
})();
