(() => {
  const prompt = document.getElementById("immersivePrompt");
  const browserNote = document.getElementById("browserNote");
  let wakeLock = null;
  let reloadingForUpdate = false;

  const isInstalled = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;

  async function requestWakeLock() {
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      if (wakeLock) return;
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch (error) {
      console.warn("No se pudo mantener la pantalla activa:", error);
    }
  }

  async function enterPresentationMode() {
    try {
      if (!document.fullscreenElement && !isInstalled() && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      }
    } catch (error) {
      console.warn("Pantalla completa no disponible:", error);
    }

    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (error) {
      console.warn("No se pudo bloquear la orientación:", error);
    }

    await requestWakeLock();
    sessionStorage.setItem("presentationStarted", "1");
    prompt?.classList.add("is-hidden");
    window.dispatchEvent(new CustomEvent("central-presentation-started"));
  }

  if (browserNote && isInstalled()) {
    browserNote.textContent = "La aplicación se abrió instalada, sin barra de dirección.";
  }

  if (sessionStorage.getItem("presentationStarted") === "1") {
    prompt?.classList.add("is-hidden");
    requestWakeLock();
    queueMicrotask(() => window.dispatchEvent(new CustomEvent("central-presentation-started")));
  } else {
    prompt?.addEventListener("click", enterPresentationMode, { once: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && sessionStorage.getItem("presentationStarted") === "1") {
      requestWakeLock();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
        registration.update().catch(() => {});

        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);
      } catch (error) {
        console.error("No se pudo registrar el service worker:", error);
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });
  }
})();
