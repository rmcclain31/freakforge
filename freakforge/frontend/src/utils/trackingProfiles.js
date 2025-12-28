/**
 * Tracking Profiles Configuration
 * Defines keypoints, metrics, and angles for different event types
 */

// MoveNet keypoint indices reference
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

// Skeleton connections for visualization
export const SKELETON_CONNECTIONS = {
  linearSprint: [
    // Head
    [MOVENET_KEYPOINTS.LEFT_EAR, MOVENET_KEYPOINTS.RIGHT_EAR],
    // Shoulders
    [MOVENET_KEYPOINTS.LEFT_SHOULDER, MOVENET_KEYPOINTS.RIGHT_SHOULDER],
    // Left arm
    [MOVENET_KEYPOINTS.LEFT_SHOULDER, MOVENET_KEYPOINTS.LEFT_ELBOW],
    // Right arm
    [MOVENET_KEYPOINTS.RIGHT_SHOULDER, MOVENET_KEYPOINTS.RIGHT_ELBOW],
    // Torso left
    [MOVENET_KEYPOINTS.LEFT_SHOULDER, MOVENET_KEYPOINTS.LEFT_HIP],
    // Torso right
    [MOVENET_KEYPOINTS.RIGHT_SHOULDER, MOVENET_KEYPOINTS.RIGHT_HIP],
    // Hips
    [MOVENET_KEYPOINTS.LEFT_HIP, MOVENET_KEYPOINTS.RIGHT_HIP],
    // Left leg
    [MOVENET_KEYPOINTS.LEFT_HIP, MOVENET_KEYPOINTS.LEFT_KNEE],
    [MOVENET_KEYPOINTS.LEFT_KNEE, MOVENET_KEYPOINTS.LEFT_ANKLE],
    // Right leg
    [MOVENET_KEYPOINTS.RIGHT_HIP, MOVENET_KEYPOINTS.RIGHT_KNEE],
    [MOVENET_KEYPOINTS.RIGHT_KNEE, MOVENET_KEYPOINTS.RIGHT_ANKLE]
  ]
};

