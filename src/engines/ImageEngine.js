export class ImageEngine {
    async render(container, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Required for signed URLs
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Scale canvas to device pixel ratio for sharp Retina displays
                const ratio = window.devicePixelRatio || 1;
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                canvas.style.width = '100%';
                canvas.style.maxWidth = `${img.width}px`;
                
                ctx.scale(ratio, ratio);
                ctx.drawImage(img, 0, 0);
                
                container.appendChild(canvas);
                resolve();
            };
            
            img.onerror = () => reject(new Error("Failed to load secure image."));
            img.src = url;
        });
    }
}