import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/src/constants/colors';
import { uploadToCloudinary } from '@/src/utils/uploadToCloudinary';

// PRODUCTION KYC: Full automated KYC (reading ID text via OCR and verifying
// the card number against the government NIA database) requires Smile Identity
// or Appruve — this is the production path documented in the supervisor
// report. The aspect-ratio gate below is a lightweight client-side sanity
// check that filters out obvious non-document photos before upload; it does
// NOT verify authenticity.

export type DocumentType = 'ghana_card' | 'voter_id' | 'passport' | 'drivers_licence';

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ghana_card: 'Ghana Card',
  voter_id: 'Voter ID',
  passport: 'Passport',
  drivers_licence: "Driver's Licence",
};

// Field label shown above the ID number input, per document type.
const ID_NUMBER_LABELS: Record<DocumentType, string> = {
  ghana_card: 'Ghana Card Number',
  voter_id: 'Voter ID Number',
  passport: 'Passport Number',
  drivers_licence: 'Licence Number',
};

const ID_NUMBER_PLACEHOLDERS: Record<DocumentType, string> = {
  ghana_card: 'GHA-123456789-0',
  voter_id: '1234567890',
  passport: 'AB1234567',
  drivers_licence: 'B1234567',
};

// Where on the document the number is printed — shown as a hint once the user
// starts typing, so they can confirm they're reading the right field.
const ID_NUMBER_HINTS: Record<DocumentType, string> = {
  ghana_card: 'Found on the front of your Ghana Card',
  voter_id: 'Found on the front of your Voter ID card',
  passport: 'Found on the photo page of your passport',
  drivers_licence: "Found on the front of your Driver's Licence",
};

// Normalises keystrokes into the canonical shape for the selected document, so
// the value that reaches validation (and the backend) is always consistent.
// Ghana Card gets the GHA- prefix and hyphens inserted automatically — users
// type the digits and the mask does the rest.
export function formatIDNumber(text: string, idType: DocumentType): string {
  const clean = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  switch (idType) {
    case 'ghana_card': {
      const digits = clean.replace(/[^0-9]/g, '').slice(0, 10);
      if (digits.length === 0) return '';
      if (digits.length <= 9) return `GHA-${digits}`;
      return `GHA-${digits.slice(0, 9)}-${digits.slice(9, 10)}`;
    }
    case 'voter_id':
      return clean.replace(/[^0-9]/g, '').slice(0, 10);
    case 'passport':
      return clean.replace(/-/g, '').slice(0, 9);
    case 'drivers_licence':
      return clean.replace(/-/g, '').slice(0, 10);
    default:
      return clean;
  }
}

// Returns an error message, or null when the number is well-formed.
// NOTE: this checks FORMAT only — it cannot tell whether the number is real or
// belongs to this person. The admin still cross-checks it against the uploaded
// card photo, and full authenticity checking needs the Smile Identity / NIA
// integration described in the production-KYC note above.
export function validateIDNumber(value: string, idType: DocumentType): string | null {
  if (!value.trim()) return 'Please enter your ID number.';
  switch (idType) {
    case 'ghana_card':
      return /^GHA-\d{9}-\d$/.test(value) ? null : 'Ghana Card number must look like GHA-123456789-0.';
    case 'voter_id':
      return /^\d{10}$/.test(value) ? null : 'Voter ID must be exactly 10 digits.';
    case 'passport':
      return /^[A-Z]{2}\d{7}$/.test(value) ? null : 'Passport number must be 2 letters followed by 7 digits.';
    case 'drivers_licence':
      return /^[A-Z]{1,2}\d{6,8}$/.test(value)
        ? null
        : "Licence number must be 1-2 letters followed by 6-8 digits.";
    default:
      return null;
  }
}

