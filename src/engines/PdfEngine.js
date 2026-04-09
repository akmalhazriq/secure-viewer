export class PdfEngine {
    constructor(config) {
        this.config = config || {};
        this.scale = 1.5; 
        this.canvases = []; 
        this.thumbnails = {};
    }

    async render(container, url) {
        await this.loadPdfJs();

        const isHeadless = this.config.headless !== false; 
        const allowActions = this.config.blockShortcuts === false;
        const showSidebar = this.config.sidebar === true;

        if (!isHeadless) {
            const toolbar = this.createToolbar(url, allowActions);
            container.appendChild(toolbar);
        }

        const bodyWrap = document.createElement('div');
        bodyWrap.style.display = 'flex';
        bodyWrap.style.flexDirection = 'row';
        bodyWrap.style.flex = '1 1 0'; // Crucial: Allows it to shrink and grow inside container
        bodyWrap.style.minHeight = '0'; // Crucial: Prevents infinite stretching
        bodyWrap.style.overflow = 'hidden';
        bodyWrap.style.width = '100%';
        container.appendChild(bodyWrap);

        let sidebarDiv = null;
        if (showSidebar && !isHeadless) {
            sidebarDiv = document.createElement('div');
            sidebarDiv.style.width = '200px';
            sidebarDiv.style.backgroundColor = '#2b2b2b'; 
            sidebarDiv.style.borderRight = '1px solid #111';
            sidebarDiv.style.overflowY = 'auto'; // Independent Scrollbar
            sidebarDiv.style.flexShrink = '0';
            sidebarDiv.style.padding = '10px 0';
            sidebarDiv.style.scrollbarWidth = 'thin';
            sidebarDiv.style.scrollbarColor = '#666 #2b2b2b';
            bodyWrap.appendChild(sidebarDiv);
        }

        const viewerArea = document.createElement('div');
        viewerArea.style.flexGrow = '1'; 
        viewerArea.style.overflowY = 'auto'; // Independent Scrollbar
        viewerArea.style.backgroundColor = '#525659';
        viewerArea.style.padding = '20px';
        viewerArea.style.position = 'relative'; 
        bodyWrap.appendChild(viewerArea);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // If the page is at least 40% visible on screen
                if (entry.isIntersecting) {
                    const activePageNum = parseInt(entry.target.dataset.pageNumber);
                    this.setActiveThumbnail(activePageNum);
                }
            });
        }, { root: viewerArea, threshold: 0.4 });

        const loadingTask = window.pdfjsLib.getDocument(url);
        this.pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= this.pdf.numPages; pageNum++) {
            const page = await this.pdf.getPage(pageNum);
            
            // --- NEW: Create a wrapper for the Canvas AND the Text Layer ---
            const pageWrapper = document.createElement('div');
            pageWrapper.style.position = 'relative';
            pageWrapper.style.margin = '0 auto 20px auto';
            pageWrapper.dataset.pageNumber = pageNum;
            
            observer.observe(pageWrapper);
            
            const canvas = document.createElement('canvas');
            pageWrapper.appendChild(canvas);
            
            // --- NEW: Create the Text Layer container ---
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer'; // pdf.js looks for this class
            textLayerDiv.style.position = 'absolute';
            textLayerDiv.style.top = '0';
            textLayerDiv.style.left = '0';
            textLayerDiv.style.right = '0';
            textLayerDiv.style.bottom = '0';
            textLayerDiv.style.overflow = 'hidden';
            // Make the text transparent so we only see the canvas below it!
            textLayerDiv.style.opacity = '0.2'; // Set to 0.2 while testing so you can see it working, set to 0.0 for production
            textLayerDiv.style.lineHeight = '1.0';
            
            pageWrapper.appendChild(textLayerDiv);
            viewerArea.appendChild(pageWrapper);
            
            this.canvases.push({ page, canvas, textLayerDiv, pageWrapper });
            
            await this.renderPage(page, canvas, textLayerDiv, pageWrapper);

            if (sidebarDiv) {
                await this.renderThumbnail(page, pageNum, sidebarDiv, viewerArea, pageWrapper);
            }
        }

        if (showSidebar) this.setActiveThumbnail(1);
    }

    async renderPage(page, canvas, textLayerDiv, pageWrapper) {
        const viewport = page.getViewport({ scale: this.scale });
        const ctx = canvas.getContext('2d');
        
        // 1. Size everything to match the viewport exactly
        const cssWidth = `${viewport.width}px`;
        const cssHeight = `${viewport.height}px`;
        
        pageWrapper.style.width = cssWidth;
        pageWrapper.style.height = cssHeight;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        canvas.style.backgroundColor = 'white';

        // 2. Render the Canvas (Pixels)
        const renderContext = { canvasContext: ctx, viewport: viewport };
        await page.render(renderContext).promise;

        // 3. Render the Text Layer (HTML Spans)
        if (this.config.searchable) {
            textLayerDiv.innerHTML = ''; 
            
            textLayerDiv.style.width = cssWidth;
            textLayerDiv.style.height = cssHeight;
            textLayerDiv.style.setProperty('--scale-factor', viewport.scale);
            
            textLayerDiv.style.color = 'transparent'; 
            textLayerDiv.style.userSelect = 'none'; 
            textLayerDiv.style.pointerEvents = 'none'; 
            textLayerDiv.style.webkitUserSelect = 'none'; 

            const textContent = await page.getTextContent();
            
            window.pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            });
        } else {
            // If searchable is false, ensure the text layer is completely hidden and empty
            textLayerDiv.style.display = 'none';
        }
    }

    async renderThumbnail(page, pageNum, sidebarDiv, viewerArea, targetPageWrapper) {
        const viewport = page.getViewport({ scale: 0.2 }); 
        
        const thumbContainer = document.createElement('div');
        thumbContainer.style.padding = '10px 20px';
        thumbContainer.style.margin = '0 10px 10px 10px';
        thumbContainer.style.textAlign = 'center';
        thumbContainer.style.color = '#fff';
        thumbContainer.style.fontFamily = 'sans-serif';
        thumbContainer.style.fontSize = '12px';
        thumbContainer.style.cursor = 'pointer';
        // NEW: Border properties for the active blue outline
        thumbContainer.style.border = '2px solid transparent'; 
        thumbContainer.style.borderRadius = '6px';
        thumbContainer.style.transition = 'all 0.2s ease-in-out';
        
        thumbContainer.onmouseover = () => {
            if (thumbContainer.style.borderColor === 'transparent') {
                thumbContainer.style.backgroundColor = '#3c3c3c';
            }
        };
        thumbContainer.onmouseout = () => {
            if (thumbContainer.style.borderColor === 'transparent') {
                thumbContainer.style.backgroundColor = 'transparent';
            }
        };

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.maxWidth = '120px'; 
        canvas.style.marginBottom = '8px';
        canvas.style.border = '1px solid #000';
        canvas.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        canvas.style.backgroundColor = 'white';

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        // Click to scroll
        thumbContainer.onclick = () => {
            this.setActiveThumbnail(pageNum); // Instantly set active state
            viewerArea.scrollTo({
                top: targetPageWrapper.offsetTop - viewerArea.offsetTop,
                behavior: 'smooth'
            });
        };

        thumbContainer.appendChild(canvas);
        thumbContainer.appendChild(document.createTextNode(`${pageNum}`));
        
        sidebarDiv.appendChild(thumbContainer);
        
        // NEW: Save it to our dictionary so the observer can find it later
        this.thumbnails[pageNum] = thumbContainer; 
    }

    // --- NEW: The method that handles the blue outline ---
    setActiveThumbnail(activePageNum) {
        Object.keys(this.thumbnails).forEach(key => {
            const thumb = this.thumbnails[key];
            if (parseInt(key) === activePageNum) {
                // Turn on the blue outline
                thumb.style.borderColor = '#007bff';
                thumb.style.backgroundColor = '#3c3c3c';
                
                // Auto-scroll the sidebar so the active thumbnail is always visible!
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                // Turn off the blue outline
                thumb.style.borderColor = 'transparent';
                thumb.style.backgroundColor = 'transparent';
            }
        });
    }

    createToolbar(url, allowActions) {
        const bar = document.createElement('div');
        bar.style.height = '50px';
        bar.style.backgroundColor = '#323639';
        bar.style.display = 'flex';
        bar.style.alignItems = 'center';
        bar.style.justifyContent = 'center';
        bar.style.gap = '15px';
        bar.style.color = 'white';
        bar.style.fontFamily = 'sans-serif';
        bar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        bar.style.zIndex = '10';

        // --- ZOOM CONTROLS ---
        const btnStyle = "padding: 6px 12px; cursor: pointer; border: none; border-radius: 4px; background: #525659; color: white; font-weight: bold;";
        
        const zoomOut = document.createElement('button');
        zoomOut.innerText = '-';
        zoomOut.style.cssText = btnStyle;
        zoomOut.onclick = () => this.zoom(-0.25);

        const zoomIn = document.createElement('button');
        zoomIn.innerText = '+';
        zoomIn.style.cssText = btnStyle;
        zoomIn.onclick = () => this.zoom(0.25);

        bar.appendChild(zoomOut);
        bar.appendChild(document.createTextNode('Zoom'));
        bar.appendChild(zoomIn);

        // --- CONDITIONAL ACTION BUTTONS ---
        if (allowActions) {
            const divider = document.createElement('div');
            divider.style.width = '1px';
            divider.style.height = '25px';
            divider.style.backgroundColor = '#666';
            bar.appendChild(divider);

            // Download Button
            const downloadBtn = document.createElement('button');
            downloadBtn.innerText = 'Download';
            downloadBtn.style.cssText = btnStyle + " background: #007bff;";
            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = 'document.pdf';
                a.click();
            };
            bar.appendChild(downloadBtn);

            // Print Button (Opens PDF in a new tab where browser handles printing natively)
            const printBtn = document.createElement('button');
            printBtn.innerText = 'Print';
            printBtn.style.cssText = btnStyle;
            printBtn.onclick = () => {
                window.open(url, '_blank'); 
            };
            bar.appendChild(printBtn);
        }

        const searchContainer = document.createElement('div');
        searchContainer.style.marginLeft = 'auto'; // Pushes it to the far right
        searchContainer.style.display = 'flex';
        searchContainer.style.alignItems = 'center';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        searchInput.style.cssText = "padding: 6px 10px; border-radius: 4px; border: none; outline: none; width: 200px; background: #1e1e1e; color: white;";
        
        // Trigger search as the user types
        searchInput.oninput = (e) => this.performSearch(e.target.value);

        searchContainer.appendChild(searchInput);
        bar.appendChild(searchContainer);

        // --- NEW: HIJACK NATIVE CTRL+F ---
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault(); // Stop the browser's default search popup
                searchInput.focus(); // Focus our custom search bar instead!
            }
        });

        return bar;
    }

    performSearch(query) {
        const searchTerm = query.toLowerCase().trim();

        // Loop through every page's text layer
        this.canvases.forEach(({ textLayerDiv }) => {
            // Get all the individual text spans pdf.js created
            const spans = textLayerDiv.querySelectorAll('span');

            spans.forEach(span => {
                // Save the original raw text the first time we touch the span
                if (span.dataset.originalText === undefined) {
                    span.dataset.originalText = span.textContent;
                }

                const originalText = span.dataset.originalText;

                // If search is empty, just reset the text to normal
                if (!searchTerm) {
                    span.innerHTML = originalText;
                    return;
                }

                // If we find a match, wrap the exact word in a yellow highlight
                if (originalText.toLowerCase().includes(searchTerm)) {
                    // Use regex to find the word while keeping original casing
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    
                    // Notice the style: yellow background, but transparent text so the canvas shows through!
                    const highlightedHTML = originalText.replace(
                        regex, 
                        '<mark style="background-color: rgba(255, 255, 0, 0.5); color: transparent; border-radius: 2px;">$1</mark>'
                    );
                    span.innerHTML = highlightedHTML;
                } else {
                    // Reset if it doesn't match the new query
                    span.innerHTML = originalText;
                }
            });
        });
    }

    zoom(delta) {
        this.scale = Math.max(0.5, Math.min(3.0, this.scale + delta));
        
        this.canvases.forEach(({ page, canvas, textLayerDiv, pageWrapper }) => {
            this.renderPage(page, canvas, textLayerDiv, pageWrapper);
        });
    }

    loadPdfJs() {
        return new Promise((resolve) => {
            if (window.pdfjsLib) return resolve();
            
            // We need to load the main library AND the CSS file for the text layer
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css';
            document.head.appendChild(css);
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            document.head.appendChild(script);
        });
    }
}