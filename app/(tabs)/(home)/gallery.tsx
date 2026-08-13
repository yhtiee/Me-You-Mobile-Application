import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CloseIcon, GalleryIcon, PlayIcon, PlusIcon } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useGallery, type MediaMonth } from '@/hooks/use-gallery';
import { useTheme } from '@/components/providers/theme-provider';
import { gutter, icon, palette, radius, shadow, space } from '@/constants/tokens';
import type { MediaItem } from '@/lib/gallery';

const COLUMNS = 3;
const GAP = 4;

/**
 * The couple's gallery — everything they've kept, filed by the month it
 * happened in.
 *
 * Two things make it read as a history rather than a folder. Months are
 * headings, so scrolling is scrolling backwards through time; and the first
 * item of each month is a wide hero tile, which breaks the grid's monotony at
 * exactly the interval that marks a new chapter. A flat 3-across grid of
 * identical squares is a file browser.
 */
export default function Gallery() {
  const theme = useTheme();
  const { months, items, loading, error, refetch, addFromLibrary, uploading, remove, setCaption } =
    useGallery();

  const [open, setOpen] = useState<MediaItem | null>(null);

  if (loading) return <GallerySkeleton />;

  if (error && items.length === 0) {
    return (
      <Screen gap={space.xl}>
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <>
      <Screen gap={space.xl}>
        <Card style={{ gap: space.lg, backgroundColor: theme.tint.success.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.color.surface,
              }}
            >
              <GalleryIcon size={icon.lg} color={theme.tint.success.fg} />
            </View>

            <View style={{ flex: 1, gap: space.xs }}>
              <Text role="cardTitle" color={theme.tint.success.fg}>
                {headline(items.length)}
              </Text>
              <Text role="caption" color={theme.tint.success.muted}>
                {months.length > 1
                  ? `Across ${months.length} months, oldest at the bottom.`
                  : 'Photos and clips, up to 5 MB each.'}
              </Text>
            </View>
          </View>

          <Button
            label={uploading ? 'Adding…' : '+ Add memories'}
            full
            disabled={uploading}
            onPress={() => void addFromLibrary()}
          />
        </Card>

        {items.length === 0 ? (
          <EmptyGallery onAdd={() => void addFromLibrary()} busy={uploading} />
        ) : (
          months.map((month) => (
            <MonthSection key={month.key} month={month} onOpen={setOpen} />
          ))
        )}
      </Screen>

      <Lightbox
        item={open}
        onClose={() => setOpen(null)}
        onDelete={(item) => {
          setOpen(null);
          remove(item);
        }}
        onCaption={setCaption}
      />
    </>
  );
}

/**
 * One month, hero tile first.
 *
 * The hero spans two columns and two rows, so the remaining tiles fill in
 * beside and under it — done with wrapping rather than a masonry library
 * because the sizes are fixed fractions of the width and nothing needs
 * measuring.
 */
function MonthSection({ month, onOpen }: { month: MediaMonth; onOpen: (item: MediaItem) => void }) {
  const theme = useTheme();
  const width = Dimensions.get('window').width - gutter * 2;
  const unit = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const [hero, ...rest] = month.items;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text role="overline" color={theme.color.textTertiary}>
          {month.label}
        </Text>
        <Text role="caption" color={theme.color.textTertiary}>
          {month.items.length}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        <Tile
          item={hero}
          size={unit * 2 + GAP}
          height={unit * 2 + GAP}
          onPress={() => onOpen(hero)}
        />
        {rest.map((item) => (
          <Tile
            key={item.id}
            item={item}
            size={unit}
            height={unit}
            onPress={() => onOpen(item)}
          />
        ))}
      </View>
    </View>
  );
}

function Tile({
  item,
  size,
  height,
  onPress,
}: {
  item: MediaItem;
  size: number;
  height: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={item.caption ?? (item.kind === 'video' ? 'A video' : 'A photo')}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: theme.color.surfaceSunken,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {/*
       * Videos show their poster frame if the platform can produce one, and a
       * grey tile plus the play badge if not — `expo-image` will not decode a
       * video, so this is deliberately a still, not a preview.
       */}
      <Image
        source={{ uri: item.url }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={160}
      />

      {item.kind === 'video' ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(34,26,43,0.28)',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.9)',
            }}
          >
            <PlayIcon size={16} color={palette.light.textPrimary} />
          </View>
        </View>
      ) : null}

      {item.caption ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space.sm,
            paddingVertical: space.xs,
            backgroundColor: 'rgba(34,26,43,0.55)',
          }}
        >
          <Text role="caption" color="#FFFFFF" numberOfLines={1}>
            {item.caption}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Full-screen viewer.
 *
 * Its own `Modal` rather than a route: the gallery is a grid you dip in and out
 * of, and a pushed screen per tap would put a back stack between the user and
 * the next photo. Videos get a real player; photos get the caption editor and
 * the delete.
 */
