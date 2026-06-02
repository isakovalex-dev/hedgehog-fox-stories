(function (window) {
  "use strict";

  function getJSON(key, defaultValue) {
    try {
      const rawValue = window.localStorage.getItem(key);
      if (rawValue === null) return defaultValue;

      return JSON.parse(rawValue);
    } catch (error) {
      console.warn(`[storageService] Cannot read ${key}`, error);
      return defaultValue;
    }
  }

  function setJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[storageService] Cannot write ${key}`, error);
      return false;
    }
  }

  function removeItem(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`[storageService] Cannot remove ${key}`, error);
      return false;
    }
  }

  window.HFStorageService = {
    getJSON,
    setJSON,
    removeItem
  };
})(window);
