import { useState, useEffect, useRef } from 'react';
import {
  Plus, Sparkles, Dices, Heart, Trash2, RefreshCw, X, Users,
  Send, Grid3x3, GitBranch, Archive, ArchiveRestore, Tag as TagIcon,
  Pencil, Check
} from 'lucide-react';

// ============================================================
// 便签配色 (糖果色系)
// ============================================================
const NOTE_COLORS = [
  { bg: '#FFE864', tape: '#F5C518', name: '阳光' },
  { bg: '#FFB8D9', tape: '#F58AB4', name: '泡泡糖' },
  { bg: '#B8F5D0', tape: '#7FD9A0', name: '薄荷' },
  { bg: '#A8D9FF', tape: '#6FB8F0', name: '晴空' },
  { bg: '#FFCDA8', tape: '#F0A06F', name: '蜜桃' },
  { bg: '#D9B8FF', tape: '#B088F0', name: '熏衣草' },
];

const RANDOM_PROMPTS = [
  '如果预算翻 10 倍,你会怎么做?',
  '如果只能用一句话解释它,你会说什么?',
  '10 岁的小孩会怎么理解这个问题?',
  '如果必须在明天完成,你会砍掉什么?',
  '最糟糕的解决方案是什么?(然后反过来想)',
  '如果这是一个实体产品,它会是什么样?',
  '用户最不愿意承认的痛点是什么?',
  '如果我们是行业里的反派,会怎么做?',
  '把两个不相关的东西组合在一起试试',
  '如果没有互联网,这件事会怎么做?',
  '最奢侈的版本长什么样?',
  '哪些假设我们从来没有质疑过?',
  '如果必须免费,怎么赚钱?',
  '如果必须收 10 倍的价格,怎么证明值?',
  '100 年后的人会怎么看这个?',
  '如果要拍成电影,主角是谁?',
  '哪个环节最无聊?能不能变好玩?',
  '如果删掉 80% 的功能,留下哪 20%?',
];

const STORAGE_KEY = 'brainstorm:board-v1';

// ============================================================
// 字体注入
// ============================================================
function useGoogleFonts() {
  useEffect(() => {
    if (document.getElementById('bs-fonts')) return;
    const link = document.createElement('link');
    link.id = 'bs-fonts';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Kalam:wght@300;400;700&family=Gaegu:wght@400;700&family=Shadows+Into+Light&display=swap';
    document.head.appendChild(link);
  }, []);
}

// ============================================================
// 手绘 SVG 滤镜 (全局只注入一次)
// ============================================================
function SketchFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="roughen">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="1" />
          <feDisplacementMap in="SourceGraphic" scale="2" />
        </filter>
        <filter id="paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="noise" />
          <feColorMatrix
            in="noise"
            values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.12 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

// ============================================================
// 工具函数
// ============================================================
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pickColor = () => NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];

