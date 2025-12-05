import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { apiClient } from '../lib/api';
import { useStore } from '../store/useStore';
import { translations } from '../i18n/translations';
import type { ScanResponse, OperationMode, Product, Location, Container } from '../types';
import './Operations.css';

const isNative = Capacitor.isNativePlatform();

// Audio feedback
const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  if (!audioContext) return;
  try {
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {}
};

const playScanSound = {
  mode: () => { playTone(440, 0.1); setTimeout(() => playTone(880, 0.15), 100); },
  location: () => { playTone(660, 0.08); setTimeout(() => playTone(660, 0.08), 100); setTimeout(() => playTone(880, 0.12), 200); },
  product: () => { playTone(1000, 0.1); },
  success: () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 80); setTimeout(() => playTone(784, 0.2), 160); },
  error: () => { playTone(300, 0.15, 'square'); setTimeout(() => playTone(200, 0.2, 'square'), 150); },
};

// Workflow types
type WorkflowStep = 'IDLE' | 'MODE_SELECTED' | 'LOCATION_SET' | 'SCANNING';

interface ScannedItem {
  product: Product;
  serial?: { serial_no: string; full_barcode: string; status: string };
  fromContainer?: string;
}

interface WorkflowState {
  step: WorkflowStep;
  mode: OperationMode | null;
  location: Location | null;
  items: ScannedItem[];
}

const getModeColor = (code: string): string => {
  const colors: Record<string, string> = {
    'MODE-IN-RECEIVING': '#10b981',
    'MODE-OUT-PICKING': '#f59e0b',
    'MODE-MOVE-TRANSFER': '#3b82f6',
    'MODE-COUNT-CYCLE': '#8b5cf6',
    'CONTAINER-BOX': '#d97706',
    'CONTAINER-PALLET': '#7c3aed',
  };
  return colors[code] || '#6b7280';
};

const getModeDisplayName = (code: string, lang: 'tr' | 'en'): string => {
  const t = translations[lang];
  const names: Record<string, string> = {
    'MODE-IN-RECEIVING': `📥 ${t.receiving}`,
    'MODE-OUT-PICKING': `📤 ${t.picking}`,
    'MODE-MOVE-TRANSFER': `🔄 ${t.transfer}`,
    'MODE-COUNT-CYCLE': `📋 ${t.count}`,
    'CONTAINER-BOX': `📦 ${t.newBox}`,
    'CONTAINER-PALLET': `📋 ${t.newPallet}`,
  };
  return names[code] || code;
};

