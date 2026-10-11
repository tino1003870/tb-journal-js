/*
 * TB Journal Firefox boot diagnostics.
 * This file deliberately has no imports so it can report failures that
 * prevent journal.js from being loaded or evaluated.
 */
(() => {
    "use strict";

    function format(args) {
        return args.map(value => {
            if (typeof value === "string") return value;
            try { return JSON.stringify(value, null, 2); }
            catch (_) { return String(value); }
        }).join(" ");
    }

    function write(...args) {
        const text = format(args);
        const element = document.getElementById("debugLog");
        const timestamp = new Date().toLocaleTimeString();

        if (element) {
            element.textContent += `[${timestamp}] ${text}\n`;
            element.scrollTop = element.scrollHeight;
        }

        console.log("[TB-JOURNAL-BOOT]", ...args);
    }

    window.tbJournalDebugLog = write;

    window.addEventListener("error", event => {
        write(
            "JAVASCRIPT ERROR:",
            event.message || "unknown error",
            event.filename ? `(${event.filename}:${event.lineno}:${event.colno})` : ""
        );
    });

    window.addEventListener("unhandledrejection", event => {
        const reason = event.reason;
        write(
            "UNHANDLED PROMISE REJECTION:",
            reason?.stack || reason?.message || String(reason)
        );
    });

    write("TB Journal Firefox 0.1.8 Boot gestartet.");
    write("User-Agent:", navigator.userAgent);
    write("Extension URL:", location.href);

    document.addEventListener("DOMContentLoaded", () => {
        write("DOM geladen.");
        write("journal.js wird jetzt als ES-Modul geladen.");
    });
})();
