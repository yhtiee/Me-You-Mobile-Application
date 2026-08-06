import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useTools } from '@/hooks/use-tools';
import { palette, space } from '@/constants/tokens';

/**
 * Date Setter (PRD Module 2), including the two named sub-features:
 * the Indecision Resolver and the guilt-free Raincheck.
 */
export default function DateTool() {
  const theme = useTheme();
  const { dateIdeas, addEvent } = useTools();
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [rainchecked, setRainchecked] = useState(false);
  const [saved, setSaved] = useState(false);

  const resolve = () => {
    const pick = dateIdeas[Math.floor(Math.random() * dateIdeas.length)];
    setSelected(pick.id);
    setTitle(pick.title);
    setLocation(pick.location);
  };

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.sm }}>
        <Text role="title2">Set a date</Text>
        <Text role="body" color={theme.color.textSecondary}>
          Pick one, or let us decide if neither of you will.
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        {dateIdeas.map((idea) => {
          const active = idea.id === selected;
          return (
            <Pressable
              key={idea.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setSelected(idea.id);
                setTitle(idea.title);
                setLocation(idea.location);
              }}
            >
              <Card accent={active ? palette.brand.rose : undefined} style={{ gap: space.xs }}>
                <Text role="cardTitle">{idea.title}</Text>
                <Text role="caption" color={theme.color.textSecondary}>
                  {idea.location} · {idea.time}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Button label="Can’t decide — pick for us" variant="secondary" full onPress={resolve} />

      <Card style={{ gap: space.lg }}>
        <Text role="cardTitle">Details</Text>
        <TextField label="What" placeholder="Dinner, walk, that class…" value={title} onChangeText={setTitle} />
        <TextField label="Where" placeholder="Add a location" value={location} onChangeText={setLocation} />
        <Button
          label={saved ? 'Added to your calendar' : 'Add to calendar'}
          full
          disabled={!title.trim() || saved}
          onPress={() => {
            addEvent({ title: title.trim(), date: new Date().toISOString().slice(0, 10), kind: 'date-night' });
            setSaved(true);
          }}
        />
      </Card>

      <Card
        style={{
          gap: space.md,
          backgroundColor: rainchecked ? palette.brand.roseSoft : theme.color.surface,
        }}
      >
        <Text role="cardTitle">Plans fell through?</Text>
        <Text role="body" color={theme.color.textSecondary}>
          {rainchecked
            ? 'Rainchecked. We’ll tell them gently — no pressure attached, and the streak is safe.'
            : 'Move it without it becoming a thing. No guilt, no streak damage.'}
        </Text>
        {!rainchecked ? (
          <Button label="Raincheck it" variant="neutral" full onPress={() => setRainchecked(true)} />
        ) : null}
      </Card>
    </Screen>
  );
}
