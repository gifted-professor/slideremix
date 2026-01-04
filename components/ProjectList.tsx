import React, { useEffect, useState } from 'react';
import { dbService, Project } from '../services/database';
import { Clock, Trash2, FolderOpen, Loader2, AlertCircle, FileImage } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import DeleteConfirmModal from './DeleteConfirmModal';

interface ProjectListProps {
  onLoadProject: (project: Project) => void;
  onClose: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onLoadProject, onClose }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await dbService.getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      setDeletingId(id);
      await dbService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <FolderOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">我的项目</h2>
              <p className="text-xs text-slate-500">管理并加载您保存的幻灯片重构项目</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm">正在加载项目列表...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 text-center px-8">
              <AlertCircle size={48} className="text-indigo-200 mb-2" />
              <h3 className="font-semibold text-slate-700">无法加载项目</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                {error.includes('Could not find the table') 
                  ? "数据库尚未初始化。请在 Supabase SQL 编辑器中运行建表脚本以开始使用。" 
                  : error}
              </p>
              <button onClick={loadProjects} className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
                重试连接
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 border-2 border-dashed border-slate-100 rounded-xl p-8 bg-slate-50/50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                <FolderOpen size={32} className="text-indigo-200" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-slate-700 mb-1">还没有保存的项目</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  当前没有任何项目。您可以上传一张幻灯片截图开始编辑，完成后点击右上角的 <span className="font-bold text-emerald-600">保存项目</span> 按钮。
                </p>
              </div>
              <button 
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all"
              >
                去创建一个
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((project) => (
                <div 
                  key={project.id}
                  onClick={() => onLoadProject(project)}
                  className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 cursor-pointer transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-400 border border-slate-200 overflow-hidden">
                    {project.thumbnail_url && !project.thumbnail_url.startsWith('blob:') ? (
                       <img src={project.thumbnail_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                       <FileImage size={20} />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                      {project.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(project.created_at), { addSuffix: true, locale: zhCN })}
                      </span>
                      <span>•</span>
                      <span>{project.slide_data.elements.length} 个元素</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteClick(e, project.id)}
                    disabled={deletingId === project.id}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="删除项目"
                  >
                    {deletingId === project.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {confirmDeleteId && (
        <DeleteConfirmModal 
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

export default ProjectList;
