/**
 * Pose Detection Utility
 * TensorFlow.js + MoveNet wrapper for human pose estimation
 */

import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { TRACKING_PROFILES, calculateCenterOfMass, calculateHeadPosition, calculateBiomechanics } from './trackingProfiles';

// Detector instance (singleton)
let detector = null;
let isInitializing = false;
let initPromise = null;

/**
 * Initialize the MoveNet pose detector
 * @returns {Promise<boolean>} Success status
 */
export async function initializePoseDetector() {
  if (detector) {
    return true;
  }

  if (isInitializing) {
    return initPromise;
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      // Set up TensorFlow.js backend
      await tf.ready();

      // Prefer WebGL for GPU acceleration
      if (tf.getBackend() !== 'webgl') {
        await tf.setBackend('webgl');
      }

      console.log('TensorFlow.js backend:', tf.getBackend());

      // Create MoveNet detector (Lightning is faster, Thunder is more accurate)
      const model = poseDetection.SupportedModels.MoveNet;
      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.25
      };

      detector = await poseDetection.createDetector(model, detectorConfig);
      console.log('MoveNet detector initialized');

      isInitializing = false;
      return true;
    } catch (error) {
      console.error('Failed to initialize pose detector:', error);
      isInitializing = false;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if detector is ready
 */
export function isDetectorReady() {
  return detector !== null;
}

/**
 * Detect pose in a single frame
 * @param {HTMLVideoElement|HTMLCanvasElement|ImageData} input - Image source
 * @returns {Promise<Object>} Keypoints and derived data
 */
export async function detectPose(input) {
  if (!detector) {
    throw new Error('Pose detector not initialized. Call initializePoseDetector() first.');
  }

  try {
    const poses = await detector.estimatePoses(input, {
      flipHorizontal: false
    });

    if (poses.length === 0) {
      return null;
    }

    // Get the first (and only, for single-pose model) detected pose
    const pose = poses[0];

    // Convert keypoints array to indexed object for easier access
    const keypointsMap = {};
    pose.keypoints.forEach((kp, index) => {
      keypointsMap[index] = {
        x: kp.x,
        y: kp.y,
        score: kp.score,
        name: kp.name
      };
    });

    return {
      keypoints: keypointsMap,
      score: pose.score || calculateAverageScore(keypointsMap)
    };
  } catch (error) {
    console.error('Pose detection error:', error);
    return null;
  }
}

/**
 * Calculate average confidence score from keypoints
 */
function calculateAverageScore(keypoints) {
  const scores = Object.values(keypoints).map(kp => kp.score);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Process entire video and extract pose data for all frames
 * @param {HTMLVideoElement} video - Video element
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback (0-100)
 * @param {Function} onCancel - Returns true if processing should stop
 * @returns {Promise<Array>} Frame data array
 */
export async function processVideo(video, options = {}, onProgress = null, onCancel = null) {
  if (!detector) {
    throw new Error('Pose detector not initialized');
  }

  const {
    fps = 30,
    profileId = 'linearSprint',
    enableBiomechanics = false,
    movementDirection = 'right',
    startTime = 0,
    endTime = null,
    confidenceThreshold = 0.3,
    athleteRegion = null
  } = options;

  const profile = TRACKING_PROFILES[profileId];
  if (!profile) {
    throw new Error(`Unknown tracking profile: ${profileId}`);
  }

  const actualEndTime = endTime || video.duration;
  const frameDuration = 1 / fps;
  const totalFrames = Math.floor((actualEndTime - startTime) * fps);

  const frameData = [];
  let prevKeypoints = null;

  // Create offscreen canvas for frame extraction
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < totalFrames; i++) {
    // Check for cancellation
    if (onCancel && onCancel()) {
      console.log('Processing cancelled');
      break;
    }

    const time = startTime + (i * frameDuration);

    // Seek to frame
    video.currentTime = time;
    await waitForSeek(video);

    // Draw frame to canvas
    ctx.drawImage(video, 0, 0);

    // Detect pose
    const poseResult = await detectPose(canvas);

    if (poseResult) {
      const { keypoints, score } = poseResult;

      // If athlete region is specified, filter keypoints outside it
      let filteredByRegion = keypoints;
      if (athleteRegion) {
        const { x, y, width, height } = athleteRegion;
        const regionLeft = x - width / 2;
        const regionRight = x + width / 2;
        const regionTop = y - height / 2;
        const regionBottom = y + height / 2;

        // Check if majority of keypoints are in region
        const inRegion = Object.values(keypoints).filter(kp =>
          kp && kp.x >= regionLeft && kp.x <= regionRight &&
          kp.y >= regionTop && kp.y <= regionBottom
        ).length;

        // If less than half of keypoints in region, this might be wrong person
        if (inRegion < Object.keys(keypoints).length / 2) {
          // Mark as low confidence
          filteredByRegion = Object.fromEntries(
            Object.entries(keypoints).map(([k, v]) => [k, { ...v, score: v.score * 0.5 }])
          );
        }
      }

      // Filter to profile keypoints only, applying confidence threshold
      const filteredKeypoints = {};
      profile.keypoints.forEach(idx => {
        if (filteredByRegion[idx] && filteredByRegion[idx].score >= confidenceThreshold) {
          filteredKeypoints[idx] = filteredByRegion[idx];
        }
      });

      // Calculate derived positions
      const centerOfMass = calculateCenterOfMass(filteredByRegion);
      const headPosition = calculateHeadPosition(filteredByRegion);

      // Calculate biomechanics if enabled
      let biomechanics = null;
      if (enableBiomechanics) {
        biomechanics = calculateBiomechanics(filteredByRegion, movementDirection, prevKeypoints);
      }

      // Calculate overall frame confidence
      const keypointScores = Object.values(filteredKeypoints).map(kp => kp.score);
      const frameConfidence = keypointScores.length > 0
        ? keypointScores.reduce((a, b) => a + b, 0) / keypointScores.length
        : 0;

      frameData.push({
        frame: i,
        time,
        keypoints: filteredKeypoints,
        centerOfMass,
        headPosition,
        biomechanics,
        confidence: frameConfidence,
        isManuallyAdjusted: false
      });

      prevKeypoints = filteredByRegion;
    } else {
      // No pose detected - interpolate or mark as missing
      frameData.push({
        frame: i,
        time,
        keypoints: null,
        centerOfMass: null,
        headPosition: null,
        biomechanics: null,
        confidence: 0,
        isManuallyAdjusted: false,
        isMissing: true
      });
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalFrames) * 100));
    }
  }

  // Interpolate missing frames
  interpolateMissingFrames(frameData);

  return frameData;
}

