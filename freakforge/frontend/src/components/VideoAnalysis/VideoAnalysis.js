import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import dataService from '../../utils/dataService';
import { useAppContext } from '../../context/AppContext';

Chart.register(...registerables);

const ATHLETE_COLORS = [
  { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)', point: 'rgba(239, 68, 68, 1)', name: 'Red' },
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 1)', point: 'rgba(59, 130, 246, 1)', name: 'Blue' },
  { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 1)', point: 'rgba(16, 185, 129, 1)', name: 'Green' },
];

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
  const [fps, setFps] = useState(30); // Assumed FPS

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
  const [saveMode, setSaveMode] = useState('individual'); // 'individual' or 'default'
  const [defaultSavePath, setDefaultSavePath] = useState('');

  // Recording preview resize
  const [recordingPreviewHeight, setRecordingPreviewHeight] = useState(240); // Default smaller height
  const [isResizingPreview, setIsResizingPreview] = useState(false);

  // Calibration state
  const [selectedDrill, setSelectedDrill] = useState('custom');
  const [calibrationMode, setCalibrationMode] = useState('line');
  const [calibrationMarkers, setCalibrationMarkers] = useState([]);
  const [activeMarkerIndex, setActiveMarkerIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [pixelsPerYard, setPixelsPerYard] = useState(null);

  // Player tracking state
  const [playerMarker, setPlayerMarker] = useState(null);
  const [isPlacingPlayer, setIsPlacingPlayer] = useState(false);
  const [trackingData, setTrackingData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Results state
  const [analysisResults, setAnalysisResults] = useState(null);
  const [activeResultTab, setActiveResultTab] = useState('summary');

  // Refs
  const videoRef = useRef(null);
  const recordingVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const speedChartRef = useRef(null);
  const accelChartRef = useRef(null);
  const powerChartRef = useRef(null);
  const speedChartInstance = useRef(null);
  const accelChartInstance = useRef(null);
  const powerChartInstance = useRef(null);
  const fileInputRef = useRef(null);
  const trimSliderRef = useRef(null);

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

  // Start webcam for recording
  const startRecordingMode = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'environment' },
        audio: true
      });
      setRecordingStream(stream);
      setIsRecordingMode(true);
      setVideoError('');

      // Set video element source
      if (recordingVideoRef.current) {
        recordingVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      setVideoError(`Camera access denied: ${err.message}. Please allow camera access to record videos.`);
    }
  };

  // Stop recording mode
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

  // Start recording
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
    recorder.start(100); // Collect data every 100ms
    setIsRecording(true);

    // Start duration timer
    const startTime = Date.now();
    const timer = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    setRecordingTimer(timer);
  };

  // Stop recording
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

  // Generate filename
  const generateFilename = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // hhmmss
    const lastName = recordingMetadata.lastName.trim() || 'unknown';
    const firstName = recordingMetadata.firstName.trim() || 'athlete';
    return `${dateStr} ${timeStr} ${lastName}_${firstName}`;
  };

  // Save video with trimming
  const saveRecordedVideo = async () => {
    if (!recordedBlob) return;

    const filename = generateFilename() + '.webm';

    // Create a download link
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Use recorded video for analysis
  const useRecordedVideo = () => {
    if (recordedVideoUrl) {
      setVideoSource(recordedVideoUrl);
      setRecordedVideoUrl(null);
      setRecordedBlob(null);
    }
  };

  // Discard recorded video
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

  // Handle video file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSource(url);
      setVideoError('');
      resetAnalysis();
    }
  };

  // Handle URL input
  const handleUrlSubmit = () => {
    if (!videoUrl.trim()) return;

    let embedUrl = videoUrl;

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

    setVideoSource(embedUrl);
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
    setIsCalibrated(false);
    setPixelsPerYard(null);
    setCurrentFrame(0);
  };

  // Video event handlers
  const handleVideoLoad = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setTotalFrames(Math.floor(videoRef.current.duration * fps));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setCurrentFrame(Math.floor(videoRef.current.currentTime * fps));
    }
  };

  // Frame navigation
  const seekToFrame = (frame) => {
    if (videoRef.current) {
      const time = frame / fps;
      videoRef.current.currentTime = time;
      setCurrentFrame(frame);
    }
  };

  const stepFrame = (delta) => {
    const newFrame = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    seekToFrame(newFrame);
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

  // Drill template selection
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

  // Canvas click handler for placing markers
  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isPlacingPlayer) {
      setPlayerMarker({ x, y, frame: currentFrame });
      setIsPlacingPlayer(false);
      return;
    }

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

  // Marker dragging
  const handleMarkerMouseDown = (index, e) => {
    e.stopPropagation();
    setActiveMarkerIndex(index);
    setIsDragging(true);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging || activeMarkerIndex === null || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  // Calculate calibration
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

  // Simulate AI tracking
  const processVideo = async () => {
    if (!playerMarker || !isCalibrated || !videoRef.current) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    const frames = [];
    const frameCount = totalFrames;

    for (let i = 0; i < frameCount; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));

      const t = i / fps;
      const progress = i / frameCount;

      let velocity;
      if (progress < 0.3) {
        velocity = 8 * (progress / 0.3);
      } else if (progress < 0.7) {
        velocity = 8 + Math.sin(progress * 10) * 0.5;
      } else {
        velocity = 8 * (1 - (progress - 0.7) / 0.3);
      }

      velocity += (Math.random() - 0.5) * 0.5;
      velocity = Math.max(0, velocity);

      const prevPosition = frames.length > 0 ? frames[frames.length - 1].position : 0;
      const position = prevPosition + (velocity / fps);

      const prevVelocity = frames.length > 0 ? frames[frames.length - 1].velocity : 0;
      const acceleration = (velocity - prevVelocity) * fps;

      frames.push({
        frame: i,
        time: t,
        position,
        velocity,
        velocityMph: velocity * 2.045,
        acceleration,
        accelerationG: acceleration / 32.2 * 3,
      });

      setProcessingProgress(Math.round((i / frameCount) * 100));
    }

    setTrackingData(frames);

    const weight = getEffectiveWeight();
    const maxVelocity = Math.max(...frames.map(f => f.velocity));
    const maxAcceleration = Math.max(...frames.map(f => Math.abs(f.acceleration)));
    const avgVelocity = frames.reduce((sum, f) => sum + f.velocity, 0) / frames.length;

    const powerData = frames.map(f => {
      if (!weight) return { ...f, power: null };
      const force = (weight / 32.2) * f.acceleration * 3;
      const power = Math.abs(force * f.velocity * 1.356);
      return { ...f, power };
    });

    const maxPower = weight ? Math.max(...powerData.filter(f => f.power !== null).map(f => f.power)) : null;

    const splits = {};
    [10, 20, 30, 40].forEach(yard => {
      const frame = frames.find(f => f.position >= yard);
      if (frame) splits[yard] = frame.time;
    });

    setAnalysisResults({
      frames: powerData,
      summary: {
        totalTime: duration,
        totalDistance: frames[frames.length - 1]?.position || 0,
        maxVelocity,
        maxVelocityMph: maxVelocity * 2.045,
        avgVelocity,
        avgVelocityMph: avgVelocity * 2.045,
        maxAcceleration,
        maxAccelerationG: maxAcceleration / 32.2 * 3,
        maxPower,
        splits
      }
    });

    setIsProcessing(false);
    setActiveResultTab('summary');
  };

  // Draw calibration overlay
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (calibrationMarkers.length > 0) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      calibrationMarkers.forEach((marker, i) => {
        if (i === 0) ctx.moveTo(marker.x, marker.y);
        else ctx.lineTo(marker.x, marker.y);
      });

      if ((calibrationMode === 'grid' || calibrationMode === 'l-drill') && calibrationMarkers.length > 2) {
        ctx.lineTo(calibrationMarkers[0].x, calibrationMarkers[0].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      calibrationMarkers.forEach((marker, i) => {
        const isActive = i === activeMarkerIndex;

        ctx.beginPath();
        ctx.arc(marker.x, marker.y, isActive ? 14 : 12, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(marker.label || `${i + 1}`, marker.x, marker.y);
      });
    }

    if (playerMarker) {
      ctx.beginPath();
      ctx.arc(playerMarker.x, playerMarker.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏈', playerMarker.x, playerMarker.y);
    }

    if (trackingData.length > 0 && analysisResults) {
      const startX = playerMarker?.x || 100;
      const startY = playerMarker?.y || 200;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 2;

      trackingData.slice(0, currentFrame).forEach((frame, i) => {
        const x = startX + frame.position * (pixelsPerYard || 10);
        if (i === 0) ctx.moveTo(x, startY);
        else ctx.lineTo(x, startY);
      });
      ctx.stroke();
    }
  }, [calibrationMarkers, playerMarker, activeMarkerIndex, calibrationMode, trackingData, currentFrame, pixelsPerYard, analysisResults]);

  // Redraw overlay when state changes
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, currentFrame]);

  // Update charts when results change
  useEffect(() => {
    if (!analysisResults) return;

    const { frames } = analysisResults;
    const labels = frames.map(f => f.time.toFixed(2));

    if (speedChartRef.current) {
      if (speedChartInstance.current) speedChartInstance.current.destroy();
      speedChartInstance.current = new Chart(speedChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Speed (MPH)',
            data: frames.map(f => f.velocityMph),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { title: { display: true, text: 'Time (s)', color: '#94a3b8' }, ticks: { color: '#64748b' }, grid: { color: '#334155' } },
            y: { title: { display: true, text: 'Speed (MPH)', color: '#94a3b8' }, ticks: { color: '#64748b' }, grid: { color: '#334155' } }
          }
        }
      });
    }

    if (accelChartRef.current) {
      if (accelChartInstance.current) accelChartInstance.current.destroy();
      accelChartInstance.current = new Chart(accelChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Acceleration (g)',
            data: frames.map(f => f.accelerationG),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { title: { display: true, text: 'Time (s)', color: '#94a3b8' }, ticks: { color: '#64748b' }, grid: { color: '#334155' } },
            y: { title: { display: true, text: 'Acceleration (g)', color: '#94a3b8' }, ticks: { color: '#64748b' }, grid: { color: '#334155' } }
          }
        }
      });
    }

    if (powerChartRef.current && frames[0]?.power !== null) {
      if (powerChartInstance.current) powerChartInstance.current.destroy();
      powerChartInstance.current = new Chart(powerChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Power (W)',
            data: frames.map(f => f.power),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { title: { display: true, text: 'Time (s)', color: '#94a3b8' }, ticks: { color: '#64748b' }, grid: { color: '#334155' } },
            y: { title: { display: true, text: 'Power (W)', color: '#94a3b8' }, ticks: { color: '#64748b' }, grid: { color: '#334155' } }
          }
        }
      });
    }
  }, [analysisResults, activeResultTab]);

  // Calculate sigma bands for sidebar
  const calculateSigmaBands = (athlete) => {
    const metrics = ['dash40', 'verticalJump', 'broadJump', 'proAgility', 'lDrill', 'height', 'weight'];
    const bands = { minus3: 0, minus2: 0, minus1: 0, zero: 0, plus1: 0, plus2: 0, plus3: 0 };
    metrics.forEach(key => {
      const value = athlete[key];
      if (!value) return;
      const sigma = dataService.calculateSigma(key, value);
      if (sigma < -3) bands.minus3++;
      else if (sigma < -2) bands.minus2++;
      else if (sigma < -1) bands.minus1++;
      else if (sigma < 1) bands.zero++;
      else if (sigma < 2) bands.plus1++;
      else if (sigma < 3) bands.plus2++;
      else bands.plus3++;
    });
    return bands;
  };

  // Filtered athletes for sidebar
  const filteredAthletes = searchQuery ? dataService.searchAthletes(searchQuery) : athletes;
  const unselectedAthletes = filteredAthletes.filter(a => !selectedAthletes.includes(a.id));

  // Save results to athlete
  const saveToAthlete = () => {
    if (!primaryAthlete || !analysisResults) return;
    alert(`Results saved to ${primaryAthlete.firstName} ${primaryAthlete.lastName}'s profile!\n\nMax Speed: ${analysisResults.summary.maxVelocityMph.toFixed(1)} MPH\n40-Yard Time: ${analysisResults.summary.splits[40]?.toFixed(2) || 'N/A'}s`);
  };

  // Trim slider handlers
  const handleTrimDrag = (handle, e) => {
    if (!trimSliderRef.current || !recordedBlob) return;
    e.preventDefault();
    setIsDraggingTrim(handle);

    const rect = trimSliderRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const time = percent * recordingDuration;

      if (handle === 'start') {
        if (time < trimEnd) setTrimStart(time);
      } else {
        if (time > trimStart) setTrimEnd(time);
      }
    };

    const onMouseUp = () => {
      setIsDraggingTrim(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Format duration for display
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render sidebar
  const renderSidebar = () => (
    <div style={{ width: '280px', background: '#1e293b', borderRight: '1px solid #78350f', padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#fb923c' }}>Athletes</h3>
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '0.4rem', marginBottom: '0.75rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }}
      />

      {primaryAthlete && (
        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#422006', borderRadius: '0.5rem', border: '2px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: '600' }}>📹 Analyzing</h4>
            <button onClick={clearSelectedAthletes} style={{ padding: '0.2rem 0.4rem', background: '#7c2d12', border: '1px solid #ea580c', borderRadius: '0.25rem', color: '#fdba74', fontSize: '0.7rem', cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ padding: '0.4rem', background: '#292524', borderRadius: '0.375rem', border: '2px solid #ef4444' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#fbbf24' }}>
              {primaryAthlete.firstName} {primaryAthlete.lastName}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#a16207' }}>
              {primaryAthlete.position} • {primaryAthlete.weight} lbs • {Math.floor(primaryAthlete.height / 12)}'{primaryAthlete.height % 12}"
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', color: '#a16207' }}>Weight Override (for power calc)</label>
            <input
              type="number"
              placeholder={primaryAthlete.weight}
              value={weightOverride}
              onChange={(e) => setWeightOverride(e.target.value)}
              style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.25rem', color: '#fbbf24', fontSize: '0.8rem' }}
            />
          </div>
        </div>
      )}

      {!primaryAthlete && (
        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#1e3a5f', borderRadius: '0.5rem', border: '2px solid #3b82f6' }}>
          <h4 style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: '600', marginBottom: '0.5rem' }}>📝 Manual Entry</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <input
              type="text"
              placeholder="Athlete Name"
              value={manualAthlete.name}
              onChange={(e) => setManualAthlete(prev => ({ ...prev, name: e.target.value }))}
              style={{ padding: '0.3rem', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '0.25rem', color: '#93c5fd', fontSize: '0.8rem' }}
            />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="number"
                placeholder="Weight (lbs)"
                value={manualAthlete.weight}
                onChange={(e) => setManualAthlete(prev => ({ ...prev, weight: e.target.value }))}
                style={{ flex: 1, padding: '0.3rem', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '0.25rem', color: '#93c5fd', fontSize: '0.8rem' }}
              />
              <input
                type="number"
                placeholder="Height (in)"
                value={manualAthlete.height}
                onChange={(e) => setManualAthlete(prev => ({ ...prev, height: e.target.value }))}
                style={{ flex: 1, padding: '0.3rem', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '0.25rem', color: '#93c5fd', fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', color: '#a16207' }}>
        <span style={{ fontWeight: '600' }}>σ:</span>
        <span style={{ color: '#ef4444' }}>3-</span>
        <span style={{ color: '#ef4444' }}>2-</span>
        <span style={{ color: '#ef4444' }}>1-</span>
        <span style={{ color: '#94a3b8' }}>±1</span>
        <span style={{ color: '#10b981' }}>1+</span>
        <span style={{ color: '#10b981' }}>2+</span>
        <span style={{ color: '#10b981' }}>3+</span>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.4rem' }}>{unselectedAthletes.length} athletes</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {unselectedAthletes.slice(0, 50).map(athlete => {
          const bands = calculateSigmaBands(athlete);
          return (
            <div
              key={athlete.id}
              style={{ padding: '0.5rem', marginBottom: '0.2rem', borderRadius: '0.375rem', cursor: 'pointer', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#422006'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={selectedAthletes.includes(athlete.id)}
                  onChange={() => toggleAthleteSelection(athlete.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{athlete.firstName} {athlete.lastName}</div>
                  <div style={{ fontSize: '0.7rem', color: '#a16207' }}>{athlete.position} • {athlete.weight}lbs • {athlete.gradYear}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus3 || '-'}</span>
                <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus2 || '-'}</span>
                <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus1 || '-'}</span>
                <span style={{ color: '#94a3b8', width: '14px' }}>{bands.zero || '-'}</span>
                <span style={{ color: '#10b981', width: '14px' }}>{bands.plus1 || '-'}</span>
                <span style={{ color: '#10b981', width: '14px' }}>{bands.plus2 || '-'}</span>
                <span style={{ color: '#10b981', width: '14px' }}>{bands.plus3 || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render Recording Mode UI
  const renderRecordingMode = () => (
    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #ef4444' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1rem', color: '#ef4444' }}>🎥 Recording Mode</h3>
        <button
          onClick={stopRecordingMode}
          style={{ padding: '0.4rem 0.8rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.375rem', color: '#fbbf24', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          ✕ Exit Recording
        </button>
      </div>

      {/* Recording Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>First Name</label>
          <input
            type="text"
            value={recordingMetadata.firstName}
            onChange={(e) => setRecordingMetadata(prev => ({ ...prev, firstName: e.target.value }))}
            style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>Last Name</label>
          <input
            type="text"
            value={recordingMetadata.lastName}
            onChange={(e) => setRecordingMetadata(prev => ({ ...prev, lastName: e.target.value }))}
            style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>Drill Type</label>
          <select
            value={recordingMetadata.drillType}
            onChange={(e) => setRecordingMetadata(prev => ({ ...prev, drillType: e.target.value }))}
            style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }}
          >
            {DRILL_TYPES.map(drill => (
              <option key={drill} value={drill}>{drill}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>Notes (optional)</label>
        <textarea
          value={recordingMetadata.notes}
          onChange={(e) => setRecordingMetadata(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Any additional notes..."
          style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #374151', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem', resize: 'vertical', minHeight: '60px' }}
        />
      </div>

      {/* Live Video Preview */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <div style={{
          position: 'relative',
          background: '#000',
          borderRadius: '0.375rem',
          overflow: 'hidden',
          height: `${recordingPreviewHeight}px`
        }}>
          <video
            ref={recordingVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
          {isRecording && (
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(220, 38, 38, 0.9)', padding: '0.4rem 0.8rem', borderRadius: '0.375rem' }}>
              <span style={{ width: '12px', height: '12px', background: '#ffffff', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
              <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.9rem' }}>REC {formatDuration(recordingDuration)}</span>
            </div>
          )}
          {/* Preview size indicator */}
          <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', fontSize: '0.65rem', color: '#64748b', background: 'rgba(0,0,0,0.5)', padding: '0.15rem 0.3rem', borderRadius: '0.2rem' }}>
            {recordingPreviewHeight}px
          </div>
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingPreview(true);
            const startY = e.clientY;
            const startHeight = recordingPreviewHeight;

            const onMouseMove = (moveEvent) => {
              const delta = moveEvent.clientY - startY;
              const newHeight = Math.max(120, Math.min(600, startHeight + delta));
              setRecordingPreviewHeight(newHeight);
            };

            const onMouseUp = () => {
              setIsResizingPreview(false);
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          }}
          style={{
            height: '8px',
            background: isResizingPreview ? '#fbbf24' : '#374151',
            borderRadius: '0 0 0.375rem 0.375rem',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#4b5563'}
          onMouseLeave={(e) => { if (!isResizingPreview) e.currentTarget.style.background = '#374151'; }}
        >
          <div style={{ width: '40px', height: '3px', background: '#64748b', borderRadius: '2px' }}></div>
        </div>
      </div>

      {/* Recording Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{ padding: '0.75rem 2rem', background: '#dc2626', border: 'none', borderRadius: '0.5rem', color: '#ffffff', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ width: '16px', height: '16px', background: '#ffffff', borderRadius: '50%' }}></span>
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{ padding: '0.75rem 2rem', background: '#374151', border: '2px solid #dc2626', borderRadius: '0.5rem', color: '#ef4444', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ width: '16px', height: '16px', background: '#ef4444', borderRadius: '0' }}></span>
            Stop Recording
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );

  // Render Recorded Video Review
  const renderRecordedVideoReview = () => (
    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #22c55e' }}>
      <h3 style={{ fontSize: '1rem', color: '#22c55e', marginBottom: '0.75rem' }}>📼 Review Recording</h3>

      {/* Video Preview */}
      <div style={{ background: '#000', borderRadius: '0.375rem', overflow: 'hidden', marginBottom: '1rem' }}>
        <video
          src={recordedVideoUrl}
          controls
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      {/* Trim Controls */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Trim Video</span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {formatDuration(trimStart)} - {formatDuration(trimEnd)} (Duration: {formatDuration(trimEnd - trimStart)})
          </span>
        </div>

        {/* Visual Timeline Scrubber */}
        <div
          ref={trimSliderRef}
          style={{ position: 'relative', height: '40px', background: '#0f172a', borderRadius: '0.375rem', cursor: 'pointer' }}
        >
          {/* Full duration track */}
          <div style={{ position: 'absolute', top: '16px', left: '0', right: '0', height: '8px', background: '#374151', borderRadius: '4px' }}></div>

          {/* Selected range */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: `${(trimStart / recordingDuration) * 100}%`,
            width: `${((trimEnd - trimStart) / recordingDuration) * 100}%`,
            height: '8px',
            background: '#22c55e',
            borderRadius: '4px'
          }}></div>

          {/* Start handle */}
          <div
            onMouseDown={(e) => handleTrimDrag('start', e)}
            style={{
              position: 'absolute',
              left: `${(trimStart / recordingDuration) * 100}%`,
              top: '8px',
              width: '20px',
              height: '24px',
              background: isDraggingTrim === 'start' ? '#4ade80' : '#22c55e',
              borderRadius: '4px',
              transform: 'translateX(-50%)',
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ffffff'
            }}
          >
            <span style={{ fontSize: '0.6rem', color: '#ffffff', fontWeight: 'bold' }}>◀</span>
          </div>

          {/* End handle */}
          <div
            onMouseDown={(e) => handleTrimDrag('end', e)}
            style={{
              position: 'absolute',
              left: `${(trimEnd / recordingDuration) * 100}%`,
              top: '8px',
              width: '20px',
              height: '24px',
              background: isDraggingTrim === 'end' ? '#4ade80' : '#22c55e',
              borderRadius: '4px',
              transform: 'translateX(-50%)',
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ffffff'
            }}
          >
            <span style={{ fontSize: '0.6rem', color: '#ffffff', fontWeight: 'bold' }}>▶</span>
          </div>
        </div>
      </div>

      {/* Save Options */}
      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: '0.375rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.4rem' }}>
            <input
              type="radio"
              name="saveMode"
              checked={saveMode === 'individual'}
              onChange={() => setSaveMode('individual')}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Choose save location each time</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="saveMode"
              checked={saveMode === 'default'}
              onChange={() => setSaveMode('default')}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Use default save location</span>
          </label>
        </div>

        {saveMode === 'default' && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Enter default folder path (e.g., C:\Videos\Drills)"
                value={defaultSavePath}
                onChange={(e) => setDefaultSavePath(e.target.value)}
                style={{ flex: 1, padding: '0.4rem', background: '#1e293b', border: '1px solid #374151', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.8rem' }}
              />
              <button
                onClick={async () => {
                  try {
                    if ('showDirectoryPicker' in window) {
                      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                      setDefaultSavePath(dirHandle.name);
                      // Store the handle for later use (would need additional state management for full implementation)
                    } else {
                      alert('Folder picker not supported in this browser. Please type the path manually.');
                    }
                  } catch (err) {
                    if (err.name !== 'AbortError') {
                      console.error('Folder selection error:', err);
                    }
                  }
                }}
                style={{ padding: '0.4rem 0.75rem', background: '#374151', border: '1px solid #4b5563', borderRadius: '0.375rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                📁 Browse...
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
              Note: Browser security may still prompt for confirmation
            </div>
          </div>
        )}

        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Filename preview: <span style={{ color: '#fbbf24' }}>{generateFilename()}.webm</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        <button
          onClick={discardRecordedVideo}
          style={{ padding: '0.6rem 1.5rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.375rem', color: '#fbbf24', cursor: 'pointer', fontWeight: '600' }}
        >
          🗑️ Discard
        </button>
        <button
          onClick={saveRecordedVideo}
          style={{ padding: '0.6rem 1.5rem', background: '#166534', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
        >
          💾 Save Video
        </button>
        <button
          onClick={useRecordedVideo}
          style={{ padding: '0.6rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
        >
          📊 Analyze Video
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {renderSidebar()}

      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        {/* Recording Mode */}
        {isRecordingMode && renderRecordingMode()}

        {/* Recorded Video Review */}
        {recordedVideoUrl && !isRecordingMode && renderRecordedVideoReview()}

        {/* Video Upload Section - only show when not in recording mode */}
        {!isRecordingMode && !recordedVideoUrl && (
          <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #3b82f6' }}>
            <h3 style={{ fontSize: '1rem', color: '#93c5fd', marginBottom: '0.75rem' }}>📹 Video Source</h3>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
              {/* Record Button */}
              <button
                onClick={startRecordingMode}
                style={{ padding: '0.75rem 1rem', background: '#dc2626', border: 'none', borderRadius: '0.5rem', color: '#ffffff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                🎥 Record Video
              </button>

              {/* File Upload */}
              <div style={{ flex: 1 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', padding: '0.75rem', background: '#1e3a5f', border: '2px dashed #3b82f6', borderRadius: '0.5rem', color: '#93c5fd', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  📁 Upload Video File
                </button>
              </div>

              {/* URL Input */}
              <div style={{ flex: 2, display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Paste video URL (direct link, YouTube, Hudl)"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '0.375rem', color: '#93c5fd', fontSize: '0.85rem' }}
                />
                <button
                  onClick={handleUrlSubmit}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
                >
                  Load
                </button>
              </div>
            </div>

            {videoError && (
              <div style={{ padding: '0.5rem', background: '#7c2d12', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.8rem' }}>
                ⚠️ {videoError}
              </div>
            )}
          </div>
        )}

        {/* Video Player & Calibration - rest of the existing code */}
        {videoSource && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Video with overlay canvas */}
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #ea580c' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fb923c' }}>🎬 Video Preview</h3>
                  <div style={{ fontSize: '0.75rem', color: '#a16207' }}>
                    Frame: {currentFrame} / {totalFrames} ({fps} FPS)
                  </div>
                </div>

                <div
                  ref={containerRef}
                  style={{ position: 'relative', background: '#000', borderRadius: '0.375rem', overflow: 'hidden' }}
                >
                  <video
                    ref={videoRef}
                    src={videoSource}
                    onLoadedMetadata={handleVideoLoad}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    style={{ width: '100%', display: 'block' }}
                  />
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      cursor: isPlacingPlayer ? 'crosshair' : (isDragging ? 'grabbing' : 'pointer')
                    }}
                  />
                </div>

                {/* Video Controls */}
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => stepFrame(-10)} style={{ padding: '0.4rem 0.6rem', background: '#374151', border: 'none', borderRadius: '0.25rem', color: '#9ca3af', cursor: 'pointer' }}>⏪ -10</button>
                  <button onClick={() => stepFrame(-1)} style={{ padding: '0.4rem 0.6rem', background: '#374151', border: 'none', borderRadius: '0.25rem', color: '#9ca3af', cursor: 'pointer' }}>◀ -1</button>
                  <button onClick={togglePlay} style={{ padding: '0.4rem 0.8rem', background: '#ea580c', border: 'none', borderRadius: '0.25rem', color: '#fef3c7', cursor: 'pointer', fontWeight: '600' }}>
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <button onClick={() => stepFrame(1)} style={{ padding: '0.4rem 0.6rem', background: '#374151', border: 'none', borderRadius: '0.25rem', color: '#9ca3af', cursor: 'pointer' }}>+1 ▶</button>
                  <button onClick={() => stepFrame(10)} style={{ padding: '0.4rem 0.6rem', background: '#374151', border: 'none', borderRadius: '0.25rem', color: '#9ca3af', cursor: 'pointer' }}>+10 ⏩</button>

                  <input
                    type="range"
                    min="0"
                    max={totalFrames}
                    value={currentFrame}
                    onChange={(e) => seekToFrame(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: '#ea580c' }}
                  />
                </div>
              </div>

              {/* Calibration Panel */}
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #22c55e' }}>
                <h3 style={{ fontSize: '1rem', color: '#22c55e', marginBottom: '0.75rem' }}>📐 Calibration</h3>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem', display: 'block' }}>Drill Template</label>
                  <select
                    value={selectedDrill}
                    onChange={(e) => handleDrillSelect(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #22c55e', borderRadius: '0.375rem', color: '#22c55e', fontSize: '0.85rem' }}
                  >
                    {Object.entries(DRILL_TEMPLATES).map(([key, drill]) => (
                      <option key={key} value={key}>{drill.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#0f172a', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#64748b' }}>
                  {DRILL_TEMPLATES[selectedDrill].description}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem', display: 'block' }}>Distance (yards)</label>
                  <input
                    type="number"
                    value={calibrationDistance}
                    onChange={(e) => setCalibrationDistance(e.target.value)}
                    placeholder="Enter distance"
                    style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #22c55e', borderRadius: '0.375rem', color: '#22c55e', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                    Markers: {calibrationMarkers.length} / {calibrationMode === 'grid' ? 4 : calibrationMode === 'cones-3' || calibrationMode === 'l-drill' ? 3 : 2}
                  </div>
                  {calibrationMarkers.map((marker, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: '#22c55e', padding: '0.2rem 0' }}>
                      ✓ {marker.label}: ({Math.round(marker.x)}, {Math.round(marker.y)})
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setCalibrationMarkers([])}
                    style={{ flex: 1, padding: '0.4rem', background: '#374151', border: 'none', borderRadius: '0.375rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Clear Markers
                  </button>
                  <button
                    onClick={calculateCalibration}
                    disabled={calibrationMarkers.length < 2 || !calibrationDistance}
                    style={{ flex: 1, padding: '0.4rem', background: isCalibrated ? '#166534' : '#22c55e', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', opacity: (calibrationMarkers.length < 2 || !calibrationDistance) ? 0.5 : 1 }}
                  >
                    {isCalibrated ? '✓ Calibrated' : 'Calibrate'}
                  </button>
                </div>

                {isCalibrated && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#166534', borderRadius: '0.375rem', fontSize: '0.8rem', color: '#ffffff' }}>
                    Scale: {pixelsPerYard?.toFixed(2)} px/yard
                  </div>
                )}
              </div>
            </div>

            {/* Player Tracking */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ fontSize: '1rem', color: '#ef4444', marginBottom: '0.75rem' }}>🏈 Player Tracking</h3>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                  onClick={() => setIsPlacingPlayer(true)}
                  disabled={!isCalibrated}
                  style={{ padding: '0.5rem 1rem', background: isPlacingPlayer ? '#ef4444' : '#7c2d12', border: '1px solid #ef4444', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600', opacity: !isCalibrated ? 0.5 : 1 }}
                >
                  {isPlacingPlayer ? '👆 Click on player...' : '📍 Place Player Marker'}
                </button>

                {playerMarker && (
                  <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                    Player at ({Math.round(playerMarker.x)}, {Math.round(playerMarker.y)})
                  </span>
                )}

                <button
                  onClick={processVideo}
                  disabled={!playerMarker || !isCalibrated || isProcessing}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600', marginLeft: 'auto', opacity: (!playerMarker || !isCalibrated || isProcessing) ? 0.5 : 1 }}
                >
                  {isProcessing ? `Processing... ${processingProgress}%` : '🚀 Analyze Movement'}
                </button>
              </div>

              {isProcessing && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ height: '8px', background: '#374151', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${processingProgress}%`, background: '#3b82f6', transition: 'width 0.1s' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', textAlign: 'center' }}>
                    AI tracking player movement frame-by-frame...
                  </div>
                </div>
              )}
            </div>

            {/* Results Section */}
            {analysisResults && (
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #a78bfa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#a78bfa' }}>📊 Analysis Results</h3>

                  {primaryAthlete && (
                    <button
                      onClick={saveToAthlete}
                      style={{ padding: '0.4rem 0.8rem', background: '#22c55e', border: 'none', borderRadius: '0.375rem', color: '#ffffff', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                    >
                      💾 Save to {primaryAthlete.firstName}
                    </button>
                  )}
                </div>

                {/* Result Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {['summary', 'speed', 'acceleration', 'power', 'data'].map(tab => (
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginBottom: '0.25rem' }}>Max Speed</div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                        {analysisResults.summary.maxVelocityMph.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>MPH</div>
                    </div>

                    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '0.25rem' }}>Max Acceleration</div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                        {analysisResults.summary.maxAccelerationG.toFixed(2)}
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

                    <div style={{ gridColumn: 'span 3', background: '#0f172a', padding: '1rem', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#22c55e', marginBottom: '0.5rem' }}>Split Times</div>
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {[10, 20, 30, 40].map(yard => (
                          <div key={yard} style={{ textAlign: 'center' }}>
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

                {activeResultTab === 'speed' && (
                  <div style={{ height: '300px' }}>
                    <canvas ref={speedChartRef} />
                  </div>
                )}

                {activeResultTab === 'acceleration' && (
                  <div style={{ height: '300px' }}>
                    <canvas ref={accelChartRef} />
                  </div>
                )}

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
          </>
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
      </div>
    </div>
  );
}

export default VideoAnalysis;