import React from 'react';
import { Keyframe } from '../types';
import { Loader2 } from 'lucide-react';

interface FrameGalleryProps {
  frames: Keyframe[];
  onUpdateFrame: (id: string, updates: Partial<Keyframe>) => void;
}

const FrameGallery: React.FC<FrameGalleryProps> = ({ frames, onUpdateFrame }) => {
  if (frames.length === 0) return null;

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {frames.map((frame, index) => {
          if (!frame) return null; 
          return (
            <div 
                key={frame.id || index} 
                className="group relative flex flex-col bg-white border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] transition-all duration-200"
            >
              {/* Frame Number Badge - Sticker style */}
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-stone-900 text-white rounded-full flex items-center justify-center font-bold handwritten z-10 border-2 border-white">
                 {index + 1}
              </div>

              {/* Timecode */}
              <div className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 text-[10px] font-mono border border-stone-900 z-10">
                  {formatTime(frame.time)}
              </div>

              {/* Image Container */}
              <div className="aspect-video w-full overflow-hidden bg-stone-100 border-b-2 border-stone-900 relative">
                <img 
                  src={frame.imageUrl} 
                  alt={`Panel ${index}`}
                  className={`w-full h-full object-cover transition-all duration-500 ${frame.isSketch ? 'grayscale contrast-125' : ''}`}
                />
              </div>

              {/* Caption Section - Looks like handwritten notes */}
              <div className="p-3 flex-1 min-h-[80px] bg-white relative">
                  {/* Lined paper background effect for caption area */}
                  <div className="absolute inset-0 pointer-events-none opacity-20" 
                       style={{backgroundImage: 'linear-gradient(transparent 95%, #94a3b8 95%)', backgroundSize: '100% 20px'}}>
                  </div>
                  
                  <div className="relative z-10">
                    {frame.caption ? (
                        <p className="text-lg text-stone-800 leading-snug handwritten">
                            {frame.caption}
                        </p>
                    ) : (
                        <div className="flex items-center gap-2 text-stone-400 text-sm py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="handwritten">Drafting caption...</span>
                        </div>
                    )}
                  </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const formatTime = (seconds: number) => {
  if (seconds === undefined || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default FrameGallery;