// Async WebCrypto/IndexedDB storage for sensitive records.
// Callers must retain the passphrase; Q never stores it or the derived key.
const DATABASE = 'q-secure-storage-v1';
const STORE = 'records';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deriveKey(passphrase: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  if (passphrase.length < 12) throw new Error('Use a passphrase of at least 12 characters.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, usage);
}

export async function setSecureRecord<T>(recordKey: string, value: T, passphrase: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put({ version: 1, salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) }, recordKey);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function getSecureRecord<T>(recordKey: string, passphrase: string): Promise<T | null> {
  const db = await openDatabase();
  const envelope = await new Promise<any>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(recordKey);
    request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error);
  });
  db.close();
  if (!envelope) return null;
  const key = await deriveKey(passphrase, new Uint8Array(envelope.salt), ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(envelope.iv) }, key, new Uint8Array(envelope.ciphertext));
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export async function deleteSecureRecord(recordKey: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(recordKey); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  db.close();
}
