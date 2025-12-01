// ============================================================
// 🔧 API CONFIGURATION
// ============================================================
// This is your HuggingFace Space URL where the translation API runs
const API_BASE_URL = 'https://Lucky4000u-manga-translator.hf.space';

// Retry settings for handling Space wake-up and network issues
const MAX_RETRIES = 3;           // Try up to 3 times if request fails
const RETRY_DELAY = 3000;        // Wait 3 seconds between retries

// ============================================================
// 🔄 SMART FETCH FUNCTION WITH AUTO-RETRY
// ============================================================
// This function automatically retries failed requests and shows progress
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    for (let i = 0; i <= retries; i++) {
        try {
            // Create timeout controller to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
            
            // Make the actual request
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // If successful or this is our last retry, return the response
            if (response.ok || (response.status !== 503 && i === retries)) {
                return response;
            }
            
            // If Space is sleeping (503 error), retry with longer delay
            if (response.status === 503 && i < retries) {
                updateStatus(`⏳ Space is waking up... Please wait (Attempt ${i + 2}/${retries + 1})`, 'warning');
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
                continue;
            }
            
            return response;
            
        } catch (error) {
            // Handle timeout errors
            if (error.name === 'AbortError') {
                console.error('Request timeout');
                if (i === retries) {
                    throw new Error('Request timed out after 3 minutes');
                }
            } else if (i === retries) {
                throw new Error(`Failed after ${retries + 1} attempts: ${error.message}`);
            }
            
            // Show retry message
            updateStatus(`⏳ Connection failed, retrying... (Attempt ${i + 1}/${retries + 1})`, 'warning');
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
        }
    }
}

// ============================================================
// 📱 DOM ELEMENT REFERENCES
// ============================================================
// Get references to all HTML elements we'll interact with
const fileInput = document.getElementById("file");
const processBtn = document.getElementById("processBtn");
const nhentaiUrlInput = document.getElementById("nhentaiUrl");
const pageNumbersInput = document.getElementById("pageNumbers");
const processNhentaiBtn = document.getElementById("processNhentaiBtn");
const status = document.getElementById("status");
const resultContainer = document.getElementById("resultContainer");
const loadingBarContainer = document.getElementById("loadingBarContainer");
const loadingBar = document.getElementById("loadingBar");

// Overlay viewer elements (for fullscreen image viewing)
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
let overlayImages = [];        // Array of all translated images
let currentIndex = 0;          // Current image index in overlay
let zoom = 1.0;               // Current zoom level
let isOverImage = false;      // Mouse is over the image
let isProcessing = false;     // Currently processing images
let zoomTimeout = null;       // Timeout for hiding zoom indicator
let originalImageWidth = 0;
let originalImageHeight = 0;

// ============================================================
// 📊 STATUS UPDATE HELPER
// ============================================================
// Updates the status message with optional styling
function updateStatus(message, type = 'info') {
    status.innerText = message;
    status.style.display = "block";
    
    // Apply color based on message type
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

// Show the zoom level indicator temporarily
function showZoomIndicator() {
    zoomIndicator.classList.add('visible');
    clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
        zoomIndicator.classList.remove('visible');
    }, 2000);
}

// Update zoom indicator text
function updateZoomIndicator() {
    zoomIndicator.textContent = Math.round(zoom * 100) + '%';
    showZoomIndicator();
}

// Update page indicator (e.g., "Page 1/5")
function updatePageIndicator() {
    pageIndicator.textContent = `Page ${currentIndex + 1}/${overlayImages.length}`;
}

// Apply zoom transformation to image
function updateZoom() {
    if (originalImageWidth === 0) return;

    // 1. Calculate the new image dimensions based on zoom
    const newImgWidth = originalImageWidth * zoom;
    const newImgHeight = originalImageHeight * zoom;

    // 2. Apply dimensions ONLY to the IMAGE
    // The imageWrapper will automatically resize to fit the image PLUS the 100px CSS padding.
    overlayImg.style.width = `${newImgWidth}px`;
    overlayImg.style.height = `${newImgHeight}px`;

    // 3. Reset imageWrapper to default flow (no need to set width/height explicitly anymore)
    imageWrapper.style.width = `auto`; 
    imageWrapper.style.height = `auto`; 

    // 4. Update UI
    updateZoomIndicator();
}

