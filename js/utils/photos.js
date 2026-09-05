// DormGlide listing photo pipeline: client-side compression + Supabase Storage
// upload. Falls back to base64 data URLs in local/offline demo mode so the
// Sell flow keeps working without a backend.
(() => {
    const BUCKET = 'listing-photos';
    const MAX_EDGE = 1600;
    const JPEG_QUALITY = 0.8;

    const getClient = () => window.SupabaseClient || null;

    const canUseStorage = async () => {
        const client = getClient();
        if (!client) return false;
        if (window.DormGlideSupabaseSessionActive) return true;
        try {
            const { data } = await client.auth.getSession();
            return Boolean(data?.session);
        } catch (_error) {
            return false;
        }
    };

    // Resize + re-encode an image file on a canvas. A 5MB phone photo becomes
    // roughly 150-300KB, which is what makes browse fast on phones.
    const compressImage = (file, { maxEdge = MAX_EDGE, quality = JPEG_QUALITY } = {}) =>
        new Promise((resolve, reject) => {
            if (!file?.type?.startsWith('image/')) {
                reject(new Error('Only image files are allowed.'));
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            const img = new Image();

            img.onload = () => {
                try {
                    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
                    const width = Math.max(1, Math.round(img.width * scale));
                    const height = Math.max(1, Math.round(img.height * scale));

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(objectUrl);
                        if (!blob) {
                            reject(new Error('Could not process this image.'));
                            return;
                        }
                        resolve(blob);
                    }, 'image/jpeg', quality);
                } catch (error) {
                    URL.revokeObjectURL(objectUrl);
                    reject(error);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Could not read this image.'));
            };

            img.src = objectUrl;
        });

    const blobToDataUrl = (blob) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read image data.'));
            reader.readAsDataURL(blob);
        });

    // Upload compressed blobs; returns public URLs in the same order.
    // Throws if any upload fails (the caller must not create a half-broken
    // listing). Local mode returns base64 data URLs instead.
    const uploadListingPhotos = async ({ userId, blobs, onProgress }) => {
        const list = Array.isArray(blobs) ? blobs : [];
        if (!userId || list.length === 0) return [];

        if (!(await canUseStorage())) {
            const dataUrls = [];
            for (const blob of list) {
                dataUrls.push(await blobToDataUrl(blob));
            }
            return dataUrls;
        }

        const client = getClient();
        const folder = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const urls = [];

        for (let index = 0; index < list.length; index++) {
            const path = `${folder}/${index}.jpg`;
            const { error } = await client.storage
                .from(BUCKET)
                .upload(path, list[index], { contentType: 'image/jpeg', upsert: false });
            if (error) {
                throw new Error(`Photo ${index + 1} failed to upload: ${error.message || 'unknown error'}`);
            }
            const { data } = client.storage.from(BUCKET).getPublicUrl(path);
            urls.push(data.publicUrl);
            if (onProgress) onProgress(index + 1, list.length);
        }

        return urls;
    };

    // Best-effort cleanup when a listing is deleted. Only URLs in this bucket
    // are touched; RLS restricts deletion to the owner's own folder anyway.
    const deleteListingPhotoUrls = async (urls) => {
        const client = getClient();
        if (!client || !Array.isArray(urls)) return;

        const marker = `/object/public/${BUCKET}/`;
        const paths = urls
            .filter((url) => typeof url === 'string' && url.includes(marker))
            .map((url) => decodeURIComponent(url.split(marker)[1] || '').split('?')[0])
            .filter(Boolean);

        if (paths.length === 0) return;

        try {
            await client.storage.from(BUCKET).remove(paths);
        } catch (error) {
            console.warn('[DormGlide] Photo cleanup failed (non-fatal):', error);
        }
    };

    window.DormGlidePhotos = {
        compressImage,
        uploadListingPhotos,
        deleteListingPhotoUrls,
        blobToDataUrl
    };
})();
