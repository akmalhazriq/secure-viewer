import { SecurityManager } from './utils/SecurityManager';
import { PdfEngine } from './engines/PdfEngine';
import { ImageEngine } from './engines/ImageEngine';

export class ViewerCore {
    constructor(config) {
        this.container = document.querySelector(config.selector);
        this.url = config.url;
        this.type = config.type || 'pdf'; 
        
        if (!this.container) throw new Error(`Container ${config.selector} not found.`);

        this.initUI();
        
        // Pass all security configuration down to the manager
        new SecurityManager(this.container, { 
            blurOnUnfocus: config.blurOnUnfocus,
            blockRightClick: config.blockRightClick,
            blockDragging: config.blockDragging,
            blockShortcuts: config.blockShortcuts
        });
        
        this.loadContent();
    }

    initUI() {
        this.container.style.position = 'relative';
        
        if (this.type === 'pdf') {
            this.container.style.width = '100%';
            this.container.style.height = '100%';
            this.container.style.minHeight = '400px';
            this.container.style.overflowY = 'auto';
            this.container.style.backgroundColor = '#525659';
            this.container.style.padding = '20px';
        } else {
            this.container.style.overflow = 'hidden';
            this.container.style.display = 'flex';
            this.container.style.justifyContent = 'center';
            this.container.style.alignItems = 'center';
        }

        this.container.innerHTML = '<div style="font-family: sans-serif; padding: 20px;">Loading...</div>';
    }

    async loadContent() {
        try {
            const engine = this.type === 'pdf' ? new PdfEngine() : new ImageEngine();
            this.container.innerHTML = ''; 
            await engine.render(this.container, this.url);
        } catch (error) {
            this.container.innerHTML = `<div style="color:red; padding: 20px;">Failed to load asset.</div>`;
        }
    }
}