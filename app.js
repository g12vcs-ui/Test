function makeDemoImage(label, start = "#7aa2ff", end = "#2f3f77") {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='900'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${start}'/>
        <stop offset='100%' stop-color='${end}'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <circle cx='1120' cy='170' r='120' fill='rgba(255,255,255,0.14)'/>
    <text x='80' y='150' font-size='68' fill='white' font-family='Inter,Arial,sans-serif'>${label}</text>
    <text x='80' y='250' font-size='34' fill='rgba(255,255,255,0.92)' font-family='Inter,Arial,sans-serif'>MathVerse Weekly Visual</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const issuePages = [
  {
    title: "Cover Story — Infinite Series in Nature",
    html: `
      <p>This week we model sunflower spirals with Fibonacci limits and estimate growth with $\\sum_{n=1}^{\\infty}\\frac{1}{n^2}$.</p>
      <img class="inline-photo" src="${makeDemoImage("Sunflower Spirals", "#b57d2e", "#3d2610")}" alt="Sunflower pattern" />
      <p>Scan the QR to run an interactive simulation:</p>
      <a class="qr-link" target="_blank" rel="noopener" href="https://www.geogebra.org/">
        🔳 Open QR destination (GeoGebra)
      </a>
    `
  },
  {
    title: "Olympiad Focus — Functional Equations",
    html: `
      <p>Solve for all functions satisfying $f(x+y)=f(x)f(y)$ over $\\mathbb{R}$ under continuity assumptions.</p>
      <p>Classic result: $f(x)=e^{cx}$.</p>
      <img class="inline-photo" src="${makeDemoImage("Functional Equations", "#3f68c7", "#172754")}" alt="Notebook equations" />
    `
  },
  {
    title: "Math + AI Lab",
    html: `
      <p>Train a lightweight model to classify handwritten symbols and verify symbolic identities.</p>
      <p>Featured equation: $\\int_0^1 x^a(1-x)^b dx = \\frac{\\Gamma(a+1)\\Gamma(b+1)}{\\Gamma(a+b+2)}$.</p>
      <p>Tap images to inspect details in high resolution.</p>
      <img class="inline-photo" src="${makeDemoImage("Math + AI Lab", "#1b8d7f", "#0f2f2a")}" alt="Data charts" />
    `
  },
  {
    title: "Weekly Challenge",
    html: `
      <p>Find all integers $(x,y)$ such that $x^2-5y^2=1$.</p>
      <p>This is a Pell equation. Construct solutions from powers of $9+4\\sqrt{5}$.</p>
      <p>Send your proof sketch by Sunday midnight.</p>
    `
  }
];

const state = {
  current: 0,
  onePageMode: false,
  zoom: 1
};

const book = document.getElementById("book");
const bookLighting = document.getElementById("bookLighting");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const modeToggle = document.getElementById("modeToggle");
const ttsToggle = document.getElementById("ttsToggle");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxStatus = document.getElementById("lightboxStatus");
const closeLightbox = document.getElementById("closeLightbox");
const blockEditor = document.getElementById("blockEditor");
const publishBlocks = document.getElementById("publishBlocks");

const turnAudio = new Audio(
  "https://cdn.pixabay.com/download/audio/2021/08/04/audio_f9f2f3f578.mp3?filename=book-page-flip-01-1762.mp3"
);
turnAudio.volume = 0.22;

function renderBook() {
  const rightIndex = state.current;
  const leftIndex = Math.max(0, rightIndex - 1);
  const indices = state.onePageMode ? [rightIndex, Math.min(issuePages.length - 1, rightIndex + 1)] : [leftIndex, rightIndex];

  book.classList.toggle("one-page", state.onePageMode);
  book.innerHTML = "";

  indices.forEach((idx, col) => {
    const pageData = issuePages[idx];
    const page = document.createElement("article");
    page.className = "page";
    if (state.onePageMode && col === 1) {
      page.classList.add("peek");
      page.addEventListener("click", () => goToPage(idx));
    }
    page.dataset.pageIndex = String(idx);
    page.innerHTML = `
      <h3>${pageData.title}</h3>
      ${pageData.html}
      <div class="page-num">Page ${idx + 1}</div>
    `;
    book.appendChild(page);
  });

  bindPhotoZoom();
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise();
  }
}

function nonlinearZoom(deltaY) {
  const direction = deltaY > 0 ? -1 : 1;
  const sensitivity = 0.1 + Math.abs(Math.log(state.zoom + 0.05)) * 0.02;
  state.zoom = Math.min(2.7, Math.max(0.65, state.zoom + direction * sensitivity));
  book.style.transform = `scale(${state.zoom})`;
}

function flipAnimation(forward = true) {
  const target = forward ? book.lastElementChild : book.firstElementChild;
  if (!target) return;
  target.classList.add("flipping");
  turnAudio.currentTime = 0;
  turnAudio.play().catch(() => {});
  setTimeout(() => target.classList.remove("flipping"), 650);
}

function goToPage(index) {
  if (index < 0 || index >= issuePages.length) return;
  const forward = index >= state.current;
  state.current = index;
  flipAnimation(forward);
  renderBook();
}

prevPageBtn.addEventListener("click", () => goToPage(Math.max(0, state.current - 1)));
nextPageBtn.addEventListener("click", () => goToPage(Math.min(issuePages.length - 1, state.current + 1)));

