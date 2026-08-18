import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius, typography } from "@/src/theme";

type Wrestler = { wrestler_id: string; name: string; nickname?: string; photo?: string; bio?: string; style?: string; wins: number; losses: number };
type Match = { match_id: string; wrestler_one: string; wrestler_two: string; event?: string; date: string; winner?: string; match_type?: string; status: string };
type Championship = { championship_id: string; title: string; current_holder?: string; image?: string };

type Tab = "roster" | "matches" | "championships";

function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; }
}

export default function Lutte() {
  const [tab, setTab] = useState<Tab>("roster");
  const [loading, setLoading] = useState(true);
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [champs, setChamps] = useState<Championship[]>([]);

  const load = useCallback(async () => {
    try {
      const [w, m, c] = await Promise.all([
        api.get<Wrestler[]>("/wrestlers"),
        api.get<Match[]>("/matches"),
        api.get<Championship[]>("/championships"),
      ]);
      setWrestlers(w); setMatches(m); setChamps(c);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.heading}>LUTTE LGDP</Text>
        <Text style={styles.subheading}>Le fief des durs.</Text>
      </View>
      <View style={styles.tabsBar}>
        {(["roster", "matches", "championships"] as Tab[]).map(t => (
          <Pressable
            key={t}
            testID={`lutte-tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "roster" ? "Roster" : t === "matches" ? "Matchs" : "Ceintures"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : tab === "roster" ? (
        <FlatList
          testID="wrestlers-list"
          data={wrestlers}
          keyExtractor={w => w.wrestler_id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: 140, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={styles.wCard} testID={`wrestler-${item.wrestler_id}`}>
              <Image source={{ uri: item.photo }} style={styles.wImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.95)"]} style={styles.wScrim} />
              <View style={styles.wInfo}>
                <Text style={styles.wStyle}>{(item.style || "").toUpperCase()}</Text>
                <Text style={styles.wName} numberOfLines={2}>{item.name.split(" ").slice(0, 3).join(" ")}</Text>
                <View style={styles.wStats}>
                  <Text style={styles.wStat}><Text style={{ color: colors.success }}>{item.wins}W</Text> · <Text style={{ color: colors.error }}>{item.losses}L</Text></Text>
                </View>
              </View>
            </View>
          )}
        />
      ) : tab === "matches" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}>
          <Text style={styles.blockLabel}>À VENIR</Text>
          {matches.filter(m => m.status === "upcoming").map(m => (
            <View key={m.match_id} style={styles.matchCard} testID={`match-${m.match_id}`}>
              <View style={styles.matchLeft}>
                <Text style={styles.matchDate}>{fmtDate(m.date)}</Text>
                <Text style={styles.matchType}>{m.match_type}</Text>
              </View>
              <View style={styles.matchVs}>
                <Text style={styles.matchWrestler}>{m.wrestler_one}</Text>
                <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
                <Text style={styles.matchWrestler}>{m.wrestler_two}</Text>
              </View>
              <Text style={styles.matchEvent}>{m.event}</Text>
            </View>
          ))}
          <Text style={[styles.blockLabel, { marginTop: spacing.lg }]}>RÉSULTATS</Text>
          {matches.filter(m => m.status === "completed").map(m => (
            <View key={m.match_id} style={[styles.matchCard, styles.matchDone]} testID={`match-${m.match_id}`}>
              <View style={styles.matchLeft}>
                <Text style={styles.matchDate}>{fmtDate(m.date)}</Text>
                <Text style={styles.matchType}>{m.match_type}</Text>
              </View>
              <View style={styles.matchVs}>
                <Text style={[styles.matchWrestler, m.winner === m.wrestler_one && styles.winner]}>{m.wrestler_one}</Text>
                <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
                <Text style={[styles.matchWrestler, m.winner === m.wrestler_two && styles.winner]}>{m.wrestler_two}</Text>
              </View>
              <Text style={styles.matchEvent}>🏆 {m.winner}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}>
          {champs.map(c => (
            <View key={c.championship_id} style={styles.champCard} testID={`champ-${c.championship_id}`}>
              <Image source={{ uri: c.image }} style={styles.champImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={StyleSheet.absoluteFillObject} />
              <View style={styles.champBody}>
                <Text style={styles.champTag}>CEINTURE</Text>
                <Text style={styles.champTitle}>{c.title}</Text>
                {c.current_holder ? (
                  <>
                    <Text style={styles.champLabel}>Champion actuel</Text>
                    <Text style={styles.champHolder}>{c.current_holder}</Text>
                  </>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  heading: { ...typography.displayLG, color: colors.white, fontSize: 30 },
  subheading: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2 },
  tabsBar: {
    flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, height: 36, justifyContent: "center" },
  tabBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { ...typography.label, color: colors.onSurfaceSecondary, fontSize: 11 },
  tabTextActive: { color: colors.white },
  wCard: { flex: 1, aspectRatio: 0.72, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  wImg: { ...StyleSheet.absoluteFillObject },
  wScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  wInfo: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md },
  wStyle: { ...typography.label, color: colors.brandGold, fontSize: 10 },
  wName: { ...typography.displaySM, color: colors.white, fontSize: 16, marginTop: 2 },
  wStats: { marginTop: spacing.xs },
  wStat: { ...typography.bodyBold, color: colors.white, fontSize: 13 },
  blockLabel: { ...typography.label, color: colors.brand, fontSize: 12, letterSpacing: 1.5 },
  matchCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  matchDone: { opacity: 0.85 },
  matchLeft: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  matchDate: { ...typography.label, color: colors.brandGold, fontSize: 11 },
  matchType: { ...typography.caption, color: colors.onSurfaceSecondary },
  matchVs: { flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "space-between" },
  matchWrestler: { ...typography.bodyBold, color: colors.white, flex: 1, fontSize: 14 },
  winner: { color: colors.brandGold },
  vsBadge: { backgroundColor: colors.brand, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  vsText: { ...typography.label, color: colors.white, fontSize: 10 },
  matchEvent: { ...typography.caption, color: colors.onSurfaceTertiary, marginTop: spacing.sm },
  champCard: { height: 200, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  champImg: { ...StyleSheet.absoluteFillObject },
  champBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg },
  champTag: { ...typography.label, color: colors.brandGold, fontSize: 11 },
  champTitle: { ...typography.displayMD, color: colors.white, marginTop: spacing.xs, fontSize: 22 },
  champLabel: { ...typography.caption, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  champHolder: { ...typography.bodyBold, color: colors.white, fontSize: 15 },
});
