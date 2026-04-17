'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EMOJIS = ['☕','🥛','🫘','🍵','🧋','🎨','📓','🌿','🍫','☀️','🌙','❤️','🔥','✨','🐻','🌸','🍰','🧁','🫖','📷'];

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('☕');
  const [password, setPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!name.trim()) { setError('请输入笔记本名称'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), emoji, password: password || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // If has password, verify to set cookie
      if (password) {
        await fetch(`/api/notebooks/${data.notebook.share_code}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
      }

      router.push(`/nb/${data.notebook.share_code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleJoin() {
    const code = joinCode.trim().toLowerCase();
    if (!code) { setError('请输入分享码'); return; }
    router.push(`/nb/${code}`);
  }

  return (
    <div className="landing">
      <header>
        <h1>☕ 拉花日记本</h1>
        <p>Latte Art Diary — 每一杯，都是一次小小的创作</p>
      </header>

      <div className="landing-container">
        {!mode && (
          <div className="landing-card">
            <h2>开始记录你的咖啡旅程</h2>
            <p className="landing-desc">创建一个云端笔记本，随时记录、随处访问，还能与朋友共享。</p>
            <button className="btn-primary" onClick={() => setMode('create')}>
              ✨ 创建新笔记本
            </button>
            <button className="btn-secondary" onClick={() => setMode('join')}>
              🔗 输入分享码加入
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="landing-card">
            <h2>创建新笔记本</h2>

            <div className="field">
              <label>笔记本名称</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="例如：拉花练习日记" maxLength={20} autoFocus
              />
            </div>

            <div className="field">
              <label>选择图标</label>
              <div className="emoji-grid">
                {EMOJIS.map(e => (
                  <button key={e} className={`emoji-opt${e === emoji ? ' sel' : ''}`}
                    onClick={() => setEmoji(e)}>{e}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>访问密码 <span className="hint">（可选，留空则任何人可编辑）</span></label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="设置密码保护你的笔记本"
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="btn-row">
              <button className="btn-secondary" onClick={() => { setMode(null); setError(''); }}>返回</button>
              <button className="btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? '创建中...' : '创建笔记本'}
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="landing-card">
            <h2>加入笔记本</h2>
            <p className="landing-desc">输入朋友分享给你的 6 位分享码</p>

            <div className="field">
              <label>分享码</label>
              <input
                type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                placeholder="例如：abc123" maxLength={10} autoFocus
                className="code-input"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="btn-row">
              <button className="btn-secondary" onClick={() => { setMode(null); setError(''); }}>返回</button>
              <button className="btn-primary" onClick={handleJoin}>进入笔记本</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
