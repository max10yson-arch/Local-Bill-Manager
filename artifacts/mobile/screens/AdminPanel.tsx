import React from "react";
import { ScrollView, View, Text, ActivityIndicator } from "react-native";
import { useGitHubAdmin } from "../context/GitHubAdminContext";
import { LoginForm } from "./Admin_Login";
import { Dashboard } from "./Admin_Dashboard";

export function AdminPanel() {
  const gh = useGitHubAdmin();
  if (!gh.isAuthed) return <LoginForm />;
  if (gh.loading) return <ActivityIndicator />;
  if (gh.error) return <Text style={{color:"red"}}>{gh.error}</Text>;
  return (
    <ScrollView>
      <Dashboard />
    </ScrollView>
  );
}