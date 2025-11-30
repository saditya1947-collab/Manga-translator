// ============================================================
// 🔧 API CONFIGURATION
// ============================================================

const API_BASE_URL = 'https://adityat4000u-manga-translator.hf.space/predict';
const MAX_RETRIES = 2;
const RETRY_DELAY = 5000; // 5 seconds

// ============================================================
// ENHANCED FETCH WITH RETRY LOGIC (for cold starts)
// ============================================================

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
            
        } catch (error) {
            if (i === retries) {
                throw new Error(`Failed after ${retries + 1} attempts: ${error.message}`);
            }
            
            console.log(`⚠️ Attempt ${i + 1} failed, retrying in ${RETRY_DELAY/1000}s...`);
            status.innerText = `⏳ Space is waking up... (Attempt ${i + 1}/${retries + 1})`;
            
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

// ============================================================
// DOM ELEMENTS
// ============================================================

const fileInput = document.getElementById("file");
const processBtn = document.getElementById("processBtn");
const nhentaiUrlInput = document.getElementById("nhentaiUrl");
const pageNumbersInput = document.getElementById("pageNumbers");
const processNhentaiBtn = document.getElementById("processNhentaiBtn");
const status = document.getElementById("status");
const resultContainer = document.getElementById("resultContainer");
const loadingBarContainer = document.getElementById("loadingBarContainer");
const loadingBar = document.getElementById("loadingBar");

// Overlay elements
const overlay = document.getElementById("overlay");
const overlayImg = document.getElementById("overlayImg");
const overlayContent = document.getElementById("overlayContent");
const imageWrapper = document.getElementById("imageWrapper");
const closeBtn = document.querySelector(".closeBtn");
const prevBtn = document.querySelector(".prevBtn");
const nextBtn = document.querySelector(".nextBtn");
const zoomIndicator = document.getElementById("zoomIndicator");
const pageIndicator = document.getElementById("pageIndicator");

let overlayImages = [];
let currentIndex = 0;
let zoom = 1.5;
let isOverImage = false;
let isProcessing = false;
let zoomTimeout = null;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function showZoomIndicator() {
    zoomIndicator.classList.add('visible');
    clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
        zoomIndicator.classList.remove('visible');
    }, 2000);
}

function updateZoomIndicator() {
    zoomIndicator.textContent = Math.round(zoom * 100) + '%';
    showZoomIndicator();
}

function updatePageIndicator() {
    pageIndicator.textContent = `Page ${currentIndex + 1}/${overlayImages.length}`;
}

function updateZoom() {
    imageWrapper.style.transform = `scale(${zoom})`;
    const padding = Math.max(60, 100 * zoom);
    overlayContent.style.padding = `${padding}px 0`;
    updateZoomIndicator();
    
    setTimeout(() => {
        const scrollY = (overlayContent.scrollHeight - overlayContent.clientHeight) / 2;
        overlayContent.scrollTo({ top: scrollY, behavior: 'instant' });
    }, 10);
}

// ============================================================
// OVERLAY FUNCTIONS
// ============================================================

function openOverlay(index) {
    currentIndex = index;
    overlayImg.src = overlayImages[currentIndex].src;
    overlay.style.display = "block";
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    zoom = 1.5;
    updatePageIndicator();
    
    overlayImg.onload = () => {
        updateZoom();
        setTimeout(() => {
            const scrollY = (overlayContent.scrollHeight - overlayContent.clientHeight) / 2;
            overlayContent.scrollTo({ top: scrollY, behavior: 'instant' });
        }, 50);
    };
}

closeBtn.onclick = () => {
    overlay.style.display = "none";
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
};

function showPrev() {
    if (currentIndex > 0) {
        currentIndex--;
        overlayImg.src = overlayImages[currentIndex].src;
        updatePageIndicator();
        overlayImg.onload = () => updateZoom();
    }
}

function showNext() {
    if (currentIndex < overlayImages.length - 1) {
        currentIndex++;
        overlayImg.src = overlayImages[currentIndex].src;
        updatePageIndicator();
        overlayImg.onload = () => updateZoom();
    }
}

prevBtn.onclick = showPrev;
nextBtn.onclick = showNext;

// Mouse tracking
overlayImg.addEventListener("mouseenter", () => { isOverImage = true; });
overlayImg.addEventListener("mouseleave", () => { isOverImage = false; });

