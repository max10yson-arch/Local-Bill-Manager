import { Stack } from "expo-router";
import React from "react";

export default function AdminStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Website admin",
        headerBackTitle: "Back",
      }}
    />
  );
}
