# Keyboard-Aware Bottom Sheet Modals Pattern

This document explains the standard design pattern and architecture in **OneChat** for creating bottom sheet modals that:
1. Start at the **screen bottom** by default.
2. Dynamically lift and start directly **above the active keyboard** without UI clipping, blinking, or jumping.

---

## 1. Core Architecture

The solution combines three parts:

```
┌─────────────────────────────────────────────────────────┐
│                     <SlideUpModal>                      │
│  (Handles translucent backdrop, spring slide-up anim,   │
│   backdrop touch dismissal & hardware back button)      │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │             <KeyboardAvoidView>                 │   │
│   │  (Listens to KeyboardContext animated height    │   │
│   │   and adjusts bottom padding dynamically)       │   │
│   │                                                 │   │
│   │   ┌─────────────────────────────────────────┐   │   │
│   │   │             Modal Content               │   │   │
│   │   │  (Search bar, list, action buttons)     │   │   │
│   │   └─────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Components Involved

### A. [`SlideUpModal`](file:///c:/Users/modak/OneDrive/Desktop/OneChatClient/src/components/animations/SlideUpModal.tsx)
- Anchors content to `justifyContent: 'flex-end'` within a translucent modal.
- Provides smooth cubic slide-up/slide-down transitions.
- Supports customizable `maxHeight` (e.g. `'80%'` or `'90%'`).

### B. [`KeyboardAvoidView`](file:///c:/Users/modak/OneDrive/Desktop/OneChatClient/src/components/KeyboardAvoidView.tsx)
- Connects directly to `KeyboardContext` via `keyboardHeightAnim`.
- Automatically animates `paddingBottom` matching keyboard height smoothly on Android & iOS.
- Setting `style={{ flex: 0 }}` ensures the sheet only occupies its content height rather than stretching fullscreen.

---

## 3. Recommended Code Template

Here is the standard implementation template to follow across screens:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../theme/theme';
import { ScalePressable, SlideUpModal } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';

export function ExampleScreen() {
  const theme = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounced search when query changes
  useEffect(() => {
    if (!modalOpen) return;
    const timer = setTimeout(() => {
      // perform search API call
    }, 300);
    return () => clearTimeout(timer);
  }, [query, modalOpen]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas }}>
      {/* Trigger */}
      <ScalePressable onPress={() => { setQuery(''); setModalOpen(true); }}>
        <Text>Open Modal</Text>
      </ScalePressable>

      {/* Keyboard-aware Bottom Sheet Modal */}
      <SlideUpModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        maxHeight="80%"
      >
        <KeyboardAvoidView style={{ flex: 0 }}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Select Option</Text>
              <ScalePressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <X size={20} color={theme.muted} />
              </ScalePressable>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
              <Search size={16} color={theme.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search..."
                placeholderTextColor={theme.muted}
                style={[styles.searchInput, { color: theme.ink }]}
              />
            </View>

            {/* Results List */}
            {loading ? (
              <ActivityIndicator color={theme.emerald} style={{ padding: 24 }} />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item, idx) => String(item.id || idx)}
                style={{ maxHeight: 360, marginTop: 10 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <ScalePressable
                    onPress={() => {
                      // handle select
                      setModalOpen(false);
                    }}
                    style={[styles.itemRow, { borderBottomColor: theme.border }]}
                  >
                    <Text style={{ color: theme.ink }}>{item.name}</Text>
                  </ScalePressable>
                )}
              />
            )}
          </View>
        </KeyboardAvoidView>
      </SlideUpModal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    padding: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
});
```

---

## 4. Key Rules & Best Practices

1. **Use `flex: 0` on `<KeyboardAvoidView>`** inside the modal so padding directly moves the bottom sheet upward without causing unwanted full-screen expansion.
2. **Always set `keyboardShouldPersistTaps="handled"`** on `FlatList` or `ScrollView` inside the modal so selecting an item triggers on the very first touch while the keyboard is visible.
3. **Debounce queries (250–350ms)** to prevent multiple concurrent API calls and state jitter while typing.
4. **Reset search query state** when opening the sheet to ensure clean state transitions.