// Zoom with mouse wheel
overlay.addEventListener("wheel", (e) => {
    if (isOverImage) {
        e.preventDefault();
        e.stopPropagation();
        const zoomSpeed = 0.1;
        zoom += (e.deltaY < 0 ? zoomSpeed : -zoomSpeed);
        zoom = Math.min(Math.max(zoom, 0.5), 2.0);
        updateZoom();
    }
}, { passive: false });

// Keyboard controls
document.addEventListener("keydown", (e) => {
    if (overlay.style.display !== "block") return;
    
    const actions = {
        'ArrowLeft': showPrev,
        'ArrowRight': showNext,
        'Escape': () => closeBtn.click(),
        'ArrowUp': () => overlayContent.scrollBy({ top: -100, behavior: 'smooth' }),
        'ArrowDown': () => overlayContent.scrollBy({ top: 100, behavior: 'smooth' }),
        '+': () => { zoom = Math.min(zoom + 0.1, 2.0); updateZoom(); },
        '=': () => { zoom = Math.min(zoom + 0.1, 2.0); updateZoom(); },
        '-': () => { zoom = Math.max(zoom - 0.1, 0.5); updateZoom(); },
        '_': () => { zoom = Math.max(zoom - 0.1, 0.5); updateZoom(); },
        '0': () => { zoom = 1.5; updateZoom(); }
    };
    
    if (actions[e.key]) {
        e.preventDefault();
        actions[e.key]();
    }
});

overlayImg.addEventListener("dblclick", () => {
    zoom = 1.5;
    updateZoom();
});

// ============================================================
// PROCESS UPLOADED FILES (WITH RETRY LOGIC)
// ============================================================

async function processFiles(files) {
    if (isProcessing) {
        alert("⏳ Already processing! Please wait...");
        return;
    }
    
    isProcessing = true;
    processBtn.disabled = true;
    
    resultContainer.innerHTML = "";
    overlayImages = [];
    loadingBarContainer.style.display = "block";
    status.style.display = "block";
    loadingBar.style.width = "0%";
    loadingBar.innerText = "0%";
    status.innerText = "🔄 Starting translator... (this may take up to 60s if sleeping)";

    for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append("file", files[i]);

        try {
            status.innerText = `🔄 Processing image ${i + 1}/${files.length}...`;
            
            // Use fetchWithRetry for better cold start handling
            const res = await fetchWithRetry(`${API_BASE_URL}/process`, {
                method: "POST",
                body: form
            });

            if (!res.ok) {
                const err = await res.json();
                status.innerText = "❌ Server error: " + (err.detail || res.statusText);
                continue;
            }

            const data = await res.json();

            if (data.result_image) {
                const div = document.createElement("div");
                div.className = "resultBox";
                div.style.opacity = "0";
                div.style.transform = "scale(0.9)";

                const pageLabel = document.createElement("p");
                pageLabel.textContent = `Image ${i + 1}`;

                const img = document.createElement("img");
                img.src = data.result_image;

                div.appendChild(pageLabel);
                div.appendChild(img);
                resultContainer.appendChild(div);

                setTimeout(() => {
                    div.style.transition = "all 0.3s ease";
                    div.style.opacity = "1";
                    div.style.transform = "scale(1)";
                }, 10);

                overlayImages.push(img);
                div.onclick = () => openOverlay(overlayImages.indexOf(img));
            }

            const percent = Math.round(((i + 1) / files.length) * 100);
            loadingBar.style.width = percent + "%";
            loadingBar.innerText = percent + "%";

        } catch (e) {
            console.error(e);
            status.innerText = "❌ Request failed: " + e.message;
            status.innerText += "\n💡 The Space might be sleeping. Try again in a moment.";
        }
    }

    status.innerText = "✅ Done! All images translated successfully.";
    isProcessing = false;
    processBtn.disabled = false;
}

processBtn.onclick = () => {
    const files = fileInput.files;
    if (!files.length) return alert("📁 Please select at least one file.");
    processFiles(files);
};

// ============================================================
// PROCESS NHENTAI URL WITH STREAMING (WITH RETRY LOGIC)
// ============================================================

