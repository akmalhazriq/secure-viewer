export class PdfEngine {
    async render(container, url) {
        // 1. Dynamically load PDF.js so the customer doesn't have to
        await this.loadPdfJs();

        const loadingTask = window.pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            const viewport = page.getViewport({ scale: 1.5 }); // High-res scale
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.width = '100%';
            canvas.style.maxWidth = '800px';
            canvas.style.margin = '0 auto 20px auto';
            canvas.style.display = 'block';
            canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            container.appendChild(canvas);
        }
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