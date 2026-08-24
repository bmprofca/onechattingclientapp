import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform } from 'react-native';

interface KeyboardContextType {
  isKeyboardVisible: boolean;
  keyboardHeight: number;
  keyboardHeightAnim: Animated.Value;
}

const KeyboardContext = createContext<KeyboardContextType>({
  isKeyboardVisible: false,
  keyboardHeight: 0,
  keyboardHeightAnim: new Animated.Value(0),
});

export const KeyboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates.height;
      setIsKeyboardVisible(true);
      setKeyboardHeight(height);
      Animated.timing(keyboardHeightAnim, {
        toValue: height,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 20,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 20,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeightAnim]);

  return (
    <KeyboardContext.Provider
      value={{
        isKeyboardVisible,
        keyboardHeight,
        keyboardHeightAnim,
      }}
    >
      {children}
    </KeyboardContext.Provider>
  );
};

export const useKeyboardContext = () => useContext(KeyboardContext);