// ============================================================
// 🖼️ FULLSCREEN OVERLAY VIEWER
// ============================================================

// Open overlay with specific image
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
        
        // Responsive initial fit:
        // Use window.innerWidth/Height and subtract the CSS padding (2 * 100px = 200px)
        const availableWidth = window.innerWidth - 100; // Assuming 50px left/right padding
        const availableHeight = window.innerHeight - 200; // Assuming 100px top/bottom padding

        // ... (The rest of your zoom/ratio calculation logic remains the same, 
        // using availableWidth/Height for the initial fit calculation) ...

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

// Close overlay
closeBtn.onclick = () => {
    overlay.style.display = "none";
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
};

// Show previous image
function showPrev() {
    if (currentIndex > 0) {
        currentIndex--;
        overlayImg.src = overlayImages[currentIndex].src;
        updatePageIndicator();
        overlayImg.onload = () => updateZoom();
    }
}

// Show next image
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

// Track mouse position for zoom functionality
overlayImg.addEventListener("mouseenter", () => { isOverImage = true; });
overlayImg.addEventListener("mouseleave", () => { isOverImage = false; });

// Zoom with mouse wheel
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

// Keyboard controls for overlay
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

// Reset zoom on double-click
overlayImg.addEventListener("dblclick", () => {
    zoom = 1.5;
    updateZoom();
});

// ============================================================
// 📤 IMAGE UPLOAD PROCESSING
// ============================================================
// Process images uploaded directly from user's device
async function processFiles(files) {
    // Prevent multiple simultaneous processing
    if (isProcessing) {
        alert("⏳ Already processing! Please wait...");
        return;
    }
    
    // Set processing state
    isProcessing = true;
    processBtn.disabled = true;
    
    // Reset UI
    resultContainer.innerHTML = "";
    overlayImages = [];
    loadingBarContainer.style.display = "block";
    status.style.display = "block";
    loadingBar.style.width = "0%";
    loadingBar.innerText = "0%";
    
    updateStatus("🚀 Initializing translator...", 'info');

    // Process each file sequentially
    for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append("file", files[i]);

        try {
            // Step 1: Uploading
            updateStatus(`📤 Uploading image ${i + 1}/${files.length}...`, 'info');
            
            // Step 2: Connecting to API
            updateStatus(`🔗 Connecting to translation service...`, 'info');
            
            const res = await fetchWithRetry(`${API_BASE_URL}/process`, {
                method: "POST",
                body: form
            });

            // Step 3: Check response
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
                }
                continue;
            }

            // Step 4: Processing response
            updateStatus(`⚙️ Processing image ${i + 1}/${files.length}...`, 'info');
            
            // Step 5: Detecting text boxes
            updateStatus(`🔍 Detecting text boxes in image...`, 'info');
            
            // Step 6: OCR in progress
            updateStatus(`📝 Reading Japanese text...`, 'info');
            
            // Step 7: Translation
            updateStatus(`🌐 Translating to English...`, 'info');
            
            const data = await res.json();

            // Step 8: Rendering result
            if (data.result_image) {
                updateStatus(`🎨 Rendering translated image ${i + 1}/${files.length}...`, 'info');
                
                // Create result card
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

                // Animate result card
                setTimeout(() => {
                    div.style.transition = "all 0.3s ease";
                    div.style.opacity = "1";
                    div.style.transform = "scale(1)";
                }, 10);

                // Add to overlay viewer
                overlayImages.push(img);
                div.onclick = () => openOverlay(overlayImages.indexOf(img));
                
                updateStatus(`✅ Image ${i + 1}/${files.length} completed!`, 'success');
            }

            // Update progress bar
            const percent = Math.round(((i + 1) / files.length) * 100);
            loadingBar.style.width = percent + "%";
            loadingBar.innerText = percent + "%";

        } catch (e) {
            console.error('Processing error:', e);
            updateStatus(`❌ Request failed: ${e.message}`, 'error');
        }
    }

    // All done!
    updateStatus(`✅ All done! Successfully translated ${files.length} image(s).`, 'success');
    isProcessing = false;
    processBtn.disabled = false;
}

