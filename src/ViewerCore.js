import { SecurityManager } from './utils/SecurityManager';
import { PdfEngine } from './engines/PdfEngine';
import { ImageEngine } from './engines/ImageEngine';

export class ViewerCore {
    constructor(config) {
        this.config = config; 
        this.container = document.querySelector(config.selector);
        
        this.url = config.url;
        this.documentData = config.documentData; 
        this.decryptionKey = config.decryptionKey;

        this.type = config.type || 'pdf'; 
        this.forceLocation = config.forceLocation === true;
        
        if (this.config.searchable === undefined) {
            this.config.searchable = false; 
        }

        if (!this.container) throw new Error(`Container ${config.selector} not found.`);

        this.initUI();

        this.initializeViewer();
    }

    initUI() {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        
        if (this.type === 'pdf') {
            // Setup for a vertical stack (Toolbar on top, PDF below)
            this.container.style.minHeight = '500px';
            this.container.style.display = 'flex';
            this.container.style.flexDirection = 'column';
            this.container.style.overflow = 'hidden'; 
        } else {
            this.container.style.overflow = 'hidden';
            this.container.style.display = 'flex';
            this.container.style.justifyContent = 'center';
            this.container.style.alignItems = 'center';
        }

        this.container.innerHTML = '<div style="font-family: sans-serif; padding: 20px;">Loading...</div>';
    }

    async initializeViewer() {
        const hasLocationAccess = await this.ensureLocationAccess();
        if (!hasLocationAccess) {
            return;
        }

        this.loadContent();
    }

    async ensureLocationAccess() {
        if (!this.forceLocation) {
            return true;
        }

        if (!navigator.geolocation) {
            this.renderError('Location is required, but geolocation is not supported in this browser.');
            return false;
        }

        try {
            return await new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    () => resolve(true),
                    (error) => {
                        const message = this.getGeolocationErrorMessage(error);
                        this.renderError(message);
                        resolve(false);
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            });
        } catch (error) {   
            this.renderError('Location permission is required to view this content.');
            return false;
        }
    }

    getGeolocationErrorMessage(error) {
        if (!error || typeof error.code !== 'number') {
            return 'Location permission is required to view this content.';
        }

        if (error.code === 1) {
            return 'Location permission was denied. Please allow location access to continue.';
        }

        if (error.code === 2) {
            return 'Unable to detect your location. Please check your device location settings.';
        }

        if (error.code === 3) {
            return 'Location request timed out. Please enable location and try again.';
        }

        return 'Location permission is required to view this content.';
    }

    renderError(message) {
        this.container.innerHTML = `
            <div style="
                box-sizing: border-box;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: #f8fafc;
                font-family: sans-serif;
            ">
                <div style="
                    max-width: 520px;
                    width: 100%;
                    padding: 18px 20px;
                    border-radius: 10px;
                    border: 1px solid #fecaca;
                    background: #fff1f2;
                    color: #9f1239;
                    line-height: 1.45;
                    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
                ">
                    <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">Access required</div>
                    <div style="font-size: 14px;">${message}</div>
                </div>
            </div>
        `;
    }

    async loadContent() {
        try {
            const source = this.documentData || this.url;

            if (!source) {
                this.renderError('Configuration Error: No URL or Document Data was provided.');
                return;
            }

            const engine = this.type === 'pdf' ? new PdfEngine(this.config) : new ImageEngine(this.config);
            this.container.innerHTML = ''; 
            
            await engine.render(this.container, source, this.decryptionKey);

            new SecurityManager(this.container, {
                blurOnUnfocus: this.config.blurOnUnfocus,
                blockRightClick: this.config.blockRightClick,
                blockDragging: this.config.blockDragging,
                blockShortcuts: this.config.blockShortcuts,
                blockScreenshots: this.config.blockScreenshots,
                screenShield: this.config.screenShield
            });
        } catch (error) {
            this.renderError('Failed to load asset.');
        }
    }
}