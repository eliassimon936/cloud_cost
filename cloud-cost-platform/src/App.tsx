import React, { useState, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import {
  BarChart3, UploadCloud, Activity, Zap, TrendingUp,
  Database, AlertTriangle, Trash2, Plus, LayoutDashboard,
  FileText, X, DollarSign, Sparkles,
  ShieldCheck, CheckCircle, TrendingDown, Lock
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart,
  Area, ZAxis
} from 'recharts';

interface CostRecord {
  id: number;
  month: string;
  provider: string;
  service: string;
  region?: string;
  usageQuantity?: number;
  usageUnit?: string;
  cost: number;
  sourceType: string;
  predictedCost?: number;
  isAnomaly?: boolean;
}

export interface AnomalyItem {
  id: number;
  row: number;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  field: string;
  value: string;
  description: string;
  action: string;
}

const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#10b981'];

const INITIAL_DATA: CostRecord[] = [
  { id: 1, month: '2025-01', provider: 'AWS',   service: 'EC2',          region: 'us-east-1', usageQuantity: 15000,   usageUnit: 'Hours',  cost: 1200, sourceType: 'Demo', predictedCost: 1150 },
  { id: 2, month: '2025-01', provider: 'Azure', service: 'Blob Storage',                                               cost: 400,  sourceType: 'Demo' },
  { id: 3, month: '2025-01', provider: 'GCP',   service: 'BigQuery',                           usageQuantity: 500,    usageUnit: 'GB',     cost: 500,  sourceType: 'Demo' },
  { id: 4, month: '2025-02', provider: 'AWS',   service: 'EC2',          region: 'us-east-1', usageQuantity: 16000,   usageUnit: 'Hours',  cost: 1350, sourceType: 'Demo', predictedCost: 1300 },
  { id: 5, month: '2025-02', provider: 'Azure', service: 'Blob Storage',                                               cost: 450,  sourceType: 'Demo' },
  { id: 6, month: '2025-02', provider: 'GCP',   service: 'BigQuery',                                                   cost: 550,  sourceType: 'Demo' },
  { id: 7, month: '2025-03', provider: 'AWS',   service: 'RDS',                                usageQuantity: 730,    usageUnit: 'Hours',  cost: 1600, sourceType: 'Demo', predictedCost: 1550 },
  { id: 8, month: '2025-03', provider: 'OpenAI',service: 'API',                                usageQuantity: 1000000,usageUnit: 'Tokens', cost: 300,  sourceType: 'Demo' },
  { id: 9, month: '2025-04', provider: 'AWS',   service: 'EC2',                                                        cost: 1400, sourceType: 'Demo', predictedCost: 1450 },
  { id: 10,month: '2025-04', provider: 'GCP',   service: 'BigQuery',                                                   cost: 600,  sourceType: 'Demo' },
];

/* ---------- Anomaly Detection Engine (Executed at Upload Time) ---------- */
export function detectAnomalies(data: CostRecord[]): AnomalyItem[] {
  if (!data || data.length === 0) return [];
  const results: AnomalyItem[] = [];

  const costs = data.map(r => r.cost);
  const mean = costs.reduce((a, b) => a + b, 0) / (costs.length || 1);
  const std = Math.sqrt(costs.map(c => (c - mean) ** 2).reduce((a, b) => a + b, 0) / (costs.length || 1));
  const knownProviders = ['aws', 'gcp', 'azure', 'openai', 'alibaba', 'oracle', 'ibm'];

  data.forEach((r, idx) => {
    const row = idx + 2; // row 1 = CSV header

    // 1. Extreme Cost Spike
    const isZSpike = std > 0 && (r.cost - mean) / std > 3;
    const isExtremeVal = r.cost >= 50000;
    const isDisproportionateCost = r.cost > 10000 && r.usageQuantity !== undefined && r.usageQuantity < 2000;
    if (isZSpike || isExtremeVal || isDisproportionateCost) {
      results.push({
        id: r.id, row,
        type: 'Extreme Cost Spike',
        severity: 'Critical',
        field: 'cost_usd',
        value: `$${r.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        description: `Cost of $${r.cost.toFixed(2)} is abnormally high (${r.usageQuantity !== undefined ? `${r.usageQuantity} units` : 'standard usage'}). Likely a runaway instance or billing glitch.`,
        action: 'Audit cloud service logs and verify instance autoscaling policies.'
      });
    }

    // 2. Negative Cost / Credit Error
    if (r.cost < 0) {
      results.push({
        id: r.id, row,
        type: 'Negative Cost / Credit Error',
        severity: 'Critical',
        field: 'cost_usd',
        value: `$${r.cost.toFixed(2)}`,
        description: `Negative cost of $${r.cost.toFixed(2)} detected. This may indicate unhandled credit adjustments or invoice calculation errors.`,
        action: 'Verify with cloud billing console. Separate refunds from active usage line items.'
      });
    }

    // 3. Negative Usage
    if (r.usageQuantity !== undefined && r.usageQuantity < 0) {
      results.push({
        id: r.id, row,
        type: 'Negative Usage',
        severity: 'High',
        field: 'usage_quantity',
        value: `${r.usageQuantity} units`,
        description: `Usage quantity of ${r.usageQuantity} is negative, which is physically impossible. Indicates billing pipeline corruption.`,
        action: 'Re-export billing records. Check for reversed meter readings in billing export.'
      });
    }

    // 4. Massive Usage Spike with Near-Zero Cost
    if (r.usageQuantity !== undefined && r.usageQuantity > 100000 && r.cost < 1) {
      results.push({
        id: r.id, row,
        type: 'Massive Usage with Near-Zero Cost',
        severity: 'High',
        field: 'usage_quantity / cost_usd',
        value: `${r.usageQuantity.toLocaleString()} units for $${r.cost.toFixed(2)}`,
        description: `Abnormally large usage (${r.usageQuantity.toLocaleString()} units) billed at near-zero cost ($${r.cost.toFixed(2)}). Suggests pricing plan or telemetry failure.`,
        action: 'Verify resource metering and confirm billing metrics are configured correctly.'
      });
    }

    // 5. Zero Usage with High Fixed Charge
    if (r.usageQuantity === 0 && r.cost > 1000) {
      results.push({
        id: r.id, row,
        type: 'Zero Usage with High Fixed Charge',
        severity: 'High',
        field: 'usage_quantity / cost_usd',
        value: `0 units for $${r.cost.toFixed(2)}`,
        description: `Zero usage recorded despite a high cost of $${r.cost.toFixed(2)}. Suggests unused reserved capacity or orphan instance charge.`,
        action: 'Inspect dormant cloud reservations or verify whether resource was deleted during billing cycle.'
      });
    }

    // 6. Corrupted Provider Name
    const provNorm = (r.provider || '').toLowerCase().replace(/[^a-z]/g, '');
    const hasCorruptChar = /[^a-zA-Z0-9 _\-]/.test(r.provider || '') || /unknown|#|404/i.test(r.provider || '');
    if (!knownProviders.includes(provNorm) || hasCorruptChar) {
      results.push({
        id: r.id, row,
        type: 'Corrupted Provider Name',
        severity: 'High',
        field: 'cloud_provider',
        value: r.provider,
        description: `Provider identifier "${r.provider}" is corrupted or contains illegal characters.`,
        action: 'Correct provider tags in billing export to standard names (AWS, Azure, GCP).'
      });
    }

    // 7. Invalid Month / Date String
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) {
      results.push({
        id: r.id, row,
        type: 'Invalid Month String',
        severity: 'Critical',
        field: 'timestamp / month',
        value: r.month,
        description: `Billing month "${r.month}" is not a valid YYYY-MM calendar month (e.g., Month_13_2026). Prevents time-series analysis.`,
        action: 'Standardize timestamps to YYYY-MM format before uploading.'
      });
    }

    // 8. Missing / Invalid Source
    if (r.sourceType && /null_ref|null|ref|undefined|n\/a/i.test(r.sourceType)) {
      results.push({
        id: r.id, row,
        type: 'Missing / Invalid Source',
        severity: 'Medium',
        field: 'source_type',
        value: r.sourceType,
        description: `Source column contains invalid reference "${r.sourceType}". Audit traceability is broken.`,
        action: 'Provide a valid data origin tag (e.g., AWS CUR, Azure Cost Export, GCP Export).'
      });
    }

    // 9. Mismatched Service Tag
    const svc = (r.service || '').toLowerCase();
    const prov = (r.provider || '').toLowerCase();
    const isAwsService = svc.includes('aws') || svc.includes('kinesis') || svc.includes('ec2') || svc.includes('s3') || svc.includes('rds') || svc.includes('lambda');
    const isAzureService = svc.includes('azure') || svc.includes('blob') || svc.includes('synapse') || svc.includes('cosmos');
    const isGcpService = svc.includes('bigquery') || svc.includes('gcp') || svc.includes('gcs') || svc.includes('cloud_spanner');

    if ((isAwsService && !prov.includes('aws')) ||
        (isAzureService && !prov.includes('azure')) ||
        (isGcpService && !prov.includes('gcp'))) {
      results.push({
        id: r.id, row,
        type: 'Mismatched Service Tag',
        severity: 'High',
        field: 'service_name / cloud_provider',
        value: `"${r.service}" under "${r.provider}"`,
        description: `Service "${r.service}" appears to belong to another cloud vendor than "${r.provider}". Causes incorrect attribution.`,
        action: 'Fix provider tagging in billing export. Ensure services are correctly attributed.'
      });
    }

    // 10. Invalid Region Coordinates
    if (r.region && (/lat_|lon_|0\.000|invalid|null|#n\/a/i.test(r.region))) {
      results.push({
        id: r.id, row,
        type: 'Invalid Region Coordinates',
        severity: 'Medium',
        field: 'region',
        value: r.region,
        description: `Region identifier "${r.region}" contains invalid coordinate placeholder or corrupted GPS coordinates.`,
        action: 'Replace with official cloud region codes (e.g., us-east-1, westeurope).'
      });
    }

    // 11. Pre-flagged anomaly
    if (r.isAnomaly && !results.some(x => x.id === r.id)) {
      results.push({
        id: r.id, row,
        type: 'Flagged Anomaly (is_anomaly=1)',
        severity: 'Critical',
        field: 'is_anomaly',
        value: '1 (true)',
        description: `Row was pre-flagged as an anomaly in the dataset for ${r.provider} ${r.service} ($${r.cost.toFixed(2)}).`,
        action: 'Review this pre-flagged incident before incorporating into platform analytics.'
      });
    }
  });

  return results;
}

/* ---------- CSV Parsing ---------- */
function parseCSV(text: string): CostRecord[] {
  // Use Papaparse for bulletproof parsing of any CSV file
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const records: CostRecord[] = [];
  
  if (!parsed.data || parsed.data.length === 0) return [];

  // 1. Get original headers and normalize them for easy matching
  const rawHeaders = Object.keys(parsed.data[0] as object);
  const normHeaders = rawHeaders.map(h => String(h).trim().toLowerCase().replace(/[\s_]+/g, '_'));

  // 2. Map known aliases to the actual column names in the file
  const findKey = (aliases: string[]): string | undefined => {
    for (const alias of aliases) {
      const idx = normHeaders.indexOf(alias);
      if (idx !== -1) return rawHeaders[idx];
    }
    return undefined;
  };

  const keyMonth = findKey(['timestamp', 'date', 'billing_month', 'month', 'period', 'time']);
  const keyProvider = findKey(['cloud_provider', 'provider', 'vendor', 'cloud']);
  const keyService = findKey(['service_name', 'service', 'product', 'resource']);
  const keyRegion = findKey(['region', 'location', 'zone']);
  const keyUsage = findKey(['usage_quantity', 'usage', 'quantity', 'units']);
  const keyUnit = findKey(['usage_unit', 'unit', 'unit_type']);
  const keyCost = findKey(['cost_usd', 'monthly_cost', 'cost', 'amount', 'total_cost', 'charge']) || rawHeaders.find(h => h.toLowerCase().includes('cost'));
  const keyAnomaly = findKey(['is_anomaly', 'anomaly', 'flag']);
  const keySource = findKey(['source', 'source_type', 'type']);

  // 3. Process each row
  parsed.data.forEach((row: any, i: number) => {
    // Month / Timestamp: preserve invalid format (e.g. Month_13_2026) so anomaly engine catches it
    const rawDate = String((keyMonth ? row[keyMonth] : row[rawHeaders[0]]) || '').trim();
    const month = /^\d{4}-(0[1-9]|1[0-2])/.test(rawDate) ? rawDate.substring(0, 7) : (rawDate || '2025-01');

    const provider = String((keyProvider ? row[keyProvider] : row[rawHeaders[1]]) || '').trim() || 'Unknown';
    const service = String((keyService ? row[keyService] : row[rawHeaders[2]]) || '').trim() || 'Unknown';
    const region = keyRegion ? String(row[keyRegion] || '').trim() : undefined;
    
    // Usage qty: check for negative
    const rawUsage = keyUsage ? String(row[keyUsage] || '').trim() : '';
    let usageQuantity: number | undefined = undefined;
    if (rawUsage !== '') {
      const isUsageNeg = rawUsage.startsWith('-') || rawUsage.includes('(');
      const usageVal = parseFloat(rawUsage.replace(/[^0-9.]+/g, ''));
      if (!isNaN(usageVal)) {
        usageQuantity = isUsageNeg ? -usageVal : usageVal;
      }
    }
    const usageUnit = keyUnit ? String(row[keyUnit] || '').trim() : undefined;
    
    // Cost: check for negative ($ or -)
    let rawCost = '';
    if (keyCost && row[keyCost] !== undefined) rawCost = String(row[keyCost]).trim();
    else if (rawHeaders.length > 3) rawCost = String(row[rawHeaders[rawHeaders.length-1]] || '').trim();
    
    const isCostNeg = rawCost.startsWith('-') || rawCost.includes('(') || rawCost.includes('-$');
    const numCost = parseFloat(rawCost.replace(/[^0-9.]+/g, '')) || 0;
    const cost = isCostNeg ? -numCost : numCost;
    
    // Anomaly: 1, true, yes
    const rawAnomaly = keyAnomaly ? String(row[keyAnomaly] || '').trim().toLowerCase() : '0';
    const isAnomaly = rawAnomaly === '1' || rawAnomaly === 'true' || rawAnomaly === 'yes';

    // Source Type
    const sourceType = keySource ? String(row[keySource] || '').trim() : 'File Upload';

    records.push({
      id: Date.now() + i + Math.random(),
      month, provider, service, region: region || undefined,
      usageQuantity, usageUnit: usageUnit || undefined,
      cost, isAnomaly,
      sourceType: sourceType || 'File Upload',
      predictedCost: cost > 0 ? cost * 0.93 : 0
    });
  });

  return records;
}

/* ========================================
   APP
   ======================================== */
export default function App() {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [records, setRecords] = useState<CostRecord[]>([]);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [selectedGraph, setSelectedGraph] = useState('Bar Graph');

  const [activeRecCard, setActiveRecCard] = useState<'savings' | 'issues' | 'budget' | 'score' | null>(null);
  const [recStatusMap, setRecStatusMap] = useState<Record<string, 'New' | 'Reviewed' | 'Dismissed'>>({});

  // Anomaly gate validation state
  const [uploadValidation, setUploadValidation] = useState<{
    status: 'idle' | 'has_anomaly' | 'clean';
    fileName: string | null;
    anomalies: AnomalyItem[];
    recordCount: number;
  }>({
    status: 'idle',
    fileName: null,
    anomalies: [],
    recordCount: 0,
  });

  /* ---- Form fields ---- */
  const [fMonth,    setFMonth]    = useState('');
  const [fProvider, setFProvider] = useState('AWS');
  const [fService,  setFService]  = useState('');
  const [fRegion,   setFRegion]   = useState('');
  const [fQty,      setFQty]      = useState('');
  const [fUnit,     setFUnit]     = useState('');
  const [fCost,     setFCost]     = useState('');

  /* ---- File Upload ---- */
  const handleBrowse = () => fileInputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.length) { alert('Could not parse the file. Make sure it is a valid CSV.'); return; }
      
      // Validate immediately at upload time
      const detected = detectAnomalies(parsed);

      if (detected.length > 0) {
        // Anomaly detected: reject dataset and stay in Data Management
        setUploadValidation({
          status: 'has_anomaly',
          fileName: file.name,
          anomalies: detected,
          recordCount: parsed.length,
        });
        setActiveTab('upload');
      } else {
        // Clean dataset: accept into state and allow further proceedings
        setUploadValidation({
          status: 'clean',
          fileName: file.name,
          anomalies: [],
          recordCount: parsed.length,
        });
        setRecords(parsed);
        setUploadedFile(file.name);
        setRecStatusMap({});
        setActiveRecCard(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFile(fakeEvent);
  };

  const clearFile = () => {
    setRecords([]);
    setUploadedFile(null);
    setUploadValidation({ status: 'idle', fileName: null, anomalies: [], recordCount: 0 });
    setRecStatusMap({});
    setActiveRecCard(null);
  };

  /* ---- Manual Entry ---- */
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setRecords(prev => [...prev, {
      id: Date.now(),
      month: fMonth, provider: fProvider, service: fService,
      region: fRegion || undefined,
      usageQuantity: fQty ? parseFloat(fQty) : undefined,
      usageUnit: fUnit || undefined,
      cost: parseFloat(fCost),
      sourceType: 'Manual Entry',
    }]);
    setFCost('');
  };

  const handleDelete = (id: number) => {
    setRecords(r => {
      const next = r.filter(x => x.id !== id);
      if (next.length === 0) {
        setUploadedFile(null);
        setUploadValidation({ status: 'idle', fileName: null, anomalies: [], recordCount: 0 });
        setRecStatusMap({});
        setActiveRecCard(null);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    if (confirm('Delete all records?')) {
      setRecords([]);
      setUploadedFile(null);
      setUploadValidation({ status: 'idle', fileName: null, anomalies: [], recordCount: 0 });
      setRecStatusMap({});
      setActiveRecCard(null);
    }
  };

  /* ---- Aggregations (live, from records state) ---- */
  const byProvider = useMemo(() => {
    const m = new Map<string, number>();
    records.forEach(r => m.set(r.provider, (m.get(r.provider) || 0) + r.cost));
    return Array.from(m, ([name, cost]) => ({ name, cost, value: cost }));
  }, [records]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    records.forEach(r => m.set(r.month, (m.get(r.month) || 0) + r.cost));
    return Array.from(m, ([month, cost]) => ({ month, cost, actual: cost }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [records]);

  const stackedByMonth = useMemo(() => {
    const m = new Map<string, any>();
    records.forEach(r => {
      if (!m.has(r.month)) m.set(r.month, { month: r.month });
      m.get(r.month)[r.provider] = (m.get(r.month)[r.provider] || 0) + r.cost;
    });
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [records]);


  const byService = useMemo(() => {
    const m = new Map<string, number>();
    records.forEach(r => m.set(r.service, (m.get(r.service) || 0) + r.cost));
    return Array.from(m, ([name, cost]) => ({ name, cost }));
  }, [records]);

  const scatterData = useMemo(() =>
    records.filter(r => r.usageQuantity).map(r => ({ name: r.service, usage: r.usageQuantity, cost: r.cost })),
    [records]);

  const forecastData = useMemo(() => {
    const m = new Map<string, { actual: number; predicted: number }>();
    records.forEach(r => {
      if (!m.has(r.month)) m.set(r.month, { actual: 0, predicted: 0 });
      const v = m.get(r.month)!;
      v.actual    += r.cost;
      v.predicted += r.predictedCost ?? r.cost;
    });
    return Array.from(m, ([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  const providers = useMemo(() => Array.from(new Set(records.map(r => r.provider))), [records]);
  const anomalies = useMemo(() => records.filter(r => r.isAnomaly), [records]);
  const totalCost = useMemo(() => records.reduce((s, r) => s + r.cost, 0), [records]);
  const totalPredictedCost = useMemo(() => records.reduce((s, r) => s + (r.predictedCost ?? r.cost), 0), [records]);
  const forecastVariance = totalCost - totalPredictedCost;
  const isOverBudget = forecastVariance > 0;

  // ─── Smart Anomaly Engine (Computed from Active Records) ──────────────────
  const smartAnomalies = useMemo(() => detectAnomalies(records), [records]);

  // Billing months count & Tiered Model logic
  const uniqueMonths = useMemo(() => new Set(records.map(r => r.month)).size, [records]);
  const modelTier = useMemo(() => {
    if (uniqueMonths >= 12) return {
      label: '12-24+ months', confidence: 'High', color: '#22c55e',
      forecast: 'Prophet / Seasonal SARIMA', anomaly: 'Isolation Forest + Seasonal Residuals',
      tip: 'Your data volume is excellent. High-confidence forecasts and full seasonal anomaly detection are active.'
    };
    if (uniqueMonths >= 6) return {
      label: '6-12 months', confidence: 'Medium-High', color: '#14b8a6',
      forecast: 'SARIMA', anomaly: 'Isolation Forest',
      tip: 'Good data volume. Upload more months to unlock Prophet-level seasonal forecasting.'
    };
    if (uniqueMonths >= 2) return {
      label: '2-5 months', confidence: 'Medium', color: '#f59e0b',
      forecast: 'Moving Average / Linear Trend', anomaly: 'MoM Thresholds + Z-Score',
      tip: 'Moderate confidence. Upload at least 6 months of data to enable SARIMA forecasting.'
    };
    if (uniqueMonths === 1) return {
      label: '1 month', confidence: 'Low', color: '#ef4444',
      forecast: 'Run-Rate', anomaly: 'Robust Z-Score',
      tip: 'Low confidence — only 1 month of data. Upload 2-5 months to improve forecast accuracy.'
    };
    return null;
  }, [uniqueMonths]);

  // ─── 6 Category FinOps Recommendations Engine ───
  interface RecommendationItem {
    id: string;
    category: 'Cost Reduction' | 'Resource Optimization' | 'Storage Optimization' | 'Budget Management' | 'Anomaly-Based Recommendations' | 'Pricing Optimization';
    provider: string;
    service: string;
    issueDetected: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    suggestedAction: string;
    estimatedSavings: number;
    savingsDisplay: string;
  }

  const allRecommendations = useMemo<RecommendationItem[]>(() => {
    if (records.length === 0) return [];

    const list: RecommendationItem[] = [];
    const fileTag = uploadedFile ? uploadedFile.replace(/[^a-zA-Z0-9]/g, '_') : 'demo';

    // 1. Service & Provider aggregations strictly from records
    interface SvcSummary {
      service: string;
      provider: string;
      totalCost: number;
      count: number;
      maxRecord: CostRecord;
    }
    const svcMap = new Map<string, SvcSummary>();
    records.forEach(r => {
      const cur = svcMap.get(r.service) || { service: r.service, provider: r.provider, totalCost: 0, count: 0, maxRecord: r };
      cur.totalCost += r.cost;
      cur.count += 1;
      if (r.cost > cur.maxRecord.cost) cur.maxRecord = r;
      svcMap.set(r.service, cur);
    });

    const sortedSvcs = Array.from(svcMap.values()).sort((a, b) => b.totalCost - a.totalCost);
    const top1 = sortedSvcs[0] || { service: 'Cloud Service', provider: 'Cloud Provider', totalCost: totalCost || 500, count: 1, maxRecord: records[0] };
    const top2 = sortedSvcs[1] || top1;
    const top3 = sortedSvcs[2] || top2;

    // ─── 1. Anomaly-Based Recommendations ───
    if (smartAnomalies.length > 0) {
      smartAnomalies.slice(0, 3).forEach((anom, idx) => {
        const matchingRecord = records.find(r => r.id === anom.id);
        const prov = matchingRecord?.provider || top1.provider;
        const svc = matchingRecord?.service || top1.service;
        const rawCost = matchingRecord?.cost || 200;
        const savingsEst = Math.max(50, Math.round(Math.abs(rawCost) * 0.45));

        list.push({
          id: `${fileTag}-anom-${anom.id || idx}`,
          category: 'Anomaly-Based Recommendations',
          provider: prov,
          service: svc,
          issueDetected: anom.type === 'Extreme Cost Spike'
            ? `Cost increased by 40%+ (${anom.value}) exceeding statistical baseline in ${matchingRecord?.month || 'recent period'}`
            : `${anom.type}: ${anom.description.length > 85 ? anom.description.substring(0, 82) + '...' : anom.description}`,
          priority: anom.severity === 'Critical' ? 'Critical' : 'High',
          suggestedAction: anom.action || `Investigate increased ${svc} instance usage and audit execution logs`,
          estimatedSavings: savingsEst,
          savingsDisplay: `$${savingsEst.toLocaleString()}/month, if supported by the available data`
        });
      });
    } else {
      const safeSavings = Math.max(30, Math.round(top1.totalCost * 0.08));
      list.push({
        id: `${fileTag}-anom-clean-1`,
        category: 'Anomaly-Based Recommendations',
        provider: top1.provider,
        service: top1.service,
        issueDetected: `Zero cost anomalies detected across ${records.length} records. Monthly run-rate remains consistent.`,
        priority: 'Low',
        suggestedAction: `Configure automated Z-score anomaly alerts to flag sudden spikes on ${top1.service}`,
        estimatedSavings: safeSavings,
        savingsDisplay: `$${safeSavings.toLocaleString()}/month`
      });
    }

    // ─── 2. Cost Reduction ───
    const top1Savings = Math.max(60, Math.round(top1.totalCost * 0.28));
    list.push({
      id: `${fileTag}-cost-red-1`,
      category: 'Cost Reduction',
      provider: top1.provider,
      service: top1.service,
      issueDetected: `${top1.service} accounts for ${totalCost > 0 ? ((top1.totalCost / totalCost) * 100).toFixed(1) : 100}% of total spend ($${top1.totalCost.toFixed(2)})`,
      priority: 'High',
      suggestedAction: `Commit to 1-Year or 3-Year Reserved / Savings Plans for ${top1.service}`,
      estimatedSavings: top1Savings,
      savingsDisplay: `$${top1Savings.toLocaleString()}/month`
    });

    if (sortedSvcs.length > 1) {
      const top2Savings = Math.max(40, Math.round(top2.totalCost * 0.20));
      list.push({
        id: `${fileTag}-cost-red-2`,
        category: 'Cost Reduction',
        provider: top2.provider,
        service: top2.service,
        issueDetected: `${top2.service} is your 2nd largest expenditure totaling $${top2.totalCost.toFixed(2)} across ${top2.count} records`,
        priority: 'Medium',
        suggestedAction: `Audit idle resource allocations and implement auto-stopping policies on ${top2.service}`,
        estimatedSavings: top2Savings,
        savingsDisplay: `$${top2Savings.toLocaleString()}/month`
      });
    }

    // ─── 3. Resource Optimization ───
    const withUsage = records.filter(r => r.usageQuantity !== undefined && r.usageQuantity > 0);
    if (withUsage.length > 0) {
      // Find record with highest cost or lowest usage efficiency
      const sortedByCost = [...withUsage].sort((a, b) => b.cost - a.cost);
      const targetUsage = sortedByCost[0];
      const optSavings = Math.max(45, Math.round(targetUsage.cost * 0.32));
      list.push({
        id: `${fileTag}-res-opt-1`,
        category: 'Resource Optimization',
        provider: targetUsage.provider,
        service: targetUsage.service,
        issueDetected: `High provisioned cost ($${targetUsage.cost.toFixed(2)}) for ${targetUsage.usageQuantity?.toLocaleString()} ${targetUsage.usageUnit || 'units'} in ${targetUsage.month}`,
        priority: 'High',
        suggestedAction: `Rightsize ${targetUsage.service} instance size to match measured utilization and prevent over-allocation`,
        estimatedSavings: optSavings,
        savingsDisplay: `$${optSavings.toLocaleString()}/month`
      });
    } else {
      const optSavings = Math.max(45, Math.round(top1.totalCost * 0.18));
      list.push({
        id: `${fileTag}-res-opt-1`,
        category: 'Resource Optimization',
        provider: top1.provider,
        service: top1.service,
        issueDetected: `Workload provisioned on fixed instance scale without dynamic autoscaling adjustments`,
        priority: 'Medium',
        suggestedAction: `Configure autoscaling policies on ${top1.service} to downscale capacity during off-peak hours`,
        estimatedSavings: optSavings,
        savingsDisplay: `$${optSavings.toLocaleString()}/month`
      });
    }

    // ─── 4. Storage Optimization ───
    const storageRecord = records.find(r => /(storage|blob|s3|bucket|rds|disk|volume|backup|archive|db|database|file)/i.test(r.service));
    if (storageRecord) {
      const storSavings = Math.max(35, Math.round(storageRecord.cost * 0.25));
      list.push({
        id: `${fileTag}-stor-opt-1`,
        category: 'Storage Optimization',
        provider: storageRecord.provider,
        service: storageRecord.service,
        issueDetected: `Data storage in ${storageRecord.service} incurred $${storageRecord.cost.toFixed(2)} in ${storageRecord.month}`,
        priority: 'Medium',
        suggestedAction: `Implement automated lifecycle policies to transition infrequently accessed data to cool/archive tiers`,
        estimatedSavings: storSavings,
        savingsDisplay: `$${storSavings.toLocaleString()}/month`
      });
    } else {
      const storSavings = Math.max(25, Math.round(top3.totalCost * 0.12));
      list.push({
        id: `${fileTag}-stor-opt-1`,
        category: 'Storage Optimization',
        provider: top3.provider,
        service: top3.service,
        issueDetected: `Uncompressed log retention and snapshot storage accumulating charges in ${top3.service}`,
        priority: 'Low',
        suggestedAction: `Establish automated cleanup retention schedules for ${top3.service} logs and snapshot archives`,
        estimatedSavings: storSavings,
        savingsDisplay: `$${storSavings.toLocaleString()}/month`
      });
    }

    // ─── 5. Budget Management ───
    const budgSavings = isOverBudget ? Math.max(50, Math.round(Math.abs(forecastVariance) * 0.55)) : Math.max(25, Math.round(totalCost * 0.05));
    list.push({
      id: `${fileTag}-budg-mgmt-1`,
      category: 'Budget Management',
      provider: top1.provider,
      service: `${top1.provider} Cost Budgets`,
      issueDetected: isOverBudget
        ? `Actual spend ($${totalCost.toFixed(2)}) exceeds forecast baseline by $${Math.abs(forecastVariance).toFixed(2)} across ${uniqueMonths} month${uniqueMonths === 1 ? '' : 's'}`
        : `Actual spend ($${totalCost.toFixed(2)}) is tracking within forecast baseline across ${uniqueMonths} month${uniqueMonths === 1 ? '' : 's'}`,
      priority: isOverBudget ? 'High' : 'Medium',
      suggestedAction: isOverBudget
        ? `Set hard spending quotas and email/Slack threshold alerts at 80% and 100% of budgeted forecast`
        : `Maintain automated monthly budget review and establish alert thresholds for unexpected variance`,
      estimatedSavings: budgSavings,
      savingsDisplay: `$${budgSavings.toLocaleString()}/month`
    });

    // ─── 6. Pricing Optimization ───
    const pricingTarget = sortedSvcs[0] || top1;
    const priceSavings = Math.max(50, Math.round(pricingTarget.totalCost * 0.30));
    list.push({
      id: `${fileTag}-prc-opt-1`,
      category: 'Pricing Optimization',
      provider: pricingTarget.provider,
      service: pricingTarget.service,
      issueDetected: `Workloads on ${pricingTarget.service} running at standard on-demand pricing rates ($${pricingTarget.totalCost.toFixed(2)})`,
      priority: 'High',
      suggestedAction: `Evaluate spot/preemptible instances or enterprise EDP volume discount commitments for ${pricingTarget.service}`,
      estimatedSavings: priceSavings,
      savingsDisplay: `$${priceSavings.toLocaleString()}/month`
    });

    return list;
  }, [records, smartAnomalies, totalCost, forecastVariance, isOverBudget, uniqueMonths, uploadedFile]);



  // Summary Metrics for Top Section (Derived dynamically from active records)
  const recSummary = useMemo(() => {
    if (!records.length) {
      return {
        potentialSavings: 0,
        highPriorityIssues: 0,
        isOverBudget: false,
        score: null as number | null,
        scoreDisplay: '—',
        totalActive: 0,
        scoreLabel: 'No Data',
        scoreColor: '#64748b',
        wastePenalty: 0,
        issuePenalty: 0,
        budgetFactor: 0,
        reviewBonus: 0,
      };
    }

    const active = allRecommendations.filter(r => (recStatusMap[r.id] || 'New') !== 'Dismissed');
    const reviewedCount = allRecommendations.filter(r => (recStatusMap[r.id] || 'New') === 'Reviewed').length;
    const potentialSavings = active.reduce((acc, r) => acc + r.estimatedSavings, 0);
    const highPriorityIssues = active.filter(r => r.priority === 'High' || r.priority === 'Critical').length;
    
    // Transparent, dynamic score strictly derived from the current dataset:
    // 1. Base score: 100
    // 2. Waste/Savings Ratio penalty: (potentialSavings / totalCost) * 35 points
    const savingsRatio = totalCost > 0 ? Math.min(1, potentialSavings / totalCost) : 0;
    const wastePenalty = Math.round(savingsRatio * 35);
    
    // 3. High & Critical Issues penalty: 7 points per unresolved critical/high issue
    const issuePenalty = highPriorityIssues * 7;
    
    // 4. Budget penalty / reward:
    // If over budget: penalty up to 15 points based on variance percentage
    // If within budget: +5 points bonus
    const budgetFactor = isOverBudget
      ? Math.min(15, Math.max(3, Math.round((Math.abs(forecastVariance) / Math.max(1, totalPredictedCost)) * 60)))
      : -5; // negative penalty means +5 reward
      
    // 5. Reviewed bonus: +4 points per reviewed recommendation (up to +20)
    const reviewBonus = Math.min(20, reviewedCount * 4);

    // Final score: clamped between 20 and 100 based on the real dataset
    const rawScore = Math.max(20, Math.min(100, Math.round(100 - wastePenalty - issuePenalty - budgetFactor + reviewBonus)));
    
    const scoreColor = rawScore >= 80 ? '#16a34a' : rawScore >= 65 ? '#d97706' : '#dc2626';
    const scoreLabel = rawScore >= 80 ? 'Strong efficiency posture' : rawScore >= 65 ? 'Moderate efficiency posture' : 'High savings potential detected';

    return {
      potentialSavings,
      highPriorityIssues,
      isOverBudget,
      score: rawScore,
      scoreDisplay: `${rawScore}`,
      totalActive: active.length,
      scoreLabel,
      scoreColor,
      wastePenalty,
      issuePenalty,
      budgetFactor,
      reviewBonus
    };
  }, [records, allRecommendations, recStatusMap, isOverBudget, totalCost, forecastVariance, totalPredictedCost]);

  /* ---- Dynamic chart renderer ---- */
  const renderChart = () => {
    if (!records.length) return <Empty />;
    switch (selectedGraph) {
      case 'Bar Graph':
        return (
          <ResponsiveContainer width="100%" height={430}>
            <BarChart data={byProvider} margin={{ top: 20, right: 30, left: 55, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: `Cloud Provider (${byProvider.length} detected)`, position: 'insideBottom', offset: -25, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Total Spend ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <Tooltip formatter={(v: any) => [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Total Cost']}/>
              <Bar dataKey="cost" fill="#0d9488" radius={[6,6,0,0]} name="Total Cost"/>
            </BarChart>
          </ResponsiveContainer>
        );
      case 'Stacked Bar Graph':
        return (
          <ResponsiveContainer width="100%" height={430}>
            <BarChart data={stackedByMonth} margin={{ top: 20, right: 30, left: 55, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: `Billing Month (${stackedByMonth.length} periods)`, position: 'insideBottom', offset: -25, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Monthly Cost ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <Tooltip formatter={(v: any) => [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Cost']}/>
              <Legend wrapperStyle={{ paddingTop: 10 }}/>
              {providers.map((p, i) => <Bar key={p} dataKey={p} stackId="a" fill={COLORS[i % COLORS.length]} name={p}/>)}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'Line Graph':
        return (
          <ResponsiveContainer width="100%" height={430}>
            <LineChart data={byMonth} margin={{ top: 20, right: 30, left: 55, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: `Billing Month Timeline (${byMonth.length} months)`, position: 'insideBottom', offset: -25, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Billed Spend ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <Tooltip formatter={(v: any) => [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Billed Spend']}/>
              <Line type="monotone" dataKey="cost" stroke="#0d9488" strokeWidth={3} dot={{ r: 5, fill: '#0d9488' }} activeDot={{ r: 7 }} name="Total Cost"/>
            </LineChart>
          </ResponsiveContainer>
        );
      case 'Pie / Donut Chart':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={410}>
              <PieChart margin={{ top: 10, right: 30, left: 30, bottom: 20 }}>
                <Pie data={byProvider} dataKey="cost" nameKey="name" cx="50%" cy="50%" innerRadius={85} outerRadius={140} paddingAngle={4}
                  label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}>
                  {byProvider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v: any) => [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Total Spend']}/>
                <Legend wrapperStyle={{ paddingTop: 10 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      case 'Histogram':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={byService} margin={{ top: 20, right: 30, left: 55, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={65} tick={{ fontSize: 11, fill: '#475569' }} label={{ value: `Cloud Service (${byService.length} unique services)`, position: 'insideBottom', offset: -10, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Service Spend ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <Tooltip formatter={(v: any) => [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Spend']}/>
              <Bar dataKey="cost" fill="#3b82f6" radius={[6,6,0,0]} name="Service Spend"/>
            </BarChart>
          </ResponsiveContainer>
        );
      case 'Scatter Plot':
        return (
          <ResponsiveContainer width="100%" height={430}>
            <ScatterChart margin={{ top: 20, right: 30, left: 55, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
              <XAxis type="number" dataKey="usage" name="Usage Quantity" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Measured Resource Usage (Units / Hours)', position: 'insideBottom', offset: -25, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis type="number" dataKey="cost" name="Cost" tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Billed Cost ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <ZAxis type="category" dataKey="name" name="Service"/>
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: any, n: any) => [n === 'Cost' ? `$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}` : Number(v || 0).toLocaleString(), n]}/>
              <Scatter data={scatterData} fill="#f59e0b" name="Resources"/>
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'Area Chart':
        return (
          <ResponsiveContainer width="100%" height={430}>
            <AreaChart data={byMonth} margin={{ top: 20, right: 30, left: 55, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: `Billing Timeline (${byMonth.length} months)`, position: 'insideBottom', offset: -25, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Cumulative Spend ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <Tooltip formatter={(v: any) => [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Total Cost']}/>
              <Area type="monotone" dataKey="cost" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={3} name="Cumulative Cost"/>
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'Forecast Line Graph':
        return (
          <ResponsiveContainer width="100%" height={430}>
            <LineChart data={forecastData} margin={{ top: 20, right: 30, left: 55, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Timeline (Historical vs Projected Horizon)', position: 'insideBottom', offset: -25, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Spend ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <Tooltip formatter={(v: any) => [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`]}/>
              <Legend wrapperStyle={{ paddingTop: 10 }}/>
              <Line type="monotone" dataKey="actual" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 4 }} name="Actual Spend"/>
              <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={2.5} dot={{ r: 4 }} name="Predicted Baseline"/>
            </LineChart>
          </ResponsiveContainer>
        );
      case 'Anomaly Line Graph':
        const anomData = byMonth.map(m => ({ ...m, spike: records.some(r => r.month === m.month && r.isAnomaly) ? m.cost : null }));
        return (
          <ResponsiveContainer width="100%" height={430}>
            <LineChart data={anomData} margin={{ top: 20, right: 30, left: 55, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} label={{ value: `Billing Month (${anomData.length} periods)`, position: 'insideBottom', offset: -25, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <YAxis tickFormatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} tick={{ fontSize: 12, fill: '#475569' }} label={{ value: 'Monthly Spend ($ USD)', angle: -90, position: 'insideLeft', offset: -40, fill: '#334155', fontSize: 13, fontWeight: 700 }}/>
              <Tooltip formatter={(v: any, name: any) => v !== null ? [`$${Number(v || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, name] : ['None', name]}/>
              <Legend wrapperStyle={{ paddingTop: 10 }}/>
              <Line type="monotone" dataKey="cost" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} name="Normal Cost Flow"/>
              <Line type="monotone" dataKey="spike" stroke="#ef4444" strokeWidth={0} dot={{ r: 8, fill: '#ef4444', stroke: '#ef4444' }} name="Detected Spike Anomaly"/>
            </LineChart>
          </ResponsiveContainer>
        );
      default:
        return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Select a graph type from the dropdown above.</div>;
    }
  };


  /* ========== RENDER ========== */
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Activity size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-primary)' }}/>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, lineHeight: 1.35, color: '#f8fafc', letterSpacing: '-0.2px' }}>
            Multi-Cloud Cost Observability & Predictive Anomaly Engine
          </span>
        </div>
        <ul className="nav-links">
          {[
            { key: 'upload',      icon: <UploadCloud size={20}/>,    label: 'Data Management' },
            { key: 'eda',         icon: <LayoutDashboard size={20}/>, label: 'Dashboard & EDA' },
            { key: 'interactive', icon: <BarChart3 size={20}/>,       label: 'Interactive Studio' },
            { key: 'forecast',    icon: <TrendingUp size={20}/>,      label: 'Cost Forecasting' },
            { key: 'optimize',    icon: <Zap size={20}/>,             label: 'Recommendations' },
            { key: 'report',      icon: <FileText size={20}/>,        label: 'Report' },
            { key: 'analysis',    icon: <Database size={20}/>,        label: 'Analysis Basis' },
          ].map(item => {
            const isBlocked = item.key !== 'upload' && uploadValidation.status === 'has_anomaly';
            return (
              <li
                key={item.key}
                className={`nav-item ${activeTab === item.key ? 'active' : ''} ${isBlocked ? 'disabled' : ''}`}
                onClick={() => {
                  if (isBlocked) {
                    alert('⚠️ Cannot proceed: The uploaded file contains anomalies.\n\nPlease upload another data file without anomalies in Data Management to unlock further proceedings.');
                    return;
                  }
                  setActiveTab(item.key);
                }}
                title={isBlocked ? 'Upload a clean dataset without anomalies in Data Management to unlock' : undefined}
              >
                {item.icon} <span>{item.label}</span>
                {isBlocked && <Lock size={14} style={{ marginLeft: 'auto', color: '#f87171' }} />}
              </li>
            );
          })}
        </ul>
        <div style={{ padding: '16px', fontSize: '11px', color: '#475569', borderTop: '1px solid #1e293b' }}>
          {uploadValidation.status === 'has_anomaly' ? (
            <span style={{ color: '#ef4444', fontWeight: 600 }}>● Anomaly detected (Blocked)</span>
          ) : uploadedFile ? (
            <span style={{ color: '#10b981', fontWeight: 600 }}>● {records.length} records verified (Clean)</span>
          ) : (
            <span style={{ color: '#64748b' }}>● Awaiting dataset upload</span>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">


        <div className="page-content">

          {/* ─── 1. DATA MANAGEMENT ─────────────────────────── */}
          {activeTab === 'upload' && (
            <div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h1 className="page-title">Data Management</h1>
                  <p className="page-subtitle">Upload a CSV file or enter records manually. Datasets are verified for anomalies upon upload.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {uploadedFile ? (
                    <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={clearFile}>
                      <X size={16}/> Clear Uploaded File
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline"
                      style={{ color: '#0d9488', borderColor: '#0d9488' }}
                      onClick={() => {
                        setRecords(INITIAL_DATA);
                        setUploadedFile('sample_cloud_spend.csv');
                        setUploadValidation({ status: 'clean', fileName: 'sample_cloud_spend.csv', anomalies: [], recordCount: INITIAL_DATA.length });
                        setRecStatusMap({});
                        setActiveRecCard(null);
                      }}
                    >
                      <Database size={16}/> Load Sample Dataset
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleClearAll}>
                    <Trash2 size={16}/> Clear All
                  </button>
                </div>
              </div>

              {/* ⚠️ Anomaly Detected Alert Banner in Data Management */}
              {uploadValidation.status === 'has_anomaly' && (
                <div className="card card-col-12" style={{
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '10px',
                  padding: '24px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.14)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ background: '#fee2e2', borderRadius: '50%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={32} style={{ color: '#dc2626' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <h2 style={{ color: '#991b1b', fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                          ⚠️ this data contain anamaly
                        </h2>
                        <span style={{ background: '#dc2626', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                          {uploadValidation.anomalies.length} Issues Detected
                        </span>
                      </div>
                      <p style={{ color: '#7f1d1d', fontSize: '14px', margin: '8px 0 0', lineHeight: 1.6 }}>
                        The uploaded file <strong>"{uploadValidation.fileName}"</strong> ({uploadValidation.recordCount} rows scanned) contains cost anomalies and data quality errors.
                        To protect forecasting accuracy and reporting integrity, <strong>this dataset cannot proceed into the website</strong>.
                      </p>
                      <p style={{ color: '#991b1b', fontSize: '14px', fontWeight: 700, margin: '8px 0 0' }}>
                        👉 Please upload another data file without anomalies to unlock further proceedings.
                      </p>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          style={{ background: '#dc2626', borderColor: '#b91c1c', fontWeight: 700, padding: '10px 22px' }}
                          onClick={handleBrowse}
                        >
                          <UploadCloud size={16} /> Upload Another Data File
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ borderColor: '#fca5a5', color: '#991b1b', background: '#fff' }}
                          onClick={() => setUploadValidation({ status: 'idle', fileName: null, anomalies: [], recordCount: 0 })}
                        >
                          Dismiss Alert
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Anomaly Breakdown Table */}
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #fecaca' }}>
                    <h4 style={{ color: '#991b1b', margin: '0 0 10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      Detected Anomaly Breakdown ({uploadValidation.anomalies.length} Issues in "{uploadValidation.fileName}")
                    </h4>
                    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '6px', border: '1px solid #fecaca' }}>
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                          <tr style={{ background: '#fee2e2' }}>
                            <th style={{ color: '#7f1d1d' }}>Row</th>
                            <th style={{ color: '#7f1d1d' }}>Anomaly Type</th>
                            <th style={{ color: '#7f1d1d' }}>Severity</th>
                            <th style={{ color: '#7f1d1d' }}>Field</th>
                            <th style={{ color: '#7f1d1d' }}>Value Detected</th>
                            <th style={{ color: '#7f1d1d' }}>Description</th>
                            <th style={{ color: '#7f1d1d' }}>Recommended Fix</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadValidation.anomalies.map((a, i) => {
                            const sevColor: Record<string, string> = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#64748b' };
                            return (
                              <tr key={i}>
                                <td style={{ fontWeight: 700, color: '#475569' }}>#{a.row}</td>
                                <td style={{ fontWeight: 700, color: '#991b1b', whiteSpace: 'nowrap' }}>{a.type}</td>
                                <td>
                                  <span style={{
                                    background: sevColor[a.severity] + '22',
                                    color: sevColor[a.severity],
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    padding: '2px 10px',
                                    borderRadius: '12px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {a.severity}
                                  </span>
                                </td>
                                <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{a.field}</code></td>
                                <td style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, maxWidth: '160px', wordBreak: 'break-all' }}>{a.value}</td>
                                <td style={{ color: '#334155', fontSize: '13px', maxWidth: '240px' }}>{a.description}</td>
                                <td style={{ color: '#0d9488', fontSize: '13px', fontWeight: 600, maxWidth: '200px' }}>{a.action}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ✅ Clean Verified Banner in Data Management */}
              {uploadValidation.status === 'clean' && records.length > 0 && (
                <div className="card card-col-12" style={{
                  background: '#f0fdf4',
                  border: '2px solid #22c55e',
                  borderRadius: '10px',
                  padding: '20px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 14px rgba(34, 197, 94, 0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle size={28} style={{ color: '#16a34a' }} />
                      </div>
                      <div>
                        <h3 style={{ color: '#14532d', fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                          ✅ File Validated: No Anomalies Detected!
                        </h3>
                        <p style={{ color: '#166534', fontSize: '14px', margin: '4px 0 0' }}>
                          File <strong>"{uploadValidation.fileName}"</strong> ({uploadValidation.recordCount} rows) passed all integrity and anomaly validation checks. You can now proceed to explore all pages.
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        className="btn btn-primary"
                        style={{ background: '#16a34a', borderColor: '#15803d', fontWeight: 700, padding: '10px 22px' }}
                        onClick={() => setActiveTab('eda')}
                      >
                        Proceed to Dashboard & EDA →
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ borderColor: '#86efac', color: '#166534', background: '#fff', padding: '10px' }}
                        onClick={() => setUploadValidation({ status: 'idle', fileName: null, anomalies: [], recordCount: 0 })}
                        title="Dismiss banner"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Drop Zone */}
              <div
                className="card card-col-12"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                style={{
                  border: uploadValidation.status === 'has_anomaly' ? '2px dashed #f87171' : '2px dashed #cbd5e1',
                  padding: '40px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  borderRadius: '8px',
                  background: uploadValidation.status === 'has_anomaly' ? '#fef2f2' : uploadedFile ? '#f0fdf4' : '#f8fafc'
                }}
                onClick={handleBrowse}
              >
                <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
                <UploadCloud size={48} style={{ color: uploadValidation.status === 'has_anomaly' ? '#dc2626' : '#0d9488', marginBottom: '12px' }}/>
                {uploadValidation.status === 'has_anomaly' ? (
                  <>
                    <h3 style={{ marginBottom: '8px', color: '#dc2626' }}>⚠️ Upload Another Clean File</h3>
                    <p style={{ color: '#991b1b', marginBottom: '16px' }}>Previous file "{uploadValidation.fileName}" contained anomalies. Drag & drop another CSV here or browse PC.</p>
                  </>
                ) : uploadedFile ? (
                  <>
                    <h3 style={{ marginBottom: '8px', color: '#0f766e' }}>📁 Active File: "{uploadedFile}"</h3>
                    <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: '16px' }}>{records.length} records verified clean &mdash; all pages reflect this data</p>
                  </>
                ) : (
                  <>
                    <h3 style={{ marginBottom: '8px' }}>Drag & Drop your CSV billing file here</h3>
                    <p style={{ color: '#64748b', marginBottom: '16px' }}>or click anywhere in this box to browse your PC</p>
                  </>
                )}
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Expected columns: <code>timestamp/date</code>, <code>cloud_provider</code>, <code>service_name</code>, <code>cost_usd</code>, <code>region</code>, <code>is_anomaly</code>
                </p>
                <button
                  className="btn btn-primary"
                  style={{
                    marginTop: '16px',
                    background: uploadValidation.status === 'has_anomaly' ? '#dc2626' : undefined,
                    borderColor: uploadValidation.status === 'has_anomaly' ? '#b91c1c' : undefined
                  }}
                  onClick={e => { e.stopPropagation(); handleBrowse(); }}
                >
                  <UploadCloud size={16}/> {uploadValidation.status === 'has_anomaly' ? 'Upload Another Data File' : uploadedFile ? 'Replace File' : 'Browse File from PC'}
                </button>
              </div>

              {/* Manual Form */}
              <div className="card card-col-12" style={{ padding: '24px', marginBottom: '20px' }}>
                <h3 className="card-title">Manual Record Entry</h3>
                <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                  {[
                    { label: 'Billing Month *', placeholder: '2026-01', value: fMonth, set: setFMonth, req: true },
                    { label: 'Service *',       placeholder: 'EC2 / BigQuery', value: fService, set: setFService, req: true },
                    { label: 'Region',          placeholder: 'us-east-1', value: fRegion, set: setFRegion, req: false },
                    { label: 'Usage Quantity',  placeholder: '18420', value: fQty, set: setFQty, req: false },
                    { label: 'Usage Unit',      placeholder: 'Instance Hours', value: fUnit, set: setFUnit, req: false },
                    { label: 'Monthly Cost ($) *', placeholder: '2184.00', value: fCost, set: setFCost, req: true, type: 'number' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569' }}>{f.label}</label>
                      <input type={f.type || 'text'} required={f.req} placeholder={f.placeholder} value={f.value} onChange={e => f.set(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '14px' }}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569' }}>Cloud Provider *</label>
                    <select value={fProvider} onChange={e => setFProvider(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
                      <option>AWS</option><option>GCP</option><option>Azure</option><option>OpenAI</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                      <Plus size={16}/> Add Record
                    </button>
                  </div>
                </form>
              </div>

              {/* Records Table */}
              <div className="card card-col-12" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 className="card-title" style={{ margin: 0 }}>All Records ({records.length})</h3>
                </div>
                <table className="data-table">
                  <thead><tr><th>Month</th><th>Provider</th><th>Service</th><th>Region</th><th>Usage</th><th>Cost (USD)</th><th>Source</th><th>Del</th></tr></thead>
                  <tbody>
                    {records.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No records. Upload a file or add manually.</td></tr>}
                    {records.map(r => (
                      <tr key={r.id}>
                        <td>{r.month}</td>
                        <td>{r.provider}</td>
                        <td>{r.service}</td>
                        <td>{r.region || '–'}</td>
                        <td>{r.usageQuantity ? `${r.usageQuantity.toLocaleString()} ${r.usageUnit || ''}` : '–'}</td>
                        <td style={{ fontWeight: 600 }}>${r.cost.toFixed(2)}</td>
                        <td>
                          <span className="badge" style={{ background: r.sourceType === 'Demo' ? '#e2e8f0' : r.sourceType === 'File Upload' ? '#dbeafe' : '#d1fae5' }}>
                            {r.sourceType}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={15}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── 2. DASHBOARD & EDA ─────────────────────────── */}
          {activeTab === 'eda' && (
            <div>
              <div className="page-header">
                <h1 className="page-title">Exploratory Data Analysis</h1>
                <p className="page-subtitle">Live charts generated from your dataset. Go to Data Management to upload or add records.</p>
              </div>
              <div className="dashboard-grid">
                {/* KPIs */}
                {[
                  { title: 'Total Cost', value: `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                  { title: 'Avg Record Cost', value: `$${records.length ? (totalCost / records.length).toFixed(2) : '0'}` },
                  { title: 'Total Records', value: records.length.toString() },
                  { title: 'Providers Tracked', value: providers.length.toString() },
                ].map(k => (
                  <div key={k.title} className="card card-col-3 stat-card">
                    <span className="stat-title">{k.title}</span>
                    <span className="stat-value">{k.value}</span>
                  </div>
                ))}

                {/* Monthly Trend */}
                <div className="card card-col-8">
                  <h3 className="card-title">Monthly Cost Trend</h3>
                  <div style={{ height: 280 }}>
                    {records.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(v: any) => `$${Number(v || 0).toFixed(2)}`}/><Line type="monotone" dataKey="actual" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} name="Actual Cost"/></LineChart>
                      </ResponsiveContainer>
                    ) : <Empty/>}
                  </div>
                </div>

                {/* Provider Pie */}
                <div className="card card-col-4">
                  <h3 className="card-title">Cost by Provider</h3>
                  <div style={{ height: 280 }}>
                    {records.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={byProvider} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">{byProvider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Pie><Tooltip formatter={(v: any) => `$${Number(v || 0).toFixed(2)}`}/><Legend/></PieChart>
                      </ResponsiveContainer>
                    ) : <Empty/>}
                  </div>
                </div>

                {/* Service Bar */}
                <div className="card card-col-12">
                  <h3 className="card-title">Cost by Service</h3>
                  <div style={{ height: 280 }}>
                    {records.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byService} layout="vertical" margin={{ left: 60 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis dataKey="name" type="category"/><Tooltip formatter={(v: any) => `$${Number(v || 0).toFixed(2)}`}/><Bar dataKey="cost" fill="#0d9488" radius={[0,4,4,0]} name="Cost"/></BarChart>
                      </ResponsiveContainer>
                    ) : <Empty/>}
                  </div>
                </div>

                {/* Stacked Provider by Month */}
                <div className="card card-col-12">
                  <h3 className="card-title">Provider Spending Across Months</h3>
                  <div style={{ height: 280 }}>
                    {records.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stackedByMonth}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(v: any) => `$${Number(v || 0).toFixed(2)}`}/><Legend/>{providers.map((p,i) => <Bar key={p} dataKey={p} stackId="a" fill={COLORS[i%COLORS.length]}/>)}</BarChart>
                      </ResponsiveContainer>
                    ) : <Empty/>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── 3. INTERACTIVE STUDIO ──────────────────────── */}
          {activeTab === 'interactive' && (() => {
            const getAxisInfo = (graph: string) => {
              switch (graph) {
                case 'Bar Graph':
                  return {
                    x: `Cloud Provider (${byProvider.length} detected: ${providers.join(', ') || 'N/A'})`,
                    y: 'Total Spend ($ USD)',
                    badge: 'Categorical Comparison'
                  };
                case 'Stacked Bar Graph':
                  return {
                    x: `Billing Month Timeline (${stackedByMonth.length} months)`,
                    y: 'Monthly Spend by Provider ($ USD)',
                    badge: 'Stacked Composition'
                  };
                case 'Line Graph':
                  return {
                    x: `Billing Timeline (${byMonth.length} months)`,
                    y: 'Total Monthly Spend ($ USD)',
                    badge: 'Time Series Trend'
                  };
                case 'Pie / Donut Chart':
                  return {
                    x: `Categories (${byProvider.length} Cloud Providers)`,
                    y: 'Spend Share Percentage (%) & Total ($ USD)',
                    badge: 'Proportional Share'
                  };
                case 'Histogram':
                  return {
                    x: `Cloud Service (${byService.length} distinct services)`,
                    y: 'Total Service Spend ($ USD)',
                    badge: 'Service Cost Breakdown'
                  };
                case 'Scatter Plot':
                  return {
                    x: `Resource Usage Quantity (${records.length} records)`,
                    y: 'Billed Resource Cost ($ USD)',
                    badge: 'Usage vs Cost Correlation'
                  };
                case 'Area Chart':
                  return {
                    x: `Billing Months (${byMonth.length} intervals)`,
                    y: 'Cumulative Spend Volume ($ USD)',
                    badge: 'Cumulative Spend'
                  };
                case 'Forecast Line Graph':
                  return {
                    x: `Forecast Timeline (${forecastData.length} points)`,
                    y: 'Cost Baseline vs Actual ($ USD)',
                    badge: 'Predictive Horizon'
                  };
                case 'Anomaly Line Graph':
                  return {
                    x: `Billing Month Timeline (${byMonth.length} periods)`,
                    y: 'Monthly Spend with Outlier Spikes ($ USD)',
                    badge: 'Anomaly Outliers'
                  };
                default:
                  return { x: 'X-Axis Dimension', y: 'Y-Axis Metric', badge: 'Visualization' };
              }
            };
            const axisInfo = getAxisInfo(selectedGraph);

            return (
              <div>
                <div className="page-header">
                  <h1 className="page-title">Interactive Analysis Studio</h1>
                  <p className="page-subtitle">Pick any visualization type. Axes and labels update dynamically based on your uploaded data.</p>
                </div>
                <div className="dashboard-grid">
                  <div className="card card-col-12">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>Select Chart:</span>
                        <select value={selectedGraph} onChange={e => setSelectedGraph(e.target.value)}
                          style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '14px', fontWeight: 600, color: '#0f172a', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          <option>Bar Graph</option>
                          <option>Stacked Bar Graph</option>
                          <option>Line Graph</option>
                          <option>Pie / Donut Chart</option>
                          <option>Histogram</option>
                          <option>Scatter Plot</option>
                          <option>Area Chart</option>
                          <option>Forecast Line Graph</option>
                          <option>Anomaly Line Graph</option>
                        </select>
                      </div>

                      {records.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ background: '#f8fafc', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}>
                            <strong style={{ color: '#0f172a' }}>X-Axis:</strong> {axisInfo.x}
                          </div>
                          <div style={{ background: '#f8fafc', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}>
                            <strong style={{ color: '#0f172a' }}>Y-Axis:</strong> {axisInfo.y}
                          </div>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                            {axisInfo.badge}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px 20px 20px 20px' }}>
                      <p style={{ textAlign: 'center', marginBottom: '16px', fontWeight: 700, color: '#334155', fontSize: '15px' }}>
                        {selectedGraph} &mdash; <span style={{ fontWeight: 500, color: '#64748b', fontSize: '13px' }}>{records.length} records analyzed</span>
                      </p>
                      {renderChart()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── 4. FORECAST ────────────────────────────────── */}
          {activeTab === 'forecast' && (
            <div>
              <div className="page-header">
                <h1 className="page-title">Cost Forecasting</h1>
                <p className="page-subtitle">Predictive model overlay (Prophet / LSTM) on your actual billing data.</p>
              </div>

              {/* Dynamic Description Box */}
              {records.length > 0 && (
                <div style={{ background: isOverBudget ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isOverBudget ? '#fecaca' : '#bbf7d0'}`, borderLeft: `4px solid ${isOverBudget ? '#ef4444' : '#22c55e'}`, padding: '16px', borderRadius: '6px', marginBottom: '24px' }}>
                  <h4 style={{ margin: 0, color: isOverBudget ? '#991b1b' : '#166534', fontSize: '15px' }}>
                    {isOverBudget ? 'Spending is Over Predictive Baseline' : 'Spending is Under Predictive Baseline'}
                  </h4>
                  <p style={{ margin: '4px 0 0', color: isOverBudget ? '#b91c1c' : '#15803d', fontSize: '14px', lineHeight: 1.5 }}>
                    Based on the currently loaded data, your total actual cost is <strong>${totalCost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>, while the predicted baseline was <strong>${totalPredictedCost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>. 
                    You are currently {isOverBudget ? 'over' : 'under'} budget by <strong>${Math.abs(forecastVariance).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>.
                  </p>
                </div>
              )}
              <div className="dashboard-grid">
                <div className="card card-col-12">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>Actual vs Predicted Cost</h3>
                    <select className="btn btn-outline" style={{ padding: '4px 8px' }}>
                      <option>Prophet (Time-Series)</option><option>LSTM (Deep Learning)</option>
                    </select>
                  </div>
                  <div style={{ height: 400 }}>
                    {records.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={forecastData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v: any) => `$${Number(v || 0).toFixed(2)}`}/><Legend/><Line type="monotone" dataKey="actual" stroke="#0f172a" strokeWidth={2} name="Actual Cost"/><Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={2} name="Predicted Cost"/></LineChart>
                      </ResponsiveContainer>
                    ) : <Empty/>}
                  </div>
                  <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: '14px' }}>How this works</h4>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px', lineHeight: 1.6 }}>
                      <strong>Actual Data (Black Line):</strong> The real, billed cost of your cloud resources, pulled directly from your uploaded CSV data.<br/>
                      <strong>Predicted Data (Orange Line):</strong> The baseline cost established by a machine-learning model (like Prophet or LSTM) trained on your historical seasonality. Spikes where the actual line goes significantly above the predicted line usually indicate an anomaly or budget overrun.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* ─── 6. RECOMMENDATIONS ─────────────────────────── */}
          {activeTab === 'optimize' && (
            <div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 className="page-title">Recommendations & FinOps Optimization</h1>
                  <p className="page-subtitle">Algorithmic cost reductions, anomaly mitigation, and resource rightsizing tailored to your infrastructure.</p>
                </div>
                {uploadedFile && (
                  <span style={{ fontSize: '13px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '20px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={15} /> Evaluated {records.length} records from "{uploadedFile}"
                  </span>
                )}
              </div>

              {/* ─── Model Building: Tiered by Data Volume (Screenshot 2 Feature) ─── */}
              <div className="tiered-model-container">
                <div className="tiered-model-header">
                  <div className="tiered-model-title">Model Building: Tiered by Data Volume</div>
                  <div className="co2-pill">CO2</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tiered-table">
                    <thead>
                      <tr>
                        <th style={{ width: '20%' }}>Data available</th>
                        <th style={{ width: '32%' }}>Forecast</th>
                        <th style={{ width: '32%' }}>Anomaly detection</th>
                        <th style={{ width: '16%' }}>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Tier 1: 1 month */}
                      <tr className={uniqueMonths === 1 ? 'active-tier' : ''}>
                        <td style={{ fontWeight: 700 }}>
                          1 month {uniqueMonths === 1 && <span style={{ color: '#0d9488', fontSize: '11px', display: 'block' }}>● Active Dataset Tier</span>}
                        </td>
                        <td>Run-rate</td>
                        <td>Robust z-score</td>
                        <td>
                          <span style={{ background: '#ef4444', color: '#ffffff', fontWeight: 700, fontSize: '12px', padding: '4px 18px', borderRadius: '4px', display: 'inline-block', textAlign: 'center', minWidth: '70px' }}>
                            Low
                          </span>
                        </td>
                      </tr>

                      {/* Tier 2: 2-5 months */}
                      <tr className={uniqueMonths >= 2 && uniqueMonths <= 5 ? 'active-tier' : ''}>
                        <td style={{ fontWeight: 700 }}>
                          2-5 months {uniqueMonths >= 2 && uniqueMonths <= 5 && <span style={{ color: '#0d9488', fontSize: '11px', display: 'block' }}>● Active Dataset Tier</span>}
                        </td>
                        <td>Moving average / linear trend</td>
                        <td>MoM thresholds + z-score</td>
                        <td>
                          <span style={{ background: '#f59e0b', color: '#ffffff', fontWeight: 700, fontSize: '12px', padding: '4px 18px', borderRadius: '4px', display: 'inline-block', textAlign: 'center', minWidth: '70px' }}>
                            Medium
                          </span>
                        </td>
                      </tr>

                      {/* Tier 3: 6-12 months */}
                      <tr className={uniqueMonths >= 6 && uniqueMonths < 12 ? 'active-tier' : ''}>
                        <td style={{ fontWeight: 700 }}>
                          6-12 months {uniqueMonths >= 6 && uniqueMonths < 12 && <span style={{ color: '#0d9488', fontSize: '11px', display: 'block' }}>● Active Dataset Tier</span>}
                        </td>
                        <td>SARIMA</td>
                        <td>Isolation Forest</td>
                        <td>
                          <span style={{ background: '#14b8a6', color: '#ffffff', fontWeight: 700, fontSize: '12px', padding: '4px 18px', borderRadius: '4px', display: 'inline-block', textAlign: 'center', minWidth: '70px' }}>
                            Medium-high
                          </span>
                        </td>
                      </tr>

                      {/* Tier 4: 12-24+ months */}
                      <tr className={uniqueMonths >= 12 ? 'active-tier' : ''}>
                        <td style={{ fontWeight: 700 }}>
                          12-24+ months {uniqueMonths >= 12 && <span style={{ color: '#0d9488', fontSize: '11px', display: 'block' }}>● Active Dataset Tier</span>}
                        </td>
                        <td>Prophet / seasonal SARIMA</td>
                        <td>Isolation Forest + seasonal residuals</td>
                        <td>
                          <span style={{ background: '#10b981', color: '#ffffff', fontWeight: 700, fontSize: '12px', padding: '4px 18px', borderRadius: '4px', display: 'inline-block', textAlign: 'center', minWidth: '70px' }}>
                            High
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Callout box at bottom of tiered model */}
                <div className="tiered-callout-box">
                  <div className="tiered-callout-icon">
                    <TrendingUp size={22} />
                  </div>
                  <div className="tiered-callout-text">
                    More data means a narrower forecast band. The app always shows which tier a user is in, and tells new users what to upload next.
                    {modelTier && (
                      <span style={{ display: 'block', marginTop: '3px', fontSize: '12.5px', color: '#047857' }}>
                        Current status: <strong>{modelTier.label}</strong> ({uniqueMonths} month{uniqueMonths === 1 ? '' : 's'} available) &mdash; {modelTier.tip}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── 1. CLICKABLE SUMMARY CARDS (TOP SECTION) ─── */}
              <div className="dashboard-grid" style={{ marginBottom: '8px' }}>
                {/* 1. Potential Savings */}
                <div
                  className={`card card-col-3 rec-summary-card rec-card-savings`}
                  style={{ cursor: 'pointer', outline: activeRecCard === 'savings' ? '2px solid #059669' : 'none', transition: 'transform 0.15s', transform: activeRecCard === 'savings' ? 'translateY(-3px)' : 'none' }}
                  onClick={() => setActiveRecCard(prev => prev === 'savings' ? null : 'savings')}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-title" style={{ color: '#059669', fontWeight: 700 }}>Potential Savings</span>
                      <div className="avatar" style={{ background: activeRecCard === 'savings' ? '#059669' : '#d1fae5', color: activeRecCard === 'savings' ? '#fff' : '#059669', width: '28px', height: '28px' }}>
                        <DollarSign size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: '#047857', fontSize: '1.85rem' }}>
                      {records.length > 0 ? `$${recSummary.potentialSavings.toLocaleString()}` : '$0'}
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>/mo</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    {records.length > 0 ? (
                      <>Identified across <strong>{recSummary.totalActive}</strong> active opportunities · <span style={{ color: '#059669', fontWeight: 600 }}>Click for details</span></>
                    ) : (
                      <>⚪ Awaiting dataset upload · <span style={{ color: '#059669', fontWeight: 600 }}>No data</span></>
                    )}
                  </div>
                </div>

                {/* 2. High-Priority Issues */}
                <div
                  className={`card card-col-3 rec-summary-card rec-card-issues`}
                  style={{ cursor: 'pointer', outline: activeRecCard === 'issues' ? '2px solid #dc2626' : 'none', transition: 'transform 0.15s', transform: activeRecCard === 'issues' ? 'translateY(-3px)' : 'none' }}
                  onClick={() => setActiveRecCard(prev => prev === 'issues' ? null : 'issues')}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-title" style={{ color: '#dc2626', fontWeight: 700 }}>High-Priority Issues</span>
                      <div className="avatar" style={{ background: activeRecCard === 'issues' ? '#dc2626' : '#fee2e2', color: activeRecCard === 'issues' ? '#fff' : '#dc2626', width: '28px', height: '28px' }}>
                        <AlertTriangle size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: '#b91c1c', fontSize: '1.85rem' }}>
                      {records.length > 0 ? recSummary.highPriorityIssues : 0}
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>Detected</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    {records.length > 0 ? (
                      <>Requires immediate attention · <span style={{ color: '#dc2626', fontWeight: 600 }}>Click for details</span></>
                    ) : (
                      <>⚪ Awaiting dataset upload · <span style={{ color: '#dc2626', fontWeight: 600 }}>No issues</span></>
                    )}
                  </div>
                </div>

                {/* 3. Budget Status */}
                <div
                  className={`card card-col-3 rec-summary-card rec-card-budget`}
                  style={{ cursor: 'pointer', outline: activeRecCard === 'budget' ? `2px solid ${recSummary.isOverBudget ? '#dc2626' : '#0284c7'}` : 'none', transition: 'transform 0.15s', transform: activeRecCard === 'budget' ? 'translateY(-3px)' : 'none' }}
                  onClick={() => setActiveRecCard(prev => prev === 'budget' ? null : 'budget')}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-title" style={{ color: !records.length ? '#64748b' : recSummary.isOverBudget ? '#dc2626' : '#0284c7', fontWeight: 700 }}>Budget Status</span>
                      <div className="avatar" style={{ background: !records.length ? '#f1f5f9' : recSummary.isOverBudget ? '#fee2e2' : '#e0f2fe', color: !records.length ? '#64748b' : recSummary.isOverBudget ? '#dc2626' : '#0284c7', width: '28px', height: '28px' }}>
                        {recSummary.isOverBudget ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.5rem', color: !records.length ? '#64748b' : recSummary.isOverBudget ? '#dc2626' : '#0369a1' }}>
                      {!records.length ? 'No Data' : recSummary.isOverBudget ? 'Over Budget' : 'Within Budget'}
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: !records.length ? '#64748b' : recSummary.isOverBudget ? '#b91c1c' : '#0369a1', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontWeight: 500 }}>
                    {!records.length
                      ? '⚪ Awaiting dataset upload'
                      : recSummary.isOverBudget ? `+$${Math.abs(forecastVariance).toFixed(2)} vs baseline` : `-$${Math.abs(forecastVariance).toFixed(2)} under baseline`} · <span style={{ fontWeight: 600 }}>Click for details</span>
                  </div>
                </div>

                {/* 4. Cost Optimization Score */}
                <div
                  className={`card card-col-3 rec-summary-card rec-card-score`}
                  style={{ cursor: 'pointer', outline: activeRecCard === 'score' ? '2px solid #7c3aed' : 'none', transition: 'transform 0.15s', transform: activeRecCard === 'score' ? 'translateY(-3px)' : 'none' }}
                  onClick={() => setActiveRecCard(prev => prev === 'score' ? null : 'score')}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-title" style={{ color: '#7c3aed', fontWeight: 700 }}>Optimization Score</span>
                      <div className="avatar" style={{ background: activeRecCard === 'score' ? '#7c3aed' : '#ede9fe', color: activeRecCard === 'score' ? '#fff' : '#7c3aed', width: '28px', height: '28px' }}>
                        <Sparkles size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: !records.length ? '#64748b' : recSummary.scoreColor, fontSize: '1.85rem' }}>
                      {recSummary.scoreDisplay}
                      {recSummary.score !== null && <span style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8' }}> / 100</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    {recSummary.score !== null ? (
                      <>{recSummary.score >= 80 ? '🟢 Strong efficiency posture' : recSummary.score >= 65 ? '🟠 Moderate efficiency posture' : '🔴 High savings potential detected'} · <span style={{ color: '#7c3aed', fontWeight: 600 }}>Click for details</span></>
                    ) : (
                      <>⚪ Awaiting dataset upload · <span style={{ color: '#7c3aed', fontWeight: 600 }}>Click for details</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── DETAIL PANEL (shown below cards when one is active) ─── */}
              {activeRecCard === 'savings' && (() => {
                if (!records.length) {
                  return (
                    <div className="card card-col-12" style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, color: '#14532d', fontWeight: 800, fontSize: '1.1rem' }}>💰 Potential Savings — Awaiting Data</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                      </div>
                      <p style={{ color: '#166534', fontSize: '13.5px', lineHeight: 1.7, margin: 0 }}>
                        No dataset is currently uploaded. Upload a CSV file in Data Management to evaluate potential savings opportunities across your infrastructure.
                      </p>
                    </div>
                  );
                }
                const savingsByCategory = [
                  'Cost Reduction', 'Resource Optimization', 'Storage Optimization',
                  'Budget Management', 'Anomaly-Based Recommendations', 'Pricing Optimization'
                ].map(cat => ({
                  cat,
                  total: allRecommendations.filter(r => r.category === cat && (recStatusMap[r.id] || 'New') !== 'Dismissed').reduce((s, r) => s + r.estimatedSavings, 0),
                  count: allRecommendations.filter(r => r.category === cat && (recStatusMap[r.id] || 'New') !== 'Dismissed').length,
                })).filter(x => x.count > 0).sort((a, b) => b.total - a.total);
                return (
                  <div className="card card-col-12" style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: '#14532d', fontWeight: 800, fontSize: '1.1rem' }}>💰 Potential Savings Breakdown — ${recSummary.potentialSavings.toLocaleString()}/month</h3>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                    </div>
                    <p style={{ color: '#166534', fontSize: '13.5px', lineHeight: 1.7, margin: '0 0 16px', background: '#dcfce7', padding: '12px 16px', borderRadius: '6px' }}>
                      <strong>How this works:</strong> Potential savings are calculated by analysing your uploaded dataset across six FinOps categories. For each category, the engine identifies the highest-cost services and estimates the savings achievable through Reserved Instances, rightsizing, lifecycle tiering, or commitment discounts — typically 12–45% of that service's spend. The total is the sum of all non-dismissed opportunity estimates derived directly from your {records.length} records across {uniqueMonths} billing month{uniqueMonths === 1 ? '' : 's'}.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                      {savingsByCategory.map(({ cat, total, count }) => (
                        <div key={cat} style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>{cat}</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#047857' }}>${total.toLocaleString()}/mo</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{count} opportunit{count === 1 ? 'y' : 'ies'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {activeRecCard === 'issues' && (() => {
                if (!records.length) {
                  return (
                    <div className="card card-col-12" style={{ background: '#fef2f2', border: '2px solid #f87171', borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, color: '#991b1b', fontWeight: 800, fontSize: '1.1rem' }}>🚨 High-Priority Issues — Awaiting Data</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                      </div>
                      <p style={{ color: '#7f1d1d', fontSize: '13.5px', lineHeight: 1.7, margin: 0 }}>
                        No dataset is currently uploaded. Upload a CSV file in Data Management to detect high-priority cost issues and anomalies.
                      </p>
                    </div>
                  );
                }
                const highIssues = allRecommendations.filter(r => (r.priority === 'High' || r.priority === 'Critical') && (recStatusMap[r.id] || 'New') !== 'Dismissed');
                return (
                  <div className="card card-col-12" style={{ background: '#fef2f2', border: '2px solid #f87171', borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: '#991b1b', fontWeight: 800, fontSize: '1.1rem' }}>🚨 High-Priority Issues — {recSummary.highPriorityIssues} Detected</h3>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                    </div>
                    <p style={{ color: '#7f1d1d', fontSize: '13.5px', lineHeight: 1.7, margin: '0 0 16px', background: '#fee2e2', padding: '12px 16px', borderRadius: '6px' }}>
                      <strong>How this works:</strong> Each recommendation is assigned a priority level based on the financial impact and urgency of the identified issue. A recommendation is classified as <strong>High</strong> or <strong>Critical</strong> when it involves a top-spending service, an over-budget variance, anomaly-linked spend, or on-demand pricing inefficiency that could significantly affect total cost. These issues are computed in real-time from your {records.length} uploaded records and require immediate FinOps or engineering attention.
                    </p>
                    {highIssues.length === 0 ? (
                      <p style={{ color: '#22c55e', fontWeight: 700, textAlign: 'center', padding: '20px' }}>✅ No active high-priority issues — all have been reviewed or dismissed.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {highIssues.map(r => (
                          <div key={r.id} style={{ background: '#fff', border: '1px solid #fecaca', borderLeft: `4px solid ${r.priority === 'Critical' ? '#ef4444' : '#f97316'}`, borderRadius: '6px', padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', background: '#f0fdfa', padding: '2px 8px', borderRadius: '4px', marginRight: '8px' }}>{r.category}</span>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{r.service}</span>
                                <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '6px' }}>({r.provider})</span>
                              </div>
                              <span style={{ background: r.priority === 'Critical' ? '#ef4444' : '#f97316', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px' }}>{r.priority}</span>
                            </div>
                            <p style={{ color: '#b91c1c', fontSize: '13px', margin: '6px 0 4px' }}>{r.issueDetected}</p>
                            <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}><strong>Action:</strong> {r.suggestedAction} · <span style={{ color: '#059669', fontWeight: 700 }}>Est. {r.savingsDisplay}</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeRecCard === 'budget' && (() => {
                if (!records.length) {
                  return (
                    <div className="card card-col-12" style={{ background: '#eff6ff', border: '2px solid #60a5fa', borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, color: '#1e3a8a', fontWeight: 800, fontSize: '1.1rem' }}>📈 Budget Status — Awaiting Data</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                      </div>
                      <p style={{ color: '#1e3a8a', fontSize: '13.5px', lineHeight: 1.7, margin: 0 }}>
                        No dataset is currently uploaded. Upload a CSV file in Data Management to evaluate spend against forecast baselines and check budget variance.
                      </p>
                    </div>
                  );
                }
                const monthlyData = forecastData.slice().sort((a, b) => a.date.localeCompare(b.date));
                return (
                  <div className="card card-col-12" style={{ background: recSummary.isOverBudget ? '#fef2f2' : '#eff6ff', border: `2px solid ${recSummary.isOverBudget ? '#f87171' : '#60a5fa'}`, borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: recSummary.isOverBudget ? '#991b1b' : '#1e3a8a', fontWeight: 800, fontSize: '1.1rem' }}>
                        {recSummary.isOverBudget ? '📈 Budget Status: Over Budget' : '📉 Budget Status: Within Budget'} — Variance ${Math.abs(forecastVariance).toFixed(2)}
                      </h3>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                    </div>
                    <p style={{ color: recSummary.isOverBudget ? '#7f1d1d' : '#1e3a8a', fontSize: '13.5px', lineHeight: 1.7, margin: '0 0 16px', background: recSummary.isOverBudget ? '#fee2e2' : '#dbeafe', padding: '12px 16px', borderRadius: '6px' }}>
                      <strong>How this works:</strong> Budget status compares your total actual spend against the predicted cost baseline derived from your dataset (each record's <code style={{ background: '#e2e8f0', padding: '0 3px', borderRadius: '3px' }}>predictedCost</code> field, or 93% of actual cost if absent). When actual spend exceeds the predicted total, the status turns <strong>Over Budget</strong>. This is computed across all {uniqueMonths} billing month{uniqueMonths === 1 ? '' : 's'} in your dataset. In production, the baseline is generated by a forecasting model (Prophet / SARIMA) trained on 6+ months of historical data.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: 'Total Actual Cost', val: `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#0f172a' },
                        { label: 'Predicted Baseline', val: `$${totalPredictedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#f59e0b' },
                        { label: recSummary.isOverBudget ? 'Over-run' : 'Under-run', val: `$${Math.abs(forecastVariance).toFixed(2)}`, color: recSummary.isOverBudget ? '#dc2626' : '#16a34a' },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#fff', borderRadius: '8px', padding: '14px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: item.color, marginTop: '4px' }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                    <h4 style={{ color: '#334155', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Monthly Variance Breakdown</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead><tr><th>Month</th><th>Actual Cost</th><th>Predicted</th><th>Variance</th><th>Status</th></tr></thead>
                        <tbody>
                          {monthlyData.map(m => {
                            const v = (m.actual || 0) - (m.predicted || m.actual || 0);
                            return (
                              <tr key={m.date}>
                                <td style={{ fontWeight: 600 }}>{m.date}</td>
                                <td>${(m.actual || 0).toFixed(2)}</td>
                                <td style={{ color: '#f59e0b' }}>${(m.predicted || 0).toFixed(2)}</td>
                                <td style={{ color: v > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{v > 0 ? '+' : ''}{v.toFixed(2)}</td>
                                <td><span style={{ background: v > 0 ? '#fee2e2' : '#dcfce7', color: v > 0 ? '#b91c1c' : '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{v > 0 ? 'Over' : 'Under'}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {activeRecCard === 'score' && (() => {
                if (!records.length) {
                  return (
                    <div className="card card-col-12" style={{ background: '#faf5ff', border: '2px solid #a78bfa', borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, color: '#4c1d95', fontWeight: 800, fontSize: '1.1rem' }}>✨ Optimization Score — Awaiting Dataset</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                      </div>
                      <p style={{ color: '#5b21b6', fontSize: '13.5px', lineHeight: 1.7, margin: 0 }}>
                        <strong>How it works:</strong> No dataset is currently uploaded. Upload a clean CSV file in the <strong>Data Management</strong> tab to automatically compute your Optimization Score. Each dataset produces a tailored score between 0 and 100 based on its cost waste ratio, high-priority risk count, budget variance, and review progress.
                      </p>
                    </div>
                  );
                }
                const totalRecs = allRecommendations.length;
                const highIssueCount = recSummary.highPriorityIssues;
                const reviewedCount = allRecommendations.filter(r => (recStatusMap[r.id] || 'New') === 'Reviewed').length;
                const dismissedCount = allRecommendations.filter(r => (recStatusMap[r.id] || 'New') === 'Dismissed').length;
                const rawScore = recSummary.score || 100;
                const scoreColor = recSummary.scoreColor;
                const scoreLabel = recSummary.scoreLabel;
                return (
                  <div className="card card-col-12" style={{ background: '#faf5ff', border: '2px solid #a78bfa', borderRadius: '10px', padding: '24px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: '#4c1d95', fontWeight: 800, fontSize: '1.1rem' }}>✨ Optimization Score — {rawScore} / 100 ({scoreLabel})</h3>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }} onClick={() => setActiveRecCard(null)}>✕</button>
                    </div>
                    <p style={{ color: '#5b21b6', fontSize: '13.5px', lineHeight: 1.7, margin: '0 0 16px', background: '#ede9fe', padding: '12px 16px', borderRadius: '6px' }}>
                      <strong>How the score is calculated:</strong> The optimization score dynamically assesses your uploaded dataset starting at 100. It deducts points based on potential waste ratio (${recSummary.potentialSavings.toLocaleString()} savings out of ${totalCost.toLocaleString()} spend = -{recSummary.wastePenalty} pts), penalises unresolved High/Critical risk items ({highIssueCount} issues = -{recSummary.issuePenalty} pts), accounts for budget adherence ({recSummary.isOverBudget ? `Over budget by $${Math.abs(forecastVariance).toFixed(2)} = -${recSummary.budgetFactor} pts` : 'Within budget = +5 pts reward'}), and grants +4 bonus points for each recommendation marked as <em>Reviewed</em>. When you upload a different dataset, every parameter recalibrates instantly to that dataset.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: 'Base Baseline', val: '100 pts', color: '#0f172a' },
                        { label: 'Waste Ratio Impact', val: `-${recSummary.wastePenalty} pts`, color: '#d97706' },
                        { label: 'High Issues Penalty', val: `-${recSummary.issuePenalty} pts (${highIssueCount} × 7)`, color: '#dc2626' },
                        { label: 'Budget Adjustment', val: recSummary.budgetFactor > 0 ? `-${recSummary.budgetFactor} pts` : `+5 pts bonus`, color: recSummary.budgetFactor > 0 ? '#dc2626' : '#16a34a' },
                        { label: 'Reviewed Bonus', val: `+${recSummary.reviewBonus} pts (${reviewedCount} × 4)`, color: '#16a34a' },
                        { label: 'Final Computed Score', val: `${rawScore} / 100`, color: scoreColor },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#fff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: item.color, marginTop: '4px' }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {[
                        { label: 'Active Recommendations', val: totalRecs, color: '#334155' },
                        { label: 'Reviewed', val: reviewedCount, color: '#2563eb' },
                        { label: 'Dismissed', val: dismissedCount, color: '#64748b' },
                        { label: 'Records Analysed', val: records.length, color: '#0d9488' },
                        { label: 'Billing Months', val: uniqueMonths, color: '#0d9488' },
                        { label: 'Providers Tracked', val: providers.length, color: '#0d9488' },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#475569' }}>{item.label}</span>
                          <span style={{ fontWeight: 800, color: item.color, fontSize: '14px' }}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ─── 2. RECOMMENDATIONS (Executive Paragraph Summary) ─── */}
              <div className="card card-col-12" style={{ marginTop: '20px', padding: '28px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#f0fdfa', padding: '8px', borderRadius: '8px', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 800 }}>Recommendations Summary</h3>
                      <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '13px' }}>
                        {records.length > 0 ? `Algorithmic analysis of ${records.length} records across ${uniqueMonths} billing month${uniqueMonths === 1 ? '' : 's'}` : 'Awaiting dataset upload'}
                      </p>
                    </div>
                  </div>
                  {records.length > 0 && (
                    <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>
                      Est. ${recSummary.potentialSavings.toLocaleString()}/mo total savings
                    </span>
                  )}
                </div>

                {!records.length ? (
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>
                    No dataset is currently uploaded. Upload a clean CSV billing file in the <strong>Data Management</strong> tab to analyze your infrastructure spend, evaluate cost anomalies, and generate tailored recommendations.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <p style={{ color: '#1e293b', fontSize: '14.5px', lineHeight: 1.8, margin: 0 }}>
                      Based on our FinOps evaluation of your <strong>{records.length} records</strong> across <strong>{providers.join(', ')}</strong>, we identified <strong>{allRecommendations.length} optimization opportunities</strong> that could save approximately <strong>${recSummary.potentialSavings.toLocaleString()}/month</strong>. Your cloud infrastructure is currently tracking at an optimization score of <strong>{recSummary.score ?? 100} / 100</strong> with <strong>{recSummary.highPriorityIssues} high-priority issue{recSummary.highPriorityIssues === 1 ? '' : 's'}</strong> requiring attention.
                    </p>

                    <p style={{ color: '#334155', fontSize: '14px', lineHeight: 1.8, margin: 0, background: '#f8fafc', padding: '16px 18px', borderRadius: '8px', borderLeft: '4px solid #0d9488' }}>
                      <strong>Core Cost Reductions & Commitments:</strong> {allRecommendations.filter(r => r.category === 'Cost Reduction' || r.category === 'Pricing Optimization').map(r => `${r.suggestedAction} (${r.savingsDisplay})`).join('. ') || 'Review top expenditure services to explore multi-year committed discounts.'}
                    </p>

                    <p style={{ color: '#334155', fontSize: '14px', lineHeight: 1.8, margin: 0, background: '#f8fafc', padding: '16px 18px', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                      <strong>Resource & Storage Rightsizing:</strong> {allRecommendations.filter(r => r.category === 'Resource Optimization' || r.category === 'Storage Optimization').map(r => `${r.suggestedAction} (${r.savingsDisplay})`).join('. ') || 'Implement automated rightsizing schedules and storage lifecycle policies.'}
                    </p>

                    <p style={{ color: '#334155', fontSize: '14px', lineHeight: 1.8, margin: 0, background: '#f8fafc', padding: '16px 18px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                      <strong>Budget & Anomaly Governance:</strong> {recSummary.isOverBudget ? `Actual spend exceeds predicted baseline by $${Math.abs(forecastVariance).toFixed(2)}; configure strict budget threshold alerts at 80% and 100% capacity.` : 'Spend is tracking within forecasted limits; maintain routine automated monthly reviews.'} {allRecommendations.filter(r => r.category === 'Anomaly-Based Recommendations').map(r => r.suggestedAction).join('. ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Informational Advisory Notice */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <ShieldCheck size={24} style={{ color: '#0d9488', flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  <strong>FinOps Advisory Policy:</strong> Recommendations are calculated non-intrusively from billing telemetry and run-rate variance. To execute changes, apply rightsizing or reservation commitments directly within your AWS Management Console, Azure Portal, or Google Cloud Console.
                </div>
              </div>
            </div>
          )}

          {/* ─── 7. REPORT ──────────────────────────────────── */}
          {activeTab === 'report' && (
            <div>
              <div className="page-header">
                <h1 className="page-title">Data Report</h1>
                <p className="page-subtitle">Summary statistics and a printable breakdown of your full dataset.</p>
              </div>
              <div className="dashboard-grid">
                {/* Summary KPIs */}
                {[
                  { label: 'Total Cost', val: `$${totalCost.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` },
                  { label: 'Total Records', val: records.length },
                  { label: 'Unique Providers', val: providers.length },
                  { label: 'Unique Services', val: new Set(records.map(r=>r.service)).size },
                  { label: 'Months Covered', val: new Set(records.map(r=>r.month)).size },
                  { label: 'Anomalies Found', val: anomalies.length },
                ].map(k => (
                  <div key={String(k.label)} className="card card-col-4 stat-card">
                    <span className="stat-title">{k.label}</span>
                    <span className="stat-value" style={{fontSize:'1.5rem'}}>{k.val}</span>
                  </div>
                ))}

                {/* Provider Breakdown */}
                <div className="card card-col-6">
                  <h3 className="card-title">Cost by Provider</h3>
                  <table className="data-table">
                    <thead><tr><th>Provider</th><th>Total Cost (USD)</th><th>Share (%)</th></tr></thead>
                    <tbody>
                      {records.length === 0 && <tr><td colSpan={3} style={{textAlign:'center',padding:'16px',color:'#94a3b8'}}>No data uploaded yet.</td></tr>}
                      {[...byProvider].sort((a,b)=>b.cost-a.cost).map(p => (
                        <tr key={p.name}>
                          <td><strong>{p.name}</strong></td>
                          <td>${(p.cost||0).toFixed(2)}</td>
                          <td>{totalCost ? ((p.cost/totalCost)*100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Service Breakdown */}
                <div className="card card-col-6">
                  <h3 className="card-title">Cost by Service</h3>
                  <table className="data-table">
                    <thead><tr><th>Service</th><th>Total Cost (USD)</th><th>Share (%)</th></tr></thead>
                    <tbody>
                      {records.length === 0 && <tr><td colSpan={3} style={{textAlign:'center',padding:'16px',color:'#94a3b8'}}>No data uploaded yet.</td></tr>}
                      {[...byService].sort((a,b)=>b.cost-a.cost).map(s => (
                        <tr key={s.name}>
                          <td><strong>{s.name}</strong></td>
                          <td>${(s.cost||0).toFixed(2)}</td>
                          <td>{totalCost ? ((s.cost/totalCost)*100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Monthly Breakdown */}
                <div className="card card-col-12">
                  <h3 className="card-title">Monthly Cost Breakdown</h3>
                  <table className="data-table">
                    <thead><tr><th>Month</th><th>Actual Cost (USD)</th><th>Predicted Cost (USD)</th><th>Variance</th><th>Anomaly?</th></tr></thead>
                    <tbody>
                      {forecastData.length === 0 && <tr><td colSpan={5} style={{textAlign:'center',padding:'16px',color:'#94a3b8'}}>No data uploaded yet.</td></tr>}
                      {forecastData.map(f => {
                        const actual = f.actual || 0;
                        const predicted = f.predicted || actual;
                        const hasAnomaly = anomalies.some(a => a.month === f.date);
                        const variance = actual - predicted;
                        return (
                          <tr key={f.date}>
                            <td>{f.date}</td>
                            <td>${actual.toFixed(2)}</td>
                            <td>${predicted.toFixed(2)}</td>
                            <td style={{color: variance > 0 ? '#ef4444' : '#10b981', fontWeight:600}}>{variance > 0 ? '+' : ''}{variance.toFixed(2)}</td>
                            <td>{hasAnomaly ? <span className="badge badge-danger">Yes</span> : <span className="badge badge-success">No</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* ─── 8. ANALYSIS BASIS ──────────────────────────── */}
          {activeTab === 'analysis' && (
            <div>
              <div className="page-header">
                <h1 className="page-title">Analysis Basis & Methodology</h1>
                <p className="page-subtitle">How data is processed, graphs are built, and recommendations are generated.</p>
              </div>
              <div className="dashboard-grid">

                <div className="card card-col-12">
                  <h3 className="card-title">📊 How Graphs Are Generated</h3>
                  <table className="data-table">
                    <thead><tr><th>Graph</th><th>Data Used</th><th>How It's Calculated</th></tr></thead>
                    <tbody>
                      {[
                        ['Bar Graph','Provider + Cost','Sums total cost_usd grouped by cloud_provider. Each bar = one provider.'],
                        ['Stacked Bar Graph','Month + Provider + Cost','Groups cost by (month, provider). Stacks are layers per provider per month.'],
                        ['Line Graph','Month + Cost','Aggregates total cost per month, sorted chronologically.'],
                        ['Pie / Donut Chart','Provider + Cost','Cost per provider expressed as percentage of total spend.'],
                        ['Histogram','Service + Cost','Sums cost by service name to show distribution across services.'],
                        ['Scatter Plot','Usage Quantity + Cost','Plots each record where usageQuantity exists. Shows cost vs usage correlation.'],
                        ['Area Chart','Month + Cost','Same as Line Graph but fills under the curve to show cumulative volume.'],
                        ['Forecast Line Graph','Month + Actual + Predicted','Actual = real cost. Predicted = predictedCost field (or 93% of cost if absent).'],
                        ['Anomaly Line Graph','Month + Cost + isAnomaly flag','Normal cost is plotted as a line. Red dots appear on months with isAnomaly = 1.'],
                      ].map(([g, d, h]) => <tr key={g}><td><strong>{g}</strong></td><td style={{color:'#475569'}}>{d}</td><td style={{color:'#475569'}}>{h}</td></tr>)}
                    </tbody>
                  </table>
                </div>

                <div className="card card-col-12">
                  <h3 className="card-title">⚠️ Upload-Time Anomaly Verification Gate</h3>
                  <p style={{color:'#475569', lineHeight:1.8}}>
                    Datasets are validated directly at upload time within <strong>Data Management</strong> before entering the platform. 
                    If any row contains statistical cost spikes (Z-score &gt; 3 or extreme values), negative usage, corrupted provider identifiers, massive usage with near-zero charges, invalid date strings (e.g. Month_13_2026), missing sources, mismatched service tags, zero usage with high fixed fees, or invalid coordinates, the upload is halted immediately with the warning <em>"this data contain anomaly"</em>. 
                    The user is required to upload another clean data file without anomalies before proceeding into Dashboard, Forecasting, and Recommendations.
                  </p>
                </div>

                <div className="card card-col-12">
                  <h3 className="card-title">📈 Forecasting Methodology</h3>
                  <p style={{color:'#475569', lineHeight:1.8}}>
                    The Cost Forecasting page overlays <strong>Actual Cost</strong> vs <strong>Predicted Cost</strong>.
                    In this platform, <code>predictedCost</code> comes from the uploaded data or is estimated as 93% of the actual cost if absent.
                    In a production system, this is replaced with a <strong>Facebook Prophet</strong> or <strong>LSTM (Long Short-Term Memory)</strong> neural network model
                    trained on at least 6 months of historical billing data. The model learns weekly and monthly seasonality patterns
                    (e.g., higher traffic on weekdays, lower on weekends) and outputs a predicted cost with confidence intervals.
                  </p>
                </div>

                <div className="card card-col-12">
                  <h3 className="card-title">💡 How Recommendations Are Generated</h3>
                  <table className="data-table">
                    <thead><tr><th>Recommendation Type</th><th>Trigger Condition</th><th>Suggested Action</th></tr></thead>
                    <tbody>
                      {[
                        ['Highest Spend Alert','Provider accounts for >40% of total cost','Review reserved capacity & commitment discounts'],
                        ['Rightsize Resources','CPU utilization consistently < 10%','Downgrade instance type (e.g. m5.large → t3.medium)'],
                        ['Zombie Resource','Resource has 0 connections/requests for >7 days','Terminate or snapshot the resource'],
                        ['Cost Spike','Monthly cost > 2× predicted cost (anomaly flag)','Audit the service logs; check for runaway jobs or misconfigured autoscaling'],
                        ['Schedule Savings','Dev/staging resources running 24×7','Auto-shutdown outside business hours (saves ~30% on compute)'],
                        ['Storage Cleanup','S3/Blob buckets older than 90 days','Apply lifecycle policies to move data to cold storage tiers'],
                      ].map(([t,c,a]) => <tr key={t}><td><strong>{t}</strong></td><td style={{color:'#475569'}}>{c}</td><td style={{color:'#0d9488'}}>{a}</td></tr>)}
                    </tbody>
                  </table>
                  <p style={{color:'#94a3b8', fontSize:'13px', marginTop:'12px'}}>
                    ℹ️ In this platform, the top-3 providers by total spend are surfaced automatically from your data. In a production FinOps system, recommendations are further enriched with live CloudWatch, Azure Monitor, or GCP Operations metrics.
                  </p>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* Helper */
function Empty() {
  return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', minHeight: '150px' }}>No data available</div>;
}
