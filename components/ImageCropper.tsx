'use client';
import { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  src: string;
  aspectRatio: 'circle' | 'rect';
  onCrop: (croppedBase64: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ src, aspectRatio, onCrop, onCancel }: ImageCropperProps) {
  const [zoom, setZoom] = useState(1.2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const vpWidth = aspectRatio === 'circle' ? 240 : 320;
  const vpHeight = aspectRatio === 'circle' ? 240 : 160;

  const targetWidth = aspectRatio === 'circle' ? 256 : 300;
  const targetHeight = aspectRatio === 'circle' ? 256 : 150;

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleConfirm = () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Centering calculations
      ctx.translate(canvas.width / 2, canvas.height / 2);

      const ratio = canvas.width / vpWidth;
      ctx.translate(pan.x * ratio, pan.y * ratio);

      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      let renderWidth = imgWidth;
      let renderHeight = imgHeight;
      const vpRatio = vpWidth / vpHeight;
      const imgRatio = imgWidth / imgHeight;

      if (imgRatio > vpRatio) {
        renderWidth = vpWidth;
        renderHeight = vpWidth / imgRatio;
      } else {
        renderHeight = vpHeight;
        renderWidth = vpHeight * imgRatio;
      }

      const finalRenderWidth = renderWidth * ratio * zoom;
      const finalRenderHeight = renderHeight * ratio * zoom;

      ctx.drawImage(
        img,
        -finalRenderWidth / 2,
        -finalRenderHeight / 2,
        finalRenderWidth,
        finalRenderHeight
      );

      const base64 = canvas.toDataURL('image/jpeg', 0.9);
      onCrop(base64);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal modal-md" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div className="modal-header">
          <h2 className="modal-title">Ajustar Imagem</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Arraste a imagem para reposicionar e use a barra de rolagem para ajustar o zoom.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div
            style={{
              position: 'relative',
              width: vpWidth,
              height: vpHeight,
              overflow: 'hidden',
              borderRadius: aspectRatio === 'circle' ? '50%' : '8px',
              border: '2px solid var(--accent)',
              cursor: 'move',
              userSelect: 'none',
              background: '#0d1117',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              ref={imageRef}
              src={src}
              alt="Preview para ajuste"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: '100%',
                maxHeight: '100%',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ padding: '0 10px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div className="form-actions" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ minWidth: 100 }}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} style={{ minWidth: 100 }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
