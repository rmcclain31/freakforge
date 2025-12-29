import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import dataService from '../../utils/dataService';
import { useAppContext } from '../../context/AppContext';
import {
  initializePoseDetector,
  isDetectorReady,
  processVideo as processVideoWithAI,
  applyManualAdjustment,
  detectMovementDirection,
  disposeDetector
} from '../../utils/poseDetection';
import {
  calculatePhysics,
  calculateBiomechanicsTimeSeries,
  detectMovementStart,
  detectMovementEnd
} from '../../utils/videoPhysics';
import {
  TRACKING_PROFILES,
  SKELETON_CONNECTIONS,
  MOVENET_KEYPOINTS
} from '../../utils/trackingProfiles';

Chart.register(...registerables);

const ATHLETE_COLORS = [
  { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)', point: 'rgba(239, 68, 68, 1)', name: 'Red' },
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 1)', point: 'rgba(59, 130, 246, 1)', name: 'Blue' },
  { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 1)', point: 'rgba(16, 185, 129, 1)', name: 'Green' },
];

// Keypoint colors for visualization
const KEYPOINT_COLORS = {
  head: '#fbbf24',      // Yellow - ears
  shoulder: '#ea580c',  // Blue
  elbow: '#ea580c',     // Purple
  hip: '#10b981',       // Green
  knee: '#f97316',      // Orange
  ankle: '#ef4444',     // Red
  centerOfMass: '#ffffff' // White
};

// Drill templates with cone/marker configurations
const DRILL_TEMPLATES = {
  'custom': {
    name: 'Custom',
    description: 'Freeform calibration',
    markers: [],
    calibrationType: 'line'
  },
  '40-yard': {
    name: '40-Yard Dash',
    description: 'Start line to finish line (40 yards)',
    distance: 40,
    unit: 'yards',
    markers: ['Start Line', 'Finish Line'],
    calibrationType: 'line'
  },
  '10-yard': {
    name: '10-Yard Fly',
    description: 'Flying 10 yard sprint',
    distance: 10,
    unit: 'yards',
    markers: ['Start Line', 'Finish Line'],
    calibrationType: 'line'
  },
  '60-yard': {
    name: '60-Yard Dash',
    description: 'Start line to finish line (60 yards)',
    distance: 60,
    unit: 'yards',
    markers: ['Start Line', 'Finish Line'],
    calibrationType: 'line'
  },
  '100-meter': {
    name: '100 Meter',
    description: 'Start line to finish line (100m)',
    distance: 109.36, // Convert to yards for internal calculations
    unit: 'meters',
    markers: ['Start Line', 'Finish Line'],
    calibrationType: 'line'
  },
  '5-10-5': {
    name: '5-10-5 Pro Agility',
    description: '3 cones at 5-yard intervals',
    distances: [5, 5],
    unit: 'yards',
    markers: ['Left Cone', 'Center Cone', 'Right Cone'],
    calibrationType: 'cones-3'
  },
  'l-drill': {
    name: 'L-Drill',
    description: '3 cones in L-shape (5 yards each leg)',
    distances: [5, 5],
    unit: 'yards',
    markers: ['Start Cone', 'Middle Cone', 'End Cone'],
    calibrationType: 'l-drill'
  },
  'grid': {
    name: '4-Point Grid',
    description: 'Perspective calibration using 4 points',
    markers: ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'],
    calibrationType: 'grid'
  }
};

// Drill types for recording
const DRILL_TYPES = [
  '40-Yard Dash',
  '10-Yard Fly',
  '60-Yard Dash',
  '100 Meter',
  '5-10-5 Pro Agility',
  'L-Drill',
  'Vertical Jump',
  'Broad Jump',
  'Shuttle Run',
  'Cone Drill',
  'Position Drill',
  'Other'
];

// Reusable ForgedGlyph component
const ForgedGlyph = ({ size = '1rem', color = '#ef4444' }) => {
  const fontSize = typeof size === 'string' ? `calc(${size} * 1.2)` : `${size * 1.2}px`;
  return (
    <span style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontStyle: 'italic',
      fontWeight: 'bold',
      fontFamily: 'Georgia, serif',
      fontSize,
      color,
      lineHeight: 1
    }}>
      <span style={{ position: 'relative', zIndex: 1 }}>f</span>
      <span style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '50%',
        height: '2px',
        background: color,
        zIndex: 2
      }}></span>
    </span>
  );
};

