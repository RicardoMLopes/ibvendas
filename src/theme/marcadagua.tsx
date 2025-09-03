import React, { useEffect, useRef } from 'react';
import { View, Animated, Text, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');
const cols = Math.ceil(width / 150);
const rows = Math.ceil(height / 70);

export default function MarcaDagua() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const marcas = [];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const size = 14 + Math.random() * 12;
      const top = i * 60 + Math.random() * 20;
      const left = j * 130 + Math.random() * 40;
      const opacity = 0.05 + Math.random() * 0.05;

      const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 5 + Math.random() * 5], // leve ondulação vertical
      });

      marcas.push(
        <Animated.Text
          key={`${i}-${j}`}
          style={[
            styles.texto,
            {
              fontSize: size,
              top,
              left,
              opacity,
              transform: [{ rotate: '-30deg' }, { translateY }],
            },
          ]}
        >
          DATA ACCESS
        </Animated.Text>
      );
    }
  }

  return <View style={styles.container}>{marcas}</View>;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  texto: {
    position: 'absolute',
    color: '#000',
  },
});