function Operations() {
  const { currentWarehouse, currentUser, setLastScannedBarcode, language } = useStore();
  const t = translations[language];

  // Available modes
  const [availableModes, setAvailableModes] = useState<OperationMode[]>([]);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Backend health
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'failed'>('checking');

  // Workflow state
  const [workflow, setWorkflow] = useState<WorkflowState>({
    step: 'IDLE',
    mode: null,
    location: null,
    items: [],
  });

  // UI state
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [containerMode, setContainerMode] = useState<'BOX' | 'PALLET' | null>(null);

  // Manual input state
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [manualSkuInput, setManualSkuInput] = useState('');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const listenerRef = useRef<any>(null);
  const workflowRef = useRef(workflow);
  const isProcessingRef = useRef(false);
  const scannerActiveRef = useRef(false);
  const scannerReadyRef = useRef(false);
  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });
  const scanCooldownRef = useRef(false);

  // Constants
  const DEBOUNCE_MODE_LOCATION = 3000;
  const DEBOUNCE_PRODUCT = 800;
  const DEBOUNCE_DEFAULT = 1500;
  const SCAN_COOLDOWN_MS = 500;
  const SCANNER_STARTUP_DELAY = 1000;
  const MAX_RETRY = 3;
  const scannerRetryCount = useRef(0);

  // Load modes and check health on mount
  useEffect(() => {
    loadModes();
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await apiClient.health();
      setBackendStatus(response?.success ? 'connected' : 'failed');
    } catch {
      setBackendStatus('failed');
    }
  };

  // Update workflow ref
  useEffect(() => {
    workflowRef.current = workflow;
  }, [workflow]);

  // Auto-focus input
  useEffect(() => {
    if (!cameraActive && !loading && !showModeSelector && !showHelp) {
      inputRef.current?.focus();
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [workflow.step, cameraActive, loading, success, error, workflow.items.length, showModeSelector, showHelp]);

  // Clear messages
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => { setSuccess(null); setError(null); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Cleanup
  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  const loadModes = async () => {
    try {
      const response = await apiClient.getAllOperationModes();
      if (response.success) {
        setAvailableModes(response.data.filter((m: OperationMode) => m.mode_code.startsWith('MODE-')));
      }
    } catch (err) {
      console.error('Failed to load modes:', err);
    }
  };

  const totalItems = workflow.items.length;

  // ============ CORE SCAN PROCESSING ============

  const processScan = useCallback(async (scannedBarcode: string, _source: 'hid' | 'camera' = 'hid') => {
    if (!scannedBarcode.trim()) return;

    if (isProcessingRef.current || scanCooldownRef.current) {
      console.log('Skipping scan:', scannedBarcode);
      return;
    }

    // Debounce check
    const now = Date.now();
    if (scannedBarcode === lastScanRef.current.barcode) {
      let debounceTime = DEBOUNCE_DEFAULT;
      if (scannedBarcode.startsWith('MODE-') || scannedBarcode.startsWith('ACTION-') || scannedBarcode.startsWith('LOC-') || scannedBarcode.startsWith('L-')) {
        debounceTime = DEBOUNCE_MODE_LOCATION;
      } else {
        const currentStep = workflowRef.current.step;
        if (currentStep === 'SCANNING' || currentStep === 'LOCATION_SET') {
          debounceTime = DEBOUNCE_PRODUCT;
        }
      }
      if (now - lastScanRef.current.time < debounceTime) {
        console.log(`Debounced (${debounceTime}ms):`, scannedBarcode);
        return;
      }
    }

    lastScanRef.current = { barcode: scannedBarcode, time: now };
    scanCooldownRef.current = true;
    setTimeout(() => { scanCooldownRef.current = false; }, SCAN_COOLDOWN_MS);

    isProcessingRef.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setLastScannedBarcode(scannedBarcode);

    try {
      const response = await apiClient.scan({
        barcode: scannedBarcode,
        warehouse_code: currentWarehouse,
        user: currentUser,
      });

      if (!response.success || !response.data) {
        playScanSound.error();
        setError(`${t.errorNotFound}: ${scannedBarcode}`);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }

      const scanResult = response.data as ScanResponse;
      if (navigator.vibrate) navigator.vibrate(100);
      const currentWorkflow = workflowRef.current;

      switch (scanResult.type) {
        case 'OPERATION_MODE':
          handleOperationModeScan(scanResult.operationMode!);
          break;
        case 'LOCATION':
          handleLocationScan(scanResult.location!, currentWorkflow);
          break;
        case 'PRODUCT':
          handleProductScan(scanResult.product!, scanResult.inventory, scanResult.serial, currentWorkflow);
          break;
        case 'CONTAINER':
          handleContainerScan(scanResult.container!, scanResult.contents || [], currentWorkflow);
          break;
        default:
          setError(t.errorUnknownBarcode);
      }
    } catch (err: any) {
      playScanSound.error();
      setError(err.error || err.message || t.errorScanFailed);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  }, [currentWarehouse, currentUser, setLastScannedBarcode]);

  // ============ SCAN HANDLERS ============

  const handleOperationModeScan = (mode: OperationMode) => {
    const code = mode.mode_code;

    if (code === 'ACTION-COMPLETE') {
      if (workflowRef.current.items.length > 0) {
        stopCamera();
        completeTransaction();
      } else {
        setError(t.errorNoItemsToComplete);
      }
      return;
    }

    if (code === 'ACTION-CANCEL') {
      stopCamera();
      resetWorkflow();
      setLastAction(`✕ ${t.successCancelled}`);
      setSuccess(t.successStartOver);
      return;
    }

    if (code === 'ACTION-NEW-BOX' || code === 'ACTION-NEW-PALLET') {
      const currentWorkflow = workflowRef.current;
      if (currentWorkflow.items.length === 0) {
        setError(t.errorScanProductFirst);
        return;
      }
      if (!currentWorkflow.location) {
        setError(t.errorScanLocationFirst);
        return;
      }
      createContainer(code === 'ACTION-NEW-BOX' ? 'BOX' : 'PALLET');
      return;
    }

    // Regular MODE
    playScanSound.mode();
    setWorkflow({ step: 'MODE_SELECTED', mode, location: null, items: [] });
    setLastAction(getModeDisplayName(code, language));
    setSuccess(`→ ${t.successScanLocation}`);
    lastScanRef.current = { barcode: '', time: 0 };
  };

  const handleLocationScan = (location: Location, currentWorkflow: WorkflowState) => {
    const latestWorkflow = workflowRef.current;
    if (!currentWorkflow.mode && !latestWorkflow.mode) {
      playScanSound.error();
      setError(t.errorSelectModeFirst);
      return;
    }

    playScanSound.location();
    setWorkflow(prev => ({ ...prev, location, step: 'LOCATION_SET' }));
    setLastAction(`📍 ${location.location_code}`);
    setSuccess(`→ ${t.successScanProduct}`);
    lastScanRef.current = { barcode: '', time: 0 };
  };

  const handleProductScan = (product: Product, inventory: any, serial: any, currentWorkflow: WorkflowState) => {
    const latestWorkflow = workflowRef.current;
    if (!currentWorkflow.mode && !latestWorkflow.mode) {
      playScanSound.error();
      setError(t.errorSelectModeFirst);
      return;
    }

    if (!currentWorkflow.location && !latestWorkflow.location) {
      playScanSound.error();
      setError(t.errorScanLocationFirst);
      return;
    }

    const activeWorkflow = latestWorkflow.mode ? latestWorkflow : currentWorkflow;

    // Stock check for picking
    if (activeWorkflow.mode?.mode_type === 'PICKING') {
      const currentStock = inventory?.quantity_each || 0;
      const alreadyPicked = activeWorkflow.items.filter(i => i.product.sku_code === product.sku_code).length;
      if (alreadyPicked >= currentStock) {
        playScanSound.error();
        setError(`${t.errorInsufficientStock} (${currentStock} ${t.errorStockAvailable})`);
        return;
      }
    }

    // Check if serial barcode already scanned
    if (serial?.full_barcode) {
      const alreadyScanned = activeWorkflow.items.some(i => i.serial?.full_barcode === serial.full_barcode);
      if (alreadyScanned) {
        playScanSound.error();
        setError(t.errorSerialAlreadyScanned);
        return;
      }
    }

    playScanSound.product();

    if (currentWorkflow.step !== 'SCANNING') {
      setWorkflow(prev => ({ ...prev, step: 'SCANNING' }));
    }

    // Add product (1 scan = 1 unit)
    addProduct(product, serial);
  };

  const handleContainerScan = (container: Container, contents: any[], currentWorkflow: WorkflowState) => {
    if (!currentWorkflow.mode) {
      playScanSound.error();
      setError(t.errorSelectModeFirst);
      return;
    }

    if (!currentWorkflow.location) {
      playScanSound.error();
      setError(t.errorScanLocationFirst);
      return;
    }

    if (contents.length === 0) {
      playScanSound.error();
      setError(t.errorContainerEmpty);
      return;
    }

    playScanSound.product();

    if (currentWorkflow.step !== 'SCANNING') {
      setWorkflow(prev => ({ ...prev, step: 'SCANNING' }));
    }

    let addedCount = 0;
    contents.forEach((item: any) => {
      const product: Product = {
        sku_code: item.sku_code,
        product_name: item.product_name || item.sku_code,
        barcode: item.product_barcode || item.sku_code,
        base_unit: 'EACH',
        units_per_box: 1,
        boxes_per_pallet: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      for (let i = 0; i < item.quantity; i++) {
        setWorkflow(prev => ({
          ...prev,
          items: [...prev.items, { product, fromContainer: container.barcode }],
        }));
        addedCount++;
      }
    });

    const containerType = container.container_type === 'BOX' ? t.box : t.pallet;
    setLastAction(`📦 ${containerType} ${t.successContainerOpened}`);
    setSuccess(`${contents.length} ${t.successProductsAdded}, ${addedCount} ${t.items}`);
  };

  // ============ PRODUCT & TRANSACTION ============

  const addProduct = (product: Product, serial?: any) => {
    setWorkflow(prev => ({
      ...prev,
      items: [...prev.items, { product, serial }],
    }));

    const serialInfo = serial?.full_barcode ? ` (${serial.serial_no})` : '';
    setLastAction(`+1 ${product.product_name}${serialInfo}`);
    setSuccess(`${t.successAdded}: ${product.sku_code}`);
  };

  const removeItem = (index: number) => {
    setWorkflow(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    setSuccess(t.successItemRemoved);
  };

  const completeTransaction = async () => {
    const currentWorkflow = workflowRef.current;

    if (!currentWorkflow.mode || !currentWorkflow.location || currentWorkflow.items.length === 0) {
      setError(t.errorMissingInfo);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const transactionType = currentWorkflow.mode.mode_type === 'PICKING' ? 'OUT' : 'IN';

      // Group items by SKU and count
      const itemMap = new Map<string, number>();
      currentWorkflow.items.forEach(item => {
        const count = itemMap.get(item.product.sku_code) || 0;
        itemMap.set(item.product.sku_code, count + 1);
      });

      const items = Array.from(itemMap.entries()).map(([sku_code, quantity]) => ({
        sku_code,
        quantity,
        unit_type: 'EACH' as const,
      }));

      const response = await apiClient.createTransaction({
        transaction_type: transactionType,
        warehouse_code: currentWarehouse,
        location_qr: currentWorkflow.location.qr_code,
        items,
        notes: `${currentWorkflow.mode.mode_type} - ${currentWorkflow.location.location_code}`,
        created_by: currentUser,
      });

      if (response.success) {
        playScanSound.success();
        setSuccess(`✓ ${currentWorkflow.items.length} ${t.successItemsSaved}`);
        if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
        setTimeout(() => resetWorkflow(), 2000);
      } else {
        playScanSound.error();
        setError(response.message || t.errorTransactionFailed);
      }
    } catch (err: any) {
      playScanSound.error();
      setError(err.error || t.errorTransactionError);
    } finally {
      setLoading(false);
    }
  };

  const resetWorkflow = () => {
    setWorkflow({ step: 'IDLE', mode: null, location: null, items: [] });
    setContainerMode(null);
    setLastAction(null);
    setBarcode('');
    setManualLocationInput('');
    setManualSkuInput('');
    lastScanRef.current = { barcode: '', time: 0 };
  };

  const createContainer = async (containerType: 'BOX' | 'PALLET') => {
    const currentWorkflow = workflowRef.current;

    if (!currentWorkflow.location || currentWorkflow.items.length === 0) {
      setError(t.errorMissingInfo);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Group items by SKU and count
      const itemMap = new Map<string, number>();
      currentWorkflow.items.forEach(item => {
        const count = itemMap.get(item.product.sku_code) || 0;
        itemMap.set(item.product.sku_code, count + 1);
      });

      const contents = Array.from(itemMap.entries()).map(([sku_code, quantity]) => ({
        sku_code,
        quantity,
      }));

      const response = await apiClient.createContainer({
        container_type: containerType,
        warehouse_code: currentWarehouse,
        location_qr: currentWorkflow.location.qr_code,
        contents,
        created_by: currentUser,
      });

      if (response.success && response.data) {
        playScanSound.success();
        const containerLabel = containerType === 'BOX' ? t.box : t.pallet;
        setSuccess(`✓ ${containerLabel} ${t.successContainerCreated}: ${response.data.barcode}`);
        setLastAction(`📦 ${containerLabel}: ${response.data.barcode}`);
        if (navigator.vibrate) navigator.vibrate([100, 100, 100]);

        // Clear items but keep mode and location for more scanning
        setWorkflow(prev => ({ ...prev, items: [] }));
      } else {
        playScanSound.error();
        setError(response.message || t.errorContainerCreateFailed);
      }
    } catch (err: any) {
      playScanSound.error();
      setError(err.error || t.errorContainerCreateFailed);
    } finally {
      setLoading(false);
    }
  };

  // ============ MANUAL MODE SELECTION ============

  const selectMode = async (mode: OperationMode) => {
    setShowModeSelector(false);
    playScanSound.mode();
    setWorkflow({ step: 'MODE_SELECTED', mode, location: null, items: [] });
    setLastAction(getModeDisplayName(mode.mode_code, language));
    setSuccess(`→ ${t.successScanLocation}`);
  };

  const startContainerMode = (type: 'BOX' | 'PALLET') => {
    playScanSound.mode();
    setContainerMode(type);
    // Create a virtual mode for container creation
    const virtualMode: OperationMode = {
      mode_id: -1,
      mode_code: type === 'BOX' ? 'CONTAINER-BOX' : 'CONTAINER-PALLET',
      mode_name: type === 'BOX' ? `${t.box} ${t.createContainer}` : `${t.pallet} ${t.createContainer}`,
      mode_type: 'RECEIVING',
      workflow_steps: ['SCAN_LOCATION', 'SCAN_PRODUCTS'],
      is_active: true,
    };
    setWorkflow({ step: 'MODE_SELECTED', mode: virtualMode, location: null, items: [] });
    const label = type === 'BOX' ? `📦 ${t.newBox}` : `📋 ${t.newPallet}`;
    setLastAction(label);
    setSuccess(`→ ${t.successScanLocation}`);
  };

  // ============ CAMERA ============

  const startNativeScanner = async () => {
    if (scannerActiveRef.current) return;

    setCameraActive(true);
    scannerReadyRef.current = false;

    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newStatus } = await BarcodeScanner.requestPermissions();
        if (newStatus !== 'granted') {
          setError(t.errorCameraPermissionDenied);
          setCameraActive(false);
          return;
        }
      }

      try {
        await BarcodeScanner.stopScan();
        await BarcodeScanner.removeAllListeners();
      } catch (e) {}

      await BarcodeScanner.addListener('scanError', (event) => {
        console.error('Scanner error:', event);
      });

      listenerRef.current = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
        if (!scannerReadyRef.current) return;

        if (event.barcodes && event.barcodes.length > 0) {
          const barcode = event.barcodes[0].rawValue;
          if (barcode) {
            try {
              await processScan(barcode, 'camera');
              scannerRetryCount.current = 0;
            } catch (err) {
              console.error('Scan error:', err);
            }
          }
        }
      });

      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Ean13, BarcodeFormat.Ean8],
      });

      scannerActiveRef.current = true;
      scannerRetryCount.current = 0;

      setTimeout(() => {
        scannerReadyRef.current = true;
      }, SCANNER_STARTUP_DELAY);

    } catch (err: any) {
      scannerActiveRef.current = false;
      scannerReadyRef.current = false;

      if (scannerRetryCount.current < MAX_RETRY) {
        scannerRetryCount.current++;
        setTimeout(() => startNativeScanner(), 500);
      } else {
        setError(t.errorCameraStartFailed);
        setCameraActive(false);
        scannerRetryCount.current = 0;
      }
    }
  };

  const stopNativeScanner = async () => {
    scannerActiveRef.current = false;
    scannerReadyRef.current = false;
    try { await BarcodeScanner.stopScan(); } catch (err) {}
    try { await BarcodeScanner.removeAllListeners(); } catch (err) {}
    listenerRef.current = null;
    setCameraActive(false);
  };

  const startWebCamera = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { processScan(decodedText, 'camera'); },
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      setError(t.errorCameraOpenFailed);
    }
  };

  const stopCamera = async () => {
    if (isNative) {
      await stopNativeScanner();
    } else if (scannerRef.current && cameraActive) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {}
    }
    setCameraActive(false);
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      await stopCamera();
    } else {
      if (isNative) {
        await startNativeScanner();
      } else {
        await startWebCamera();
      }
    }
  };

  // ============ INPUT HANDLERS ============

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcode.trim()) {
        processScan(barcode, 'hid');
        setBarcode('');
      }
    }
  };

  // Manual location submit
  const handleManualLocationSubmit = () => {
    if (!manualLocationInput.trim()) return;
    // Try with LOC- prefix if not already present
    const locationCode = manualLocationInput.trim().toUpperCase();
    const searchCode = locationCode.startsWith('LOC-') || locationCode.startsWith('L-')
      ? locationCode
      : `LOC-${locationCode}`;
    processScan(searchCode, 'hid');
    setManualLocationInput('');
  };

  // Manual SKU submit
  const handleManualSkuSubmit = () => {
    if (!manualSkuInput.trim()) return;
    processScan(manualSkuInput.trim(), 'hid');
    setManualSkuInput('');
  };

  // ============ UI HELPERS ============

  const getInstruction = (): string => {
    switch (workflow.step) {
      case 'IDLE':
        return t.selectModeOrScan;
      case 'MODE_SELECTED':
        return `📍 ${t.scanLocation}`;
      case 'LOCATION_SET':
      case 'SCANNING':
        return `📦 ${t.scanProduct}`;
      default:
        return t.scanLocation;
    }
  };

  // ============ RENDER ============

  return (
    <div className="operations-page">
      <div className="operations-card">
        {/* Header */}
        <div className="operations-header">
          <h2>{t.operations}</h2>
          <div className="header-right">
            <span
              className={`backend-status ${backendStatus}`}
              onClick={checkBackendHealth}
              title={backendStatus === 'connected' ? t.backendConnected : backendStatus === 'failed' ? t.backendFailed : t.loading}
            >
              {backendStatus === 'checking' ? '⏳' : backendStatus === 'connected' ? '🟢' : '🔴'}
            </span>
            <div className="warehouse-badge">{currentWarehouse}</div>
          </div>
        </div>

        {/* Status Bar */}
        {workflow.mode && (
          <div className="workflow-status" style={{ backgroundColor: getModeColor(workflow.mode.mode_code) }}>
            <div className="status-row">
              <span className="status-mode">{getModeDisplayName(workflow.mode.mode_code, language)}</span>
              {workflow.location && (
                <span className="status-location">📍 {workflow.location.location_code}</span>
              )}
            </div>
            {workflow.items.length > 0 && (
              <div className="status-count">{totalItems} {t.items}</div>
            )}
          </div>
        )}

        {/* Instruction */}
        <div className="scan-instruction">{getInstruction()}</div>

        {/* Last Action */}
        {lastAction && <div className="last-action">{lastAction}</div>}

        {/* Mode Selection Buttons (IDLE state) */}
        {workflow.step === 'IDLE' && (
          <>
            <div className="mode-buttons">
              {availableModes.map(mode => (
                <button
                  key={mode.mode_id}
                  onClick={() => selectMode(mode)}
                  className="mode-btn"
                  style={{ backgroundColor: getModeColor(mode.mode_code) }}
                >
                  {getModeDisplayName(mode.mode_code, language)}
                </button>
              ))}
            </div>
            <div className="container-mode-section">
              <div className="section-label">{t.createContainer}</div>
              <div className="container-mode-buttons">
                <button
                  onClick={() => startContainerMode('BOX')}
                  className="container-mode-btn box"
                >
                  📦 {t.newBox}
                </button>
                <button
                  onClick={() => startContainerMode('PALLET')}
                  className="container-mode-btn pallet"
                >
                  📋 {t.newPallet}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Manual Location Input (MODE_SELECTED state) */}
        {workflow.step === 'MODE_SELECTED' && !workflow.location && (
          <div className="manual-input-section">
            <div className="manual-input-group">
              <label>📍 {t.locationCode}</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={manualLocationInput}
                  onChange={(e) => setManualLocationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLocationSubmit()}
                  placeholder={t.enterLocationCode || 'Lokasyon kodu girin...'}
                  className="manual-input"
                  disabled={loading}
                />
                <button
                  onClick={handleManualLocationSubmit}
                  className="submit-btn"
                  disabled={loading || !manualLocationInput.trim()}
                >
                  {t.confirm || 'Tamam'}
                </button>
              </div>
            </div>
            <button
              onClick={resetWorkflow}
              className="cancel-step-btn"
              disabled={loading}
            >
              ✕ {t.cancel}
            </button>
          </div>
        )}

        {/* Manual SKU Input (LOCATION_SET or SCANNING state) */}
        {(workflow.step === 'LOCATION_SET' || workflow.step === 'SCANNING') && workflow.location && (
          <div className="manual-input-section">
            <div className="manual-input-group">
              <label>📦 {t.skuOrBarcode || 'SKU / Barkod'}</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={manualSkuInput}
                  onChange={(e) => setManualSkuInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSkuSubmit()}
                  placeholder={t.enterSkuCode || 'SKU veya barkod girin...'}
                  className="manual-input"
                  disabled={loading}
                />
                <button
                  onClick={handleManualSkuSubmit}
                  className="submit-btn"
                  disabled={loading || !manualSkuInput.trim()}
                >
                  + {t.add || 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HID Input */}
        {!cameraActive && !showModeSelector && !showHelp && (
          <div className="hid-input-section">
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Barkod tarayın..."
              className="hid-input"
              disabled={loading}
              autoFocus
              autoComplete="off"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            onClick={toggleCamera}
            className={`action-btn camera ${cameraActive ? 'active' : ''}`}
            disabled={loading}
          >
            {cameraActive ? `📷 ${t.closeCamera}` : `📷 ${t.camera}`}
          </button>

          {workflow.items.length > 0 && (
            <>
              <button
                onClick={completeTransaction}
                className="action-btn complete"
                disabled={loading}
              >
                ✓ {t.complete}
              </button>
              <button
                onClick={resetWorkflow}
                className="action-btn cancel"
                disabled={loading}
              >
                ✕ {t.cancel}
              </button>
            </>
          )}

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="action-btn help"
          >
            ❓
          </button>
        </div>

        {/* Box/Pallet Creation Buttons - Show when in container mode and items are scanned */}
        {workflow.items.length > 0 && workflow.location && containerMode && (
          <div className="container-actions">
            <button
              onClick={() => createContainer(containerMode)}
              className={`container-btn ${containerMode.toLowerCase()}`}
              disabled={loading}
            >
              {containerMode === 'BOX' ? '📦' : '📋'} {containerMode === 'BOX' ? t.newBox : t.newPallet} Oluştur
            </button>
          </div>
        )}

        {/* Camera View */}
        {!isNative && cameraActive && (
          <div className="camera-section">
            <div id="qr-reader" className="qr-reader"></div>
          </div>
        )}

        {isNative && cameraActive && (
          <div className="camera-section">
            <div className="native-scanning">
              <div className="scanning-animation"></div>
              <p>Barkod tarayın</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <div className="scan-loading">⏳</div>}

        {/* Messages */}
        {error && <div className="scan-error">{error}</div>}
        {success && <div className="scan-success">{success}</div>}

        {/* Items List */}
        {workflow.items.length > 0 && (
          <div className="items-list">
            <div className="items-header">
              <span>{t.scannedProducts}</span>
              <span className="items-total">{totalItems} {t.items}</span>
            </div>
            {workflow.items.map((item, index) => (
              <div key={index} className={`item-row ${item.fromContainer ? 'container-item' : ''}`}>
                <div className="item-info">
                  <span className="item-name">
                    {item.product.product_name}
                    {item.serial && <span className="serial-badge">{item.serial.serial_no}</span>}
                    {item.fromContainer && <span className="container-badge">📦</span>}
                  </span>
                  <span className="item-sku">{item.product.sku_code}</span>
                </div>
                <button onClick={() => removeItem(index)} className="item-remove">✕</button>
              </div>
            ))}

            <div className="scan-action-hint">
              {t.scanCompleteOrCancel}
            </div>
          </div>
        )}

        {/* Help Panel */}
        {showHelp && (
          <div className="help-panel">
            <h3>📖 Kullanım Kılavuzu</h3>
            <div className="help-content">
              <p><strong>İş Akışı:</strong></p>
              <ol>
                <li>MOD seçin (buton veya barkod)</li>
                <li>LOKASYON tarayın (raf QR)</li>
                <li>ÜRÜN tarayın (her tarama = 1 adet)</li>
                <li>TAMAMLA (buton veya barkod)</li>
              </ol>

              <p><strong>Barkod Formatları:</strong></p>
              <ul>
                <li><code>MODE-IN-RECEIVING</code> - Mal Kabul</li>
                <li><code>MODE-OUT-PICKING</code> - Mal Çıkış</li>
                <li><code>LOC-xxx</code> - Lokasyon</li>
                <li><code>SKU-XXXXXX</code> - Seri Numaralı Ürün</li>
                <li><code>ACTION-COMPLETE</code> - Tamamla</li>
                <li><code>ACTION-CANCEL</code> - İptal</li>
              </ul>

              <p><strong>İpuçları:</strong></p>
              <ul>
                <li>Her ürün barkodu = 1 adet</li>
                <li>Seri numaralı ürünler benzersizdir</li>
                <li>Koli/Palet tarayınca tüm içerik eklenir</li>
              </ul>
            </div>
            <button onClick={() => setShowHelp(false)} className="help-close">Kapat</button>
          </div>
        )}

      </div>
    </div>
  );
}

export default Operations;
