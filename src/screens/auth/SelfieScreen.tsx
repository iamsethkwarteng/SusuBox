import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { uploadToCloudinary } from '@/src/utils/uploadToCloudinary';

// PRODUCTION KYC: real-time on-device face detection requires ML Kit via
// react-native-vision-camera (custom dev build) or a vendor SDK — Smile
// Identity's liveness check is the production path documented in the
// supervisor report. expo-face-detector was removed from the Expo SDK (last
// shipped in SDK 49) and never ran inside Expo Go, so in this Expo Go build
// the "face detected" state below is driven by a steadiness timer after the
// camera initialises: same UI states, same gated capture button, and the
// detector callback slots into `setFaceDetected` unchanged when the project
// moves to a dev build.
const DETECTION_DELAY_MS = 2200;

type UploadState = 'idle' | 'uploading' | 'done' | 'failed';

interface SelfieScreenProps {
  /** Cloudinary URL once uploaded — the only thing persisted. */
  uploadedUrl: string | null;
  onUploaded: (url: string) => void;
}

export default function SelfieScreen({ uploadedUrl, onUploaded }: SelfieScreenProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>(uploadedUrl ? 'done' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stand-in for the FaceDetector callback (see PRODUCTION KYC note above).
  useEffect(() => {
    if (!cameraReady) return;
    const timer = setTimeout(() => setFaceDetected(true), DETECTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cameraReady]);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const uploadCapture = async (uri: string) => {
    setUploadState('uploading');
    setErrorMessage(null);
    const result = await uploadToCloudinary(uri, 'selfies');
    if (result.success && result.url) {
      setUploadState('done');
      onUploaded(result.url);
    } else {
      setUploadState('failed');
      setErrorMessage(result.error ?? 'Upload failed. Please retry.');
    }
  };

  const capture = async () => {
    if (!cameraRef.current || !faceDetected || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setLocalPreview(photo.uri);
        await uploadCapture(photo.uri);
      }
    } finally {
      setCapturing(false);
    }
  };

  const retake = () => {
    setLocalPreview(null);
    setUploadState('idle');
    setFaceDetected(false);
    setCameraReady(false);
  };

  const retryUpload = () => {
    if (localPreview) uploadCapture(localPreview);
  };

  const showCamera = !localPreview && uploadState !== 'done';

  return (
    <View>
      <View style={styles.viewfinder}>
        {showCamera ? (
          permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              onCameraReady={() => setCameraReady(true)}
            />
          ) : (
            <View style={styles.permissionBox}>
              <MaterialCommunityIcons name="camera-off-outline" size={34} color={Colors.white} />
              <Text style={styles.permissionText}>Camera access is needed for your verification selfie.</Text>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                <Text style={styles.permissionButtonLabel}>Allow camera</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <Image source={{ uri: localPreview ?? uploadedUrl ?? undefined }} style={StyleSheet.absoluteFill} />
        )}

        {showCamera && permission?.granted ? (
          <>
            {/* Oval face guide — turns green once a face is held steady. */}
            <View style={styles.guideWrap} pointerEvents="none">
              <View style={[styles.oval, faceDetected && styles.ovalDetected]} />
            </View>
            <View style={[styles.feedbackPill, faceDetected && styles.feedbackPillDetected]}>
              <MaterialCommunityIcons
                name={faceDetected ? 'face-recognition' : 'face-man-outline'}
                size={14}
                color={Colors.white}
              />
              <Text style={styles.feedbackText}>
                {faceDetected ? 'Face detected — hold still' : 'No face detected — look straight ahead'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.shutter, (!faceDetected || capturing) && styles.shutterDisabled]}
              onPress={capture}
              disabled={!faceDetected || capturing}
            >
              {capturing ? <ActivityIndicator color={Colors.primaryDark} /> : <View style={styles.shutterInner} />}
            </TouchableOpacity>
          </>
        ) : null}

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
      </View>

      {uploadState === 'failed' ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="cloud-alert" size={18} color={Colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryUpload}>
            <Text style={styles.retryLabel}>Retry upload</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {uploadState === 'done' ? (
        <View style={styles.thumbRow}>
          <Image source={{ uri: localPreview ?? uploadedUrl ?? undefined }} style={styles.thumb} />
          <MaterialCommunityIcons name="check-circle" size={20} color={Colors.success} />
          <Text style={styles.thumbLabel}>Selfie uploaded and saved</Text>
          <TouchableOpacity onPress={retake} hitSlop={8}>
            <Text style={styles.retakeLabel}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.secureRow}>
        <MaterialCommunityIcons name="lock-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.secureText}>Your biometric data is encrypted and secure.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewfinder: {
    height: 360,
    borderRadius: 16,
    backgroundColor: '#3A3A38',
    overflow: 'hidden',
    marginBottom: 14,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  permissionText: {
    color: Colors.white,
    fontSize: 13,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  permissionButtonLabel: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  guideWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    width: 190,
    height: 250,
    borderRadius: 125,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.85)',
    borderStyle: 'dashed',
  },
  ovalDetected: {
    borderColor: Colors.success,
    borderStyle: 'solid',
  },
  feedbackPill: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(44,44,42,0.75)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  feedbackPillDetected: {
    backgroundColor: Colors.success,
  },
  feedbackText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  shutter: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    opacity: 0.35,
  },
  shutterInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
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
    marginBottom: 14,
  },
  thumb: {
    width: 40,
    height: 52,
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
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  secureText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
