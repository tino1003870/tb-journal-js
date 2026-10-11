function debug(...args) {
    try {
        if (typeof window !== "undefined" &&
            typeof window.tbJournalDebugLog === "function") {
            window.tbJournalDebugLog(...args);
        } else {
            console.log("[TB-JOURNAL-CALDAV]", ...args);
        }
    } catch (_) {
        console.log("[TB-JOURNAL-CALDAV]", ...args);
    }
}

export async function executeCalDavRequest({
    operation,
    url,
    username,
    password,
    body = null,
    etag = null
}) {
    const headers = {};

    debug("--- CalDAV Request ---");
    debug("Method:", operation);
    debug("URL:", url);
    debug("Username:", username || "(leer)");

    if (username || password) {
        const credentials = `${username}:${password}`;

        headers["Authorization"] =
            `Basic ${btoa(credentials)}`;
    }

    const options = {
        method: operation,
        headers
    };

    /*
     * PUT:
     * Replace the selected CalDAV resource with the
     * edited iCalendar data.
     */
    if (operation === "PUT") {
        options.headers["Content-Type"] =
            "text/calendar; charset=utf-8";
        options.body = body || "";
    }

    if (operation === "DELETE") {
        // DELETE does not require a request body.
        // If the server provides an ETag, use it to avoid
        // accidentally deleting a resource that changed meanwhile.
        if (etag) {
            options.headers["If-Match"] = etag;
        }
    }

    if (operation === "PROPFIND") {
        options.headers["Depth"] = "1";
        options.headers["Content-Type"] =
            "application/xml; charset=utf-8";

        options.body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
    <d:prop>
        <d:resourcetype/>
        <d:displayname/>
    </d:prop>
</d:propfind>`;
    }

    if (operation === "REPORT") {
        options.headers["Depth"] = "1";
        options.headers["Content-Type"] =
            "application/xml; charset=utf-8";

        options.body = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query
    xmlns:c="urn:ietf:params:xml:ns:caldav"
    xmlns:d="DAV:">

    <d:prop>
        <d:getetag/>
        <c:calendar-data/>
    </d:prop>

    <c:filter>
        <c:comp-filter name="VCALENDAR">
            <c:comp-filter name="VJOURNAL"/>
        </c:comp-filter>
    </c:filter>

</c:calendar-query>`;
    }

    /*
     * Firefox/WebExtension transport:
     * Extension host permissions allow direct requests to the
     * user-configured CalDAV server.
     */
    let response;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    debug("Request body length:", options.body ? options.body.length : 0);
    if (operation === "REPORT" || operation === "PROPFIND") {
        debug("Request body:", options.body || "(leer)");
    }

    try {
        response = await fetch(url, {
            method: operation,
            headers: options.headers,
            body: options.body ?? undefined,
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === "AbortError") {
            debug("FETCH TIMEOUT nach 20 Sekunden");
            throw new Error(`CalDAV request timed out after 20 seconds: ${operation} ${url}`);
        }
        debug("FETCH ERROR:", error?.name || "Error", error?.message || String(error));
        throw new Error(`CalDAV request failed: ${error.message}`);
    } finally {
        clearTimeout(timeout);
    }

    debug("HTTP Status:", response.status, response.statusText);
    debug("Response Content-Type:", response.headers.get("content-type") || "(nicht vorhanden)");

    const responseBody = await response.text();

    debug("Response length:", responseBody.length, "Bytes/Zeichen");
    if (responseBody) {
        debug("Response preview (max. 5000 Zeichen):\n" + responseBody.slice(0, 5000));
    } else {
        debug("Response body: (leer)");
    }

    const result = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
        requestDebug: {
            operation,
            url,
            username,
            headers: {
                ...options.headers,
                Authorization: options.headers.Authorization
                    ? "[hidden]"
                    : undefined
            },
            bodyLength: options.body ? options.body.length : 0,
            body: options.body || ""
        }
    };

    if (
        operation === "REPORT" &&
        response.ok
    ) {
        try {
            result.todos = parseCalDavReport(responseBody);
            debug("REPORT parsed successfully. VJOURNAL count:", result.todos.length);
        } catch (error) {
            debug("REPORT PARSE ERROR:", error?.message || String(error));
            throw error;
        }
    }

    debug("--- CalDAV Request Ende ---");
    return result;
}

/**
 * Parse a CalDAV REPORT multistatus response.
 */
