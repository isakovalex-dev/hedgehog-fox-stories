(function () {
  "use strict";

  const normalizedPath = (window.location.pathname || "/").replace(/\/+$/, "") || "/";

  if (normalizedPath === "/create") {
    document.documentElement.dataset.initialRoute = "create";
  }
})();
