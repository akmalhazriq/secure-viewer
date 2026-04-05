import { SecurityManager } from './utils/SecurityManager';
import { PdfEngine } from './engines/PdfEngine';
import { ImageEngine } from './engines/ImageEngine';

export class ViewerCore {
    constructor(config) {
        this.container = document.querySelector(config.selector);
        this.url = config.url;
        this.type = config.type || 'pdf'; // 'pdf' or 'image'
        
        if (!this.container) throw new Error(`Container ${config.selector} not found.`);

        this.initUI();
        new SecurityManager(this.container);
        this.loadContent();
    }

    initUI() {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.minHeight = '400px';
        this.container.style.overflowY = 'auto';
        this.container.style.backgroundColor = '#f3f4f6';
        this.container.style.padding = '20px';
        this.container.innerHTML = '<div class="loader">Decrypting Secure Asset...</div>';
    }

    async loadContent() {
        try {
            const engine = this.type === 'pdf' ? new PdfEngine() : new ImageEngine();
            this.container.innerHTML = ''; // Clear loader
            await engine.render(this.container, this.url);
        } catch (error) {
            this.container.innerHTML = `<div style="color:red">Access Denied or Link Expired.</div>`;
        }
    }
}