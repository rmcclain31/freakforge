/**
 * Tracking Profiles Configuration
 * Defines keypoints, metrics, and angles for different event types
 * Updated for BlazePose (33 keypoints) for better athletic analysis
 */

// BlazePose keypoint indices (33 keypoints)
export const BLAZEPOSE_KEYPOINTS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

// Legacy MoveNet keypoint indices (for reference/backward compatibility)
export const MOVENET_KEYPOINTS = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16
};

// Use BlazePose as the primary keypoint system
export const KEYPOINTS = BLAZEPOSE_KEYPOINTS;

// Skeleton connections for visualization (BlazePose)
export const SKELETON_CONNECTIONS = {
  linearSprint: [
    // Head
    [KEYPOINTS.LEFT_EAR, KEYPOINTS.RIGHT_EAR],
    [KEYPOINTS.NOSE, KEYPOINTS.LEFT_EYE],
    [KEYPOINTS.NOSE, KEYPOINTS.RIGHT_EYE],
    // Shoulders
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
    // Left arm
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
    [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
    // Right arm
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
    [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
    // Torso
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
    // Hips
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
    // Left leg
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE],
    [KEYPOINTS.LEFT_KNEE, KEYPOINTS.LEFT_ANKLE],
    [KEYPOINTS.LEFT_ANKLE, KEYPOINTS.LEFT_HEEL],
    [KEYPOINTS.LEFT_HEEL, KEYPOINTS.LEFT_FOOT_INDEX],
    [KEYPOINTS.LEFT_ANKLE, KEYPOINTS.LEFT_FOOT_INDEX],
    // Right leg
    [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE],
    [KEYPOINTS.RIGHT_KNEE, KEYPOINTS.RIGHT_ANKLE],
    [KEYPOINTS.RIGHT_ANKLE, KEYPOINTS.RIGHT_HEEL],
    [KEYPOINTS.RIGHT_HEEL, KEYPOINTS.RIGHT_FOOT_INDEX],
    [KEYPOINTS.RIGHT_ANKLE, KEYPOINTS.RIGHT_FOOT_INDEX]
  ]
};

// Tracking profiles for different event types
export const TRACKING_PROFILES = {
  linearSprint: {
    id: 'linearSprint',
    name: 'Linear Sprint',
    description: '40-yard, 10-yard fly, 10m, 60-yard, 100m, etc.',

    // Keypoints to track (BlazePose indices)
    keypoints: [
      KEYPOINTS.NOSE,
      KEYPOINTS.LEFT_EAR,
      KEYPOINTS.RIGHT_EAR,
      KEYPOINTS.LEFT_SHOULDER,
      KEYPOINTS.RIGHT_SHOULDER,
      KEYPOINTS.LEFT_ELBOW,
      KEYPOINTS.RIGHT_ELBOW,
      KEYPOINTS.LEFT_WRIST,
      KEYPOINTS.RIGHT_WRIST,
      KEYPOINTS.LEFT_HIP,
      KEYPOINTS.RIGHT_HIP,
      KEYPOINTS.LEFT_KNEE,
      KEYPOINTS.RIGHT_KNEE,
      KEYPOINTS.LEFT_ANKLE,
      KEYPOINTS.RIGHT_ANKLE,
      KEYPOINTS.LEFT_HEEL,
      KEYPOINTS.RIGHT_HEEL,
      KEYPOINTS.LEFT_FOOT_INDEX,
      KEYPOINTS.RIGHT_FOOT_INDEX
    ],

    // Keypoint display names
    keypointNames: {
      [KEYPOINTS.NOSE]: 'Nose',
      [KEYPOINTS.LEFT_EAR]: 'Left Ear',
      [KEYPOINTS.RIGHT_EAR]: 'Right Ear',
      [KEYPOINTS.LEFT_SHOULDER]: 'Left Shoulder',
      [KEYPOINTS.RIGHT_SHOULDER]: 'Right Shoulder',
      [KEYPOINTS.LEFT_ELBOW]: 'Left Elbow',
      [KEYPOINTS.RIGHT_ELBOW]: 'Right Elbow',
      [KEYPOINTS.LEFT_WRIST]: 'Left Wrist',
      [KEYPOINTS.RIGHT_WRIST]: 'Right Wrist',
      [KEYPOINTS.LEFT_HIP]: 'Left Hip',
      [KEYPOINTS.RIGHT_HIP]: 'Right Hip',
      [KEYPOINTS.LEFT_KNEE]: 'Left Knee',
      [KEYPOINTS.RIGHT_KNEE]: 'Right Knee',
      [KEYPOINTS.LEFT_ANKLE]: 'Left Ankle',
      [KEYPOINTS.RIGHT_ANKLE]: 'Right Ankle',
      [KEYPOINTS.LEFT_HEEL]: 'Left Heel',
      [KEYPOINTS.RIGHT_HEEL]: 'Right Heel',
      [KEYPOINTS.LEFT_FOOT_INDEX]: 'Left Toe',
      [KEYPOINTS.RIGHT_FOOT_INDEX]: 'Right Toe'
    },

    // Core metrics (always calculated)
    coreMetrics: ['velocity', 'acceleration', 'centerOfMass'],

    // Biomechanics metrics (enabled for linear sprints)
    biomechanicsMetrics: ['spineAngle', 'shinAngle', 'footAngle'],
    enableBiomechanics: true,

    // Default split distances (in yards)
    defaultSplits: [10, 20, 30, 40],

    // Direction of movement (for lead leg detection)
    movementAxis: 'horizontal' // 'horizontal' or 'vertical'
  }

  // Future profiles can be added here:
  // proAgility: { ... },
  // lDrill: { ... },
  // verticalJump: { ... },
  // lateralMovement: { ... }
};

// Keypoint colors for visualization
export const KEYPOINT_COLORS = {
  head: '#fbbf24',      // amber
  shoulder: '#3b82f6',  // blue
  elbow: '#22c55e',     // green
  wrist: '#a855f7',     // purple
  hip: '#f97316',       // orange
  knee: '#14b8a6',      // teal
  ankle: '#ef4444',     // red
  foot: '#ec4899'       // pink
};

/**
 * Get color for a keypoint index
 */
export function getKeypointColor(idx) {
  if ([KEYPOINTS.NOSE, KEYPOINTS.LEFT_EAR, KEYPOINTS.RIGHT_EAR,
       KEYPOINTS.LEFT_EYE, KEYPOINTS.RIGHT_EYE].includes(idx)) {
    return KEYPOINT_COLORS.head;
  }
  if ([KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER].includes(idx)) {
    return KEYPOINT_COLORS.shoulder;
  }
  if ([KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW].includes(idx)) {
    return KEYPOINT_COLORS.elbow;
  }
  if ([KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
       KEYPOINTS.LEFT_PINKY, KEYPOINTS.RIGHT_PINKY,
       KEYPOINTS.LEFT_INDEX, KEYPOINTS.RIGHT_INDEX,
       KEYPOINTS.LEFT_THUMB, KEYPOINTS.RIGHT_THUMB].includes(idx)) {
    return KEYPOINT_COLORS.wrist;
  }
  if ([KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP].includes(idx)) {
    return KEYPOINT_COLORS.hip;
  }
  if ([KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE].includes(idx)) {
    return KEYPOINT_COLORS.knee;
  }
  if ([KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE].includes(idx)) {
    return KEYPOINT_COLORS.ankle;
  }
  if ([KEYPOINTS.LEFT_HEEL, KEYPOINTS.RIGHT_HEEL,
       KEYPOINTS.LEFT_FOOT_INDEX, KEYPOINTS.RIGHT_FOOT_INDEX].includes(idx)) {
    return KEYPOINT_COLORS.foot;
  }
  return '#ea580c'; // default orange
}

/**
 * Calculate center of mass from keypoints
 * Uses midpoint of shoulders and hips
 */
export function calculateCenterOfMass(keypoints) {
  const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
  const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];
  const leftHip = keypoints[KEYPOINTS.LEFT_HIP];
  const rightHip = keypoints[KEYPOINTS.RIGHT_HIP];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  // Check confidence scores
  const minConfidence = 0.3;
  if (leftShoulder.score < minConfidence || rightShoulder.score < minConfidence ||
      leftHip.score < minConfidence || rightHip.score < minConfidence) {
    return null;
  }

  // Calculate midpoints
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;

  // Center of mass is weighted average (slightly toward hips for runners)
  return {
    x: (shoulderMidX * 0.4 + hipMidX * 0.6),
    y: (shoulderMidY * 0.4 + hipMidY * 0.6),
    score: Math.min(leftShoulder.score, rightShoulder.score, leftHip.score, rightHip.score)
  };
}

