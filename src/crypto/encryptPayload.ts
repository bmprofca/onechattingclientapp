import CryptoJS from 'crypto-js';

function randomHex(length: number) {
  // Use secure random when available (polyfilled by react-native-get-random-values).
  try {
    const cryptoObj: any = (globalThis as any).crypto || (globalThis as any).msCrypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const bytes = new Uint8Array(Math.ceil(length / 2));
      cryptoObj.getRandomValues(bytes);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        const h = bytes[i].toString(16).padStart(2, '0');
        hex += h;
      }
      return hex.slice(0, length);
    }
  } catch (e) {
    // fall through to Math.random fallback
  }

  // Fallback non-cryptographic generator for environments without secure random.
  let result = '';
  while (result.length < length) result += Math.floor(Math.random() * 0xffffffff).toString(16);
  return result.slice(0, length);
}

export function encryptPayload(payload: unknown) {
  const key = randomHex(32);
  return {data: CryptoJS.AES.encrypt(JSON.stringify(payload), key).toString(), key};
}
