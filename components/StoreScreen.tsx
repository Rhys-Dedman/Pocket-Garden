
import React from 'react';
import { PageHeader } from './PageHeader';

interface StoreScreenProps {
  money: number;
  walletFlashActive?: boolean;
  onAddMoney: (amount: number) => void;
}

const BUILD_VERSION = '1.1.6';

export const StoreScreen: React.FC<StoreScreenProps> = ({ money, walletFlashActive, onAddMoney }) => {
  return (
    <div className="h-full w-full flex flex-col overflow-y-auto no-scrollbar">
      <PageHeader money={money} walletFlashActive={walletFlashActive} />
      
      {/* Build version indicator */}
      <div className="text-center text-white/40 text-[10px] font-mono mt-1">{BUILD_VERSION}</div>
      
      <div className="flex-grow flex flex-col items-center px-6 space-y-8">
        <div className="w-full text-center mt-4">
          <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Emporium</h2>
          <div className="text-[10px] font-bold text-white/30 tracking-[0.3em] uppercase">Marketplace & Deals</div>
        </div>

        <div className="w-full flex flex-col space-y-4">
          <div className="bg-[#16181f] border border-white/10 rounded-[24px] p-6 flex flex-col items-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20">
               <img src="https://cdn-icons-png.flaticon.com/512/2489/2489756.png" alt="Gold" className="w-8 h-8" />
            </div>
            <div className="text-center">
              <div className="text-white font-black text-lg">FREE GOLD</div>
              <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Limited Time Offer</div>
            </div>
            <button 
              onClick={() => onAddMoney(100000)}
              className="w-full py-4 bg-[#a7c957] hover:bg-[#b8d968] active:scale-95 transition-all rounded-2xl flex items-center justify-center space-x-2 shadow-[0_8px_25px_rgba(167,201,87,0.3)]"
            >
              <span className="text-black font-black text-sm uppercase">+100,000 GOLD</span>
            </button>
          </div>

          <div className="bg-[#16181f]/50 border border-white/5 rounded-[24px] p-8 flex flex-col items-center justify-center space-y-2 opacity-50 grayscale">
            <div className="text-white/20 text-[10px] font-black uppercase tracking-widest">More Items Coming Soon</div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="w-1/3 h-full bg-white/10"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
