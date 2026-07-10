import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { GameData, levelOf } from '../services/game';

/** 顶栏常驻：功名等级 + 经验条 + 音效开关——进度随时可见，是「再来一张」的钩子 */
const GameHud: React.FC<{ game: GameData; onToggleSound: () => void }> = ({ game, onToggleSound }) => {
  const lv = levelOf(game.xp);
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5"
        title={`${lv.title}：${lv.motto}${lv.next !== null ? `（距下一功名还差 ${lv.next - game.xp} XP）` : ''}`}
      >
        <span className="text-base leading-none">🎓</span>
        <div className="min-w-[92px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-amber-800">{lv.title}</span>
            <span className="text-[10px] text-amber-600 tabular-nums">{game.xp} XP</span>
          </div>
          <div className="mt-0.5 h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(lv.progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
      <button
        onClick={onToggleSound}
        title={game.soundOn ? '关闭音效' : '开启音效'}
        className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
      >
        {game.soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default GameHud;
