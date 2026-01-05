import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../services/supabase';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubscribe = async (priceId: string, mode: 'subscription' | 'payment' = 'subscription') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('请先登录以订阅服务');
        return;
      }

      // Use relative path for Vercel/Vite proxy
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          successUrl: window.location.origin + '/?payment=success',
          cancelUrl: window.location.origin + '/?payment=cancel',
          mode, // Pass the mode
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Network response was not ok');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error(err);
      alert('支付启动失败: ' + err.message + '\n\n请确认：\n1. 已启动后端服务 (node server.js)\n2. Stripe API Key 配置正确');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
        </button>
        
        <div className="p-8 text-center border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">选择您的计划</h2>
            <p className="text-slate-500">解锁 SlideRemix 的全部潜力</p>
        </div>

        <div className="grid md:grid-cols-2 gap-0">
            {/* Free Plan */}
            <div className="p-8 border-r border-slate-100">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-700">免费版</h3>
                    <div className="text-3xl font-bold text-slate-800 mt-2">$0 <span className="text-sm font-normal text-slate-500">/ 月</span></div>
                </div>
                <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-green-500"/> 基础 AI 图像重构</li>
                    <li className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-green-500"/> 每天 5 次生成额度</li>
                    <li className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-green-500"/> 导出标准清晰度图片</li>
                </ul>
                <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-medium text-sm">当前计划</button>
            </div>

            {/* Pro Plan */}
            <div className="p-8 bg-indigo-50/30">
                 <div className="mb-4">
                    <h3 className="text-lg font-bold text-indigo-700">专业版</h3>
                    <div className="text-3xl font-bold text-slate-800 mt-2">$19 <span className="text-sm font-normal text-slate-500">/ 月</span></div>
                </div>
                <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-indigo-500"/> 无限次 AI 生成</li>
                    <li className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-indigo-500"/> 高清无损导出</li>
                    <li className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-indigo-500"/> 优先处理队列</li>
                    <li className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-indigo-500"/> 商业授权</li>
                </ul>
                <button 
                    // Stripe Price ID for SlideRemix Pro (One-time / Alipay / WeChat)
                    // Uses CNY Price (¥128) to force Alipay/WeChat to appear
                    onClick={() => handleSubscribe('price_1Sm4HYK5603opciOazo2rG1b', 'payment')} 
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors shadow-sm shadow-blue-200 flex items-center justify-center"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : '支付宝 / 微信 (¥128/月)'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
