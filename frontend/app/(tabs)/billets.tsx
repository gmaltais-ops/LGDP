import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, typography } from "@/src/theme";

type Event = { event_id: string; name: string; date: string; location: string; description?: string; poster?: string; price: number; capacity: number };

function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "long", year: "numeric" }); } catch { return iso; }
}
function fmtTime(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function Billets() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Event | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setEvents(await api.get<Event[]>("/events")); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const purchase = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await api.post("/tickets/purchase", { event_id: selected.event_id, quantity: qty });
      setSelected(null);
      setToast(res.message || "Billet confirmé");
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast(e?.message || "Erreur");
      setTimeout(() => setToast(null), 3000);
    }
    setBusy(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.heading}>BILLETS</Text>
        <Text style={styles.subheading}>Ne rate pas le prochain choc.</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.lg }}>
        {events.map(ev => (
          <View key={ev.event_id} style={styles.card} testID={`billet-event-${ev.event_id}`}>
            <Image source={{ uri: ev.poster }} style={styles.cardImg} contentFit="cover" />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.cardScrim} />
            <View style={styles.cardBody}>
              <Text style={styles.cardDate}>{fmtDate(ev.date).toUpperCase()} • {fmtTime(ev.date)}</Text>
              <Text style={styles.cardName}>{ev.name}</Text>
              <Text style={styles.cardLoc}>{ev.location}</Text>
              {ev.description ? <Text style={styles.cardDesc} numberOfLines={2}>{ev.description}</Text> : null}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.priceLbl}>À partir de</Text>
                  <Text style={styles.priceVal}>{ev.price.toFixed(2)} $</Text>
                </View>
                <Pressable
                  testID={`billet-buy-${ev.event_id}`}
                  style={styles.buyBtn}
                  onPress={() => { setSelected(ev); setQty(1); }}
                >
                  <Ionicons name="ticket" size={18} color={colors.white} />
                  <Text style={styles.buyBtnText}>ACHETER</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* CHECKOUT MODAL */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !busy && setSelected(null)} />
          <View style={styles.sheet} testID="checkout-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetKicker}>CHECKOUT · SQUARE (DEMO)</Text>
            <Text style={styles.sheetTitle}>{selected?.name}</Text>
            <Text style={styles.sheetMeta}>{selected ? fmtDate(selected.date) : ""}</Text>
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLbl}>Quantité</Text>
              <View style={styles.qtyBox}>
                <Pressable style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))} testID="qty-minus"><Text style={styles.qtyBtnText}>−</Text></Pressable>
                <Text style={styles.qtyVal} testID="qty-val">{qty}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => setQty(qty + 1)} testID="qty-plus"><Text style={styles.qtyBtnText}>+</Text></Pressable>
              </View>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLbl}>Total</Text>
              <Text style={styles.totalVal}>{(selected ? selected.price * qty : 0).toFixed(2)} $</Text>
            </View>
            <View style={styles.mockNotice}>
              <Ionicons name="information-circle" size={16} color={colors.brandGold} />
              <Text style={styles.mockText}>Paiement Square MOCKÉ pour le MVP</Text>
            </View>
            <Pressable style={styles.payBtn} onPress={purchase} disabled={busy} testID="checkout-pay-btn">
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.payBtnText}>PAYER AVEC SQUARE</Text>}
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setSelected(null)} disabled={busy}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {toast && (
        <View style={styles.toast} testID="billet-toast">
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
  card: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, minHeight: 320 },
  cardImg: { ...StyleSheet.absoluteFillObject },
  cardScrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  cardBody: { padding: spacing.lg, paddingTop: 180 },
  cardDate: { ...typography.label, color: colors.brandGold, fontSize: 11 },
  cardName: { ...typography.displayMD, color: colors.white, fontSize: 24, marginTop: spacing.xs },
  cardLoc: { ...typography.bodyBold, color: colors.onSurfaceSecondary, marginTop: 2, fontSize: 13 },
  cardDesc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm, fontSize: 13 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.md },
  priceLbl: { ...typography.caption, color: colors.onSurfaceSecondary },
  priceVal: { ...typography.displaySM, color: colors.white, fontSize: 22 },
  buyBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md,
  },
  buyBtnText: { ...typography.label, color: colors.white, fontSize: 12, letterSpacing: 1 },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  sheetKicker: { ...typography.label, color: colors.brand, fontSize: 11 },
  sheetTitle: { ...typography.displayMD, color: colors.white, fontSize: 20, marginTop: spacing.xs },
  sheetMeta: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2 },
  qtyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  qtyLbl: { ...typography.bodyBold, color: colors.white },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, height: 44 },
  qtyBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  qtyBtnText: { ...typography.displaySM, color: colors.white, fontSize: 20 },
  qtyVal: { ...typography.bodyBold, color: colors.white, minWidth: 24, textAlign: "center" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  totalLbl: { ...typography.label, color: colors.onSurfaceSecondary },
  totalVal: { ...typography.displayMD, color: colors.brandGold, fontSize: 24 },
  mockNotice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  mockText: { ...typography.caption, color: colors.brandGold },
  payBtn: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
  payBtnText: { ...typography.label, color: colors.white, letterSpacing: 1.5 },
  cancelBtn: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm },
  cancelBtnText: { ...typography.body, color: colors.onSurfaceSecondary },
  toast: {
    position: "absolute", top: 60, left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.success,
  },
  toastText: { ...typography.body, color: colors.white, flex: 1 },
});
