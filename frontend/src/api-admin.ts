// Admin-only helpers for LGDP image management
import { API, api } from "./api";
import { Platform } from "react-native";

async function getTok(): Promise<string | null> {
  return api.getToken();
}

export type ManageableItem = { id: string; label: string; url?: string | null };
export type ManageableGroups = {
  roster: ManageableItem[];
  podcasts: ManageableItem[];
  shows: ManageableItem[];
  marchandise: ManageableItem[];
  nouvelles: ManageableItem[];
  home: ManageableItem[];
};

export type HomeSection = {
  section_id: string;
  section_key: string;
  title?: string | null;
  subtitle?: string | null;
  image_url?: string | null;
  link?: string | null;
  enabled: boolean;
  order: number;
};

const RESOURCE_TO_BUCKET: Record<string, string> = {
  wrestler: "roster",
  episode: "podcasts",
  event: "shows",
  product: "marchandise",
  news: "nouvelles",
  home: "accueil",
};

export const adminApi = {
  getManageable: () => api.get<ManageableGroups>("/admin/manageable"),

  listBuckets: () => api.get<{ name: string; public: boolean }[]>("/admin/storage/buckets"),

  listBucketFiles: (bucket: string) => api.get<{ name: string; url: string }[]>(`/admin/storage/${bucket}`),

  setResourceImage: (resource_type: string, resource_id: string, url: string | null) =>
    api.patch("/admin/resource-image", { resource_type, resource_id, url }),

  deleteImage: (bucket: string, path: string) => api.del(`/admin/storage/${bucket}/${path}`),

  bucketForResource: (resource_type: string) => RESOURCE_TO_BUCKET[resource_type] || "accueil",

  /**
   * Upload a local file (from expo-image-picker asset.uri) to Supabase Storage via backend.
   * Returns { url, path, bucket }.
   */
  async uploadImage(params: {
    localUri: string;
    filename?: string;
    mimeType?: string;
    resource_type?: string;
    resource_id?: string;
    bucket?: string;
  }) {
    const bucket = params.bucket || (params.resource_type ? RESOURCE_TO_BUCKET[params.resource_type] : "accueil");
    const filename = params.filename || `image_${Date.now()}.jpg`;
    const mime = params.mimeType || "image/jpeg";

    const form = new FormData();
    form.append("bucket", bucket);
    if (params.resource_type) form.append("resource_type", params.resource_type);
    if (params.resource_id) form.append("resource_id", params.resource_id);

    if (Platform.OS === "web") {
      // Fetch the blob from the object URL
      const resp = await fetch(params.localUri);
      const blob = await resp.blob();
      form.append("file", blob, filename);
    } else {
      // React Native FormData file
      form.append("file", { uri: params.localUri, name: filename, type: mime } as any);
    }

    const token = await getTok();
    const r = await fetch(`${API}/admin/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token || ""}` },
      body: form,
    });
    const text = await r.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!r.ok) throw new Error((data && data.detail) || `Erreur ${r.status}`);
    return data as { ok: boolean; url: string; path: string; bucket: string };
  },

  // Home sections
  listAllHomeSections: () => api.get<HomeSection[]>("/admin/home-sections"),
  upsertHomeSection: (body: Partial<HomeSection>) => api.post<HomeSection>("/admin/home-sections", body),
  deleteHomeSection: (section_id: string) => api.del(`/admin/home-sections/${section_id}`),
  homeKeys: () => api.get<{ keys: string[] }>("/admin/home-keys"),
};
