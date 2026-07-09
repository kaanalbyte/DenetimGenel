import React, { useRef, useState } from "react";
import * as xlsx from "xlsx";
import { Upload, FileSpreadsheet, XCircle, CheckCircle } from "lucide-react";

export interface ExcelFileType {
  id: string;
  label: string;
}

interface ExcelUploaderProps {
  onDataLoaded: (type: string, data: any[]) => void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string>(fileTypes[0]?.id || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const processExcel = () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert Excel data to JSON
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
        
        onDataLoaded(fileType, jsonData);
        
        // Reset after upload
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        console.error("Excel parse error:", error);
        alert("Excel dosyası okunurken bir hata oluştu.");
      }
    };
    reader.readAsBinaryString(selectedFile);
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
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded text-sm hover:bg-slate-100 transition-colors flex items-center gap-2"
          disabled={isLoading}
        >
          <Upload className="w-4 h-4" />
          {selectedFile ? selectedFile.name : "Dosya Seç..."}
        </button>

        {selectedFile && (
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
        
        {selectedFile && !isLoading && (
           <button
             onClick={() => {
               setSelectedFile(null);
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
