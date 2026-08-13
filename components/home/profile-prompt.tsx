import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { CheckIcon, ChevronIcon } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/components/providers/theme-provider';
import { PROFILE_REQUIREMENTS, REQUIREMENT_LABELS } from '@/constants/profile';
import { icon, radius, space } from '@/constants/tokens';

/**
 * "Finish setting up" — shown on Home only while something is actually missing.
 *
 * It names the specific things rather than showing a bare percentage, and ticks
 * them off in place as they are filled. A nag that says "profile 66% complete"
 * makes the user open a screen to find out what it wants; this one has already
 * answered that, which is also why it can be small enough to live above the
 * fold without pushing the day's check-in down.
 *
 * Deliberately not dismissible. It disappears the moment it is satisfied, which
 * is a better exit than a "later" that has to be remembered across devices —
 * and there are exactly three things on it.
 */
export function ProfilePrompt() {
  const theme = useTheme();
  const { completeness, loading } = useProfile();

  // Nothing while loading: a prompt that appears a beat after the screen has
  // settled shoves everything below it down under the reader's thumb.
  if (loading || completeness.isComplete) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Finish your profile. ${completeness.done} of ${completeness.total} done.`}
      onPress={() => router.push('/profile')}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card style={{ gap: space.md, backgroundColor: theme.tint.amber.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text role="overline" color={theme.tint.amber.muted}>
              {completeness.done} of {completeness.total} done
            </Text>
            <Text role="cardTitle" color={theme.tint.amber.fg}>
              Finish setting up your profile
            </Text>
          </View>
          <ChevronIcon size={icon.sm} color={theme.tint.amber.muted} />
        </View>

        <View style={{ gap: space.sm }}>
          {PROFILE_REQUIREMENTS.map((requirement) => {
            const met = completeness.met.includes(requirement);
            return (
              <View
                key={requirement}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: met ? theme.tint.amber.muted : 'transparent',
                    borderWidth: met ? 0 : 1.5,
                    borderColor: theme.tint.amber.muted,
                  }}
                >
                  {met ? <CheckIcon size={12} color="#FFFFFF" /> : null}
                </View>
                <Text
                  role="caption"
                  color={met ? theme.color.textTertiary : theme.tint.amber.fg}
                  style={met ? { textDecorationLine: 'line-through' } : undefined}
                >
                  {REQUIREMENT_LABELS[requirement]}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>
    </Pressable>
  );
}
