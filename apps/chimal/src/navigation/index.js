import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import BrowseScreen from '../screens/BrowseScreen';
import MyListScreen from '../screens/MyListScreen';
import TitleScreen from '../screens/TitleScreen';
import StudioScreen from '../screens/StudioScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.night, card: colors.night, text: colors.snow, border: 'transparent', primary: colors.brand },
};

const icon = (glyph) => ({ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.5 }}>{glyph}</Text> });

function Home() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.night, borderTopColor: 'rgba(244,241,234,0.08)', height: 58, paddingBottom: 6, paddingTop: 4 },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.mist,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={icon('🎬')} />
      <Tabs.Screen name="Browse" component={BrowseScreen} options={icon('🔎')} />
      <Tabs.Screen name="My List" component={MyListScreen} options={icon('🔖')} />
    </Tabs.Navigator>
  );
}

const headerOptions = {
  headerStyle: { backgroundColor: colors.night },
  headerTintColor: colors.snow,
  headerShadowVisible: false,
  title: '',
};

export default function AppNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={headerOptions}>
        <Stack.Screen name="Tabs" component={Home} options={{ headerShown: false }} />
        <Stack.Screen name="Title" component={TitleScreen} options={{ headerTransparent: false }} />
        <Stack.Screen name="Studio" component={StudioScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
