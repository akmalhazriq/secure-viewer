export class Decryptor {
    /**
     * Decrypts the AES-256 payload extracted from the PDF attachment.
     * @param {Uint8Array} encryptedPayload - The raw bytes of the attachment
     * @param {string} documentKey - The passphrase/key used to lock it
     * @returns {Promise<Uint8Array>} - The decrypted raw PDF bytes
     */
    static async unlockVault(encryptedPayload, documentKey) {
        try {
            // 1. Python packaged it as: [16 bytes Salt] + [12 bytes IV] + [Ciphertext]
            // We need to slice the array to get our pieces back out
            const salt = encryptedPayload.slice(0, 16);
            const iv = encryptedPayload.slice(16, 28);
            const ciphertext = encryptedPayload.slice(28);

            // 2. Convert the documentKey into a raw cryptographic material
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                "raw",
                enc.encode(documentKey),
                { name: "PBKDF2" },
                false,
                ["deriveBits", "deriveKey"]
            );

            // 3. Derive the exact same 256-bit AES key that Python used
            const aesKey = await crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                true,
                ["decrypt"]
            );

            // 4. Decrypt the Ciphertext purely in the browser's RAM!
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                aesKey,
                ciphertext
            );

            // Return the crisp, clean PDF bytes
            return new Uint8Array(decryptedBuffer);

        } catch (error) {
            console.error("Decryption Failed! Wrong key or corrupted file.");
            throw new Error("UNAUTHORIZED: Invalid decryption key");
        }
    }
}