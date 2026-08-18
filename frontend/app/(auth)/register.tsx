import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, typography } from "@/src/theme";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doRegister = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Nom, email et mot de passe (min 6) sont requis.");
      return;
    }
    setBusy(true); setError(null);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Impossible de créer le compte");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="register-back-btn">
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </Pressable>
          <Text style={styles.eyebrow}>NOUVEAU FAN</Text>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoins l&apos;univers LGDP.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nom</Text>
            <TextInput testID="register-name-input" style={styles.input} value={name} onChangeText={setName}
              placeholder="Ton nom" placeholderTextColor={colors.onSurfaceSecondary} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput testID="register-email-input" style={styles.input} value={email} onChangeText={setEmail}
              placeholder="ton@courriel.ca" placeholderTextColor={colors.onSurfaceSecondary}
              autoCapitalize="none" keyboardType="email-address" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput testID="register-password-input" style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Min 6 caractères" placeholderTextColor={colors.onSurfaceSecondary} secureTextEntry />
          </View>

          {error ? <Text style={styles.error} testID="register-error">{error}</Text> : null}

          <Pressable
            testID="register-submit-button"
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={doRegister} disabled={busy}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>CRÉER MON COMPTE</Text>}
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/login")} style={{ alignItems: "center", marginTop: spacing.xl }}>
            <Text style={styles.footerText}>Déjà membre? <Text style={{ color: colors.brand, fontWeight: "700" }}>Se connecter</Text></Text>
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
    backgroundColor: colors.surfaceSecondary, color: colors.white,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, fontSize: 16,
  },
  primaryBtn: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
  primaryBtnText: { ...typography.label, color: colors.white, fontSize: 14, letterSpacing: 1.5 },
  error: { color: colors.error, marginBottom: spacing.md, ...typography.body },
  footerText: { color: colors.onSurfaceSecondary, ...typography.body },
});
