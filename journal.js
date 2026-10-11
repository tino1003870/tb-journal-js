import {
    executeCalDavRequest
} from "./src/js/caldav.js";


const $ = id =>
    document.getElementById(id);


function debugLog(...args) {

    console.log(
        "[TB-JOURNAL]",
        ...args
    );

    const element = document.getElementById("debugLog");

    if (!element) {
        return;
    }

    const timestamp =
        new Date().toLocaleTimeString();

    const text = args.map(value => {
        if (typeof value === "string") {
            return value;
        }

        try {
            return JSON.stringify(value, null, 2);
        } catch (_) {
            return String(value);
        }
    }).join(" ");

    element.textContent +=
        `[${timestamp}] ${text}\n`;

    element.scrollTop = element.scrollHeight;
}

function log(...args) {
    debugLog(...args);
}

window.tbJournalDebugLog = debugLog;


async function createTestVJournal() {

    const baseUrl =
        $("caldavUrl").value.trim();

    const username =
        $("caldavUsername").value;

    const password =
        $("caldavPassword").value;

    if (!baseUrl) {

        showResult(
            "Bitte eine CalDAV-URL eingeben."
        );

        return;
    }

    const url =
        baseUrl.replace(/\/+$/, "") +
        "/tb-journal-test-001.ics";

    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TB-JOURNAL//EN
BEGIN:VJOURNAL
UID:tb-journal-test-001
DTSTAMP:20261003T070000Z
SUMMARY:TB Journal Test
DESCRIPTION:Testeintrag für VJOURNAL über CalDAV
END:VJOURNAL
END:VCALENDAR
`;

    log(
        "=== VJOURNAL ANLEGEN ==="
    );

    log(
        "URL:",
        url
    );

    log(
        "iCalendar:",
        ical
    );

    try {

        const result =
            await executeCalDavRequest({

                operation: "PUT",

                url,

                username,

                password,

                body: ical
            });

        log(
            "VJOURNAL PUT Ergebnis:",
            result
        );

        showResult(
            [
                `HTTP ${result.status} ${result.statusText}`,
                "",
                result.body || "(keine Antwort)"
            ].join("\n")
        );

    } catch (error) {

        console.error(
            "[TB-JOURNAL] VJOURNAL PUT ERROR",
            error
        );

        showResult(
            `Fehler: ${error.message}`
        );
    }
}


function showResult(text) {

    $("connectionResult").textContent =
        text;
}


function parseVJournal(ical) {

    const unescapeIcal = value =>
        String(value || "")
            .replace(/\\n/gi, "\n")
            .replace(/\\,/g, ",")
            .replace(/\\;/g, ";")
            .replace(/\\\\/g, "\\");


    const getValue = name => {

        const re =
            new RegExp(
                "^" + name + "(?:;[^:]*)?:(.*)$",
                "mi"
            );

        const match =
            ical.match(re);

        return match
            ? unescapeIcal(match[1].trim())
            : "";
    };


    let dtstart =
        getValue("DTSTART");


    if (/^\d{8}$/.test(dtstart)) {

        dtstart =
            dtstart.substring(0, 4) +
            "-" +
            dtstart.substring(4, 6) +
            "-" +
            dtstart.substring(6, 8);
    }


    return {

        uid:
            getValue("UID"),

        summary:
            getValue("SUMMARY"),

        description:
            getValue("DESCRIPTION"),

        dtstart:
            dtstart
    };
}

function displayJournal(journal) {

    const container =
        $("journalList");

    container.innerHTML = "";


    const article =
        document.createElement("article");

    article.className =
        "journal-entry";


    const title =
        document.createElement("h3");

    title.textContent =
        journal.summary || "(ohne Betreff)";


    const description =
        document.createElement("p");

    description.textContent =
        journal.description || "";


    const date =
        document.createElement("p");

    date.textContent =
        journal.dtstart
            ? `Datum: ${journal.dtstart}`
            : "Kein Datum";


    const uid =
        document.createElement("small");

    uid.textContent =
        `UID: ${journal.uid || "(keine UID)"}`;


    article.appendChild(title);
    article.appendChild(description);
    article.appendChild(date);
    article.appendChild(uid);

    container.appendChild(article);
}


async function loadTestVJournal() {

    const baseUrl =
        $("caldavUrl").value.trim();

    const username =
        $("caldavUsername").value;

    const password =
        $("caldavPassword").value;

    if (!baseUrl) {

        showResult(
            "Bitte eine CalDAV-URL eingeben."
        );

        return;
    }

    const url =
        baseUrl.replace(/\/+$/, "") +
        "/tb-journal-test-001.ics";

    log(
        "=== VJOURNAL ABRUFEN ==="
    );

    log(
        "URL:",
        url
    );

    try {

        const result =
            await executeCalDavRequest({

                operation: "GET",

                url,

                username,

                password
            });

        log(
            "VJOURNAL GET Ergebnis:",
            result
        );

        log(
            "VJOURNAL Inhalt:",
            result.body
        );

        showResult(
            [
                `HTTP ${result.status} ${result.statusText}`,
                "",
                result.body || "(keine Antwort)"
            ].join("\n")
        );


        if (result.ok && result.body) {

            const journal =
                parseVJournal(result.body);

            log(
                "Geparstes VJOURNAL:",
                journal
            );

            displayJournal(journal);
        }


    } catch (error) {

        console.error(
            "[TB-JOURNAL] VJOURNAL GET ERROR",
            error
        );

        showResult(
            `Fehler: ${error.message}`
        );
    }
}




async function listVJournals() {

    const baseUrl =
        $("caldavUrl").value.trim();

    const username =
        $("caldavUsername").value;

    const password =
        $("caldavPassword").value;

    if (!baseUrl) {

        showResult(
            "Bitte eine CalDAV-URL eingeben."
        );

        return [];
    }

    log(
        "=== ALLE VJOURNALS LADEN (REPORT) ==="
    );

    showResult("Journale werden vom CalDAV-Server geladen ...");

    try {

        const result =
            await executeCalDavRequest({
                operation: "REPORT",
                url: baseUrl,
                username,
                password
            });

        log(
            "REPORT Ergebnis:",
            result
        );

        if (!result.ok) {
            throw new Error(
                `REPORT fehlgeschlagen: HTTP ${result.status} ${result.statusText}`
            );
        }

        const journals = (result.todos || []).map(journal => ({
            ...journal,
            url: journal.href
                ? new URL(journal.href, baseUrl).href
                : ""
        }));

        log(
            "=== VJOURNALS GESAMT ===",
            journals
        );

        return journals;

    } catch (error) {

        console.error(
            "[TB-JOURNAL] LIST VJOURNAL ERROR",
            error
        );

        showResult(
            `Fehler beim Laden der Journale: ${error.message}`
        );

        return null;
    }
}


let journalSortOrder = "desc";

function sortJournalsByDate(journals) {
    return [...journals].sort((a, b) => {
        const da = a.dtstart || "";
        const db = b.dtstart || "";

        const cmp = da.localeCompare(db);

        return journalSortOrder === "asc"
            ? cmp
            : -cmp;
    });
}


function displayJournals(journals) {

    latestServerJournals = journals;

    const container =
        $("journalList");

    journals = sortJournalsByDate(journals);

    container.innerHTML = "";


    if (!journals.length) {

        container.innerHTML =
            "<p>Keine VJOURNAL-Einträge gefunden.</p>";

        return;
    }


    journals.forEach(
        journal => {

            const article =
                document.createElement("article");

            article.className =
                "journal-entry";
            article.dataset.syncKey = journalIdentity(
                journal,
                $("caldavUrl").value.trim().replace(/\/+$/, "")
            );


            const title =
                document.createElement("h3");

            title.textContent =
                journal.summary ||
                "(ohne Betreff)";


            const description =
                document.createElement("p");

            description.textContent =
                journal.description ||
                "";


            const date =
                document.createElement("p");

            date.textContent =
                journal.dtstart
                    ? `Datum: ${journal.dtstart}`
                    : "Kein Datum";


            const uid =
                document.createElement("small");

            uid.textContent =
                `UID: ${journal.uid || "(keine UID)"}`;


            const actions =
                document.createElement("div");

            actions.className =
                "journal-entry-actions";


            const editButton =
                document.createElement("button");

            editButton.type =
                "button";

            editButton.textContent =
                "Bearbeiten";


            editButton.addEventListener(
                "click",
                () =>
                    openJournalEditor(journal)
            );


            actions.appendChild(
                editButton
            );


            article.appendChild(title);
            article.appendChild(description);
            article.appendChild(date);
            article.appendChild(uid);
            article.appendChild(actions);


            container.appendChild(article);
        }
    );
}


async function loadVJournals() {

    const journals =
        await listVJournals();

    if (!Array.isArray(journals)) return;

    displayJournals(
        journals
    );

    showResult(
        `${journals.length} VJOURNAL-Einträge geladen.`
    );
    await refreshSyncStatus(journals);
}


/*
 * ------------------------------------------------------------
 * Lokale Sicherung und Wiederherstellung
 * ------------------------------------------------------------
 */


const LOCAL_JOURNAL_BACKUP_KEY = "tbJournalLocalBackup";
let latestServerJournals = [];

function journalResourceUrl(journal, baseUrl) {
    const raw = journal.url || (journal.href ? new URL(journal.href, baseUrl).href : "");
    if (!raw) return "";
    try {
        return new URL(raw, baseUrl).href;
    } catch (_) {
        return raw;
    }
}

function journalIdentity(journal, baseUrl) {
    return journalResourceUrl(journal, baseUrl) || (journal.uid ? `uid:${journal.uid}` : "");
}

function createSyncBadge(text, kind) {
    const badge = document.createElement("span");
    badge.className = `sync-badge ${kind || ""}`;
    badge.textContent = text;
    return badge;
}

async function refreshSyncStatus(serverJournals = latestServerJournals) {
    const summary = $("syncStatusSummary");
    const details = $("syncStatusDetails");
    if (!summary || !details) return;

    const baseUrl = $("caldavUrl").value.trim().replace(/\/+$/, "");
    const stored = await browser.storage.local.get(LOCAL_JOURNAL_BACKUP_KEY);
    const backup = stored[LOCAL_JOURNAL_BACKUP_KEY];

    details.replaceChildren();

    if (!Array.isArray(serverJournals)) {
        summary.textContent = "Serverstatus unbekannt. Bitte Journale laden.";
        return;
    }

    if (!backup || !Array.isArray(backup.journals)) {
        summary.textContent = `Server: ${serverJournals.length} Journale. Noch keine lokale Sicherung vorhanden.`;
        const p = document.createElement("p");
        p.textContent = "Mit „Server → lokal sichern“ wird ein Vergleichsstand erstellt.";
        details.appendChild(p);
        renderJournalStatusBadges(serverJournals, new Set(), false, baseUrl);
        return;
    }

    if (backup.collectionUrl !== baseUrl) {
        summary.textContent = `Server: ${serverJournals.length} Journale. Die lokale Sicherung gehört zu einer anderen Collection.`;
        const p = document.createElement("p");
        p.textContent = `Lokale Sicherung: ${backup.collectionUrl}`;
        details.appendChild(p);
        renderJournalStatusBadges(serverJournals, new Set(), false, baseUrl);
        return;
    }

    const localMap = new Map();
    for (const journal of backup.journals) {
        const key = journalIdentity(journal, baseUrl);
        if (key) localMap.set(key, journal);
    }
    const serverMap = new Map();
    for (const journal of serverJournals) {
        const key = journalIdentity(journal, baseUrl);
        if (key) serverMap.set(key, journal);
    }

    const both = [];
    const localOnly = [];
    const serverOnly = [];

    for (const [key, journal] of localMap) {
        if (serverMap.has(key)) both.push(journal);
        else localOnly.push(journal);
    }
    for (const [key, journal] of serverMap) {
        if (!localMap.has(key)) serverOnly.push(journal);
    }

    summary.textContent =
        `Letzte lokale Sicherung: ${new Date(backup.savedAt).toLocaleString()} — ` +
        `Lokal: ${localMap.size}, Server: ${serverMap.size}, beides: ${both.length}, ` +
        `nur lokal: ${localOnly.length}, nur Server: ${serverOnly.length}.`;

    const addGroup = (title, entries, className) => {
        const group = document.createElement("div");
        group.className = "sync-status-group";
        const heading = document.createElement("strong");
        heading.textContent = `${title} (${entries.length})`;
        group.appendChild(heading);
        if (entries.length) {
            const list = document.createElement("ul");
            list.className = "sync-status-list";
            for (const journal of entries) {
                const li = document.createElement("li");
                li.textContent = journal.summary || journal.uid || "(ohne Titel)";
                list.appendChild(li);
            }
            group.appendChild(list);
        }
        details.appendChild(group);
    };

    addGroup("Lokal und auf dem Server", both, "both");
    addGroup("Nur lokal vorhanden", localOnly, "local-only");
    addGroup("Nur auf dem Server vorhanden", serverOnly, "server-only");

    renderJournalStatusBadges(serverJournals, new Set(localMap.keys()), true, baseUrl);
}

function renderJournalStatusBadges(journals, localKeys, comparable, baseUrl) {
    // The cards are rendered by displayJournals; append a status badge to each current card.
    const cards = Array.from(document.querySelectorAll("#journalList .journal-entry"));
    for (const card of cards) {
        const key = card.dataset.syncKey || "";
        const old = card.querySelector(".sync-badge");
        if (old) old.remove();
        if (!comparable) {
            card.appendChild(createSyncBadge("Serverstand", "server-only"));
        } else if (key && localKeys.has(key)) {
            card.appendChild(createSyncBadge("Lokal + Server", "both"));
        } else {
            card.appendChild(createSyncBadge("Nur Server", "server-only"));
        }
    }
}


function getCurrentConnection() {
    return {
        baseUrl: $("caldavUrl").value.trim().replace(/\/+$/, ""),
        username: $("caldavUsername").value,
        password: $("caldavPassword").value
    };
}

async function serverToLocal() {
    const { baseUrl } = getCurrentConnection();
    if (!baseUrl) {
        showResult("Bitte zuerst eine CalDAV-URL eingeben.");
        return;
    }

    log("=== SERVER → LOKALE SICHERUNG ===");
    const journals = await listVJournals();
    if (!Array.isArray(journals)) {
        showResult("Serverdaten konnten nicht geladen werden; lokale Sicherung wurde nicht verändert.");
        return;
    }

    const backup = {
        collectionUrl: baseUrl,
        savedAt: new Date().toISOString(),
        journals
    };

    await browser.storage.local.set({
        [LOCAL_JOURNAL_BACKUP_KEY]: backup
    });

    log("Lokale Sicherung gespeichert:", {
        collectionUrl: backup.collectionUrl,
        count: journals.length,
        savedAt: backup.savedAt
    });
    latestServerJournals = journals;
    displayJournals(journals);
    await refreshSyncStatus(journals);
    showResult(`${journals.length} Journale lokal gesichert (${new Date(backup.savedAt).toLocaleString()}).`);
}

async function localToServer() {
    const { baseUrl, username, password } = getCurrentConnection();
    if (!baseUrl) {
        showResult("Bitte zuerst eine CalDAV-URL eingeben.");
        return;
    }

    const stored = await browser.storage.local.get(LOCAL_JOURNAL_BACKUP_KEY);
    const backup = stored[LOCAL_JOURNAL_BACKUP_KEY];
    if (!backup || !Array.isArray(backup.journals)) {
        showResult("Keine lokale Journal-Sicherung vorhanden. Bitte zuerst ‚Server → lokal sichern‘ ausführen.");
        return;
    }

    if (backup.collectionUrl !== baseUrl) {
        showResult("Die Sicherung gehört zu einer anderen CalDAV-Collection. Wiederherstellung abgebrochen.");
        return;
    }

    const localJournals = backup.journals;
    const localUrls = new Set(localJournals.map(j => j.url || (j.href ? new URL(j.href, baseUrl).href : "")).filter(Boolean));
    const preview = `Lokale Sicherung vom ${new Date(backup.savedAt).toLocaleString()} enthält ${localJournals.length} Journale.\n\nDie aktuelle Server-Collection wird an diese Sicherung angepasst. Servereinträge, die nicht in der Sicherung enthalten sind, werden gelöscht. Fortfahren?`;
    if (!confirm(preview)) return;

    log("=== LOKALE SICHERUNG → SERVER WIEDERHERSTELLEN ===");
    log("Sicherungsdatum:", backup.savedAt);
    log("Lokale Journale:", localJournals.length);

    try {
        const serverJournals = await listVJournals();
        if (!Array.isArray(serverJournals)) throw new Error("Aktuelle Serverdaten konnten nicht gelesen werden; es wurde nichts überschrieben.");
        const serverByUrl = new Map(serverJournals.map(j => [j.url || (j.href ? new URL(j.href, baseUrl).href : ""), j]));

        // Validate every destination before writing anything.
        for (const journal of localJournals) {
            const url = journal.url || (journal.href ? new URL(journal.href, baseUrl).href : "");
            if (!url || new URL(url).origin !== new URL(baseUrl).origin || !new URL(url).pathname.endsWith(".ics")) {
                throw new Error(`Ungültige oder fremde Journal-URL: ${url || "(leer)"}`);
            }
            if (!journal.calendarData) {
                throw new Error(`Für „${journal.summary || journal.uid || "Journal"}“ fehlt der vollständige iCalendar-Inhalt. Bitte eine neue lokale Sicherung erstellen.`);
            }
        }

        let restored = 0;
        for (const journal of localJournals) {
            const url = journal.url || new URL(journal.href, baseUrl).href;
            const result = await executeCalDavRequest({
                operation: "PUT",
                url,
                username,
                password,
                body: journal.calendarData
            });
            if (!result.ok) throw new Error(`PUT ${url}: HTTP ${result.status} ${result.statusText}`);
            restored++;
            log("Wiederhergestellt:", url);
        }

        let deleted = 0;
        for (const [url, journal] of serverByUrl) {
            if (!url || localUrls.has(url)) continue;
            const result = await executeCalDavRequest({
                operation: "DELETE",
                url,
                username,
                password,
                etag: journal.etag || null
            });
            if (!result.ok) throw new Error(`DELETE ${url}: HTTP ${result.status} ${result.statusText}`);
            deleted++;
            log("Servereintrag entfernt (nicht in lokaler Sicherung):", url);
        }

        showResult(`Wiederherstellung abgeschlossen: ${restored} Journale geschrieben, ${deleted} zusätzliche Servereinträge gelöscht.`);
        await loadVJournals();
    } catch (error) {
        log("WIEDERHERSTELLUNGSFEHLER:", error.message || String(error));
        showResult(`Wiederherstellung nicht vollständig: ${error.message}. Bitte Server und lokale Sicherung prüfen; bereits ausgeführte Änderungen werden nicht automatisch zurückgerollt.`);
    }
}



let editingJournal = null;


function openJournalEditor(journal = null) {

    editingJournal =
        journal;

    const editor =
        $("journalEditor");

    const heading =
        $("journalEditorHeading");

    const title =
        $("journalTitle");

    const description =
        $("journalDescription");

    const date =
        $("journalDate");

    const deleteButton =
        $("deleteJournalButton");


    if (journal) {

        heading.textContent =
            "Journal bearbeiten";

        deleteButton.hidden =
            false;

        title.value =
            journal.summary || "";

        description.value =
            journal.description || "";

        date.value =
            journal.date || "";

    } else {

        heading.textContent =
            "Neues Journal";

        deleteButton.hidden =
            true;

        title.value =
            "";

        description.value =
            "";

        const today =
            new Date()
                .toISOString()
                .slice(0, 10);

        date.value =
            today;
    }


    editor.hidden =
        false;

    title.focus();
}


function closeJournalEditor() {

    editingJournal =
        null;

    $("journalEditor").hidden =
        true;

    $("journalTitle").value =
        "";

    $("journalDescription").value =
        "";

    $("journalDate").value =
        "";
}


function createJournalUid() {

    if (
        crypto &&
        crypto.randomUUID
    ) {
        return crypto.randomUUID();
    }

    return (
        "tb-journal-" +
        Date.now()
    );
}


function createJournalIcal(
    uid,
    title,
    description,
    date
) {

    const now =
        new Date();

    const dtstamp =
        now.toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}Z$/, "Z");


    const escapeIcal =
        value =>
            String(value || "")
                .replace(/\\/g, "\\\\")
                .replace(/;/g, "\\;")
                .replace(/,/g, "\\,")
                .replace(/\r?\n/g, "\\n");

    const dtstart =
        String(date || "")
            .replace(/-/g, "");


    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TB-JOURNAL//EN
BEGIN:VJOURNAL
UID:${escapeIcal(uid)}
DTSTAMP:${dtstamp}
SUMMARY:${escapeIcal(title)}
DESCRIPTION:${escapeIcal(description)}
DTSTART;VALUE=DATE:${dtstart}
END:VJOURNAL
END:VCALENDAR
`;
}


