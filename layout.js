(() => {
  const root = document.documentElement;
  const storageKey = "pocket-morning-layout";
  const touch = matchMedia("(any-pointer: coarse)");
  let mode = "auto";
  try {
    if (localStorage.getItem(storageKey) === "mobile") mode = "mobile";
  } catch (_) { /* Layout also works without browser storage. */ }
  if (new URLSearchParams(location.search).get("view") === "mobile") mode = "mobile";
  let frame;
  function sync() {
    const viewport = window.visualViewport;
    // Keep pinch zoom available; zooming must not resize the game underneath it.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    const height = Math.round(viewport?.height || innerHeight);
    const mobile = mode === "mobile" || innerWidth <= 760 || touch.matches;
    root.classList.toggle("mobile-ui", mobile);
    root.classList.toggle("mobile-landscape", mobile && innerWidth > height && height < 650);
    root.style.setProperty("--app-height", `${height}px`);
    window.dispatchEvent(new Event("rpg-layoutchange"));
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }
  window.RPG_LAYOUT = {
    get mode() { return mode; },
    setMode(value) {
      mode = value === "mobile" ? "mobile" : "auto";
      try { localStorage.setItem(storageKey, mode); } catch (_) {}
      sync();
    },
  };
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  touch.addEventListener("change", schedule);
  sync();
})();
