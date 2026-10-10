import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ReelsScreen from './ReelsScreen';
import SavedScreen from './SavedScreen';
import WatchScreen from './WatchScreen';
import { colors } from './theme';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.night, card: colors.night, text: colors.snow, border: 'transparent', primary: colors.brand },
};

function TabIcon({ glyph, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>;
}

function Home() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.night, borderTopColor: 'rgba(244,241,234,0.08)', height: 58, paddingBottom: 6, paddingTop: 4 },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.mist,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
      }}
    >
      <Tabs.Screen name="Reels" component={ReelsScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="▶️" focused={focused} /> }} />
      <Tabs.Screen name="Saved" component={SavedScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="💚" focused={focused} /> }} />
    </Tabs.Navigator>
  );
}

export default function AppNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Watch" component={WatchScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
