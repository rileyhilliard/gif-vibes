document.addEventListener("DOMContentLoaded", () => {
  const DUMB_ENDPOINT =
    "http://localhost:5678/webhook/dc0c0afa-f5a3-4083-85a2-4c4ea4414663";
  const SMART_ENDPOINT =
    "http://localhost:5678/webhook-test/b1e84c15-0aef-4eb9-90c6-95fa639e9134";
  // "http://localhost:5678/webhook/b1e84c15-0aef-4eb9-90c6-95fa639e9134";
  const feedbackButton = document.getElementById("feedback-button");
  const feedbackDialog = document.getElementById("feedback-dialog");
  const feedbackForm = document.getElementById("feedback-form");
  const cancelButton = document.getElementById("cancel-feedback");
  const feedbackText = document.getElementById("feedback-text");

  // // Store all console logs
  // const consoleLogs = [];

  // // Override console methods to capture logs
  // const originalConsole = {
  //   log: console.log,
  //   warn: console.warn,
  //   error: console.error,
  //   info: console.info,
  // };

  // // Override console methods to store logs
  // // Helper function to override console methods
  // function overrideConsoleMethod(method, type) {
  //   return function () {
  //     const [message, ...rest] = Array.from(arguments);

  //     if (type === "error" && rest[0] && rest[0].stack) {
  //       consoleLogs.push({ type, message, stack: rest[0].stack });
  //     } else {
  //       consoleLogs.push({ type, message });
  //     }

  //     originalConsole[method].apply(console, arguments);
  //   };
  // }

  // // Override each console method
  // console.log = overrideConsoleMethod("log", "log");
  // console.warn = overrideConsoleMethod("warn", "warn");
  // console.error = overrideConsoleMethod("error", "error");
  // console.info = overrideConsoleMethod("info", "info");

  // Open dialog when feedback button is clicked
  feedbackButton.addEventListener("click", () => {
    feedbackDialog.showModal();
    feedbackText.focus();
  });

  // Close dialog when cancel button is clicked
  cancelButton.addEventListener("click", () => {
    feedbackDialog.close();
    feedbackText.value = ""; // Clear the textarea
  });

  // Handle form submission
  feedbackForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const feedback = feedbackText.value.trim();

    if (feedback) {
      const dedupedLogs = consoleLogs.filter(
        (log, index, self) =>
          index === self.findIndex((t) => t.stack === log.stack)
      );

      // Send feedback and logs to the webhook endpoint
      const sendFeedback = (endpoint) => {
        return fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user: window.triageFlowConfig.userId,
            session_id: sessionStorage.getItem("tf_session_id"),
            feedback,
            // logs: dedupedLogs,
          }),
        });
      };

      const handleResponse = (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      };

      const closeDialog = (data, message) => {
        originalConsole.log(message || "Feedback sent successfully:", data);
        feedbackText.value = "";
        feedbackDialog.close();
      };

      // First try SMART_ENDPOINT, fall back to DUMB_ENDPOINT if it fails
      sendFeedback(SMART_ENDPOINT)
        .then(handleResponse)
        .then((data) => closeDialog(data))
        .catch((error) => {
          originalConsole.error(
            "Error with SMART_ENDPOINT, trying DUMB_ENDPOINT:",
            error
          );

          // Fall back to DUMB_ENDPOINT
          sendFeedback(DUMB_ENDPOINT)
            .then(handleResponse)
            .then((data) =>
              closeDialog(data, "Feedback sent successfully with fallback:")
            )
            .catch((fallbackError) => {
              originalConsole.error(
                "Error sending feedback with both endpoints:",
                fallbackError
              );
            });
        });
    }
  });

  // Close dialog when clicking outside (optional)
  feedbackDialog.addEventListener("click", (e) => {
    const dialogDimensions = feedbackDialog.getBoundingClientRect();
    if (
      e.clientX < dialogDimensions.left ||
      e.clientX > dialogDimensions.right ||
      e.clientY < dialogDimensions.top ||
      e.clientY > dialogDimensions.bottom
    ) {
      feedbackDialog.close();
    }
  });
});
