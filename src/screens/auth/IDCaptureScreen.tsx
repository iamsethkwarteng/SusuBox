import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { uploadToCloudinary } from '@/src/utils/uploadToCloudinary';

// PRODUCTION KYC: Full automated KYC (reading ID text via OCR and verifying
// the card number against the government NIA database) requires Smile Identity
// or Appruve — this is the production path documented in the supervisor
// report. The aspect-ratio gate below is a lightweight client-side sanity
// check that filters out obvious non-document photos before upload; it does
// NOT verify authenticity.

export type DocumentType = 'ghana_card' | 'voter_id' | 'passport';

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ghana_card: 'Ghana Card',
  voter_id: 'Voter ID',
  passport: 'Passport',
};

// ID-1 cards are 85.6mm x 53.98mm ≈ 1.586:1. Accept a generous window around
// that (hand-held photos are never perfectly framed) but reject square-ish and
// portrait captures outright — those are almost never a flat ID card.
const ID_CARD_RATIO = 85.6 / 53.98;
const RATIO_MIN = 1.25;
const RATIO_MAX = 2.1;

function looksLikeIdCard(width: number, height: number): boolean {
  if (!width || !height) return true; // dimensions unavailable — don't block
  const ratio = width / height;
  return ratio >= RATIO_MIN && ratio <= RATIO_MAX;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'failed';

interface IDCaptureScreenProps {
  documentType: DocumentType;
  onDocumentTypeChange: (type: DocumentType) => void;
  /** Cloudinary URL once uploaded — the only thing persisted. */
  uploadedUrl: string | null;
  onUploaded: (url: string) => void;
}

export default function IDCaptureScreen({
  documentType,
  onDocumentTypeChange,
  uploadedUrl,
  onUploaded,
}: IDCaptureScreenProps) {
  const [uploadState, setUploadState] = useState<UploadState>(uploadedUrl ? 'done' : 'idle');
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadCapture = async (uri: string) => {
    setUploadState('uploading');
    setErrorMessage(null);
    const result = await uploadToCloudinary(uri, 'id_cards');
    if (result.success && result.url) {
      // Only the Cloudinary URL is saved — the local file stays in the OS
      // camera cache and is never persisted by the app.
      setUploadState('done');
      onUploaded(result.url);
    } else {
      setUploadState('failed');
      setErrorMessage(result.error ?? 'Upload failed. Please retry.');
    }
  };

  const capture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access in settings to continue verification.');
      return;
    }
    // Rear camera only — ID cards are photographed on a surface, and the rear
    // camera has the resolution + autofocus the KYC reviewer needs.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      cameraType: ImagePicker.CameraType.back,
      allowsEditing: true,
      aspect: [159, 100], // matches the ID-1 card ratio in the crop UI
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    // Reject square/portrait captures — likely a selfie or random photo.
    if (!looksLikeIdCard(asset.width, asset.height)) {
      Alert.alert(
        'Not an ID card',
        'This does not look like an ID card. Please photograph your ID card directly.',
      );
      return;
    }
    setLocalPreview(asset.uri);
    await uploadCapture(asset.uri);
  };

  const retryUpload = () => {
    if (localPreview) uploadCapture(localPreview);
    else capture();
  };

  return (
    <View>
      <View style={styles.chipRow}>
        {(Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, documentType === type && styles.chipActive]}
            onPress={() => onDocumentTypeChange(type)}
          >
            <Text style={[styles.chipLabel, documentType === type && styles.chipLabelActive]}>
              {DOCUMENT_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Pressable style={styles.captureFrame} onPress={uploadState === 'uploading' ? undefined : capture}>
        {localPreview || uploadedUrl ? (
          <Image source={{ uri: localPreview ?? uploadedUrl ?? undefined }} style={styles.capturedImage} />
        ) : (
          // Rectangular guide with corner markers at the ID-1 aspect ratio so
          // the user knows exactly where the card must sit.
          <View style={[styles.frameGuide, { aspectRatio: ID_CARD_RATIO }]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <MaterialCommunityIcons name="card-account-details-outline" size={38} color={Colors.white} />
          </View>
        )}

        {uploadState === 'uploading' ? (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator color={Colors.white} />
            <Text style={styles.overlayText}>Uploading securely…</Text>
          </View>
        ) : null}

        {uploadState === 'done' ? (
          <View style={styles.doneBadge}>
            <MaterialCommunityIcons name="check-circle" size={18} color={Colors.white} />
            <Text style={styles.doneText}>Saved</Text>
          </View>
        ) : null}
      </Pressable>

      <Text style={styles.instruction}>
        Place your {DOCUMENT_LABELS[documentType]} flat and fill the frame
      </Text>

      {uploadState === 'failed' ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="cloud-alert" size={18} color={Colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryUpload}>
            <Text style={styles.retryLabel}>Retry upload</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {uploadState === 'done' && (localPreview || uploadedUrl) ? (
        <View style={styles.thumbRow}>
          <Image source={{ uri: localPreview ?? uploadedUrl ?? undefined }} style={styles.thumb} />
          <MaterialCommunityIcons name="check-circle" size={20} color={Colors.success} />
          <Text style={styles.thumbLabel}>ID photo uploaded and saved</Text>
          <TouchableOpacity onPress={capture} hitSlop={8}>
            <Text style={styles.retakeLabel}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: Colors.white,
  },
  captureFrame: {
    height: 250,
    borderRadius: 16,
    backgroundColor: '#3A3A38',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  frameGuide: {
    width: '78%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: Colors.white,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,44,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  overlayText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  doneBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  doneText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  instruction: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryLabel: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  thumb: {
    width: 56,
    height: 36,
    borderRadius: 6,
  },
  thumbLabel: {
    flex: 1,
    fontSize: 12,
    color: Colors.success,
    fontWeight: '700',
  },
  retakeLabel: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
});
