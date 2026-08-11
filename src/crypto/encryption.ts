import CryptoJS from 'crypto-js';

export function Encrypt(payload: any) {
    const secretKey = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), secretKey).toString();

    return { data: encrypted, key: secretKey };
}
