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
  shoulder: '#3b82f6',  // Blue
  elbow: '#8b5cf6',     // Purple
  hip: '#22c55e',       // Green
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
  const [trimEnd, setTrimEnd] = useState(0);
  const [isDraggingTrim, setIsDraggingTrim] = useState(null);

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

  // Calibration state
  const [selectedDrill, setSelectedDrill] = useState('custom');
  const [calibrationMode, setCalibrationMode] = useState('line');
  const [calibrationMarkers, setCalibrationMarkers] = useState([]);
  const [activeMarkerIndex, setActiveMarkerIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [pixelsPerYard, setPixelsPerYard] = useState(null);

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

  // ============ VIDEO PLAYBACK ============

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setTotalFrames(Math.floor(videoRef.current.duration * fps));

      // Initialize canvas dimensions
      if (canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || 640;
        canvasRef.current.height = videoRef.current.videoHeight || 360;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setCurrentFrame(Math.floor(videoRef.current.currentTime * fps));
    }
  };

  const seekToFrame = (frame) => {
    if (videoRef.current) {
      const time = frame / fps;
      videoRef.current.currentTime = time;
      setCurrentFrame(frame);
    }
  };

  const stepFrame = (delta) => {
    setCurrentFrame(prevFrame => {
      const newFrame = Math.max(0, Math.min(totalFrames - 1, prevFrame + delta));
      if (videoRef.current) {
        videoRef.current.currentTime = newFrame / fps;
      }
      return newFrame;
    });
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
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
  }, []);

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
    if (!isCalibrated && calibrationMarkers.length < 2) return 'crosshair';
    return 'default';
  };

  // ============ CALIBRATION ============

  const handleDrillSelect = (drillKey) => {
    setSelectedDrill(drillKey);
    const drill = DRILL_TEMPLATES[drillKey];
    setCalibrationMode(drill.calibrationType);
    setCalibrationMarkers([]);
    setIsCalibrated(false);

    if (drill.distance) {
      setCalibrationDistance(drill.distance.toString());
    } else {
      setCalibrationDistance('');
    }
  };

  const handleCanvasClick = (e) => {
    if (!containerRef.current || !videoRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const video = videoRef.current;

    // Get actual video dimensions
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 360;

    // Calculate where the video is rendered within the container (accounting for object-fit: contain)
    const containerAspect = rect.width / rect.height;
    const videoAspect = videoWidth / videoHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (containerAspect > videoAspect) {
      // Container is wider - video will have horizontal letterboxing
      renderHeight = rect.height;
      renderWidth = rect.height * videoAspect;
      offsetX = (rect.width - renderWidth) / 2;
      offsetY = 0;
    } else {
      // Container is taller - video will have vertical letterboxing
      renderWidth = rect.width;
      renderHeight = rect.width / videoAspect;
      offsetX = 0;
      offsetY = (rect.height - renderHeight) / 2;
    }

    // Calculate click position relative to the actual video render area
    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    // Check if click is within the video area
    if (clickX < 0 || clickX > renderWidth || clickY < 0 || clickY > renderHeight) {
      return; // Click was in letterbox area
    }

    // Scale to video pixel coordinates
    const x = (clickX / renderWidth) * videoWidth;
    const y = (clickY / renderHeight) * videoHeight;

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

    // Handle calibration marker placement
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
  };

  const handleMarkerMouseDown = (index, e) => {
    e.stopPropagation();
    setActiveMarkerIndex(index);
    setIsDragging(true);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging || activeMarkerIndex === null || !containerRef.current || !videoRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const video = videoRef.current;

    // Get actual video dimensions
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 360;

    // Calculate where the video is rendered within the container
    const containerAspect = rect.width / rect.height;
    const videoAspect = videoWidth / videoHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (containerAspect > videoAspect) {
      renderHeight = rect.height;
      renderWidth = rect.height * videoAspect;
      offsetX = (rect.width - renderWidth) / 2;
      offsetY = 0;
    } else {
      renderWidth = rect.width;
      renderHeight = rect.width / videoAspect;
      offsetX = 0;
      offsetY = (rect.height - renderHeight) / 2;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    const x = (clickX / renderWidth) * videoWidth;
    const y = (clickY / renderHeight) * videoHeight;

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
      // Process video with AI pose detection
      const frameData = await processVideoWithAI(
        videoRef.current,
        {
          fps,
          profileId: activeProfile,
          enableBiomechanics,
          movementDirection,
          confidenceThreshold,
          athleteRegion: selectedAthleteBox // Pass athlete selection if set
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
      ctx.fillStyle = '#a78bfa';
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
      ctx.strokeStyle = '#a78bfa';
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
        ctx.fillStyle = isCurrentFrame ? '#fbbf24' : '#a78bfa';
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
      ctx.strokeStyle = '#22c55e';
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
        ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(marker.label, marker.x + 12, marker.y - 8);
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
        let color = '#3b82f6';

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
        ctx.fillStyle = '#a78bfa';

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
          borderColor: '#3b82f6',
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
            title: { display: true, text: 'Time (s)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            title: { display: true, text: 'Speed (MPH)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' },
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
          borderColor: '#f59e0b',
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
            title: { display: true, text: 'Time (s)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            title: { display: true, text: 'Acceleration (g)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
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
            title: { display: true, text: 'Time (s)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            title: { display: true, text: 'Power (Watts)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' },
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
          borderColor: '#a78bfa',
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
          title: { display: true, text: 'Spine Angle (from vertical)', color: '#a78bfa' }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            title: { display: true, text: 'Angle (°)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
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
            borderColor: '#22c55e',
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
          legend: { display: true, labels: { color: '#9ca3af' } },
          title: { display: true, text: 'Lead Leg Angles', color: '#f97316' }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            title: { display: true, text: 'Angle (°)', color: '#9ca3af' },
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
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
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', maxHeight: '100vh', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fbbf24', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ForgedGlyph size="1.75rem" color="#fbbf24" /> Video Analysis
        </h1>
        <p style={{ color: '#9ca3af' }}>
          AI-powered motion tracking for athletic performance analysis
        </p>

        {/* AI Status indicator */}
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {poseDetectorLoading ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Loading AI pose detector...</span>
            </>
          ) : poseDetectorReady ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>AI Ready (MoveNet)</span>
            </>
          ) : (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>AI Error: {poseDetectorError}</span>
            </>
          )}
        </div>
      </div>

      {/* Video Source Controls */}
      <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '500' }}
          >
            📁 Upload Video
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
            style={{ padding: '0.5rem 1rem', background: '#ef4444', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '500' }}
          >
            🎥 Record
          </button>

          <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Or paste video URL..."
              style={{ flex: 1, padding: '0.5rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#ffffff' }}
            />
            <button
              onClick={handleUrlSubmit}
              style={{ padding: '0.5rem 1rem', background: '#22c55e', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer' }}
            >
              Load
            </button>
          </div>
        </div>

        {videoError && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '0.375rem', color: '#ef4444', fontSize: '0.9rem' }}>
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
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  cursor: getCanvasCursor()
                }}
              />
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleVideoResizeStart}
              style={{
                height: '8px',
                background: isResizingVideo ? '#3b82f6' : '#374151',
                cursor: 'ns-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#3b82f6'}
              onMouseLeave={(e) => !isResizingVideo && (e.currentTarget.style.background = '#374151')}
            >
              <div style={{ width: '40px', height: '3px', background: '#9ca3af', borderRadius: '2px' }} />
            </div>

            {/* Video Controls */}
            <div style={{ padding: '1rem', background: '#0f172a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <button
                  onClick={() => stepFrame(-1)}
                  style={{ padding: '0.4rem 0.8rem', background: '#374151', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer' }}
                >
                  ⏮ -1
                </button>
                <button
                  onClick={togglePlay}
                  style={{ padding: '0.4rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                  onClick={() => stepFrame(1)}
                  style={{ padding: '0.4rem 0.8rem', background: '#374151', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer' }}
                >
                  +1 ⏭
                </button>

                <div style={{ flex: 1 }}>
                  <input
                    type="range"
                    min={0}
                    max={totalFrames - 1}
                    value={currentFrame}
                    onChange={(e) => seekToFrame(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ fontSize: '0.85rem', color: '#9ca3af', minWidth: '120px', textAlign: 'right' }}>
                  Frame {currentFrame} / {totalFrames}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '1rem' }}>
                <span>Time: {currentTime.toFixed(2)}s</span>
                <span>Duration: {duration.toFixed(2)}s</span>
                <span>FPS: {fps}</span>
              </div>

              {/* Confidence Heatmap Timeline */}
              {frameConfidences.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
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

                      const color = conf >= 0.7 ? '#22c55e' : conf >= 0.5 ? '#fbbf24' : conf >= 0.3 ? '#f97316' : '#ef4444';
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem' }}>
                    <span>🟢 High</span>
                    <span>🟡 Medium</span>
                    <span>🟠 Low</span>
                    <span>🔴 Poor</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Control Panel */}
        {videoSource && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {/* Tracking Profile */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>📊 Tracking Profile</h3>
              <select
                value={activeProfile}
                onChange={(e) => setActiveProfile(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#ffffff' }}
              >
                {Object.entries(TRACKING_PROFILES).map(([key, profile]) => (
                  <option key={key} value={key}>{profile.name}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                {TRACKING_PROFILES[activeProfile]?.description}
              </p>
            </div>

            {/* Drill Selection */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>🏃 Drill / Event</h3>
              <select
                value={selectedDrill}
                onChange={(e) => handleDrillSelect(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#ffffff' }}
              >
                {Object.entries(DRILL_TEMPLATES).map(([key, drill]) => (
                  <option key={key} value={key}>{drill.name}</option>
                ))}
              </select>
            </div>

            {/* Calibration */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: isCalibrated ? '4px solid #22c55e' : '4px solid #f59e0b' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>📏 Calibration</h3>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Distance (yards)</label>
                <input
                  type="number"
                  value={calibrationDistance}
                  onChange={(e) => setCalibrationDistance(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#ffffff' }}
                  placeholder="Enter known distance"
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Click on video to place {calibrationMarkers.length} / 2 calibration points
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={calculateCalibration}
                  disabled={calibrationMarkers.length < 2 || !calibrationDistance}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: calibrationMarkers.length >= 2 && calibrationDistance ? '#22c55e' : '#374151',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#ffffff',
                    cursor: calibrationMarkers.length >= 2 && calibrationDistance ? 'pointer' : 'not-allowed',
                    fontWeight: '500'
                  }}
                >
                  {isCalibrated ? '✓ Calibrated' : 'Calibrate'}
                </button>
                <button
                  onClick={() => { setCalibrationMarkers([]); setIsCalibrated(false); }}
                  style={{ padding: '0.5rem', background: '#374151', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer' }}
                >
                  Reset
                </button>
              </div>

              {isCalibrated && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#22c55e' }}>
                  Scale: {pixelsPerYard?.toFixed(2)} px/yard
                </div>
              )}
            </div>

            {/* Biomechanics Toggle */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableBiomechanics}
                  onChange={(e) => setEnableBiomechanics(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ color: '#a78bfa', fontWeight: '500' }}>🦴 Enable Biomechanics</span>
              </label>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', marginLeft: '1.75rem' }}>
                Track spine angle, shin angle, foot angle
              </p>
            </div>

            {/* Athlete Selection Mode (for crowded scenes) */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: selectedAthleteBox ? '4px solid #fbbf24' : '4px solid #374151' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.5rem' }}>👤 Athlete Selection</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                For crowded scenes (game footage), select the athlete to track
              </p>
              <button
                onClick={() => {
                  setAthleteSelectionMode(true);
                  setSelectedAthleteBox(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: athleteSelectionMode ? '#fbbf24' : '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: athleteSelectionMode ? '#000000' : '#ffffff',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {athleteSelectionMode ? '⏳ Click on athlete...' : selectedAthleteBox ? '✓ Athlete Selected' : '🎯 Select Athlete'}
              </button>
              {selectedAthleteBox && (
                <button
                  onClick={() => setSelectedAthleteBox(null)}
                  style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', background: 'transparent', border: '1px solid #374151', borderRadius: '0.375rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Confidence Threshold */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>🎚️ Confidence Threshold</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="range"
                  min="0.1"
                  max="0.7"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '0.85rem', color: '#fbbf24', minWidth: '40px' }}>
                  {(confidenceThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                Lower = more data but noisier. Higher = cleaner but may miss frames.
              </p>
            </div>

            {/* Manual Tracking Fallback */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: manualTrackingMode ? '4px solid #a78bfa' : '4px solid #374151' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#a78bfa', marginBottom: '0.5rem' }}>✏️ Manual Tracking</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                If AI tracking fails, manually place center-of-mass points
              </p>
              <button
                onClick={() => setManualTrackingMode(!manualTrackingMode)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: manualTrackingMode ? '#a78bfa' : '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {manualTrackingMode ? '✓ Manual Mode Active' : 'Enable Manual Mode'}
              </button>

              {manualTrackingMode && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                    {manualCOMPoints.length} point(s) placed
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={processManualTracking}
                      disabled={manualCOMPoints.length < 2}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        background: manualCOMPoints.length >= 2 ? '#22c55e' : '#374151',
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: '#ffffff',
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
                        background: '#374151',
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.5rem' }}>
                    Tip: Step through frames, click to place points at start, key frames, and end
                  </p>
                </div>
              )}
            </div>

            {/* Process Button */}
            <button
              onClick={isProcessing ? cancelProcessing : processVideo}
              disabled={!isCalibrated || !poseDetectorReady || manualTrackingMode}
              style={{
                padding: '1rem',
                background: isProcessing ? '#ef4444' : (isCalibrated && poseDetectorReady && !manualTrackingMode ? '#8b5cf6' : '#374151'),
                border: 'none',
                borderRadius: '0.5rem',
                color: '#ffffff',
                cursor: isCalibrated && poseDetectorReady && !manualTrackingMode ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              {isProcessing ? '⏹ Cancel Processing' : '🤖 Analyze with AI'}
            </button>

            {/* Tracking Quality Indicator */}
            {trackingQuality && (
              <div style={{
                background: '#1e293b',
                padding: '1rem',
                borderRadius: '0.5rem',
                borderLeft: `4px solid ${
                  trackingQuality.rating === 'excellent' ? '#22c55e' :
                  trackingQuality.rating === 'good' ? '#3b82f6' :
                  trackingQuality.rating === 'fair' ? '#f59e0b' :
                  trackingQuality.rating === 'manual' ? '#a78bfa' :
                  '#ef4444'
                }`
              }}>
                <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>📊 Tracking Quality</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: trackingQuality.rating === 'excellent' ? '#22c55e' :
                           trackingQuality.rating === 'good' ? '#3b82f6' :
                           trackingQuality.rating === 'fair' ? '#f59e0b' :
                           trackingQuality.rating === 'manual' ? '#a78bfa' :
                           '#ef4444',
                    textTransform: 'uppercase'
                  }}>
                    {trackingQuality.rating === 'manual' ? '✏️ Manual' : trackingQuality.rating}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    ({trackingQuality.avgConfidence.toFixed(0)}% avg confidence)
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  <div>Good frames: {trackingQuality.goodFramePercent.toFixed(0)}%</div>
                  <div>Missing frames: {trackingQuality.missingFrames} / {trackingQuality.totalFrames}</div>
                </div>
              </div>
            )}

            {/* Quality Warning */}
            {showQualityWarning && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                padding: '0.75rem',
                borderRadius: '0.5rem'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: '600', marginBottom: '0.25rem' }}>
                  ⚠️ Low Tracking Quality Detected
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  AI had difficulty tracking the athlete. This may be due to:
                </div>
                <ul style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, paddingLeft: '1rem' }}>
                  <li>Video recorded from too far away</li>
                  <li>Multiple people in frame (use Athlete Selection)</li>
                  <li>Poor lighting or video quality</li>
                  <li>Athlete partially obscured</li>
                </ul>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setManualTrackingMode(true);
                      setShowQualityWarning(false);
                    }}
                    style={{ padding: '0.4rem 0.75rem', background: '#a78bfa', border: 'none', borderRadius: '0.25rem', color: '#ffffff', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Try Manual Mode
                  </button>
                  <button
                    onClick={() => setShowQualityWarning(false)}
                    style={{ padding: '0.4rem 0.75rem', background: '#374151', border: 'none', borderRadius: '0.25rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {isProcessing && (
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                <div style={{ height: '8px', background: '#374151', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${processingProgress}%`, background: '#8b5cf6', transition: 'width 0.1s' }} />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#a78bfa', marginTop: '0.5rem', textAlign: 'center' }}>
                  AI tracking: {processingProgress}% complete
                </div>
              </div>
            )}

            {/* Time Overrides */}
            {trackingData.length > 0 && (
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #f59e0b' }}>
                <div
                  onClick={() => setShowTimeOverrides(!showTimeOverrides)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <h3 style={{ fontSize: '0.9rem', color: '#f59e0b' }}>⏱️ Time Overrides (Field Measured)</h3>
                  <span style={{ color: '#64748b' }}>{showTimeOverrides ? '▼' : '▶'}</span>
                </div>

                {showTimeOverrides && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                      Enter field-measured times to override video-calculated values. Physics will rescale accordingly.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Start (s)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={timeOverrides.startTime ?? ''}
                          onChange={(e) => updateTimeOverride('startTime', e.target.value)}
                          placeholder="Auto"
                          style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.25rem', color: '#ffffff', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>End (s)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={timeOverrides.endTime ?? ''}
                          onChange={(e) => updateTimeOverride('endTime', e.target.value)}
                          placeholder="Auto"
                          style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.25rem', color: '#ffffff', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Split Times</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {[10, 20, 30, 40].map(dist => (
                          <div key={dist}>
                            <label style={{ fontSize: '0.65rem', color: '#64748b' }}>{dist}yd</label>
                            <input
                              type="number"
                              step="0.01"
                              value={timeOverrides.splits[dist] ?? ''}
                              onChange={(e) => updateTimeOverride(`split-${dist}`, e.target.value)}
                              placeholder="Auto"
                              style={{ width: '100%', padding: '0.3rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.25rem', color: '#ffffff', fontSize: '0.8rem' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={recalculateWithOverrides}
                      style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', background: '#f59e0b', border: 'none', borderRadius: '0.375rem', color: '#000000', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Apply Overrides
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manual Keyframe Adjustment Info */}
            {trackingData.length > 0 && (
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>✏️ Manual Adjustment</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
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
        <div style={{ marginTop: '1rem', background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #a78bfa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#a78bfa' }}>📊 Analysis Results</h3>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {analysisResults.hasTimeOverrides && (
                <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: '#000', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                  Using Field Times
                </span>
              )}
              {primaryAthlete && (
                <button
                  onClick={saveToAthlete}
                  style={{ padding: '0.4rem 0.8rem', background: '#22c55e', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                >
                  💾 Save to {primaryAthlete.firstName}
                </button>
              )}
            </div>
          </div>

          {/* Result Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {['summary', 'speed', 'acceleration', 'power', ...(enableBiomechanics && biomechanicsResults ? ['biomechanics'] : []), 'data'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveResultTab(tab)}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: activeResultTab === tab ? '#5b21b6' : '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: activeResultTab === tab ? '#c4b5fd' : '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginBottom: '0.25rem' }}>Max Speed</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.maxVelocityMph.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>MPH</div>
              </div>

              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '0.25rem' }}>Peak Acceleration</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.peakAccelerationG.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>g-force</div>
              </div>

              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.25rem' }}>Max Power</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.maxPower ? analysisResults.summary.maxPower.toFixed(0) : 'N/A'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Watts</div>
              </div>

              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#22c55e', marginBottom: '0.25rem' }}>Total Time</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {analysisResults.summary.totalTime.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>seconds</div>
              </div>

              {/* Split Times */}
              <div style={{ gridColumn: 'span 2', background: '#0f172a', padding: '1rem', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#22c55e', marginBottom: '0.5rem' }}>Split Times</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[10, 20, 30, 40].map(yard => (
                    <div key={yard} style={{ textAlign: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{yard} yards</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fbbf24' }}>
                        {analysisResults.summary.splits[yard]?.toFixed(2) || '-'}s
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Speed Chart */}
          {activeResultTab === 'speed' && (
            <div style={{ height: '300px' }}>
              <canvas ref={speedChartRef} />
            </div>
          )}

          {/* Acceleration Chart */}
          {activeResultTab === 'acceleration' && (
            <div style={{ height: '300px' }}>
              <canvas ref={accelChartRef} />
            </div>
          )}

          {/* Power Chart */}
          {activeResultTab === 'power' && (
            <div style={{ height: '300px' }}>
              {getEffectiveWeight() ? (
                <canvas ref={powerChartRef} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  Select an athlete or enter weight to calculate power
                </div>
              )}
            </div>
          )}

          {/* Biomechanics Charts */}
          {activeResultTab === 'biomechanics' && biomechanicsResults && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ height: '250px' }}>
                <canvas ref={spineAngleChartRef} />
              </div>
              <div style={{ height: '250px' }}>
                <canvas ref={shinAngleChartRef} />
              </div>
            </div>
          )}

          {/* Data Table */}
          {activeResultTab === 'data' && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#9ca3af', borderBottom: '1px solid #374151' }}>Frame</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid #374151' }}>Time (s)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid #374151' }}>Position (yd)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid #374151' }}>Speed (MPH)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid #374151' }}>Accel (g)</th>
                    {getEffectiveWeight() && (
                      <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid #374151' }}>Power (W)</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {analysisResults.frames.filter((_, i) => i % 3 === 0).map((frame) => (
                    <tr key={frame.frame} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '0.4rem', color: '#64748b' }}>{frame.frame}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: '#fbbf24' }}>{frame.time.toFixed(2)}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: '#fbbf24' }}>{frame.position.toFixed(1)}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: '#3b82f6' }}>{frame.velocityMph.toFixed(1)}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: frame.accelerationG > 0 ? '#22c55e' : '#ef4444' }}>
                        {frame.accelerationG > 0 ? '+' : ''}{frame.accelerationG.toFixed(2)}
                      </td>
                      {getEffectiveWeight() && (
                        <td style={{ padding: '0.4rem', textAlign: 'right', color: '#ef4444' }}>{frame.power?.toFixed(0) || '-'}</td>
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
                style={{ padding: '1rem 2rem', background: '#ef4444', border: 'none', borderRadius: '0.5rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600', fontSize: '1.1rem' }}
              >
                🔴 Start Recording
              </button>
            ) : (
              <>
                <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.5rem' }}>
                  🔴 {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </div>
                <button
                  onClick={stopRecording}
                  style={{ padding: '1rem 2rem', background: '#374151', border: 'none', borderRadius: '0.5rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
                >
                  ⏹ Stop
                </button>
              </>
            )}
            <button
              onClick={stopRecordingMode}
              style={{ padding: '1rem 2rem', background: '#1e293b', border: '1px solid #374151', borderRadius: '0.5rem', color: '#9ca3af', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recorded Video Review */}
      {recordedVideoUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '1rem' }}>Review Recording</h2>
          <video
            src={recordedVideoUrl}
            controls
            style={{ maxWidth: '90vw', maxHeight: '60vh', borderRadius: '0.5rem' }}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={useRecordedVideo}
              style={{ padding: '0.75rem 1.5rem', background: '#22c55e', border: 'none', borderRadius: '0.5rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
            >
              ✓ Use for Analysis
            </button>
            <button
              onClick={saveRecordedVideo}
              style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '0.5rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
            >
              💾 Download
            </button>
            <button
              onClick={discardRecordedVideo}
              style={{ padding: '0.75rem 1.5rem', background: '#ef4444', border: 'none', borderRadius: '0.5rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
            >
              ✕ Discard
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!videoSource && !isRecordingMode && !recordedVideoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#64748b' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📹</div>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Video Loaded</div>
          <div style={{ fontSize: '0.9rem', textAlign: 'center', maxWidth: '400px' }}>
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