function parseCalDavReport(xmlText) {

    const xml =
        new DOMParser().parseFromString(
            xmlText,
            "application/xml"
        );

    const parserError =
        xml.querySelector("parsererror");

    if (parserError) {
        throw new Error(
            `Invalid CalDAV XML: ${parserError.textContent}`
        );
    }

    const responses = [
        ...xml.getElementsByTagNameNS(
            "DAV:",
            "response"
        )
    ];

    const todos = [];

    for (const response of responses) {

        const hrefElement =
            response.getElementsByTagNameNS(
                "DAV:",
                "href"
            )[0];

        const etagElement =
            response.getElementsByTagNameNS(
                "DAV:",
                "getetag"
            )[0];

        const calendarDataElement =
            response.getElementsByTagNameNS(
                "urn:ietf:params:xml:ns:caldav",
                "calendar-data"
            )[0];

        if (!calendarDataElement) {
            continue;
        }

        const calendarData =
            calendarDataElement.textContent || "";

        const todo =
            parseVJournal(calendarData);

        if (!todo) {
            continue;
        }

        // Keep the complete iCalendar resource for lossless local backup/restore.
        todo.calendarData = calendarData;

        todo.href =
            hrefElement?.textContent || "";

        todo.etag =
            etagElement?.textContent || "";

        todos.push(todo);
    }

    return todos;
}


/**
 * Parse one iCalendar VCALENDAR containing a VJOURNAL.
 */
function parseVJournal(calendarText) {

    const lines =
        unfoldIcsLines(calendarText);

    const start =
        lines.findIndex(
            line => line === "BEGIN:VJOURNAL"
        );

    const end =
        lines.findIndex(
            (line, index) =>
                index > start &&
                line === "END:VJOURNAL"
        );

    if (start < 0 || end < 0) {
        return null;
    }

    const todoLines =
        lines.slice(start + 1, end);

    const todo = {};

    for (const line of todoLines) {

        const colon =
            line.indexOf(":");

        if (colon < 0) {
            continue;
        }

        const property =
            line.substring(0, colon);

        const value =
            line.substring(colon + 1);

        const semicolon =
            property.indexOf(";");

        const name =
            semicolon >= 0
                ? property.substring(0, semicolon)
                : property;

        const parameters =
            semicolon >= 0
                ? property.substring(semicolon + 1)
                : "";

        const normalizedName =
            name.toUpperCase();

        switch (normalizedName) {

            case "UID":
                todo.uid = unescapeIcs(value);
                break;

            case "SUMMARY":
                todo.summary = unescapeIcs(value);
                break;

            case "DESCRIPTION":
                todo.description =
                    unescapeIcs(value);
                break;

            case "STATUS":
                todo.status = value;
                break;

            case "PERCENT-COMPLETE":
                todo.percentComplete =
                    Number.parseInt(value, 10);
                break;

            case "DTSTART":
                todo.dtstart = value;
                todo.dtstartParameters =
                    parameters;
                break;

            case "DUE":
                todo.due = value;
                todo.dueParameters =
                    parameters;
                break;

            case "X-TB-PLANNER-WBS":
                todo.wbs =
                    unescapeIcs(value);
                break;

            case "X-TB-PLANNER-PARENT":
                todo.parent =
                    unescapeIcs(value);
                break;

            case "X-TB-PLANNER-ORDER":
                todo.order =
                    Number.parseInt(value, 10);
                break;

            default:
                break;
        }
    }

    console.log(
        "[TB-JOURNAL DEBUG] PARSED VJOURNAL",
        "SUMMARY=" + (todo.summary || ""),
        "DTSTART=" + (todo.dtstart || ""),
        "DTSTART-PARAMS=" + (todo.dtstartParameters || ""),
        "DUE=" + (todo.due || ""),
        "DUE-PARAMS=" + (todo.dueParameters || "")
    );

    return todo;
}


/**
 * RFC 5545 line unfolding.
 */
function unfoldIcsLines(text) {

    const normalized =
        text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

    const physicalLines =
        normalized.split("\n");

    const lines = [];

    for (const line of physicalLines) {

        if (
            (line.startsWith(" ") ||
             line.startsWith("\t")) &&
            lines.length > 0
        ) {
            lines[lines.length - 1] +=
                line.substring(1);
        } else {
            lines.push(line);
        }
    }

    return lines;
}


/**
 * Decode common iCalendar escaping.
 */
function unescapeIcs(value) {

    return value
        .replace(/\\n/gi, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");
}
