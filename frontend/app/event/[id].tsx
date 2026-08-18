import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, typography } from "@/src/theme";

type Event = { event_id: string; name: string; date: string; location: string; description?: string; poster?: string; price: number; capacity: number };

function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch { return iso; }
}
function fmtTime(iso?: string) {
  try { return new Date(iso!).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setEv(await api.get<Event>(`/events/${id}`)); } catch {}
      setLoading(false);
    })();
  }, [id]);

  const purchase = async () => {
    if (!ev) return;
    setBusy(true);
    try {
      const r = await api.post("/tickets/purchase", { event_id: ev.event_id, quantity: qty });
      setShowCheckout(false);
      setToast(r.message || "Billet confirmé");
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast(e?.message || "Erreur");
      setTimeout(() => setToast(null), 3000);
    }
    setBusy(false);
  };

  if (loading || !ev) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={{ uri: ev.poster }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <LinearGradient colors={["rgba(13,14,18,0.4)", "rgba(13,14,18,0.9)", colors.surface]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView edges={["top"]}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} testID="event-back-btn" style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.white} />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>LGDP LIVE</Text>
        <Text style={styles.title}>{ev.name}</Text>
        <View style={styles.infoRow}><Ionicons name="calendar" size={18} color={colors.brandGold} /><Text style={styles.infoText}>{fmtDate(ev.date)} • {fmtTime(ev.date)}</Text></View>
        <View style={styles.infoRow}><Ionicons name="location" size={18} color={colors.brandGold} /><Text style={styles.infoText}>{ev.location}</Text></View>
        <View style={styles.infoRow}><Ionicons name="people" size={18} color={colors.brandGold} /><Text style={styles.infoText}>{ev.capacity} places</Text></View>
        {ev.description ? <Text style={styles.desc}>{ev.description}</Text> : null}
      </ScrollView>

      <View style={styles.buyBar}>
        <View>
          <Text style={styles.priceLbl}>À partir de</Text>
          <Text style={styles.priceVal}>{ev.price.toFixed(2)} $</Text>
        </View>
        <Pressable testID="event-buy-btn" style={styles.buyBtn} onPress={() => setShowCheckout(true)}>
          <Ionicons name="ticket" size={18} color={colors.white} />
          <Text style={styles.buyBtnText}>ACHETER</Text>
        </Pressable>
      </View>

      <Modal visible={showCheckout} transparent animationType="slide">
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !busy && setShowCheckout(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetKicker}>CHECKOUT · SQUARE (DEMO)</Text>
            <Text style={styles.sheetTitle}>{ev.name}</Text>
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLbl}>Quantité</Text>
              <View style={styles.qtyBox}>
                <Pressable style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))}><Text style={styles.qtyBtnText}>−</Text></Pressable>
                <Text style={styles.qtyVal}>{qty}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => setQty(qty + 1)}><Text style={styles.qtyBtnText}>+</Text></Pressable>
              </View>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLbl}>Total</Text>
              <Text style={styles.totalVal}>{(ev.price * qty).toFixed(2)} $</Text>
            </View>
            <Pressable style={styles.payBtn} onPress={purchase} disabled={busy} testID="event-pay-btn">
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.payBtnText}>PAYER AVEC SQUARE</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {toast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hero: { height: 320 },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.xl, paddingBottom: 140 },
  eyebrow: { ...typography.label, color: colors.brand },
  title: { ...typography.displayLG, color: colors.white, fontSize: 30, marginTop: spacing.xs },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  infoText: { ...typography.body, color: colors.white, fontSize: 14 },
  desc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.lg, lineHeight: 22 },
  buyBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.lg, paddingBottom: spacing.xl,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  priceLbl: { ...typography.caption, color: colors.onSurfaceSecondary },
  priceVal: { ...typography.displayMD, color: colors.brandGold, fontSize: 24 },
  buyBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.md,
  },
  buyBtnText: { ...typography.label, color: colors.white, letterSpacing: 1.5 },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: spacing.xxl },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  sheetKicker: { ...typography.label, color: colors.brand },
  sheetTitle: { ...typography.displayMD, color: colors.white, marginTop: spacing.xs, fontSize: 20 },
  qtyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  qtyLbl: { ...typography.bodyBold, color: colors.white },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, height: 44 },
  qtyBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { ...typography.displaySM, color: colors.white, fontSize: 20 },
  qtyVal: { ...typography.bodyBold, color: colors.white, minWidth: 24, textAlign: "center" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  totalLbl: { ...typography.label, color: colors.onSurfaceSecondary },
  totalVal: { ...typography.displayMD, color: colors.brandGold, fontSize: 24 },
  payBtn: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.lg },
  payBtnText: { ...typography.label, color: colors.white, letterSpacing: 1.5 },
  toast: {
    position: "absolute", top: 60, left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.success,
  },
  toastText: { ...typography.body, color: colors.white, flex: 1 },
});
