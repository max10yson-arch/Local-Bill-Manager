import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGitHubAdmin } from "@/context/GitHubAdminContext";
import { useColors } from "@/hooks/useColors";

export function LoginForm() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const gh = useGitHubAdmin();
  const [username, setUsername] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !repo.trim() || !token.trim()) {
      return;
    }
    setBusy(true);
    const ok = await gh.login(username.trim(), repo.trim(), token.trim());
    setBusy(false);
    if (!ok) {
      // error shown via gh.error
    }
  };

  const canSubmit = username.trim() && repo.trim() && token.trim();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Feather name="github" size={36} color="rgba(255,255,255,0.9)" />
          <Text style={styles.heroTitle}>Website Admin</Text>
          <Text style={styles.heroSub}>
            Connect to your Parinay Saree GitHub Pages repo to manage products,
            images, and site config.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field
            label="GitHub Username"
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. parinaysaree"
            icon="user"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Field
            label="Repository Name"
            value={repo}
            onChangeText={setRepo}
            placeholder="e.g. saree"
            icon="book"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.tokenRow}>
            <View style={styles.tokenIcon}>
              <Feather name="key" size={18} color={colors.mutedForeground} />
            </View>
            <View style={styles.tokenBody}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Personal Access Token (PAT)
              </Text>
              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="ghp_xxxxxxxxxxxx"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showToken}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.fieldInput, { color: colors.foreground }]}
              />
            </View>
            <Pressable onPress={() => setShowToken((v) => !v)} style={styles.eyeBtn}>
              <Feather
                name={showToken ? "eye-off" : "eye"}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>

        {gh.error ? (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{gh.error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => void handleLogin()}
          disabled={!canSubmit || busy}
          style={[
            styles.loginBtn,
            { backgroundColor: canSubmit ? colors.primary : colors.muted },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="log-in" size={18} color="#fff" />
              <Text style={styles.loginTxt}>Connect to Repository</Text>
            </>
          )}
        </Pressable>

        <View style={[styles.tipCard, { backgroundColor: colors.goldSoft }]}>
          <Feather name="info" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tipTitle, { color: colors.foreground }]}>
              How to get a PAT
            </Text>
            <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
              Go to GitHub → Settings → Developer Settings → Personal Access
              Tokens → Fine-grained tokens. Grant repo read &amp; write access.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldRow}>
      <View style={styles.tokenIcon}>
        <Feather name={icon} size={18} color={colors.mutedForeground} />
      </View>
      <View style={styles.tokenBody}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.fieldInput, { color: colors.foreground }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 18, gap: 16 },
  hero: {
    borderRadius: 28,
    padding: 28,
    gap: 12,
    alignItems: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  heroSub: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tokenIcon: {
    width: 36,
    alignItems: "center",
  },
  tokenBody: {
    flex: 1,
    paddingLeft: 8,
  },
  eyeBtn: {
    paddingLeft: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldInput: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    padding: 0,
  },
  divider: {
    height: 1,
    marginLeft: 52,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  errorText: {
    color: "#DC2626",
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 18,
  },
  loginBtn: {
    borderRadius: 19,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  loginTxt: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  tipCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  tipTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginBottom: 4,
  },
  tipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
});
