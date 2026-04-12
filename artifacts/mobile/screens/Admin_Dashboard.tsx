import React from "react";
import { View, Text, Button, ScrollView } from "react-native";
import { useGitHubAdmin } from "../context/GitHubAdminContext";
export function Dashboard() {
  const gh = useGitHubAdmin();
  return (
    <ScrollView style={{padding:16}}>
      <Text style={{fontSize:20, fontWeight:"bold"}}>Admin Dashboard</Text>
      <Text style={{marginTop:8, color:"gray"}}>Repo: <Text style={{fontWeight:"bold"}}>{gh.auth?.username}/{gh.auth?.repo}</Text></Text>
      <Text style={{marginTop:8, color:"gray"}}>Products: Sarees:{gh.products.sarees.length} Bedsheets:{gh.products.bedsheets.length}</Text>
      <Button title="Sync Catalog" onPress={gh.refreshCatalog} />
      <Button title="Commit Changes" onPress={()=>{/* show commit modal */}} />
    </ScrollView>
  );
}