modeToggle.addEventListener("click", () => {
  state.onePageMode = !state.onePageMode;
  modeToggle.setAttribute("aria-pressed", String(state.onePageMode));
  modeToggle.textContent = state.onePageMode ? "Spread mode" : "One-page mode";
  renderBook();
});

book.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    nonlinearZoom(e.deltaY);
  },
  { passive: false }
);

let pinchStartDistance = null;
book.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    pinchStartDistance = touchDistance(e.touches[0], e.touches[1]);
  }
});

book.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2 && pinchStartDistance !== null) {
    e.preventDefault();
    const currentDistance = touchDistance(e.touches[0], e.touches[1]);
    nonlinearZoom(pinchStartDistance - currentDistance);
    pinchStartDistance = currentDistance;
  }
}, { passive: false });

book.addEventListener("touchend", () => {
  pinchStartDistance = null;
});

function touchDistance(t1, t2) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function bindPhotoZoom() {
  book.querySelectorAll(".inline-photo").forEach((img) => {
    img.addEventListener("click", () => {
      lightboxImage.src = img.src;
      lightboxStatus.textContent = "";
      lightbox.hidden = false;
    });
  });
}

function closeLightboxModal() {
  lightbox.hidden = true;
}

closeLightbox.addEventListener("click", closeLightboxModal);

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    closeLightboxModal();
  }
});

lightboxImage.addEventListener("error", () => {
  lightboxStatus.textContent = "Image failed to load. Tap close (✕) to exit preview.";
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightbox.hidden) {
    closeLightboxModal();
  }
});

function createBlock(type) {
  const block = document.createElement("div");
  block.className = "block";

  if (type === "image" || type === "video") {
    block.innerHTML = `<strong>${type.toUpperCase()} URL</strong><input placeholder="https://..." />`;
  } else if (type === "equation") {
    block.innerHTML = `<strong>Equation (LaTeX)</strong><div contenteditable="true">\\int_0^1 x^2dx = 1/3</div>`;
  } else {
    block.innerHTML = `<strong>${type.toUpperCase()}</strong><div contenteditable="true">Write ${type}...</div>`;
  }

  blockEditor.appendChild(block);
}

document.querySelectorAll(".lab-actions [data-block]").forEach((btn) => {
  btn.addEventListener("click", () => createBlock(btn.dataset.block));
});

publishBlocks.addEventListener("click", () => {
  const blocks = [...blockEditor.querySelectorAll(".block")];
  if (!blocks.length) return;

  const html = blocks
    .map((block) => {
      const title = block.querySelector("strong")?.textContent || "BLOCK";
      const editable = block.querySelector("[contenteditable='true']")?.textContent?.trim();
      const input = block.querySelector("input")?.value?.trim();

      if (title.startsWith("IMAGE") && input) {
        return `<img class="inline-photo" src="${input}" alt="Creator image" />`;
      }
      if (title.startsWith("VIDEO") && input) {
        return `<p><a target="_blank" rel="noopener" href="${input}">▶ Open video resource</a></p>`;
      }
      if (title.startsWith("EQUATION")) {
        return `<p>$$${editable || "x^2+y^2=z^2"}$$</p>`;
      }
      return `<p>${editable || ""}</p>`;
    })
    .join("\n");

  if (issuePages.length > 5) {
    issuePages[issuePages.length - 1] = { title: "Creator Draft", html };
  } else {
    issuePages.push({ title: "Creator Draft", html });
  }

  state.current = issuePages.length - 1;
  renderBook();
});

let speaking = false;
function speakCurrentSpread() {
  if (!window.speechSynthesis) return;
  const pages = [...book.querySelectorAll(".page")];
  const text = pages.map((page) => page.innerText).join(" ");

  if (speaking) {
    window.speechSynthesis.cancel();
    speaking = false;
    ttsToggle.setAttribute("aria-pressed", "false");
    ttsToggle.textContent = "Read aloud";
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.onend = () => {
    speaking = false;
    ttsToggle.setAttribute("aria-pressed", "false");
    ttsToggle.textContent = "Read aloud";
  };

  speaking = true;
  ttsToggle.setAttribute("aria-pressed", "true");
  ttsToggle.textContent = "Stop reading";
  window.speechSynthesis.speak(utterance);
}

ttsToggle.addEventListener("click", speakCurrentSpread);

function updateLighting(x, y) {
  const lx = Math.max(0, Math.min(100, x));
  const ly = Math.max(0, Math.min(100, y));
  bookLighting.style.background = `radial-gradient(circle at ${lx}% ${ly}%, rgba(255,255,255,0.32), rgba(0,0,0,0.3) 68%)`;
}

window.addEventListener("deviceorientation", (event) => {
  if (event.beta == null || event.gamma == null) return;
  const x = 50 + event.gamma * 0.6;
  const y = 40 + event.beta * 0.45;
  updateLighting(x, y);
});

if ("AmbientLightSensor" in window) {
  try {
    const sensor = new window.AmbientLightSensor();
    sensor.addEventListener("reading", () => {
      const lux = Math.min(1000, sensor.illuminance || 0);
      const intensity = Math.max(18, Math.min(52, 16 + lux / 26));
      updateLighting(intensity, 40);
    });
    sensor.start();
  } catch (error) {
    // Ignore unsupported permission issues.
  }
}

createBlock("heading");
createBlock("paragraph");
createBlock("equation");
renderBook();
