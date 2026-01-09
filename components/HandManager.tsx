import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { HandResults } from '../types';

interface HandManagerProps {
  onHandsDetected: (results: HandResults) => void;
  showCamera: boolean;
}

const HandManager: React.FC<HandManagerProps> = ({ onHandsDetected, showCamera }) => {
  const webcamRef = useRef<Webcam>(null);
  const [cameraLoaded, setCameraLoaded] = useState(false);

  useEffect(() => {
    let camera: any = null;
    let hands: any = null;

    const loadMediaPipe = async () => {
      // Wait for scripts to load if not already available
      if (!(window as any).Hands) {
        console.warn("MediaPipe Hands not loaded yet, retrying...");
        setTimeout(loadMediaPipe, 500);
        return;
      }

      hands = new (window as any).Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results: any) => {
        onHandsDetected(results);
      });

      if (webcamRef.current && webcamRef.current.video) {
        camera = new (window as any).Camera(webcamRef.current.video, {
          onFrame: async () => {
            if (webcamRef.current?.video && hands) {
              await hands.send({ image: webcamRef.current.video });
            }
          },
          width: 640,
          height: 480,
        });
        camera.start();
        setCameraLoaded(true);
      }
    };

    loadMediaPipe();

    return () => {
      if (camera) camera.stop();
      if (hands) hands.close();
    };
  }, [onHandsDetected]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-lg overflow-hidden border-2 border-yellow-500 shadow-xl transition-opacity duration-300 ${showCamera ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
       <Webcam
        ref={webcamRef}
        audio={false}
        mirrored={true}
        width={240}
        height={180}
        className="object-cover"
      />
      <div className="absolute top-0 left-0 bg-black/50 text-white text-xs px-2 py-1">
        {cameraLoaded ? 'Hand Tracking Active' : 'Loading Vision...'}
      </div>
    </div>
  );
};

export default HandManager;