async function deleteJournal() {

    if (!editingJournal) {
        return;
    }

    const title =
        editingJournal.summary ||
        "dieses Journal";

    const confirmed =
        confirm(`Journal "${title}" wirklich löschen?`);

    if (!confirmed) {
        return;
    }

    const baseUrl =
        $("caldavUrl")
            .value
            .trim();

    const username =
        $("caldavUsername")
            .value;

    const password =
        $("caldavPassword")
            .value;

    const url =
        editingJournal.url ||
        (editingJournal.href
            ? new URL(editingJournal.href, baseUrl).href
            : "");

    if (!url) {
        showResult(
            "Keine URL für das Journal gefunden."
        );
        return;
    }

    log("=== VJOURNAL LÖSCHEN ===");
    log("URL:", url);
    log("ETag:", editingJournal.etag || "(kein ETag)");

    try {

        const result =
            await executeCalDavRequest({
                operation: "DELETE",
                url,
                username,
                password,
                etag: editingJournal.etag || null
            });

        log(
            "VJOURNAL DELETE Ergebnis:",
            result
        );

        if (!result.ok) {
            throw new Error(
                `HTTP ${result.status} ${result.statusText}`
            );
        }

        closeJournalEditor();

        showResult(
            "Journal gelöscht."
        );

        await loadVJournals();

    } catch (error) {

        console.error(
            "[TB-JOURNAL] VJOURNAL DELETE ERROR",
            error
        );

        showResult(
            `Fehler beim Löschen: ${error.message}`
        );
    }
}


