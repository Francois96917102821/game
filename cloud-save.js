"use strict";

(() => {
  const SESSION_KEY = "well-of-whispers-cloud-session";
  const LINKED_USERS_KEY = "well-of-whispers-cloud-linked-users";
  const SAVE_TABLE = "game_saves";
  const HISTORY_TABLE = "game_save_history";
  const $ = (id) => document.getElementById(id);
  const ui = {
    open: $("cloud-open-button"),
    headerStatus: $("cloud-header-status"),
    dialog: $("cloud-dialog"),
    status: $("cloud-status"),
    authForm: $("cloud-auth-form"),
    email: $("cloud-email"),
    password: $("cloud-password"),
    signIn: $("cloud-signin-button"),
    signUp: $("cloud-signup-button"),
    account: $("cloud-account"),
    accountEmail: $("cloud-account-email"),
    sync: $("cloud-sync-button"),
    signOut: $("cloud-signout-button"),
    history: $("cloud-history"),
    historySelect: $("cloud-history-select"),
    restore: $("cloud-restore-button"),
    conflict: $("cloud-conflict-dialog"),
    conflictSummary: $("cloud-conflict-summary"),
    useLocal: $("cloud-use-local-button"),
    useRemote: $("cloud-use-remote-button"),
  };

  let config = window.WELL_CLOUD_CONFIG || {};
  let session = null;
  let callbacks = null;
  let latestRemote = null;
  let pendingConflict = null;
  let ready = false;
  let busy = false;
  let saveTimer = null;
  let syncQueue = Promise.resolve();

  function isConfigured() {
    try {
      return Boolean(
        config.supabaseUrl &&
        new URL(config.supabaseUrl).protocol === "https:" &&
        config.supabaseAnonKey,
      );
    } catch {
      return false;
    }
  }

  function setStatus(message, isError = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle("cloud-error", isError);
    ui.headerStatus.textContent = session
      ? (isError ? "ОШИБКА ОБЛАКА" : ready ? "ОБЛАКО СИНХРОНИЗИРОВАНО" : "СИНХРОНИЗАЦИЯ…")
      : isConfigured() ? "ЛОКАЛЬНОЕ СОХРАНЕНИЕ" : "ОБЛАКО НЕ НАСТРОЕНО";
  }

  function setBusy(value) {
    busy = value;
    for (const control of [ui.signIn, ui.signUp, ui.sync, ui.signOut, ui.restore]) {
      control.disabled = value;
    }
  }

  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (!value || typeof value !== "object") return JSON.stringify(value);
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`
    ).join(",")}}`;
  }

  function sameSnapshot(left, right) {
    return canonical(left) === canonical(right);
  }

  function parseError(payload, status) {
    return payload?.msg || payload?.message || payload?.error_description ||
      payload?.error || `Ошибка сервера (${status}).`;
  }

  async function request(path, { service = "rest", method = "GET", body, token } = {}) {
    if (!isConfigured()) throw new Error("Облачное сохранение не настроено. Укажите URL и публичный ключ Supabase в cloud-config.js.");
    const root = config.supabaseUrl.replace(/\/+$/, "");
    const headers = {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${token || session?.access_token || config.supabaseAnonKey}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (service === "rest") headers.Prefer = "resolution=merge-duplicates,return=minimal";
    const response = await fetch(`${root}/${service === "auth" ? "auth/v1" : "rest/v1"}/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }
    if (!response.ok) throw new Error(parseError(payload, response.status));
    return payload;
  }

  function storeSession() {
    if (!session) {
      window.localStorage.removeItem(SESSION_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function setSession(payload) {
    const accessToken = payload?.access_token || payload?.session?.access_token;
    if (!accessToken) return false;
    const tokenData = payload.session || payload;
    session = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
      user: tokenData.user || payload.user || session?.user || null,
    };
    storeSession();
    return true;
  }

  function loadSession() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
      if (stored && typeof stored.access_token === "string" && typeof stored.refresh_token === "string") {
        session = stored;
      }
    } catch (error) {
      console.warn("Не удалось восстановить облачную сессию.", error);
      session = null;
    }
  }

  async function ensureSession() {
    if (!session) throw new Error("Войди в облачный аккаунт.");
    if (session.expires_at > Date.now() + 60_000) return;
    const refreshed = await request("token?grant_type=refresh_token", {
      service: "auth",
      method: "POST",
      body: { refresh_token: session.refresh_token },
      token: config.supabaseAnonKey,
    });
    if (!setSession(refreshed)) throw new Error("Срок облачной сессии истёк. Войди снова.");
  }

  async function authenticatedRequest(path, options = {}) {
    await ensureSession();
    try {
      return await request(path, options);
    } catch (error) {
      if (/401|jwt|token expired/i.test(error.message)) {
        session.expires_at = 0;
        await ensureSession();
        return request(path, options);
      }
      throw error;
    }
  }

  function linkedUsers() {
    try {
      const ids = JSON.parse(window.localStorage.getItem(LINKED_USERS_KEY) || "[]");
      return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  function rememberLinkedUser(userId) {
    const ids = new Set(linkedUsers());
    ids.add(userId);
    window.localStorage.setItem(LINKED_USERS_KEY, JSON.stringify([...ids]));
  }

  function currentUserId() {
    return session?.user?.id;
  }

  function localSnapshot() {
    const snapshot = callbacks.readLocal();
    return {
      version: 1,
      bestFloor: snapshot.bestFloor,
      run: snapshot.run || null,
    };
  }

  function isValidSnapshot(snapshot) {
    return Boolean(
      snapshot && snapshot.version === 1 &&
      Number.isInteger(snapshot.bestFloor) && snapshot.bestFloor >= 0 &&
      (snapshot.run === null || callbacks.validateRun(snapshot.run)),
    );
  }

  async function fetchLatest() {
    const userId = currentUserId();
    const query = `user_id=eq.${encodeURIComponent(userId)}&select=user_id,save_data,updated_at&limit=1`;
    const rows = await authenticatedRequest(`${SAVE_TABLE}?${query}`);
    if (!Array.isArray(rows) || rows.length > 1) throw new Error("Облачное хранилище вернуло неожиданный ответ.");
    if (!rows.length) return null;
    if (!isValidSnapshot(rows[0].save_data)) {
      throw new Error("Облачное сохранение повреждено или создано несовместимой версией. Локальные данные не изменены.");
    }
    return rows[0];
  }

  async function writeLatest(snapshot) {
    if (!isValidSnapshot(snapshot)) throw new Error("Не удалось сохранить: формат игрового состояния недопустим.");
    await authenticatedRequest(`${SAVE_TABLE}?on_conflict=user_id`, {
      method: "POST",
      body: { user_id: currentUserId(), save_data: snapshot },
    });
    latestRemote = snapshot;
  }

  function showConflict(local, remoteRow) {
    pendingConflict = { local, remoteRow };
    const localRun = local.run?.state;
    const remoteRun = remoteRow.save_data.run?.state;
    ui.conflictSummary.textContent =
      `На этом устройстве: ${localRun ? `этаж ${localRun.floor}, уровень ${localRun.level}` : "нет активного забега"}. ` +
      `В облаке: ${remoteRun ? `этаж ${remoteRun.floor}, уровень ${remoteRun.level}` : "нет активного забега"}. ` +
      "Вторая версия будет сохранена в истории облака перед заменой.";
    if (!ui.conflict.open) ui.conflict.showModal();
    setStatus("Найдены разные версии. Выбери, какую продолжить.");
  }

  async function reconcile(local, remoteRow) {
    const userId = currentUserId();
    const wasLinked = linkedUsers().includes(userId);
    if (!remoteRow) {
      if (local.run || local.bestFloor > 0) await writeLatest(local);
      latestRemote = local;
      rememberLinkedUser(userId);
      callbacks.refresh();
      ready = true;
      setStatus("Облачное сохранение подключено.");
      return;
    }

    const remote = remoteRow.save_data;
    if (local.run && remote.run && !sameSnapshot(local.run, remote.run)) {
      showConflict(local, remoteRow);
      return;
    }
    if (local.run && !remote.run && wasLinked) {
      showConflict(local, remoteRow);
      return;
    }
    if (!local.run && remote.run && wasLinked) {
      showConflict(local, remoteRow);
      return;
    }

    const merged = {
      version: 1,
      bestFloor: Math.max(local.bestFloor, remote.bestFloor),
      run: local.run || remote.run,
    };
    if (!sameSnapshot(merged, remote)) await writeLatest(merged);
    latestRemote = merged;
    if (!sameSnapshot(local, merged)) callbacks.restore(merged);
    rememberLinkedUser(userId);
    ready = true;
    setStatus("Облачное сохранение синхронизировано.");
  }

  function enqueue(task) {
    syncQueue = syncQueue.then(task).catch((error) => {
      ready = false;
      setStatus(`Не удалось синхронизировать: ${error.message}`, true);
      console.error("Ошибка облачной синхронизации.", error);
    });
    return syncQueue;
  }

  async function syncFromCloud() {
    if (!session || busy) return;
    setBusy(true);
    ready = false;
    setStatus("Проверяю облачное сохранение…");
    try {
      const remote = await fetchLatest();
      await reconcile(localSnapshot(), remote);
      try {
        await loadHistory();
      } catch (error) {
        setStatus(`Сохранение синхронизировано, но историю копий загрузить не удалось: ${error.message}`, true);
        console.error("Не удалось загрузить историю облачных сохранений.", error);
      }
    } catch (error) {
      setStatus(`Не удалось прочитать облачное сохранение: ${error.message}`, true);
      console.error("Ошибка чтения облачного сохранения.", error);
    } finally {
      setBusy(false);
    }
  }

  function scheduleSave(snapshot) {
    if (!session || !ready || pendingConflict || !isValidSnapshot(snapshot)) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => enqueue(async () => {
      if (!session || !ready || pendingConflict) return;
      const remote = await fetchLatest();
      if (
        remote && latestRemote && !sameSnapshot(remote.save_data, latestRemote) &&
        !sameSnapshot(remote.save_data, snapshot)
      ) {
        ready = false;
        showConflict(snapshot, remote);
        await loadHistory();
        return;
      }
      if (!remote || !sameSnapshot(snapshot, remote.save_data)) await writeLatest(snapshot);
      latestRemote = snapshot;
      setStatus("Прогресс сохранён в облаке.");
    }));
  }

  async function authenticate(isSignUp) {
    if (busy) return;
    const email = ui.email.value.trim();
    const password = ui.password.value;
    if (!email || !password) {
      setStatus("Укажи адрес почты и пароль.", true);
      return;
    }
    setBusy(true);
    setStatus(isSignUp ? "Создаю аккаунт…" : "Выполняю вход…");
    try {
      const body = { email, password };
      if (isSignUp) {
        body.options = {
          emailRedirectTo: new URL(window.location.pathname, window.location.origin).href,
        };
      }
      const result = await request(isSignUp ? "signup" : "token?grant_type=password", {
        service: "auth",
        method: "POST",
        body,
        token: config.supabaseAnonKey,
      });
      if (!setSession(result)) {
        setStatus("Проверь почту и подтверди адрес, затем войди в аккаунт.");
        return;
      }
      session.user = result.user || result.session?.user || null;
      if (!session.user?.id) {
        session.user = await request("user", { service: "auth", token: session.access_token });
      }
      storeSession();
      setBusy(false);
      await finishLogin();
    } catch (error) {
      setStatus(`${isSignUp ? "Не удалось создать аккаунт" : "Не удалось войти"}: ${error.message}`, true);
    } finally {
      setBusy(false);
    }
  }

  async function finishLogin() {
    ui.authForm.hidden = true;
    ui.account.hidden = false;
    ui.accountEmail.textContent = session.user?.email || "Аккаунт подключён";
    await syncFromCloud();
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      if (session) {
        try {
          await authenticatedRequest("logout", { service: "auth", method: "POST" });
        } catch (error) {
          console.warn("Сервер не подтвердил выход из облачного аккаунта.", error);
        }
      }
      session = null;
      latestRemote = null;
      ready = false;
      pendingConflict = null;
      storeSession();
      ui.account.hidden = true;
      ui.authForm.hidden = false;
      setStatus("Выход выполнен. Локальный забег сохранён на этом устройстве.");
    } catch (error) {
      setStatus(`Не удалось завершить выход: ${error.message}`, true);
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(useLocal) {
    if (!pendingConflict || busy) return;
    const conflict = pendingConflict;
    setBusy(true);
    try {
      if (useLocal) {
        await writeLatest(conflict.local);
        latestRemote = conflict.local;
      } else {
        const remote = conflict.remoteRow.save_data;
        const withBestFloor = {
          version: 1,
          bestFloor: Math.max(remote.bestFloor, conflict.local.bestFloor),
          run: remote.run,
        };
        await authenticatedRequest(HISTORY_TABLE, {
          method: "POST",
          body: {
            user_id: currentUserId(),
            save_data: conflict.local,
            source: "локальная версия конфликта",
          },
        });
        if (!sameSnapshot(withBestFloor, remote)) await writeLatest(withBestFloor);
        latestRemote = withBestFloor;
        callbacks.restore(withBestFloor);
      }
      pendingConflict = null;
      ready = true;
      if (ui.conflict.open) ui.conflict.close();
      rememberLinkedUser(currentUserId());
      const resolvedMessage = useLocal
        ? "Выбранный локальный забег сохранён в облаке; прежняя версия добавлена в историю."
        : "Загружена облачная версия; локальный вариант сохранён в истории облака.";
      try {
        await loadHistory();
        setStatus(resolvedMessage);
      } catch (error) {
        setStatus(`${resolvedMessage} Не удалось обновить список копий: ${error.message}`, true);
        console.error("Не удалось обновить историю после разрешения конфликта.", error);
      }
    } catch (error) {
      setStatus(`Не удалось разрешить конфликт: ${error.message}. Локальная версия остаётся в этом браузере; проверь облако перед повтором.`, true);
      console.error("Ошибка разрешения конфликта облачных сохранений.", error);
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory() {
    if (!session || !isConfigured()) return;
    const userId = currentUserId();
    const query = `user_id=eq.${encodeURIComponent(userId)}&select=id,save_data,source,archived_at&order=archived_at.desc&limit=20`;
    const rows = await authenticatedRequest(`${HISTORY_TABLE}?${query}`);
    ui.historySelect.replaceChildren();
    for (const row of rows) {
      if (!isValidSnapshot(row.save_data)) continue;
      const option = document.createElement("option");
      option.value = String(row.id);
      const date = new Date(row.archived_at);
      option.textContent = `${date.toLocaleString()} · ${row.source || "резервная копия"}`;
      ui.historySelect.append(option);
    }
    ui.history.hidden = rows.length === 0;
  }

  async function restoreHistory() {
    if (!session || !ui.historySelect.value || busy) return;
    setBusy(true);
    try {
      const id = encodeURIComponent(ui.historySelect.value);
      const query = `id=eq.${id}&user_id=eq.${encodeURIComponent(currentUserId())}&select=save_data&limit=1`;
      const rows = await authenticatedRequest(`${HISTORY_TABLE}?${query}`);
      const snapshot = rows[0]?.save_data;
      if (!isValidSnapshot(snapshot)) throw new Error("Резервная копия недоступна или несовместима.");
      if (!window.confirm("Заменить текущий облачный забег этой копией? Текущий вариант сначала попадёт в историю.")) return;
      await writeLatest(snapshot);
      callbacks.restore(snapshot);
      latestRemote = snapshot;
      ready = true;
      try {
        await loadHistory();
        setStatus("Резервная копия восстановлена; прежнее облачное сохранение оставлено в истории.");
      } catch (error) {
        setStatus(`Копия восстановлена, но список истории не обновился: ${error.message}`, true);
        console.error("Не удалось обновить историю после восстановления копии.", error);
      }
    } catch (error) {
      setStatus(`Не удалось восстановить резервную копию: ${error.message}`, true);
    } finally {
      setBusy(false);
    }
  }

  function handleAuthRedirect() {
    if (!window.location.hash) return null;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const errorCode = params.get("error_code") || params.get("error");
    if (errorCode) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      const message = errorCode === "otp_expired"
        ? "Ссылка подтверждения устарела или уже использована. Зарегистрируйся ещё раз, чтобы получить новую."
        : "Не удалось подтвердить почту по этой ссылке. Попробуй зарегистрироваться ещё раз.";
      return { error: message };
    }
    if (!params.has("access_token") || !params.has("refresh_token")) return null;
    const accepted = setSession({
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      expires_in: params.get("expires_in"),
      token_type: params.get("token_type"),
    });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (accepted) setStatus("Почта подтверждена. Проверяю облачный аккаунт…");
    return { accepted };
  }

  async function initialize(options) {
    callbacks = options;
    ui.open.addEventListener("click", () => {
      if (!ui.dialog.open) ui.dialog.showModal();
    });
    ui.signIn.addEventListener("click", () => authenticate(false));
    ui.signUp.addEventListener("click", () => authenticate(true));
    ui.sync.addEventListener("click", syncFromCloud);
    ui.signOut.addEventListener("click", signOut);
    ui.useLocal.addEventListener("click", () => resolveConflict(true));
    ui.useRemote.addEventListener("click", () => resolveConflict(false));
    ui.restore.addEventListener("click", restoreHistory);
    ui.email.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        authenticate(false);
      }
    });
    ui.password.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        authenticate(false);
      }
    });
    ui.conflict.addEventListener("cancel", (event) => {
      event.preventDefault();
      setStatus("Выбери версию, чтобы возобновить синхронизацию.");
    });

    if (!isConfigured()) {
      ui.signIn.disabled = true;
      ui.signUp.disabled = true;
      setStatus("Облако пока не подключено. Игра и локальные сохранения работают; настрой cloud-config.js и Supabase по инструкции в README.");
      return;
    }

    const authCallback = handleAuthRedirect();
    if (!authCallback) loadSession();
    if (authCallback?.error) {
      setStatus(authCallback.error, true);
    }
    if (session) {
      try {
        await ensureSession();
        session.user = await request("user", { service: "auth", token: session.access_token });
        storeSession();
        await finishLogin();
      } catch (error) {
        session = null;
        storeSession();
        ui.account.hidden = true;
        ui.authForm.hidden = false;
        setStatus(`Облачная сессия завершилась: ${error.message}. Войди снова.`, true);
      }
    } else if (!authCallback?.error) {
      setStatus("Локальный прогресс сохранён. Войди или создай аккаунт, чтобы включить облако.");
    }
    window.setInterval(() => {
      if (session && ready && document.visibilityState === "visible") syncFromCloud();
    }, 45_000);
    document.addEventListener("visibilitychange", () => {
      if (session && ready && document.visibilityState === "visible") syncFromCloud();
    });
  }

  window.WellCloudSave = {
    initialize,
    scheduleSave,
    isConfigured,
  };
})();
