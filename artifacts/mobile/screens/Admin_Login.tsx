import React, { useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import { useGitHubAdmin } from "../context/GitHubAdminContext";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const gh = useGitHubAdmin();
  return (
    <View style={{padding:32}}>
      <Text style={{fontWeight:"bold",fontSize:22,marginBottom:12}}>GitHub Admin Login</Text>
      <TextInput placeholder="GitHub Username" value={username} onChangeText={setUsername} />
      <TextInput placeholder="Repository" value={repo} onChangeText={setRepo} />
      <TextInput placeholder="Personal Access Token" value={token} onChangeText={setToken} secureTextEntry />
      <Button title="Login" onPress={async ()=>{ 
        const ok = await gh.login(username, repo, token);
        if (!ok) alert("Failed to login. Check credentials."); 
      }} />
    </View>
  );
}