(() => {
  const $ = (selector) => document.querySelector(selector);
  const endpointInput = $("#cloudWorkerUrl");
  const keyInput = $("#cloudAccessKey");
  const status = $("#cloudBrowserStatus");
  const inspector = $("#browserInspector");
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("ryusen-cloud-browser-v1") || "{}"); }
    catch { return {}; }
  })();

  endpointInput.value = saved.endpoint || "";
  keyInput.value = saved.key || "";

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function config() {
    const endpoint = endpointInput.value.trim().replace(/\/+$/, "");
    const key = keyInput.value.trim();
    if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(endpoint)) {
      throw new Error("Enter your Worker URL, for example https://ryusen-browser-worker.YOUR-SUBDOMAIN.workers.dev");
    }
    if (key.length < 24) throw new Error("Enter the private Ryusen access key you saved in GitHub Actions secrets.");
    return { endpoint, key };
  }

  $("#saveCloudConfig").addEventListener("click", () => {
    try {
      const value = config();
      localStorage.setItem("ryusen-cloud-browser-v1", JSON.stringify(value));
      setStatus("Worker URL and access key saved on this device.");
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  $("#checkCloudWorker").addEventListener("click", async () => {
    try {
      const { endpoint } = config();
      setStatus("Checking the cloud worker…");
      const response = await fetch(endpoint + "/api/health", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Worker health check failed.");
      setStatus(result.configured
        ? "Worker online. Cloudflare account and secrets are configured. Free browser allowance: 10 minutes/day."
        : "Worker is online, but Cloudflare secrets are not configured yet.", !result.configured);
    } catch (error) {
      setStatus(error.message || "Could not reach the worker.", true);
    }
  });

  $("#createBrowserSession").addEventListener("click", async () => {
    try {
      const { endpoint, key } = config();
      localStorage.setItem("ryusen-cloud-browser-v1", JSON.stringify({ endpoint, key }));
      inspector.hidden = true;
      setStatus("Requesting a Cloudflare browser session…");
      const response = await fetch(endpoint + "/api/browser-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ryusen-Key": key },
        body: JSON.stringify({ target: "flow" }),
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not create a browser session.");
      inspector.href = result.inspectorUrl;
      inspector.hidden = false;
      setStatus("Remote browser created. Open the inspector, navigate to flow.google.com, then sign in. Session lasts up to 10 minutes.");
    } catch (error) {
      setStatus(error.message || "Could not create a browser session.", true);
    }
  });
})();
