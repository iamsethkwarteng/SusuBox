import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AvatarInitials from '@/src/components/AvatarInitials';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { cacheProfilePhoto, isNetworkError } from '@/src/api/client';
import { updateProfile } from '@/src/api/auth';
import { patchAuthUser } from '@/src/hooks/useAuth';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { uploadToCloudinary } from '@/src/utils/uploadToCloudinary';

// Common picker options for a square profile photo.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

// Give the bottom-sheet Modal time to finish its slide-out before launching the
// camera/gallery. Launching mid-dismiss is swallowed on Android (the picker
// never appears), which is the "nothing happens" bug. 350ms clears the animation.
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ProfileAvatarProps {
  name: string;
  photoUrl?: string;
  size?: number;
  /**
   * Ring around the green camera button. It should match the surface the avatar
   * sits on so the button reads as a cut-out (the WhatsApp look). Defaults to
   * the screen background (#F5F4F0); pass Colors.white on a white card.
   */
  borderColor?: string;
}

/**
 * Update 4 — WhatsApp-style editable avatar: circular photo (or initials
 * fallback) with a small green "+" button bottom-right. Tapping the "+" opens
 * an action sheet (Take photo / Choose from gallery), uploads to Cloudinary's
 * profiles/ folder, PATCHes the user profile, and reflects the new URL in the
 * shared auth store — all with an in-place progress spinner over the avatar.
 */
export default function ProfileAvatar({
  name,
  photoUrl,
  size = 88,
  borderColor = Colors.background, // #F5F4F0 — the app's screen background
}: ProfileAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | undefined>(photoUrl);
  const [sheetVisible, setSheetVisible] = useState(false);
  const { isConnected } = useNetworkStatus();

  // The photo often arrives after mount (GET /auth/me resolving, or the cached
  // URL rehydrating), so keep the displayed avatar in step with the prop.
  useEffect(() => {
    if (photoUrl) setLocalUrl(photoUrl);
  }, [photoUrl]);

  // Uploading needs the network — don't open the camera only to fail at the end.
  const blockedOffline = (): boolean => {
    if (isConnected) return false;
    Alert.alert('No internet connection', 'Please connect and try again.');
    return true;
  };

  const runUpload = async (uri: string) => {
    // Show the spinner on the avatar immediately.
    setUploading(true);
    const result = await uploadToCloudinary(uri, 'profiles');
    if (result.success && result.url) {
      // Reflect the new photo in the UI right away (no screen refresh needed).
      setLocalUrl(result.url);
      patchAuthUser({ profilePhotoUrl: result.url });
      // Persist locally so it survives an app restart even before the next /me.
      await cacheProfilePhoto(result.url).catch(() => undefined);
      try {
        await updateProfile({ profilePhotoUrl: result.url });
        showToast('Profile photo updated');
      } catch (error) {
        // The photo IS uploaded and shown; only the profile PATCH failed. Keep
        // the new avatar and say it will sync rather than implying it was lost.
        console.error('[profile-photo] profile update failed:', error);
        showToast(
          isNetworkError(error)
            ? 'Photo saved. Your profile will sync when the connection improves.'
            : 'Photo saved, but your profile could not be updated. It will sync later.',
        );
      }
    } else {
      // Revert the spinner and tell the user.
      showToast('Upload failed. Please try again.');
    }
    setUploading(false);
  };

  const takePhoto = async () => {
    // Close the sheet first and let it finish animating before launching.
    setSheetVisible(false);
    await wait(350);
    if (blockedOffline()) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission required',
        'Please allow camera access in your phone settings to update your profile photo.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      ...PICKER_OPTIONS,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) await runUpload(result.assets[0].uri);
  };

  const chooseFromGallery = async () => {
    setSheetVisible(false);
    await wait(350);
    if (blockedOffline()) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission required',
        'Please allow gallery access in your phone settings to update your profile photo.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets[0]) await runUpload(result.assets[0].uri);
  };

  return (
    <View style={{ width: size, height: size }}>
      {/* The avatar itself opens the sheet too — users tap the picture, not
          only the small "+" button. */}
      <TouchableOpacity
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.8}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
      >
        {localUrl ? (
          <Image
            source={{ uri: localUrl }}
            style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}
          />
        ) : (
          // Default avatar: coloured circle with the user's initials.
          <AvatarInitials name={name} size={size} />
        )}
      </TouchableOpacity>

      {uploading ? (
        <View
          style={[styles.uploadOverlay, { width: size, height: size, borderRadius: size / 2 }]}
          pointerEvents="none"
        >
          <ActivityIndicator color={Colors.white} />
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.plusButton, { borderColor }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
        disabled={uploading}
      >
        <MaterialCommunityIcons name="camera" size={15} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSheetVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Profile photo</Text>
          <TouchableOpacity style={styles.sheetOption} onPress={takePhoto} activeOpacity={0.7}>
            <MaterialCommunityIcons name="camera-outline" size={22} color={Colors.primary} />
            <Text style={styles.sheetOptionLabel}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetOption} onPress={chooseFromGallery} activeOpacity={0.7}>
            <MaterialCommunityIcons name="image-outline" size={22} color={Colors.primary} />
            <Text style={styles.sheetOptionLabel}>Choose from gallery</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    backgroundColor: Colors.divider,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,44,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.success,
    borderWidth: 3,
    // Base value only — the `borderColor` prop overrides this at render time
    // so the ring can match whatever surface the avatar sits on.
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(44,44,42,0.5)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  sheetOptionLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
});
