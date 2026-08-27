import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Switch, Modal,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/context/AuthContext";
import { adminApi, HomeSection } from "@/src/api-admin";
import { colors, spacing, radius, typography } from "@/src/theme";

const KEY_LABELS: Record<string, string> = {
  banniere: "Bannière principale",
  prochain_show: "Prochain show",
  dernieres_nouvelles: "Dernières nouvelles",
  roster: "Roster",
  dernier_podcast: "Dernier podcast",
  marchandise: "Marchandise",
  promotions: "Promotions",
};

export default function AdminHomeSections() {
  const { user } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<string[]>([]);
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<HomeSection> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [k, s] = await Promise.all([adminApi.homeKeys(), adminApi.listAllHomeSections()]);
      setKeys(k.keys);
      setSections(s);
    } catch (e: any) {
      setToast(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!user?.is_admin) return null;

  const startEdit = (section_key: string) => {
    const existing = sections.find(s => s.section_key === section_key);
    setEditing(existing ? { ...existing } : {
      section_key,
      title: KEY_LABELS[section_key] || section_key,
      subtitle: "",
      image_url: "",
      link: "",
      enabled: true,
      order: keys.indexOf(section_key),
    });
  };

  const save = async () => {
    if (!editing?.section_key) return;
    setSaving(true);
    try {
      await adminApi.upsertHomeSection(editing);
      setEditing(null);
      setToast("Section enregistrée");
      setTimeout(() => setToast(null), 2000);
      await load();
    } catch (e: any) {
      setToast(e?.message || "Erreur");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    if (!editing) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]) return;
      setUploading(true);
      const up = await adminApi.uploadImage({
        localUri: res.assets[0].uri,
        filename: res.assets[0].fileName || `home_${Date.now()}.jpg`,
        mimeType: res.assets[0].mimeType || "image/jpeg",
        bucket: "accueil",
      });
      setEditing({ ...editing, image_url: up.url });
    } catch (e: any) {
      setToast(e?.message || "Erreur upload");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="cms-back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.kicker}>ADMIN</Text>
          <Text style={styles.title}>Sections Accueil</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.listWrap}>
          <Text style={styles.hint}>Chaque section de la page Accueil peut être personnalisée (titre, image, lien, activation).</Text>
          {keys.map(k => {
            const s = sections.find(x => x.section_key === k);
            return (
              <Pressable key={k} onPress={() => startEdit(k)} style={styles.card} testID={`cms-section-${k}`}>
                <View style={styles.cardImgWrap}>
                  {s?.image_url ? (
                    <Image source={{ uri: s.image_url }} style={styles.cardImg} contentFit="cover" />
                  ) : (
                    <View style={styles.cardImgPh}><Ionicons name="image-outline" size={22} color={colors.onSurfaceSecondary} /></View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.cardKey}>{k.toUpperCase()}</Text>
                  <Text style={styles.cardTitle}>{s?.title || KEY_LABELS[k] || k}</Text>
                  <Text style={styles.cardStatus}>
                    {s ? (s.enabled ? "✓ Actif" : "✗ Désactivé") : "Non configuré"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => !saving && setEditing(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !saving && setEditing(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl }}>
              <Text style={styles.sheetKicker}>SECTION · {editing?.section_key?.toUpperCase()}</Text>
              <Text style={styles.sheetTitle}>{KEY_LABELS[editing?.section_key || ""] || editing?.section_key}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Titre</Text>
                <TextInput
                  testID="cms-input-title"
                  style={styles.input}
                  value={editing?.title || ""}
                  onChangeText={t => setEditing({ ...editing!, title: t })}
                  placeholder="Titre de la section"
                  placeholderTextColor={colors.onSurfaceSecondary}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Sous-titre</Text>
                <TextInput
                  testID="cms-input-subtitle"
                  style={styles.input}
                  value={editing?.subtitle || ""}
                  onChangeText={t => setEditing({ ...editing!, subtitle: t })}
                  placeholder="Optionnel"
                  placeholderTextColor={colors.onSurfaceSecondary}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Lien (optionnel)</Text>
                <TextInput
                  testID="cms-input-link"
                  style={styles.input}
                  value={editing?.link || ""}
                  onChangeText={t => setEditing({ ...editing!, link: t })}
                  placeholder="/(tabs)/billets ou URL externe"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Image</Text>
                {editing?.image_url ? (
                  <View style={styles.previewBox}>
                    <Image source={{ uri: editing.image_url }} style={styles.previewImg} contentFit="cover" />
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable style={styles.uploadBtn} onPress={pickImage} disabled={uploading} testID="cms-upload-btn">
                    {uploading ? <ActivityIndicator color={colors.white} size="small" /> : (
                      <>
                        <Ionicons name="cloud-upload" size={16} color={colors.white} />
                        <Text style={styles.uploadBtnText}>{editing?.image_url ? "Remplacer" : "Téléverser"}</Text>
                      </>
                    )}
                  </Pressable>
                  {editing?.image_url && (
                    <Pressable style={styles.uploadBtnGhost} onPress={() => setEditing({ ...editing!, image_url: "" })} testID="cms-clear-btn">
                      <Ionicons name="close-circle-outline" size={16} color={colors.onSurfaceSecondary} />
                      <Text style={styles.uploadBtnGhostText}>Retirer</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Ordre</Text>
                <TextInput
                  testID="cms-input-order"
                  style={styles.input}
                  value={String(editing?.order ?? 0)}
                  onChangeText={t => setEditing({ ...editing!, order: parseInt(t) || 0 })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.onSurfaceSecondary}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Section active</Text>
                <Switch
                  testID="cms-toggle-enabled"
                  value={editing?.enabled ?? true}
                  onValueChange={v => setEditing({ ...editing!, enabled: v })}
                  trackColor={{ true: colors.brand, false: colors.border }}
                  thumbColor={colors.white}
                />
              </View>

              <Pressable style={styles.saveBtn} onPress={save} disabled={saving} testID="cms-save-btn">
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>ENREGISTRER</Text>}
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {toast && (
        <View style={styles.toast}>
          <Ionicons name="information-circle" size={20} color={colors.brand} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.surfaceSecondary },
  kicker: { ...typography.label, color: colors.brand, fontSize: 10 },
  title: { ...typography.displaySM, color: colors.white, fontSize: 18 },
  listWrap: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hint: { ...typography.body, color: colors.onSurfaceSecondary, fontSize: 13, marginBottom: spacing.sm },
  card: {
    flexDirection: "row", alignItems: "center", padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  cardImgWrap: { width: 72, height: 72 },
  cardImg: { width: 72, height: 72, borderRadius: radius.md },
  cardImgPh: {
    width: 72, height: 72, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  cardKey: { ...typography.label, color: colors.brand, fontSize: 10 },
  cardTitle: { ...typography.bodyBold, color: colors.white, marginTop: 2, fontSize: 14 },
  cardStatus: { ...typography.caption, color: colors.onSurfaceSecondary, marginTop: 2 },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: "center", marginTop: spacing.md },
  sheetKicker: { ...typography.label, color: colors.brand, fontSize: 11 },
  sheetTitle: { ...typography.displayMD, color: colors.white, marginTop: spacing.xs, fontSize: 22 },
  field: { marginTop: spacing.lg },
  label: { ...typography.label, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, fontSize: 11 },
  input: {
    backgroundColor: colors.surfaceSecondary, color: colors.white,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, fontSize: 15,
  },
  previewBox: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", marginBottom: spacing.sm, backgroundColor: colors.surfaceSecondary },
  previewImg: { width: "100%", height: "100%" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  uploadBtnText: { ...typography.label, color: colors.white, fontSize: 12 },
  uploadBtnGhost: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  uploadBtnGhostText: { ...typography.label, color: colors.onSurfaceSecondary, fontSize: 12 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
  saveBtnText: { ...typography.label, color: colors.white, letterSpacing: 1.5 },
  cancelBtn: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm },
  cancelBtnText: { ...typography.body, color: colors.onSurfaceSecondary },
  toast: {
    position: "absolute", top: 60, left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.brand,
  },
  toastText: { ...typography.body, color: colors.white, flex: 1, fontSize: 13 },
});
