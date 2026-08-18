import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, ScrollView, Modal } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, typography } from "@/src/theme";

type Product = { product_id: string; name: string; description?: string; price: number; image?: string; stock: number; category?: string };

const CATS = [
  { id: "all", label: "Tout" },
  { id: "vetements", label: "Vêtements" },
  { id: "accessoires", label: "Accessoires" },
  { id: "collectors", label: "Collectors" },
];

export default function Boutique() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [selected, setSelected] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setProducts(await api.get<Product[]>("/products")); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await api.post("/orders", { product_id: selected.product_id, quantity: 1 });
      setSelected(null);
      setToast(res.message || "Commande confirmée");
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (e: any) {
      setToast(e?.message || "Erreur");
      setTimeout(() => setToast(null), 3000);
    }
    setBusy(false);
  };

  const filtered = cat === "all" ? products : products.filter(p => p.category === cat);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.heading}>BOUTIQUE</Text>
        <Text style={styles.subheading}>Le stuff des vrais fans.</Text>
      </View>
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
          style={{ height: 56 }}
        >
          {CATS.map(c => (
            <Pressable
              key={c.id}
              testID={`boutique-chip-${c.id}`}
              onPress={() => setCat(c.id)}
              style={[styles.chip, cat === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, cat === c.id && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        testID="products-list"
        data={filtered}
        keyExtractor={p => p.product_id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 140, gap: spacing.md }}
        renderItem={({ item }) => (
          <Pressable style={styles.pCard} onPress={() => setSelected(item)} testID={`product-${item.product_id}`}>
            <Image source={{ uri: item.image }} style={styles.pImg} contentFit="cover" />
            <View style={styles.pBody}>
              <Text style={styles.pName} numberOfLines={2}>{item.name}</Text>
              <View style={styles.pFooter}>
                <Text style={styles.pPrice}>{item.price.toFixed(2)} $</Text>
                {item.stock < 5 && item.stock > 0 && (
                  <Text style={styles.pLow}>DERNIÈRES {item.stock}</Text>
                )}
              </View>
            </View>
          </Pressable>
        )}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          {selected && (
            <>
              <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
                <View style={{ height: 400, backgroundColor: colors.surfaceSecondary }}>
                  <Image source={{ uri: selected.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                  <Pressable style={styles.closeBtn} onPress={() => setSelected(null)} testID="product-close-btn">
                    <Ionicons name="close" size={24} color={colors.white} />
                  </Pressable>
                </View>
                <View style={{ padding: spacing.xl }}>
                  <Text style={styles.detailCat}>{(selected.category || "").toUpperCase()}</Text>
                  <Text style={styles.detailName}>{selected.name}</Text>
                  <Text style={styles.detailPrice}>{selected.price.toFixed(2)} $</Text>
                  <Text style={styles.detailDesc}>{selected.description}</Text>
                  <View style={styles.stockRow}>
                    <Ionicons name="cube-outline" size={16} color={colors.onSurfaceSecondary} />
                    <Text style={styles.stockText}>{selected.stock} en stock</Text>
                  </View>
                </View>
              </ScrollView>
              <View style={styles.buyBar}>
                <Pressable
                  testID="product-buy-btn"
                  style={styles.buyBtn}
                  onPress={buy}
                  disabled={busy || selected.stock <= 0}
                >
                  {busy ? <ActivityIndicator color={colors.white} /> : (
                    <>
                      <Ionicons name="bag-add" size={20} color={colors.white} />
                      <Text style={styles.buyBtnText}>{selected.stock > 0 ? "ACHETER MAINTENANT" : "RUPTURE DE STOCK"}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {toast && (
        <View style={styles.toast} testID="boutique-toast">
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  heading: { ...typography.displayLG, color: colors.white, fontSize: 30 },
  subheading: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2 },
  chipRowWrap: { height: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.label, color: colors.onSurfaceSecondary, fontSize: 11 },
  chipTextActive: { color: colors.white },
  pCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  pImg: { width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceTertiary },
  pBody: { padding: spacing.md },
  pName: { ...typography.bodyBold, color: colors.white, fontSize: 13, minHeight: 34 },
  pFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.sm },
  pPrice: { ...typography.displaySM, color: colors.brandGold, fontSize: 16 },
  pLow: { ...typography.label, color: colors.brand, fontSize: 9 },
  closeBtn: {
    position: "absolute", top: spacing.md, right: spacing.md,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center",
  },
  detailCat: { ...typography.label, color: colors.brand, fontSize: 11 },
  detailName: { ...typography.displayMD, color: colors.white, fontSize: 26, marginTop: spacing.xs },
  detailPrice: { ...typography.displaySM, color: colors.brandGold, fontSize: 20, marginTop: spacing.sm },
  detailDesc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.md, fontSize: 14, lineHeight: 20 },
  stockRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  stockText: { ...typography.caption, color: colors.onSurfaceSecondary },
  buyBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  buyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md,
    backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md,
  },
  buyBtnText: { ...typography.label, color: colors.white, letterSpacing: 1.5 },
  toast: {
    position: "absolute", top: 60, left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.success,
  },
  toastText: { ...typography.body, color: colors.white, flex: 1 },
});
