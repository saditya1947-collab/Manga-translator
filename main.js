// ============================================================
// 🔧 API CONFIGURATION
// ============================================================
// IMPORTANT: This must point to your BACKEND API, not GitHub Pages!
// Options:
// 1. HuggingFace Space: 'https://your-space.hf.space'
// 2. Railway: 'https://your-app.railway.app'
// 3. Render: 'https://your-app.onrender.com'
// 4. Local testing: 'http://localhost:7860'

const API_BASE_URL = 'https://adityat4000u-manga-translator.hf.space';

// Verify API URL is correct
if (API_BASE_URL.includes('github.io')) {
    console.error('❌ ERROR: API_BASE_URL points to GitHub Pages! This will not work.');
    console.error('GitHub Pages cannot run Python/FastAPI backends.');
    console.error('Please deploy your backend to HuggingFace/Railway/Render and update API_BASE_URL');
    alert('⚠️ Configuration Error: API endpoint is not set correctly. Check console for details.');
}

// Retry settings for handling Space wake-up and network issues
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

// ============================================================
// 🔄 SMART FETCH FUNCTION WITH AUTO-RETRY
// ============================================================
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    // Ensure we're not accidentally calling GitHub Pages
    if (url.includes('github.io')) {
        throw new Error('Cannot POST to GitHub Pages! Check API_BASE_URL configuration.');
    }
    
    console.log('🌐 Fetching:', url);
    
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Log response for debugging
            console.log(`📡 Response from ${url}:`, response.status, response.statusText);
            
            if (response.ok || (response.status !== 503 && i === retries)) {
                return response;
            }
            
            if (response.status === 503 && i < retries) {
                updateStatus(`⏳ Space is waking up... Please wait (Attempt ${i + 2}/${retries + 1})`, 'warning');
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
                continue;
            }
            
            // Handle 405 error specifically
            if (response.status === 405) {
                throw new Error(`405 Method Not Allowed. The endpoint ${url} doesn't accept this request method. Check your API configuration.`);
            }
            
            return response;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Request timeout');
                if (i === retries) {
                    throw new Error('Request timed out after 3 minutes');
                }
            } else if (i === retries) {
                throw new Error(`Failed after ${retries + 1} attempts: ${error.message}`);
            }
            
            updateStatus(`⏳ Connection failed, retrying... (Attempt ${i + 1}/${retries + 1})`, 'warning');
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
        }
    }
}

// ============================================================
// 📱 DOM ELEMENT REFERENCES
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

const overlay = document.getElementById("overlay");
const overlayImg = document.getElementById("overlayImg");
const overlayContent = document.getElementById("overlayContent");
const imageWrapper = document.getElementById("imageWrapper");
const closeBtn = document.querySelector(".closeBtn");
const prevBtn = document.querySelector(".prevBtn");
const nextBtn = document.querySelector(".nextBtn");
const zoomIndicator = document.getElementById("zoomIndicator");
const pageIndicator = document.getElementById("pageIndicator");

// ============================================================
// 🔢 GLOBAL STATE VARIABLES
// ============================================================
let overlayImages = [];
let currentIndex = 0;
let zoom = 1.0;
let isOverImage = false;
let isProcessing = false;
let zoomTimeout = null;
let originalImageWidth = 0;
let originalImageHeight = 0;

// ============================================================
// 📊 STATUS UPDATE HELPER
// ============================================================
function updateStatus(message, type = 'info') {
    status.innerText = message;
    status.style.display = "block";
    
    switch(type) {
        case 'success':
            status.style.color = '#28a745';
            break;
        case 'error':
            status.style.color = '#dc3545';
            break;
        case 'warning':
            status.style.color = '#ffc107';
            break;
        default:
            status.style.color = '#007bff';
    }
}

// ============================================================
// 📏 ZOOM & UI HELPER FUNCTIONS
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
    if (originalImageWidth === 0) return;

    const newImgWidth = originalImageWidth * zoom;
    const newImgHeight = originalImageHeight * zoom;

    overlayImg.style.width = `${newImgWidth}px`;
    overlayImg.style.height = `${newImgHeight}px`;

    imageWrapper.style.width = `auto`; 
    imageWrapper.style.height = `auto`; 

    updateZoomIndicator();
}

