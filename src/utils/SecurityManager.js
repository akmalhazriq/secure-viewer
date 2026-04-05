export class SecurityManager {
    constructor(container, options = {}) {
        this.container = container;
        
        // Default to TRUE (maximum security) unless explicitly set to false
        this.blockRightClick = options.blockRightClick !== false;
        this.blockDragging = options.blockDragging !== false;
        this.blockShortcuts = options.blockShortcuts !== false;
        this.blurOnUnfocus = options.blurOnUnfocus !== false; 
        
        this.applyFriction();
    }

    applyFriction() {
        // 1. Block Context Menu (Right Click)
        if (this.blockRightClick) {
            this.container.addEventListener('contextmenu', e => e.preventDefault());
        }

        // 2. Block Dragging
        if (this.blockDragging) {
            this.container.addEventListener('dragstart', e => e.preventDefault());
        }

        // 3. Block Keyboard Shortcuts (Print, Save, Copy, Inspect)
        if (this.blockShortcuts) {
            window.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c', 'u', 'i'].includes(e.key.toLowerCase())) {
                    e.preventDefault();
                    console.warn("Security policy restricts this action.");
                }
            });
        }

        // 4. Anti-Screen Recording (Window Blur)
        if (this.blurOnUnfocus) {
            window.addEventListener('blur', () => {
                this.container.style.filter = 'blur(10px)';
                this.container.style.opacity = '0.5';
            });
            window.addEventListener('focus', () => {
                this.container.style.filter = 'none';
                this.container.style.opacity = '1';
            });
        }
    }
}