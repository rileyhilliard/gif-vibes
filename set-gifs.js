document.addEventListener("DOMContentLoaded", () => {
  const fetchButton = document.getElementById("fetch-gif");
  const gifContainer = document.getElementById("gif-container");

  fetchButton.addEventListener("click", displayRandomGif);

  function displayRandomGif() {
    // Show loading state
    gifContainer.innerHTML = '<p class="loading">Loading your GIF...</p>';

    try {
      // throw new Error("The site is down! 😱");
      // Get a random GIF from the GIFS array
      const randomIndex = Math.floor(Math.random() * window.GIFS.length);
      const gifUrl = window.GIFS[randomIndex];

      // Create and display the image
      // BUG NOTE: This is a bug, and will cause a JS error
      // const img = document.createElement("img");
      img.src = gifUrl;
      img.alt = "Random GIF";

      // Add a loading event to handle when the image is fully loaded
      img.onload = () => {
        gifContainer.innerHTML = "";
        gifContainer.appendChild(img);
      };

      // Add an error handler in case the image fails to load
      img.onerror = () => {
        gifContainer.innerHTML = `
          <div class="error-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3>Oops! Something went wrong</h3>
            <p>Failed to load the GIF. Try again!</p>
          </div>
        `;
      };

      // Start loading the image
      img.src = gifUrl;
    } catch (error) {
      gifContainer.innerHTML = `
        <div class="error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Oops! Something went wrong</h3>
          <p>${error.message}</p>
        </div>
      `;
      throw error;
    }
  }
});