processNhentaiBtn.onclick = async () => {
    if (isProcessing) {
        alert("⏳ Already processing! Please wait...");
        return;
    }
    
    const url = nhentaiUrlInput.value.trim();
    const pageNumbers = pageNumbersInput.value.trim() || "all";
    
    if (!url) return alert("🔗 Please enter a nhentai URL.");
    
    isProcessing = true;
    processNhentaiBtn.disabled = true;
    
    resultContainer.innerHTML = "";
    overlayImages = [];
    loadingBarContainer.style.display = "block";
    status.style.display = "block";
    loadingBar.style.width = "0%";
    loadingBar.innerText = "0%";
    status.innerText = "🌐 Waking up translator and fetching gallery... (may take 60s)";
    
    try {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("page_numbers", pageNumbers);
        
        // Use fetchWithRetry for better cold start handling
        const response = await fetchWithRetry(`${API_BASE_URL}/process_nhentai_stream`, {
            method: "POST",
            body: formData
        });
        
        if (!response.ok) {
            status.innerText = "❌ Error: " + response.statusText;
            loadingBarContainer.style.display = "none";
            return;
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let galleryTitle = '';
        let totalToProcess = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const data = JSON.parse(line);
                    
                    if (data.type === "info") {
                        galleryTitle = data.title;
                        totalToProcess = data.pages_to_process;
                        status.innerText = `🔄 Translating "${galleryTitle}" - 0/${totalToProcess} pages`;
                        
                    } else if (data.type === "result") {
                        const div = document.createElement("div");
                        div.className = "resultBox";
                        div.style.opacity = "0";
                        div.style.transform = "scale(0.9)";
                        
                        const pageLabel = document.createElement("p");
                        pageLabel.textContent = `Page ${data.page}`;
                        
                        const img = document.createElement("img");
                        img.src = data.image;
                        
                        div.appendChild(pageLabel);
                        div.appendChild(img);
                        resultContainer.appendChild(div);
                        
                        setTimeout(() => {
                            div.style.transition = "all 0.3s ease";
                            div.style.opacity = "1";
                            div.style.transform = "scale(1)";
                        }, 10);
                        
                        overlayImages.push(img);
                        div.onclick = () => openOverlay(overlayImages.indexOf(img));
                        
                        const percent = Math.round((data.progress / totalToProcess) * 100);
                        loadingBar.style.width = percent + "%";
                        loadingBar.innerText = percent + "%";
                        status.innerText = `🔄 Translating "${galleryTitle}" - ${data.progress}/${totalToProcess} pages`;
                        
                    } else if (data.type === "error") {
                        console.error(`Error on page ${data.page}:`, data.message);
                        
                    } else if (data.type === "complete") {
                        status.innerText = `✅ Done! Translated ${totalToProcess} pages from "${galleryTitle}"`;
                    }
                    
                } catch (e) {
                    console.error("Error parsing JSON:", e, line);
                }
            }
        }
        
    } catch (e) {
        console.error(e);
        status.innerText = "❌ Request failed: " + e.message;
        status.innerText += "\n💡 The Space might be sleeping. Please try again.";
        loadingBarContainer.style.display = "none";
    } finally {
        isProcessing = false;
        processNhentaiBtn.disabled = false;
    }
};

// ============================================================
// 🔍 API CONNECTION TEST & KEEP-ALIVE PING
// ============================================================

let isSpaceAwake = false;

// Test connection on load
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Manga Translator loaded');
    console.log('📡 API Base URL:', API_BASE_URL);
    
    // Test if Space is awake
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const testResponse = await fetch(`${API_BASE_URL}/`, {
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (testResponse.ok) {
            console.log('✅ Space is awake and ready!');
            isSpaceAwake = true;
        }
    } catch (error) {
        console.warn('⚠️ Space appears to be sleeping. First request may take 60s to wake up.');
        isSpaceAwake = false;
    }
});

// Optional: Keep Space awake by ping every 30 minutes
// Uncomment this if you want to keep it awake during active sessions
/*
setInterval(async () => {
    if (document.visibilityState === 'visible' && !isProcessing) {
        try {
            await fetch(`${API_BASE_URL}/`, { method: 'HEAD' });
            console.log('🔄 Pinged Space to keep it awake');
            isSpaceAwake = true;
        } catch (e) {
            isSpaceAwake = false;
        }
    }
}, 1800000); // Every 30 minutes
*/



