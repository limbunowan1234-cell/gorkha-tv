import { StatusBar } from 'expo-status-bar';
import { Linking, SafeAreaView, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// UKAALI (formerly "GorkhaTV Flash") — a genuinely single-purpose app: opens directly
// on the site's own Shorts/Feed hub and stays there. Same file shape as every other
// Gorkha TV product app (CHIMAL, KHABAR, SWARA) — only SITE_URL/ALLOWED_PATTERNS/the
// brand color differ. UKAALI's own allowlist shape differs from the others since it
// isn't a /genre/:slug destination — it's /pages/feed.html plus individual short
// permalinks (functions/shorts/[id].js on the website). Unlike KHABAR, this app has
// no known router-bypass issue: /pages/feed.html isn't a router-participating page.
const SITE_URL = 'https://gorkhatv.site/pages/feed.html';
const SITE_ORIGIN = 'https://gorkhatv.site';

const ALLOWED_PATTERNS = [
  /^\/pages\/feed\.html$/,
  /^\/shorts\/[^/?#]+$/,
  /^\/[a-z0-9]+$/, // root-level creator profiles, e.g. /apurvatamang
];

function isAllowed(url) {
  try {
    const u = new URL(url);
    return u.origin === SITE_ORIGIN && ALLOWED_PATTERNS.some((re) => re.test(u.pathname));
  } catch {
    return false;
  }
}

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#101216" />
      <WebView
        source={{ uri: SITE_URL }}
        style={styles.webview}
        allowsBackForwardNavigationGestures
        startInLoadingState
        // Without this, WKWebView (iOS) pulls any embedded/HTML5 video —
        // including the site's YouTube player — into its own native
        // fullscreen player instead of playing inline like real Safari
        // does. The website's own player already sets playsinline:1, but
        // that only takes effect once the WebView itself is configured to
        // allow it.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Keeps this app a genuinely locked, single-purpose experience — a
        // navigation outside ALLOWED_PATTERNS never loads inside the
        // WebView; it opens in the device's own browser instead, so there's
        // still a real escape hatch to the full site, just not one that
        // breaks the focused feel of this app.
        // req.isTopFrame is the load-bearing check here: this handler fires
        // for EVERY frame navigation, not just the page the user is on —
        // including the site's own embedded YouTube <iframe> and assorted
        // about:blank placeholder frames. Without this check, the allowlist
        // was blocking the video iframe itself (confirmed via a real-device
        // crash log: "Unable to open URL: https://www.youtube.com/embed/...",
        // since a non-top-frame request that fails isAllowed() was getting
        // routed to Linking.openURL() exactly like a real navigation would).
        // Only an actual top-level navigation should ever be scoped.
        onShouldStartLoadWithRequest={(req) => {
          if (!req.isTopFrame) return true;
          if (isAllowed(req.url)) return true;
          Linking.openURL(req.url);
          return false;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101216',
  },
  webview: {
    flex: 1,
    backgroundColor: '#101216',
  },
});
