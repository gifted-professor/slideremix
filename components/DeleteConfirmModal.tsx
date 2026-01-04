import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 transform transition-all scale-100">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600 mx-auto">
            <Trash2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 text-center mb-2">确认删除项目？</h3>
          <p className="text-sm text-slate-500 text-center leading-relaxed">
            删除后无法恢复。确定要继续吗？
          </p>
        </div>
        
        <div className="flex border-t border-slate-100 divide-x divide-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="flex-1 py-3 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="flex-1 py-3 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