async function saveJournal() {

    const title =
        $("journalTitle")
            .value
            .trim();

    const description =
        $("journalDescription")
            .value
            .trim();

    const date =
        $("journalDate")
            .value;

    const baseUrl =
        $("caldavUrl")
            .value
            .trim();

    const username =
        $("caldavUsername")
            .value;

    const password =
        $("caldavPassword")
            .value;


    if (!title) {

        alert(
            "Bitte einen Titel eingeben."
        );

        $("journalTitle").focus();

        return;
    }

    if (!date) {

        alert(
            "Bitte ein Datum eingeben."
        );

        $("journalDate").focus();

        return;
    }


    if (!baseUrl) {

        showResult(
            "Bitte eine CalDAV-URL eingeben."
        );

        return;
    }


    let uid;
    let url;


    if (editingJournal) {

        uid =
            editingJournal.uid;

        url =
            editingJournal.url;

    } else {

        uid =
            createJournalUid();

        url =
            baseUrl.replace(/\/+$/, "") +
            "/" +
            uid +
            ".ics";
    }


    const ical =
        createJournalIcal(
            uid,
            title,
            description,
            date
        );


    log(
        editingJournal
            ? "=== VJOURNAL ÄNDERN ==="
            : "=== VJOURNAL ANLEGEN ==="
    );

    log(
        "URL:",
        url
    );

    log(
        "iCalendar:",
        ical
    );


    try {

        const result =
            await executeCalDavRequest({

                operation: "PUT",

                url,

                username,

                password,

                body: ical
            });


        log(
            "VJOURNAL PUT Ergebnis:",
            result
        );


        if (!result.ok) {

            throw new Error(
                `HTTP ${result.status} ${result.statusText}`
            );
        }


        closeJournalEditor();

        showResult(
            editingJournal
                ? "Journal gespeichert."
                : "Journal angelegt."
        );


        await loadVJournals();


    } catch (error) {

        console.error(
            "[TB-JOURNAL] VJOURNAL SAVE ERROR",
            error
        );

        showResult(
            `Fehler: ${error.message}`
        );
    }
}


