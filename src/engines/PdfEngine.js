export class PdfEngine {
    constructor(config) {
        this.config = config || {};
        this.scale = 1.5; // Default zoom scale
        this.canvases = []; // Keep track of canvases so we can zoom them later
    }

    async render(container, url) {
        await this.loadPdfJs();

        // Check settings: Default headless to TRUE if not specified
        const isHeadless = this.config.headless !== false; 
        
        // If they turned off shortcut blocking, we allow downloading!
        const allowActions = this.config.blockShortcuts === false;

        // 1. Create the Toolbar (if not headless)
        if (!isHeadless) {
            const toolbar = this.createToolbar(url, allowActions);
            container.appendChild(toolbar);
        }

        // 2. Create the scrolling Document Area
        const viewerArea = document.createElement('div');
        viewerArea.style.width = '100%';
        viewerArea.style.flexGrow = '1'; // Takes up remaining space below toolbar
        viewerArea.style.overflowY = 'auto';
        viewerArea.style.backgroundColor = '#525659';
        viewerArea.style.padding = '20px';
        container.appendChild(viewerArea);

        // 3. Load and Render the PDF
        const loadingTask = window.pdfjsLib.getDocument(url);
        this.pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= this.pdf.numPages; pageNum++) {
            const page = await this.pdf.getPage(pageNum);
            const canvas = document.createElement('canvas');
            
            this.canvases.push({ page, canvas });
            viewerArea.appendChild(canvas);
            
            this.renderPage(page, canvas);
        }
    }

    renderPage(page, canvas) {
        const viewport = page.getViewport({ scale: this.scale });
        const ctx = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        canvas.style.width = '100%';
        canvas.style.maxWidth = `${viewport.width}px`;
        canvas.style.margin = '0 auto 20px auto';
        canvas.style.display = 'block';
        canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        canvas.style.backgroundColor = 'white';

        page.render({ canvasContext: ctx, viewport: viewport });
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
        // Prevent zooming too far in or out
        this.scale = Math.max(0.5, Math.min(3.0, this.scale + delta));
        
        // Re-render all canvases at the new scale
        this.canvases.forEach(({ page, canvas }) => {
            this.renderPage(page, canvas);
        });
    }

    loadPdfJs() {
        return new Promise((resolve) => {
            if (window.pdfjsLib) return resolve();
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