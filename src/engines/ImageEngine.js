export class ImageEngine {
    constructor(config) {
        this.config = config || {};
    }

    async render(container, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            img.onload = () => {
                // Check what security settings the user chose
                const blockDragging = this.config.blockDragging !== false;
                const blockRightClick = this.config.blockRightClick !== false;

                // SCENARIO 1: They turned off security. Use a native <img> tag!
                if (!blockDragging && !blockRightClick) {
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    img.style.display = 'block';
                    
                    container.appendChild(img);
                    resolve();
                    return; // Stop here, we don't need a canvas.
                }

                // SCENARIO 2: Security is ON. Paint to a Canvas.
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const ratio = window.devicePixelRatio || 1;
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.objectFit = 'contain'; 
                canvas.style.display = 'block';
                
                // If they want dragging blocked, we make the canvas untouchable
                if (blockDragging) {
                    canvas.style.pointerEvents = 'none'; 
                }
                
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