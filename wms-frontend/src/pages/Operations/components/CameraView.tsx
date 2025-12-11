// Camera view component for barcode scanning
interface CameraViewProps {
  isNative: boolean;
  cameraActive: boolean;
}

export function CameraView({ isNative, cameraActive }: CameraViewProps) {
  if (!cameraActive) return null;

  if (isNative) {
    return (
      <div className="camera-section">
        <div className="native-scanning">
          <div className="scanning-animation"></div>
          <p>Barkod tarayın</p>
        </div>
      </div>
    );
  }

  return (
    <div className="camera-section">
      <div id="qr-reader" className="qr-reader"></div>
    </div>
  );
}
