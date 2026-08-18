import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { usePlayer, Episode } from "@/src/context/PlayerContext";
import { colors, spacing, radius, typography } from "@/src/theme";

function fmtDur(sec?: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Podcast() {
  const router = useRouter();
  const { play, current, isPlaying, toggle } = usePlayer();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setEpisodes(await api.get<Episode[]>("/episodes")); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  const featured = episodes[0];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <FlatList
        testID="episodes-list"
        data={episodes.slice(1)}
        keyExtractor={e => e.episode_id}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.heading}>PODCAST</Text>
              <Text style={styles.subheading}>Les Gars du Podcast</Text>
            </View>
            {featured && (
              <Pressable
                style={styles.featured}
                testID={`episode-featured-${featured.episode_id}`}
                onPress={() => router.push(`/episode/${featured.episode_id}` as any)}
              >
                <Image source={{ uri: featured.cover_image }} style={styles.featuredImg} contentFit="cover" />
                <View style={styles.featuredBody}>
                  <Text style={styles.featuredKicker}>DERNIER ÉPISODE · #{featured.episode_number}</Text>
                  <Text style={styles.featuredTitle} numberOfLines={2}>{featured.title}</Text>
                  <Text style={styles.featuredDesc} numberOfLines={3}>{featured.description}</Text>
                  <View style={styles.featuredActions}>
                    <Pressable
                      testID={`episode-play-${featured.episode_id}`}
                      style={styles.playPill}
                      onPress={() => {
                        if (current?.episode_id === featured.episode_id) toggle();
                        else play(featured);
                      }}
                    >
                      <Ionicons name={current?.episode_id === featured.episode_id && isPlaying ? "pause" : "play"} size={18} color={colors.white} />
                      <Text style={styles.playPillText}>{current?.episode_id === featured.episode_id && isPlaying ? "PAUSE" : "ÉCOUTER"}</Text>
                    </Pressable>
                    <Text style={styles.duration}>{fmtDur(featured.duration)}</Text>
                  </View>
                </View>
              </Pressable>
            )}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tous les épisodes</Text>
              <View style={styles.sectionRule} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.epCard}
            testID={`episode-${item.episode_id}`}
            onPress={() => router.push(`/episode/${item.episode_id}` as any)}
          >
            <Image source={{ uri: item.cover_image }} style={styles.epImg} contentFit="cover" />
            <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
              <Text style={styles.epNum}>ÉP {item.episode_number}</Text>
              <Text style={styles.epTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.epDur}>{fmtDur(item.duration)}</Text>
            </View>
            <Pressable
              testID={`episode-play-${item.episode_id}`}
              onPress={(e) => { e.stopPropagation?.(); play(item); }}
              hitSlop={10}
              style={styles.epPlay}
            >
              <Ionicons name="play" size={20} color={colors.white} />
            </Pressable>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  heading: { ...typography.displayLG, color: colors.white, fontSize: 30 },
  subheading: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: 2 },
  featured: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    borderRadius: radius.lg, overflow: "hidden",
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  featuredImg: { width: "100%", aspectRatio: 1.4, backgroundColor: colors.surfaceTertiary },
  featuredBody: { padding: spacing.lg },
  featuredKicker: { ...typography.label, color: colors.brandGold, fontSize: 11 },
  featuredTitle: { ...typography.displayMD, color: colors.white, fontSize: 20, marginTop: spacing.xs },
  featuredDesc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm, fontSize: 13 },
  featuredActions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  playPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill,
  },
  playPillText: { ...typography.label, color: colors.white, fontSize: 12, letterSpacing: 1.5 },
  duration: { ...typography.caption, color: colors.onSurfaceSecondary },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { ...typography.displayMD, color: colors.white, fontSize: 20 },
  sectionRule: { flex: 1, height: 2, backgroundColor: colors.brand },
  epCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm,
  },
  epImg: { width: 68, height: 68, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  epNum: { ...typography.label, color: colors.brand, fontSize: 10 },
  epTitle: { ...typography.bodyBold, color: colors.white, fontSize: 14, marginTop: 2 },
  epDur: { ...typography.caption, color: colors.onSurfaceSecondary, marginTop: 2 },
  epPlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