// ID-1 cards are 85.6mm x 53.98mm ≈ 1.586:1 — used only for the visual frame
// guide's aspect ratio, NOT as a validation gate. A strict ratio check rejected
// valid captures from different phone cameras, so we now only verify the photo
// is landscape (the white frame overlay handles the actual positioning).
const ID_CARD_RATIO = 85.6 / 53.98;

// True only when we can confidently tell the capture is portrait. If the camera
// didn't report dimensions, don't block.
function isPortrait(width: number, height: number): boolean {
  if (!width || !height) return false;
  return height > width;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'failed';

interface IDCaptureScreenProps {
  documentType: DocumentType;
  onDocumentTypeChange: (type: DocumentType) => void;
  /** Cloudinary URL once uploaded — the only thing persisted. */
  uploadedUrl: string | null;
  onUploaded: (url: string) => void;
  /** Typed ID number, owned by RegisterScreen so it survives a resume. */
  idNumber: string;
  onIdNumberChange: (value: string) => void;
}

export default function IDCaptureScreen({
  documentType,
  onDocumentTypeChange,
  uploadedUrl,
  onUploaded,
  idNumber,
  onIdNumberChange,
}: IDCaptureScreenProps) {
  const [uploadState, setUploadState] = useState<UploadState>(uploadedUrl ? 'done' : 'idle');
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Only surfaced after a failed capture attempt or on blur — validating on
  // every keystroke would flag a half-typed number as wrong.
  const [idNumberError, setIdNumberError] = useState<string | null>(null);

  const idNumberValid = validateIDNumber(idNumber, documentType) === null;

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
    // The number must be in before the photo: it is what the reviewing admin
    // compares the card image against, and asking for it afterwards invites
    // the user to skip it.
    const idError = validateIDNumber(idNumber, documentType);
    if (idError) {
      setIdNumberError(idError);
      return;
    }
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
    // Only guard against a portrait capture; the user can simply retake.
    if (isPortrait(asset.width, asset.height)) {
      Alert.alert('Hold it horizontally', 'Please hold your ID card horizontally and fill the frame');
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

      {/* ID number — captured BEFORE the photo so the admin has a typed value
          to compare the card image against. */}
      <View style={styles.idNumberSection}>
        <Text style={styles.fieldLabel}>{ID_NUMBER_LABELS[documentType]}</Text>
        <TextInput
          value={idNumber}
          onChangeText={(text) => {
            onIdNumberChange(formatIDNumber(text, documentType));
            setIdNumberError(null);
          }}
          onBlur={() => setIdNumberError(idNumber ? validateIDNumber(idNumber, documentType) : null)}
          placeholder={ID_NUMBER_PLACEHOLDERS[documentType]}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType={documentType === 'voter_id' ? 'number-pad' : 'default'}
          maxLength={20}
          style={[
            styles.idNumberInput,
            idNumberError ? styles.inputError : null,
            idNumberValid ? styles.inputSuccess : null,
          ]}
        />
        {idNumberError ? (
          <View style={styles.idHintRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={14} color={Colors.danger} />
            <Text style={styles.idErrorText}>{idNumberError}</Text>
          </View>
        ) : idNumber.length > 3 ? (
          <View style={styles.idHintRow}>
            <MaterialCommunityIcons
              name={idNumberValid ? 'check-circle-outline' : 'information-outline'}
              size={14}
              color={idNumberValid ? Colors.success : Colors.textMuted}
            />
            <Text style={[styles.idHintText, idNumberValid && { color: Colors.success }]}>
              {ID_NUMBER_HINTS[documentType]}
            </Text>
          </View>
        ) : null}
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
        {idNumberValid
          ? 'Hold your phone steady and fill the white frame with your ID card'
          : 'Enter your ID number above, then tap the frame to photograph your card'}
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
    // Four document types no longer fit on one line on narrow phones.
    flexWrap: 'wrap',
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
  idNumberSection: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  idNumberInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  inputSuccess: {
    borderColor: Colors.success,
  },
  idHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  idErrorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.danger,
  },
  idHintText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
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