// ============================================================
// 主组件
// ============================================================
export default function BrainstormBoard() {
  useGoogleFonts();

  const [userName, setUserName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [editingName, setEditingName] = useState(false);

  const [notes, setNotes] = useState([]);
  const [topic, setTopic] = useState('我们的头脑风暴');
  const [editingTopic, setEditingTopic] = useState(false);

  const [view, setView] = useState('wall'); // wall | mindmap | archive
  const [filterTag, setFilterTag] = useState(null);
  const [sortBy, setSortBy] = useState('recent'); // recent | votes | random

  const [draft, setDraft] = useState({ text: '', tag: '' });
  const [showDraft, setShowDraft] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ----------------------------------------------------------
  // 持久化加载 & 轮询同步
  // ----------------------------------------------------------
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const topicRef = useRef(topic);
  topicRef.current = topic;

  const loadFromStorage = async () => {
    try {
      const res = await window.storage.get(STORAGE_KEY, true);
      if (res && res.value) {
        const data = JSON.parse(res.value);
        if (Array.isArray(data.notes)) setNotes(data.notes);
        if (data.topic) setTopic(data.topic);
      }
    } catch (e) {
      // 第一次使用,无数据
    }
    setLoaded(true);
  };

  useEffect(() => {
    loadFromStorage();
    const iv = setInterval(loadFromStorage, 5000);
    return () => clearInterval(iv);
  }, []);

  // 初始化用户名(随机访客名,用户可点击修改)
  useEffect(() => {
    if (!userName) {
      const n = `访客${Math.floor(Math.random() * 900) + 100}`;
      setUserName(n);
      setNameInput(n);
    }
  }, []);

  const persist = async (nextNotes, nextTopic) => {
    setSyncing(true);
    try {
      await window.storage.set(
        STORAGE_KEY,
        JSON.stringify({
          notes: nextNotes ?? notesRef.current,
          topic: nextTopic ?? topicRef.current,
        }),
        true
      );
    } catch (e) {
      console.error('save failed', e);
    }
    setTimeout(() => setSyncing(false), 400);
  };

  // ----------------------------------------------------------
  // 笔记操作
  // ----------------------------------------------------------
  const addNote = (text, tag) => {
    if (!text || !text.trim()) return;
    const color = pickColor();
    const note = {
      id: rid(),
      text: text.trim(),
      bg: color.bg,
      tape: color.tape,
      rot: (Math.random() - 0.5) * 5,
      votes: 0,
      votedBy: [],
      tags: tag && tag.trim() ? [tag.trim()] : [],
      author: userName,
      createdAt: Date.now(),
      archived: false,
    };
    const next = [...notesRef.current, note];
    setNotes(next);
    persist(next);
  };

  const addBulk = (texts) => {
    const newNotes = texts
      .filter((t) => t && t.trim())
      .map((t) => {
        const color = pickColor();
        return {
          id: rid(),
          text: t.trim(),
          bg: color.bg,
          tape: color.tape,
          rot: (Math.random() - 0.5) * 5,
          votes: 0,
          votedBy: [],
          tags: ['AI'],
          author: userName + ' (AI)',
          createdAt: Date.now() + Math.random(),
          archived: false,
        };
      });
    const next = [...notesRef.current, ...newNotes];
    setNotes(next);
    persist(next);
  };

  const toggleVote = (id) => {
    const next = notesRef.current.map((n) => {
      if (n.id !== id) return n;
      const voted = n.votedBy?.includes(userName);
      const votedBy = voted
        ? n.votedBy.filter((u) => u !== userName)
        : [...(n.votedBy || []), userName];
      return { ...n, votedBy, votes: votedBy.length };
    });
    setNotes(next);
    persist(next);
  };

  const deleteNote = (id) => {
    const next = notesRef.current.filter((n) => n.id !== id);
    setNotes(next);
    persist(next);
  };

  const toggleArchive = (id) => {
    const next = notesRef.current.map((n) =>
      n.id === id ? { ...n, archived: !n.archived } : n
    );
    setNotes(next);
    persist(next);
  };

  const updateTag = (id, newTag) => {
    const next = notesRef.current.map((n) =>
      n.id === id ? { ...n, tags: newTag ? [newTag] : [] } : n
    );
    setNotes(next);
    persist(next);
  };

  // ----------------------------------------------------------
  // AI 生成
  // ----------------------------------------------------------
  const callAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const theme = aiTopic.trim() || topic;
      const prompt = `你是一位富有创意的头脑风暴教练。请为以下主题生成 6 个简短、有创意、差异化明显的想法。每个想法一句话,8-20 个汉字左右。

主题:${theme}

只返回一个 JSON 数组,格式示例:["想法一", "想法二", "想法三", "想法四", "想法五", "想法六"]
不要任何解释、不要 markdown 代码块,直接返回 JSON。`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const textBlock = data.content?.find((b) => b.type === 'text');
      let raw = textBlock?.text ?? '';
      raw = raw.replace(/```json|```/g, '').trim();
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);
      const ideas = JSON.parse(raw);
      if (!Array.isArray(ideas)) throw new Error('返回格式不对');
      addBulk(ideas);
      setAiOpen(false);
      setAiTopic('');
    } catch (e) {
      setAiError('AI 生成失败了,再试一次?(' + (e.message || 'unknown') + ')');
    }
    setAiLoading(false);
  };

  // ----------------------------------------------------------
  // 随机提示
  // ----------------------------------------------------------
  const rollPrompt = () => {
    let next;
    do {
      next = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    } while (next === currentPrompt && RANDOM_PROMPTS.length > 1);
    setCurrentPrompt(next);
  };

  // ----------------------------------------------------------
  // 派生数据
  // ----------------------------------------------------------
  const activeNotes = notes.filter((n) => !n.archived);
  const archivedNotes = notes.filter((n) => n.archived);
  const allTags = [...new Set(notes.flatMap((n) => n.tags || []))];

  const visibleNotes = (() => {
    let list = view === 'archive' ? archivedNotes : activeNotes;
    if (filterTag) list = list.filter((n) => n.tags?.includes(filterTag));
    if (sortBy === 'votes') list = [...list].sort((a, b) => b.votes - a.votes);
    else if (sortBy === 'recent') list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'random') list = [...list].sort(() => Math.random() - 0.5);
    return list;
  })();

  // ==========================================================
  // 渲染
  // ==========================================================
  const paperBg = {
    background:
      '#FFF8E7 radial-gradient(circle at 1px 1px, rgba(60,40,20,0.12) 1px, transparent 0) 0 0 / 22px 22px',
  };

  return (
    <div
      style={{
        ...paperBg,
        fontFamily: "'Kalam', 'Gaegu', system-ui, sans-serif",
        minHeight: '100vh',
        position: 'relative',
      }}
      className="text-stone-800"
    >
      <SketchFilters />

      {/* 噪点纸纹叠加 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.35,
          mixBlendMode: 'multiply',
        }}
      >
        <svg width="100%" height="100%">
          <rect width="100%" height="100%" filter="url(#paper)" />
        </svg>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }} className="max-w-7xl mx-auto px-4 py-6">
        {/* ========== 顶部标题栏 ========== */}
        <header className="mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-stone-600 mb-1" style={{ fontFamily: "'Caveat', cursive" }}>
                <Sparkles size={20} className="text-amber-500" />
                <span className="text-xl">欢迎来到头脑风暴板</span>
              </div>
              {editingTopic ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onBlur={() => {
                      setEditingTopic(false);
                      persist(null, topic);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingTopic(false);
                        persist(null, topic);
                      }
                    }}
                    className="text-4xl md:text-5xl bg-transparent border-b-2 border-dashed border-stone-400 outline-none font-bold w-full"
                    style={{ fontFamily: "'Caveat', cursive" }}
                  />
                </div>
              ) : (
                <h1
                  onClick={() => setEditingTopic(true)}
                  className="text-4xl md:text-5xl font-bold cursor-text hover:text-amber-700 transition-colors break-words"
                  style={{ fontFamily: "'Caveat', cursive" }}
                  title="点击编辑主题"
                >
                  {topic}
                  <Pencil size={18} className="inline ml-2 opacity-30" />
                </h1>
              )}
            </div>

            {/* 用户身份 */}
            <div className="flex items-center gap-3 bg-white/70 px-3 py-2 rounded-xl border-2 border-stone-800"
                 style={{ boxShadow: '3px 3px 0 #1c1917' }}>
              <Users size={18} />
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setUserName(nameInput.trim() || userName);
                        setEditingName(false);
                      }
                    }}
                    className="bg-transparent border-b border-stone-500 outline-none w-20 text-sm"
                  />
                  <button
                    onClick={() => {
                      setUserName(nameInput.trim() || userName);
                      setEditingName(false);
                    }}
                    className="text-emerald-600 hover:text-emerald-800"
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-sm font-bold hover:text-amber-700"
                  style={{ fontFamily: "'Kalam', sans-serif" }}
                >
                  {userName}
                </button>
              )}
              <button
                onClick={loadFromStorage}
                title="同步队友"
                className="text-stone-600 hover:text-stone-900"
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        {/* ========== 工具条 ========== */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <SketchBtn onClick={() => setShowDraft(true)} color="#FFE864">
            <Plus size={18} /> 新想法
          </SketchBtn>
          <SketchBtn onClick={() => setAiOpen(true)} color="#D9B8FF">
            <Sparkles size={18} /> AI 助力
          </SketchBtn>
          <SketchBtn onClick={rollPrompt} color="#B8F5D0">
            <Dices size={18} /> 随机提示
          </SketchBtn>

          <div className="ml-auto flex gap-1 bg-white/70 p-1 rounded-lg border-2 border-stone-800"
               style={{ boxShadow: '2px 2px 0 #1c1917' }}>
            <ViewTab active={view === 'wall'} onClick={() => setView('wall')} icon={Grid3x3} label="卡片墙" />
            <ViewTab active={view === 'mindmap'} onClick={() => setView('mindmap')} icon={GitBranch} label="思维导图" />
            <ViewTab active={view === 'archive'} onClick={() => setView('archive')} icon={Archive} label={`归档(${archivedNotes.length})`} />
          </div>
        </div>

        {/* 标签 + 排序 */}
        <div className="flex flex-wrap gap-2 mb-5 items-center text-sm">
          <TagIcon size={14} className="text-stone-600" />
          <TagChip active={filterTag === null} onClick={() => setFilterTag(null)}>全部</TagChip>
          {allTags.map((t) => (
            <TagChip key={t} active={filterTag === t} onClick={() => setFilterTag(filterTag === t ? null : t)}>
              {t}
            </TagChip>
          ))}
          <div className="ml-auto flex items-center gap-2 text-stone-600">
            <span style={{ fontFamily: "'Caveat', cursive" }} className="text-lg">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/70 border-2 border-stone-800 rounded-md px-2 py-0.5 outline-none"
              style={{ boxShadow: '2px 2px 0 #1c1917', fontFamily: "'Kalam', sans-serif" }}
            >
              <option value="recent">最新</option>
              <option value="votes">票数</option>
              <option value="random">随机</option>
            </select>
          </div>
        </div>

        {/* 随机提示横幅 */}
        {currentPrompt && (
          <div
            className="mb-5 p-4 rounded-xl border-2 border-stone-800 flex items-start gap-3"
            style={{
              background: '#FFF4B8',
              boxShadow: '4px 4px 0 #1c1917',
              transform: 'rotate(-0.4deg)',
            }}
          >
            <Dices size={22} className="mt-1 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-stone-600 mb-0.5"
                   style={{ fontFamily: "'Kalam', sans-serif" }}>今天的灵感题</div>
              <div className="text-2xl font-bold" style={{ fontFamily: "'Caveat', cursive" }}>
                {currentPrompt}
              </div>
            </div>
            <button onClick={() => setCurrentPrompt(null)} className="text-stone-500 hover:text-stone-800">
              <X size={18} />
            </button>
          </div>
        )}

        {/* ========== 主内容区 ========== */}
        {!loaded ? (
          <div className="text-center py-20 text-stone-500" style={{ fontFamily: "'Caveat', cursive", fontSize: 28 }}>
            正在拉便签板...
          </div>
        ) : view === 'mindmap' ? (
          <MindMap topic={topic} notes={activeNotes} />
        ) : visibleNotes.length === 0 ? (
          <EmptyState onAdd={() => setShowDraft(true)} onAI={() => setAiOpen(true)} view={view} />
        ) : (
          <div
            className="gap-4"
            style={{
              columnCount: 'auto',
              columnWidth: '220px',
              columnGap: '1rem',
            }}
          >
            {visibleNotes.map((n) => (
              <StickyNote
                key={n.id}
                note={n}
                userName={userName}
                onVote={() => toggleVote(n.id)}
                onDelete={() => deleteNote(n.id)}
                onArchive={() => toggleArchive(n.id)}
                onTag={(t) => updateTag(n.id, t)}
                archiveMode={view === 'archive'}
              />
            ))}
          </div>
        )}

        {/* 页脚 */}
        <footer className="mt-10 pt-5 border-t-2 border-dashed border-stone-300 text-center text-stone-500 text-sm"
                style={{ fontFamily: "'Caveat', cursive", fontSize: 18 }}>
          共 {activeNotes.length} 个想法 · {allTags.length} 个分类 · 团队共享 ✎
        </footer>
      </div>

      {/* ========== 新想法弹窗 ========== */}
      {showDraft && (
        <Modal onClose={() => setShowDraft(false)} title="贴一个新想法">
          <textarea
            autoFocus
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder="写下你刚冒出来的那个念头..."
            className="w-full p-3 border-2 border-stone-800 rounded-lg outline-none resize-none bg-yellow-50"
            style={{ minHeight: 100, fontFamily: "'Kalam', sans-serif", fontSize: 18, boxShadow: '3px 3px 0 #1c1917' }}
          />
          <input
            value={draft.tag}
            onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
            placeholder="标签(可选),例如: 产品、技术、灵感"
            className="w-full mt-3 p-2 border-2 border-stone-800 rounded-lg outline-none bg-white/70"
            style={{ fontFamily: "'Kalam', sans-serif", boxShadow: '3px 3px 0 #1c1917' }}
          />
          <div className="flex gap-2 justify-end mt-4">
            <SketchBtn onClick={() => setShowDraft(false)} color="#E7E5E4">取消</SketchBtn>
            <SketchBtn
              onClick={() => {
                addNote(draft.text, draft.tag);
                setDraft({ text: '', tag: '' });
                setShowDraft(false);
              }}
              color="#FFE864"
            >
              <Send size={16} /> 贴上去
            </SketchBtn>
          </div>
        </Modal>
      )}

      {/* ========== AI 弹窗 ========== */}
      {aiOpen && (
        <Modal onClose={() => !aiLoading && setAiOpen(false)} title="AI 帮我想 6 个">
          <p className="text-stone-600 mb-3" style={{ fontFamily: "'Kalam', sans-serif" }}>
            让 Claude 围绕一个方向快速扔 6 个想法上墙。留空会用主板的主题。
          </p>
          <input
            autoFocus
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder={`例如: ${topic}`}
            className="w-full p-2 border-2 border-stone-800 rounded-lg outline-none bg-white/70"
            style={{ fontFamily: "'Kalam', sans-serif", boxShadow: '3px 3px 0 #1c1917' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !aiLoading) callAI();
            }}
          />
          {aiError && (
            <div className="mt-3 p-2 bg-red-100 border-2 border-red-800 rounded text-red-900 text-sm"
                 style={{ fontFamily: "'Kalam', sans-serif" }}>
              {aiError}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <SketchBtn onClick={() => !aiLoading && setAiOpen(false)} color="#E7E5E4">取消</SketchBtn>
            <SketchBtn onClick={callAI} color="#D9B8FF" disabled={aiLoading}>
              <Sparkles size={16} /> {aiLoading ? '召唤中...' : '开始召唤'}
            </SketchBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// 便签组件
// ============================================================
function StickyNote({ note, userName, onVote, onDelete, onArchive, onTag, archiveMode }) {
  const [editingTag, setEditingTag] = useState(false);
  const [tagInput, setTagInput] = useState(note.tags?.[0] || '');
  const voted = note.votedBy?.includes(userName);

  return (
    <div
      className="mb-4 break-inside-avoid relative group"
      style={{
        background: note.bg,
        padding: '28px 16px 14px',
        borderRadius: 4,
        transform: `rotate(${note.rot}deg)`,
        boxShadow: '3px 4px 8px rgba(60,40,20,0.2), 0 0 0 1px rgba(60,40,20,0.08)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        fontFamily: "'Kalam', 'Gaegu', sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'rotate(0deg) scale(1.03)';
        e.currentTarget.style.boxShadow = '5px 7px 14px rgba(60,40,20,0.3), 0 0 0 1px rgba(60,40,20,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${note.rot}deg)`;
        e.currentTarget.style.boxShadow = '3px 4px 8px rgba(60,40,20,0.2), 0 0 0 1px rgba(60,40,20,0.08)';
      }}
    >
      {/* 胶带 */}
      <div
        style={{
          position: 'absolute',
          top: -8,
          left: '50%',
          width: 58,
          height: 18,
          background: note.tape,
          transform: 'translateX(-50%) rotate(-2deg)',
          opacity: 0.85,
          boxShadow: '1px 1px 3px rgba(0,0,0,0.15)',
        }}
      />

      {/* 文字 */}
      <p className="text-stone-900 text-base leading-snug whitespace-pre-wrap break-words"
         style={{ fontSize: 17, lineHeight: 1.4 }}>
        {note.text}
      </p>

      {/* 元信息 */}
      <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-stone-700">
        <span style={{ fontFamily: "'Caveat', cursive", fontSize: 15 }}>— {note.author}</span>
      </div>

      {/* 标签 */}
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        {editingTag ? (
          <input
            autoFocus
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={() => {
              onTag(tagInput.trim());
              setEditingTag(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onTag(tagInput.trim());
                setEditingTag(false);
              }
            }}
            className="text-xs bg-white/50 border border-stone-600 rounded px-1 outline-none w-20"
          />
        ) : note.tags?.length ? (
          note.tags.map((t) => (
            <span
              key={t}
              onClick={() => setEditingTag(true)}
              className="text-xs bg-black/10 px-2 py-0.5 rounded-full cursor-pointer hover:bg-black/20"
            >
              #{t}
            </span>
          ))
        ) : (
          <button
            onClick={() => setEditingTag(true)}
            className="text-xs text-stone-600 hover:text-stone-900 opacity-0 group-hover:opacity-100 transition"
          >
            + 标签
          </button>
        )}
      </div>

      {/* 操作栏 */}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onVote}
          className="flex items-center gap-1 text-sm hover:scale-110 transition"
          title={voted ? '取消投票' : '投一票'}
        >
          <Heart
            size={18}
            fill={voted ? '#E11D48' : 'none'}
            color={voted ? '#E11D48' : '#44403C'}
            strokeWidth={2.5}
          />
          <span className="font-bold">{note.votes}</span>
        </button>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={onArchive}
            className="p-1 hover:bg-black/10 rounded"
            title={archiveMode ? '恢复' : '归档'}
          >
            {archiveMode ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
          <button
            onClick={() => {
              if (confirm('删除这条想法?')) onDelete();
            }}
            className="p-1 hover:bg-red-200 rounded text-red-700"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 思维导图
// ============================================================
function MindMap({ topic, notes }) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-20 text-stone-500" style={{ fontFamily: "'Caveat', cursive", fontSize: 28 }}>
        先去卡片墙贴几个想法,导图就活了 ✎
      </div>
    );
  }

  const W = 900;
  const H = Math.max(500, notes.length * 48 + 200);
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.38;

  const positions = notes.map((n, i) => {
    const angle = (i / notes.length) * Math.PI * 2 - Math.PI / 2;
    const jitter = 20 + Math.random() * 30;
    return {
      x: cx + Math.cos(angle) * (R + jitter),
      y: cy + Math.sin(angle) * (R + jitter),
      note: n,
    };
  });

  return (
    <div className="bg-white/60 border-2 border-stone-800 rounded-xl overflow-auto"
         style={{ boxShadow: '4px 4px 0 #1c1917' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', minHeight: 500 }}>
        {/* 连线 */}
        {positions.map((p, i) => (
          <path
            key={'l' + i}
            d={`M ${cx} ${cy} Q ${(cx + p.x) / 2 + (Math.random() - 0.5) * 40} ${(cy + p.y) / 2 + (Math.random() - 0.5) * 40} ${p.x} ${p.y}`}
            stroke="#78716C"
            strokeWidth={2}
            fill="none"
            strokeDasharray="2 4"
            filter="url(#roughen)"
          />
        ))}

        {/* 中心主题 */}
        <g transform={`translate(${cx}, ${cy})`}>
          <ellipse
            rx={110}
            ry={55}
            fill="#FFE864"
            stroke="#1C1917"
            strokeWidth={3}
            filter="url(#roughen)"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Caveat', cursive"
            fontSize={28}
            fontWeight="bold"
            fill="#1C1917"
          >
            {topic.length > 10 ? topic.slice(0, 10) + '…' : topic}
          </text>
        </g>

        {/* 周围的想法 */}
        {positions.map((p, i) => {
          const text = p.note.text.length > 22 ? p.note.text.slice(0, 22) + '…' : p.note.text;
          const w = Math.min(180, Math.max(90, text.length * 10));
          return (
            <g key={p.note.id} transform={`translate(${p.x}, ${p.y}) rotate(${p.note.rot})`}>
              <rect
                x={-w / 2}
                y={-24}
                width={w}
                height={48}
                fill={p.note.bg}
                stroke="#1C1917"
                strokeWidth={2}
                filter="url(#roughen)"
                rx={4}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Kalam', sans-serif"
                fontSize={14}
                fill="#1C1917"
              >
                {text}
              </text>
              {p.note.votes > 0 && (
                <g transform={`translate(${w / 2 - 4}, ${-20})`}>
                  <circle r={10} fill="#E11D48" />
                  <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={11} fontWeight="bold">
                    {p.note.votes}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================
// 空状态
// ============================================================
function EmptyState({ onAdd, onAI, view }) {
  const msg = view === 'archive' ? '归档柜空空如也 📂' : '便签墙还很干净...\n来贴第一个想法吧!';
  return (
    <div className="text-center py-16">
      <div className="inline-block relative">
        <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto opacity-60">
          <path
            d="M 20 30 Q 60 10 100 30 Q 110 60 100 90 Q 60 110 20 90 Q 10 60 20 30 Z"
            fill="#FFE864"
            stroke="#1C1917"
            strokeWidth={3}
            filter="url(#roughen)"
          />
          <text x="60" y="70" textAnchor="middle" fontSize={40} fontFamily="'Caveat', cursive">?</text>
        </svg>
      </div>
      <p className="text-2xl text-stone-600 whitespace-pre-line mb-6" style={{ fontFamily: "'Caveat', cursive" }}>
        {msg}
      </p>
      {view !== 'archive' && (
        <div className="flex gap-3 justify-center">
          <SketchBtn onClick={onAdd} color="#FFE864"><Plus size={16} /> 手动贴一个</SketchBtn>
          <SketchBtn onClick={onAI} color="#D9B8FF"><Sparkles size={16} /> AI 帮我起头</SketchBtn>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 小组件
// ============================================================
function SketchBtn({ children, onClick, color = '#FFFFFF', disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 border-2 border-stone-800 rounded-lg font-bold text-sm flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 transition disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: color,
        boxShadow: '3px 3px 0 #1c1917',
        fontFamily: "'Kalam', sans-serif",
      }}
    >
      {children}
    </button>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 font-bold transition"
      style={{
        background: active ? '#1C1917' : 'transparent',
        color: active ? '#FEF3C7' : '#1C1917',
        fontFamily: "'Kalam', sans-serif",
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function TagChip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full border-2 border-stone-800 text-sm font-bold transition"
      style={{
        background: active ? '#1C1917' : '#FFFFFF',
        color: active ? '#FEF3C7' : '#1C1917',
        fontFamily: "'Kalam', sans-serif",
        boxShadow: active ? 'none' : '2px 2px 0 #1c1917',
        transform: active ? 'translate(2px, 2px)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(28,25,23,0.45)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-amber-50 border-2 border-stone-800 rounded-xl p-5 max-w-md w-full"
        style={{ boxShadow: '6px 6px 0 #1c1917' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-2xl font-bold" style={{ fontFamily: "'Caveat', cursive" }}>
            {title}
          </h3>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-900">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
