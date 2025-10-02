import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

type VariantStyles = {
  container: ViewStyle;
  label: TextStyle;
};

const VARIANT_STYLES: Record<ButtonVariant, VariantStyles> = {
  primary: {
    container: {
      backgroundColor: '#f5cb08'
    },
    label: {
      color: '#050505'
    }
  },
  secondary: {
    container: {
      backgroundColor: '#1f1f1f'
    },
    label: {
      color: '#ffffff'
    }
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#1f1f1f'
    },
    label: {
      color: '#1f1f1f'
    }
  },
  danger: {
    container: {
      backgroundColor: '#c0392b'
    },
    label: {
      color: '#ffffff'
    }
  },
  success: {
    container: {
      backgroundColor: '#27ae60'
    },
    label: {
      color: '#ffffff'
    }
  }
};

export default function ActionButton({
  label,
  onPress,
  variant = 'primary',
  style,
  disabled = false
}: ActionButtonProps) {
  const variantStyles = VARIANT_STYLES[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles.container,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style
      ]}
    >
      <Text style={[styles.label, variantStyles.label, disabled ? styles.disabledLabel : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.85
  },
  disabled: {
    opacity: 0.6
  },
  disabledLabel: {
    color: '#d0d0d0'
  }
});
