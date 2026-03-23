import { useState, useRef, useCallback, useEffect } from "react";
import { compressImage } from "./imageUtils.js";

export function usePhotoUpload({ db, dispatch, showToast }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const uploadLockRef = useRef(Promise.resolve()); // sequential photo upload queue

  const fileInputRef = useRef(null);
  const photoEntryIdRef = useRef(null);
  const dbRef = useRef(db);
  const dispatchRef = useRef(dispatch);
  dbRef.current = db;
  dispatchRef.current = dispatch;

  // Safari-safe photo upload — input must be in DOM
  useEffect(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);
    fileInputRef.current = input;

    const handler = () => {
      const files = Array.from(input.files);
      const id = photoEntryIdRef.current;

      if (files.length === 0 || !id) return;
      // Queue upload behind any in-progress upload to prevent read/merge/write race
      uploadLockRef.current = uploadLockRef.current.then(async () => {
        const curDb = dbRef.current;
        const curDispatch = dispatchRef.current;
        setUploading(true);
        setUploadProgress({ done: 0, total: files.length });

        // Step 1: Upload files to Supabase storage
        const urls = [];
        for (let i = 0; i < files.length; i++) {
          try {
            const compressed = await compressImage(files[i]);
            const url = await curDb.uploadPhoto(compressed, id);
            if (url && typeof url === 'string') urls.push(url);
          } catch (err) { /* skip failed uploads */ }
          setUploadProgress({ done: i + 1, total: files.length });
        }
        if (urls.length === 0) { setUploading(false); input.value = ""; return; }

        // Step 2: Read current photos from DB (sequenced — no concurrent reads)
        const current = await curDb.readPhotos(id);
        const existing = current.ok ? current.photos : [];

        // Step 3: Merge and save directly to DB
        const merged = [...existing, ...urls];
        const saveResult = await curDb.savePhotos(id, merged);

        // Step 4: Update local state
        curDispatch({ type: "ADD_PHOTOS", id, urls });

        // Step 5: Show result
        if (saveResult.ok) {
          showToast(`${urls.length} photo${urls.length > 1 ? "s" : ""} saved (${merged.length} total)`, "\u2705", 3000);
        } else {
          showToast(`Photo save failed: ${saveResult.error}`, "\u26A0\uFE0F", 8000);
        }

        setUploading(false);
        input.value = "";
      }).catch(err => { console.error('[photoUpload] queue error:', err); setUploading(false); });
    };

    input.addEventListener("change", handler);
    return () => {
      input.removeEventListener("change", handler);
      document.body.removeChild(input);
    };
  }, []);

  const handlePhotos = useCallback((id) => {
    if (!navigator.onLine) { showToast("Photos can't be uploaded while offline", "\uD83D\uDCF5", 3000); return; }
    photoEntryIdRef.current = id;
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // reset
      fileInputRef.current.click();
    }
  }, [showToast]);

  return { uploading, setUploading, uploadProgress, setUploadProgress, handlePhotos, uploadLockRef };
}
