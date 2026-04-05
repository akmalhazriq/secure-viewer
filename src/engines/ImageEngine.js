export class ImageEngine {
    async render(container, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Scale canvas resolution for sharp Retina displays
                const ratio = window.devicePixelRatio || 1;
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                
                // Make the canvas act like a Next.js <Image />
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.objectFit = 'contain'; 
                canvas.style.display = 'block';
                canvas.style.pointerEvents = 'none'; // Extra layer of drag protection
                
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