// Attach click handler to process button
processBtn.onclick = () => {
    const files = fileInput.files;
    if (!files.length) return alert("📁 Please select at least one file.");
    processFiles(files);
};

// ============================================================
// 🔗 NHENTAI URL PROCESSING WITH STREAMING
// ============================================================
// Process manga pages from nhentai gallery URL with real-time updates
processNhentaiBtn.onclick = async () => {
    // Prevent multiple simultaneous processing
    if (isProcessing) {
        alert("⏳ Already processing! Please wait...");
        return;
    }
    
    const url = nhentaiUrlInput.value.trim();
    const pageNumbers = pageNumbersInput.value.trim() || "all";
    
    if (!url) return alert("🔗 Please enter a nhentai URL.");
    
    // Set processing state
    isProcessing = true;
    processNhentaiBtn.disabled = true;
    
    // Reset UI
    resultContainer.innerHTML = "";
    overlayImages = [];
    loadingBarContainer.style.display = "block";
    status.style.display = "block";
    loadingBar.style.width = "0%";
    loadingBar.innerText = "0%";
    
    try {
        // Step 1: Parse URL
        updateStatus("🔍 Parsing nhentai URL...", 'info');
        
        const formData = new FormData();
        formData.append("url", url);
        formData.append("page_numbers", pageNumbers);
        
        // Step 2: Fetch gallery info
        updateStatus("🌐 Connecting to nhentai...", 'info');
        
        const response = await fetchWithRetry(`${API_BASE_URL}/process_nhentai_stream`, {
            method: "POST",
            body: formData
        });
        
        // Check response
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
            }
            
            loadingBarContainer.style.display = "none";
            return;
        }
        
        updateStatus("✅ Successfully connected to nhentai!", 'success');
        
        // Step 3: Stream processing results
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
                    
                    // Handle different message types
                    if (data.type === "info") {
                        galleryTitle = data.title;
                        totalToProcess = data.pages_to_process;
                        updateStatus(`📚 Found gallery: "${galleryTitle}" (${totalToProcess} pages to translate)`, 'success');
                        
                    } else if (data.type === "result") {
                        // Page successfully translated
                        updateStatus(`📖 Page ${data.page}: Downloading from nhentai...`, 'info');
                        
                        // Create result card
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
                        
                        // Animate result card
                        setTimeout(() => {
                            div.style.transition = "all 0.3s ease";
                            div.style.opacity = "1";
                            div.style.transform = "scale(1)";
                        }, 10);
                        
                        overlayImages.push(img);
                        div.onclick = () => openOverlay(overlayImages.indexOf(img));
                        
                        // Update progress
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
// Check if the translation service is ready when page loads
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Manga Translator Frontend Loaded');
    console.log('📡 API Endpoint:', API_BASE_URL);
    
    updateStatus("🔍 Checking service status...", 'info');
    
    try {
        // Test connection with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const testResponse = await fetch(`${API_BASE_URL}/`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (testResponse.ok) {
            updateStatus("✅ Service is ready! Upload manga images to start translating.", 'success');
            console.log('✅ HuggingFace Space is online and ready');
        } else if (testResponse.status === 404) {
            // 404 is actually OK - means the Space is running but /health endpoint doesn't exist
            updateStatus("✅ Service is ready! Upload manga images to start translating.", 'success');
            console.log('✅ HuggingFace Space is online (404 on / is normal)');
        } else {
            updateStatus("⚠️ Service is starting up. Please wait...", 'warning');
            console.warn('⚠️ Unexpected status:', testResponse.status);
        }
    } catch (error) {
        console.warn('⚠️ Service check failed:', error.message);
        updateStatus("⏳ Service may be sleeping. First request may take 60 seconds to wake up.", 'warning');
    }
});





