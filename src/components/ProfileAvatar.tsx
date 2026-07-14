import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AvatarInitials from '@/src/components/AvatarInitials';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { isNetworkError } from '@/src/api/client';
import { updateProfile } from '@/src/api/auth';
import { patchAuthUser } from '@/src/hooks/useAuth';
import { uploadToCloudinary } from '@/src/utils/uploadToCloudinary';

interface ProfileAvatarProps {
  name: string;
  photoUrl?: string;
  size?: number;
}

/**
 * Update 4 — WhatsApp-style editable avatar: circular photo (or initials
 * fallback) with a small green "+" button bottom-right. Tapping the "+" opens
 * an action sheet (Take photo / Choose from gallery), uploads to Cloudinary's
 * profiles/ folder, PATCHes the user profile, and reflects the new URL in the
 * shared auth store — all with an in-place progress spinner over the avatar.
 */
export default function ProfileAvatar({ name, photoUrl, size = 88 }: ProfileAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | undefined>(photoUrl);
  const [sheetVisible, setSheetVisible] = useState(false);

  const runUpload = async (uri: string) => {
    setUploading(true);
    const result = await uploadToCloudinary(uri, 'profiles');
    if (result.success && result.url) {
      setLocalUrl(result.url);
      patchAuthUser({ profilePhotoUrl: result.url });
      try {
        // BACKEND REQUIRED: PATCH /api/users/profile { profilePhotoUrl }
        await updateProfile({ profilePhotoUrl: result.url });
      } catch (error) {
        if (!isNetworkError(error)) showToast('Photo uploaded but not saved to profile');
      }
      showToast('Profile photo updated');
    } else {
      showToast(result.error ?? 'Upload failed — try again');
    }
    setUploading(false);
  };

  const takePhoto = async () => {
    setSheetVisible(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) await runUpload(result.assets[0].uri);
  };

  const chooseFromGallery = async () => {
    setSheetVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) await runUpload(result.assets[0].uri);
  };

  return (
    <View style={{ width: size, height: size }}>
      {localUrl ? (
        <Image source={{ uri: localUrl }} style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        // Default avatar: coloured circle with the user's initials.
        <AvatarInitials name={name} size={size} />
      )}

      {uploading ? (
        <View style={[styles.uploadOverlay, { width: size, height: size, borderRadius: size / 2 }]}>
          <ActivityIndicator color={Colors.white} />
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.plusButton}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
        disabled={uploading}
      >
        <MaterialCommunityIcons name="plus" size={16} color={Colors.white} />
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
