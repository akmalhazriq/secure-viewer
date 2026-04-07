export class PdfEngine {
    constructor(config) {
        this.config = config || {};
        this.scale = 1.5; 
        this.canvases = []; 
    }

    async render(container, url) {
        await this.loadPdfJs();

        const isHeadless = this.config.headless !== false; 
        const allowActions = this.config.blockShortcuts === false;

        if (!isHeadless) {
            const toolbar = this.createToolbar(url, allowActions);
            container.appendChild(toolbar);
        }

        const viewerArea = document.createElement('div');
        viewerArea.style.width = '100%';
        viewerArea.style.flexGrow = '1'; 
        viewerArea.style.overflowY = 'auto';
        viewerArea.style.backgroundColor = '#525659';
        viewerArea.style.padding = '20px';
        container.appendChild(viewerArea);

        const loadingTask = window.pdfjsLib.getDocument(url);
        this.pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= this.pdf.numPages; pageNum++) {
            const page = await this.pdf.getPage(pageNum);
            
            // --- NEW: Create a wrapper for the Canvas AND the Text Layer ---
            const pageWrapper = document.createElement('div');
            pageWrapper.style.position = 'relative';
            pageWrapper.style.margin = '0 auto 20px auto';
            // The wrapper size will be set inside renderPage()
            
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
        }
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

        // 3. Render the Text Layer (HTML Spans for Ctrl+F)
        textLayerDiv.innerHTML = ''; // Clear old text if zooming
        const textContent = await page.getTextContent();
        
        // Use the pdf.js TextLayerBuilder to map the text coordinates to the DOM
        window.pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
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

        return bar;
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