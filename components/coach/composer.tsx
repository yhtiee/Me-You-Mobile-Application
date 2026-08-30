import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Glyph } from '@/components/ui/glyph';
import { PlusIcon, SendIcon, StopIcon } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { ACCEPTED_DOC_TYPES } from '@/lib/coach';
import { fontFamily, icon, layout, palette, radius, space } from '@/constants/tokens';
import type { PendingAttachment } from '@/hooks/use-coach';

type Props = {
  draft: string;
  onChangeDraft: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  disabled: boolean;
  placeholder: string;
  attachments: PendingAttachment[];
  onAttach: (file: { uri: string; mimeType: string; fileName: string }) => void;
  onRemoveAttachment: (storagePath: string) => void;
  footer: string;
};

export function Composer({
  draft,
  onChangeDraft,
  onSend,
  onStop,
  sending,
  disabled,
  placeholder,
  attachments,
  onAttach,
  onRemoveAttachment,
  footer,
}: Props) {
  const theme = useTheme();

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos are off', 'Allow photo access in Settings to attach a screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      // Deliberately not `base64: true`. It doubles peak memory on a large
      // photo, and `uploadAttachment` reads the file itself anyway.
      base64: false,
    });

    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    onAttach({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...ACCEPTED_DOC_TYPES],
      // Copies into the app's cache, which is what makes the URI readable
      // afterwards — an un-copied `content://` URI on Android is revoked as
      // soon as the picker closes.
      copyToCacheDirectory: true,
    });

    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    onAttach({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      fileName: asset.name ?? `file-${Date.now()}`,
    });
  };

  const offerAttach = () => {
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
    Alert.alert('Attach', 'What would you like to add?', [
      { text: 'Photo', onPress: () => void pickImage() },
      { text: 'Document', onPress: () => void pickDocument() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const canSend = !disabled && (draft.trim().length > 0 || attachments.some((a) => !a.uploading));

  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.md,
        borderTopWidth: 1,
        borderTopColor: theme.color.border,
        backgroundColor: theme.color.surface,
        gap: space.sm,
      }}
    >
      {attachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}
        >
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.storagePath}
              attachment={attachment}
              onRemove={() => onRemoveAttachment(attachment.storagePath)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach a photo or document"
          disabled={disabled}
          onPress={offerAttach}
          style={({ pressed }) => ({
            width: layout.minTarget,
            height: layout.minTarget,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.color.surfaceSunken,
            opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
          })}
        >
          <PlusIcon size={icon.md} color={theme.color.textSecondary} />
        </Pressable>

        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={placeholder}
          placeholderTextColor={theme.color.textTertiary}
          editable={!disabled}
          multiline
          style={{
            flex: 1,
            minHeight: layout.minTarget,
            maxHeight: 120,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: theme.color.surfaceSunken,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            fontFamily: fontFamily.body.regular,
            fontSize: 14,
            color: theme.color.textPrimary,
          }}
        />

        {/*
         * One button, two jobs. While a reply is streaming it becomes stop —
         * which is the standard chat affordance and, more practically, the only
         * control that can reach an in-flight request. A separate stop button
         * would sit dead for the 99% of the time nothing is generating.
         */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sending ? 'Stop generating' : 'Send'}
          onPress={sending ? onStop : onSend}
          disabled={sending ? false : !canSend}
          style={({ pressed }) => ({
            width: layout.minTarget,
            height: layout.minTarget,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: sending ? theme.color.surfaceSunken : palette.brand.iris,
            opacity: !sending && !canSend ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          {sending ? (
            <StopIcon size={icon.sm} color={theme.color.textPrimary} />
          ) : (
            <SendIcon size={icon.md} color="#fff" />
          )}
        </Pressable>
      </View>

      <Text role="caption" color={theme.color.textTertiary}>
        {footer}
      </Text>
    </View>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const isImage = attachment.mimeType.startsWith('image/');

  return (
    <View style={{ width: 64, height: 64 }}>
      {isImage && attachment.localUri ? (
        <Image
          source={{ uri: attachment.localUri }}
          contentFit="cover"
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.md,
            opacity: attachment.uploading ? 0.5 : 1,
          }}
        />
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            padding: 4,
            backgroundColor: theme.color.surfaceSunken,
            opacity: attachment.uploading ? 0.5 : 1,
          }}
        >
          <Glyph size={18}>📄</Glyph>
          <Text role="caption" numberOfLines={1} color={theme.color.textTertiary} style={{ fontSize: 9 }}>
            {attachment.fileName ?? 'File'}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${attachment.fileName ?? 'attachment'}`}
        hitSlop={space.sm}
        onPress={onRemove}
        style={{
          position: 'absolute',
          top: -4,
          right: -4,
          width: 20,
          height: 20,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.color.textPrimary,
        }}
      >
        <Text role="caption" color={theme.color.surface} style={{ fontSize: 11 }}>
          ✕
        </Text>
      </Pressable>
    </View>
  );
}