/**
 * Calculate head position from ears/nose
 */
export function calculateHeadPosition(keypoints) {
  const nose = keypoints[KEYPOINTS.NOSE];
  const leftEar = keypoints[KEYPOINTS.LEFT_EAR];
  const rightEar = keypoints[KEYPOINTS.RIGHT_EAR];

  const minConfidence = 0.3;

  // Prefer nose if available
  if (nose && nose.score >= minConfidence) {
    return nose;
  }

  if (!leftEar && !rightEar) {
    return null;
  }

  if (leftEar && rightEar && leftEar.score >= minConfidence && rightEar.score >= minConfidence) {
    return {
      x: (leftEar.x + rightEar.x) / 2,
      y: (leftEar.y + rightEar.y) / 2,
      score: (leftEar.score + rightEar.score) / 2
    };
  }

  if (leftEar && leftEar.score >= minConfidence) return leftEar;
  if (rightEar && rightEar.score >= minConfidence) return rightEar;

  return null;
}

/**
 * Detect which leg is the lead leg based on movement direction
 * Returns 'left' or 'right'
 */
export function detectLeadLeg(keypoints, movementDirection = 'right') {
  const leftAnkle = keypoints[KEYPOINTS.LEFT_ANKLE];
  const rightAnkle = keypoints[KEYPOINTS.RIGHT_ANKLE];

  if (!leftAnkle || !rightAnkle) {
    return null;
  }

  // Lead leg is the one further in the direction of movement
  if (movementDirection === 'right') {
    return leftAnkle.x > rightAnkle.x ? 'left' : 'right';
  } else {
    return leftAnkle.x < rightAnkle.x ? 'left' : 'right';
  }
}

