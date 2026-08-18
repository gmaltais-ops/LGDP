import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { usePlayer, Episode } from "@/src/context/PlayerContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, typography } from "@/src/theme";

function fmt(sec?: number) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EpisodeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { play, current, isPlaying, toggle, positionSec, durationSec, seek } = usePlayer();
  const [ep, setEp] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await api.get<Episode>(`/episodes/${id}`);
        setEp(e);
        if (user) {
          try {
            const favs = await api.get<Episode[]>("/favorites");
            setFavorited(favs.some(f => f.episode_id === id));
          } catch {}
        }
      } catch {}
      setLoading(false);
    })();
  }, [id, user]);

  const toggleFav = async () => {
    if (!ep) return;
    try {
      const res = await api.post<{ favorited: boolean }>("/favorites/toggle", { episode_id: ep.episode_id });
      setFavorited(res.favorited);
    } catch {}
  };

  const doShare = async () => {
    if (!ep) return;
    try {
      await Share.share({ title: ep.title, message: `Écoute cet épisode LGDP: ${ep.title}` });
    } catch {}
  };

  if (loading || !ep) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  const isCurrent = current?.episode_id === ep.episode_id;
  const pos = isCurrent ? positionSec : 0;
  const dur = (isCurrent && durationSec > 0) ? durationSec : (ep.duration || 0);
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={{ uri: ep.cover_image }} style={StyleSheet.absoluteFillObject} contentFit="cover" blurRadius={20} />
        <LinearGradient colors={["rgba(13,14,18,0.3)", "rgba(13,14,18,0.98)"]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView edges={["top"]}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} testID="episode-back-btn" style={styles.iconBtn}>
              <Ionicons name="chevron-down" size={26} color={colors.white} />
            </Pressable>
            <Pressable onPress={doShare} testID="episode-share-btn" style={styles.iconBtn}>
              <Ionicons name="share-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
          <View style={{ alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
            <Image source={{ uri: ep.cover_image }} style={styles.coverArt} contentFit="cover" />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.epKicker}>ÉPISODE {ep.episode_number}</Text>
        <Text style={styles.epTitle}>{ep.title}</Text>
        <Text style={styles.epDesc}>{ep.description}</Text>

        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.time}>{fmt(pos)}</Text>
            <Text style={styles.time}>{fmt(dur)}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable onPress={toggleFav} testID="episode-fav-btn" style={styles.controlBtn}>
            <Ionicons name={favorited ? "heart" : "heart-outline"} size={28} color={favorited ? colors.brand : colors.white} />
          </Pressable>
          <Pressable
            testID="episode-play-btn"
            style={styles.playBtn}
            onPress={() => {
              if (isCurrent) toggle();
              else play(ep);
            }}
          >
            <Ionicons name={isCurrent && isPlaying ? "pause" : "play"} size={36} color={colors.white} />
          </Pressable>
          <Pressable onPress={doShare} testID="episode-share2-btn" style={styles.controlBtn}>
            <Ionicons name="share-social-outline" size={28} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.seekRow}>
          <Pressable onPress={() => seek(Math.max(0, pos - 15))} style={styles.seekBtn} testID="seek-back-btn">
            <Ionicons name="play-back" size={18} color={colors.white} />
            <Text style={styles.seekTxt}>-15s</Text>
          </Pressable>
          <Pressable onPress={() => seek(pos + 30)} style={styles.seekBtn} testID="seek-fwd-btn">
            <Text style={styles.seekTxt}>+30s</Text>
            <Ionicons name="play-forward" size={18} color={colors.white} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hero: { height: 380 },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  coverArt: { width: 240, height: 240, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  body: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  epKicker: { ...typography.label, color: colors.brand, fontSize: 11 },
  epTitle: { ...typography.displayMD, color: colors.white, fontSize: 26, marginTop: spacing.sm },
  epDesc: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.md, lineHeight: 20, fontSize: 14 },
  progressRow: { marginTop: spacing.xl },
  progressBar: { height: 4, backgroundColor: colors.surfaceTertiary, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: colors.brand },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  time: { ...typography.caption, color: colors.onSurfaceSecondary },
  controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginTop: spacing.lg },
  controlBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  seekRow: { flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginTop: spacing.lg },
  seekBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  seekTxt: { ...typography.label, color: colors.white, fontSize: 11 },
});
