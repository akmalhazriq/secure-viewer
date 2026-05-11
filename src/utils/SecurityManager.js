export class SecurityManager {
    constructor(container, options = {}) {
        this.container = container;
        
        // Default to TRUE (maximum security) unless explicitly set to false
        this.blockRightClick = options.blockRightClick !== false;
        this.blockDragging = options.blockDragging !== false;
        this.blockShortcuts = options.blockShortcuts !== false;
        this.blurOnUnfocus = options.blurOnUnfocus !== false; 
        this.blockScreenshots = options.blockScreenshots === true;
        this.screenShield = options.screenShield === true;
        
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

        if (this.blockScreenshots) {
            ['keydown', 'keyup'].forEach(eventType => {
                window.addEventListener(eventType, (e) => {
                    const isMac = navigator.userAgent.toLowerCase().includes('mac');
                    const isLinux = navigator.userAgent.toLowerCase().includes('linux');
                    let screenshotAttempted = false;

                    // A. Universal & Linux (PrintScreen)
                    if (e.key === 'PrintScreen') screenshotAttempted = true;
                    
                    // B. Linux Recording
                    if (isLinux && e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') {
                        screenshotAttempted = true;
                    }

                    // C. Windows Snipping & Game Bar
                    if (!isMac) {
                        if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') screenshotAttempted = true;
                        if (e.metaKey && e.altKey && e.key.toLowerCase() === 'r') screenshotAttempted = true;
                    }

                    // D. Mac Screenshot tools
                    if (isMac && e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(e.key)) {
                        screenshotAttempted = true;
                    }

                    if (screenshotAttempted) {
                        e.preventDefault();
                        this.triggerLockdown();
                    }
                });
            });
        }

        if (this.screenShield) {
            const curtain = document.createElement('div');
        
            // Create an SVG string for the repeating "Secure Mark" text
            const svgBg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="bold" fill="rgba(255,255,255,0.15)" transform="rotate(-45 100 100)">Secure Mark</text></svg>`;

            Object.assign(curtain.style, {
                position: 'absolute',
                top: '0', left: '0', width: '100%', height: '100%',
                pointerEvents: 'none', // CRUCIAL: Allows scrolling and clicking underneath
                zIndex: '9998', // Just below the red lockdown screen
                backgroundColor: 'rgba(0, 0, 0, 0.85)', // 85% black opacity
                backgroundImage: `url('${svgBg}')`, // Add the tiled text watermark
                backgroundRepeat: 'repeat',
                // Default state: Hide everything before the mouse enters
                WebkitMaskImage: 'radial-gradient(circle 0px at 50% 50%, transparent 100%, black 100%)',
                maskImage: 'radial-gradient(circle 0px at 50% 50%, transparent 100%, black 100%)'
            });

            this.container.appendChild(curtain);

            // When the mouse moves, move the hole in the curtain
            this.container.addEventListener('mousemove', (e) => {
                const rect = this.container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Adjust this radius (in pixels) to make the viewing hole larger or smaller!
                const holeRadius = 180; 

                // transparent = hole (see PDF), black = mask (see curtain)
                const maskStr = `radial-gradient(circle ${holeRadius}px at ${x}px ${y}px, transparent 50%, black 100%)`;
                curtain.style.WebkitMaskImage = maskStr;
                curtain.style.maskImage = maskStr;
            });

            // When the mouse leaves the document entirely, close the hole completely
            this.container.addEventListener('mouseleave', () => {
                const maskStr = 'radial-gradient(circle 0px at 50% 50%, transparent 100%, black 100%)';
                curtain.style.WebkitMaskImage = maskStr;
                curtain.style.maskImage = maskStr;
            });
        }
    }

    triggerLockdown() {
        let warningOverlay = document.getElementById('screenshot-warning');

        // Hide all the actual PDF canvas elements/toolbars inside the container
        Array.from(this.container.children).forEach(child => {
            if (child.id !== 'screenshot-warning') {
                child.style.display = 'none';
            }
        });

        // Create the massive red warning screen if it doesn't exist yet
        if (!warningOverlay) {
            warningOverlay = document.createElement('div');
            warningOverlay.id = 'screenshot-warning';
            warningOverlay.innerHTML = `
                <div style="text-align: center; color: white;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin: 0 auto 16px;">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #ef4444;">Screenshot Detected</h2>
                    <p style="font-size: 14px; color: #a1a1aa; margin-bottom: 24px;">
                        Screenshots and screen recording are strictly prohibited for this document.<br>
                        This incident has been logged.
                    </p>
                    <button id="dismiss-warning" style="background: #3b82f6; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        I Understand
                    </button>
                </div>
            `;
            
            Object.assign(warningOverlay.style, {
                position: 'absolute',
                top: '0', left: '0', right: '0', bottom: '0',
                backgroundColor: '#09090b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: '9999',
                fontFamily: 'sans-serif',
                width: '100%',
                height: '100%'
            });

            this.container.appendChild(warningOverlay);

            // Allow the user to dismiss the warning and bring the document back
            document.getElementById('dismiss-warning').addEventListener('click', () => {
                warningOverlay.style.display = 'none';
                Array.from(this.container.children).forEach(child => {
                    if (child.id !== 'screenshot-warning') {
                        child.style.display = ''; // Restore the PDF and toolbars
                    }
                });
            });
        } else {
            // If it already exists, just show it
            warningOverlay.style.display = 'flex';
        }
    }
}