/**
 * Calculate spine angle relative to vertical (0° = upright)
 */
export function calculateSpineAngle(keypoints) {
  const head = calculateHeadPosition(keypoints);
  const leftHip = keypoints[KEYPOINTS.LEFT_HIP];
  const rightHip = keypoints[KEYPOINTS.RIGHT_HIP];

  if (!head || !leftHip || !rightHip) {
    return null;
  }

  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;

  // Calculate angle from vertical
  const dx = head.x - hipMidX;
  const dy = hipMidY - head.y; // Inverted because y increases downward

  // Angle in degrees from vertical (positive = leaning forward)
  const angleRad = Math.atan2(dx, dy);
  return angleRad * (180 / Math.PI);
}

/**
 * Calculate shin angle relative to vertical for lead leg
 * (0° = vertical, positive = shin angled forward)
 */
export function calculateShinAngle(keypoints, leadLeg = 'left') {
  const kneeIdx = leadLeg === 'left' ? KEYPOINTS.LEFT_KNEE : KEYPOINTS.RIGHT_KNEE;
  const ankleIdx = leadLeg === 'left' ? KEYPOINTS.LEFT_ANKLE : KEYPOINTS.RIGHT_ANKLE;

  const knee = keypoints[kneeIdx];
  const ankle = keypoints[ankleIdx];

  if (!knee || !ankle) {
    return null;
  }

  const minConfidence = 0.3;
  if (knee.score < minConfidence || ankle.score < minConfidence) {
    return null;
  }

  const dx = knee.x - ankle.x;
  const dy = ankle.y - knee.y; // Inverted because y increases downward

  const angleRad = Math.atan2(dx, dy);
  return angleRad * (180 / Math.PI);
}

/**
 * Calculate foot angle relative to ground for lead leg
 * BlazePose provides heel and toe positions for accurate measurement
 * (0° = flat, positive = toe up/dorsiflexed, negative = toe down/plantarflexed)
 */
export function calculateFootAngle(keypoints, leadLeg = 'left', prevKeypoints = null) {
  const heelIdx = leadLeg === 'left' ? KEYPOINTS.LEFT_HEEL : KEYPOINTS.RIGHT_HEEL;
  const toeIdx = leadLeg === 'left' ? KEYPOINTS.LEFT_FOOT_INDEX : KEYPOINTS.RIGHT_FOOT_INDEX;

  const heel = keypoints[heelIdx];
  const toe = keypoints[toeIdx];

  if (!heel || !toe) {
    return null;
  }

  const minConfidence = 0.3;
  if (heel.score < minConfidence || toe.score < minConfidence) {
    return null;
  }

  // Calculate angle from horizontal
  // Positive dx means toe is forward of heel (normal running position)
  const dx = toe.x - heel.x;
  const dy = heel.y - toe.y; // Inverted: positive dy means toe is higher

  // Angle from horizontal (positive = dorsiflexed/toe up)
  const angleRad = Math.atan2(dy, Math.abs(dx));
  return angleRad * (180 / Math.PI);
}

/**
 * Get all biomechanics data for a frame
 */
export function calculateBiomechanics(keypoints, movementDirection = 'right', prevKeypoints = null) {
  const leadLeg = detectLeadLeg(keypoints, movementDirection);

  return {
    spineAngle: calculateSpineAngle(keypoints),
    shinAngle: leadLeg ? calculateShinAngle(keypoints, leadLeg) : null,
    footAngle: leadLeg ? calculateFootAngle(keypoints, leadLeg, prevKeypoints) : null,
    leadLeg
  };
}

export default TRACKING_PROFILES;