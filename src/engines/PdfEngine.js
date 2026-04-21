import { Decryptor } from '../utils/Decryptor.js';

export class PdfEngine {
    constructor(config) {
        this.config = config || {};
        this.scale = 1.5; 
        this.canvases = []; 
        this.thumbnails = {};
    }

    async render(container, source, documentKey = null) {
        await this.loadPdfJs();

        let documentConfig = typeof source === 'string' ? { url: source } : { data: source };
        let loadingTask = window.pdfjsLib.getDocument(documentConfig);
        this.pdf = await loadingTask.promise;

        try {
            const attachments = await this.pdf.getAttachments();
            
            if (attachments && attachments['secure_vault.enc']) {
                console.log("🔒 Secured Vault Detected! Attempting decryption in RAM...");
                
                if (!documentKey) {
                    console.warn("No Decryption Key provided. Falling back to the Decoy page.");
                } else {
                    const encryptedPayload = attachments['secure_vault.enc'].content;
                    const decryptedBytes = await Decryptor.unlockVault(encryptedPayload, documentKey);
                    
                    await this.pdf.destroy(); 
                    
                    loadingTask = window.pdfjsLib.getDocument({ data: decryptedBytes });
                    this.pdf = await loadingTask.promise;
                    console.log("🔓 Decryption Successful! Rendering crisp document.");
                    
                    source = null; 
                }
            }
        } catch (error) {
            console.error("Interception Error:", error);
            if (error.message && error.message.includes("UNAUTHORIZED")) {
                container.innerHTML = `<div style="color:red; padding:20px;">${error.message}</div>`;
                return;
            }
        }

        const isHeadless = this.config.headless !== false; 
        const allowActions = this.config.blockShortcuts === false;
        const showSidebar = this.config.sidebar === true;

        if (!isHeadless) {
            // FIX: Changed 'url' to 'source' here!
            const toolbar = this.createToolbar(source, allowActions);
            container.appendChild(toolbar);
        }

        const bodyWrap = document.createElement('div');
        bodyWrap.style.display = 'flex';
        bodyWrap.style.flexDirection = 'row';
        bodyWrap.style.flex = '1 1 0'; 
        bodyWrap.style.minHeight = '0'; 
        bodyWrap.style.overflow = 'hidden';
        bodyWrap.style.width = '100%';
        container.appendChild(bodyWrap);

        let sidebarDiv = null;
        if (showSidebar && !isHeadless) {
            sidebarDiv = document.createElement('div');
            sidebarDiv.style.width = '200px';
            sidebarDiv.style.backgroundColor = '#2b2b2b'; 
            sidebarDiv.style.borderRight = '1px solid #111';
            sidebarDiv.style.overflowY = 'auto'; 
            sidebarDiv.style.flexShrink = '0';
            sidebarDiv.style.padding = '10px 0';
            sidebarDiv.style.scrollbarWidth = 'thin';
            sidebarDiv.style.scrollbarColor = '#666 #2b2b2b';
            bodyWrap.appendChild(sidebarDiv);
        }

        const viewerArea = document.createElement('div');
        viewerArea.style.flexGrow = '1'; 
        viewerArea.style.overflowY = 'auto'; 
        viewerArea.style.backgroundColor = '#525659';
        viewerArea.style.padding = '20px';
        viewerArea.style.position = 'relative'; 
        bodyWrap.appendChild(viewerArea);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const activePageNum = parseInt(entry.target.dataset.pageNumber);
                    this.setActiveThumbnail(activePageNum);
                }
            });
        }, { root: viewerArea, threshold: 0.4 });

        for (let pageNum = 1; pageNum <= this.pdf.numPages; pageNum++) {
            const page = await this.pdf.getPage(pageNum);
            
            const pageWrapper = document.createElement('div');
            pageWrapper.style.position = 'relative';
            pageWrapper.style.margin = '0 auto 20px auto';
            pageWrapper.dataset.pageNumber = pageNum;
            
            observer.observe(pageWrapper);
            
            const canvas = document.createElement('canvas');
            pageWrapper.appendChild(canvas);
            
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer'; 
            textLayerDiv.style.position = 'absolute';
            textLayerDiv.style.top = '0';
            textLayerDiv.style.left = '0';
            textLayerDiv.style.right = '0';
            textLayerDiv.style.bottom = '0';
            textLayerDiv.style.overflow = 'hidden';
            textLayerDiv.style.opacity = '0.2'; 
            textLayerDiv.style.lineHeight = '1.0';
            
            pageWrapper.appendChild(textLayerDiv);
            viewerArea.appendChild(pageWrapper);
            
            this.canvases.push({ page, canvas, textLayerDiv, pageWrapper });
            
            await this.renderPage(page, canvas, textLayerDiv, pageWrapper);

            if (sidebarDiv) {
                // FIX: Get a fresh page instance for the thumbnail to prevent RAM lockups
                const thumbPage = await this.pdf.getPage(pageNum);
                await this.renderThumbnail(thumbPage, pageNum, sidebarDiv, viewerArea, pageWrapper);
            }
        }

        if (showSidebar) this.setActiveThumbnail(1);
    }

    async renderPage(page, canvas, textLayerDiv, pageWrapper) {
        const viewport = page.getViewport({ scale: this.scale });
        const ctx = canvas.getContext('2d');
        
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

        const renderContext = { canvasContext: ctx, viewport: viewport };
        await page.render(renderContext).promise;

        if (this.config.watermark) {
            const wmOpts = this.config.watermarkOptions || {};
            const wmType = wmOpts.type || 'merged'; // 'merged' or 'layer'

            if (wmType === 'merged') {
                await this.drawMergedWatermark(ctx, viewport.width, viewport.height, wmOpts);
            } else if (wmType === 'layer') {
                this.createLayerWatermark(pageWrapper, wmOpts);
            }
        }

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
            textLayerDiv.style.display = 'none';
        }
    }

    async drawMergedWatermark(ctx, width, height, opts) {
        ctx.save();
        // Move to center and rotate 45 degrees
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 4); 
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.15; // Set opacity so we can read the text underneath

        let currentY = 0;

        // 1. Draw Image
        if (opts.image) {
            try {
                const img = await this.loadImage(opts.image);
                const imgWidth = 150; 
                const imgHeight = (img.height / img.width) * imgWidth;
                ctx.drawImage(img, -imgWidth / 2, currentY - imgHeight, imgWidth, imgHeight);
                currentY += 40; 
            } catch (e) {
                console.warn("Failed to load watermark image for Canvas");
            }
        }

        // 2. Draw Header (Defaults to 'CONFIDENTIAL')
        const header = opts.header || 'CONFIDENTIAL';
        ctx.font = 'bold 80px sans-serif';
        ctx.fillStyle = 'black'; 
        ctx.fillText(header, 0, currentY);
        currentY += 60;

        // 3. Draw Paragraph
        if (opts.paragraph) {
            ctx.font = '30px sans-serif';
            ctx.fillText(opts.paragraph, 0, currentY);
        }

        ctx.restore();
    }

    createLayerWatermark(wrapper, opts) {
        const wm = document.createElement('div');
        wm.style.position = 'absolute';
        wm.style.top = '0';
        wm.style.left = '0';
        wm.style.width = '100%';
        wm.style.height = '100%';
        wm.style.pointerEvents = 'none'; // CRUCIAL: Allows clicking/selecting text through it
        wm.style.zIndex = '50';
        wm.style.display = 'flex';
        wm.style.flexDirection = 'column';
        wm.style.alignItems = 'center';
        wm.style.justifyContent = 'center';
        wm.style.opacity = '0.15';
        wm.style.overflow = 'hidden';

        const inner = document.createElement('div');
        inner.style.transform = 'rotate(-45deg)';
        inner.style.textAlign = 'center';

        if (opts.image) {
            const img = document.createElement('img');
            img.src = opts.image;
            img.style.maxWidth = '150px';
            img.style.marginBottom = '20px';
            inner.appendChild(img);
        }

        const header = document.createElement('div');
        header.innerText = opts.header || 'CONFIDENTIAL';
        header.style.fontSize = '80px';
        header.style.fontWeight = 'bold';
        header.style.color = 'black';
        inner.appendChild(header);

        if (opts.paragraph) {
            const para = document.createElement('div');
            para.innerText = opts.paragraph;
            para.style.fontSize = '30px';
            para.style.color = 'black';
            para.style.marginTop = '10px';
            inner.appendChild(para);
        }

        wm.appendChild(inner);
        wrapper.appendChild(wm);
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
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

        thumbContainer.onclick = () => {
            this.setActiveThumbnail(pageNum); 
            viewerArea.scrollTo({
                top: targetPageWrapper.offsetTop - viewerArea.offsetTop,
                behavior: 'smooth'
            });
        };

        thumbContainer.appendChild(canvas);
        thumbContainer.appendChild(document.createTextNode(`${pageNum}`));
        
        sidebarDiv.appendChild(thumbContainer);
        this.thumbnails[pageNum] = thumbContainer; 
    }

    setActiveThumbnail(activePageNum) {
        Object.keys(this.thumbnails).forEach(key => {
            const thumb = this.thumbnails[key];
            if (parseInt(key) === activePageNum) {
                thumb.style.borderColor = '#007bff';
                thumb.style.backgroundColor = '#3c3c3c';
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                thumb.style.borderColor = 'transparent';
                thumb.style.backgroundColor = 'transparent';
            }
        });
    }

    createToolbar(source, allowActions) {
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
        bar.style.paddingLeft = '20px';
        bar.style.paddingRight = '20px';

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

        // Only render download/print if source is a URL (not RAM bytes)
        if (allowActions && typeof source === 'string') {
            const divider = document.createElement('div');
            divider.style.width = '1px';
            divider.style.height = '25px';
            divider.style.backgroundColor = '#666';
            bar.appendChild(divider);

            const downloadBtn = document.createElement('button');
            downloadBtn.innerText = 'Download';
            downloadBtn.style.cssText = btnStyle + " background: #007bff;";
            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = source;
                a.download = 'document.pdf';
                a.click();
            };
            bar.appendChild(downloadBtn);

            const printBtn = document.createElement('button');
            printBtn.innerText = 'Print';
            printBtn.style.cssText = btnStyle;
            printBtn.onclick = () => {
                window.open(source, '_blank'); 
            };
            bar.appendChild(printBtn);
        }

        const searchContainer = document.createElement('div');
        searchContainer.style.marginLeft = 'auto'; 
        searchContainer.style.display = 'flex';
        searchContainer.style.alignItems = 'center';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        searchInput.style.cssText = "padding: 6px 10px; border-radius: 4px; border: none; outline: none; width: 200px; background: #1e1e1e; color: white;";
        
        searchInput.oninput = (e) => this.performSearch(e.target.value);

        searchContainer.appendChild(searchInput);
        bar.appendChild(searchContainer);

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault(); 
                searchInput.focus(); 
            }
        });

        return bar;
    }

    performSearch(query) {
        const searchTerm = query.toLowerCase().trim();

        this.canvases.forEach(({ textLayerDiv }) => {
            const spans = textLayerDiv.querySelectorAll('span');

            spans.forEach(span => {
                if (span.dataset.originalText === undefined) {
                    span.dataset.originalText = span.textContent;
                }

                const originalText = span.dataset.originalText;

                if (!searchTerm) {
                    span.innerHTML = originalText;
                    return;
                }

                if (originalText.toLowerCase().includes(searchTerm)) {
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    const highlightedHTML = originalText.replace(
                        regex, 
                        '<mark style="background-color: rgba(255, 255, 0, 0.7); color: transparent; border-radius: 2px;">$1</mark>'
                    );
                    span.innerHTML = highlightedHTML;
                } else {
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