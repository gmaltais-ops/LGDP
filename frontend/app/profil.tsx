import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, typography } from "@/src/theme";

type Ticket = { ticket_id: string; event_name: string; event_date: string; event_location: string; quantity: number; total: number; status: string; purchase_date: string };
type Order = { order_id: string; product_name: string; product_image?: string; quantity: number; total: number; date: string };
type Episode = { episode_id: string; title: string; episode_number: number; cover_image?: string };

function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; }
}

export default function Profil() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [favs, setFavs] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tickets" | "orders" | "favs">("tickets");

  const load = useCallback(async () => {
    try {
      const [t, o, f] = await Promise.all([
        api.get<Ticket[]>("/tickets/me"),
        api.get<Order[]>("/orders/me"),
        api.get<Episode[]>("/favorites"),
      ]);
      setTickets(t); setOrders(o); setFavs(f);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} testID="profil-back-btn" style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <Pressable onPress={async () => { await logout(); router.replace("/(auth)/welcome"); }} testID="profil-logout-btn" style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} contentFit="cover" />
            ) : (
              <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.is_admin && (
            <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>ADMIN LGDP</Text></View>
          )}
          {user.is_admin && (
            <Pressable
              testID="profil-admin-btn"
              style={styles.adminAccessBtn}
              onPress={() => router.push("/admin" as any)}
            >
              <Ionicons name="key" size={16} color={colors.white} />
              <Text style={styles.adminAccessText}>PANNEAU ADMIN</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.tabsBar}>
          {(["tickets", "orders", "favs"] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} testID={`profil-tab-${t}`}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "tickets" ? "Billets" : t === "orders" ? "Commandes" : "Favoris"}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            {tab === "tickets" && (tickets.length === 0 ? (
              <Text style={styles.empty} testID="profil-empty-tickets">Aucun billet acheté.</Text>
            ) : tickets.map(t => (
              <View key={t.ticket_id} style={styles.ticket} testID={`ticket-${t.ticket_id}`}>
                <View style={styles.ticketLeft}>
                  <Text style={styles.ticketDate}>{fmtDate(t.event_date)}</Text>
                  <Text style={styles.ticketName} numberOfLines={2}>{t.event_name}</Text>
                  <Text style={styles.ticketLoc}>{t.event_location}</Text>
                  <Text style={styles.ticketMeta}>Qté: {t.quantity} · {t.total.toFixed(2)} $</Text>
                </View>
                <View style={styles.ticketRight}>
                  <View style={styles.qrPlaceholder}><Ionicons name="qr-code" size={48} color={colors.brand} /></View>
                  <Text style={styles.confirmedLbl}>{t.status.toUpperCase()}</Text>
                </View>
              </View>
            )))}

            {tab === "orders" && (orders.length === 0 ? (
              <Text style={styles.empty} testID="profil-empty-orders">Aucune commande.</Text>
            ) : orders.map(o => (
              <View key={o.order_id} style={styles.order} testID={`order-${o.order_id}`}>
                {o.product_image ? <Image source={{ uri: o.product_image }} style={styles.orderImg} contentFit="cover" /> : null}
                <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                  <Text style={styles.orderName}>{o.product_name}</Text>
                  <Text style={styles.orderMeta}>Qté: {o.quantity} · {fmtDate(o.date)}</Text>
                </View>
                <Text style={styles.orderTotal}>{o.total.toFixed(2)} $</Text>
              </View>
            )))}

            {tab === "favs" && (favs.length === 0 ? (
              <Text style={styles.empty} testID="profil-empty-favs">Aucun favori.</Text>
            ) : favs.map(f => (
              <Pressable
                key={f.episode_id} style={styles.order}
                onPress={() => router.push(`/episode/${f.episode_id}` as any)}
                testID={`fav-${f.episode_id}`}
              >
                {f.cover_image ? <Image source={{ uri: f.cover_image }} style={styles.orderImg} contentFit="cover" /> : null}
                <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                  <Text style={styles.orderMeta}>ÉP {f.episode_number}</Text>
                  <Text style={styles.orderName} numberOfLines={2}>{f.title}</Text>
                </View>
                <Ionicons name="heart" size={20} color={colors.brand} />
              </Pressable>
            )))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.surfaceSecondary },
  profileHeader: { alignItems: "center", paddingVertical: spacing.lg },
  avatarWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
    overflow: "hidden", borderWidth: 2, borderColor: colors.brandGold,
  },
  avatar: { width: 96, height: 96 },
  avatarInitial: { ...typography.displayLG, color: colors.white, fontSize: 44 },
  userName: { ...typography.displayMD, color: colors.white, marginTop: spacing.md, fontSize: 22 },
  userEmail: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2 },
  adminBadge: { marginTop: spacing.sm, backgroundColor: colors.brandGold, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm },
  adminBadgeText: { ...typography.label, color: colors.black, fontSize: 10 },
  adminAccessBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.md, marginTop: spacing.md,
  },
  adminAccessText: { ...typography.label, color: colors.white, letterSpacing: 1, fontSize: 11 },
  tabsBar: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.md },
  tabBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  tabBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { ...typography.label, color: colors.onSurfaceSecondary, fontSize: 11 },
  tabTextActive: { color: colors.white },
  empty: { ...typography.body, color: colors.onSurfaceSecondary, textAlign: "center", paddingVertical: spacing.xl },
  ticket: {
    flexDirection: "row", backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  ticketLeft: { flex: 1 },
  ticketDate: { ...typography.label, color: colors.brandGold, fontSize: 11 },
  ticketName: { ...typography.displaySM, color: colors.white, fontSize: 16, marginTop: spacing.xs },
  ticketLoc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2, fontSize: 12 },
  ticketMeta: { ...typography.caption, color: colors.onSurfaceTertiary, marginTop: spacing.sm },
  ticketRight: { alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.md },
  qrPlaceholder: { width: 64, height: 64, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm },
  confirmedLbl: { ...typography.label, color: colors.success, fontSize: 9, marginTop: spacing.xs },
  order: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  orderImg: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  orderName: { ...typography.bodyBold, color: colors.white, fontSize: 14 },
  orderMeta: { ...typography.caption, color: colors.onSurfaceSecondary, marginTop: 2 },
  orderTotal: { ...typography.displaySM, color: colors.brandGold, fontSize: 15 },
});
