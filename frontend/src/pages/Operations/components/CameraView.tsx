// Camera view component for barcode scanning
interface CameraViewProps {
  isNative: boolean;
  cameraActive: boolean;
}

export function CameraView({ isNative, cameraActive }: CameraViewProps) {
  if (!cameraActive) return null;

  if (isNative) {
    return (
      <div className="px-4 pb-4">
        <div className="bg-slate-900 rounded-xl py-8 px-4 text-center text-white">
          <div className="w-20 h-20 mx-auto mb-4 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="m-0 text-[0.9375rem] opacity-80">Barkod tarayın</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <div id="qr-reader" className="rounded-xl overflow-hidden [&_video]:rounded-xl"></div>
    </div>
  );
}