function Lightbox({
  item,
  onClose,
  onDelete,
  onCaption,
}: {
  item: MediaItem | null;
  onClose: () => void;
  onDelete: (item: MediaItem) => void;
  onCaption: (item: MediaItem, caption: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Modal
      visible={item !== null}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {item ? (
        <LightboxBody
          item={item}
          draft={draft}
          setDraft={setDraft}
          onClose={() => {
            setDraft(null);
            onClose();
          }}
          onDelete={onDelete}
          onCaption={onCaption}
        />
      ) : null}
    </Modal>
  );
}

function LightboxBody({
  item,
  draft,
  setDraft,
  onClose,
  onDelete,
  onCaption,
}: {
  item: MediaItem;
  draft: string | null;
  setDraft: (next: string) => void;
  onClose: () => void;
  onDelete: (item: MediaItem) => void;
  onCaption: (item: MediaItem, caption: string) => void;
}) {
  const player = useVideoPlayer(item.kind === 'video' ? item.url : null, (p) => {
    p.loop = true;
    p.play();
  });

  const value = draft ?? item.caption ?? '';

  return (
    // Always the dark ground, in both schemes — a photo viewer is the one place
    // a light chrome actively fights the content it is showing.
    <View style={{ flex: 1, backgroundColor: '#0E0A12' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {item.kind === 'video' ? (
          <VideoView
            player={player}
            style={{ width: '100%', aspectRatio: (item.width ?? 9) / (item.height ?? 16) }}
            contentFit="contain"
            nativeControls
          />
        ) : (
          <Image
            source={{ uri: item.url }}
            style={{ width: '100%', height: '80%' }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        )}
      </View>

      <View style={{ padding: gutter, gap: space.md }}>
        <TextField
          placeholder="Say something about this…"
          value={value}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={() => onCaption(item, value)}
          onBlur={() => {
            if (value.trim() !== (item.caption ?? '').trim()) onCaption(item, value);
          }}
          style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.25)' }}
        />

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            label="Delete"
            variant="destructive"
            style={{ flex: 1 }}
            onPress={() => onDelete(item)}
          />
          <Button label="Done" style={{ flex: 1 }} onPress={onClose} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: 56,
          right: gutter,
          width: 38,
          height: 38,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.16)',
        }}
      >
        <CloseIcon size={icon.md} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function EmptyGallery({ onAdd, busy }: { onAdd: () => void; busy: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xxxl }}>
      <View
        style={{
          width: 92,
          height: 92,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.tint.success.bg,
          boxShadow: shadow.s1,
        }}
      >
        {busy ? (
          <ActivityIndicator color={theme.tint.success.fg} />
        ) : (
          <PlusIcon size={icon.xl} color={theme.tint.success.fg} />
        )}
      </View>

      <View style={{ gap: space.xs, alignItems: 'center' }}>
        <Text role="title3">Nothing here yet</Text>
        <Text role="caption" center color={theme.color.textSecondary} style={{ maxWidth: 260 }}>
          The first trip, the bad haircut, the dog you met once. Start with anything — you’ll be
          glad it’s here in a year.
        </Text>
      </View>

      {/* <Button label="Add your first memory" disabled={busy} onPress={onAdd} /> */}
    </View>
  );
}

function headline(count: number): string {
  if (count === 0) return 'Your gallery';
  return count === 1 ? '1 memory kept' : `${count} memories kept`;
}

function GallerySkeleton() {
  const width = Dimensions.get('window').width - gutter * 2;
  const unit = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <Screen gap={space.xl}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Skeleton width={52} height={52} round={26} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="80%" height={10} />
          </View>
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <Skeleton width={110} height={10} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          <Skeleton width={unit * 2 + GAP} height={unit * 2 + GAP} round={radius.md} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={unit} height={unit} round={radius.md} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
