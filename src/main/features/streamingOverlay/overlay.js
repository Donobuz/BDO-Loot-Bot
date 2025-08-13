let currentData = null;
let sessionStartTime = null;
let isReady = false;
let pendingData = null;

// Add error handling
window.addEventListener('error', (event) => {
  console.error('Overlay JavaScript error:', event.error);
  console.error('Error details:', event.filename, event.lineno, event.colno);
});

// Simple function to set up data listener
const setupDataListener = () => {
  if (!window.electronAPI) {
    return false;
  }
  
  try {
    window.electronAPI.onOverlayData((data) => {
      currentData = data;
      
      if (data.sessionStartTime) {
        sessionStartTime = new Date(data.sessionStartTime);
        // Update timer immediately when session start time is set
        updateSessionDuration();
      } else if (!sessionStartTime) {
        sessionStartTime = new Date();
        // Update timer immediately when session start time is defaulted
        updateSessionDuration();
      }
      
      if (isReady) {
        updateOverlay(data);
      } else {
        pendingData = data;
      }
    });
    return true;
  } catch (error) {
    console.error("Error setting up data listener:", error);
    return false;
  }
};

// Try to set up listener immediately
if (!setupDataListener()) {
  // Retry every 50ms for up to 5 seconds
  let retryCount = 0;
  const maxRetries = 100;
  
  const retry = setInterval(() => {
    retryCount++;
    
    if (setupDataListener() || retryCount >= maxRetries) {
      clearInterval(retry);
      if (retryCount >= maxRetries) {
        console.error("Failed to set up data listener after max retries");
      }
    }
  }, 50);
}

// DOM ready handler
document.addEventListener("DOMContentLoaded", () => {
  isReady = true;
  
  if (!window.electronAPI) {
    console.error("electronAPI still not available in DOM ready");
  }
  
  if (pendingData) {
    updateOverlay(pendingData);
    pendingData = null;
  } else if (currentData) {
    updateOverlay(currentData);
  }
});

function updateOverlay(data) {
  try {
    // Update gross value
    const grossValueElement = document.getElementById("grossValue");
    if (grossValueElement) {
      const grossValue = data.grossValue || 0;
      grossValueElement.textContent = `${grossValue.toLocaleString()} silver`;
    }

    // Update post-tax value
    const postTaxValueElement = document.getElementById("postTaxValue");
    if (postTaxValueElement) {
      const postTaxValue = data.postTaxValue || 0;
      postTaxValueElement.textContent = `${postTaxValue.toLocaleString()} silver`;
    }

    // Update items list
    const lootItemsContainer = document.getElementById("lootItems");
    if (!lootItemsContainer) {
      console.error("Loot items container not found");
      return;
    }

    if (!data.items || data.items.length === 0) {
      lootItemsContainer.innerHTML = '<div class="no-items">No loot table configured</div>';
      return;
    }
    
    // Show all items, regardless of count
    lootItemsContainer.innerHTML = data.items
      .map((item) => {
        const count = data.itemCounts[item.id] || 0;
        const value = count * item.calculatedPrice;

        return `
          <div class="active-loot-item">
            <div class="item-image-container">
              ${item.image_url 
                ? `<img src="${item.image_url}" alt="${item.name}" class="item-image">`
                : `<div class="item-image-placeholder">📦</div>`}
            </div>
            <div class="item-info">
              <span class="item-name" title="${item.name}">${item.name}</span>
              <div class="item-counter">
                <span class="count">${count}</span>
                <span class="value">${value.toLocaleString()} silver</span>
              </div>
            </div>
          </div>`;
      })
      .join("");
  } catch (error) {
    console.error("Error in updateOverlay:", error);
  }
}

function updateSessionDuration() {
  if (sessionStartTime) {
    const now = new Date();
    const diff = now.getTime() - sessionStartTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    const durationElement = document.getElementById("sessionDuration");
    if (durationElement) {
      durationElement.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }
}

// Update duration every second
setInterval(updateSessionDuration, 1000);
updateSessionDuration();