/*
 * ------------------------------------------------------------
 * Einstellungen
 * ------------------------------------------------------------
 */

async function saveSettings() {

    const settings = {
        caldavUrl: $("caldavUrl").value.trim(),
        username: $("caldavUsername").value,
        password: $("caldavPassword").value
    };

    await browser.storage.local.set({
        tbJournalSettings: settings
    });

    showResult("Einstellungen gespeichert.");
    log("Einstellungen gespeichert.");
}


async function loadSettings() {

    try {
        const stored =
            await browser.storage.local.get("tbJournalSettings");

        const settings =
            stored.tbJournalSettings;

        if (!settings) {
            showResult(
                "Keine gespeicherten Einstellungen gefunden."
            );
            return;
        }

        $("caldavUrl").value =
            settings.caldavUrl || "";

        $("caldavUsername").value =
            settings.username || "";

        $("caldavPassword").value =
            settings.password || "";

        showResult(
            "Einstellungen geladen."
        );

        log("Einstellungen geladen.");

    } catch (error) {
        console.error(
            "[TB-JOURNAL] SETTINGS ERROR",
            error
        );

        showResult(
            "Fehler beim Laden der Einstellungen."
        );
    }
}


async function testConnection() {

    const url =
        $("caldavUrl").value.trim();

    const username =
        $("caldavUsername").value;

    const password =
        $("caldavPassword").value;


    if (!url) {

        showResult(
            "Bitte eine CalDAV-URL eingeben."
        );

        return;
    }


    log(
        "=== CALDAV VERBINDUNG TESTEN ==="
    );

    log(
        "URL:",
        url
    );


    showResult(
        "Verbindung wird getestet ..."
    );


    try {

        const result =
            await executeCalDavRequest({

                operation: "PROPFIND",

                url,

                username,

                password
            });

        console.log(
            "[TB-JOURNAL] FULL CALDAV RESPONSE:",
            result.body
        );


        log(
            "CalDAV Ergebnis:",
            result
        );


        showResult(
            [
                `HTTP ${result.status} ${result.statusText}`,
                "",
                result.body || "(keine Antwort)"
            ].join("\n")
        );


    } catch (error) {

        console.error(
            "[TB-JOURNAL] CALDAV ERROR",
            error
        );


        showResult(
            `Fehler: ${error.message}`
        );
    }
}


