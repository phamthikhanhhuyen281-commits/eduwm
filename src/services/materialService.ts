import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../firebase';

export interface Material {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'pdf' | 'docx' | 'image' | 'video' | 'audio' | 'link' | 'document' | 'other';
  fileName?: string;
  fileSize?: number;
  uploadedBy?: string;
  createdAt: string;
}

const CACHE_KEY = 'materials_cache';

export const materialService = {
  async getMaterials(): Promise<Material[]> {
    // 1. Try Firestore with retries
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const colRef = collection(db, 'materials');
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list: Material[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Material);
        });
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(list));
        } catch (e) {
          // ignore localStorage quota errors
        }
        return list;
      } catch (err: any) {
        console.warn(`getMaterials Firestore attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
    }

    // 2. Try Server API fallback
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.materials) && data.materials.length > 0) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data.materials));
          } catch (e) {}
          return data.materials;
        }
      }
    } catch (apiErr) {
      console.warn('Server API materials fetch failed:', apiErr);
    }

    // 3. Try LocalStorage cache fallback
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (cacheErr) {}

    return [];
  },

  async saveMaterial(material: Material): Promise<void> {
    // 1. Update local cache immediately for instant UI response
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      let list: Material[] = cached ? JSON.parse(cached) : [];
      const existingIdx = list.findIndex(m => m.id === material.id);
      if (existingIdx >= 0) {
        list[existingIdx] = material;
      } else {
        list.unshift(material);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch (e) {}

    let firestoreSuccess = false;
    // 2. Save to Firestore
    try {
      const docRef = doc(db, 'materials', material.id);
      await setDoc(docRef, sanitizeForFirestore(material));
      firestoreSuccess = true;
    } catch (err) {
      console.warn('Firestore material save failed, syncing to backend server fallback...', err);
    }

    // 3. Sync to Express backend API
    try {
      await fetch('/api/admin/materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer PlAcEmEnT_TeSt_SeCrEt_Token'
        },
        body: JSON.stringify(material)
      });
    } catch (serverErr) {
      console.warn('Backend server material save fallback error:', serverErr);
      if (!firestoreSuccess) {
        // If neither Firestore nor Server worked, let user know
        console.warn('Material saved in local session cache.');
      }
    }
  },

  async deleteMaterial(id: string): Promise<void> {
    // 1. Update local cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const list: Material[] = JSON.parse(cached);
        const filtered = list.filter(m => m.id !== id);
        localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
      }
    } catch (e) {}

    // 2. Delete from Firestore
    try {
      const docRef = doc(db, 'materials', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore material delete error:', err);
    }

    // 3. Delete from Server
    try {
      await fetch(`/api/admin/materials/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer PlAcEmEnT_TeSt_SeCrEt_Token'
        }
      });
    } catch (e) {}
  }
};
