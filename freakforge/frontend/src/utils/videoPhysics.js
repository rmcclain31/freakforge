/**
 * Video Physics Calculations
 * Velocity, acceleration, and power calculations with time override support
 */

/**
 * Calculate physics data from tracking data
 * @param {Array} frameData - Array of frame tracking data
 * @param {number} pixelsPerUnit - Calibration: pixels per yard/meter
 * @param {number} fps - Video frames per second
 * @param {Object} timeOverrides - Optional time overrides from field measurements
 * @param {number} athleteWeight - Athlete weight in lbs (for power calc)
 * @returns {Object} Physics analysis results
 */
export function calculatePhysics(frameData, pixelsPerUnit, fps, timeOverrides = null, athleteWeight = null) {
  if (!frameData || frameData.length < 2) {
    return null;
  }

  // Extract position data (using center of mass x-coordinate)
  const rawPositions = frameData.map((frame, i) => {
    const com = frame.centerOfMass;
    return {
      frame: i,
      time: frame.time,
      pixelX: com ? com.x : null,
      pixelY: com ? com.y : null
    };
  }).filter(p => p.pixelX !== null);

  if (rawPositions.length < 2) {
    return null;
  }

  // Convert pixel positions to real-world units (yards)
  const startPixelX = rawPositions[0].pixelX;
  const positions = rawPositions.map(p => ({
    ...p,
    position: Math.abs(p.pixelX - startPixelX) / pixelsPerUnit
  }));

  // If time overrides exist, rescale the time axis
  let processedData;
  if (timeOverrides && hasValidOverrides(timeOverrides)) {
    processedData = rescaleWithOverrides(positions, timeOverrides, fps);
  } else {
    processedData = calculateRawPhysics(positions, fps);
  }

  // Add power calculations if weight is provided
  if (athleteWeight) {
    processedData = addPowerCalculations(processedData, athleteWeight);
  }

  // Calculate summary statistics
  const summary = calculateSummary(processedData, timeOverrides);

  return {
    frames: processedData,
    summary,
    hasTimeOverrides: hasValidOverrides(timeOverrides)
  };
}

/**
 * Check if time overrides are valid
 */
function hasValidOverrides(overrides) {
  if (!overrides) return false;
  return overrides.startTime !== null ||
         overrides.endTime !== null ||
         (overrides.splits && Object.keys(overrides.splits).some(k => overrides.splits[k] !== null));
}

/**
 * Calculate raw physics without time overrides
 */
function calculateRawPhysics(positions, fps) {
  const dt = 1 / fps;

  return positions.map((p, i) => {
    let velocity = 0;
    let acceleration = 0;

    if (i > 0) {
      const dx = p.position - positions[i - 1].position;
      velocity = dx / dt; // yards per second
    }

    if (i > 1) {
      const prevVelocity = (positions[i - 1].position - positions[i - 2].position) / dt;
      acceleration = (velocity - prevVelocity) / dt; // yards per second squared
    }

    return {
      frame: p.frame,
      time: p.time,
      position: p.position,
      velocity,
      velocityMph: velocity * 2.045454545, // yards/s to mph
      acceleration,
      accelerationG: acceleration / 32.174 // ft/s² to g (converting yards to feet)
    };
  });
}

/**
 * Rescale physics data using field-measured time overrides
 * This adjusts the time axis to match real-world measurements
 */
