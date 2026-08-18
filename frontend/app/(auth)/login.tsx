import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as ExpoLinking from "expo-linking";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, typography } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const { login, loginWithEmergentSession } = useAuth();
  const [email, setEmail] = useState("fan@lgdp.ca");
  const [password, setPassword] = useState("Fan2026!");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLogin = async () => {
    setBusy(true); setError(null);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Erreur de connexion");
    } finally { setBusy(false); }
  };

  const doGoogle = async () => {
    setBusy(true); setError(null);
    try {
      const redirectUrl =
        Platform.OS === "web"
          ? (typeof window !== "undefined" ? window.location.origin + "/" : "/")
          : ExpoLinking.createURL("");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type !== "success" || !result.url) {
        setError("Connexion Google annulée");
        return;
      }
      const url = result.url;
      const hashIdx = url.indexOf("#");
      const hash = hashIdx >= 0 ? url.substring(hashIdx + 1) : "";
      const queryIdx = url.indexOf("?");
      const query = queryIdx >= 0 ? url.substring(queryIdx + 1) : "";
      const params = new URLSearchParams(hash || query);
      const sessionId = params.get("session_id");
      if (!sessionId) { setError("Aucun session_id dans la réponse"); return; }
      await loginWithEmergentSession(sessionId);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Google Auth échec");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="login-back-btn">
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </Pressable>

          <Text style={styles.eyebrow}>BIENVENUE</Text>
          <Text style={styles.title}>Se connecter</Text>
          <Text style={styles.subtitle}>Accède à ton univers LGDP.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ton@courriel.ca"
              placeholderTextColor={colors.onSurfaceSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              testID="login-password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.onSurfaceSecondary}
              secureTextEntry
            />
          </View>

          {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

          <Pressable
            testID="login-submit-button"
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={doLogin}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>SE CONNECTER</Text>}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} /><Text style={styles.dividerText}>OU</Text><View style={styles.dividerLine} />
          </View>

          <Pressable
            testID="login-google-btn"
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
            onPress={doGoogle}
            disabled={busy}
          >
            <Ionicons name="logo-google" size={20} color={colors.white} />
            <Text style={styles.googleBtnText}>Continuer avec Google</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/register")} style={{ alignItems: "center", marginTop: spacing.xl }}>
            <Text style={styles.footerText}>Pas encore membre? <Text style={{ color: colors.brand, fontWeight: "700" }}>Crée ton compte</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -spacing.sm, marginBottom: spacing.md },
  eyebrow: { ...typography.label, color: colors.brand },
  title: { ...typography.displayLG, color: colors.white, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.onSurfaceSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSecondary,
    color: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  primaryBtn: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
  primaryBtnText: { ...typography.label, color: colors.white, fontSize: 14, letterSpacing: 1.5 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.xl, gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.label, color: colors.onSurfaceSecondary },
  googleBtn: {
    flexDirection: "row", gap: spacing.md, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: spacing.lg, borderRadius: radius.md,
  },
  googleBtnText: { ...typography.bodyBold, color: colors.white, fontSize: 15 },
  error: { color: colors.error, marginBottom: spacing.md, ...typography.body },
  footerText: { color: colors.onSurfaceSecondary, ...typography.body },
});
