chrome.storage.local.get("fromExtensionRedirect", (res) => {
  if (res.fromExtensionRedirect) {
    const banner = document.createElement("div");
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a202c;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0 0 10px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    `;

    // Create image element
    const image = document.createElement("img");
    image.src = chrome.runtime.getURL("logo-128.png");
    image.alt = "Fix this logo";
    image.style.cssText = `
      width: 28px;
      height: 28px;
    `;

    // Create text element
    const text = document.createElement("div");
    text.textContent = "Continue signing in to use Fix this & Transcriber";

    // Append image and text to banner
    banner.appendChild(image);
    banner.appendChild(text);
    document.body.appendChild(banner);

    // Optionally, you can remove the banner after a certain time
    // Uncomment the line below to remove the banner after 12 seconds

    // setTimeout(() => banner.remove(), 12000);

    chrome.storage.local.remove("fromExtensionRedirect");
  }
});
