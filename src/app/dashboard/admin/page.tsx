'use client';

import { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Database,
  Eye,
  FileText,
  ShieldAlert,
  Download,
  Info,
} from 'lucide-react';

const REQUIRED_HEADERS = [
  'User Email',
  'User Name',
  'Year',
  'Month',
  'Product',
  'Calculation Method',
  'GenAI Tool Consumption',
  'Credits',
  'Cost USD',
  'Cost (in $)',
  'CT/Non-CT',
  'Country',
  'Super Region',
  'Service Line',
  'Sub-Service Line 1',
  'Sub-Service Line 2',
  'Engagement Code',
  'Engagement - Super Region',
  'Engagement Service Line',
  'Engagement Sub-Service Line',
  'Engagement Competency',
  'Engagement Invest Type',
  'GDS Location',
  'Cost Center',
  'Portfolio - CT Product Family',
  'Portfolio - CT Product',
  'Entity',
  'SL/SF',
  'RS',
  'GDS',
];

interface DatasetMeta {
  isCustom: boolean;
  fileName: string;
  rowCount: number;
  totalCost: number;
  totalTokens: number;
}

export default function AdminPage() {
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [showSchemaHelp, setShowSchemaHelp] = useState(false);

  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMeta = async () => {
    try {
      const res = await fetch('/api/admin/dataset');
      if (res.ok) {
        const data = await res.json();
        setMeta(data);
      }
    } catch (e) {
      console.error('Failed to fetch dataset metadata:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  const handleDownloadTemplate = () => {
    const templateCsv = `User Email,User Name,Year,Month,Product,Calculation Method,GenAI Tool Consumption,Credits,Cost USD,Cost (in $),CT/Non-CT,Country,Super Region,Service Line,Sub-Service Line 1,Sub-Service Line 2,Engagement Code,Engagement - Super Region,Engagement Service Line,Engagement Sub-Service Line,Engagement Competency,Engagement Invest Type,GDS Location,Cost Center,Portfolio - CT Product Family,Portfolio - CT Product,Entity,SL/SF,RS,GDS
john.doe@enterprise-corp.com,John Doe,2026,3,Github,License,0,0,35.00,35.00,CT,United States,USLI,Consulting,Business Consulting,Digital,E-481920,USLI,Consulting,Business Consulting,People Advisory,Growth,India,CC-CNS-101,Product Family A,Product A,Entity1,SL1,RS1,GDS1
john.doe@enterprise-corp.com,John Doe,2026,3,Github,Usage,42431,-70,424.31,354.31,CT,United States,USLI,Consulting,Business Consulting,Digital,E-481920,USLI,Consulting,Business Consulting,People Advisory,Growth,India,CC-CNS-101,Product Family A,Product A,Entity1,SL1,RS1,GDS1
jane.smith@enterprise-corp.com,Jane Smith,2026,3,ChatGPT,License,0,0,25.00,25.00,CT,United Kingdom,UK,CBS,AWS,CNS,E-719302,UK,CBS,CBS,Risk Management,Growth,Hungary,CC-CBS-205,Product Family B,Product B,Entity2,SL2,RS2,GDS2
jane.smith@enterprise-corp.com,Jane Smith,2026,3,ChatGPT,Usage,1200,,1.84,1.84,CT,United Kingdom,UK,CBS,AWS,CNS,E-719302,UK,CBS,CBS,Risk Management,Growth,Hungary,CC-CBS-205,Product Family B,Product B,Entity2,SL2,RS2,GDS2
alex.wong@enterprise-corp.com,Alex Wong,2026,3,Claude,License,0,0,40.00,40.00,Non-CT,Singapore,GDS,Assurance,Audit,Finance,I-304918,Asia East,Assurance,Audit,Technology,Maintain,Philippines,CC-ASU-318,Product Family C,Product C,Entity3,SL3,RS3,GDS3
priya.nair@enterprise-corp.com,Priya Nair,2026,3,Cursor,Usage,15200,-40,16.72,0,CT,India,Canada,Tax,Risk Consulting,Client Experience,E-663210,MENA,Tax,Core Tax,Operations,Growth,Mexico,CC-TAX-720,Product Family D,Product D,Entity4,SL4,RS4,GDS4`;

    const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ai_usage_data_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadActiveDataset = async () => {
    try {
      const customText = localStorage.getItem('custom_csv_data');
      let csvContent = customText;
      let name = meta?.fileName || 'ai_usage_data.csv';

      if (!csvContent) {
        const publicRes = await fetch('/ai_usage_data.csv');
        if (publicRes.ok) {
          csvContent = await publicRes.text();
        } else {
          const exportRes = await fetch('/api/metrics/export');
          csvContent = await exportRes.text();
        }
      }

      if (!csvContent || !csvContent.trim()) {
        throw new Error('Active CSV data source could not be retrieved.');
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', name.endsWith('.csv') ? name : `${name}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to download active dataset' });
    }
  };

  const validateAndPreviewCsv = (text: string, name = 'custom_data.csv') => {
    setValidationError(null);
    setParsedRows([]);
    setFileName(name);

    if (!text || !text.trim()) {
      setValidationError('CSV content is empty.');
      return;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      setValidationError('CSV must contain a header row and at least 1 data row.');
      return;
    }

    const header = lines[0].split(',').map((h) => h.trim());
    const missingHeaders = REQUIRED_HEADERS.filter(
      (req) => !header.some((h) => h.toLowerCase() === req.toLowerCase())
    );

    if (missingHeaders.length > 5) {
      setValidationError(`Invalid CSV structure. Missing expected columns: ${missingHeaders.slice(0, 3).join(', ')}...`);
      return;
    }

    const preview: any[] = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length >= 20) {
        preview.push({
          userMail: cols[0] || '',
          displayName: cols[1] || '',
          month: cols[3] || '',
          year: cols[2] || '',
          aiTool: cols[4] || '',
          calculationMethod: cols[5] || '',
          tokenConsumption: cols[6] || '0',
          credits: cols[7],
          cost: cols[9] || '0',
          country: cols[11] || '',
          superRegion: cols[12] || '',
          serviceLine: cols[13] || '',
        });
      }
    }

    setParsedRows(preview);
    setRawText(text);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      validateAndPreviewCsv(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      validateAndPreviewCsv(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleApplyDataset = async () => {
    if (!rawText.trim() || validationError) return;

    setUploading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: rawText, fileName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload CSV dataset');

      localStorage.setItem('custom_csv_data', rawText);
      localStorage.setItem('custom_csv_name', fileName);

      setStatusMessage({ type: 'success', text: data.message || 'Dataset updated successfully!' });
      setRawText('');
      setParsedRows([]);
      setFileName('');
      await fetchMeta();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to set active dataset.' });
    } finally {
      setUploading(false);
    }
  };

  const handleResetDataset = async () => {
    if (!confirm('Are you sure you want to reset to the default embedded dataset?')) return;

    setUploading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/dataset', { method: 'DELETE' });
      const data = await res.json();

      localStorage.removeItem('custom_csv_data');
      localStorage.removeItem('custom_csv_name');

      setStatusMessage({ type: 'success', text: data.message || 'Reset to default dataset.' });
      setRawText('');
      setParsedRows([]);
      setFileName('');
      await fetchMeta();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reset dataset.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/60 border border-ey-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-ey-yellow/15 border border-ey-yellow/30 rounded-xl text-ey-yellow shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ey-light tracking-wide">Admin &amp; Data Management</h1>
            <p className="text-xs text-ey-muted mt-0.5">
              Upload custom AI usage CSV datasets to update dashboard metrics dynamically.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">


          <button
            onClick={() => setShowSchemaHelp(!showSchemaHelp)}
            className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 bg-ey-black/60 border border-ey-border text-ey-light rounded-lg hover:bg-ey-card-hover transition-colors"
          >
            <Info className="w-4 h-4 text-ey-yellow" />
            <span>{showSchemaHelp ? 'Hide Schema Guide' : 'Schema Guide'}</span>
          </button>

          {meta?.isCustom && (
            <button
              onClick={handleResetDataset}
              disabled={uploading}
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/25 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset to Default</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Schema Guide */}
      {showSchemaHelp && (
        <div className="bg-ey-card/90 border border-ey-yellow/30 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-ey-border/60 pb-3">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-ey-yellow" />
              <h3 className="text-sm font-bold text-ey-light tracking-wide">Required CSV Schema Fields ({REQUIRED_HEADERS.length} Columns)</h3>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="text-xs font-semibold text-ey-yellow hover:underline flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download `.csv` template</span>
            </button>
          </div>

          <p className="text-xs text-ey-muted">
            Your uploaded CSV file must include the exact column headers below in line 1. Case-insensitive matching is supported.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
            {REQUIRED_HEADERS.map((header, idx) => (
              <div key={idx} className="bg-ey-black/50 border border-ey-border/60 p-2 rounded flex items-center space-x-2">
                <span className="text-[10px] text-ey-yellow font-bold shrink-0">{idx + 1}.</span>
                <span className="text-ey-light truncate">{header}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Dataset Overview KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-ey-card border border-ey-border rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ey-muted">Active Data Source</span>
            <div className="p-1.5 bg-ey-yellow/10 border border-ey-yellow/30 text-ey-yellow rounded-lg">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-ey-light truncate">
                {meta?.isCustom ? 'Custom Uploaded' : 'Default Embedded'}
              </div>
              <p className="text-xs text-ey-yellow font-mono truncate">{meta?.fileName ?? 'ai_usage_data.csv'}</p>
            </div>
            <button
              onClick={handleDownloadActiveDataset}
              className="flex items-center space-x-1 text-xs font-semibold px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/30 transition shrink-0"
              title="Download full CSV file of active data source"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        <div className="bg-ey-card border border-ey-border rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ey-muted">Total Data Rows</span>
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-ey-light font-mono">
            {loading ? '...' : (meta?.rowCount ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-ey-muted">Processed Usage Entries</p>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 text-xs font-medium ${statusMessage.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-ey-card border border-ey-border rounded-xl p-6 space-y-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-ey-border pb-4">
          <div>
            <h2 className="text-base font-bold text-ey-light">Upload New Usage Dataset</h2>
            <p className="text-xs text-ey-muted mt-0.5 flex items-center space-x-1.5">
              <span>Select or paste a CSV file matching the required columns.</span>
              <button
                onClick={handleDownloadTemplate}
                className="text-ey-yellow hover:underline font-medium inline-flex items-center space-x-1 ml-1"
              >
                <Download className="w-3 h-3" />
                <span>Download Sample Template</span>
              </button>
            </p>
          </div>

          <div className="flex items-center bg-ey-black/50 border border-ey-border p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'upload' ? 'bg-ey-yellow text-ey-black font-semibold' : 'text-ey-muted hover:text-ey-light'
                }`}
            >
              Upload File
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'paste' ? 'bg-ey-yellow text-ey-black font-semibold' : 'text-ey-muted hover:text-ey-light'
                }`}
            >
              Paste CSV
            </button>
          </div>
        </div>

        {activeTab === 'upload' ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-ey-border hover:border-ey-yellow/60 bg-ey-black/30 hover:bg-ey-card/40 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 cursor-pointer transition-all duration-200"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <div className="p-3 bg-ey-yellow/15 border border-ey-yellow/30 text-ey-yellow rounded-full">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ey-light">
                {fileName ? fileName : 'Click to select CSV or drag & drop file here'}
              </p>
              <p className="text-xs text-ey-muted mt-1">Supports UTF-8 formatted CSV files up to 10MB</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-medium text-ey-muted">Paste Raw CSV String:</label>
            <textarea
              value={rawText}
              onChange={(e) => validateAndPreviewCsv(e.target.value, 'pasted_data.csv')}
              rows={8}
              placeholder="User Email,User Name,Year,Month,Product,Calculation Method,GenAI Tool Consumption,Credits,Cost USD,Cost (in $),CT/Non-CT,Country,Super Region,Service Line,Sub-Service Line 1,Sub-Service Line 2,Engagement Code,Engagement - Super Region,Engagement Service Line,Engagement Sub-Service Line,Engagement Competency,Engagement Invest Type,GDS Location,Cost Center,Portfolio - CT Product Family,Portfolio - CT Product,Entity,SL/SF,RS,GDS&#10;user@corp.com,User Name,2026,3,ChatGPT,Usage,1200,,1.84,1.84,CT,USA,USLI,Consulting,Business Consulting,Digital,E-1234,USLI,Consulting,Business Consulting,People Advisory,Growth,India,CC-CNS-101,Product Family A,Product A,Entity1,SL1,RS1,GDS1"
              className="w-full bg-ey-black/60 border border-ey-border rounded-xl p-3 text-xs text-ey-light font-mono focus:outline-none focus:border-ey-yellow"
            />
          </div>
        )}

        {/* Validation Errors */}
        {validationError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2 text-xs text-red-400">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Preview Section */}
        {parsedRows.length > 0 && !validationError && (
          <div className="space-y-4 border-t border-ey-border pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Schema Verified — Sample Preview ({parsedRows.length} rows shown)
                </h3>
              </div>
              <span className="text-xs text-ey-muted font-mono">{fileName}</span>
            </div>

            <div className="overflow-x-auto border border-ey-border/70 rounded-lg">
              <table className="w-full text-xs text-left text-ey-light">
                <thead className="bg-ey-black/60 text-ey-muted uppercase text-[10px] border-b border-ey-border font-mono">
                  <tr>
                    <th className="px-3 py-2">AI Tool</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Tokens</th>
                    <th className="px-3 py-2">Credits ($)</th>
                    <th className="px-3 py-2">Cost ($)</th>
                    <th className="px-3 py-2">Service Line</th>
                    <th className="px-3 py-2">Super Region</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ey-border/50">
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-ey-black/30">
                      <td className="px-3 py-2 font-semibold text-ey-yellow uppercase">{row.aiTool}</td>
                      <td className="px-3 py-2 text-ey-light">{row.userMail}</td>
                      <td className="px-3 py-2 font-mono text-ey-muted">{row.month}/{row.year}</td>
                      <td className="px-3 py-2">{row.calculationMethod}</td>
                      <td className="px-3 py-2 font-mono">{Number(row.tokenConsumption).toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-ey-muted">{row.credits === '' || row.credits === undefined ? 'null' : Number(row.credits).toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono text-emerald-400">${Number(row.cost).toFixed(2)}</td>
                      <td className="px-3 py-2">{row.serviceLine}</td>
                      <td className="px-3 py-2 text-ey-muted">{row.superRegion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={handleApplyDataset}
                disabled={uploading}
                className="flex items-center space-x-2 px-5 py-2.5 bg-ey-yellow text-ey-black font-bold text-xs rounded-xl shadow-lg shadow-yellow-500/10 hover:bg-yellow-400 transition-colors"
              >
                {uploading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Apply &amp; Set Active Dataset</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