/**
 * Wait for video to finish seeking
 */
function waitForSeek(video) {
  return new Promise((resolve) => {
    if (video.seeking) {
      video.addEventListener('seeked', resolve, { once: true });
    } else {
      resolve();
    }
  });
}

/**
 * Interpolate missing frames using linear interpolation
 */
function interpolateMissingFrames(frameData) {
  for (let i = 0; i < frameData.length; i++) {
    if (frameData[i].isMissing) {
      // Find previous and next valid frames
      let prevIdx = i - 1;
      let nextIdx = i + 1;

      while (prevIdx >= 0 && frameData[prevIdx].isMissing) prevIdx--;
      while (nextIdx < frameData.length && frameData[nextIdx].isMissing) nextIdx++;

      if (prevIdx >= 0 && nextIdx < frameData.length) {
        // Interpolate between prev and next
        const prev = frameData[prevIdx];
        const next = frameData[nextIdx];
        const t = (i - prevIdx) / (nextIdx - prevIdx);

        frameData[i] = interpolateFrame(prev, next, t, frameData[i].frame, frameData[i].time);
      } else if (prevIdx >= 0) {
        // Copy from previous
        frameData[i] = { ...frameData[prevIdx], frame: frameData[i].frame, time: frameData[i].time };
      } else if (nextIdx < frameData.length) {
        // Copy from next
        frameData[i] = { ...frameData[nextIdx], frame: frameData[i].frame, time: frameData[i].time };
      }
    }
  }
}

/**
 * Interpolate between two frames
 */
