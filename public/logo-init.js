// Logo pre-paint: apply the saved logo form before first paint (see src/brand/logo-resize.ts).
(function () {
  try { var logo = localStorage.getItem("logo-form"); if (logo === "short" || logo === "middle" || logo === "long") document.documentElement.setAttribute("data-logo", logo); } catch (e) {}
})();
