'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  Image as ImageIcon, 
  Images,
  PenTool, 
  Download, 
  Sparkles,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  MousePointer2,
  Eraser,
  Undo,
  Redo,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/components/AuthProvider';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const AI_MODEL = "gemini-3.1-flash-image-preview";

export default function CanvasEditor() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penSize, setPenSize] = useState(40);
  const [penColor, setPenColor] = useState('#6366f1'); // Indigo-500
  const [opacity, setOpacity] = useState(0.6);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [canvasScale, setCanvasScale] = useState(1);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };
  const [historyState, setHistoryState] = useState<{ past: string[], present: string | null, future: string[] }>({
    past: [],
    present: null,
    future: []
  });
  const [imageHistory, setImageHistory] = useState<{ past: string[], present: string | null, future: string[] }>({
    past: [],
    present: null,
    future: []
  });
  const [savedEdits, setSavedEdits] = useState<any[]>([]);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    if (!user) {
      setSavedEdits([]);
      return;
    }
    const q = query(
      collection(db, 'edits'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const edits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedEdits(edits);
    }, (error) => {
      console.error("Error fetching gallery:", error);
    });
    return () => unsubscribe();
  }, [user]);

  const saveHistoryState = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    setHistoryState(curr => {
      if (curr.present === dataUrl) return curr;
      return {
        past: curr.present ? [...curr.past, curr.present].slice(-20) : curr.past,
        present: dataUrl,
        future: []
      };
    });
  }, []);

  const restoreCanvas = useCallback((dataUrl: string) => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }, []);

  const handleUndo = useCallback(() => {
    setHistoryState(curr => {
      if (curr.past.length === 0) return curr;
      
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      
      restoreCanvas(previous);
      
      return {
        past: newPast,
        present: previous,
        future: [curr.present!, ...curr.future]
      };
    });
  }, [restoreCanvas]);

  const handleRedo = useCallback(() => {
    setHistoryState(curr => {
      if (curr.future.length === 0) return curr;
      
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      
      restoreCanvas(next);
      
      return {
        past: [...curr.past, curr.present!],
        present: next,
        future: newFuture
      };
    });
  }, [restoreCanvas]);

  // Initialize canvas and handle resizing
  const resizeCanvas = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !maskCanvas || !container) return;

    // Use requestAnimationFrame to ensure container dimensions are updated
    requestAnimationFrame(() => {
      let width = img.width;
      let height = img.height;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        maskCanvas.width = width;
        maskCanvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.lineCap = 'round';
          maskCtx.lineJoin = 'round';
        }
        
        setHistoryState({
          past: [],
          present: maskCanvas.toDataURL(),
          future: []
        });
      }

      // Calculate display size
      const containerRect = container.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(container);
      const pt = parseFloat(computedStyle.paddingTop) || 0;
      const pb = parseFloat(computedStyle.paddingBottom) || 0;
      const pl = parseFloat(computedStyle.paddingLeft) || 0;
      const pr = parseFloat(computedStyle.paddingRight) || 0;

      const availableWidth = containerRect.width - pl - pr;
      const availableHeight = containerRect.height - pt - pb;

      if (availableWidth <= 0 || availableHeight <= 0) return;

      const containerRatio = availableWidth / availableHeight;
      const imageRatio = width / height;

      let displayWidth, displayHeight;
      if (imageRatio > containerRatio) {
        displayWidth = availableWidth;
        displayHeight = availableWidth / imageRatio;
      } else {
        displayHeight = availableHeight;
        displayWidth = availableHeight * imageRatio;
      }
      setDisplaySize({ width: displayWidth, height: displayHeight });
    });
  }, []);

  const handleImageUndo = useCallback(() => {
    setImageHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImage(img);
        resizeCanvas(img);
        const maskCanvas = maskCanvasRef.current;
        if (maskCanvas) {
          const ctx = maskCanvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        }
      };
      img.src = previous;
      
      return {
        past: newPast,
        present: previous,
        future: [curr.present!, ...curr.future]
      };
    });
  }, [resizeCanvas]);

  const handleImageRedo = useCallback(() => {
    setImageHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImage(img);
        resizeCanvas(img);
        const maskCanvas = maskCanvasRef.current;
        if (maskCanvas) {
          const ctx = maskCanvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        }
      };
      img.src = next;
      
      return {
        past: [...curr.past, curr.present!],
        present: next,
        future: newFuture
      };
    });
  }, [resizeCanvas]);

  useEffect(() => {
    if (image) {
      const handleResize = () => resizeCanvas(image);
      window.addEventListener('resize', handleResize);
      // Call once to ensure correct initial size
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [image, resizeCanvas]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStatus('Loading image...');
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setImage(img);
          resizeCanvas(img);
          clearMask();
          setStatus('Ready');
          setImageHistory({ past: [], present: src, future: [] });
        };
        img.onerror = () => {
          setStatus('Error loading image');
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!maskCanvasRef.current) return;
    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    } else {
      x = (e.clientX - rect.left) * (canvas.width / rect.width);
      y = (e.clientY - rect.top) * (canvas.height / rect.height);
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Scale pen size based on the ratio between internal resolution and displayed size
    const scaleRatio = canvas.width / rect.width;
    ctx.lineWidth = penSize * scaleRatio;
    
    ctx.strokeStyle = penColor;
    ctx.globalAlpha = 1.0;
    
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistoryState();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !maskCanvasRef.current) return;

    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    } else {
      x = (e.clientX - rect.left) * (canvas.width / rect.width);
      y = (e.clientY - rect.top) * (canvas.height / rect.height);
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        saveHistoryState();
      }
    }
  };

  const generateInitialImage = async () => {
    if (!prompt) {
      setStatus('Prompt required');
      return;
    }

    setIsProcessing(true);
    setStatus('Generating...');
    try {
      const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)! });
      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: { parts: [{ text: `Generate a professional, high-quality image of: ${prompt}` }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "4K"
          }
        }
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const base64 = imagePart.inlineData.data;
        const src = `data:image/png;base64,${base64}`;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          setImage(img);
          resizeCanvas(img);
          clearMask();
          setStatus('Ready');
          setImageHistory({ past: [], present: src, future: [] });
          
          if (user) {
            try {
              const storageRef = ref(storage, `edits/${user.uid}/${Date.now()}.png`);
              await uploadString(storageRef, base64!, 'base64', { contentType: 'image/png' });
              const downloadUrl = await getDownloadURL(storageRef);
              
              await addDoc(collection(db, 'edits'), {
                userId: user.uid,
                imageUrl: downloadUrl,
                prompt: prompt,
                createdAt: serverTimestamp()
              });
            } catch (error) {
              console.error("Error saving generated image to storage/database:", error);
            }
          }
        };
        img.src = src;
      } else {
        setStatus('Generation failed');
      }
    } catch (error) {
      console.error(error);
      setStatus('Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const applyAIChange = async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || prompt;
    if (!image || !activePrompt) {
      setStatus('Image & Prompt required');
      return;
    }

    setIsProcessing(true);
    setStatus('Processing...');

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(canvas, 0, 0);

      const maskCtx = maskCanvasRef.current!.getContext('2d');
      let hasMask = false;
      if (maskCtx) {
        const maskData = maskCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        let minX = tempCanvas.width, minY = tempCanvas.height, maxX = 0, maxY = 0;
        for (let i = 3; i < maskData.data.length; i += 4) {
          if (maskData.data[i] > 0) {
            hasMask = true;
            const pixelIndex = i / 4;
            const x = Math.floor(pixelIndex % tempCanvas.width);
            const y = Math.floor(pixelIndex / tempCanvas.width);
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }

        if (hasMask) {
          tempCtx.strokeStyle = '#ff0000';
          tempCtx.lineWidth = Math.max(2, Math.floor(tempCanvas.width / 150));
          tempCtx.setLineDash([10, 10]);
          tempCtx.strokeRect(Math.max(0, minX - 15), Math.max(0, minY - 15), maxX - minX + 30, maxY - minY + 30);
        }
      }

      const maskedBase64 = tempCanvas.toDataURL('image/png').split(',')[1];

      const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)! });
      
      const ratio = canvas.width / canvas.height;
      const options = [
        { name: "1:1", val: 1 },
        { name: "4:3", val: 4/3 },
        { name: "3:4", val: 3/4 },
        { name: "16:9", val: 16/9 },
        { name: "9:16", val: 9/16 }
      ];
      const closestRatio = options.reduce((prev, curr) => Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev).name;
      
      const textPrompt = hasMask 
        ? `Recreate this image with the following modification: ${activePrompt}. 
I have drawn a red dashed box around the target area to help you locate it. 
If the request is to remove or delete something, generate the image without the object in the red box, filling the space naturally with the background. 
IMPORTANT: You must REMOVE the red dashed box in your final generated image. Do not leave any red lines.`
        : `Recreate this image with the following modification: ${activePrompt}.`;

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                data: maskedBase64,
                mimeType: "image/png"
              }
            },
            {
              text: textPrompt
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: closestRatio,
            imageSize: "4K"
          }
        }
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const base64 = imagePart.inlineData.data;
        const src = `data:image/png;base64,${base64}`;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          setImage(img);
          resizeCanvas(img);
          clearMask();
          setStatus('Applied');
          setImageHistory(curr => ({
            past: curr.present ? [...curr.past, curr.present].slice(-20) : curr.past,
            present: src,
            future: []
          }));
          
          if (user) {
            try {
              const storageRef = ref(storage, `edits/${user.uid}/${Date.now()}.png`);
              await uploadString(storageRef, base64!, 'base64', { contentType: 'image/png' });
              const downloadUrl = await getDownloadURL(storageRef);
              
              await addDoc(collection(db, 'edits'), {
                userId: user.uid,
                imageUrl: downloadUrl,
                prompt: prompt || 'Erase object',
                createdAt: serverTimestamp()
              });
            } catch (error) {
              console.error("Error saving edit to storage/database:", error);
            }
          }
        };
        img.src = src;
      } else {
        setStatus('Failed');
      }
    } catch (error) {
      console.error(error);
      setStatus('Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = async () => {
    if (!image) return;
    try {
      if (image.src.startsWith('data:')) {
        const link = document.createElement('a');
        link.download = 'ai-edited-image.png';
        link.href = image.src;
        link.click();
      } else {
        const response = await fetch(image.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'ai-edited-image.png';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error downloading image:", error);
      if (canvasRef.current) {
        const link = document.createElement('a');
        link.download = 'ai-edited-image.png';
        link.href = canvasRef.current.toDataURL();
        link.click();
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden rounded-none border-none bg-zinc-900/50 relative">
      {/* Top Header / Status Bar */}
      <div className="h-14 border-bottom border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isProcessing ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              {status || (image ? "Ready" : "Idle")}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-[10px] font-mono text-zinc-500">
            {image ? `${image.width}x${image.height}` : "No Image"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Brush Controls (Desktop) */}
          {image && !isProcessing && (
            <div className="hidden lg:flex items-center gap-4 mr-4 pr-4 border-r border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-400">Size</span>
                <input 
                  type="range" min="5" max="150" value={penSize} 
                  onChange={(e) => setPenSize(parseInt(e.target.value))}
                  className="w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-400">Opacity</span>
                <input 
                  type="range" min="0.1" max="1" step="0.05" value={opacity} 
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <div className="flex items-center gap-1">
                {['#6366f1', '#ef4444', '#22c55e', '#eab308', '#ec4899'].map(color => (
                  <button
                    key={color}
                    onClick={() => setPenColor(color)}
                    className={cn(
                      "w-4 h-4 rounded-full transition-transform",
                      penColor === color ? "scale-110 ring-2 ring-white/20" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
              <button onClick={handleUndo} disabled={historyState.past.length === 0} className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors" title="Undo Mask">
                <Undo className="w-4 h-4" />
              </button>
              <button onClick={handleRedo} disabled={historyState.future.length === 0} className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors" title="Redo Mask">
                <Redo className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
              <button onClick={clearMask} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Clear Mask">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {image && (
            <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 mr-1 sm:mr-2">
              <button 
                onClick={handleImageUndo} 
                disabled={imageHistory.past.length === 0}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors rounded-md hover:bg-zinc-700"
                title="Undo Image Edit"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3 bg-zinc-700 mx-0.5" />
              <button 
                onClick={handleImageRedo} 
                disabled={imageHistory.future.length === 0}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors rounded-md hover:bg-zinc-700"
                title="Redo Image Edit"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <label className="cursor-pointer flex items-center gap-2 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all text-xs font-medium border border-zinc-700">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
          </label>
          {user && (
            <button 
              onClick={() => setShowGallery(true)}
              className="flex items-center gap-2 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all text-xs font-medium border border-zinc-700"
            >
              <Images className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gallery</span>
            </button>
          )}
          <button 
            onClick={downloadImage}
            disabled={!image}
            className="flex items-center gap-2 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Sidebar: Tools (Desktop) */}
        <div className="hidden md:flex w-72 border-r border-zinc-800 flex-col bg-zinc-950/30">
          <div className="p-6 space-y-8">
            {/* AI Section */}
            <div className="space-y-6">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">AI Generator</h4>
              <div className="space-y-4">
                <textarea
                  placeholder="Describe the change..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-32 p-3 text-xs bg-zinc-900 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-transparent resize-none text-zinc-200 placeholder:text-zinc-600"
                />
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => applyAIChange()}
                    disabled={isProcessing || !image || !prompt}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-all text-xs font-bold shadow-lg shadow-indigo-500/10"
                  >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Apply Fill
                  </button>
                  <button
                    onClick={() => applyAIChange("Remove the object inside the red dashed box completely and fill the space naturally with the background.")}
                    disabled={isProcessing || !image}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-30 disabled:hover:bg-red-600/20 text-red-500 rounded-xl transition-all text-xs font-bold border border-red-500/20"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Erase Object
                  </button>
                  <button
                    onClick={generateInitialImage}
                    disabled={isProcessing || !prompt}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-300 rounded-xl transition-all text-xs font-bold"
                  >
                    Generate New
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div ref={containerRef} className="flex-1 min-h-0 min-w-0 relative flex items-center justify-center bg-zinc-950 p-4 md:p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          
          {/* Floating Brush Controls (Desktop & Mobile) */}
          {image && !isProcessing && (
            <div className="lg:hidden absolute top-6 left-1/2 -translate-x-1/2 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl z-[60] w-[90%] sm:w-auto min-w-[300px]">
              <div className="flex w-full sm:w-auto gap-4 sm:gap-6">
                <div className="flex-1 sm:w-32 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>Size</span>
                    <span>{penSize}px</span>
                  </div>
                  <input 
                    type="range" min="5" max="150" value={penSize} 
                    onChange={(e) => setPenSize(parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div className="flex-1 sm:w-32 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>Opacity</span>
                    <span>{Math.round(opacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="1" step="0.05" value={opacity} 
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-3 pl-6 border-l border-zinc-800">
                <div className="flex gap-1.5">
                  {['#6366f1', '#ef4444', '#22c55e', '#eab308', '#ec4899'].map(color => (
                    <button
                      key={color}
                      onClick={() => setPenColor(color)}
                      className={cn(
                        "w-5 h-5 rounded-full transition-all border-2",
                        penColor === color ? "border-white scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
                <button onClick={handleUndo} disabled={historyState.past.length === 0} className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors" title="Undo">
                  <Undo className="w-4 h-4" />
                </button>
                <button onClick={handleRedo} disabled={historyState.future.length === 0} className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors" title="Redo">
                  <Redo className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
                <button onClick={clearMask} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Clear Mask">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {!image && !isProcessing ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center space-y-6 z-10"
              >
                <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto border border-zinc-800 shadow-2xl">
                  <ImageIcon className="w-10 h-10 text-zinc-700" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-zinc-200">Start your creation</h2>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto">Upload a photo to edit or describe something to generate a new one.</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <label className="cursor-pointer py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all text-sm font-bold shadow-xl shadow-indigo-500/20">
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </motion.div>
            ) : (
              <div 
                className="relative shadow-2xl shadow-black/50 rounded-lg"
                style={{
                  width: displaySize.width > 0 ? displaySize.width : 'auto',
                  height: displaySize.height > 0 ? displaySize.height : 'auto',
                }}
              >
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block rounded-lg" />
                <canvas 
                  ref={maskCanvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none rounded-lg"
                  style={{ opacity }}
                />
                
                {isProcessing && (
                  <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center rounded-lg z-50">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 border-2 border-indigo-500/20 rounded-full animate-ping" />
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin absolute inset-0" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-indigo-400 animate-pulse">
                        {status}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>

          {/* Mobile Floating Toolbar */}
          {image && !isProcessing && (
            <div className="md:hidden absolute bottom-0 inset-x-0 flex items-center justify-center gap-2 p-3 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-[60]">
              <div className="flex gap-2 px-2">
                {['#6366f1', '#ef4444', '#22c55e'].map(color => (
                  <button
                    key={color}
                    onClick={() => setPenColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      penColor === color ? "border-white scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="h-6 w-[1px] bg-zinc-800" />
              <button onClick={handleUndo} disabled={historyState.past.length === 0} className="w-10 h-10 flex items-center justify-center text-zinc-300 disabled:opacity-30">
                <Undo className="w-5 h-5" />
              </button>
              <button onClick={handleRedo} disabled={historyState.future.length === 0} className="w-10 h-10 flex items-center justify-center text-zinc-300 disabled:opacity-30">
                <Redo className="w-5 h-5" />
              </button>
              <div className="h-6 w-[1px] bg-zinc-800" />
              <button 
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-xl text-zinc-300"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <button 
                onClick={clearMask}
                className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-xl text-zinc-300"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Slide-up Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="md:hidden absolute inset-x-0 bottom-0 bg-zinc-950 border-t border-zinc-800 p-6 z-[70] rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" onClick={() => setIsPanelOpen(false)} />
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display font-bold text-zinc-100">AI Controls</h3>
                <button onClick={() => setIsPanelOpen(false)} className="text-zinc-500">
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <textarea
                  placeholder="Describe what to fill..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-24 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { applyAIChange(); setIsPanelOpen(false); }}
                    disabled={isProcessing || !image || !prompt}
                    className="flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold disabled:opacity-30"
                  >
                    Apply Fill
                  </button>
                  <button
                    onClick={() => { applyAIChange("Remove the object inside the red dashed box completely and fill the space naturally with the background."); setIsPanelOpen(false); }}
                    disabled={isProcessing || !image}
                    className="flex items-center justify-center gap-2 py-4 bg-red-600/20 text-red-500 rounded-2xl font-bold disabled:opacity-30 border border-red-500/20"
                  >
                    <Eraser className="w-4 h-4" />
                    Erase
                  </button>
                  <button
                    onClick={() => { generateInitialImage(); setIsPanelOpen(false); }}
                    disabled={isProcessing || !prompt}
                    className="col-span-2 flex items-center justify-center gap-2 py-4 bg-zinc-800 text-zinc-300 rounded-2xl font-bold disabled:opacity-30"
                  >
                    Generate New
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Overlay (Desktop) */}
      {!image && !isProcessing && (
        <div className="hidden lg:block absolute bottom-6 right-6 p-4 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl max-w-xs pointer-events-none">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <MousePointer2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-zinc-200">Quick Guide</h5>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                1. Upload or generate an image.<br/>
                2. Paint over the area you want to change.<br/>
                3. Describe the new content and apply fill.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      <AnimatePresence>
        {showGallery && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-xl font-display font-bold text-zinc-100 flex items-center gap-2">
                  <Images className="w-5 h-5 text-indigo-500" />
                  Your Gallery
                </h2>
                <button 
                  onClick={() => setShowGallery(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {savedEdits.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                    <Images className="w-12 h-12 opacity-20" />
                    <p>No saved edits yet. Start creating!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {savedEdits.map((edit) => (
                      <div key={edit.id} className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
                        <img src={edit.imageUrl} alt={edit.prompt} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-zinc-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                          <p className="text-xs text-zinc-300 text-center line-clamp-2 mb-2">{edit.prompt}</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={async () => {
                                try {
                                  setStatus('Loading...');
                                  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(edit.imageUrl)}`;
                                  const response = await fetch(proxyUrl);
                                  if (!response.ok) throw new Error('Failed to fetch from proxy');
                                  const blob = await response.blob();
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const dataUrl = reader.result as string;
                                    const img = new Image();
                                    img.onload = () => {
                                      setImage(img);
                                      resizeCanvas(img);
                                      clearMask();
                                      setStatus('Loaded from Gallery');
                                      setImageHistory({ past: [], present: dataUrl, future: [] });
                                      setShowGallery(false);
                                    };
                                    img.src = dataUrl;
                                  };
                                  reader.readAsDataURL(blob);
                                } catch (error) {
                                  console.error("Error loading image for edit:", error);
                                  setStatus('Error loading image');
                                }
                              }}
                              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                              title="Edit Again"
                            >
                              <PenTool className="w-4 h-4" />
                            </button>
                            <a 
                              href={edit.imageUrl}
                              download={`ai-edit-${edit.id}.png`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Selection Overlay */}
      <AnimatePresence>
        {!hasApiKey && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-xl rounded-2xl md:rounded-3xl"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold text-zinc-100">High-Quality Generation</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  To use the Nano Banana 2 model for 4K image generation, you need to select a paid Google Cloud API key.
                </p>
              </div>
              <div className="pt-4 space-y-4">
                <button
                  onClick={handleSelectKey}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                  Select API Key
                </button>
                <p className="text-xs text-zinc-500">
                  Need a key? Check the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">billing documentation</a>.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