function interpolateFrame(prev, next, t, frame, time) {
  const lerp = (a, b, t) => a + (b - a) * t;

  const interpolateKeypoints = (kp1, kp2) => {
    if (!kp1 || !kp2) return kp1 || kp2;

    const result = {};
    for (const key of Object.keys(kp1)) {
      if (kp2[key]) {
        result[key] = {
          x: lerp(kp1[key].x, kp2[key].x, t),
          y: lerp(kp1[key].y, kp2[key].y, t),
          score: lerp(kp1[key].score, kp2[key].score, t),
          name: kp1[key].name
        };
      }
    }
    return result;
  };

  const interpolatePoint = (p1, p2) => {
    if (!p1 || !p2) return p1 || p2;
    return {
      x: lerp(p1.x, p2.x, t),
      y: lerp(p1.y, p2.y, t),
      score: lerp(p1.score, p2.score, t)
    };
  };

  const interpolateBiomechanics = (b1, b2) => {
    if (!b1 || !b2) return b1 || b2;
    return {
      spineAngle: b1.spineAngle !== null && b2.spineAngle !== null
        ? lerp(b1.spineAngle, b2.spineAngle, t) : null,
      shinAngle: b1.shinAngle !== null && b2.shinAngle !== null
        ? lerp(b1.shinAngle, b2.shinAngle, t) : null,
      footAngle: b1.footAngle !== null && b2.footAngle !== null
        ? lerp(b1.footAngle, b2.footAngle, t) : null,
      leadLeg: prev.biomechanics?.leadLeg
    };
  };

  return {
    frame,
    time,
    keypoints: interpolateKeypoints(prev.keypoints, next.keypoints),
    centerOfMass: interpolatePoint(prev.centerOfMass, next.centerOfMass),
    headPosition: interpolatePoint(prev.headPosition, next.headPosition),
    biomechanics: interpolateBiomechanics(prev.biomechanics, next.biomechanics),
    confidence: lerp(prev.confidence, next.confidence, t),
    isInterpolated: true,
    isManuallyAdjusted: false
  };
}

/**
 * Apply manual keyframe adjustment
 * @param {Array} frameData - Full frame data array
 * @param {number} frameIndex - Frame to adjust
 * @param {Object} adjustments - Keypoint adjustments { keypointIndex: { x, y } }
 */
export function applyManualAdjustment(frameData, frameIndex, adjustments) {
  const frame = frameData[frameIndex];
  if (!frame) return frameData;

  const newKeypoints = { ...frame.keypoints };

  for (const [idx, position] of Object.entries(adjustments)) {
    if (newKeypoints[idx]) {
      newKeypoints[idx] = {
        ...newKeypoints[idx],
        x: position.x,
        y: position.y,
        score: 1.0 // Manual adjustments are fully confident
      };
    }
  }

  // Update derived values
  const newCenterOfMass = calculateCenterOfMass(newKeypoints);
  const newHeadPosition = calculateHeadPosition(newKeypoints);

  frameData[frameIndex] = {
    ...frame,
    keypoints: newKeypoints,
    centerOfMass: newCenterOfMass,
    headPosition: newHeadPosition,
    isManuallyAdjusted: true
  };

  // Re-interpolate between manual keyframes
  reinterpolateBetweenKeyframes(frameData);

  return frameData;
}

/**
 * Re-interpolate frames between manually adjusted keyframes
 */
function reinterpolateBetweenKeyframes(frameData) {
  const keyframeIndices = frameData
    .map((f, i) => f.isManuallyAdjusted ? i : -1)
    .filter(i => i >= 0);

  // Interpolate between each pair of keyframes
  for (let k = 0; k < keyframeIndices.length - 1; k++) {
    const startIdx = keyframeIndices[k];
    const endIdx = keyframeIndices[k + 1];

    for (let i = startIdx + 1; i < endIdx; i++) {
      const t = (i - startIdx) / (endIdx - startIdx);
      const interpolated = interpolateFrame(
        frameData[startIdx],
        frameData[endIdx],
        t,
        frameData[i].frame,
        frameData[i].time
      );
      frameData[i] = {
        ...interpolated,
        isManuallyAdjusted: false,
        isInterpolated: true
      };
    }
  }
}

/**
 * Detect movement direction from first few frames
 * @param {Array} frameData - Frame data array
 * @returns {'left' | 'right'} Movement direction
 */
export function detectMovementDirection(frameData) {
  if (frameData.length < 10) return 'right';

  const startCOM = frameData[0]?.centerOfMass;
  const endCOM = frameData[Math.min(9, frameData.length - 1)]?.centerOfMass;

  if (!startCOM || !endCOM) return 'right';

  return endCOM.x > startCOM.x ? 'right' : 'left';
}

/**
 * Cleanup detector resources
 */
export async function disposeDetector() {
  if (detector) {
    detector.dispose();
    detector = null;
  }
}

export default {
  initializePoseDetector,
  isDetectorReady,
  detectPose,
  processVideo,
  applyManualAdjustment,
  detectMovementDirection,
  disposeDetector
};