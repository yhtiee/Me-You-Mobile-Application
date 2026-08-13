import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckIcon, PlusIcon } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { measure, useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/components/providers/theme-provider';
import { REQUIREMENT_LABELS, SOCIAL_NETWORKS, type SocialKey } from '@/constants/profile';
import { gradients, icon, palette, radius, shadow, space } from '@/constants/tokens';

const AVATAR = 116;

/**
 * Your profile — the photo, the number, the handles.
 *
 * Built around a strength meter that moves as you type rather than only on
 * save. A form that grades you after the fact is a test; one that fills in
 * front of you is a thing you finish. The meter reads from the *draft*, not the
 * saved row, which is the whole reason it feels responsive.
 *
 * Everything on this screen is your own row. Your partner sees the photo and
 * the display name on the couple banner; the phone number and handles are
 * theirs to look up, not the app's to broadcast.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { profile, loading, error, refetch, save, saving, changeAvatar, uploading } = useProfile();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [socials, setSocials] = useState<Partial<Record<SocialKey, string>>>({});

  if (loading) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <Screen gap={space.xl}>
        <ErrorState message={error ?? 'We couldn’t load your profile.'} onRetry={refetch} />
      </Screen>
    );
  }

  // Draft values win once touched; everything else shows what is stored.
  const nameValue = displayName ?? profile.displayName;
  const phoneValue = phone ?? profile.phone ?? '';
  const socialValue = (key: SocialKey) => socials[key] ?? profile.socials[key] ?? '';

  /*
   * The meter grades the draft, so a handle typed but not yet saved already
   * counts. `measure` is the same function the home prompt uses — the two can
   * never disagree about what is still missing.
   */
  const draft = {
    ...profile,
    phone: phoneValue,
    socials: Object.fromEntries(
      SOCIAL_NETWORKS.map((network) => [network.key, socialValue(network.key)])
    ) as Record<SocialKey, string>,
  };
  const completeness = measure(draft);

  const submit = async () => {
    const ok = await save({ displayName: nameValue, phone: phoneValue, socials: draft.socials });
    if (ok) router.back();
  };

  return (
    <Screen gap={space.xl}>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profile.avatarUrl ? 'Change your photo' : 'Add a photo'}
          disabled={uploading}
          onPress={() => void changeAvatar()}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              width: AVATAR,
              height: AVATAR,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: theme.color.surfaceSunken,
              // The wash the whole app runs on, used here as a ring so an empty
              // avatar still looks like a place something belongs.
              borderWidth: 3,
              borderColor: theme.tint.rose.bg,
              boxShadow: shadow.s2,
            }}
          >
            {profile.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  experimental_backgroundImage: gradients.duo,
                }}
              >
                <Text role="display" color="#FFFFFF">
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}

            {uploading ? (
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(34,26,43,0.45)',
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>

          {/* The affordance, not a caption underneath it. */}
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 38,
              height: 38,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.brand.rose,
              borderWidth: 3,
              borderColor: theme.color.bgBase,
            }}
          >
            <PlusIcon size={icon.sm} color="#FFFFFF" />
          </View>
        </Pressable>

        <Text role="title2">{nameValue}</Text>
      </View>

      <StrengthMeter done={completeness.done} total={completeness.total} missing={completeness.missing} />

      <Card style={{ gap: space.lg }}>
        <TextField
          label="Display name"
          hint="What your partner sees on the couple banner."
          value={nameValue}
          onChangeText={setDisplayName}
          placeholder="Your name"
        />
        <TextField
          label="Phone number"
          hint="Only your partner ever sees this."
          value={phoneValue}
          onChangeText={setPhone}
          placeholder="+234 800 000 0000"
          keyboardType="phone-pad"
        />
      </Card>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Where else they can find you
        </Text>

        <Card style={{ gap: space.lg }}>
          {SOCIAL_NETWORKS.map((network) => {
            const value = socialValue(network.key);
            return (
              <View key={network.key} style={{ gap: space.sm - 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: network.color,
                    }}
                  />
                  <Text role="overline" color={theme.color.textTertiary} style={{ flex: 1 }}>
                    {network.label}
                  </Text>
                  {value.trim() ? <CheckIcon size={14} color={theme.color.success} /> : null}
                </View>

                <TextField
                  value={value}
                  onChangeText={(next) => setSocials((s) => ({ ...s, [network.key]: next }))}
                  placeholder={`@${network.placeholder}`}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            );
          })}
        </Card>
      </View>

      <Button
        label={saving ? 'Saving…' : 'Save profile'}
        full
        disabled={saving}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

/**
 * Three segments, one per requirement, filling as the draft does.
 *
 * A percentage would be smaller and say less. This says how many things are
 * left and names the next one, which is the only question someone looking at a
 * setup screen actually has.
 */
function StrengthMeter({
  done,
  total,
  missing,
}: {
  done: number;
  total: number;
  missing: readonly string[];
}) {
  const theme = useTheme();
  const complete = done === total;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm - 2 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              backgroundColor: i < done ? palette.brand.rose : theme.color.surfaceSunken,
            }}
          />
        ))}
      </View>

      <Text role="caption" color={complete ? theme.color.success : theme.color.textSecondary}>
        {complete
          ? 'All set. Nothing left to fill in.'
          : `${done} of ${total} — next up, ${REQUIREMENT_LABELS[
              missing[0] as keyof typeof REQUIREMENT_LABELS
            ].toLowerCase()}.`}
      </Text>
    </View>
  );
}

function ProfileSkeleton() {
  return (
    <Screen gap={space.xl}>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <Skeleton width={AVATAR} height={AVATAR} round={AVATAR / 2} />
        <Skeleton width={140} height={22} />
      </View>

      <Skeleton height={8} round={4} />

      <Card style={{ gap: space.lg }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ gap: space.sm }}>
            <Skeleton width={96} height={10} />
            <Skeleton height={48} round={radius.sm} />
          </View>
        ))}
      </Card>

      <Card style={{ gap: space.lg }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ gap: space.sm }}>
            <Skeleton width={72} height={10} />
            <Skeleton height={48} round={radius.sm} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
