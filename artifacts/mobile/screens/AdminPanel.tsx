import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { useGitHubAdmin } from "@/context/GitHubAdminContext";

import { LoginForm } from "./Admin_Login";
import { SareeAdminDashboard } from "./SareeAdminDashboard";

export function AdminPanel() {
  const gh = useGitHubAdmin();
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    if (!gh.isAuthed) return;
    const sub = navigation.addListener("beforeRemove", (e) => {
      if (!gh.hasUnsavedChanges && !gh.hasUnsavedTranslations) return;
      e.preventDefault();
      Alert.alert("Unsaved changes", "Commit or discard your edits before leaving.", [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave anyway",
          style: "destructive",
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
    return sub;
  }, [navigation, gh.isAuthed, gh.hasUnsavedChanges, gh.hasUnsavedTranslations]);

  if (!gh.isAuthed) return <LoginForm />;
  if (gh.loading && !gh.products.sarees.length && !gh.products.bedsheets.length) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (gh.error && !gh.isAuthed) return <Text style={{ color: "red", padding: 24 }}>{gh.error}</Text>;
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 12,
        }}
      >
        <Pressable onPress={() => void gh.refreshCatalog()}>
          <Text style={{ color: "#8B123A", fontWeight: "600" }}>Sync</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await gh.logout();
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/settings");
          }}
        >
          <Text style={{ color: "#8B123A", fontWeight: "600" }}>Logout</Text>
        </Pressable>
      </View>
      <SareeAdminDashboard />
    </View>
  );
}