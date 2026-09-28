import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { RootStackParamList } from "../../types";

/** A PDF rendered in a plain embedded WebView - no address bar, no chrome - so a document's
 * signed storage URL (with its access token) is never shown to whoever opens it. */
export const PdfViewerScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, "PdfViewer">>();
  const { url } = route.params;
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <WebView
        source={{ uri: url }}
        style={styles.flex}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState={false}
      />
      {loading ? (
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
