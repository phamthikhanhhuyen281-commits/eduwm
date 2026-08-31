import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

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

export const materialService = {
  async getMaterials(): Promise<Material[]> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const colRef = collection(db, 'materials');
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list: Material[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Material);
        });
        return list;
      } catch (err: any) {
        console.warn(`getMaterials attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }
    return [];
  },

  async saveMaterial(material: Material): Promise<void> {
    try {
      const docRef = doc(db, 'materials', material.id);
      await setDoc(docRef, material);
    } catch (err) {
      console.error('Error saving material:', err);
      throw err;
    }
  },

  async deleteMaterial(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'materials', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting material:', err);
      throw err;
    }
  }
};