$("loadSettingsButton")
    .addEventListener(
        "click",
        () => loadSettings()
    );


$("saveSettingsButton")
    .addEventListener(
        "click",
        () => saveSettings()
    );


$("testConnectionButton")
    .addEventListener(
        "click",
        testConnection
    );


$("createVJournalButton")?.addEventListener(
    "click",
    createTestVJournal
);

$("loadTestVJournalButton")?.addEventListener(
    "click",
    loadTestVJournal
);

$("loadVJournalsButton")?.addEventListener(
    "click",
    loadVJournals
);

$("newJournalButton")
    .addEventListener(
        "click",
        () => openJournalEditor()
    );


$("saveJournalButton")
    .addEventListener(
        "click",
        saveJournal
    );


$("deleteJournalButton")
    .addEventListener(
        "click",
        deleteJournal
    );


$("cancelJournalButton")
    .addEventListener(
        "click",
        closeJournalEditor
    );

$("serverToLocalButton")
    ?.addEventListener("click", serverToLocal);

$("localToServerButton")
    ?.addEventListener("click", localToServer);


$("clearDebugButton")
    ?.addEventListener(
        "click",
        () => {
            $("debugLog").textContent = "";
            debugLog("Debug-Protokoll gelöscht.");
        }
    );


debugLog(
    "journal.js gestartet (TB Journal Firefox 0.1.7)."
);

window.setJournalSortOrder = function(order) {
    if (order !== "asc" && order !== "desc") {
        return;
    }

    journalSortOrder = order;

    console.log(
        "[TB-JOURNAL] Sortierung:",
        order === "asc" ? "aufsteigend" : "absteigend"
    );

    loadVJournals();
};


/*
 * Restore the last CalDAV connection settings first.
 * Only then start the initial CalDAV load.
 */
(async () => {
    await loadSettings();
    await loadVJournals();
})();