// ============================================================
// 🖼️ FULLSCREEN OVERLAY VIEWER
// ============================================================
function openOverlay(index) {
    currentIndex = index;
    zoom = 1.0;
    
    overlayImg.style.opacity = "0";
    overlayImg.src = overlayImages[currentIndex].src;
    
    overlay.style.display = "block";
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    updatePageIndicator();
    
    overlayImg.onload = () => {
        originalImageWidth = overlayImg.naturalWidth;
        originalImageHeight = overlayImg.naturalHeight;
        
        const availableWidth = window.innerWidth - 100;
        const availableHeight = window.innerHeight - 200;

        if (originalImageWidth > availableWidth || originalImageHeight > availableHeight) {
            const widthRatio = availableWidth / originalImageWidth;
            const heightRatio = availableHeight / originalImageHeight;
            zoom = Math.min(widthRatio, heightRatio);
        } else {
            zoom = 1.0;
        }

        zoom = Math.max(zoom, 0.2);
        updateZoom();
        overlayImg.style.opacity = "1";
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

overlayImg.addEventListener("mouseenter", () => { isOverImage = true; });
overlayImg.addEventListener("mouseleave", () => { isOverImage = false; });

overlay.addEventListener("wheel", (e) => {
    if (isOverImage) {
        e.preventDefault();
        e.stopPropagation();
        const zoomSpeed = 0.05;
        zoom += (e.deltaY < 0 ? zoomSpeed : -zoomSpeed);
        zoom = Math.min(Math.max(zoom, 0.1), 1.0);
        updateZoom();
    }
}, { passive: false });

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
// 📤 IMAGE UPLOAD PROCESSING
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
    
    updateStatus("🚀 Initializing translator...", 'info');

    for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append("file", files[i]);

        try {
            updateStatus(`📤 Uploading image ${i + 1}/${files.length}...`, 'info');
            
            // Make sure we're calling the correct endpoint
            const endpoint = `${API_BASE_URL}/process`;
            console.log('📡 Calling endpoint:', endpoint);
            
            const res = await fetchWithRetry(endpoint, {
                method: "POST",
                body: form
            });

            if (!res.ok) {
                let errorMsg = `Server error: ${res.status}`;
                try {
                    const err = await res.json();
                    errorMsg = err.detail || err.message || errorMsg;
                } catch (e) {
                    errorMsg = res.statusText || errorMsg;
                }
                
                updateStatus(`❌ ${errorMsg}`, 'error');
                
                if (res.status === 503) {
                    updateStatus("⏳ Service is starting, please wait 30s and try again.", 'warning');
                } else if (res.status === 405) {
                    updateStatus("❌ 405 Method Not Allowed - Check API configuration", 'error');
                    console.error('The endpoint does not accept POST requests. Verify your backend is running correctly.');
                }
                continue;
            }

            updateStatus(`⚙️ Processing image ${i + 1}/${files.length}...`, 'info');
            
            const data = await res.json();

            if (data.result_image) {
                updateStatus(`🎨 Rendering translated image ${i + 1}/${files.length}...`, 'info');
                
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
                
                updateStatus(`✅ Image ${i + 1}/${files.length} completed!`, 'success');
            }

            const percent = Math.round(((i + 1) / files.length) * 100);
            loadingBar.style.width = percent + "%";
            loadingBar.innerText = percent + "%";

        } catch (e) {
            console.error('Processing error:', e);
            updateStatus(`❌ Request failed: ${e.message}`, 'error');
        }
    }

    updateStatus(`✅ All done! Successfully translated ${files.length} image(s).`, 'success');
    isProcessing = false;
    processBtn.disabled = false;
}

processBtn.onclick = () => {
    const files = fileInput.files;
    if (!files.length) return alert("📁 Please select at least one file.");
    processFiles(files);
};

