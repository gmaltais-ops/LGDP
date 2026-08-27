import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/context/AuthContext";
import { adminApi, ManageableGroups, ManageableItem } from "@/src/api-admin";
import { colors, spacing, radius, typography } from "@/src/theme";

type GroupKey = keyof ManageableGroups;

const GROUP_LABELS: Record<GroupKey, { title: string; resource_type: string; bucket: string; icon: any }> = {
  shows:       { title: "Événements (shows)", resource_type: "event",    bucket: "shows",       icon: "flame" },
  roster:      { title: "Roster (lutteurs)",  resource_type: "wrestler", bucket: "roster",      icon: "people" },
  podcasts:    { title: "Podcasts",           resource_type: "episode",  bucket: "podcasts",    icon: "mic" },
  nouvelles:   { title: "Nouvelles",          resource_type: "news",     bucket: "nouvelles",   icon: "newspaper" },
  marchandise: { title: "Marchandise",        resource_type: "product",  bucket: "marchandise", icon: "bag" },
  home:        { title: "Sections Accueil",   resource_type: "home",     bucket: "accueil",     icon: "home" },
};

export default function AdminHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<ManageableGroups | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<GroupKey>("shows");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGroups(await adminApi.getManageable());
    } catch (e: any) {
      setToast(e?.message || "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;
  if (!user.is_admin) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={colors.brand} />
          <Text style={styles.blockedTitle}>Accès administrateur requis</Text>
          <Text style={styles.blockedDesc}>Seuls les comptes admin@lgdp.ca peuvent gérer les images.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.back()} testID="admin-back-btn">
            <Text style={styles.primaryBtnText}>RETOUR</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const pickAndUpload = async (item: ManageableItem, resource_type: string, bucket: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setToast("Permission d'accès aux photos refusée");
        setTimeout(() => setToast(null), 2500);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setUploadingId(item.id);
      const filename = asset.fileName || `img_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";
      const up = await adminApi.uploadImage({
        localUri: asset.uri,
        filename,
        mimeType,
        resource_type,
        resource_id: item.id,
        bucket,
      });
      setToast(`Image mise à jour → ${up.url.split("/").pop()}`);
      setTimeout(() => setToast(null), 2500);
      await load();
    } catch (e: any) {
      setToast(e?.message || "Erreur upload");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploadingId(null);
    }
  };

  const clearImage = async (item: ManageableItem, resource_type: string) => {
    try {
      setUploadingId(item.id);
      await adminApi.setResourceImage(resource_type, item.id, null);
      setToast("Image dissociée");
      setTimeout(() => setToast(null), 2000);
      await load();
    } catch (e: any) {
      setToast(e?.message || "Erreur");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setUploadingId(null);
    }
  };

  const meta = GROUP_LABELS[activeGroup];
  const items = groups?.[activeGroup] || [];

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="admin-close-btn">
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.kicker}>ADMIN</Text>
          <Text style={styles.title}>Gestion des images</Text>
        </View>
        <Pressable onPress={() => router.push("/admin/home-sections" as any)} style={styles.iconBtn} testID="admin-home-cms-btn">
          <Ionicons name="settings-outline" size={22} color={colors.white} />
        </Pressable>
      </View>

      {/* Group tabs */}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
          style={{ height: 56 }}
        >
          {(Object.keys(GROUP_LABELS) as GroupKey[]).map(k => (
            <Pressable
              key={k}
              testID={`admin-chip-${k}`}
              onPress={() => setActiveGroup(k)}
              style={[styles.chip, activeGroup === k && styles.chipActive]}
            >
              <Ionicons name={GROUP_LABELS[k].icon} size={14} color={activeGroup === k ? colors.white : colors.onSurfaceSecondary} />
              <Text style={[styles.chipText, activeGroup === k && styles.chipTextActive]}>{GROUP_LABELS[k].title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.listWrap}>
          <View style={styles.bucketInfo}>
            <Ionicons name="cloud-upload" size={16} color={colors.brandGold} />
            <Text style={styles.bucketInfoText}>
              Bucket: <Text style={{ color: colors.brandGold, fontWeight: "700" }}>{meta.bucket}</Text> · JPG/PNG/WEBP · max 10 MB
            </Text>
          </View>
          {items.length === 0 ? (
            <Text style={styles.empty}>Aucun élément dans cette catégorie.</Text>
          ) : items.map(item => (
            <View key={item.id} style={styles.row} testID={`admin-item-${item.id}`}>
              <Pressable onPress={() => item.url && setPreview(item.url)} style={styles.thumbWrap}>
                {item.url ? (
                  <Image source={{ uri: item.url }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Ionicons name="image-outline" size={22} color={colors.onSurfaceSecondary} />
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.rowLabel} numberOfLines={2}>{item.label}</Text>
                <Text style={styles.rowId} numberOfLines={1}>{item.id}</Text>
                <View style={styles.rowActions}>
                  {uploadingId === item.id ? (
                    <ActivityIndicator color={colors.brand} size="small" />
                  ) : (
                    <>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => pickAndUpload(item, meta.resource_type, meta.bucket)}
                        testID={`admin-upload-${item.id}`}
                      >
                        <Ionicons name={item.url ? "swap-horizontal" : "cloud-upload"} size={14} color={colors.white} />
                        <Text style={styles.actionBtnText}>{item.url ? "Remplacer" : "Téléverser"}</Text>
                      </Pressable>
                      {item.url && (
                        <Pressable
                          style={styles.actionBtnGhost}
                          onPress={() => clearImage(item, meta.resource_type)}
                          testID={`admin-clear-${item.id}`}
                        >
                          <Ionicons name="close-circle-outline" size={14} color={colors.onSurfaceSecondary} />
                          <Text style={styles.actionBtnGhostText}>Retirer</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Preview modal */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewRoot} onPress={() => setPreview(null)}>
          {preview && <Image source={{ uri: preview }} style={styles.previewImg} contentFit="contain" />}
          <View style={styles.previewClose}><Ionicons name="close" size={24} color={colors.white} /></View>
        </Pressable>
      </Modal>

      {toast && (
        <View style={styles.toast} testID="admin-toast">
          <Ionicons name="information-circle" size={20} color={colors.brand} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.surfaceSecondary },
  kicker: { ...typography.label, color: colors.brand, fontSize: 10 },
  title: { ...typography.displaySM, color: colors.white, fontSize: 18 },
  chipRowWrap: { height: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, flexShrink: 0, justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.label, color: colors.onSurfaceSecondary, fontSize: 11 },
  chipTextActive: { color: colors.white },
  listWrap: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  bucketInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md },
  bucketInfoText: { ...typography.caption, color: colors.onSurfaceTertiary },
  empty: { ...typography.body, color: colors.onSurfaceSecondary, textAlign: "center", paddingVertical: spacing.xl },
  row: {
    flexDirection: "row", padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  thumbPlaceholder: {
    width: 72, height: 72, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  rowLabel: { ...typography.bodyBold, color: colors.white, fontSize: 14 },
  rowId: { ...typography.caption, color: colors.onSurfaceTertiary, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, minHeight: 32,
  },
  actionBtnText: { ...typography.label, color: colors.white, fontSize: 10 },
  actionBtnGhost: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, minHeight: 32,
  },
  actionBtnGhostText: { ...typography.label, color: colors.onSurfaceSecondary, fontSize: 10 },
  blockedTitle: { ...typography.displaySM, color: colors.white, marginTop: spacing.md, textAlign: "center" },
  blockedDesc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm, textAlign: "center" },
  primaryBtn: { backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md, marginTop: spacing.xl },
  primaryBtnText: { ...typography.label, color: colors.white, letterSpacing: 1.5 },
  previewRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
  previewImg: { width: "100%", height: "100%" },
  previewClose: { position: "absolute", top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  toast: {
    position: "absolute", top: 60, left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.brand,
  },
  toastText: { ...typography.body, color: colors.white, flex: 1, fontSize: 13 },
});
