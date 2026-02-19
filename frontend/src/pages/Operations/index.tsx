// Operations page - main orchestrator
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, reportApi } from '../../lib/api';
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

import '../Operations.css';

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
    async (scannedBarcode: string, _source: 'hid' | 'camera' = 'hid') => {
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
            handleProductScan(scanResult.product!, scanResult.inventory, scanResult.serial, currentWorkflow);
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
        // Show all active operation modes (IN, OUT, TRANSFER, COUNT)
        setAvailableModes(response.data);
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
      const currentWorkflow = workflowRef.current;
      if (currentWorkflow.items.length > 0) {
        createContainer(code === 'ACTION-NEW-BOX' ? 'BOX' : 'PALLET');
        return;
      }
      startContainerMode(code === 'ACTION-NEW-BOX' ? 'BOX' : 'PALLET');
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

  const handleProductScan = (product: Product, inventory: Inventory | Inventory[] | undefined, serial: { serial_no: string; full_barcode: string; status: string } | undefined, currentWorkflow: WorkflowState) => {
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

      const scannedBarcode = serial?.full_barcode || product.barcode || product.sku_code;

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

  const createContainer = async (containerType: 'BOX' | 'PALLET') => {
    const currentWorkflow = workflowRef.current;

    if (currentWorkflow.items.length === 0) {
      setError(t.errorScanProductFirst);
      return;
    }

    setLoading(true);
    setError(null);

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

      const response = await apiClient.createContainer({
        container_type: containerType,
        warehouse_code: currentWarehouse,
        location_qr: currentWorkflow.location?.qr_code,
        contents,
        created_by: currentUser,
      });

      if (response.success && response.data) {
        playScanSound.success();
        const containerLabel = containerType === 'BOX' ? t.box : t.pallet;
        setSuccess(`✓ ${containerLabel} ${t.successContainerCreated}: ${response.data.barcode}`);
        setLastAction(`📦 ${containerLabel}: ${response.data.barcode}`);
        if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
        setWorkflow((prev) => ({ ...prev, items: [] }));
      } else {
        playScanSound.error();
        setError(response.message || t.errorContainerCreateFailed);
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
        processScan(barcode, 'hid');
        setBarcode('');
      }
    }
  };

  const handleManualLocationSubmit = () => {
    if (!manualLocationInput.trim()) return;
    const locationCode = manualLocationInput.trim().toUpperCase();
    const searchCode =
      locationCode.startsWith('LOC-') || locationCode.startsWith('L-') ? locationCode : `LOC-${locationCode}`;
    processScan(searchCode, 'hid');
    setManualLocationInput('');
  };

  const handleManualSkuSubmit = () => {
    if (!manualSkuInput.trim()) return;
    processScan(manualSkuInput.trim(), 'hid');
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
    <div className="operations-page">
      <div className="operations-card">
        {/* Header */}
        <div className="operations-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            ←
          </button>
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
        <StatusBar workflow={workflow} language={language} translations={{ items: t.items }} />

        {/* Instruction */}
        <div className="scan-instruction">{getInstruction()}</div>

        {/* Last Action */}
        {lastAction && <div className="last-action">{lastAction}</div>}

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
            <button onClick={resetWorkflow} className="cancel-step-btn" disabled={loading}>
              ✕ {t.cancel}
            </button>
          </div>
        )}

        {/* Manual SKU Input (LOCATION_SET or SCANNING state) */}
        {(workflow.step === 'LOCATION_SET' || workflow.step === 'SCANNING') && (workflow.location || containerMode) && (
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
                <button onClick={handleManualSkuSubmit} className="submit-btn" disabled={loading || !manualSkuInput.trim()}>
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
          <button onClick={toggleCamera} className={`action-btn camera ${cameraActive ? 'active' : ''}`} disabled={loading}>
            {cameraActive ? `📷 ${t.closeCamera}` : `📷 ${t.camera}`}
          </button>

          {workflow.items.length > 0 && (
            <>
              <button onClick={completeTransaction} className="action-btn complete" disabled={loading}>
                ✓ {t.complete}
              </button>
              <button onClick={resetWorkflow} className="action-btn cancel" disabled={loading}>
                ✕ {t.cancel}
              </button>
            </>
          )}

          <button onClick={() => setShowHelp(!showHelp)} className="action-btn help">
            ❓
          </button>
        </div>

        {/* Box/Pallet Creation Buttons */}
        {workflow.items.length > 0 && containerMode && (
          <div className="container-actions">
            <button onClick={() => createContainer(containerMode)} className={`container-btn ${containerMode.toLowerCase()}`} disabled={loading}>
              {containerMode === 'BOX' ? '📦' : '📋'} {containerMode === 'BOX' ? t.newBox : t.newPallet} Oluştur
            </button>
          </div>
        )}

        {/* Camera View */}
        <CameraView isNative={isNative} cameraActive={cameraActive} />

        {/* Loading */}
        {loading && <div className="scan-loading">⏳</div>}

        {/* Messages */}
        {error && <div className="scan-error">{error}</div>}
        {success && <div className="scan-success">{success}</div>}

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
