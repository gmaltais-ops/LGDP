import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { usePlayer } from "@/src/context/PlayerContext";
import { colors, spacing, radius, typography } from "@/src/theme";
import { useRouter } from "expo-router";
import { Image } from "expo-image";

function MiniPlayer() {
  const { current, isPlaying, toggle, close } = usePlayer();
  const router = useRouter();
  if (!current) return null;
  return (
    <Pressable
      testID="mini-player"
      style={styles.mini}
      onPress={() => router.push(`/episode/${current.episode_id}` as any)}
    >
      <Image source={{ uri: current.cover_image }} style={styles.miniCover} contentFit="cover" />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.miniLabel}>ÉPISODE {current.episode_number}</Text>
        <Text style={styles.miniTitle} numberOfLines={1}>{current.title}</Text>
      </View>
      <Pressable onPress={toggle} testID="mini-player-toggle" hitSlop={10} style={styles.miniBtn}>
        <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={colors.white} />
      </Pressable>
      <Pressable onPress={close} testID="mini-player-close" hitSlop={10} style={styles.miniBtnGhost}>
        <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
      </Pressable>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 68,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.onSurfaceSecondary,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="lutte"
          options={{
            title: "Lutte",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "flame" : "flame-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="podcast"
          options={{
            title: "Podcast",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "mic" : "mic-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="billets"
          options={{
            title: "Billets",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "ticket" : "ticket-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="boutique"
          options={{
            title: "Boutique",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "bag" : "bag-outline"} size={22} color={color} />
            ),
          }}
        />
      </Tabs>
      <View style={styles.miniWrap} pointerEvents="box-none">
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  miniWrap: { position: "absolute", left: spacing.md, right: spacing.md, bottom: 76 },
  mini: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  miniCover: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  miniLabel: { ...typography.label, color: colors.brand, fontSize: 10 },
  miniTitle: { ...typography.bodyBold, color: colors.white, fontSize: 13, marginTop: 2 },
  miniBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm,
  },
  miniBtnGhost: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginLeft: spacing.xs },
});
