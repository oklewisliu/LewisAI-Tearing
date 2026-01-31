import React, { useState, useEffect } from 'react';
import { Upload, FileVideo, Loader2, LayoutGrid, PenTool, Eraser, Palette, FileText, Images, Download } from 'lucide-react';
import { Keyframe, AppState } from './types';
import VideoProcessor from './components/VideoProcessor';
import FrameGallery from './components/FrameGallery';
import { analyzeImage, generateSketch } from './utils/geminiService';
import { generateStoryboardImages } from './utils/storyboardGenerator';
import JSZip from 'jszip';
import saveAs from 'file-saver';

const formatTime = (seconds: number) => {
  if (seconds === undefined || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const App = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<Keyframe[]>([]);
  const [progress, setProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [captionsProcessing, setCaptionsProcessing] = useState(false);

  // Step 1: Handle Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      // Immediately start analyzing
      setAppState(AppState.ANALYZING);
      setFrames([]);
      setProgress(0);
    }
  };

  const handleProcessingComplete = (extractedFrames: Keyframe[]) => {
    setFrames(extractedFrames);
    setAppState(AppState.READY);
    setProgress(100);
  };

  // Auto-Captioning
  useEffect(() => {
    if (appState === AppState.READY && frames.length > 0 && !captionsProcessing) {
        const framesNeedingCaption = frames.filter(f => f && !f.caption);
        if (framesNeedingCaption.length > 0) {
            processCaptionsQueue(framesNeedingCaption);
        }
    }
  }, [appState, frames, captionsProcessing]);

  const updateFrame = (id: string, updates: Partial<Keyframe>) => {
    setFrames(prev => prev.map(f => (f && f.id === id) ? { ...f, ...updates } : f));
  };

  const processCaptionsQueue = async (queue: Keyframe[]) => {
      setCaptionsProcessing(true);
      const concurrency = 5; 
      const pending = [...queue];
      
      const worker = async () => {
          while (pending.length > 0) {
              const frame = pending.shift();
              if (!frame) break;
              try {
                  const caption = await analyzeImage(frame.originalUrl);
                  updateFrame(frame.id, { caption });
              } catch (e) {
                  updateFrame(frame.id, { caption: "..." });
              }
          }
      };

      const workers = Array(concurrency).fill(null).map(() => worker());
      await Promise.all(workers);
      setCaptionsProcessing(false);
  };

  // 1. AI Sketch Generation
  const handleConvertToSketch = async () => {
    setIsConverting(true);
    try {
      const newFrames = [...frames];
      const concurrency = 3; 
      const framesToProcess = newFrames.map((frame, index) => ({ frame, index }));
      
      const worker = async () => {
          while (framesToProcess.length > 0) {
              const item = framesToProcess.shift();
              if (!item) break;
              
              const { frame, index } = item;
              // Skip if already sketched
              if (frame.isSketch) continue;

              try {
                  const sketchUrl = await generateSketch(frame.originalUrl);
                  setFrames(current => {
                      if (index >= current.length || !current[index]) return current;
                      const updated = [...current];
                      updated[index] = {
                          ...updated[index],
                          imageUrl: sketchUrl,
                          isSketch: true
                      };
                      return updated;
                  });
              } catch (e) {
                  console.error("Sketch conversion failed", e);
              }
          }
      };

      await Promise.all(Array(concurrency).fill(null).map(() => worker()));

    } catch (e) {
      alert("部分图片转换失败，请重试");
    } finally {
      setIsConverting(false);
    }
  };

  // 2. Export Storyboard Sheet (Images + Layout)
  const handleDownloadStoryboard = async () => {
      setIsGeneratingStoryboard(true);
      try {
          const validFrames = frames.filter(f => !!f);
          const pages = await generateStoryboardImages(validFrames, videoFile?.name || "Storyboard");
          
          if (pages.length === 1) {
              saveAs(pages[0], `storyboard_${videoFile?.name || 'export'}.jpg`);
          } else {
              const zip = new JSZip();
              pages.forEach((dataUrl, i) => {
                  const data = dataUrl.split(',')[1];
                  zip.file(`storyboard_page_${i + 1}.jpg`, data, { base64: true });
              });
              const content = await zip.generateAsync({ type: "blob" });
              saveAs(content, "storyboard_pages.zip");
          }
      } catch (e) {
          alert("生成故事版失败");
      } finally {
          setIsGeneratingStoryboard(false);
      }
  };

  // 3. Export Table (CSV)
  const handleExportTable = () => {
      try {
          // CSV Header
          let csvContent = "\uFEFF"; // BOM for Excel compatibility
          csvContent += "Shot No.,Timecode,Description\n";
          
          frames.forEach((frame, index) => {
              // Escape quotes in description to prevent CSV breakage
              const safeDesc = frame.caption ? `"${frame.caption.replace(/"/g, '""')}"` : "";
              const timecode = formatTime(frame.time);
              csvContent += `${index + 1},${timecode},${safeDesc}\n`;
          });
          
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          saveAs(blob, `${videoFile?.name || 'script'}_shots.csv`);
      } catch (e) {
          alert("导出表格失败");
          console.error(e);
      }
  };

  // 4. Export All Original Frames (ZIP)
  const handleExportImages = async () => {
      setIsExportingImages(true);
      try {
          const zip = new JSZip();
          const folder = zip.folder("keyframes");
          
          frames.forEach((frame, index) => {
              if (frame.originalUrl) {
                  const data = frame.originalUrl.split(',')[1];
                  const filename = `shot_${(index + 1).toString().padStart(3, '0')}.jpg`;
                  folder?.file(filename, data, { base64: true });
              }
          });
          
          const content = await zip.generateAsync({ type: "blob" });
          saveAs(content, `${videoFile?.name || 'video'}_frames.zip`);
      } catch (e) {
          alert("导出图片失败");
          console.error(e);
      } finally {
          setIsExportingImages(false);
      }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setVideoFile(null);
    setFrames([]);
    setProgress(0);
    setCaptionsProcessing(false);
  };

  // UI Components
  return (
    <div className="min-h-screen py-8 px-4 flex justify-center">
      {/* The "Paper" Container */}
      <div className="w-full max-w-6xl bg-[#fdfbf7] paper-shadow rounded-sm min-h-[90vh] flex flex-col relative overflow-hidden border border-stone-200">
        
        {/* Paper Header / Branding */}
        <header className="px-8 py-6 border-b-2 border-dashed border-stone-300 flex items-center justify-between bg-stone-50">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-900 text-white flex items-center justify-center rounded-full rotate-3 shadow-md">
                 <PenTool size={20} />
              </div>
              <div>
                  <h1 className="text-3xl font-bold handwritten text-stone-800 tracking-wide">LewisAI-Tearing</h1>
                  <p className="text-xs text-stone-500 font-mono tracking-widest uppercase">Storyboard Studio v1.0</p>
              </div>
           </div>
           
           {appState !== AppState.IDLE && (
               <button onClick={resetApp} className="group flex items-center gap-2 px-4 py-2 text-stone-500 hover:text-red-500 transition-colors handwritten text-lg">
                   <Eraser size={18} className="group-hover:-rotate-12 transition-transform"/>
                   <span>Clear Paper</span>
               </button>
           )}
        </header>

        {/* Main Content Area - Grid Pattern Background for inner area */}
        <main className="flex-1 p-8 relative">
          
          {/* Background Grid Lines on the Paper */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{
                   backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                   backgroundSize: '20px 20px'
               }}>
          </div>

          <div className="relative z-10">
            {/* IDLE: Upload State */}
            {appState === AppState.IDLE && (
              <div className="flex flex-col items-center justify-center h-[60vh] animate-in fade-in duration-700">
                 <div className="border-4 border-dashed border-stone-300 rounded-xl p-12 bg-stone-100/50 hover:bg-stone-100 hover:border-stone-400 transition-all cursor-pointer group text-center max-w-lg w-full">
                    <label className="cursor-pointer block w-full h-full">
                        <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                        <div className="w-20 h-20 bg-stone-800 text-white rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                             <Upload size={32} />
                        </div>
                        <h2 className="text-4xl handwritten text-stone-800 mb-2">Import Video</h2>
                        <p className="text-stone-500 handwritten text-xl">Drag & drop or click to upload footage</p>
                        <p className="text-xs text-stone-400 mt-4 font-mono">SUPPORTS MP4, MOV, WEBM</p>
                    </label>
                 </div>
              </div>
            )}

            {/* ANALYZING: Progress State */}
            {appState === AppState.ANALYZING && (
               <div className="flex flex-col items-center justify-center h-[50vh]">
                   <VideoProcessor 
                        videoFile={videoFile} 
                        onProcessingStart={() => {}} 
                        onProcessingComplete={handleProcessingComplete} 
                        onProgress={setProgress} 
                   />
                   
                   <div className="w-full max-w-md">
                       <div className="flex justify-between text-stone-600 mb-2 handwritten text-xl font-bold">
                           <span>Analyzing Scenes...</span>
                           <span>{Math.round(progress)}%</span>
                       </div>
                       <div className="h-6 bg-stone-200 border-2 border-stone-800 rounded-full overflow-hidden p-0.5">
                           <div 
                               className="h-full bg-stone-800 rounded-full transition-all duration-200"
                               style={{ width: `${progress}%` }}
                           ></div>
                       </div>
                       <p className="text-center mt-4 text-stone-400 font-mono text-xs animate-pulse">
                           DETECTING CUTS & ACTIONS
                       </p>
                   </div>
               </div>
            )}

            {/* READY: Toolbar & Gallery */}
            {appState === AppState.READY && (
                <div className="space-y-6">
                    {/* Toolbar - Sticker Style */}
                    <div className="sticky top-4 z-20 flex flex-wrap gap-4 justify-between items-end bg-stone-100/90 backdrop-blur-sm p-4 border-2 border-stone-800 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]">
                         <div className="flex flex-col min-w-[200px]">
                             <h2 className="handwritten text-2xl font-bold text-stone-800 flex items-center gap-2">
                                <FileVideo size={20}/>
                                <span className="truncate max-w-[300px]">{videoFile?.name}</span>
                             </h2>
                             <span className="text-xs font-mono text-stone-500 mt-1">
                                 TOTAL FRAMES: {frames.length} 
                                 {captionsProcessing && " • WRITING CAPTIONS..."}
                             </span>
                         </div>

                         <div className="flex gap-2 items-center flex-wrap">
                             {/* AI Button */}
                             <button 
                                onClick={handleConvertToSketch}
                                disabled={isConverting}
                                className={`
                                    flex items-center gap-2 px-3 py-1.5 rounded border-2 border-stone-800 handwritten text-lg font-bold transition-all
                                    ${frames.some(f => f.isSketch) 
                                        ? 'bg-stone-800 text-white hover:bg-stone-700' 
                                        : 'bg-white text-stone-800 hover:bg-stone-50'
                                    }
                                    shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]
                                `}
                             >
                                 {isConverting ? <Loader2 className="animate-spin" size={18}/> : <Palette size={18} />}
                                 {frames.some(f => f.isSketch) ? 'Re-Ink' : 'Ink Sketch'}
                             </button>

                             <div className="w-px h-8 bg-stone-300 mx-2 hidden sm:block"></div>

                             {/* Export Group */}
                             <button 
                                onClick={handleExportTable}
                                className="flex items-center gap-2 px-3 py-1.5 rounded border-2 border-stone-800 bg-white text-stone-800 handwritten text-lg font-bold hover:bg-stone-50 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]"
                                title="Export CSV Table"
                             >
                                 <FileText size={18} />
                                 Table
                             </button>

                             <button 
                                onClick={handleExportImages}
                                disabled={isExportingImages}
                                className="flex items-center gap-2 px-3 py-1.5 rounded border-2 border-stone-800 bg-white text-stone-800 handwritten text-lg font-bold hover:bg-stone-50 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]"
                                title="Export Original Frames"
                             >
                                 {isExportingImages ? <Loader2 className="animate-spin" size={18}/> : <Images size={18} />}
                                 Frames
                             </button>

                             <button 
                                onClick={handleDownloadStoryboard}
                                disabled={isGeneratingStoryboard}
                                className="flex items-center gap-2 px-3 py-1.5 rounded border-2 border-stone-800 bg-emerald-500 text-white handwritten text-lg font-bold hover:bg-emerald-400 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]"
                                title="Export Storyboard Sheet"
                             >
                                 {isGeneratingStoryboard ? <Loader2 className="animate-spin" size={18}/> : <LayoutGrid size={18} />}
                                 Sheet
                             </button>
                         </div>
                    </div>

                    <FrameGallery frames={frames} onUpdateFrame={updateFrame} />
                </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;