function rescaleWithOverrides(positions, overrides, fps) {
  const { startTime, endTime, splits } = overrides;

  // Build time mapping points from overrides
  const timeMapping = [];

  // Start point
  if (startTime !== null) {
    timeMapping.push({ position: 0, measuredTime: startTime });
  } else {
    timeMapping.push({ position: 0, measuredTime: positions[0].time });
  }

  // Split points
  if (splits) {
    for (const [distance, time] of Object.entries(splits)) {
      if (time !== null) {
        timeMapping.push({ position: parseFloat(distance), measuredTime: time });
      }
    }
  }

  // End point
  const finalPosition = positions[positions.length - 1].position;
  if (endTime !== null) {
    timeMapping.push({ position: finalPosition, measuredTime: endTime });
  }

  // Sort by position
  timeMapping.sort((a, b) => a.position - b.position);

  // Create interpolated time for each frame based on position
  const rescaledData = positions.map((p, i) => {
    // Find surrounding time mapping points
    let lowerIdx = 0;
    let upperIdx = timeMapping.length - 1;

    for (let j = 0; j < timeMapping.length - 1; j++) {
      if (p.position >= timeMapping[j].position && p.position <= timeMapping[j + 1].position) {
        lowerIdx = j;
        upperIdx = j + 1;
        break;
      }
    }

    // Linear interpolation
    const lower = timeMapping[lowerIdx];
    const upper = timeMapping[upperIdx];

    let rescaledTime;
    if (upper.position === lower.position) {
      rescaledTime = lower.measuredTime;
    } else {
      const t = (p.position - lower.position) / (upper.position - lower.position);
      rescaledTime = lower.measuredTime + t * (upper.measuredTime - lower.measuredTime);
    }

    return {
      ...p,
      originalTime: p.time,
      time: rescaledTime
    };
  });

  // Calculate velocity and acceleration using rescaled times
  return rescaledData.map((p, i) => {
    let velocity = 0;
    let acceleration = 0;

    if (i > 0) {
      const dx = p.position - rescaledData[i - 1].position;
      const dt = p.time - rescaledData[i - 1].time;
      velocity = dt > 0 ? dx / dt : 0;
    }

    if (i > 1) {
      const prevDx = rescaledData[i - 1].position - rescaledData[i - 2].position;
      const prevDt = rescaledData[i - 1].time - rescaledData[i - 2].time;
      const prevVelocity = prevDt > 0 ? prevDx / prevDt : 0;

      const dt = p.time - rescaledData[i - 1].time;
      acceleration = dt > 0 ? (velocity - prevVelocity) / dt : 0;
    }

    return {
      frame: p.frame,
      time: p.time,
      originalTime: p.originalTime,
      position: p.position,
      velocity,
      velocityMph: velocity * 2.045454545,
      acceleration,
      accelerationG: acceleration / 32.174
    };
  });
}

/**
 * Add power calculations to physics data
 */
function addPowerCalculations(data, weightLbs) {
  const massKg = weightLbs * 0.453592;

  return data.map(p => {
    // Power = Force × Velocity
    // Force = mass × acceleration
    const accelerationMs2 = p.acceleration * 0.9144; // yards/s² to m/s²
    const velocityMs = p.velocity * 0.9144; // yards/s to m/s

    const force = massKg * Math.abs(accelerationMs2);
    const power = force * Math.abs(velocityMs);

    return {
      ...p,
      power: power > 0 ? power : 0
    };
  });
}

/**
 * Calculate summary statistics
 */
function calculateSummary(data, timeOverrides) {
  if (!data || data.length === 0) {
    return null;
  }

  // Apply smoothing for peak calculations to reduce noise
  const smoothedVelocities = smoothData(data.map(d => d.velocity), 5);
  const smoothedAccelerations = smoothData(data.map(d => d.acceleration), 5);

  const maxVelocity = Math.max(...smoothedVelocities);
  const maxVelocityMph = maxVelocity * 2.045454545;
  const avgVelocity = smoothedVelocities.reduce((a, b) => a + b, 0) / smoothedVelocities.length;
  const avgVelocityMph = avgVelocity * 2.045454545;

  const maxAcceleration = Math.max(...smoothedAccelerations.map(Math.abs));
  const maxAccelerationG = maxAcceleration / 32.174;

  // Peak acceleration (positive only, for explosive power)
  const peakAcceleration = Math.max(...smoothedAccelerations);
  const peakAccelerationG = peakAcceleration / 32.174;

  // Calculate splits
  const splits = calculateSplits(data, [10, 20, 30, 40], timeOverrides);

  // Total time and distance
  const totalTime = data[data.length - 1].time - data[0].time;
  const totalDistance = data[data.length - 1].position;

  // Max power (if calculated)
  const powers = data.map(d => d.power).filter(p => p !== undefined && p !== null);
  const maxPower = powers.length > 0 ? Math.max(...smoothData(powers, 5)) : null;

  // Find frame of max velocity
  const maxVelocityIdx = smoothedVelocities.indexOf(maxVelocity);
  const maxVelocityTime = data[maxVelocityIdx]?.time || null;
  const maxVelocityPosition = data[maxVelocityIdx]?.position || null;

  return {
    totalTime,
    totalDistance,
    maxVelocity,
    maxVelocityMph,
    maxVelocityTime,
    maxVelocityPosition,
    avgVelocity,
    avgVelocityMph,
    maxAcceleration,
    maxAccelerationG,
    peakAcceleration,
    peakAccelerationG,
    maxPower,
    splits
  };
}

