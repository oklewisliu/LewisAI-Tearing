import React, { useRef, useState, useEffect } from 'react';
import { calculateFrameDifference } from '../utils/imageProcessing';
import { Keyframe } from '../types';
import { Film, AlertCircle } from 'lucide-react';

interface VideoProcessorProps {
  videoFile: File | null;
  onProcessingStart: () => void;
  onProcessingComplete: (frames: Keyframe[]) => void;
  onProgress: (progress: number) => void;
}

const VideoProcessor: React.FC<VideoProcessorProps> = ({
  videoFile,
  onProcessingStart,
  onProcessingComplete,
  onProgress,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!videoFile) return;

    const videoUrl = URL.createObjectURL(videoFile);
    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();
    }

    return () => {
      URL.revokeObjectURL(videoUrl);
    };
  }, [videoFile]);

  const startProcessing = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    setError('');
    onProcessingStart();

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        setError('无法初始化画布上下文');
        return;
    }

    // Set canvas size specifically for processing (doesn't need to be full 4k)
    // 640px width is enough for scene detection
    const processWidth = 640;
    const processHeight = (video.videoHeight / video.videoWidth) * processWidth;
    
    canvas.width = processWidth;
    canvas.height = processHeight;

    const frames: Keyframe[] = [];
    const duration = video.duration;
    
    // Config
    const sampleRate = 0.5; // check every 0.5 seconds
    const threshold = 15; // Difference threshold for new scene (0-255)
    
    let lastFrameData: Uint8ClampedArray | null = null;
    let processedTime = 0;

    const processInterval = async () => {
      if (processedTime >= duration) {
        onProcessingComplete(frames);
        return;
      }

      // Seek
      video.currentTime = processedTime;
      
      // Wait for seek to complete
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      // Draw
      ctx.drawImage(video, 0, 0, processWidth, processHeight);
      
      // Get Data
      const imageData = ctx.getImageData(0, 0, processWidth, processHeight);
      const currentData = imageData.data;

      // Detect
      let isKeyframe = false;
      
      if (!lastFrameData) {
        // First frame is always a keyframe
        isKeyframe = true;
      } else {
        const diff = calculateFrameDifference(lastFrameData, currentData);
        if (diff > threshold) {
          isKeyframe = true;
        }
      }

      if (isKeyframe) {
        // Save full resolution for the result
        // We create a temporary high-res canvas or just use the source video aspect
        // For performance, let's limit output to 1280px width
        const outputWidth = Math.min(1280, video.videoWidth);
        const outputHeight = (video.videoHeight / video.videoWidth) * outputWidth;
        
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const outCtx = outputCanvas.getContext('2d');
        if (outCtx) {
            outCtx.drawImage(video, 0, 0, outputWidth, outputHeight);
            const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.9);
            
            frames.push({
              id: `frame-${processedTime.toFixed(2)}`,
              time: processedTime,
              imageUrl: dataUrl,
              originalUrl: dataUrl,
              isSketch: false
            });
        }
        
        lastFrameData = new Uint8ClampedArray(currentData);
      }

      // Update progress
      onProgress((processedTime / duration) * 100);

      // Next step
      processedTime += sampleRate;
      
      // Use setTimeout to avoid freezing UI completely
      setTimeout(processInterval, 10);
    };

    // Start loop
    processInterval();
  };

  return (
    <div className="hidden">
      <video 
        ref={videoRef} 
        onLoadedData={() => {
            // Video is ready
            if(videoFile) startProcessing();
        }}
        onError={() => setError('视频加载失败')}
        muted 
        playsInline 
        crossOrigin="anonymous"
      />
      <canvas ref={canvasRef} />
      {error && <div className="text-red-500 flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
    </div>
  );
};

export default VideoProcessor;
