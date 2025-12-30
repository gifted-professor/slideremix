import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcess(e.target.files[0]);
    }
    // 重置 input value，确保即使再次选择同一个文件也能触发 change 事件
    if (e.target) {
      e.target.value = '';
    }
  };

  const validateAndProcess = (file: File) => {
    if (file.type.startsWith('image/')) {
      onFileSelected(file);
    } else {
      alert("请上传图片文件 (JPG, PNG)。");
    }
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full h-96 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50' 
          : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}
      `}
    >
      <div className={`p-4 rounded-full mb-4 ${isDragging ? 'bg-indigo-200' : 'bg-white shadow-sm'}`}>
        <UploadCloud size={32} className={isDragging ? 'text-indigo-600' : 'text-slate-400'} />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">点击上传或拖拽文件到此处</h3>
      <p className="text-sm text-slate-500">支持 JPG, PNG (最大 10MB)</p>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileInput}
      />
    </div>
  );
};

export default UploadZone;