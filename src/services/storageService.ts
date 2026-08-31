import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from '../firebase';

export const storageService = {
  /**
   * Upload a File object (from file input / drag & drop) to Firebase Storage / Backend / Base64
   * Uses fast-timeout strategy so upload never hangs or blocks indefinitely.
   */
  async uploadFile(file: File, folderPath: string): Promise<string> {
    // 1. Read file as Base64 Data URL (fast client-side, 100% reliable)
    const getBase64 = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Chuyển đổi file thất bại'));
        };
        reader.onerror = () => reject(new Error('Lỗi khi đọc file'));
        reader.readAsDataURL(file);
      });
    };

    // 2. Try Backend Server Upload first (Instant local filesystem write, < 50ms)
    try {
      const base64Data = await getBase64();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch('/api/admin/upload-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer PlAcEmEnT_TeSt_SeCrEt_Token'
        },
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64Data
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.filePath) {
          console.log('Successfully uploaded via backend server:', result.filePath);
          return result.filePath;
        }
      }
    } catch (serverErr) {
      console.warn('Backend server upload failed or timed out, trying Firebase Storage / Base64 fallback...', serverErr);
    }

    // 3. Try Firebase Storage with a strict 3.5-second timeout
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const uniqueName = `${Date.now()}_${cleanName}`;
      const fileRef = ref(storage, `${folderPath}/${uniqueName}`);
      
      const uploadPromise = uploadBytes(fileRef, file).then(snap => getDownloadURL(snap.ref));
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Firebase Storage timeout')), 3500)
      );

      const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
      if (downloadUrl) return downloadUrl;
    } catch (firebaseErr) {
      console.warn('Firebase Storage upload failed or timed out:', firebaseErr);
    }

    // 4. Ultimate Fallback: Return Base64 Data URL directly (works offline, zero network dependencies)
    return await getBase64();
  },

  /**
   * Upload base64 encoded audio string to Firebase Storage with retry and resilient fallback
   */
  async uploadBase64Audio(base64Data: string, candidateId: string, part: string): Promise<string> {
    // Detect content type from base64 string
    let contentType = 'audio/webm';
    let ext = 'webm';
    
    const match = base64Data.match(/^data:(audio\/[a-zA-Z0-9+.-]+);base64,/);
    if (match) {
      contentType = match[1];
      if (contentType.includes('mp4')) ext = 'mp4';
      else if (contentType.includes('m4a')) ext = 'm4a';
      else if (contentType.includes('wav')) ext = 'wav';
      else if (contentType.includes('ogg')) ext = 'ogg';
    }

    // Strip metadata if present (e.g. "data:audio/webm;base64,...")
    let cleanBase64 = base64Data;
    if (base64Data.includes(',')) {
      cleanBase64 = base64Data.split(',')[1];
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fileRef = ref(storage, `candidates/${candidateId}/${part}.${ext}`);
        const snap = await uploadString(fileRef, cleanBase64, 'base64', {
          contentType
        });
        const downloadUrl = await getDownloadURL(snap.ref);
        return downloadUrl;
      } catch (err) {
        console.warn(`Firebase Storage uploadBase64Audio attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }

    // Fallback: return raw base64 string directly
    return base64Data;
  },

  /**
   * Upload a raw audio Blob directly to Server / Firebase Storage with multi-tier fallback
   */
  async uploadAudioBlob(blob: Blob, candidateId: string, part: string): Promise<string> {
    let ext = 'webm';
    if (blob.type.includes('mp4')) ext = 'mp4';
    else if (blob.type.includes('m4a')) ext = 'm4a';
    else if (blob.type.includes('wav')) ext = 'wav';
    else if (blob.type.includes('ogg')) ext = 'ogg';

    // 1. Convert Blob to Base64
    let base64Data = '';
    try {
      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Chuyển đổi base64 thất bại'));
        };
        reader.onerror = () => reject(new Error('Lỗi đọc audio blob'));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to convert audio blob to base64:', e);
    }

    // 2. Primary Fast & Reliable Method: Upload directly to server backend candidate audio storage
    if (base64Data) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch('/api/candidates/upload-audio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: candidateId,
              part,
              audioData: base64Data
            })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.audioPath) {
              console.log(`Successfully saved speaking recording via server: ${result.audioPath}`);
              return result.audioPath;
            }
          }
        } catch (apiErr) {
          console.warn(`Server upload-audio attempt ${attempt} failed:`, apiErr);
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 400 * attempt));
          }
        }
      }
    }

    // 3. Secondary Method: Firebase Storage
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fileRef = ref(storage, `candidates/${candidateId}/${part}_${Date.now()}.${ext}`);
        const snap = await uploadBytes(fileRef, blob, {
          contentType: blob.type
        });
        const downloadUrl = await getDownloadURL(snap.ref);
        console.log(`Successfully saved speaking recording to Firebase Storage: ${downloadUrl}`);
        return downloadUrl;
      } catch (err) {
        console.warn(`Firebase Storage uploadAudioBlob attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }

    // 4. Return base64 as final fallback if all network requests fail
    return base64Data;
  }
};
