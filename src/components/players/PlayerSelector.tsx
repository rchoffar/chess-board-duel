import { Check, Plus } from "lucide-react-native";
import { useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import type { Player } from "../../db/players";
import {
    fontFamily,
    fontSize,
    radius,
    spacing,
} from "../../design-system/theme";
import { useTheme } from "../../design-system/ThemeProvider";

interface PlayerSelectorProps {
  players: Player[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** Create a profile from the inline input; returns it (or null if invalid). */
  onCreate: (name: string) => Player | null;
}

/** Chip row to pick a profile for one side, with inline quick-create. */
export function PlayerSelector({
  players,
  selectedId,
  onSelect,
  onCreate,
}: PlayerSelectorProps) {
  const { colors } = useTheme();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    const player = onCreate(name);
    if (player) {
      onSelect(player.id);
      setName("");
      setCreating(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {players.map((player) => {
          const active = player.id === selectedId;
          return (
            <TouchableOpacity
              key={player.id}
              style={[
                styles.chip,
                {
                  backgroundColor: active
                    ? colors.accentTint
                    : colors.neutralTileBg,
                },
                active && { borderColor: colors.accent, borderWidth: 1 },
              ]}
              onPress={() => onSelect(active ? null : player.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? colors.accent : colors.textSecondary },
                ]}
              >
                {player.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[
            styles.chip,
            styles.newChip,
            { borderColor: colors.hairline },
          ]}
          onPress={() => setCreating((v) => !v)}
          activeOpacity={0.8}
        >
          <Plus size={14} color={colors.textTertiary} strokeWidth={2} />
          <Text style={[styles.chipText, { color: colors.textTertiary }]}>
            New
          </Text>
        </TouchableOpacity>
      </View>

      {creating && (
        <View style={styles.createRow}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface.fieldBg,
                borderColor: colors.surface.fieldBorder,
                color: colors.textPrimary,
              },
            ]}
            placeholder="Player name"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            returnKeyType="done"
            autoFocus
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              { backgroundColor: colors.accentBright },
              !name.trim() && styles.addBtnDisabled,
            ]}
            onPress={submit}
            disabled={!name.trim()}
            activeOpacity={0.85}
          >
            <Check size={18} color="#0A0A0F" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
  },
  newChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  chipText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  createRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
  },
  addBtn: {
    width: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
});
