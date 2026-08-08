import { createClient } from "@/lib/supabase/client";

const BUCKET_NAME = "proofs";

/**
 * S'assure que le bucket "proofs" existe
 */
export async function ensureBucket() {
  const supabase = createClient();
  if (!supabase) return;

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!exists) {
    // Try to create it (requires service role, so this may fail client-side)
    // The bucket should be created via SQL migration instead
    console.warn("Bucket 'proofs' not found. Créez-le via la migration SQL.");
  }
}

/**
 * Upload un fichier vers Supabase Storage
 * @returns L'URL publique du fichier ou null en cas d'erreur
 */
export async function uploadProofFile(
  file: File,
  userId: string,
  folder: "submissions" | "deposits" = "submissions"
): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const fileExt = file.name.split(".").pop() || "jpg";
  // ⚠️ Le premier dossier doit être le userId pour correspondre à la politique RLS :
  // auth.uid()::text = (storage.foldername(name))[1]
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const filePath = `${userId}/${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Convertit une data URL (base64) en File
 */
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const [meta, base64] = dataUrl.split(",");
    const mime = meta.match(/data:(.*?);/)?.[1] || "image/png";
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new File([byteArray], filename, { type: mime });
  } catch (e) {
    return null;
  }
}

/**
 * Upload une data URL (base64) vers Supabase Storage
 */
export async function uploadProofDataUrl(
  dataUrl: string,
  userId: string,
  folder: "submissions" | "deposits" = "submissions"
): Promise<string | null> {
  const file = dataUrlToFile(dataUrl, `proof-${Date.now()}.jpg`);
  if (!file) return null;
  return uploadProofFile(file, userId, folder);
}