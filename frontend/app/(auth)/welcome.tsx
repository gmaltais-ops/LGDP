import { View, Text, Pressable, StyleSheet, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, typography } from "@/src/theme";

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="welcome-screen">
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1716561388086-cbc1e07f9f65?w=1200&q=80" }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(13,14,18,0.4)", "rgba(13,14,18,0.85)", "rgba(13,14,18,1)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={{ flex: 1 }} />
        <View style={styles.brandBox}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LGDP</Text>
          </View>
          <Text style={styles.title}>LES GARS DU{"\n"}PODCAST</Text>
          <Text style={styles.tagline}>Le podcast qui frappe plus fort.</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            testID="welcome-signin-btn"
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.primaryBtnText}>SE CONNECTER</Text>
          </Pressable>
          <Pressable
            testID="welcome-signup-btn"
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.ghostBtnText}>Créer un compte</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  brandBox: { paddingBottom: spacing.xxl },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  badgeText: { ...typography.label, color: colors.white, letterSpacing: 2 },
  title: { ...typography.displayXL, color: colors.white, fontSize: 44, lineHeight: 46 },
  tagline: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.md, fontSize: 15 },
  actions: { gap: spacing.md },
  primaryBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryBtnText: { ...typography.label, color: colors.white, fontSize: 14, letterSpacing: 1.5 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  ghostBtnText: { ...typography.bodyBold, color: colors.white, fontSize: 15 },
});