// Tracking profiles for different event types
export const TRACKING_PROFILES = {
  linearSprint: {
    id: 'linearSprint',
    name: 'Linear Sprint',
    description: '40-yard, 10-yard fly, 10m, 60-yard, 100m, etc.',

    // Keypoints to track (MoveNet indices)
    keypoints: [
      MOVENET_KEYPOINTS.LEFT_EAR,
      MOVENET_KEYPOINTS.RIGHT_EAR,
      MOVENET_KEYPOINTS.LEFT_SHOULDER,
      MOVENET_KEYPOINTS.RIGHT_SHOULDER,
      MOVENET_KEYPOINTS.LEFT_ELBOW,
      MOVENET_KEYPOINTS.RIGHT_ELBOW,
      MOVENET_KEYPOINTS.LEFT_HIP,
      MOVENET_KEYPOINTS.RIGHT_HIP,
      MOVENET_KEYPOINTS.LEFT_KNEE,
      MOVENET_KEYPOINTS.RIGHT_KNEE,
      MOVENET_KEYPOINTS.LEFT_ANKLE,
      MOVENET_KEYPOINTS.RIGHT_ANKLE
    ],

    // Keypoint display names
    keypointNames: {
      [MOVENET_KEYPOINTS.LEFT_EAR]: 'Left Ear',
      [MOVENET_KEYPOINTS.RIGHT_EAR]: 'Right Ear',
      [MOVENET_KEYPOINTS.LEFT_SHOULDER]: 'Left Shoulder',
      [MOVENET_KEYPOINTS.RIGHT_SHOULDER]: 'Right Shoulder',
      [MOVENET_KEYPOINTS.LEFT_ELBOW]: 'Left Elbow',
      [MOVENET_KEYPOINTS.RIGHT_ELBOW]: 'Right Elbow',
      [MOVENET_KEYPOINTS.LEFT_HIP]: 'Left Hip',
      [MOVENET_KEYPOINTS.RIGHT_HIP]: 'Right Hip',
      [MOVENET_KEYPOINTS.LEFT_KNEE]: 'Left Knee',
      [MOVENET_KEYPOINTS.RIGHT_KNEE]: 'Right Knee',
      [MOVENET_KEYPOINTS.LEFT_ANKLE]: 'Left Ankle',
      [MOVENET_KEYPOINTS.RIGHT_ANKLE]: 'Right Ankle'
    },

    // Core metrics (always calculated)
    coreMetrics: ['velocity', 'acceleration', 'centerOfMass'],

    // Biomechanics metrics (optional)
    biomechanicsMetrics: ['spineAngle', 'shinAngle', 'footAngle'],

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

/**
 * Calculate center of mass from keypoints
 * Uses midpoint of shoulders and hips
 */
export function calculateCenterOfMass(keypoints) {
  const leftShoulder = keypoints[MOVENET_KEYPOINTS.LEFT_SHOULDER];
  const rightShoulder = keypoints[MOVENET_KEYPOINTS.RIGHT_SHOULDER];
  const leftHip = keypoints[MOVENET_KEYPOINTS.LEFT_HIP];
  const rightHip = keypoints[MOVENET_KEYPOINTS.RIGHT_HIP];

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
 * Calculate head position from ears
 */
export function calculateHeadPosition(keypoints) {
  const leftEar = keypoints[MOVENET_KEYPOINTS.LEFT_EAR];
  const rightEar = keypoints[MOVENET_KEYPOINTS.RIGHT_EAR];

  if (!leftEar || !rightEar) {
    return null;
  }

  const minConfidence = 0.3;
  if (leftEar.score < minConfidence && rightEar.score < minConfidence) {
    return null;
  }

  // Use the ear with higher confidence, or average if both are good
  if (leftEar.score >= minConfidence && rightEar.score >= minConfidence) {
    return {
      x: (leftEar.x + rightEar.x) / 2,
      y: (leftEar.y + rightEar.y) / 2,
      score: (leftEar.score + rightEar.score) / 2
    };
  }

  return leftEar.score > rightEar.score ? leftEar : rightEar;
}

/**
 * Detect which leg is the lead leg based on movement direction
 * Returns 'left' or 'right'
 */
export function detectLeadLeg(keypoints, movementDirection = 'right') {
  const leftAnkle = keypoints[MOVENET_KEYPOINTS.LEFT_ANKLE];
  const rightAnkle = keypoints[MOVENET_KEYPOINTS.RIGHT_ANKLE];

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
  const leftHip = keypoints[MOVENET_KEYPOINTS.LEFT_HIP];
  const rightHip = keypoints[MOVENET_KEYPOINTS.RIGHT_HIP];

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
  const kneeIdx = leadLeg === 'left' ? MOVENET_KEYPOINTS.LEFT_KNEE : MOVENET_KEYPOINTS.RIGHT_KNEE;
  const ankleIdx = leadLeg === 'left' ? MOVENET_KEYPOINTS.LEFT_ANKLE : MOVENET_KEYPOINTS.RIGHT_ANKLE;

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
 * Estimated from ankle position and knee trajectory
 * (0° = flat, positive = toe up)
 */
export function calculateFootAngle(keypoints, leadLeg = 'left', prevKeypoints = null) {
  const kneeIdx = leadLeg === 'left' ? MOVENET_KEYPOINTS.LEFT_KNEE : MOVENET_KEYPOINTS.RIGHT_KNEE;
  const ankleIdx = leadLeg === 'left' ? MOVENET_KEYPOINTS.LEFT_ANKLE : MOVENET_KEYPOINTS.RIGHT_ANKLE;

  const knee = keypoints[kneeIdx];
  const ankle = keypoints[ankleIdx];

  if (!knee || !ankle) {
    return null;
  }

  // Estimate foot angle from shin angle and ankle velocity
  // This is an approximation since MoveNet doesn't provide toe position
  const shinAngle = calculateShinAngle(keypoints, leadLeg);

  if (shinAngle === null) {
    return null;
  }

  // During ground contact, foot is roughly perpendicular to shin minus ~90°
  // During flight, foot dorsiflexes (toe up)
  // We estimate based on shin angle

  // If shin is forward (positive angle), foot tends to be dorsiflexed
  // If shin is vertical or back, foot tends to be plantarflexed
  const estimatedFootAngle = shinAngle * 0.5; // Rough estimation

  return estimatedFootAngle;
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