function VideoAnalysis() {
  // Athlete data
  const [athletes, setAthletes] = useState([]);
  const [manualAthlete, setManualAthlete] = useState({ name: '', weight: '', height: '' });
  const [weightOverride, setWeightOverride] = useState('');

  // Video state
  const [videoSource, setVideoSource] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [fps, setFps] = useState(30);

  // Recording state
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStream, setRecordingStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState(null);

  // Recording metadata
  const [recordingMetadata, setRecordingMetadata] = useState({
    firstName: '',
    lastName: '',
    drillType: '40-Yard Dash',
    notes: ''
  });

  // Trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1); // 0-1 percentage
  const [isDraggingTrim, setIsDraggingTrim] = useState(null); // 'start' | 'end' | null
  const [isTrimApplied, setIsTrimApplied] = useState(false);
  const [effectiveDuration, setEffectiveDuration] = useState(0);
  const [effectiveStartTime, setEffectiveStartTime] = useState(0);
  const trimContainerRef = useRef(null);

  // Save preferences
  const [saveMode, setSaveMode] = useState('individual');
  const [defaultSavePath, setDefaultSavePath] = useState('');

  // Recording preview resize
  const [recordingPreviewHeight, setRecordingPreviewHeight] = useState(240);
  const [isResizingPreview, setIsResizingPreview] = useState(false);

  // Video panel resize
  const [videoContainerHeight, setVideoContainerHeight] = useState(300); // Default height in pixels
  const [isResizingVideo, setIsResizingVideo] = useState(false);
  const videoResizeStartY = useRef(0);
  const videoResizeStartHeight = useRef(0);

  // Video render dimensions (for canvas alignment)
  const [videoRenderDims, setVideoRenderDims] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  // Calibration state
  const [selectedDrill, setSelectedDrill] = useState('custom');
  const [calibrationMode, setCalibrationMode] = useState('line');
  const [calibrationMarkers, setCalibrationMarkers] = useState([]);
  const [activeMarkerIndex, setActiveMarkerIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [pixelsPerYard, setPixelsPerYard] = useState(null);
  const [isSettingCalibration, setIsSettingCalibration] = useState(false); // true when user is placing points

  // AI Pose Detection state
  const [poseDetectorReady, setPoseDetectorReady] = useState(false);
  const [poseDetectorLoading, setPoseDetectorLoading] = useState(false);
  const [poseDetectorError, setPoseDetectorError] = useState(null);

  // Tracking Profile state
  const [activeProfile, setActiveProfile] = useState('linearSprint');
  const [movementDirection, setMovementDirection] = useState('right');

  // Tracking data state
  const [trackingData, setTrackingData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingCancelled, setProcessingCancelled] = useState(false);

  // Manual keyframe adjustment state
  const [selectedKeypoint, setSelectedKeypoint] = useState(null);
  const [isDraggingKeypoint, setIsDraggingKeypoint] = useState(false);
  const [manualKeyframes, setManualKeyframes] = useState([]);

  // Biomechanics toggle
  const [enableBiomechanics, setEnableBiomechanics] = useState(false);

  // Tracking quality state
  const [trackingQuality, setTrackingQuality] = useState(null);
  const [frameConfidences, setFrameConfidences] = useState([]);
  const [showQualityWarning, setShowQualityWarning] = useState(false);

  // Athlete selection mode (for crowded scenes)
  const [athleteSelectionMode, setAthleteSelectionMode] = useState(false);
  const [selectedAthleteBox, setSelectedAthleteBox] = useState(null);

  // Manual tracking fallback mode
  const [manualTrackingMode, setManualTrackingMode] = useState(false);
  const [manualCOMPoints, setManualCOMPoints] = useState([]);

  // Confidence threshold setting
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.3);

  // Time override state
  const [timeOverrides, setTimeOverrides] = useState({
    startTime: null,
    endTime: null,
    splits: { 10: null, 20: null, 30: null, 40: null }
  });
  const [showTimeOverrides, setShowTimeOverrides] = useState(false);

  // Results state
  const [analysisResults, setAnalysisResults] = useState(null);
  const [biomechanicsResults, setBiomechanicsResults] = useState(null);
  const [activeResultTab, setActiveResultTab] = useState('summary');

  // Legacy player marker (kept for backwards compatibility)
  const [playerMarker, setPlayerMarker] = useState(null);
  const [isPlacingPlayer, setIsPlacingPlayer] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const recordingVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const speedChartRef = useRef(null);
  const accelChartRef = useRef(null);
  const powerChartRef = useRef(null);
  const spineAngleChartRef = useRef(null);
  const shinAngleChartRef = useRef(null);
  const speedChartInstance = useRef(null);
  const accelChartInstance = useRef(null);
  const powerChartInstance = useRef(null);
  const spineAngleChartInstance = useRef(null);
  const shinAngleChartInstance = useRef(null);
  const fileInputRef = useRef(null);
  const trimSliderRef = useRef(null);
  const cancelProcessingRef = useRef(false);
  const isSteppingRef = useRef(false); // Track if we're manually stepping frames

  // Context
  const {
    selectedAthletes,
    toggleAthleteSelection,
    clearSelectedAthletes,
    searchQuery,
    setSearchQuery,
    applyFiltersToList,
    setApplyFiltersToList,
    filters,
    hasActiveFilters
  } = useAppContext();

  // Load athletes
  useEffect(() => {
    dataService.loadData().then(data => {
      setAthletes(data.athletes);
    });
  }, []);

  // Initialize pose detector on mount
  useEffect(() => {
    const initDetector = async () => {
      setPoseDetectorLoading(true);
      setPoseDetectorError(null);
      try {
        await initializePoseDetector();
        setPoseDetectorReady(true);
      } catch (error) {
        console.error('Failed to initialize pose detector:', error);
        setPoseDetectorError(error.message);
      } finally {
        setPoseDetectorLoading(false);
      }
    };

    initDetector();

    return () => {
      disposeDetector();
    };
  }, []);

  // Cleanup recording stream on unmount
  useEffect(() => {
    return () => {
      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordingStream, recordedVideoUrl]);

  // Keep video preview connected to stream during recording
  useEffect(() => {
    if (recordingVideoRef.current && recordingStream) {
      recordingVideoRef.current.srcObject = recordingStream;
    }
  }, [recordingStream, isRecording]);

  // Get selected athlete object
  const selectedAthleteObjects = athletes.filter(a => selectedAthletes.includes(a.id));
  const primaryAthlete = selectedAthleteObjects.length > 0 ? selectedAthleteObjects[0] : null;

  // Get effective weight for power calculations
  const getEffectiveWeight = () => {
    if (weightOverride) return parseFloat(weightOverride);
    if (primaryAthlete) return primaryAthlete.weight;
    if (manualAthlete.weight) return parseFloat(manualAthlete.weight);
    return null;
  };

  // Get current frame's tracking data
  const getCurrentFrameData = () => {
    if (!trackingData || trackingData.length === 0) return null;
    return trackingData.find(f => f.frame === currentFrame) || null;
  };

  // ============ RECORDING FUNCTIONS ============

  const startRecordingMode = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'environment' },
        audio: true
      });
      setRecordingStream(stream);
      setIsRecordingMode(true);
      setVideoError('');

      if (recordingVideoRef.current) {
        recordingVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      setVideoError(`Camera access denied: ${err.message}. Please allow camera access to record videos.`);
    }
  };

  const stopRecordingMode = () => {
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => track.stop());
    }
    setRecordingStream(null);
    setIsRecordingMode(false);
    setIsRecording(false);
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
  };

  const startRecording = () => {
    if (!recordingStream) return;

    const chunks = [];
    const recorder = new MediaRecorder(recordingStream, { mimeType: 'video/webm' });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedVideoUrl(url);
      setRecordedChunks(chunks);
      setTrimStart(0);
      setTrimEnd(recordingDuration);
      stopRecordingMode();
    };

    setMediaRecorder(recorder);
    setRecordedChunks([]);
    setRecordingDuration(0);
    recorder.start(100);
    setIsRecording(true);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    setRecordingTimer(timer);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    setIsRecording(false);
  };

  const generateFilename = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const lastName = recordingMetadata.lastName.trim() || 'unknown';
    const firstName = recordingMetadata.firstName.trim() || 'athlete';
    return `${dateStr} ${timeStr} ${lastName}_${firstName}`;
  };

  const saveRecordedVideo = async () => {
    if (!recordedBlob) return;

    const filename = generateFilename() + '.webm';
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const useRecordedVideo = () => {
    if (recordedVideoUrl) {
      setVideoSource(recordedVideoUrl);
      setRecordedVideoUrl(null);
      setRecordedBlob(null);
    }
  };

  const discardRecordedVideo = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setRecordedBlob(null);
    setRecordedChunks([]);
    setTrimStart(0);
    setTrimEnd(0);
  };

  // ============ VIDEO FILE HANDLING ============

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSource(url);
      setVideoError('');
      resetAnalysis();
    }
  };

  const handleUrlSubmit = () => {
    if (!videoUrl.trim()) return;

    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const videoId = extractYouTubeId(videoUrl);
      if (videoId) {
        setVideoError('YouTube videos require download first. Use a tool like yt-dlp to download, then upload the file.');
        return;
      }
    }

    if (videoUrl.includes('hudl.com')) {
      setVideoError('Hudl videos require download first. Use Hudl\'s download feature, then upload the file.');
      return;
    }

    setVideoSource(videoUrl);
    setVideoError('');
    resetAnalysis();
  };

  const extractYouTubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const resetAnalysis = () => {
    setCalibrationMarkers([]);
    setPlayerMarker(null);
    setTrackingData([]);
    setAnalysisResults(null);
    setBiomechanicsResults(null);
    setIsCalibrated(false);
    setPixelsPerYard(null);
    setCurrentFrame(0);
    setManualKeyframes([]);
    setTimeOverrides({
      startTime: null,
      endTime: null,
      splits: { 10: null, 20: null, 30: null, 40: null }
    });
    // Reset quality tracking
    setTrackingQuality(null);
    setFrameConfidences([]);
    setShowQualityWarning(false);
    // Reset athlete selection
    setAthleteSelectionMode(false);
    setSelectedAthleteBox(null);
    // Reset manual tracking
    setManualTrackingMode(false);
    setManualCOMPoints([]);
  };

  // Calculate video render dimensions within container
  const updateVideoRenderDims = useCallback(() => {
    if (!containerRef.current || !videoRef.current) return;

    const container = containerRef.current;
    const video = videoRef.current;
    const containerRect = container.getBoundingClientRect();

    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 360;

    const containerAspect = containerRect.width / containerRect.height;
    const videoAspect = videoWidth / videoHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (containerAspect > videoAspect) {
      // Container is wider - video has horizontal letterboxing
      renderHeight = containerRect.height;
      renderWidth = containerRect.height * videoAspect;
      offsetX = (containerRect.width - renderWidth) / 2;
      offsetY = 0;
    } else {
      // Container is taller - video has vertical letterboxing
      renderWidth = containerRect.width;
      renderHeight = containerRect.width / videoAspect;
      offsetX = 0;
      offsetY = (containerRect.height - renderHeight) / 2;
    }

    setVideoRenderDims({ width: renderWidth, height: renderHeight, offsetX, offsetY });
  }, []);

  // Trim slider handlers
  const handleTrimDragStart = (handle, e) => {
    e.preventDefault();
    setIsDraggingTrim(handle);
  };

  const handleTrimDragMove = useCallback((e) => {
    if (!isDraggingTrim || !trimContainerRef.current || !videoRef.current) return;

    const rect = trimContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (isDraggingTrim === 'start') {
      const newStart = Math.min(x, trimEnd - 0.01);
      setTrimStart(newStart);
      // Scrub video to match
      videoRef.current.currentTime = newStart * duration;
      setCurrentTime(newStart * duration);
      setCurrentFrame(Math.floor(newStart * duration * fps));
    } else if (isDraggingTrim === 'end') {
      const newEnd = Math.max(x, trimStart + 0.01);
      setTrimEnd(newEnd);
      // Scrub video to match
      videoRef.current.currentTime = newEnd * duration;
      setCurrentTime(newEnd * duration);
      setCurrentFrame(Math.floor(newEnd * duration * fps));
    }
  }, [isDraggingTrim, trimStart, trimEnd, duration, fps]);

  const handleTrimDragEnd = useCallback(() => {
    setIsDraggingTrim(null);
  }, []);

  // Global handlers for trim dragging
  useEffect(() => {
    if (isDraggingTrim) {
      window.addEventListener('mousemove', handleTrimDragMove);
      window.addEventListener('mouseup', handleTrimDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleTrimDragMove);
        window.removeEventListener('mouseup', handleTrimDragEnd);
      };
    }
  }, [isDraggingTrim, handleTrimDragMove, handleTrimDragEnd]);

  // Reset trim when video changes
  useEffect(() => {
    setTrimStart(0);
    setTrimEnd(1);
  }, [videoSource]);

  // ============ VIDEO PLAYBACK ============

  const handleVideoLoad = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setTotalFrames(Math.floor(dur * fps));
      setEffectiveDuration(dur);
      setEffectiveStartTime(0);
      setIsTrimApplied(false);
      setTrimStart(0);
      setTrimEnd(1);

      // Initialize canvas dimensions
      if (canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || 640;
        canvasRef.current.height = videoRef.current.videoHeight || 360;
      }

      // Calculate video render dimensions after a brief delay to ensure layout is complete
      setTimeout(updateVideoRenderDims, 50);
    }
  };

  // Apply trim to video
  const applyTrim = () => {
    if (!videoRef.current) return;

    const startTime = trimStart * duration;
    const endTime = trimEnd * duration;
    const trimmedDuration = endTime - startTime;

    setEffectiveStartTime(startTime);
    setEffectiveDuration(trimmedDuration);
    setTotalFrames(Math.floor(trimmedDuration * fps));
    setIsTrimApplied(true);

    // Reset trim sliders for potential future re-trim
    setTrimStart(0);
    setTrimEnd(1);

    // Seek to start of trimmed region, set relative time to 0
    videoRef.current.currentTime = startTime;
    setCurrentTime(0);
    setCurrentFrame(0);
  };

  // Reset trim
  const resetTrim = () => {
    if (!videoRef.current) return;

    setTrimStart(0);
    setTrimEnd(1);
    setEffectiveStartTime(0);
    setEffectiveDuration(duration);
    setTotalFrames(Math.floor(duration * fps));
    setIsTrimApplied(false);

    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    setCurrentFrame(0);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isSteppingRef.current) {
      const actualTime = videoRef.current.currentTime;

      // If trim is applied, calculate relative time
      if (isTrimApplied) {
        const relativeTime = actualTime - effectiveStartTime;
        setCurrentTime(relativeTime);
        setCurrentFrame(Math.floor(relativeTime * fps));

        // Stop at end of trimmed region
        const endTime = effectiveStartTime + effectiveDuration;
        if (actualTime >= endTime) {
          videoRef.current.pause();
          videoRef.current.currentTime = endTime;
          setIsPlaying(false);
        }
      } else {
        setCurrentTime(actualTime);
        setCurrentFrame(Math.floor(actualTime * fps));
      }
    }
  };

  const seekToFrame = (frame) => {
    if (videoRef.current) {
      isSteppingRef.current = true;
      videoRef.current.pause();

      // Calculate actual time based on trim
      const relativeTime = frame / fps;
      const actualTime = isTrimApplied ? effectiveStartTime + relativeTime : relativeTime;

      videoRef.current.currentTime = actualTime;
      setCurrentFrame(frame);
      setCurrentTime(relativeTime);
      setIsPlaying(false);
      // Reset stepping flag after seek completes
      setTimeout(() => { isSteppingRef.current = false; }, 100);
    }
  };

  const stepFrame = (delta) => {
    if (!videoRef.current) return;

    // Pause video for frame stepping
    videoRef.current.pause();
    setIsPlaying(false);
    isSteppingRef.current = true;

    // Calculate new frame (clamped to trim range)
    const maxFrame = totalFrames - 1;
    const newFrame = Math.max(0, Math.min(maxFrame, currentFrame + delta));
    const relativeTime = newFrame / fps;

    // Calculate actual video time
    const actualTime = isTrimApplied ? effectiveStartTime + relativeTime : relativeTime;

    // Update video and state
    videoRef.current.currentTime = actualTime;
    setCurrentFrame(newFrame);
    setCurrentTime(relativeTime);

    // Reset stepping flag after seek completes
    setTimeout(() => { isSteppingRef.current = false; }, 100);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // If at end of trim, seek to start before playing
        if (isTrimApplied) {
          const endTime = effectiveStartTime + effectiveDuration;
          if (videoRef.current.currentTime >= endTime - 0.1) {
            videoRef.current.currentTime = effectiveStartTime;
          }
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Video container resize handlers
  const handleVideoResizeStart = (e) => {
    e.preventDefault();
    setIsResizingVideo(true);
    videoResizeStartY.current = e.clientY;
    videoResizeStartHeight.current = videoContainerHeight;
  };

  const handleVideoResizeMove = useCallback((e) => {
    if (!isResizingVideo) return;
    const deltaY = e.clientY - videoResizeStartY.current;
    const newHeight = Math.max(150, Math.min(window.innerHeight * 0.7, videoResizeStartHeight.current + deltaY));
    setVideoContainerHeight(newHeight);
  }, [isResizingVideo]);

  const handleVideoResizeEnd = useCallback(() => {
    setIsResizingVideo(false);
    // Recalculate video render dimensions after resize
    setTimeout(updateVideoRenderDims, 50);
  }, [updateVideoRenderDims]);

  // Update video render dims when container size or video changes
  useEffect(() => {
    updateVideoRenderDims();
  }, [videoContainerHeight, videoSource, updateVideoRenderDims]);

  // Also update on window resize
  useEffect(() => {
    window.addEventListener('resize', updateVideoRenderDims);
    return () => window.removeEventListener('resize', updateVideoRenderDims);
  }, [updateVideoRenderDims]);

  // Global mouse handlers for video resize
  useEffect(() => {
    if (isResizingVideo) {
      window.addEventListener('mousemove', handleVideoResizeMove);
      window.addEventListener('mouseup', handleVideoResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleVideoResizeMove);
        window.removeEventListener('mouseup', handleVideoResizeEnd);
      };
    }
  }, [isResizingVideo, handleVideoResizeMove, handleVideoResizeEnd]);

  // Determine cursor style based on mode
  const getCanvasCursor = () => {
    if (athleteSelectionMode) return 'crosshair';
    if (manualTrackingMode) return 'crosshair';
    if (selectedKeypoint !== null) return 'crosshair';
    if (isSettingCalibration && !isCalibrated) return 'crosshair';
    return 'default';
  };

  // ============ CALIBRATION ============

  const handleDrillSelect = (drillKey) => {
    setSelectedDrill(drillKey);
    const drill = DRILL_TEMPLATES[drillKey];
    setCalibrationMode(drill.calibrationType);
    setCalibrationMarkers([]);
    setIsCalibrated(false);
    setIsSettingCalibration(false);

    if (drill.distance) {
      setCalibrationDistance(drill.distance.toString());
    } else {
      setCalibrationDistance('');
    }
  };

  const handleCanvasClick = (e) => {
    if (!containerRef.current || !videoRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const video = videoRef.current;

    // Get actual video dimensions
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 360;

    // Use stored render dims or calculate on the fly
    let { offsetX, offsetY, width: renderWidth, height: renderHeight } = videoRenderDims;

    if (!renderWidth || !renderHeight) {
      // Calculate render dimensions
      const containerAspect = containerRect.width / containerRect.height;
      const videoAspect = videoWidth / videoHeight;

      if (containerAspect > videoAspect) {
        renderHeight = containerRect.height;
        renderWidth = containerRect.height * videoAspect;
        offsetX = (containerRect.width - renderWidth) / 2;
        offsetY = 0;
      } else {
        renderWidth = containerRect.width;
        renderHeight = containerRect.width / videoAspect;
        offsetX = 0;
        offsetY = (containerRect.height - renderHeight) / 2;
      }
    }

    // Get click position relative to container
    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    // Check if click is within the video render area
    if (clickX < offsetX || clickX > offsetX + renderWidth ||
        clickY < offsetY || clickY > offsetY + renderHeight) {
      return; // Click was in letterbox area
    }

    // Convert to video pixel coordinates
    const x = ((clickX - offsetX) / renderWidth) * videoWidth;
    const y = ((clickY - offsetY) / renderHeight) * videoHeight;

    // Handle athlete selection mode (for crowded scenes)
    if (athleteSelectionMode) {
      setSelectedAthleteBox({ x, y, width: 100, height: 200 }); // Default box size
      setAthleteSelectionMode(false);
      return;
    }

    // Handle manual COM tracking mode
    if (manualTrackingMode) {
      const newPoint = {
        frame: currentFrame,
        time: currentFrame / fps,
        x,
        y,
        isManual: true
      };

      // Update or add point for current frame
      setManualCOMPoints(prev => {
        const existing = prev.findIndex(p => p.frame === currentFrame);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newPoint;
          return updated;
        }
        return [...prev, newPoint].sort((a, b) => a.frame - b.frame);
      });
      return;
    }

    // Handle keypoint dragging
    if (selectedKeypoint !== null && trackingData.length > 0) {
      const frameData = getCurrentFrameData();
      if (frameData && frameData.keypoints) {
        const updatedTracking = applyManualAdjustment(
          [...trackingData],
          currentFrame,
          { [selectedKeypoint]: { x, y } }
        );
        setTrackingData(updatedTracking);
        setManualKeyframes([...new Set([...manualKeyframes, currentFrame])]);
      }
      setSelectedKeypoint(null);
      return;
    }

    // Handle calibration marker placement - only when in setting mode
    if (isSettingCalibration && !isCalibrated) {
      const maxMarkers = {
        'line': 2,
        'cones-3': 3,
        'l-drill': 3,
        'grid': 4
      }[calibrationMode] || 2;

      if (calibrationMarkers.length < maxMarkers) {
        const drill = DRILL_TEMPLATES[selectedDrill];
        const label = drill.markers?.[calibrationMarkers.length] || `Point ${calibrationMarkers.length + 1}`;
        setCalibrationMarkers([...calibrationMarkers, { x, y, label }]);
      }
    }
  };

  const handleMarkerMouseDown = (index, e) => {
    e.stopPropagation();
    setActiveMarkerIndex(index);
    setIsDragging(true);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging || activeMarkerIndex === null || !containerRef.current || !videoRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const video = videoRef.current;

    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 360;

    // Use stored render dims or calculate on the fly
    let { offsetX, offsetY, width: renderWidth, height: renderHeight } = videoRenderDims;

    if (!renderWidth || !renderHeight) {
      const containerAspect = containerRect.width / containerRect.height;
      const videoAspect = videoWidth / videoHeight;

      if (containerAspect > videoAspect) {
        renderHeight = containerRect.height;
        renderWidth = containerRect.height * videoAspect;
        offsetX = (containerRect.width - renderWidth) / 2;
        offsetY = 0;
      } else {
        renderWidth = containerRect.width;
        renderHeight = containerRect.width / videoAspect;
        offsetX = 0;
        offsetY = (containerRect.height - renderHeight) / 2;
      }
    }

    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    const x = ((clickX - offsetX) / renderWidth) * videoWidth;
    const y = ((clickY - offsetY) / renderHeight) * videoHeight;

    setCalibrationMarkers(prev => {
      const updated = [...prev];
      updated[activeMarkerIndex] = { ...updated[activeMarkerIndex], x, y };
      return updated;
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setActiveMarkerIndex(null);
  };

  const calculateCalibration = () => {
    if (!calibrationDistance || calibrationMarkers.length < 2) return;

    const distance = parseFloat(calibrationDistance);
    if (isNaN(distance) || distance <= 0) return;

    const dx = calibrationMarkers[1].x - calibrationMarkers[0].x;
    const dy = calibrationMarkers[1].y - calibrationMarkers[0].y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    setPixelsPerYard(pixelDistance / distance);
    setIsCalibrated(true);
  };

  // ============ AI VIDEO PROCESSING ============

  const processVideo = async () => {
    if (!isCalibrated || !videoRef.current || !poseDetectorReady) {
      if (!poseDetectorReady) {
        setVideoError('AI pose detector is still loading. Please wait...');
      }
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    cancelProcessingRef.current = false;
    setProcessingCancelled(false);
    setTrackingQuality(null);
    setFrameConfidences([]);
    setShowQualityWarning(false);

    try {
      // Calculate actual time range for processing
      // If trim is applied, use effective values; otherwise use trim slider values
      const startTime = isTrimApplied ? effectiveStartTime : (trimStart * duration);
      const endTime = isTrimApplied ? (effectiveStartTime + effectiveDuration) : (trimEnd * duration);

      // Process video with AI pose detection
      const frameData = await processVideoWithAI(
        videoRef.current,
        {
          fps,
          profileId: activeProfile,
          enableBiomechanics,
          movementDirection,
          confidenceThreshold,
          athleteRegion: selectedAthleteBox,
          startTime,
          endTime
        },
        (progress) => setProcessingProgress(progress),
        () => cancelProcessingRef.current
      );

      if (cancelProcessingRef.current) {
        setProcessingCancelled(true);
        setIsProcessing(false);
        return;
      }

      // Calculate tracking quality metrics
      const confidences = frameData.map(f => f.confidence || 0);
      setFrameConfidences(confidences);

      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const goodFrames = confidences.filter(c => c >= confidenceThreshold).length;
      const goodFramePercent = (goodFrames / confidences.length) * 100;
      const missingFrames = frameData.filter(f => f.isMissing).length;

      const quality = {
        avgConfidence: avgConfidence * 100,
        goodFramePercent,
        missingFrames,
        totalFrames: frameData.length,
        rating: avgConfidence >= 0.7 ? 'excellent' : avgConfidence >= 0.5 ? 'good' : avgConfidence >= 0.3 ? 'fair' : 'poor'
      };
      setTrackingQuality(quality);

      // Show warning if quality is poor
      if (quality.rating === 'poor' || quality.rating === 'fair') {
        setShowQualityWarning(true);
      }

      // Detect movement direction from tracking data
      const detectedDirection = detectMovementDirection(frameData);
      setMovementDirection(detectedDirection);

      setTrackingData(frameData);

      // Calculate physics
      const weight = getEffectiveWeight();
      const physics = calculatePhysics(
        frameData,
        pixelsPerYard,
        fps,
        timeOverrides,
        weight
      );

      setAnalysisResults(physics);

      // Calculate biomechanics if enabled
      if (enableBiomechanics) {
        const bioData = calculateBiomechanicsTimeSeries(frameData);
        setBiomechanicsResults(bioData);
      }

      setActiveResultTab('summary');
    } catch (error) {
      console.error('Video processing error:', error);
      setVideoError(`Processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelProcessing = () => {
    cancelProcessingRef.current = true;
  };

  // Process manual COM tracking data
  const processManualTracking = () => {
    if (manualCOMPoints.length < 2 || !pixelsPerYard) {
      setVideoError('Need at least 2 manual points and calibration to analyze');
      return;
    }

    // Sort points by frame
    const sortedPoints = [...manualCOMPoints].sort((a, b) => a.frame - b.frame);

    // Interpolate between manual keyframes
    const interpolatedData = [];
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i];
      const end = sortedPoints[i + 1];

      for (let frame = start.frame; frame <= end.frame; frame++) {
        const t = (frame - start.frame) / (end.frame - start.frame);
        interpolatedData.push({
          frame,
          time: frame / fps,
          centerOfMass: {
            x: start.x + t * (end.x - start.x),
            y: start.y + t * (end.y - start.y),
            score: 1.0
          },
          keypoints: null,
          headPosition: null,
          biomechanics: null,
          confidence: 1.0,
          isManuallyAdjusted: sortedPoints.some(p => p.frame === frame)
        });
      }
    }

    setTrackingData(interpolatedData);
    setTrackingQuality({
      avgConfidence: 100,
      goodFramePercent: 100,
      missingFrames: 0,
      totalFrames: interpolatedData.length,
      rating: 'manual'
    });

    // Calculate physics
    const weight = getEffectiveWeight();
    const physics = calculatePhysics(
      interpolatedData,
      pixelsPerYard,
      fps,
      timeOverrides,
      weight
    );

    setAnalysisResults(physics);
    setActiveResultTab('summary');
  };

  // Recalculate physics when time overrides change
  const recalculateWithOverrides = useCallback(() => {
    if (!trackingData || trackingData.length === 0 || !pixelsPerYard) return;

    const weight = getEffectiveWeight();
    const physics = calculatePhysics(
      trackingData,
      pixelsPerYard,
      fps,
      timeOverrides,
      weight
    );

    setAnalysisResults(physics);
  }, [trackingData, pixelsPerYard, fps, timeOverrides, weightOverride, primaryAthlete, manualAthlete.weight]);

  // Update time override
  const updateTimeOverride = (field, value) => {
    const numValue = value === '' ? null : parseFloat(value);

    if (field.startsWith('split-')) {
      const distance = parseInt(field.split('-')[1]);
      setTimeOverrides(prev => ({
        ...prev,
        splits: { ...prev.splits, [distance]: numValue }
      }));
    } else {
      setTimeOverrides(prev => ({ ...prev, [field]: numValue }));
    }
  };

  // Apply time overrides
  useEffect(() => {
    if (analysisResults && trackingData.length > 0) {
      recalculateWithOverrides();
    }
  }, [timeOverrides]);

  // ============ SKELETON OVERLAY DRAWING ============

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw mode indicator
    if (athleteSelectionMode) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText('Click on the athlete to track', canvas.width / 2, 30);
      ctx.textAlign = 'left';
    }

    if (manualTrackingMode) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#fb923c';
      ctx.fillText('Manual Mode: Click to place center-of-mass', 10, 25);
    }

    // Draw athlete selection box
    if (selectedAthleteBox) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(
        selectedAthleteBox.x - selectedAthleteBox.width / 2,
        selectedAthleteBox.y - selectedAthleteBox.height / 2,
        selectedAthleteBox.width,
        selectedAthleteBox.height
      );
      ctx.setLineDash([]);

      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(selectedAthleteBox.x - 10, selectedAthleteBox.y);
      ctx.lineTo(selectedAthleteBox.x + 10, selectedAthleteBox.y);
      ctx.moveTo(selectedAthleteBox.x, selectedAthleteBox.y - 10);
      ctx.lineTo(selectedAthleteBox.x, selectedAthleteBox.y + 10);
      ctx.stroke();
    }

    // Draw manual COM points
    if (manualCOMPoints.length > 0) {
      // Draw path between points
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      manualCOMPoints.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw points
      manualCOMPoints.forEach((point, i) => {
        const isCurrentFrame = point.frame === currentFrame;

        ctx.beginPath();
        ctx.arc(point.x, point.y, isCurrentFrame ? 10 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isCurrentFrame ? '#fbbf24' : '#fb923c';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Frame number label
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`F${point.frame}`, point.x + 12, point.y - 8);
      });

      // Highlight current frame point if exists
      const currentPoint = manualCOMPoints.find(p => p.frame === currentFrame);
      if (currentPoint) {
        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // Draw calibration markers
    if (calibrationMarkers.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      calibrationMarkers.forEach((marker, i) => {
        if (i === 0) ctx.moveTo(marker.x, marker.y);
        else ctx.lineTo(marker.x, marker.y);
      });

      if (calibrationMode === 'grid' && calibrationMarkers.length === 4) {
        ctx.lineTo(calibrationMarkers[0].x, calibrationMarkers[0].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw marker points with labels
      calibrationMarkers.forEach((marker, i) => {
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Label - use larger font that scales with video
        const fontSize = Math.max(24, Math.min(canvas.width, canvas.height) / 20);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(marker.label, marker.x + 18, marker.y - 12);
        ctx.fillText(marker.label, marker.x + 18, marker.y - 12);
      });
    }

    // Draw skeleton overlay if we have tracking data
    const frameData = getCurrentFrameData();
    if (frameData && frameData.keypoints) {
      const profile = TRACKING_PROFILES[activeProfile];
      const connections = SKELETON_CONNECTIONS[activeProfile] || [];

      // Draw skeleton connections
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      connections.forEach(([startIdx, endIdx]) => {
        const start = frameData.keypoints[startIdx];
        const end = frameData.keypoints[endIdx];

        if (start && end && start.score > confidenceThreshold && end.score > confidenceThreshold) {
          ctx.strokeStyle = `rgba(59, 130, 246, ${Math.min(start.score, end.score)})`;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
      });

      // Draw keypoints
      Object.entries(frameData.keypoints).forEach(([idx, kp]) => {
        if (!kp || kp.score < confidenceThreshold) return;

        const keypointIdx = parseInt(idx);
        let color = '#ea580c';

        // Color code by body part
        if ([MOVENET_KEYPOINTS.LEFT_EAR, MOVENET_KEYPOINTS.RIGHT_EAR].includes(keypointIdx)) {
          color = KEYPOINT_COLORS.head;
        } else if ([MOVENET_KEYPOINTS.LEFT_SHOULDER, MOVENET_KEYPOINTS.RIGHT_SHOULDER].includes(keypointIdx)) {
          color = KEYPOINT_COLORS.shoulder;
        } else if ([MOVENET_KEYPOINTS.LEFT_ELBOW, MOVENET_KEYPOINTS.RIGHT_ELBOW].includes(keypointIdx)) {
          color = KEYPOINT_COLORS.elbow;
        } else if ([MOVENET_KEYPOINTS.LEFT_HIP, MOVENET_KEYPOINTS.RIGHT_HIP].includes(keypointIdx)) {
          color = KEYPOINT_COLORS.hip;
        } else if ([MOVENET_KEYPOINTS.LEFT_KNEE, MOVENET_KEYPOINTS.RIGHT_KNEE].includes(keypointIdx)) {
          color = KEYPOINT_COLORS.knee;
        } else if ([MOVENET_KEYPOINTS.LEFT_ANKLE, MOVENET_KEYPOINTS.RIGHT_ANKLE].includes(keypointIdx)) {
          color = KEYPOINT_COLORS.ankle;
        }

        // Draw keypoint
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Highlight if selected
        if (selectedKeypoint === keypointIdx) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Confidence indicator
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 10, 0, Math.PI * 2 * kp.score);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Draw center of mass
      if (frameData.centerOfMass) {
        const com = frameData.centerOfMass;
        ctx.beginPath();
        ctx.arc(com.x, com.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = KEYPOINT_COLORS.centerOfMass;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // COM label
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('COM', com.x + 12, com.y + 4);
      }

      // Draw head position
      if (frameData.headPosition) {
        const head = frameData.headPosition;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = KEYPOINT_COLORS.head;
        ctx.fill();
      }

      // Draw manual keyframe indicator
      if (manualKeyframes.includes(currentFrame)) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('⚡ KEYFRAME', 10, 20);
      }

      // Draw biomechanics angles if enabled
      if (enableBiomechanics && frameData.biomechanics) {
        const bio = frameData.biomechanics;
        let yOffset = 40;

        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#fb923c';

        if (bio.spineAngle !== null) {
          ctx.fillText(`Spine: ${bio.spineAngle.toFixed(1)}°`, 10, yOffset);
          yOffset += 15;
        }
        if (bio.shinAngle !== null) {
          ctx.fillText(`Shin (${bio.leadLeg}): ${bio.shinAngle.toFixed(1)}°`, 10, yOffset);
          yOffset += 15;
        }
        if (bio.footAngle !== null) {
          ctx.fillText(`Foot: ${bio.footAngle.toFixed(1)}°`, 10, yOffset);
        }
      }
    }
  }, [calibrationMarkers, calibrationMode, currentFrame, trackingData, selectedKeypoint, manualKeyframes, enableBiomechanics, activeProfile, athleteSelectionMode, selectedAthleteBox, manualTrackingMode, manualCOMPoints, confidenceThreshold]);

  // Update overlay when frame changes
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, currentFrame]);

  // Also redraw when calibration markers change
  useEffect(() => {
    drawOverlay();
  }, [calibrationMarkers]);

  // Redraw when video render dimensions change
  useEffect(() => {
    if (videoRenderDims.width && videoRenderDims.height) {
      drawOverlay();
    }
  }, [videoRenderDims]);

  // ============ CHARTS ============

  useEffect(() => {
    if (!analysisResults || activeResultTab !== 'speed' || !speedChartRef.current) return;

    if (speedChartInstance.current) {
      speedChartInstance.current.destroy();
    }

    const ctx = speedChartRef.current.getContext('2d');
    speedChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: analysisResults.frames.filter((_, i) => i % 2 === 0).map(f => f.time.toFixed(2)),
        datasets: [{
          label: 'Speed (MPH)',
          data: analysisResults.frames.filter((_, i) => i % 2 === 0).map(f => f.velocityMph),
          borderColor: '#ea580c',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          },
          y: {
            title: { display: true, text: 'Speed (MPH)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' },
            beginAtZero: true
          }
        }
      }
    });
  }, [analysisResults, activeResultTab]);

  useEffect(() => {
    if (!analysisResults || activeResultTab !== 'acceleration' || !accelChartRef.current) return;

    if (accelChartInstance.current) {
      accelChartInstance.current.destroy();
    }

    const ctx = accelChartRef.current.getContext('2d');
    accelChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: analysisResults.frames.filter((_, i) => i % 2 === 0).map(f => f.time.toFixed(2)),
        datasets: [{
          label: 'Acceleration (g)',
          data: analysisResults.frames.filter((_, i) => i % 2 === 0).map(f => f.accelerationG),
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          },
          y: {
            title: { display: true, text: 'Acceleration (g)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          }
        }
      }
    });
  }, [analysisResults, activeResultTab]);

  useEffect(() => {
    if (!analysisResults || activeResultTab !== 'power' || !powerChartRef.current || !getEffectiveWeight()) return;

    if (powerChartInstance.current) {
      powerChartInstance.current.destroy();
    }

    const ctx = powerChartRef.current.getContext('2d');
    powerChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: analysisResults.frames.filter((_, i) => i % 2 === 0).map(f => f.time.toFixed(2)),
        datasets: [{
          label: 'Power (W)',
          data: analysisResults.frames.filter((_, i) => i % 2 === 0).map(f => f.power || 0),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          },
          y: {
            title: { display: true, text: 'Power (Watts)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' },
            beginAtZero: true
          }
        }
      }
    });
  }, [analysisResults, activeResultTab]);

  // Biomechanics charts
  useEffect(() => {
    if (!biomechanicsResults || activeResultTab !== 'biomechanics' || !spineAngleChartRef.current) return;

    if (spineAngleChartInstance.current) {
      spineAngleChartInstance.current.destroy();
    }

    const ctx = spineAngleChartRef.current.getContext('2d');
    spineAngleChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: biomechanicsResults.filter((_, i) => i % 2 === 0).map(f => f.time.toFixed(2)),
        datasets: [{
          label: 'Spine Angle (°)',
          data: biomechanicsResults.filter((_, i) => i % 2 === 0).map(f => f.spineAngle),
          borderColor: '#fb923c',
          backgroundColor: 'rgba(167, 139, 250, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Spine Angle (from vertical)', color: '#fb923c' }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          },
          y: {
            title: { display: true, text: 'Angle (°)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          }
        }
      }
    });
  }, [biomechanicsResults, activeResultTab]);

  useEffect(() => {
    if (!biomechanicsResults || activeResultTab !== 'biomechanics' || !shinAngleChartRef.current) return;

    if (shinAngleChartInstance.current) {
      shinAngleChartInstance.current.destroy();
    }

    const ctx = shinAngleChartRef.current.getContext('2d');
    shinAngleChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: biomechanicsResults.filter((_, i) => i % 2 === 0).map(f => f.time.toFixed(2)),
        datasets: [
          {
            label: 'Shin Angle (°)',
            data: biomechanicsResults.filter((_, i) => i % 2 === 0).map(f => f.shinAngle),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0
          },
          {
            label: 'Foot Angle (°)',
            data: biomechanicsResults.filter((_, i) => i % 2 === 0).map(f => f.footAngle),
            borderColor: '#10b981',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: false,
            tension: 0.4,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#a16207' } },
          title: { display: true, text: 'Lead Leg Angles', color: '#f97316' }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          },
          y: {
            title: { display: true, text: 'Angle (°)', color: '#a16207' },
            ticks: { color: '#a16207' },
            grid: { color: '#78350f' }
          }
        }
      }
    });
  }, [biomechanicsResults, activeResultTab]);

  // ============ SAVE TO ATHLETE ============

  const saveToAthlete = async () => {
    if (!primaryAthlete || !analysisResults) return;

    const drill = DRILL_TEMPLATES[selectedDrill];
    const performanceEntry = {
      date: new Date().toISOString().split('T')[0],
      drill: drill?.name || 'Custom Analysis',
      maxSpeedMph: analysisResults.summary.maxVelocityMph,
      maxAccelerationG: analysisResults.summary.maxAccelerationG,
      maxPower: analysisResults.summary.maxPower,
      splits: analysisResults.summary.splits,
      hasTimeOverrides: analysisResults.hasTimeOverrides
    };

    const updatedAthlete = {
      ...primaryAthlete,
      performanceHistory: [...(primaryAthlete.performanceHistory || []), performanceEntry]
    };

    await dataService.updateAthlete(updatedAthlete);
    setAthletes(prev => prev.map(a => a.id === primaryAthlete.id ? updatedAthlete : a));
  };

  // ============ RENDER ============

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fbbf24', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ForgedGlyph size="1.75rem" color="#fbbf24" /> Video Analysis
        </h1>
      </div>

      {/* Video Source Controls */}
      <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', borderLeft: '4px solid #78350f' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '0.4rem 0.75rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}
          >
            Upload Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <button
            onClick={startRecordingMode}
            style={{ padding: '0.4rem 0.75rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}
          >
            Record
          </button>

          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="Paste video URL..."
            style={{ width: '150px', padding: '0.4rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fbbf24', fontSize: '0.85rem' }}
          />

          {/* AI Status indicator - inline */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {poseDetectorLoading ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>Loading AI...</span>
              </>
            ) : poseDetectorReady ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
                <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>AI Ready</span>
              </>
            ) : (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>AI Error</span>
              </>
            )}
          </div>
        </div>

        {videoError && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }}>
            {videoError}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: videoSource ? '1fr 350px' : '1fr', gap: '1rem' }}>
        {/* Video Panel */}
        {videoSource && (
          <div style={{ background: '#1e293b', borderRadius: '0.5rem', overflow: 'hidden' }}>
            {/* Video Container - resizable */}
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                background: '#000000',
                height: `${videoContainerHeight}px`,
                overflow: 'hidden',
                cursor: getCanvasCursor()
              }}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              <video
                ref={videoRef}
                src={videoSource}
                onLoadedMetadata={handleVideoLoad}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  pointerEvents: 'none'
                }}
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: `${videoRenderDims.offsetY}px`,
                  left: `${videoRenderDims.offsetX}px`,
                  width: videoRenderDims.width ? `${videoRenderDims.width}px` : '100%',
                  height: videoRenderDims.height ? `${videoRenderDims.height}px` : '100%',
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleVideoResizeStart}
              style={{
                height: '8px',
                background: isResizingVideo ? '#ea580c' : '#78350f',
                cursor: 'ns-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#ea580c'}
              onMouseLeave={(e) => !isResizingVideo && (e.currentTarget.style.background = '#78350f')}
            >
              <div style={{ width: '40px', height: '3px', background: '#fbbf24', borderRadius: '2px' }} />
            </div>

            {/* Video Controls */}
            <div style={{ padding: '0.75rem', background: '#0f172a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <button
                  onClick={() => stepFrame(-1)}
                  style={{ padding: '0.3rem 0.6rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  -1
                </button>
                <button
                  onClick={togglePlay}
                  style={{ padding: '0.3rem 0.75rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '500', fontSize: '0.8rem' }}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => stepFrame(1)}
                  style={{ padding: '0.3rem 0.6rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  +1
                </button>

                <div style={{ flex: 1 }}>
                  <input
                    type="range"
                    min={0}
                    max={totalFrames - 1}
                    value={currentFrame}
                    onChange={(e) => seekToFrame(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#ea580c' }}
                  />
                </div>

                <div style={{ fontSize: '0.8rem', color: '#fbbf24', minWidth: '100px', textAlign: 'right' }}>
                  Frame {currentFrame} / {totalFrames}
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#a16207', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <span>Time: {currentTime.toFixed(2)}s</span>
                  <span>Duration: {isTrimApplied ? effectiveDuration.toFixed(2) : duration.toFixed(2)}s</span>
                  <span>FPS: {fps}</span>
                </div>
                {isTrimApplied && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#10b981' }}>Trimmed: {effectiveDuration.toFixed(2)}s ({totalFrames} frames)</span>
                    <button
                      onClick={resetTrim}
                      style={{ padding: '0.2rem 0.5rem', background: '#78350f', border: 'none', borderRadius: '0.25rem', color: '#fbbf24', cursor: 'pointer', fontSize: '0.7rem' }}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Trim Sliders - only show when NOT trimmed */}
              {!isTrimApplied ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Trim Range</span>
                    <span style={{ color: '#fbbf24' }}>
                      {(trimStart * duration).toFixed(2)}s — {(trimEnd * duration).toFixed(2)}s
                    </span>
                  </div>
                  <div
                    ref={trimContainerRef}
                    style={{ position: 'relative', height: '24px', background: '#0f172a', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {/* Inactive regions (trimmed out) */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: `${trimStart * 100}%`,
                      height: '100%',
                      background: 'rgba(120, 53, 15, 0.5)',
                      borderRadius: '4px 0 0 4px'
                    }} />
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: `${(1 - trimEnd) * 100}%`,
                      height: '100%',
                      background: 'rgba(120, 53, 15, 0.5)',
                      borderRadius: '0 4px 4px 0'
                    }} />

                    {/* Active region */}
                    <div style={{
                      position: 'absolute',
                      left: `${trimStart * 100}%`,
                      top: 0,
                      width: `${(trimEnd - trimStart) * 100}%`,
                      height: '100%',
                      background: 'rgba(234, 88, 12, 0.3)',
                      borderTop: '2px solid #ea580c',
                      borderBottom: '2px solid #ea580c'
                    }} />

                    {/* Current position indicator */}
                    <div style={{
                      position: 'absolute',
                      left: `${(currentTime / duration) * 100}%`,
                      top: 0,
                      width: '2px',
                      height: '100%',
                      background: '#fbbf24',
                      transform: 'translateX(-50%)',
                      zIndex: 1
                    }} />

                    {/* Start handle */}
                    <div
                      onMouseDown={(e) => handleTrimDragStart('start', e)}
                      style={{
                        position: 'absolute',
                        left: `${trimStart * 100}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '14px',
                        height: '24px',
                        background: isDraggingTrim === 'start' ? '#fbbf24' : '#ea580c',
                        borderRadius: '3px',
                        cursor: 'ew-resize',
                        border: '2px solid #fbbf24',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ width: '2px', height: '12px', background: '#fbbf24', borderRadius: '1px' }} />
                    </div>

                    {/* End handle */}
                    <div
                      onMouseDown={(e) => handleTrimDragStart('end', e)}
                      style={{
                        position: 'absolute',
                        left: `${trimEnd * 100}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '14px',
                        height: '24px',
                        background: isDraggingTrim === 'end' ? '#fbbf24' : '#ea580c',
                        borderRadius: '3px',
                        cursor: 'ew-resize',
                        border: '2px solid #fbbf24',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ width: '2px', height: '12px', background: '#fbbf24', borderRadius: '1px' }} />
                    </div>
                  </div>

                  {/* Apply Trim button */}
                  {(trimStart > 0 || trimEnd < 1) && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={applyTrim}
                        style={{
                          flex: 1,
                          padding: '0.35rem',
                          background: '#ea580c',
                          border: 'none',
                          borderRadius: '0.25rem',
                          color: '#fef3c7',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}
                      >
                        Apply Trim
                      </button>
                      <button
                        onClick={() => { setTrimStart(0); setTrimEnd(1); }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: '#78350f',
                          border: 'none',
                          borderRadius: '0.25rem',
                          color: '#fbbf24',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Confidence Heatmap Timeline */}
              {frameConfidences.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.25rem' }}>
                    Tracking Confidence by Frame
                  </div>
                  <div style={{
                    display: 'flex',
                    height: '20px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: '#0f172a'
                  }}>
                    {frameConfidences.map((conf, i) => {
                      // Sample every Nth frame to keep it reasonable
                      const sampleRate = Math.max(1, Math.floor(frameConfidences.length / 200));
                      if (i % sampleRate !== 0) return null;

                      const color = conf >= 0.7 ? '#10b981' : conf >= 0.5 ? '#fbbf24' : conf >= 0.3 ? '#f97316' : '#ef4444';
                      const isCurrentFrame = Math.abs(i - currentFrame) < sampleRate;

                      return (
                        <div
                          key={i}
                          onClick={() => seekToFrame(i)}
                          style={{
                            flex: 1,
                            background: color,
                            opacity: conf,
                            cursor: 'pointer',
                            borderLeft: isCurrentFrame ? '2px solid #ffffff' : 'none',
                            borderRight: isCurrentFrame ? '2px solid #ffffff' : 'none'
                          }}
                          title={`Frame ${i}: ${(conf * 100).toFixed(0)}% confidence`}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.6rem', marginTop: '0.25rem', justifyContent: 'flex-end' }}>
                    <span style={{ color: '#10b981' }}>● High</span>
                    <span style={{ color: '#fbbf24' }}>● Med</span>
                    <span style={{ color: '#f97316' }}>● Low</span>
                    <span style={{ color: '#ef4444' }}>● Poor</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Control Panel */}
        {videoSource && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            paddingBottom: '2rem'
          }}>
            {/* Combined Analysis Setup */}
            <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', borderLeft: isCalibrated ? '4px solid #10b981' : '4px solid #fbbf24' }}>

              {/* Tracking Profile */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.25rem', display: 'block' }}>Tracking Profile</label>
                <select
                  value={activeProfile}
                  onChange={(e) => setActiveProfile(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fef3c7', fontSize: '0.8rem' }}
                >
                  {Object.entries(TRACKING_PROFILES).map(([key, profile]) => (
                    <option key={key} value={key}>{profile.name}</option>
                  ))}
                </select>
              </div>

              {/* Event */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.25rem', display: 'block' }}>Event</label>
                <select
                  value={selectedDrill}
                  onChange={(e) => handleDrillSelect(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fef3c7', fontSize: '0.8rem' }}
                >
                  {Object.entries(DRILL_TEMPLATES).map(([key, drill]) => (
                    <option key={key} value={key}>{drill.name}</option>
                  ))}
                </select>
              </div>

              {/* Calibration */}
              <div style={{ marginBottom: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #78350f' }}>
                <label style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.25rem', display: 'block' }}>Calibration</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="number"
                    value={calibrationDistance}
                    onChange={(e) => setCalibrationDistance(e.target.value)}
                    style={{ width: '60px', padding: '0.3rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fef3c7', fontSize: '0.8rem' }}
                    placeholder="10"
                  />
                  <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>yards</span>

                  {!isSettingCalibration && !isCalibrated ? (
                    <button
                      onClick={() => { setIsSettingCalibration(true); setCalibrationMarkers([]); }}
                      style={{ padding: '0.25rem 0.5rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Set Calibration
                    </button>
                  ) : !isCalibrated ? (
                    <button
                      onClick={() => { calculateCalibration(); setIsSettingCalibration(false); }}
                      disabled={calibrationMarkers.length < 2 || !calibrationDistance}
                      style={{ padding: '0.25rem 0.5rem', background: calibrationMarkers.length >= 2 && calibrationDistance ? '#10b981' : '#78350f', border: 'none', borderRadius: '0.25rem', color: '#fef3c7', cursor: calibrationMarkers.length >= 2 && calibrationDistance ? 'pointer' : 'not-allowed', fontSize: '0.75rem' }}
                    >
                      Calibrate
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Calibrated ({pixelsPerYard?.toFixed(0)} px/yd)</span>
                  )}

                  {(isSettingCalibration || isCalibrated) && (
                    <button
                      onClick={() => { setCalibrationMarkers([]); setIsCalibrated(false); setIsSettingCalibration(false); }}
                      style={{ padding: '0.25rem 0.5rem', background: '#78350f', border: 'none', borderRadius: '0.25rem', color: '#fbbf24', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Reset
                    </button>
                  )}
                </div>
                {isSettingCalibration && !isCalibrated && (
                  <div style={{ fontSize: '0.7rem', color: '#fbbf24' }}>
                    Click video to place points ({calibrationMarkers.length}/2)
                  </div>
                )}
              </div>

              {/* Athlete Selection */}
              <div style={{ marginBottom: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #78350f' }}>
                <label style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.25rem', display: 'block' }}>Athlete Selection</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => { setAthleteSelectionMode(true); setSelectedAthleteBox(null); }}
                    style={{ padding: '0.25rem 0.5rem', background: athleteSelectionMode ? '#fbbf24' : '#78350f', border: 'none', borderRadius: '0.25rem', color: athleteSelectionMode ? '#000' : '#fef3c7', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    {athleteSelectionMode ? 'Click athlete...' : selectedAthleteBox ? 'Selected' : 'Select'}
                  </button>
                  {selectedAthleteBox && (
                    <button
                      onClick={() => setSelectedAthleteBox(null)}
                      style={{ padding: '0.25rem 0.5rem', background: '#78350f', border: 'none', borderRadius: '0.25rem', color: '#fbbf24', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Clear
                    </button>
                  )}
                  <span style={{ fontSize: '0.7rem', color: '#a16207' }}>For crowded scenes</span>
                </div>
              </div>

              {/* Confidence Threshold */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #78350f' }}>
                <label style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.25rem', display: 'block' }}>Confidence Threshold</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="range"
                    min="0.1"
                    max="0.7"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    style={{ flex: 1, maxWidth: '150px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>{(confidenceThreshold * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Process Button */}
            <button
              onClick={isProcessing ? cancelProcessing : processVideo}
              disabled={!isCalibrated || !poseDetectorReady || manualTrackingMode}
              style={{
                padding: '0.4rem 0.75rem',
                background: isProcessing ? '#7c2d12' : (isCalibrated && poseDetectorReady && !manualTrackingMode ? '#7c2d12' : '#78350f'),
                border: (isCalibrated && poseDetectorReady && !manualTrackingMode) || isProcessing ? '1px solid #dc2626' : 'none',
                borderRadius: '0.25rem',
                color: '#fef3c7',
                cursor: isCalibrated && poseDetectorReady && !manualTrackingMode ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                fontSize: '0.85rem'
              }}
            >
              {isProcessing ? 'Cancel' : 'Analyze with AI'}
            </button>

            {isProcessing && (
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', borderLeft: '4px solid #ea580c' }}>
                <div style={{ height: '8px', background: '#78350f', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${processingProgress}%`, background: '#ea580c', transition: 'width 0.1s' }} />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginTop: '0.5rem', textAlign: 'center' }}>
                  AI tracking: {processingProgress}% complete
                </div>
              </div>
            )}

            {/* Manual Tracking Fallback */}
            <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', borderLeft: manualTrackingMode ? '4px solid #fb923c' : '4px solid #78350f' }}>
              <h3 style={{ fontSize: '0.85rem', color: '#fb923c', marginBottom: '0.35rem' }}>Manual Tracking</h3>
              <p style={{ fontSize: '0.75rem', color: '#78350f', marginBottom: '0.35rem' }}>
                If AI tracking fails, manually place center-of-mass points
              </p>
              <button
                onClick={() => setManualTrackingMode(!manualTrackingMode)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: manualTrackingMode ? '#fb923c' : '#78350f',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#fef3c7',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {manualTrackingMode ? '✓ Manual Mode Active' : 'Enable Manual Mode'}
              </button>

              {manualTrackingMode && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.35rem' }}>
                    {manualCOMPoints.length} point(s) placed
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={processManualTracking}
                      disabled={manualCOMPoints.length < 2}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        background: manualCOMPoints.length >= 2 ? '#10b981' : '#78350f',
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: '#fef3c7',
                        cursor: manualCOMPoints.length >= 2 ? 'pointer' : 'not-allowed',
                        fontSize: '0.8rem'
                      }}
                    >
                      Calculate
                    </button>
                    <button
                      onClick={() => setManualCOMPoints([])}
                      style={{
                        padding: '0.4rem 0.75rem',
                        background: '#78350f',
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: '#fef3c7',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: '#78350f', marginTop: '0.5rem' }}>
                    Tip: Step through frames, click to place points at start, key frames, and end
                  </p>
                </div>
              )}
            </div>

            {/* Time Overrides */}
            {trackingData.length > 0 && (
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', borderLeft: '4px solid #fbbf24' }}>
                <div
                  onClick={() => setShowTimeOverrides(!showTimeOverrides)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <h3 style={{ fontSize: '0.85rem', color: '#fbbf24' }}>Time Overrides (Field Measured)</h3>
                  <span style={{ color: '#78350f' }}>{showTimeOverrides ? '−' : '+'}</span>
                </div>

                {showTimeOverrides && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#78350f', marginBottom: '0.75rem' }}>
                      Enter field-measured times to override video-calculated values. Physics will rescale accordingly.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#a16207' }}>Start (s)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={timeOverrides.startTime ?? ''}
                          onChange={(e) => updateTimeOverride('startTime', e.target.value)}
                          placeholder="Auto"
                          style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fef3c7', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#a16207' }}>End (s)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={timeOverrides.endTime ?? ''}
                          onChange={(e) => updateTimeOverride('endTime', e.target.value)}
                          placeholder="Auto"
                          style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fef3c7', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#a16207' }}>Split Times</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {[10, 20, 30, 40].map(dist => (
                          <div key={dist}>
                            <label style={{ fontSize: '0.65rem', color: '#78350f' }}>{dist}yd</label>
                            <input
                              type="number"
                              step="0.01"
                              value={timeOverrides.splits[dist] ?? ''}
                              onChange={(e) => updateTimeOverride(`split-${dist}`, e.target.value)}
                              placeholder="Auto"
                              style={{ width: '100%', padding: '0.3rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fef3c7', fontSize: '0.8rem' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={recalculateWithOverrides}
                      style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', background: '#fbbf24', border: 'none', borderRadius: '0.375rem', color: '#000000', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Apply Overrides
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manual Keyframe Adjustment Info */}
            {trackingData.length > 0 && (
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#a16207', marginBottom: '0.35rem' }}>Manual Adjustment</h3>
                <p style={{ fontSize: '0.75rem', color: '#78350f' }}>
                  Click any keypoint on the skeleton to select it, then click on the video to reposition. Frames between manual keyframes will interpolate.
                </p>
                {manualKeyframes.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#fbbf24' }}>
                    {manualKeyframes.length} manual keyframe(s) set
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Section */}
      {analysisResults && (
        <div style={{ marginTop: '0.75rem', marginBottom: '1rem', background: '#1e293b', padding: '0.5rem', borderRadius: '0.25rem', borderLeft: '3px solid #fb923c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#fb923c' }}>Results</h3>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {analysisResults.hasTimeOverrides && (
                <span style={{ fontSize: '0.65rem', background: '#fbbf24', color: '#000', padding: '0.15rem 0.35rem', borderRadius: '0.2rem' }}>
                  Field Times
                </span>
              )}
              {primaryAthlete && (
                <button
                  onClick={saveToAthlete}
                  style={{ padding: '0.25rem 0.5rem', background: '#10b981', border: 'none', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '500', fontSize: '0.7rem' }}
                >
                  Save to {primaryAthlete.firstName}
                </button>
              )}
            </div>
          </div>

          {/* Result Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            {['summary', 'speed', 'acceleration', 'power', ...(enableBiomechanics && biomechanicsResults ? ['biomechanics'] : []), 'data'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveResultTab(tab)}
                style={{
                  padding: '0.25rem 0.5rem',
                  background: activeResultTab === tab ? '#5b21b6' : '#78350f',
                  border: 'none',
                  borderRadius: '0.25rem',
                  color: activeResultTab === tab ? '#c4b5fd' : '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontWeight: activeResultTab === tab ? '600' : '400',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {activeResultTab === 'summary' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem' }}>
              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: '#ea580c' }}>Max Speed</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.maxVelocityMph.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.55rem', color: '#78350f' }}>MPH</div>
              </div>

              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: '#fbbf24' }}>Peak Accel</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.peakAccelerationG.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.55rem', color: '#78350f' }}>g</div>
              </div>

              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: '#dc2626' }}>Max Power</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.maxPower ? analysisResults.summary.maxPower.toFixed(0) : '-'}
                </div>
                <div style={{ fontSize: '0.55rem', color: '#78350f' }}>W</div>
              </div>

              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: '#10b981' }}>Time</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.totalTime.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.55rem', color: '#78350f' }}>sec</div>
              </div>

              {/* Split Times */}
              <div style={{ gridColumn: 'span 2', background: '#0f172a', padding: '0.4rem', borderRadius: '0.25rem' }}>
                <div style={{ fontSize: '0.6rem', color: '#10b981', marginBottom: '0.25rem' }}>Splits</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {[10, 20, 30, 40].map(yard => (
                    <div key={yard} style={{ textAlign: 'center', minWidth: '40px' }}>
                      <div style={{ fontSize: '0.55rem', color: '#78350f' }}>{yard}yd</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fbbf24' }}>
                        {analysisResults.summary.splits[yard] ? `${analysisResults.summary.splits[yard].toFixed(2)}s` : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Speed Chart */}
          {activeResultTab === 'speed' && (
            <div style={{ height: '200px' }}>
              <canvas ref={speedChartRef} />
            </div>
          )}

          {/* Acceleration Chart */}
          {activeResultTab === 'acceleration' && (
            <div style={{ height: '200px' }}>
              <canvas ref={accelChartRef} />
            </div>
          )}

          {/* Power Chart */}
          {activeResultTab === 'power' && (
            <div style={{ height: '200px' }}>
              {getEffectiveWeight() ? (
                <canvas ref={powerChartRef} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#78350f', fontSize: '0.8rem' }}>
                  Select athlete or enter weight for power
                </div>
              )}
            </div>
          )}

          {/* Biomechanics Charts */}
          {activeResultTab === 'biomechanics' && biomechanicsResults && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ height: '180px' }}>
                <canvas ref={spineAngleChartRef} />
              </div>
              <div style={{ height: '180px' }}>
                <canvas ref={shinAngleChartRef} />
              </div>
            </div>
          )}

          {/* Data Table */}
          {activeResultTab === 'data' && (
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '0.3rem', textAlign: 'left', color: '#a16207', borderBottom: '1px solid #78350f' }}>Frame</th>
                    <th style={{ padding: '0.3rem', textAlign: 'right', color: '#a16207', borderBottom: '1px solid #78350f' }}>Time</th>
                    <th style={{ padding: '0.3rem', textAlign: 'right', color: '#a16207', borderBottom: '1px solid #78350f' }}>Pos (yd)</th>
                    <th style={{ padding: '0.3rem', textAlign: 'right', color: '#a16207', borderBottom: '1px solid #78350f' }}>MPH</th>
                    <th style={{ padding: '0.3rem', textAlign: 'right', color: '#a16207', borderBottom: '1px solid #78350f' }}>Accel (g)</th>
                    {getEffectiveWeight() && (
                      <th style={{ padding: '0.3rem', textAlign: 'right', color: '#a16207', borderBottom: '1px solid #78350f' }}>Power</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {analysisResults.frames.filter((_, i) => i % 3 === 0).map((frame) => (
                    <tr key={frame.frame} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '0.25rem', color: '#78350f' }}>{frame.frame}</td>
                      <td style={{ padding: '0.25rem', textAlign: 'right', color: '#fbbf24' }}>{frame.time.toFixed(2)}</td>
                      <td style={{ padding: '0.25rem', textAlign: 'right', color: '#fbbf24' }}>{frame.position.toFixed(1)}</td>
                      <td style={{ padding: '0.25rem', textAlign: 'right', color: '#ea580c' }}>{frame.velocityMph.toFixed(1)}</td>
                      <td style={{ padding: '0.25rem', textAlign: 'right', color: frame.accelerationG > 0 ? '#10b981' : '#ef4444' }}>
                        {frame.accelerationG > 0 ? '+' : ''}{frame.accelerationG.toFixed(2)}
                      </td>
                      {getEffectiveWeight() && (
                        <td style={{ padding: '0.25rem', textAlign: 'right', color: '#dc2626' }}>{frame.power?.toFixed(0) || '-'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recording Mode UI */}
      {isRecordingMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <video
            ref={recordingVideoRef}
            autoPlay
            muted
            playsInline
            style={{ maxWidth: '90vw', maxHeight: '70vh', borderRadius: '0.5rem' }}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {!isRecording ? (
              <button
                onClick={startRecording}
                style={{ padding: '1rem 2rem', background: '#7c2d12', border: 'none', borderRadius: '0.5rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '600', fontSize: '1.1rem' }}
              >
                ● Start Recording
              </button>
            ) : (
              <>
                <div style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '1.5rem' }}>
                  ● {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </div>
                <button
                  onClick={stopRecording}
                  style={{ padding: '1rem 2rem', background: '#78350f', border: 'none', borderRadius: '0.5rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '600' }}
                >
                  Stop
                </button>
              </>
            )}
            <button
              onClick={stopRecordingMode}
              style={{ padding: '1rem 2rem', background: '#1e293b', border: '1px solid #78350f', borderRadius: '0.5rem', color: '#a16207', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recorded Video Review */}
      {recordedVideoUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <h2 style={{ color: '#fef3c7', marginBottom: '1rem' }}>Review Recording</h2>
          <video
            src={recordedVideoUrl}
            controls
            style={{ maxWidth: '90vw', maxHeight: '60vh', borderRadius: '0.5rem' }}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={useRecordedVideo}
              style={{ padding: '0.75rem 1.5rem', background: '#10b981', border: 'none', borderRadius: '0.5rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '600' }}
            >
              ✓ Use for Analysis
            </button>
            <button
              onClick={saveRecordedVideo}
              style={{ padding: '0.75rem 1.5rem', background: '#ea580c', border: 'none', borderRadius: '0.5rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '600' }}
            >
              Download
            </button>
            <button
              onClick={discardRecordedVideo}
              style={{ padding: '0.75rem 1.5rem', background: '#7c2d12', border: 'none', borderRadius: '0.5rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '600' }}
            >
              ✕ Discard
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!videoSource && !isRecordingMode && !recordedVideoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#78350f' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>No Video Loaded</div>
          <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: '400px' }}>
            Record a video, upload a file, or paste a URL to begin analyzing athlete performance with AI-powered motion tracking.
          </div>
        </div>
      )}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default VideoAnalysis;