// ============================================================
// 🔗 NHENTAI URL PROCESSING WITH STREAMING
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
    
    try {
        updateStatus("🔍 Parsing nhentai URL...", 'info');
        
        const formData = new FormData();
        formData.append("url", url);
        formData.append("page_numbers", pageNumbers);
        
        updateStatus("🌐 Connecting to nhentai...", 'info');
        
        // Make sure we're calling the correct endpoint
        const endpoint = `${API_BASE_URL}/process_nhentai_stream`;
        console.log('📡 Calling endpoint:', endpoint);
        
        const response = await fetchWithRetry(endpoint, {
            method: "POST",
            body: formData
        });
        
        if (!response.ok) {
            let errorMsg = `Error: ${response.status}`;
            try {
                const err = await response.json();
                errorMsg = err.detail || err.message || errorMsg;
            } catch (e) {
                errorMsg = response.statusText || errorMsg;
            }
            
            updateStatus(`❌ ${errorMsg}`, 'error');
            
            if (response.status === 503) {
                updateStatus("⏳ Service is starting, please wait 30s and try again.", 'warning');
            } else if (response.status === 405) {
                updateStatus("❌ 405 Method Not Allowed - Check API configuration", 'error');
                console.error('The endpoint does not accept POST requests. Verify your backend is running correctly.');
            }
            
            loadingBarContainer.style.display = "none";
            return;
        }
        
        updateStatus("✅ Successfully connected to nhentai!", 'success');
        
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
                        updateStatus(`📚 Found gallery: "${galleryTitle}" (${totalToProcess} pages to translate)`, 'success');
                        
                    } else if (data.type === "result") {
                        updateStatus(`📖 Page ${data.page}: Translating...`, 'info');
                        
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
                        loadingBar.innerText = `${data.progress}/${totalToProcess}`;
                        
                        updateStatus(`✅ Page ${data.page} completed! (${data.progress}/${totalToProcess})`, 'success');
                        
                    } else if (data.type === "error") {
                        console.error(`Error on page ${data.page}:`, data.message);
                        updateStatus(`⚠️ Error on page ${data.page}: ${data.message}`, 'warning');
                        
                    } else if (data.type === "complete") {
                        updateStatus(`🎉 All done! Successfully translated ${totalToProcess} pages from "${galleryTitle}"`, 'success');
                    }
                    
                } catch (e) {
                    console.error("Error parsing stream data:", e, line);
                }
            }
        }
        
    } catch (e) {
        console.error('Request error:', e);
        updateStatus(`❌ Request failed: ${e.message}`, 'error');
        loadingBarContainer.style.display = "none";
    } finally {
        isProcessing = false;
        processNhentaiBtn.disabled = false;
    }
};

// ============================================================
// 🏥 HEALTH CHECK ON PAGE LOAD
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Manga Translator Frontend Loaded');
    console.log('📡 API Endpoint:', API_BASE_URL);
    
    // Warn if configuration looks wrong
    if (API_BASE_URL.includes('github.io')) {
        console.error('❌ CRITICAL: API_BASE_URL is pointing to GitHub Pages!');
        console.error('This will NOT work. GitHub Pages cannot run Python backends.');
        updateStatus("❌ Configuration Error: API endpoint must point to a backend server (HuggingFace/Railway/Render)", 'error');
        return;
    }
    
    updateStatus("🔍 Checking service status...", 'info');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const testResponse = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (testResponse.ok) {
            const data = await testResponse.json();
            if (data.models_loaded) {
                updateStatus("✅ Service is ready! Upload manga images to start translating.", 'success');
                console.log('✅ Backend is online and models are loaded');
            } else {
                updateStatus("⏳ Models are loading... Please wait a moment.", 'warning');
                console.log('⚠️ Backend is online but models are still loading');
            }
        } else if (testResponse.status === 404) {
            updateStatus("✅ Service is ready! Upload manga images to start translating.", 'success');
            console.log('✅ Backend is online (404 on /health is acceptable)');
        } else {
            updateStatus("⚠️ Service returned unexpected status. Try uploading an image to test.", 'warning');
            console.warn('⚠️ Unexpected status:', testResponse.status);
        }
    } catch (error) {
        console.warn('⚠️ Service check failed:', error.message);
        updateStatus("⏳ Service may be sleeping. First request may take 60 seconds to wake up.", 'warning');
    }
});
