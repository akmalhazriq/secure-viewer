import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.js',
            name: 'SecureViewer',
            fileName: () => 'secure-viewer.min.js',
            formats: ['iife'] // Immediately Invoked Function Expression (perfect for browser CDN)
        },
        minify: 'terser', // Aggressive minification
    }
});