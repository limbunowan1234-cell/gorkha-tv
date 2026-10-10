import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

// SWARA's signature: a voice waveform whose envelope is a Himalayan ridge
// (the brand's own Ridge Wave idea) — tall in the middle, falling away to the
// sides. The bars breathe while a song plays and settle when it stops.
const ENVELOPE = [0.22, 0.32, 0.46, 0.62, 0.8, 0.95, 1, 0.9, 0.74, 0.58, 0.72, 0.84, 0.66, 0.48, 0.34, 0.24];

export default function Waveform({ playing, height = 56, color = colors.brand }) {
  const anims = useRef(ENVELOPE.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!playing) {
      anims.forEach((a) => a.stopAnimation());
      return undefined;
    }
    const loops = anims.map((a, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 420 + (i % 5) * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 420 + ((i * 3) % 5) * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [playing, anims]);

  return (
    <View style={[styles.row, { height }]}>
      {ENVELOPE.map((level, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: height * level,
              backgroundColor: color,
              opacity: playing ? 1 : 0.45,
              transform: [{ scaleY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [playing ? 0.45 : 0.7, 1] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  bar: { width: 5, borderRadius: 3 },
});
