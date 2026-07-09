import React, { useRef, useState } from "react";
import * as xlsx from "xlsx";
import { Upload, FileSpreadsheet, XCircle, CheckCircle } from "lucide-react";

export interface ExcelFileType {
  id: string;
  label: string;
}

interface ExcelUploaderProps {
  onDataLoaded: (type: string, data: any[], secondaryData?: any[]) => void;
  isLoading: boolean;
  fileTypes: ExcelFileType[];
  title?: string;
  hints?: React.ReactNode;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({ 
  onDataLoaded, 
  isLoading, 
  fileTypes, 
  title = "Excel / CSV Veri Yükleme (Modüler)", 
  hints 
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileType, setFileType] = useState<string>(fileTypes[0]?.id || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const processExcel = async () => {
    if (selectedFiles.length === 0) return;

    let allPrimaryData: any[] = [];
    let allSecondaryData: any[] = [];
    let isMultiSheet = false;
    
    for (const file of selectedFiles) {
      const result = await new Promise<{ primary: any[]; secondary: any[]; hasTwo: boolean }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = xlsx.read(data, { type: "array" });
            
            // Helper for resilient sheet names (e.g. Sahibinden_Danismanlar vs Sahibinden Danismanlar)
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
              
              const enrichedPrimary = primaryRows.map((row: any) => ({ ...row, _sourceFile: file.name }));
              const enrichedSecondary = secondaryRows.map((row: any) => ({ ...row, _sourceFile: file.name }));

              resolve({ primary: enrichedPrimary, secondary: enrichedSecondary, hasTwo: true });
            } else {
              // Standard single sheet
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
              const enrichedData = jsonData.map((row: any) => ({ ...row, _sourceFile: file.name }));
              resolve({ primary: enrichedData, secondary: [], hasTwo: false });
            }
          } catch (error) {
            console.error("Excel parse error:", error);
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      allPrimaryData = [...allPrimaryData, ...result.primary];
      if (result.hasTwo) {
        allSecondaryData = [...allSecondaryData, ...result.secondary];
        isMultiSheet = true;
      }
    }
    
    if (isMultiSheet) {
      onDataLoaded(fileType, allPrimaryData, allSecondaryData);
    } else {
      onDataLoaded(fileType, allPrimaryData);
    }
    
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-blue-600" />
        {title}
      </h3>
      
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {fileTypes.length > 1 && (
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="text-sm border border-slate-300 rounded px-3 py-2 bg-white text-slate-700 outline-none focus:border-blue-500"
            disabled={isLoading}
          >
            {fileTypes.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        )}
        
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isLoading}
          multiple
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded text-sm hover:bg-slate-100 transition-colors flex items-center gap-2"
          disabled={isLoading}
        >
          <Upload className="w-4 h-4" />
          {selectedFiles.length > 0 ? `${selectedFiles.length} Dosya Seçildi` : "Dosya Seç..."}
        </button>

        {selectedFiles.length > 0 && (
          <button
            onClick={processExcel}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Yükle ve İşle
          </button>
        )}
        
        {selectedFiles.length > 0 && !isLoading && (
           <button
             onClick={() => {
               setSelectedFiles([]);
               if (fileInputRef.current) fileInputRef.current.value = "";
             }}
             className="text-slate-500 hover:text-red-500 transition-colors p-2"
           >
             <XCircle className="w-4 h-4" />
           </button>
        )}
      </div>
      
      {hints && (
        <div className="mt-3 text-xs text-slate-500">
          {hints}
        </div>
      )}
    </div>
  );
};
