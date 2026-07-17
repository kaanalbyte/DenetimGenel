import React, { useRef, useState } from "react";
import * as xlsx from "xlsx";
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  Check, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  HelpCircle,
  FileCheck2
} from "lucide-react";

export interface ExcelFileType {
  id: string;
  label: string;
}

interface ExcelUploaderProps {
  onDataLoaded: (type: string, data: any[], secondaryData?: any[]) => Promise<boolean> | void;
  isLoading: boolean;
  fileTypes: ExcelFileType[];
  title?: string;
  hints?: React.ReactNode;
}

interface UploadFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string; // 'danisman' | 'ilan_panel' | 'ilan_sahibinden'
  status: 'idle' | 'parsing' | 'ready' | 'uploading' | 'success' | 'error';
  primaryData?: any[];
  secondaryData?: any[];
  rowCount?: number;
  secondaryCount?: number;
  errorMsg?: string;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const detectCategory = (filename: string): string => {
  const name = filename.toLowerCase();
  
  if (name.includes("akullanici") || name.includes("akullanıcı")) {
    return "danisman";
  } else if (name.includes("cb_kullanici") || name.includes("cb kullanici") || name.includes("cb_kullanıcı") || name.includes("cb kullanıcı") ||
             name.includes("c21_kullanici") || name.includes("c21 kullanici") || name.includes("c21_kullanıcı") || name.includes("c21 kullanıcı") ||
             name.includes("era_kullanici") || name.includes("era kullanici") || name.includes("era_kullanıcı") || name.includes("era kullanıcı") ||
             name.includes("ofis_kullanici") || name.includes("ofis kullanici") || name.includes("ofiskullanici") || name.includes("kullanicilari") || name.includes("kullanıcıları")) {
    return "ofis_kullanicilari";
  } else if (name.includes("kullanici") || name.includes("kullanıcı") || name.includes("kadro") || name.includes("danisman") || name.includes("personel") || name.includes("user")) {
    return "danisman";
  } else if (name.includes("ilan") || name.includes("panel") || name.includes("portfoy") || name.includes("portfolio") || name.includes("listing")) {
    return "ilan_panel";
  } else if (name.includes("platform_icerik") || name.includes("sahibinden") || name.includes("kacak") || name.includes("ozet") || name.includes("portal") || name.includes("aktif")) {
    return "ilan_sahibinden";
  }
  return "danisman"; // Default fallback
};

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({ 
  onDataLoaded, 
  isLoading: parentIsLoading, 
  fileTypes, 
  title = "Excel / CSV Çoklu Veri Yükleme", 
  hints 
}) => {
  const [uploadItems, setUploadItems] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isInternalParsing, setIsInternalParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    const updated = [...uploadItems];
    newFiles.forEach(file => {
      // Check if file is already added
      const exists = updated.some(item => item.name === file.name && item.size === file.size);
      if (!exists) {
        const detected = detectCategory(file.name);
        updated.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: detected,
          status: 'idle'
        });
      }
    });
    setUploadItems(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeItem = (id: string) => {
    setUploadItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    setUploadItems([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const changeItemType = (id: string, newType: string) => {
    setUploadItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, type: newType };
      }
      return item;
    }));
  };

  const parseSingleItem = (item: UploadFileItem): Promise<UploadFileItem> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = xlsx.read(data, { type: "array" });
          
          // Helper for sheet lookup
          const findSheet = (searchNames: string[]) => {
            const normalizedSearch = searchNames.map(s => s.toLowerCase().replace(/[\s\-_]+/g, ""));
            for (const name of workbook.SheetNames) {
              const normName = name.toLowerCase().replace(/[\s\-_]+/g, "");
              if (normalizedSearch.includes(normName)) {
                return workbook.Sheets[name];
              }
            }
            return null;
          };

          const sheet1 = findSheet(["Sahibinden_Danismanlar", "SahibindenDanismanlar", "Sahibinden_Danisman", "Sahibinden"]);
          const sheet2 = findSheet(["Kacak_Sahibinden", "KacakSahibinden", "Kacak_Sahibinden_Danisman", "Kacak"]);

          if (sheet1 || sheet2) {
            const primaryRows = sheet1 ? xlsx.utils.sheet_to_json(sheet1, { defval: "" }) : [];
            const secondaryRows = sheet2 ? xlsx.utils.sheet_to_json(sheet2, { defval: "" }) : [];
            
            const enrichedPrimary = primaryRows.map((row: any) => ({ ...row, _sourceFile: item.name }));
            const enrichedSecondary = secondaryRows.map((row: any) => ({ ...row, _sourceFile: item.name }));

            resolve({
              ...item,
              status: 'ready',
              primaryData: enrichedPrimary,
              secondaryData: enrichedSecondary,
              rowCount: enrichedPrimary.length,
              secondaryCount: enrichedSecondary.length
            });
          } else {
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
              resolve({
                ...item,
                status: 'error',
                errorMsg: "Boş Excel dosyası"
              });
              return;
            }
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
            const enrichedData = jsonData.map((row: any) => ({ ...row, _sourceFile: item.name }));
            
            resolve({
              ...item,
              status: 'ready',
              primaryData: enrichedData,
              rowCount: enrichedData.length
            });
          }
        } catch (error: any) {
          console.error("Excel okuma hatası:", error);
          resolve({
            ...item,
            status: 'error',
            errorMsg: error.message || "Excel dosyası okunamadı"
          });
        }
      };
      reader.onerror = () => {
        resolve({
          ...item,
          status: 'error',
          errorMsg: "Dosya yüklenirken hata oluştu"
        });
      };
      reader.readAsArrayBuffer(item.file);
    });
  };

  const handleBulkUpload = async () => {
    if (uploadItems.length === 0) return;
    
    setIsInternalParsing(true);
    
    // Step 1: Parse all files
    const parsedItems: UploadFileItem[] = [];
    for (const item of uploadItems) {
      if (item.status === 'success') {
        parsedItems.push(item);
        continue;
      }
      
      // Update status to parsing in UI
      setUploadItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'parsing' } : p));
      
      const parsed = await parseSingleItem(item);
      parsedItems.push(parsed);
      
      setUploadItems(prev => prev.map(p => p.id === item.id ? parsed : p));
    }
    
    setIsInternalParsing(false);

    // Filter out files with errors
    const validItems = parsedItems.filter(item => item.status === 'ready' || item.status === 'success');
    if (validItems.length === 0) {
      alert("Yüklenebilecek geçerli dosya bulunamadı. Lütfen hataları kontrol edin.");
      return;
    }

    setIsUploading(true);

    // Step 2: Group by type
    const groups: { [key: string]: { primary: any[], secondary: any[], itemIds: string[] } } = {
      danisman: { primary: [], secondary: [], itemIds: [] },
      ilan_panel: { primary: [], secondary: [], itemIds: [] },
      ilan_sahibinden: { primary: [], secondary: [], itemIds: [] },
      ofis_kullanicilari: { primary: [], secondary: [], itemIds: [] }
    };

    validItems.forEach(item => {
      if (item.status === 'success') return; // skip already uploaded
      
      const t = item.type;
      if (groups[t]) {
        if (item.primaryData) groups[t].primary.push(...item.primaryData);
        if (item.secondaryData) groups[t].secondary.push(...item.secondaryData);
        groups[t].itemIds.push(item.id);
      }
    });

    // Step 3: Send grouped data to server
    let overallSuccess = true;
    for (const [type, payload] of Object.entries(groups)) {
      if (payload.itemIds.length === 0) continue;

      // Mark items of this category as uploading
      setUploadItems(prev => prev.map(p => payload.itemIds.includes(p.id) ? { ...p, status: 'uploading' } : p));

      try {
        const result = await onDataLoaded(type, payload.primary, payload.secondary);
        const isSuccess = result !== false; // if returns void or true, consider success
        
        if (isSuccess) {
          setUploadItems(prev => prev.map(p => payload.itemIds.includes(p.id) ? { ...p, status: 'success' } : p));
        } else {
          overallSuccess = false;
          setUploadItems(prev => prev.map(p => payload.itemIds.includes(p.id) ? { ...p, status: 'error', errorMsg: "Sunucu hatası" } : p));
        }
      } catch (err: any) {
        overallSuccess = false;
        setUploadItems(prev => prev.map(p => payload.itemIds.includes(p.id) ? { ...p, status: 'error', errorMsg: err.message || "Yükleme hatası" } : p));
      }
    }

    setIsUploading(false);

    if (overallSuccess) {
      // Clear files that were uploaded successfully after 3 seconds, or keep them for display
      setTimeout(() => {
        setUploadItems(prev => prev.filter(item => item.status !== 'success'));
      }, 3500);
    }
  };

  const isBusy = parentIsLoading || isInternalParsing || isUploading;

  // Count items by category
  const getCategoryCountText = () => {
    const counts = { danisman: 0, ilan_panel: 0, ilan_sahibinden: 0 };
    uploadItems.forEach(item => {
      if (item.status !== 'success') {
        counts[item.type as keyof typeof counts] = (counts[item.type as keyof typeof counts] || 0) + 1;
      }
    });
    const parts = [];
    if (counts.danisman > 0) parts.push(`${counts.danisman}x Resmi Kadro`);
    if (counts.ilan_panel > 0) parts.push(`${counts.ilan_panel}x Resmi Portföy`);
    if (counts.ilan_sahibinden > 0) parts.push(`${counts.ilan_sahibinden}x Sahibinden`);
    return parts.join(", ");
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Title Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          {title}
        </h3>
        {uploadItems.length > 0 && (
          <button
            onClick={clearAll}
            disabled={isBusy}
            className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Tümünü Temizle
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-2
            ${isDragging 
              ? "border-blue-500 bg-blue-50/50 scale-[0.99]" 
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/40"
            } ${isBusy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isBusy}
            multiple
          />
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 mb-1">
            <Upload className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">
              Excel dosyalarını buraya sürükleyin veya <span className="text-blue-600 hover:underline">dosya seçmek için tıklayın</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Birden fazla dosya seçebilir veya sürükleyebilirsiniz (Maks. 10MB/dosya)
            </p>
          </div>
        </div>

        {/* Selected Files List */}
        {uploadItems.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono">
                Seçilen Dosyalar ({uploadItems.length})
              </span>
              <span className="text-[10px] text-slate-400">
                Sistem kategori tipini dosya adından otomatik tahmin eder. Gerekirse listeden değiştirebilirsiniz.
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1">
              {uploadItems.map((item) => (
                <div key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs first:pt-0 last:pb-0">
                  
                  {/* File Info */}
                  <div className="flex items-center gap-2.5 min-w-[240px] max-w-full truncate">
                    {item.status === 'success' ? (
                      <div className="w-7 h-7 bg-emerald-50 rounded flex items-center justify-center shrink-0 border border-emerald-100">
                        <Check className="w-4 h-4 text-emerald-600" />
                      </div>
                    ) : item.status === 'error' ? (
                      <div className="w-7 h-7 bg-rose-50 rounded flex items-center justify-center shrink-0 border border-rose-100">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 bg-slate-50 rounded flex items-center justify-center shrink-0 border border-slate-150">
                        <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                      </div>
                    )}

                    <div className="truncate space-y-0.5">
                      <p className="font-semibold text-slate-700 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {formatSize(item.size)}
                      </p>
                    </div>
                  </div>

                  {/* Settings and Status */}
                  <div className="flex items-center gap-3">
                    {/* Category Dropdown */}
                    {item.status !== 'success' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori:</span>
                        <select
                          value={item.type}
                          onChange={(e) => changeItemType(item.id, e.target.value)}
                          disabled={isBusy}
                          className="text-[11px] border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 outline-none focus:border-blue-500 font-medium cursor-pointer"
                        >
                          {fileTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                        {fileTypes.find(t => t.id === item.type)?.label.split(" ")[1] || item.type}
                      </span>
                    )}

                    {/* Status Badge */}
                    <div className="min-w-[100px] text-right">
                      {item.status === 'idle' && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100">
                          Hazır
                        </span>
                      )}
                      {item.status === 'parsing' && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50/50 px-2 py-0.5 rounded border border-amber-100 flex items-center justify-end gap-1 font-mono">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                          Okunuyor
                        </span>
                      )}
                      {item.status === 'ready' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          ✓ {item.rowCount} Satır
                          {item.secondaryCount ? ` + ${item.secondaryCount} Kaçak` : ""}
                        </span>
                      )}
                      {item.status === 'uploading' && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100 flex items-center justify-end gap-1 font-mono">
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                          Yükleniyor
                        </span>
                      )}
                      {item.status === 'success' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          ✓ Başarılı
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100" title={item.errorMsg}>
                          ⚠️ {item.errorMsg || "Hata"}
                        </span>
                      )}
                    </div>

                    {/* Remove Action */}
                    {!isBusy && item.status !== 'success' && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition cursor-pointer"
                        title="Dosyayı kaldır"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* Bulk Action Controls */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 flex flex-wrap items-center justify-between gap-3 mt-4">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Yüklenecek özet: <strong className="text-slate-700">{getCategoryCountText() || "Seçilen tüm dosyalar yüklendi"}</strong></span>
              </div>
              
              {uploadItems.some(item => item.status !== 'success') && (
                <button
                  onClick={handleBulkUpload}
                  disabled={isBusy}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-sm"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isInternalParsing ? "Excel Okunuyor..." : "Toplu Yükleniyor..."}</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Seçilenleri Toplu Yükle ({uploadItems.filter(i => i.status !== 'success').length} Dosya)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Informational Guidance Cards / Hints */}
        {hints && (
          <div className="text-xs text-slate-500">
            {hints}
          </div>
        )}
      </div>
    </div>
  );
};
