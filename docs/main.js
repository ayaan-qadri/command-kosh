document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("copyright").innerHTML =
    `&copy; ${new Date().getFullYear()} Command Kosh. All rights reserved.`;

  const downloadBtn = document.getElementById("download-btn");
  const osNameSpan = document.getElementById("os-name");

  const REPO = "ayaan-qadri/command-kosh";
  const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

  function getOS() {
    const ua = navigator.userAgent.toLowerCase();

    if (
      ua.includes("android") ||
      ua.includes("iphone") ||
      ua.includes("ipad") ||
      ua.includes("ipod")
    )
      return "Generic";

    if (ua.includes("win")) return "Windows";
    if (ua.includes("mac") || ua.includes("darwin")) return "macOS";
    if (ua.includes("linux")) return "Linux";
    return "Generic";
  }

  const detectedOS = getOS();
  osNameSpan.textContent =
    detectedOS !== "Generic" ? `Download for ${detectedOS}` : "Download";

  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (data.assets && data.assets.length > 0) {
      const assets = data.assets;
      let downloadUrl = data.html_url;

      if (detectedOS === "Windows") {
        const winAsset = assets.find(
          (a) =>
            a.name.endsWith(".msi") ||
            a.name.endsWith("x64-setup.exe") ||
            a.name.endsWith(".exe"),
        );
        if (winAsset) downloadUrl = winAsset.browser_download_url;
      } else if (detectedOS === "macOS") {
        const macAsset = assets.find(
          (a) => a.name.endsWith(".dmg") || a.name.endsWith(".app.tar.gz"),
        );
        if (macAsset) downloadUrl = macAsset.browser_download_url;
      } else if (detectedOS === "Linux") {
        const linuxAsset = assets.find(
          (a) => a.name.endsWith(".AppImage") || a.name.endsWith(".deb"),
        );
        if (linuxAsset) downloadUrl = linuxAsset.browser_download_url;
      }

      downloadBtn.href = downloadUrl;
    }
  } catch (error) {
    console.error("Command Kosh: Error fetching latest release:", error);
    downloadBtn.href = `https://github.com/${REPO}/releases/latest`;
  }

  const observers = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-fade-in");
        }
      });
    },
    { threshold: 0.1 },
  );

  document
    .querySelectorAll(".mockup-wrapper, .feature-text, .feature-img")
    .forEach((el) => observers.observe(el));

  window.addEventListener("scroll", () => {
    const swapperBlock = document.querySelector(".feature-img.swapper");
    if (swapperBlock) {
      const rect = swapperBlock.getBoundingClientRect();

      const isPastMidpoint = rect.top < window.innerHeight * 0.3;
      const currentlySwapped = swapperBlock.classList.contains("swapped");

      if (isPastMidpoint !== currentlySwapped) {
        swapperBlock.classList.toggle("swapped", isPastMidpoint);
        swapperBlock.classList.add("highlight");
        setTimeout(() => swapperBlock.classList.remove("highlight"), 600);
      }
    }
  });

  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-img");
  const closeBtn = document.querySelector(".close-modal");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  let currentGallery = [];
  let currentIndex = 0;

  const updateModalNav = () => {
    if (currentGallery.length > 1) {
      prevBtn.style.display = "flex";
      nextBtn.style.display = "flex";
    } else {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
    }
  };

  const navigateModal = (direction) => {
    if (currentGallery.length <= 1) return;
    currentIndex =
      (currentIndex + direction + currentGallery.length) %
      currentGallery.length;
    modalImg.src = currentGallery[currentIndex];
  };

  document
    .querySelectorAll(".mockup-inner img, .feature-img img")
    .forEach((img) => {
      img.addEventListener("click", function () {
        currentGallery = Array.from(
          document.querySelectorAll(".mockup-inner img, .feature-img img"),
        ).map((el) => el.src);
        currentIndex = currentGallery.indexOf(this.src);

        updateModalNav();
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("show"), 10);
        modalImg.src = this.src;
      });
    });

  const closeModal = () => {
    modal.classList.remove("show");
    setTimeout(() => (modal.style.display = "none"), 300);
  };

  if (prevBtn)
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateModal(-1);
    });
  if (nextBtn)
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateModal(1);
    });
  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target !== modalImg && e.target !== prevBtn && e.target !== nextBtn) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (modal.classList.contains("show")) {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") navigateModal(-1);
      if (e.key === "ArrowRight") navigateModal(1);
    }
  });
});
