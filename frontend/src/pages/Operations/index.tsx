// Operations page - main orchestrator
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, reportApi, containerApi } from '../../lib/api';
import { catalogApi } from '../../lib/api/catalog';
import { useStore } from '../../stores/appStore';
import { translations } from '../../i18n/translations';
import type { ScanResponse, OperationMode, Product, Location, Container, Inventory } from '../../types';
import { useSSOStore } from '../../stores/ssoStore';

// Local imports
import { playScanSound } from './utils/audio';
import { getModeDisplayName, DEBOUNCE_MODE_LOCATION, DEBOUNCE_PRODUCT, DEBOUNCE_DEFAULT, SCAN_COOLDOWN_MS } from './utils/helpers';
import { useWorkflow } from './hooks/useWorkflow';
import { useCountMode } from './hooks/useCountMode';
import { useScanner } from './hooks/useScanner';
import type { WorkflowState, CountItem } from './types';

// Components
import { StatusBar, ModeSelector, ItemsList, CountModeView, CountSummaryModal, HelpPanel, CameraView } from './components';

// Tailwind utility classes used inline — no CSS import needed

function Operations() {
  const navigate = useNavigate();
  const { currentWarehouse, setLastScannedBarcode, language } = useStore();
  const { wmsUser: user } = useSSOStore();
  const currentUser = user?.username || 'system';
  const t = translations[language];

  // Available modes
  const [availableModes, setAvailableModes] = useState<OperationMode[]>([]);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Backend health
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'failed'>('checking');

  // UI state
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [containerMode, setContainerMode] = useState<'BOX' | 'PALLET' | null>(null);

  // Manual input state
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [manualSkuInput, setManualSkuInput] = useState('');

  // Zone suggestion (FACTORY + IN-RECEIVING)
  const [zoneSuggestion, setZoneSuggestion] = useState<{ zone: string | null; category: string | null } | null>(null);

  // Container name modal
  const [containerNameModal, setContainerNameModal] = useState<{ show: boolean; type: 'BOX' | 'PALLET' | null; displayName: string }>({ show: false, type: null, displayName: '' });

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });
  const scanCooldownRef = useRef(false);

  // Custom hooks
  const { workflow, workflowRef, setWorkflow, addItem, removeItem, reset: resetWorkflowState } = useWorkflow();
  const {
    countState,
    startCountMode,
    setLocationItems,
    incrementExpectedItem,
    incrementUnexpectedItem,
    addUnexpectedItem,
    saveLocationCount,
    showSummary,
    hideSummary,
    reset: resetCountState,
    isAlreadyScanned,
    findExpectedItem,
    findUnexpectedItem,
  } = useCountMode();

  // Process scan callback (declared before useScanner)
  const processScan = useCallback(
    async (scannedBarcode: string) => {
      if (!scannedBarcode.trim()) return;

      if (isProcessingRef.current || scanCooldownRef.current) {
        console.log('Skipping scan:', scannedBarcode);
        return;
      }

      // Debounce check
      const now = Date.now();
      if (scannedBarcode === lastScanRef.current.barcode) {
        let debounceTime = DEBOUNCE_DEFAULT;
        if (
          scannedBarcode.startsWith('MODE-') ||
          scannedBarcode.startsWith('ACTION-') ||
          scannedBarcode.startsWith('LOC-') ||
          scannedBarcode.startsWith('L-')
        ) {
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
      setTimeout(() => {
        scanCooldownRef.current = false;
      }, SCAN_COOLDOWN_MS);

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
            handleProductScan(scanResult.product!, scanResult.inventory, scanResult.serial, currentWorkflow, scanResult.in_container);
            break;
          case 'CONTAINER':
            handleContainerScan(scanResult.container!, scanResult.contents || [], currentWorkflow);
            break;
          default:
            setError(t.errorUnknownBarcode);
        }
      } catch (err: unknown) {
        playScanSound.error();
        const errorObj = err as { error?: string; message?: string };
        setError(errorObj.error || errorObj.message || t.errorScanFailed);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } finally {
        setLoading(false);
        isProcessingRef.current = false;
      }
    },
    [currentWarehouse, currentUser, setLastScannedBarcode, t, workflowRef]
  );

  // Scanner hook
  const { cameraActive, isNative, toggleCamera, stopCamera } = useScanner({
    onScan: processScan,
    onError: setError,
    translations: {
      errorCameraPermissionDenied: t.errorCameraPermissionDenied,
      errorCameraStartFailed: t.errorCameraStartFailed,
      errorCameraOpenFailed: t.errorCameraOpenFailed,
    },
  });

  // Load modes and check health on mount
  useEffect(() => {
    loadModes();
    checkBackendHealth();
  }, []);

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
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const checkBackendHealth = async () => {
    try {
      const response = await apiClient.health();
      setBackendStatus(response?.success ? 'connected' : 'failed');
    } catch {
      setBackendStatus('failed');
    }
  };

  const loadModes = async () => {
    try {
      const response = await apiClient.getAllOperationModes();
      if (response.success) {
        // Filter out ACTION-* codes — those are barcode-triggered actions, not selectable modes
        setAvailableModes(response.data.filter((m: OperationMode) => !m.mode_code.startsWith('ACTION-')));
      }
    } catch (err) {
      console.error('Failed to load modes:', err);
    }
  };

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
      const type = code === 'ACTION-NEW-BOX' ? 'BOX' : 'PALLET';
      const currentWorkflow = workflowRef.current;
      if (currentWorkflow.items.length > 0) {
        setContainerNameModal({ show: true, type, displayName: '' });
        return;
      }
      startContainerMode(type);
      return;
    }

    // Regular MODE - check if workflow is in progress
    const currentWorkflow = workflowRef.current;
    if (currentWorkflow.items.length > 0 || currentWorkflow.location || countState.completedLocations.length > 0) {
      playScanSound.error();
      setError(
        language === 'tr' ? `Süreç devam ediyor. Önce tamamla veya iptal et.` : `Workflow in progress. Complete or cancel first.`
      );
      return;
    }

    playScanSound.mode();

    // Check if it's COUNT mode
    if (code === 'MODE-COUNT-CYCLE') {
      setWorkflow({ step: 'MODE_SELECTED', mode, location: null, items: [] });
      startCountMode();
      setLastAction(`📋 ${t.countMode}`);
      setSuccess(`→ ${t.countScanLocation}`);
      lastScanRef.current = { barcode: '', time: 0 };
      return;
    }

    setWorkflow({ step: 'MODE_SELECTED', mode, location: null, items: [] });
    setLastAction(getModeDisplayName(code, language));
    setSuccess(`→ ${t.successScanLocation}`);
    lastScanRef.current = { barcode: '', time: 0 };
  };

  const handleLocationScan = async (location: Location, currentWorkflow: WorkflowState) => {
    const latestWorkflow = workflowRef.current;
    if (!currentWorkflow.mode && !latestWorkflow.mode) {
      playScanSound.error();
      setError(t.errorSelectModeFirst);
      return;
    }

    playScanSound.location();
    setWorkflow((prev) => ({ ...prev, location, step: 'LOCATION_SET' }));
    setLastAction(`📍 ${location.location_code}`);
    setZoneSuggestion(null);
    lastScanRef.current = { barcode: '', time: 0 };

    // If count mode, fetch location inventory
    const activeMode = latestWorkflow.mode || currentWorkflow.mode;
    if (activeMode?.mode_code === 'MODE-COUNT-CYCLE' && countState.isActive) {
      try {
        const response = await apiClient.getLocationInventory(location.location_id);
        if (response.success && response.data) {
          const inventoryItems = response.data as Array<{ sku_code: string; product_name?: string; quantity_each?: number }>;
          const countItems: CountItem[] = inventoryItems.map((inv) => ({
            sku_code: inv.sku_code,
            product_name: inv.product_name || inv.sku_code,
            expected_quantity: inv.quantity_each || 0,
            counted_quantity: 0,
            variance: -(inv.quantity_each || 0),
            scanned_barcodes: [],
          }));
          setLocationItems(countItems);
          const expectedTotal = countItems.reduce((sum, item) => sum + item.expected_quantity, 0);
          setSuccess(`📋 ${expectedTotal} ${t.items} ${language === 'tr' ? 'bekleniyor - ürün tarayın' : 'expected - scan products'}`);
        } else {
          setLocationItems([]);
          setSuccess(language === 'tr' ? 'Boş lokasyon - ürün tarayabilirsiniz' : 'Empty location - you can scan products');
        }
      } catch (err) {
        console.error('Failed to fetch location inventory:', err);
        setLocationItems([]);
        setSuccess(`→ ${t.successScanProduct}`);
      }
    } else {
      setSuccess(`→ ${t.successScanProduct}`);
    }
  };

  const handleProductScan = (product: Product, inventory: Inventory | Inventory[] | undefined, serial: { serial_no: string; full_barcode: string; status: string } | undefined, currentWorkflow: WorkflowState, inContainer?: { container_id: number; barcode: string; display_name?: string; container_type: string } | null) => {
    const latestWorkflow = workflowRef.current;
    if (!currentWorkflow.mode && !latestWorkflow.mode) {
      playScanSound.error();
      setError(t.errorSelectModeFirst);
      return;
    }

    const activeWorkflow = latestWorkflow.mode ? latestWorkflow : currentWorkflow;
    const activeMode = activeWorkflow.mode;

    // COUNT MODE
    if (activeMode?.mode_code === 'MODE-COUNT-CYCLE' && countState.isActive) {
      if (!currentWorkflow.location && !latestWorkflow.location) {
        playScanSound.error();
        setError(t.errorScanLocationFirst);
        return;
      }

      const scannedBarcode = serial?.full_barcode || product.sku_code;

      if (isAlreadyScanned(scannedBarcode)) {
        playScanSound.error();
        setError(language === 'tr' ? 'Bu barkod zaten sayıldı!' : 'This barcode already counted!');
        return;
      }

      playScanSound.product();

      const existingItem = findExpectedItem(product.sku_code);

      if (existingItem) {
        incrementExpectedItem(product.sku_code, scannedBarcode);
        const newCount = existingItem.counted_quantity + 1;
        const serialInfo = serial?.serial_no ? ` (${serial.serial_no})` : '';
        setLastAction(`+1 ${product.product_name}${serialInfo}`);
        setSuccess(`${newCount}/${existingItem.expected_quantity} ${product.sku_code}`);
      } else {
        const existingUnexpected = findUnexpectedItem(product.sku_code);

        if (existingUnexpected) {
          incrementUnexpectedItem(product.sku_code, scannedBarcode);
          const newCount = existingUnexpected.counted_quantity + 1;
          setLastAction(`+1 ${product.product_name} ⚠️`);
          setSuccess(`${language === 'tr' ? 'Beklenmeyen' : 'Unexpected'}: ${newCount}x ${product.sku_code}`);
        } else {
          const newUnexpectedItem: CountItem = {
            sku_code: product.sku_code,
            product_name: product.product_name,
            expected_quantity: 0,
            counted_quantity: 1,
            variance: 1,
            scanned_barcodes: [scannedBarcode],
          };
          addUnexpectedItem(newUnexpectedItem);
          const serialInfo = serial?.serial_no ? ` (${serial.serial_no})` : '';
          setLastAction(`+1 ${product.product_name}${serialInfo} ⚠️`);
          setSuccess(`${language === 'tr' ? 'Beklenmeyen ürün!' : 'Unexpected product!'} ${product.sku_code}`);
        }
      }
      return;
    }

    // REGULAR MODES
    const isContainerMode = activeMode?.mode_type === 'CONTAINER';
    if (!isContainerMode && !currentWorkflow.location && !latestWorkflow.location) {
      playScanSound.error();
      setError(t.errorScanLocationFirst);
      return;
    }

    // FACTORY + IN-RECEIVING: seri numarası zorunlu
    if (activeMode?.mode_code === 'MODE-IN-RECEIVING' && currentWarehouse === 'FACTORY') {
      if (!serial) {
        playScanSound.error();
        setError(language === 'tr'
          ? `Seri numarası zorunlu — ${product.sku_code}-SERINOSU formatında okutun`
          : `Serial number required — scan ${product.sku_code}-SERIALNO format`);
        return;
      }
      // Zone suggestion — fire and forget
      catalogApi.getCategoryZone(product.sku_code, 'FACTORY')
        .then((res: { success: boolean; data?: { category: string | null; suggested_zone: string | null } }) => {
          if (res.success && res.data) {
            setZoneSuggestion({ zone: res.data.suggested_zone, category: res.data.category });
          }
        })
        .catch(() => { /* ignore */ });
    }

    // Stock check for picking
    if (activeMode?.mode_type === 'PICKING') {
      const singleInventory = Array.isArray(inventory) ? inventory[0] : inventory;
      const currentStock = singleInventory?.quantity_each || 0;
      const alreadyPicked = activeWorkflow.items.filter((i) => i.product.sku_code === product.sku_code).length;
      if (alreadyPicked >= currentStock) {
        playScanSound.error();
        setError(`${t.errorInsufficientStock} (${currentStock} ${t.errorStockAvailable})`);
        return;
      }
    }

    // Check if serial barcode already scanned
    if (serial?.full_barcode) {
      const alreadyScanned = activeWorkflow.items.some((i) => i.serial?.full_barcode === serial.full_barcode);
      if (alreadyScanned) {
        playScanSound.error();
        setError(t.errorSerialAlreadyScanned);
        return;
      }
    }

    playScanSound.product();

    if (currentWorkflow.step !== 'SCANNING') {
      setWorkflow((prev) => ({ ...prev, step: 'SCANNING' }));
    }

    addItem({ product, serial });
    const serialInfo = serial?.full_barcode ? ` (${serial.serial_no})` : '';
    setLastAction(`+1 ${product.product_name}${serialInfo}`);
    setSuccess(`${t.successAdded}: ${product.sku_code}`);

    // Container kırma otomasyonu: ürün bir container içindeyse otomatik dağıt
    if (inContainer) {
      containerApi.breakByProduct(inContainer.container_id, product.sku_code)
        .then((res) => {
          if (res.success) {
            const ctrName = inContainer.display_name || inContainer.barcode;
            const msg = language === 'tr'
              ? `📦 ${ctrName} dağıtıldı — ${res.data.remaining_items} ürün stoka alındı`
              : `📦 ${ctrName} broken — ${res.data.remaining_items} items moved to stock`;
            setSuccess(msg);
            setLastAction(msg);
          }
        })
        .catch(() => { /* container break failed silently — product already added */ });
    }
  };

  const handleContainerScan = (container: Container, contents: Array<{ sku_code: string; product_name?: string; product_barcode?: string; quantity: number }>, currentWorkflow: WorkflowState) => {
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
      setWorkflow((prev) => ({ ...prev, step: 'SCANNING' }));
    }

    let addedCount = 0;
    contents.forEach((item) => {
      const product: Product = {
        id: item.sku_code,
        sku_code: item.sku_code,
        product_name: item.product_name || item.sku_code,
      };

      for (let i = 0; i < item.quantity; i++) {
        addItem({ product, fromContainer: container.barcode });
        addedCount++;
      }
    });

    const containerType = container.container_type === 'BOX' ? t.box : t.pallet;
    setLastAction(`📦 ${containerType} ${t.successContainerOpened}`);
    setSuccess(`${contents.length} ${t.successProductsAdded}, ${addedCount} ${t.items}`);
  };

  // ============ TRANSACTION & CONTAINER ============

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

      const itemMap = new Map<string, number>();
      currentWorkflow.items.forEach((item) => {
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
    } catch (err: unknown) {
      playScanSound.error();
      setError((err as { error?: string }).error || t.errorTransactionError);
    } finally {
      setLoading(false);
    }
  };

  const createContainer = async (containerType: 'BOX' | 'PALLET', displayName: string) => {
    const currentWorkflow = workflowRef.current;

    if (currentWorkflow.items.length === 0) {
      setError(t.errorScanProductFirst);
      return;
    }

    setLoading(true);
    setError(null);
    setContainerNameModal({ show: false, type: null, displayName: '' });

    try {
      const itemMap = new Map<string, number>();
      currentWorkflow.items.forEach((item) => {
        const count = itemMap.get(item.product.sku_code) || 0;
        itemMap.set(item.product.sku_code, count + 1);
      });

      const contents = Array.from(itemMap.entries()).map(([sku_code, quantity]) => ({
        sku_code,
        quantity,
      }));

      const response = await containerApi.create({
        container_type: containerType,
        warehouse_code: currentWarehouse,
        location_qr: currentWorkflow.location?.qr_code,
        items: contents,
        created_by: currentUser,
        display_name: displayName || undefined,
      });

      if (response.success && response.data) {
        playScanSound.success();
        const containerLabel = containerType === 'BOX' ? t.box : t.pallet;
        const label = displayName ? `${displayName} (${response.data.barcode})` : response.data.barcode;
        setSuccess(`✓ ${containerLabel} ${t.successContainerCreated}: ${label}`);
        setLastAction(`📦 ${containerLabel}: ${label}`);
        if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
        setWorkflow((prev) => ({ ...prev, items: [] }));
      } else {
        playScanSound.error();
        setError((response as { message?: string }).message || t.errorContainerCreateFailed);
      }
    } catch (err: unknown) {
      playScanSound.error();
      setError((err as { error?: string }).error || t.errorContainerCreateFailed);
    } finally {
      setLoading(false);
    }
  };

  const resetWorkflow = () => {
    resetWorkflowState();
    setContainerMode(null);
    setLastAction(null);
    setBarcode('');
    setManualLocationInput('');
    setManualSkuInput('');
    setZoneSuggestion(null);
    setContainerNameModal({ show: false, type: null, displayName: '' });
    lastScanRef.current = { barcode: '', time: 0 };
    resetCountState();
  };

  // ============ COUNT MODE FUNCTIONS ============

  const handleSaveCurrentLocationCount = () => {
    const currentLocation = workflow.location;
    if (!currentLocation) return;

    playScanSound.success();
    saveLocationCount(currentLocation);
    setWorkflow((prev) => ({ ...prev, location: null, step: 'MODE_SELECTED' }));
    setSuccess(`✓ ${t.countSaved} - ${currentLocation.location_code}`);
    setLastAction(`📍 ${currentLocation.location_code} ✓`);
  };

  const completeCount = async () => {
    try {
      setLoading(true);

      const warehouseResponse = await apiClient.getWarehouseByCode(currentWarehouse);
      const warehouseId = warehouseResponse?.data?.warehouse_id;

      if (!warehouseId) {
        setError('Depo bilgisi alınamadı');
        playScanSound.error();
        return;
      }

      const locationsData = countState.completedLocations.map((loc) => ({
        location: {
          location_id: loc.location?.location_id,
          location_code: loc.location?.location_code || loc.location?.qr_code || 'Unknown',
          qr_code: loc.location?.qr_code,
        },
        items: loc.items.map((item) => ({
          sku_code: item.sku_code,
          product_name: item.product_name,
          expected_quantity: item.expected_quantity,
          counted_quantity: item.counted_quantity,
          variance: item.variance,
          scanned_barcodes: item.scanned_barcodes || [],
        })),
        unexpectedItems: (loc.unexpectedItems || []).map((item) => ({
          sku_code: item.sku_code,
          product_name: item.product_name,
          expected_quantity: item.expected_quantity,
          counted_quantity: item.counted_quantity,
          variance: item.variance,
          scanned_barcodes: item.scanned_barcodes || [],
        })),
        totalExpected: loc.totalExpected,
        totalCounted: loc.totalCounted,
        totalVariance: loc.totalVariance,
      }));

      const response = await reportApi.saveCountReport({
        warehouse_id: warehouseId,
        warehouse_code: currentWarehouse,
        locations: locationsData,
      });

      if (response.success) {
        playScanSound.success();
        setSuccess(`${t.countCompleted} - Rapor No: ${response.data?.report_number || ''}`);
        setTimeout(() => resetWorkflow(), 2000);
      } else {
        throw new Error(response.error || 'Rapor kaydedilemedi');
      }
    } catch (err: unknown) {
      console.error('Save count report error:', err);
      playScanSound.error();
      setError(err instanceof Error ? err.message : 'Rapor kaydedilirken hata oluştu');
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
    const virtualMode: OperationMode = {
      mode_id: -1,
      mode_code: type === 'BOX' ? 'CONTAINER-BOX' : 'CONTAINER-PALLET',
      mode_name: type === 'BOX' ? `${t.box} ${t.createContainer}` : `${t.pallet} ${t.createContainer}`,
      mode_type: 'CONTAINER',
      workflow_steps: ['SCAN_PRODUCTS'],
      is_active: true,
    };
    setWorkflow({ step: 'SCANNING', mode: virtualMode, location: null, items: [] });
    const label = type === 'BOX' ? `📦 ${t.newBox}` : `📋 ${t.newPallet}`;
    setLastAction(label);
    setSuccess(`→ ${t.successScanProduct}`);
  };

  // ============ INPUT HANDLERS ============

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcode.trim()) {
        processScan(barcode);
        setBarcode('');
      }
    }
  };

  const handleManualLocationSubmit = () => {
    if (!manualLocationInput.trim()) return;
    const locationCode = manualLocationInput.trim().toUpperCase();
    const searchCode =
      locationCode.startsWith('LOC-') || locationCode.startsWith('L-') ? locationCode : `LOC-${locationCode}`;
    processScan(searchCode);
    setManualLocationInput('');
  };

  const handleManualSkuSubmit = () => {
    if (!manualSkuInput.trim()) return;
    processScan(manualSkuInput.trim());
    setManualSkuInput('');
  };

  // ============ UI HELPERS ============

  const getInstruction = (): string => {
    if (countState.isActive) {
      if (!workflow.location) {
        return `📍 ${t.countScanLocation}`;
      }
      if (countState.currentLocationItems.length > 0) {
        return `📋 ${t.countEnterQuantity}`;
      }
      return `📦 ${t.scanProduct}`;
    }

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
    <div className="min-h-[calc(100vh-120px)] bg-slate-50 p-4">
      <div className="max-w-[800px] mx-auto bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center duration-200 hover:bg-white/30" onClick={() => navigate('/')}>
            ←
          </button>
          <h2 className="m-0 text-xl font-bold text-white flex-1">{t.operations}</h2>
          <div className="flex items-center gap-3">
            <span
              className={`cursor-pointer text-sm duration-150 hover:scale-[1.2] ${backendStatus === 'checking' ? 'animate-pulse' : ''}`}
              onClick={checkBackendHealth}
              title={backendStatus === 'connected' ? t.backendConnected : backendStatus === 'failed' ? t.backendFailed : t.loading}
            >
              {backendStatus === 'checking' ? '⏳' : backendStatus === 'connected' ? '🟢' : '🔴'}
            </span>
            <div className="py-2 px-3 bg-white/20 text-white rounded-lg font-semibold text-sm">{currentWarehouse}</div>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar workflow={workflow} language={language} translations={{ items: t.items }} />

        {/* Instruction */}
        <div className="text-center px-4 pt-6 pb-3 text-base text-slate-600 font-medium">{getInstruction()}</div>

        {/* Last Action */}
        {lastAction && <div className="text-center px-4 pb-4 text-lg text-slate-800 font-semibold">{lastAction}</div>}

        {/* Mode Selection Buttons (IDLE state) */}
        {workflow.step === 'IDLE' && (
          <ModeSelector
            availableModes={availableModes}
            onSelectMode={selectMode}
            onStartContainerMode={startContainerMode}
            language={language}
            translations={{
              createContainer: t.createContainer,
              newBox: t.newBox,
              newPallet: t.newPallet,
            }}
          />
        )}

        {/* Manual Location Input (MODE_SELECTED state) */}
        {workflow.step === 'MODE_SELECTED' && !workflow.location && (
          <div className="p-4 bg-slate-100 border-b border-slate-200">
            <div className="mb-3">
              <label className="block text-[0.8125rem] font-semibold text-slate-600 mb-2">📍 {t.locationCode}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualLocationInput}
                  onChange={(e) => setManualLocationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLocationSubmit()}
                  placeholder={t.enterLocationCode || 'Lokasyon kodu girin...'}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg text-[0.9375rem] duration-150 focus:outline-none focus:border-primary-400 focus:ring-[3px] focus:ring-primary-100 placeholder:text-slate-400"
                  disabled={loading}
                />
                <button
                  onClick={handleManualLocationSubmit}
                  className="px-4 py-3 bg-success-500 text-white border-none rounded-lg text-[0.9375rem] font-semibold cursor-pointer duration-150 whitespace-nowrap hover:not-disabled:bg-success-600 hover:not-disabled:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !manualLocationInput.trim()}
                >
                  {t.confirm || 'Tamam'}
                </button>
              </div>
            </div>
            <button onClick={resetWorkflow} className="w-full py-3 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-sm font-semibold cursor-pointer duration-150 mt-2 hover:not-disabled:bg-error-50 hover:not-disabled:text-error-600 hover:not-disabled:border-error-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
              ✕ {t.cancel}
            </button>
          </div>
        )}

        {/* Manual SKU Input (LOCATION_SET or SCANNING state) */}
        {(workflow.step === 'LOCATION_SET' || workflow.step === 'SCANNING') && (workflow.location || containerMode) && (
          <div className="p-4 bg-slate-100 border-b border-slate-200">
            <div className="mb-3">
              <label className="block text-[0.8125rem] font-semibold text-slate-600 mb-2">📦 {t.skuOrBarcode || 'SKU / Barkod'}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualSkuInput}
                  onChange={(e) => setManualSkuInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSkuSubmit()}
                  placeholder={t.enterSkuCode || 'SKU veya barkod girin...'}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg text-[0.9375rem] duration-150 focus:outline-none focus:border-primary-400 focus:ring-[3px] focus:ring-primary-100 placeholder:text-slate-400"
                  disabled={loading}
                />
                <button onClick={handleManualSkuSubmit} className="px-4 py-3 bg-success-500 text-white border-none rounded-lg text-[0.9375rem] font-semibold cursor-pointer duration-150 whitespace-nowrap hover:not-disabled:bg-success-600 hover:not-disabled:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading || !manualSkuInput.trim()}>
                  + {t.add || 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HID Input */}
        {!cameraActive && !showModeSelector && !showHelp && (
          <div className="px-4 pb-4 pt-2">
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Barkod tarayın..."
              className="w-full px-4 py-3 text-base border-2 border-slate-300 rounded-xl text-center font-mono bg-slate-100 duration-150 box-border focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-[4px] focus:ring-primary-100"
              disabled={loading}
              autoFocus
              autoComplete="off"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 px-4 pb-4 flex-wrap">
          <button onClick={toggleCamera} className={`flex-1 min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${cameraActive ? 'bg-error-500 text-white hover:bg-error-600' : 'bg-primary-500 text-white hover:bg-primary-600'}`} disabled={loading}>
            {cameraActive ? `📷 ${t.closeCamera}` : `📷 ${t.camera}`}
          </button>

          {workflow.items.length > 0 && (
            <>
              <button onClick={completeTransaction} className="flex-1 min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-success-500 text-white hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
                ✓ {t.complete}
              </button>
              <button onClick={resetWorkflow} className="flex-[0.5] min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-slate-500 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
                ✕ {t.cancel}
              </button>
            </>
          )}

          <button onClick={() => setShowHelp(!showHelp)} className="flex-none min-w-0 p-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-600">
            ❓
          </button>
        </div>

        {/* Box/Pallet Creation Buttons */}
        {workflow.items.length > 0 && containerMode && (
          <div className="flex gap-3 px-4 pb-4">
            <button
              onClick={() => setContainerNameModal({ show: true, type: containerMode, displayName: '' })}
              className={`flex-1 py-3 px-4 border-2 border-dashed rounded-xl font-semibold text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-2 bg-white disabled:opacity-50 disabled:cursor-not-allowed ${containerMode === 'BOX' ? 'border-warning-500 text-warning-700 hover:bg-warning-50 hover:border-solid' : 'border-info-500 text-info-700 hover:bg-info-50 hover:border-solid'}`}
              disabled={loading}
            >
              {containerMode === 'BOX' ? '📦' : '📋'} {containerMode === 'BOX' ? t.newBox : t.newPallet} Oluştur
            </button>
          </div>
        )}

        {/* Zone Suggestion Banner (FACTORY + IN-RECEIVING) */}
        {zoneSuggestion && zoneSuggestion.zone && (
          <div className="my-2 mx-4 py-2.5 px-3.5 bg-warning-100 border border-warning-500 rounded-lg flex items-center gap-2 text-sm">
            <span>🗂️</span>
            <span>
              <strong>{language === 'tr' ? 'Önerilen Zone:' : 'Suggested Zone:'}</strong> {zoneSuggestion.zone}
              {zoneSuggestion.category && zoneSuggestion.category !== zoneSuggestion.zone && (
                <span className="text-slate-500 ml-1.5">({zoneSuggestion.category})</span>
              )}
            </span>
            <button
              onClick={() => setZoneSuggestion(null)}
              className="ml-auto bg-transparent border-none cursor-pointer text-base leading-none"
            >×</button>
          </div>
        )}

        {/* Container Name Modal */}
        {containerNameModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
            <div className="bg-white rounded-xl p-6 w-80 max-w-[90vw]">
              <h3 className="m-0 mb-4 text-base">
                {containerNameModal.type === 'BOX' ? '📦' : '📋'}{' '}
                {language === 'tr'
                  ? `${containerNameModal.type === 'BOX' ? 'Koli' : 'Palet'} İsmi`
                  : `${containerNameModal.type === 'BOX' ? 'Box' : 'Pallet'} Name`}
              </h3>
              <input
                type="text"
                autoFocus
                value={containerNameModal.displayName}
                onChange={(e) => setContainerNameModal((prev) => ({ ...prev, displayName: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && containerNameModal.displayName.trim() && containerNameModal.type) {
                    createContainer(containerNameModal.type, containerNameModal.displayName.trim());
                  }
                }}
                placeholder={language === 'tr' ? 'ör. FBA-BOX-01, TR-AMBALAJ-MART' : 'e.g. FBA-BOX-01, TR-MARCH'}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm box-border mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (containerNameModal.displayName.trim() && containerNameModal.type) {
                      createContainer(containerNameModal.type, containerNameModal.displayName.trim());
                    }
                  }}
                  disabled={!containerNameModal.displayName.trim() || loading}
                  className="flex-1 p-2.5 bg-primary-600 text-white border-none rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {language === 'tr' ? 'Oluştur' : 'Create'}
                </button>
                <button
                  onClick={() => setContainerNameModal({ show: false, type: null, displayName: '' })}
                  className="flex-1 p-2.5 bg-slate-100 text-slate-700 border-none rounded-lg font-semibold cursor-pointer"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera View */}
        <CameraView isNative={isNative} cameraActive={cameraActive} />

        {/* Loading */}
        {loading && <div className="text-center p-4 text-2xl animate-pulse">⏳</div>}

        {/* Messages */}
        {error && <div className="mx-4 mb-4 p-3 bg-error-50 text-error-600 rounded-lg text-center font-medium border border-error-200">{error}</div>}
        {success && <div className="mx-4 mb-4 p-3 bg-success-50 text-success-600 rounded-lg text-center font-medium border border-success-200">{success}</div>}

        {/* Count Mode View */}
        <CountModeView
          countState={countState}
          location={workflow.location}
          language={language}
          loading={loading}
          onSaveLocation={handleSaveCurrentLocationCount}
          onShowSummary={showSummary}
          onCancel={resetWorkflow}
          translations={{
            countSaveLocation: t.countSaveLocation,
            cancel: t.cancel,
            countTotalLocations: t.countTotalLocations,
            countSummary: t.countSummary,
          }}
        />

        {/* Count Summary Modal */}
        <CountSummaryModal
          countState={countState}
          loading={loading}
          onComplete={completeCount}
          onContinue={hideSummary}
          onCancel={resetWorkflow}
          translations={{
            countSummary: t.countSummary,
            countTotalLocations: t.countTotalLocations,
            countTotalProducts: t.countTotalProducts,
            countTotalVariance: t.countTotalVariance,
            countLocationVariances: t.countLocationVariances,
            countNoVariance: t.countNoVariance,
            countComplete: t.countComplete,
            countNextLocation: t.countNextLocation,
            cancel: t.cancel,
          }}
        />

        {/* Items List */}
        <ItemsList
          items={workflow.items}
          onRemoveItem={removeItem}
          translations={{
            scannedProducts: t.scannedProducts,
            items: t.items,
            scanCompleteOrCancel: t.scanCompleteOrCancel,
          }}
        />

        {/* Help Panel */}
        <HelpPanel show={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    </div>
  );
}

export default Operations;
