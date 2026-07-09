import React, { useRef, useState } from "react";
import * as xlsx from "xlsx";
import { Upload, FileSpreadsheet, XCircle, CheckCircle } from "lucide-react";

interface ExcelUploaderProps {
  onDataLoaded: (type: "danisman" | "ilan_panel" | "ilan_sahibinden", data: any[]) => void;
  isLoading: boolean;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({ onDataLoaded, isLoading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"danisman" | "ilan_panel" | "ilan_sahibinden">("danisman");
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
        
        // Data mapping/cleaning can be done here before sending up
        // We will just pass the raw parsed JSON and let the parent/backend handle the exact fields
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
        Excel / CSV Veri Yükleme (Modüler)
      </h3>
      
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as any)}
          className="text-sm border border-slate-300 rounded px-3 py-2 bg-white text-slate-700 outline-none focus:border-blue-500"
          disabled={isLoading}
        >
          <option value="danisman">Kaçak Danışman Listesi</option>
          <option value="ilan_panel">MasterTürk Panel İlan Raporu</option>
          <option value="ilan_sahibinden">Sahibinden.com İlan Raporu</option>
        </select>
        
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
      
      <div className="mt-3 text-xs text-slate-500">
        <p><strong>Danışman Listesi:</strong> <em>ofisKodu, danismanAdi, unvan, sahibindenSayisi, panelSayisi</em> kolonlarını içermelidir.</p>
        <p><strong>İlan Raporları:</strong> <em>ofisKodu, ilanSayisi</em> kolonlarını içermelidir.</p>
      </div>
    </div>
  );
};
