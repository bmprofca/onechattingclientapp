import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';

export function SearchClearButton({
  value,
  onClear,
  color,
}: {
  value: string;
  onClear: () => void;
  color: string;
}) {
  if (!value) return null;
  return (
    <Pressable
      onPress={onClear}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Clear search"
      style={styles.button}
    >
      <X size={16} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