/**
 * Calculate split times at specified distances
 */
function calculateSplits(data, distances, timeOverrides) {
  const splits = {};

  for (const distance of distances) {
    // Check if we have an override for this split
    if (timeOverrides?.splits?.[distance] !== null && timeOverrides?.splits?.[distance] !== undefined) {
      splits[distance] = timeOverrides.splits[distance];
      continue;
    }

    // Find frame where position crosses this distance
    const frame = data.find(d => d.position >= distance);
    if (frame) {
      // Interpolate for more accurate time
      const prevFrame = data.find(d => d.position < distance && data.indexOf(d) === data.indexOf(frame) - 1);
      if (prevFrame) {
        const t = (distance - prevFrame.position) / (frame.position - prevFrame.position);
        splits[distance] = prevFrame.time + t * (frame.time - prevFrame.time);
      } else {
        splits[distance] = frame.time;
      }
    } else {
      splits[distance] = null;
    }
  }

  return splits;
}

/**
 * Simple moving average smoothing
 */
function smoothData(data, windowSize) {
  const result = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const window = data.slice(start, end);
    result.push(window.reduce((a, b) => a + b, 0) / window.length);
  }

  return result;
}

/**
 * Calculate biomechanics time series from frame data
 */
export function calculateBiomechanicsTimeSeries(frameData) {
  return frameData
    .filter(f => f.biomechanics)
    .map(f => ({
      frame: f.frame,
      time: f.time,
      spineAngle: f.biomechanics.spineAngle,
      shinAngle: f.biomechanics.shinAngle,
      footAngle: f.biomechanics.footAngle,
      leadLeg: f.biomechanics.leadLeg
    }));
}

/**
 * Detect start of movement (first significant acceleration)
 * @param {Array} frameData - Frame tracking data
 * @param {number} pixelsPerUnit - Calibration
 * @param {number} threshold - Velocity threshold in yards/s
 * @returns {number} Frame index of movement start
 */
export function detectMovementStart(frameData, pixelsPerUnit, threshold = 0.5) {
  if (!frameData || frameData.length < 2) return 0;

  const startPixelX = frameData[0].centerOfMass?.x || 0;

  for (let i = 1; i < frameData.length; i++) {
    const com = frameData[i].centerOfMass;
    const prevCom = frameData[i - 1].centerOfMass;

    if (!com || !prevCom) continue;

    const dx = Math.abs(com.x - prevCom.x) / pixelsPerUnit;
    const dt = frameData[i].time - frameData[i - 1].time;
    const velocity = dt > 0 ? dx / dt : 0;

    if (velocity > threshold) {
      // Return the frame just before movement started
      return Math.max(0, i - 1);
    }
  }

  return 0;
}

/**
 * Detect end of movement (velocity drops below threshold)
 */
export function detectMovementEnd(frameData, pixelsPerUnit, threshold = 0.5) {
  if (!frameData || frameData.length < 2) return frameData.length - 1;

  // Start from the end and look backwards
  for (let i = frameData.length - 1; i > 0; i--) {
    const com = frameData[i].centerOfMass;
    const prevCom = frameData[i - 1].centerOfMass;

    if (!com || !prevCom) continue;

    const dx = Math.abs(com.x - prevCom.x) / pixelsPerUnit;
    const dt = frameData[i].time - frameData[i - 1].time;
    const velocity = dt > 0 ? dx / dt : 0;

    if (velocity > threshold) {
      return i;
    }
  }

  return frameData.length - 1;
}

export default {
  calculatePhysics,
  calculateBiomechanicsTimeSeries,
  detectMovementStart,
  detectMovementEnd
};