import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { usePlayer, Episode } from "@/src/context/PlayerContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, typography } from "@/src/theme";

type Event = { event_id: string; name: string; date: string; location: string; poster?: string; price: number };
type News = { news_id: string; title: string; description?: string; image?: string; category: string; date: string };
type HomeSection = { section_id: string; section_key: string; title?: string | null; subtitle?: string | null; image_url?: string | null; link?: string | null; enabled: boolean; order: number };

function fmtDate(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { play } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);

  const load = useCallback(async () => {
    try {
      const [ev, ep, nw, hs] = await Promise.all([
        api.get<Event[]>("/events"),
        api.get<Episode[]>("/episodes"),
        api.get<News[]>("/news"),
        api.get<HomeSection[]>("/home-sections").catch(() => [] as HomeSection[]),
      ]);
      setEvents(ev); setEpisodes(ep); setNews(nw); setHomeSections(hs);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const heroEvent = events[0];
  const latestEp = episodes[0];
  const bannerSection = homeSections.find(s => s.section_key === "banniere");

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {/* HERO */}
        <View style={styles.hero} testID="home-hero">
          <Image
            source={{ uri: bannerSection?.image_url || heroEvent?.poster || "https://images.unsplash.com/photo-1515175192010-cf3250992719?w=1200&q=80" }}
            style={StyleSheet.absoluteFillObject} contentFit="cover"
          />
          <LinearGradient colors={["rgba(13,14,18,0.2)", "rgba(13,14,18,0.9)", "rgba(13,14,18,1)"]} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={["top"]} style={styles.heroInner}>
            <View style={styles.topBar}>
              <View style={styles.brandTag}><Text style={styles.brandTagText}>LGDP</Text></View>
              <Pressable onPress={() => router.push("/profil" as any)} testID="home-profile-btn" style={styles.avatarBtn}>
                {user?.picture
                  ? <Image source={{ uri: user.picture }} style={styles.avatarImg} />
                  : <Ionicons name="person" size={20} color={colors.white} />}
              </Pressable>
            </View>
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <Text style={styles.heroKicker}>{bannerSection?.subtitle || "LE PODCAST QUI FRAPPE PLUS FORT"}</Text>
              <Text style={styles.heroTitle}>{bannerSection?.title || heroEvent?.name || "LGDP LIVE"}</Text>
              <Text style={styles.heroMeta}>{heroEvent ? `${fmtDate(heroEvent.date)} • ${heroEvent.location}` : ""}</Text>
              <View style={styles.heroActions}>
                <Pressable
                  testID="home-latest-podcast-btn"
                  style={styles.primaryBtn}
                  onPress={() => latestEp && play(latestEp)}
                >
                  <Ionicons name="play" size={18} color={colors.white} />
                  <Text style={styles.primaryBtnText}>DERNIER ÉPISODE</Text>
                </Pressable>
                <Pressable
                  testID="home-next-show-btn"
                  style={styles.ghostBtn}
                  onPress={() => router.push("/(tabs)/billets")}
                >
                  <Ionicons name="ticket-outline" size={18} color={colors.white} />
                  <Text style={styles.ghostBtnText}>PROCHAIN SHOW</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* NEWS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nouvelles</Text>
            <View style={styles.sectionRule} />
          </View>
          {news.map(n => (
            <Pressable key={n.news_id} style={styles.newsCard} testID={`news-card-${n.news_id}`}>
              {n.image ? <Image source={{ uri: n.image }} style={styles.newsImg} contentFit="cover" /> : null}
              <View style={styles.newsBody}>
                <Text style={styles.categoryTag}>{n.category.toUpperCase()}</Text>
                <Text style={styles.newsTitle}>{n.title}</Text>
                {n.description ? <Text style={styles.newsDesc} numberOfLines={2}>{n.description}</Text> : null}
                <Text style={styles.newsDate}>{fmtDate(n.date)}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* UPCOMING EVENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Événements à venir</Text>
            <View style={styles.sectionRule} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {events.map(ev => (
              <Pressable
                key={ev.event_id}
                testID={`home-event-${ev.event_id}`}
                style={styles.eventCard}
                onPress={() => router.push(`/event/${ev.event_id}` as any)}
              >
                <Image source={{ uri: ev.poster }} style={styles.eventImg} contentFit="cover" />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.eventScrim} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventDate}>{fmtDate(ev.date)}</Text>
                  <Text style={styles.eventName} numberOfLines={2}>{ev.name}</Text>
                  <Text style={styles.eventLoc} numberOfLines={1}>{ev.location}</Text>
                  <View style={styles.pricePill}><Text style={styles.pricePillText}>À partir de {ev.price.toFixed(0)}$</Text></View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* LATEST PODCAST */}
        {latestEp && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dernier podcast</Text>
              <View style={styles.sectionRule} />
            </View>
            <Pressable
              style={styles.podcastCard}
              testID="home-latest-episode-card"
              onPress={() => play(latestEp)}
            >
              <Image source={{ uri: latestEp.cover_image }} style={styles.podcastImg} contentFit="cover" />
              <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                <Text style={styles.categoryTag}>ÉPISODE {latestEp.episode_number}</Text>
                <Text style={styles.podcastTitle} numberOfLines={2}>{latestEp.title}</Text>
                <Text style={styles.podcastDesc} numberOfLines={2}>{latestEp.description}</Text>
              </View>
              <View style={styles.playBtn}>
                <Ionicons name="play" size={22} color={colors.white} />
              </View>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hero: { height: 460, backgroundColor: colors.surface },
  heroInner: { flex: 1, padding: spacing.lg },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandTag: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  brandTagText: { ...typography.label, color: colors.white, fontSize: 12, letterSpacing: 2 },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 40, height: 40 },
  heroKicker: { ...typography.label, color: colors.brandGold, marginBottom: spacing.sm, fontSize: 11 },
  heroTitle: { ...typography.displayLG, color: colors.white, fontSize: 36, lineHeight: 38 },
  heroMeta: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  heroActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md,
  },
  primaryBtnText: { ...typography.label, color: colors.white, fontSize: 12, letterSpacing: 1 },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md,
  },
  ghostBtnText: { ...typography.label, color: colors.white, fontSize: 12, letterSpacing: 1 },
  section: { marginTop: spacing.xl },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { ...typography.displayMD, color: colors.white, fontSize: 22 },
  sectionRule: { flex: 1, height: 2, backgroundColor: colors.brand },
  newsCard: {
    flexDirection: "row", backgroundColor: colors.surfaceSecondary,
    marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border,
  },
  newsImg: { width: 110, height: 110, backgroundColor: colors.surfaceTertiary },
  newsBody: { flex: 1, padding: spacing.md },
  categoryTag: { ...typography.label, color: colors.brand, fontSize: 10 },
  newsTitle: { ...typography.bodyBold, color: colors.white, fontSize: 15, marginTop: spacing.xs },
  newsDesc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 4, fontSize: 13 },
  newsDate: { ...typography.caption, color: colors.onSurfaceTertiary, marginTop: spacing.xs },
  eventCard: { width: 260, height: 340, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  eventImg: { ...StyleSheet.absoluteFillObject },
  eventScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  eventInfo: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md },
  eventDate: { ...typography.label, color: colors.brandGold, fontSize: 11 },
  eventName: { ...typography.displaySM, color: colors.white, marginTop: spacing.xs, fontSize: 20 },
  eventLoc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2, fontSize: 13 },
  pricePill: { alignSelf: "flex-start", backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.sm },
  pricePillText: { ...typography.label, color: colors.white, fontSize: 11 },
  podcastCard: {
    flexDirection: "row", alignItems: "center", padding: spacing.md,
    marginHorizontal: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  podcastImg: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  podcastTitle: { ...typography.bodyBold, color: colors.white, marginTop: spacing.xs, fontSize: 15 },
  podcastDesc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2, fontSize: 12 },
  playBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
