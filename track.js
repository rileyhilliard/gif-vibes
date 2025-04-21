this.TriageFlowTracking = (function () {
  "use strict";

  // Unique ID creation requires a high quality random # generator. In the browser we therefore
  // require the crypto API and do not support built-in fallback to lower quality random number
  // generators (like Math.random()).
  let getRandomValues;
  const rnds8 = new Uint8Array(16);
  function rng() {
    // lazy load so that environments that need to polyfill have a chance to do so
    if (!getRandomValues) {
      // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
      getRandomValues =
        typeof crypto !== "undefined" &&
        crypto.getRandomValues &&
        crypto.getRandomValues.bind(crypto);

      if (!getRandomValues) {
        throw new Error(
          "crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported"
        );
      }
    }

    return getRandomValues(rnds8);
  }

  /**
   * Convert array of 16 byte values to UUID string format of the form:
   * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   */

  const byteToHex = [];

  for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
  }

  function unsafeStringify(arr, offset = 0) {
    // Note: Be careful editing this code!  It's been tuned for performance
    // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
    return (
      byteToHex[arr[offset + 0]] +
      byteToHex[arr[offset + 1]] +
      byteToHex[arr[offset + 2]] +
      byteToHex[arr[offset + 3]] +
      "-" +
      byteToHex[arr[offset + 4]] +
      byteToHex[arr[offset + 5]] +
      "-" +
      byteToHex[arr[offset + 6]] +
      byteToHex[arr[offset + 7]] +
      "-" +
      byteToHex[arr[offset + 8]] +
      byteToHex[arr[offset + 9]] +
      "-" +
      byteToHex[arr[offset + 10]] +
      byteToHex[arr[offset + 11]] +
      byteToHex[arr[offset + 12]] +
      byteToHex[arr[offset + 13]] +
      byteToHex[arr[offset + 14]] +
      byteToHex[arr[offset + 15]]
    );
  }

  const randomUUID =
    typeof crypto !== "undefined" &&
    crypto.randomUUID &&
    crypto.randomUUID.bind(crypto);
  const native = {
    randomUUID,
  };

  function v4(options, buf, offset) {
    if (native.randomUUID && true && !options) {
      return native.randomUUID();
    }

    options = options || {};
    const rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80; // Copy bytes to buffer, if provided

    return unsafeStringify(rnds);
  }

  const DeviceType = {
    DESKTOP: "desktop",
    MOBILE: "mobile",
    TABLET: "tablet",
  };
  const ErrorSeverity = {
    CRITICAL: "critical",
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
  };
  const UserActionType = {
    PAGE_VIEW: "page_view",
    CLICK: "click",
    FORM_SUBMIT: "form_submit",
    FORM_START: "form_start",
    FORM_FIELD_CHANGE: "form_field_change",
    SCROLL: "scroll",
    HOVER: "hover",
    FOCUS: "focus",
    BLUR: "blur",
    SEARCH: "search",
    DOWNLOAD: "download",
    COPY: "copy",
    PASTE: "paste",
  };
  const ScrollDirection = {
    UP: "up",
    DOWN: "down",
  };

  class TriageFlowTracking {
    // 5 seconds
    constructor(config) {
      this.lastScrollDepth = 0;
      this.lastScrollTime = 0;
      this.scrollTimeout = null;
      // Single queue for all event types
      this.eventQueue = [];
      this.eventQueueTimeout = null;
      this.EVENT_BATCH_INTERVAL = 500;
      this.sessionId = this.getOrCreateSessionId();
      this.anonymousId = this.getOrCreateAnonymousId();
      this.userId = config.userId;
      this.endpoint = config.endpoint;
      this.debug = config.debug || false;
      if (this.debug) {
        console.log("TriageFlow Tracking Initialized", {
          sessionId: this.sessionId,
          anonymousId: this.anonymousId,
          userId: this.userId,
          endpoint: this.endpoint,
        });
      }
      this.initializeTracking();
    }
    getOrCreateSessionId() {
      const storedSessionId = sessionStorage.getItem("tf_session_id");
      if (storedSessionId) {
        return storedSessionId;
      }
      const newSessionId = v4();
      sessionStorage.setItem("tf_session_id", newSessionId);
      return newSessionId;
    }
    getOrCreateAnonymousId() {
      const storedAnonymousId = localStorage.getItem("tf_anonymous_id");
      if (storedAnonymousId) {
        return storedAnonymousId;
      }
      const newAnonymousId = v4();
      localStorage.setItem("tf_anonymous_id", newAnonymousId);
      return newAnonymousId;
    }
    getDeviceType() {
      const ua = navigator.userAgent;
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return DeviceType.TABLET;
      }
      if (
        /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
          ua
        )
      ) {
        return DeviceType.MOBILE;
      }
      return DeviceType.DESKTOP;
    }
    getBrowserInfo() {
      const ua = navigator.userAgent;
      let browser = "Unknown";
      let version = "Unknown";
      if (ua.includes("Chrome")) {
        browser = "Chrome";
        version = ua.match(/Chrome\/([0-9.]+)/)?.[1] || "Unknown";
      } else if (ua.includes("Firefox")) {
        browser = "Firefox";
        version = ua.match(/Firefox\/([0-9.]+)/)?.[1] || "Unknown";
      } else if (ua.includes("Safari")) {
        browser = "Safari";
        version = ua.match(/Version\/([0-9.]+)/)?.[1] || "Unknown";
      } else if (ua.includes("Edge")) {
        browser = "Edge";
        version = ua.match(/Edge\/([0-9.]+)/)?.[1] || "Unknown";
      }
      return { browser, version };
    }
    getOSInfo() {
      const ua = navigator.userAgent;
      let os = "Unknown";
      let version = "Unknown";
      if (ua.includes("Windows")) {
        os = "Windows";
        version = ua.match(/Windows NT ([0-9.]+)/)?.[1] || "Unknown";
      } else if (ua.includes("Mac")) {
        os = "macOS";
        version = ua.match(/Mac OS X ([0-9._]+)/)?.[1] || "Unknown";
      } else if (ua.includes("Linux")) {
        os = "Linux";
      } else if (ua.includes("Android")) {
        os = "Android";
        version = ua.match(/Android ([0-9.]+)/)?.[1] || "Unknown";
      } else if (ua.includes("iOS")) {
        os = "iOS";
        version = ua.match(/OS ([0-9._]+)/)?.[1] || "Unknown";
      }
      return { os, version };
    }
    createBaseEvent(eventType) {
      const { browser, version: browserVersion } = this.getBrowserInfo();
      const { os, version: osVersion } = this.getOSInfo();
      const referrerUrl = document.referrer ? document.referrer : undefined;
      return {
        event_id: v4(),
        timestamp: /* @__PURE__ */ new Date().toISOString(),
        event_type: eventType,
        session_id: this.sessionId,
        user_id: this.userId,
        anonymous_id: this.anonymousId,
        // Always use window.location for url and path
        url: window.location.href,
        path: window.location.pathname,
        referrer: referrerUrl,
        // Use the potentially undefined value
        user_agent: navigator.userAgent,
        device_type: this.getDeviceType(),
        browser,
        browser_version: browserVersion,
        os,
        os_version: osVersion,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      };
    }
    queueEvent(event) {
      if (this.debug) {
        console.log("Queueing Event:", event);
      }
      this.eventQueue.push(event);
      if (this.eventQueueTimeout === null) {
        if (this.debug) {
          console.log(
            `Starting event batch timer (${this.EVENT_BATCH_INTERVAL}ms)`
          );
        }
        this.eventQueueTimeout = window.setTimeout(() => {
          this.flushEventQueue();
        }, this.EVENT_BATCH_INTERVAL);
      }
    }
    flushEventQueue() {
      if (this.eventQueue.length === 0) {
        if (this.debug);
        this.eventQueueTimeout = null;
        return;
      }
      const eventsToSend = [...this.eventQueue];
      this.eventQueue = [];
      this.eventQueueTimeout = null;
      if (this.debug) {
        console.log(
          `Flushing Event Queue (${eventsToSend.length} events):`,
          eventsToSend
        );
      }
      const endpointUrl = this.endpoint;
      const payload = JSON.stringify(eventsToSend);
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([payload], { type: "application/json" });
          const success = navigator.sendBeacon(endpointUrl, blob);
          if (this.debug) {
            console.log(
              `Sent ${eventsToSend.length} events via sendBeacon to ${endpointUrl}. Success: ${success}`
            );
          }
          if (!success && this.debug) {
            console.warn(
              "sendBeacon returned false, queuing might have failed."
            );
          }
        } catch (error) {
          console.error("Error sending event batch via sendBeacon:", error);
          this.sendBatchWithFetch(endpointUrl, payload, eventsToSend.length);
        }
      } else {
        if (this.debug) {
          console.log("sendBeacon not available, using fetch fallback.");
        }
        this.sendBatchWithFetch(endpointUrl, payload, eventsToSend.length);
      }
    }
    // Helper function for fetch fallback
    async sendBatchWithFetch(url, payload, eventCount) {
      if (this.debug) {
        console.log(`Sending ${eventCount} events via Fetch to ${url}`);
      }
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          keepalive: true,
          // Important for requests potentially finishing after page unload
          credentials: "include",
          // Send cookies even for cross-origin requests
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (this.debug) {
          console.log(`Successfully sent ${eventCount} events via Fetch.`);
        }
      } catch (error) {
        console.error(`Error sending ${eventCount} events via Fetch:`, error);
      }
    }
    trackError(error, severity = ErrorSeverity.ERROR) {
      const extractStackInfo = () => {
        if (!error.stack)
          return {
            file: undefined,
            line: undefined,
            column: undefined,
            functionName: undefined,
          };
        const lines = error.stack.split("\\n");
        const funcLocationRegex = /\s*at\s+(.+?)\s+\(([^?#() ]+):(\d+):(\d+)\)/;
        const locationOnlyAtRegex = /\s*at\s+([^?#() ]+):(\d+):(\d+)/;
        const locationOnlyOtherRegex = /(?:^|@)([^?#() ]+):(\d+):(\d+)/;
        let file;
        let line;
        let column;
        let functionName;
        for (const currentLine of lines) {
          let match = currentLine.match(funcLocationRegex);
          if (match) {
            functionName = match[1].trim();
            const filePath = match[2];
            const lastSlash = filePath.lastIndexOf("/");
            file =
              lastSlash > -1 ? filePath.substring(lastSlash + 1) : filePath;
            line = parseInt(match[3], 10);
            column = parseInt(match[4], 10);
            break;
          }
          match = currentLine.match(locationOnlyAtRegex);
          if (match) {
            const filePath = match[1];
            const lastSlash = filePath.lastIndexOf("/");
            file =
              lastSlash > -1 ? filePath.substring(lastSlash + 1) : filePath;
            line = parseInt(match[2], 10);
            column = parseInt(match[3], 10);
            functionName = undefined;
            break;
          }
          match = currentLine.match(locationOnlyOtherRegex);
          if (match) {
            const filePath = match[1];
            const lastSlash = filePath.lastIndexOf("/");
            file =
              lastSlash > -1 ? filePath.substring(lastSlash + 1) : filePath;
            line = parseInt(match[2], 10);
            column = parseInt(match[3], 10);
            functionName = undefined;
            break;
          }
        }
        return { file, line, column, functionName };
      };
      const {
        file: error_file,
        line: error_line,
        column: error_column,
        functionName: error_function,
      } = extractStackInfo();
      const event = {
        ...this.createBaseEvent("error"),
        event_type: "error",
        error_type: error.name,
        error_message: error.message,
        error_stack: error.stack,
        severity,
        error_line,
        // Assign extracted line or undefined
        error_column,
        // Assign extracted column or undefined
        error_file,
        // Assign extracted file or undefined
        error_function,
        // Assign extracted function name or undefined
      };
      this.queueEvent(event);
    }
    trackPageView() {
      const event = {
        ...this.createBaseEvent(UserActionType.PAGE_VIEW),
        event_type: UserActionType.PAGE_VIEW,
      };
      this.queueEvent(event);
    }
    trackClick(event) {
      const target = event.target;
      if (target.closest("#triageflow-debug-output")) {
        return;
      }
      const eventData = {
        ...this.createBaseEvent(UserActionType.CLICK),
        event_type: UserActionType.CLICK,
        element_id: target.id,
        element_class: target.className,
        element_type: target.tagName.toLowerCase(),
        element_text: target.textContent?.trim().substring(0, 255),
        // Limit text length
        element_selector: this.getElementSelector(target),
      };
      this.queueEvent(eventData);
    }
    getElementSelector(element) {
      if (!element || typeof element.nodeName !== "string") {
        return "";
      }
      const parts = [];
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) {
          const escapedId = element.id.replace(/([:.#])/g, "\\$1");
          selector += `#${escapedId}`;
          parts.unshift(selector);
          break;
        } else {
          let sibling = element;
          let nth = 1;
          while ((sibling = sibling.previousElementSibling)) {
            if (sibling.nodeName.toLowerCase() === selector) nth++;
          }
          if (nth !== 1) selector += `:nth-of-type(${nth})`;
        }
        parts.unshift(selector);
        if (selector === "body" || selector === "html") break;
        element = element.parentNode;
      }
      return parts.join(" > ");
    }
    trackScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollPercent =
        docHeight > winHeight ? (scrollTop / (docHeight - winHeight)) * 100 : 0;
      if (Math.abs(scrollPercent - this.lastScrollDepth) >= 10) {
        const event = {
          ...this.createBaseEvent(UserActionType.SCROLL),
          event_type: UserActionType.SCROLL,
          scroll_depth: Math.round(scrollPercent),
          scroll_direction:
            scrollTop > this.lastScrollDepth
              ? ScrollDirection.DOWN
              : ScrollDirection.UP,
        };
        this.queueEvent(event);
        this.lastScrollDepth = scrollPercent;
      }
    }
    initializeTracking() {
      if (this.debug) {
        console.log("Initializing event listeners...");
      }
      this.trackPageView();
      window.addEventListener("popstate", () => this.trackPageView());
      document.addEventListener("click", (e) => this.trackClick(e), true);
      let scrollDebounceTimeout = null;
      window.addEventListener("scroll", () => {
        if (scrollDebounceTimeout) {
          window.clearTimeout(scrollDebounceTimeout);
        }
        scrollDebounceTimeout = window.setTimeout(
          () => this.trackScroll(),
          250
        );
      });
      window.addEventListener("error", (event) => {
        console.log("Caught window error event:", event);
        this.trackError(
          event.error || new Error(event.message || "Unknown error"),
          ErrorSeverity.ERROR
        );
      });
      window.addEventListener("unhandledrejection", (event) => {
        console.log("Caught unhandled rejection event:", event);
        this.trackError(
          event.reason instanceof Error
            ? event.reason
            : new Error(String(event.reason || "Unknown rejection reason")),
          ErrorSeverity.ERROR
        );
      });
      window.addEventListener("pagehide", () => {
        if (this.debug) {
          console.log("Page hiding, flushing remaining event queue...");
        }
        this.flushEventQueue();
      });
      if (this.debug) {
        console.log("Event listeners initialized.");
      }
    }
    setUserId(userId) {
      if (this.debug) {
        console.log("Setting User ID:", userId);
      }
      this.userId = userId;
    }
    trackCustomEvent(eventType, properties) {
      if (!eventType || typeof eventType !== "string") {
        console.error("TriageFlow Tracking: Invalid custom event type.");
        return;
      }
      const event = {
        ...this.createBaseEvent(eventType),
        // Ensure event_type aligns with UserActionType if possible, or use the provided string
        event_type: UserActionType[eventType.toUpperCase()] || eventType,
        properties,
      };
      this.queueEvent(event);
    }
  }
  if (typeof window !== "undefined") {
    const initializeGlobalTracker = () => {
      const config = window.triageFlowConfig;
      if (!config || typeof config !== "object") {
        console.error(
          "TriageFlow Tracking Error: Configuration object window.triageFlowConfig not found or invalid."
        );
        return;
      }
      if (!config.endpoint || typeof config.endpoint !== "string") {
        console.error(
          "TriageFlow Tracking Error: Missing or invalid 'endpoint' in window.triageFlowConfig."
        );
        return;
      }
      try {
        const instance = new TriageFlowTracking(config);
        window.triageFlowTracker = instance;
        if (config.debug) {
          console.log(
            "TriageFlow Tracker automatically initialized and attached to window.triageFlowTracker."
          );
        }
      } catch (error) {
        console.error(
          "TriageFlow Tracking Error: Failed to initialize tracker.",
          error
        );
      }
    };
    initializeGlobalTracker();
  } else {
    console.warn(
      "TriageFlow Tracking: Not running in a browser environment. Automatic instantiation skipped. Use module import for manual instantiation."
    );
  }

  return TriageFlowTracking;
})();
