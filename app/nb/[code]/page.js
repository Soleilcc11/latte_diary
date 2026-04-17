'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

const MAX_PHOTOS = 5;
const MAX_NOTEBOOKS = 3;
const NB_STORAGE_KEY = 'latte_notebooks';
const EMOJIS = ['☕','🥛','🫘','🍵','🧋','🎨','📓','🌿','🍫','☀️','🌙','❤️','🔥','✨','🐻','🌸','🍰','🧁','🫖','📷'];

function getSavedNotebooks() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(NB_STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveNotebook(nb) {
  const list = getSavedNotebooks().filter(n => n.code !== nb.code);
  list.unshift(nb);
  if (list.length > MAX_NOTEBOOKS) list.length = MAX_NOTEBOOKS;
  localStorage.setItem(NB_STORAGE_KEY, JSON.stringify(list));
}

export default function NotebookPage() {
  const { code } = useParams();

  // ── State ──
  const [notebook, setNotebook] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [tab, setTab] = useState('new'); // new | review | stats
  const [entryDate, setEntryDate] = useState(todayStr());
  const [entryNotes, setEntryNotes] = useState('');
  const [currentPhotos, setCurrentPhotos] = useState([]); // URLs
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Lightbox
  const [lbPhotos, setLbPhotos] = useState([]);
  const [lbIndex, setLbIndex] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);

  // Notebook edit modal
  const [nbModal, setNbModal] = useState(false);
  const [nbEditName, setNbEditName] = useState('');
  const [nbEditEmoji, setNbEditEmoji] = useState('☕');

  const [savedNbs, setSavedNbs] = useState([]);

  const fileInputRef = useRef(null);

  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function toast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  }

  // ══════════════════
  //  LOAD NOTEBOOK
  // ══════════════════

  const loadNotebook = useCallback(async () => {
    try {
      const res = await fetch(`/api/notebooks/${code}`);
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setNotebook(data.notebook);

      if (data.notebook.has_password) {
        // Try loading entries to see if cookie is valid
        const er = await fetch(`/api/notebooks/${code}/entries`);
        if (er.status === 401) {
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
        const ed = await er.json();
        setEntries(ed.entries || []);
      } else {
        const er = await fetch(`/api/notebooks/${code}/entries`);
        const ed = await er.json();
        setEntries(ed.entries || []);
      }

      setNeedsPassword(false);
      setLoading(false);
    } catch {
      setNotFound(true);
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { loadNotebook(); }, [loadNotebook]);

  useEffect(() => {
    if (notebook) {
      saveNotebook({ code, name: notebook.name, emoji: notebook.emoji });
      setSavedNbs(getSavedNotebooks());
    }
  }, [notebook, code]);

  async function handlePasswordSubmit() {
    setPasswordError('');
    const res = await fetch(`/api/notebooks/${code}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput }),
    });
    if (!res.ok) {
      setPasswordError('密码错误');
      return;
    }
    setNeedsPassword(false);
    setLoading(true);
    await loadNotebook();
  }

  // ══════════════════
  //  PHOTO UPLOAD
  // ══════════════════

  async function uploadPhoto(file) {
    const formData = new FormData();

    // Compress client-side first
    const compressed = await compressImage(file);
    const blob = await fetch(compressed).then(r => r.blob());
    formData.append('file', blob, `photo_${Date.now()}.jpg`);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.url;
  }

  function compressImage(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 1200;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = h * MAX / w; w = MAX; } else { w = w * MAX / h; h = MAX; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files) {
    const newPhotos = [...currentPhotos];
    for (const file of files) {
      if (newPhotos.length >= MAX_PHOTOS) { toast(`最多 ${MAX_PHOTOS} 张`); break; }
      if (!file.type.startsWith('image/')) continue;
      try {
        const url = await uploadPhoto(file);
        newPhotos.push(url);
      } catch (err) {
        toast('上传失败: ' + err.message);
      }
    }
    setCurrentPhotos(newPhotos);
  }

  // Paste handler
  useEffect(() => {
    function onPaste(e) {
      if (tab !== 'new' || nbModal) return;
      const items = [...(e.clipboardData?.items || [])];
      const imgs = items.filter(i => i.type.startsWith('image/'));
      if (imgs.length === 0) return;
      e.preventDefault();
      const files = imgs.map(i => i.getAsFile()).filter(Boolean);
      handleFiles(files);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  // Drag reorder photos
  const dragIdx = useRef(null);

  function onDragStart(i) { dragIdx.current = i; }
  function onDragOver(e, i) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over-thumb');
  }
  function onDragLeave(e) { e.currentTarget.classList.remove('drag-over-thumb'); }
  function onDrop(e, i) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over-thumb');
    if (dragIdx.current !== null && dragIdx.current !== i) {
      const arr = [...currentPhotos];
      const [moved] = arr.splice(dragIdx.current, 1);
      arr.splice(i, 0, moved);
      setCurrentPhotos(arr);
    }
    dragIdx.current = null;
  }

  function removePhoto(i) {
    setCurrentPhotos(p => p.filter((_, idx) => idx !== i));
  }

  // ══════════════════
  //  SAVE / EDIT / DELETE
  // ══════════════════

  async function handleSave() {
    if (!entryDate) { toast('请选择日期'); return; }
    if (currentPhotos.length === 0 && !entryNotes.trim()) { toast('请至少添加一张照片或写点笔记'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/notebooks/${code}/entries/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: entryDate, notes: entryNotes.trim(), photos: currentPhotos }),
        });
        if (!res.ok) throw new Error('更新失败');
        toast('已更新');
      } else {
        const res = await fetch(`/api/notebooks/${code}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: entryDate, notes: entryNotes.trim(), photos: currentPhotos }),
        });
        if (!res.ok) throw new Error('保存失败');
        toast('已保存！又是美好的一杯 ☕');
      }
      // Reload entries
      const er = await fetch(`/api/notebooks/${code}/entries`);
      const ed = await er.json();
      setEntries(ed.entries || []);
      resetForm();
    } catch (err) {
      toast(err.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setCurrentPhotos([]);
    setEditingId(null);
    setEntryDate(todayStr());
    setEntryNotes('');
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setEntryDate(entry.date);
    setEntryNotes(entry.notes || '');
    setCurrentPhotos(entry.photos || []);
    setTab('new');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!confirm('确定删除这条记录吗？')) return;
    await fetch(`/api/notebooks/${code}/entries/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
    toast('已删除');
  }

  // ══════════════════
  //  NOTEBOOK EDIT
  // ══════════════════

  function openNbModal() {
    setNbEditName(notebook.name);
    setNbEditEmoji(notebook.emoji);
    setNbModal(true);
  }

  async function saveNbEdit() {
    if (!nbEditName.trim()) return;
    await fetch(`/api/notebooks/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nbEditName.trim(), emoji: nbEditEmoji }),
    });
    setNotebook(prev => ({ ...prev, name: nbEditName.trim(), emoji: nbEditEmoji }));
    saveNotebook({ code, name: nbEditName.trim(), emoji: nbEditEmoji });
    setSavedNbs(getSavedNotebooks());
    setNbModal(false);
    toast('已更新');
  }

  // ══════════════════
  //  LIGHTBOX
  // ══════════════════

  function openLightbox(photos, idx) {
    setLbPhotos(photos); setLbIndex(idx || 0); setLbOpen(true);
  }

  // ══════════════════
  //  RENDER HELPERS
  // ══════════════════

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const weekdays = ['日','一','二','三','四','五','六'];
    return {
      text: `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`,
      weekday: `周${weekdays[d.getDay()]}`,
    };
  }

  function getFilteredEntries() {
    if (!searchQuery) return entries;
    return entries.filter(e => e.notes?.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  function getStats() {
    const now = new Date();
    const total = entries.length;
    const thisMonth = entries.filter(e => {
      const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    let streak = 0;
    const dateSet = new Set(entries.map(e => e.date));
    for (let i = 0; i < 365; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      if (dateSet.has(d.toISOString().split('T')[0])) streak++; else if (i > 0) break;
    }
    const withPhoto = entries.filter(e => e.photos?.length > 0).length;
    return { total, thisMonth, streak, withPhoto };
  }

  function getCalendarData() {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayDate = now.getDate();
    const photoMap = {};
    const dateSet = new Set();
    entries.forEach(e => {
      dateSet.add(e.date);
      if (!photoMap[e.date] && e.photos?.length > 0) photoMap[e.date] = e.photos[0];
    });
    return { year, month, firstDay, daysInMonth, todayDate, photoMap, dateSet };
  }

  // ══════════════════
  //  RENDER
  // ══════════════════

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-icon">☕</div>
        <p>加载中...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="loading-screen">
        <div className="loading-icon">😕</div>
        <p>笔记本不存在</p>
        <a href="/" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block', textDecoration: 'none' }}>返回首页</a>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="landing">
        <header>
          <h1>☕ 拉花日记本</h1>
          <p>此笔记本需要密码才能访问</p>
        </header>
        <div className="landing-container">
          <div className="landing-card">
            <h2>🔒 输入密码</h2>
            <div className="field">
              <input
                type="password" value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="请输入访问密码" autoFocus
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
            {passwordError && <div className="error-msg">{passwordError}</div>}
            <button className="btn-primary" onClick={handlePasswordSubmit}>验证</button>
          </div>
        </div>
      </div>
    );
  }

  const stats = getStats();
  const cal = getCalendarData();
  const filtered = getFilteredEntries();
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/nb/${code}` : '';

  return (
    <div className="app">
      {/* Header */}
      <header>
        <h1>{notebook.emoji} {notebook.name}</h1>
        <p className="share-info" onClick={() => {
          navigator.clipboard?.writeText(shareUrl);
          toast('分享链接已复制！');
        }}>
          分享码: <strong>{code}</strong> · 点击复制链接
        </p>
      </header>

      {/* Notebook settings */}
      <div className="notebook-bar">
        {savedNbs.map(nb => (
          nb.code === code ? (
            <button key={nb.code} className="nb-chip active" onClick={openNbModal}>
              <span className="nb-emoji">{nb.emoji}</span>{nb.name}<span className="nb-edit-icon">✎</span>
            </button>
          ) : (
            <a key={nb.code} href={`/nb/${nb.code}`} className="nb-chip" style={{ textDecoration: 'none' }}>
              <span className="nb-emoji">{nb.emoji}</span>{nb.name}
            </a>
          )
        ))}
        {savedNbs.length < MAX_NOTEBOOKS && (
          <a href="/" className="nb-chip" style={{ textDecoration: 'none' }}>+ 其他笔记本</a>
        )}
      </div>

      {/* Tabs */}
      <nav className="tabs">
        {[['new','✎ 记录'],['review','📖 回顾'],['stats','📊 统计']].map(([key,label]) => (
          <button key={key} className={`tab-btn${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      <div className="container">

        {/* ── New Entry ── */}
        {tab === 'new' && (
          <div className="form-card">
            <h2>🍵 今日的咖啡</h2>

            <div className="form-group">
              <label>日期</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>

            <div className="form-group">
              <label>拉花照片 <span style={{fontWeight:400,color:'var(--soft-brown)'}}>(最多5张，可拖拽排序)</span></label>
              <div className="photo-upload-area"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('drag-over'); }}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); }}
                onClick={e => {
                  if (e.target.closest('.photo-thumb') || e.target.closest('.thumb-remove') || e.target.closest('.photo-add-btn')) return;
                  if (currentPhotos.length >= MAX_PHOTOS) { toast(`最多 ${MAX_PHOTOS} 张`); return; }
                  fileInputRef.current?.click();
                }}
              >
                <div className="photo-thumbs">
                  {currentPhotos.map((src, i) => (
                    <div key={src + i} className="photo-thumb" draggable
                      onDragStart={() => onDragStart(i)}
                      onDragOver={e => onDragOver(e, i)}
                      onDragLeave={onDragLeave}
                      onDrop={e => onDrop(e, i)}>
                      <img src={src} alt={`照片${i+1}`} />
                      <span className="thumb-order">{i+1}</span>
                      <button className="thumb-remove" onClick={e => { e.stopPropagation(); removePhoto(i); }}>&times;</button>
                    </div>
                  ))}
                  {currentPhotos.length < MAX_PHOTOS && (
                    <button className="photo-add-btn" type="button"
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                      <span className="add-icon">+</span>
                      <span className="add-text">{currentPhotos.length}/{MAX_PHOTOS}</span>
                    </button>
                  )}
                </div>
                {currentPhotos.length === 0 && (
                  <div className="upload-hint">📷 点击添加 · 拖拽上传 · Ctrl+V 粘贴</div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:'none'}}
                  onChange={e => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = ''; }} />
              </div>
            </div>

            <div className="form-group">
              <label>笔记</label>
              <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)}
                placeholder="今天用了什么豆子？奶泡打得怎么样？有什么心得？" />
            </div>

            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : editingId ? '更新记录 ✎' : '保存这一杯 ☕'}
            </button>
            {editingId && (
              <button className="btn-cancel" onClick={resetForm}>取消编辑</button>
            )}
          </div>
        )}

        {/* ── Review ── */}
        {tab === 'review' && (
          <>
            <div className="timeline-header">
              <h2>📖 咖啡回忆</h2>
              <span className="entry-count">{filtered.length} 条记录</span>
            </div>
            <input type="text" className="search-bar" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 搜索笔记内容..." />

            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="icon">☕</div>
                <p>{searchQuery ? '没有找到匹配的记录' : '还没有记录，去「记录」页写下你的第一杯咖啡吧'}</p>
              </div>
            ) : filtered.map(entry => {
              const { text, weekday } = formatDate(entry.date);
              const photos = entry.photos || [];
              const show = photos.slice(0, 2);
              return (
                <div key={entry.id} className="diary-entry">
                  <div className="entry-actions">
                    <button className="btn-icon" onClick={() => handleEdit(entry)} title="编辑">✎</button>
                    <button className="btn-icon delete" onClick={() => handleDelete(entry.id)} title="删除">✕</button>
                  </div>
                  <div className="entry-date">{text} <span className="weekday">{weekday}</span></div>
                  {show.length > 0 && (
                    <div className={`entry-photos-grid${show.length === 1 ? ' single' : ''}`}>
                      {show.map((p, i) => (
                        <img key={i} src={p} alt="拉花" onClick={() => openLightbox(photos, i)} />
                      ))}
                    </div>
                  )}
                  {photos.length > 2 && (
                    <div className="entry-photos-more" onClick={() => openLightbox(photos, 2)}>
                      还有 {photos.length - 2} 张照片 ›
                    </div>
                  )}
                  {entry.notes && <div className="entry-notes">{entry.notes}</div>}
                </div>
              );
            })}
          </>
        )}

        {/* ── Stats ── */}
        {tab === 'stats' && (
          <>
            <div className="timeline-header"><h2>📊 我的咖啡数据</h2></div>
            <div className="stats-grid">
              {[
                [stats.total, '总记录'], [stats.thisMonth, '本月记录'],
                [stats.streak, '连续打卡'], [stats.withPhoto, '有照片'],
              ].map(([n, l]) => (
                <div key={l} className="stat-card">
                  <div className="stat-number">{n}</div>
                  <div className="stat-label">{l}</div>
                </div>
              ))}
            </div>
            <div className="streak-bar">
              <h3>📅 本月打卡</h3>
              <div className="month-grid">
                {['日','一','二','三','四','五','六'].map(l => (
                  <div key={l} className="day-label">{l}</div>
                ))}
                {Array.from({ length: cal.firstDay }, (_, i) => <div key={'e'+i} />)}
                {Array.from({ length: cal.daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const dateStr = `${cal.year}-${String(cal.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const hasEntry = cal.dateSet.has(dateStr);
                  const photo = cal.photoMap[dateStr];
                  const isToday = d === cal.todayDate;
                  const cls = `day-cell${hasEntry ? ' has-entry' : ''}${isToday ? ' today' : ''}${!photo && hasEntry ? ' no-photo' : ''}`;
                  return (
                    <div key={d} className={cls} title={dateStr}
                      style={photo ? {cursor:'pointer'} : {}}
                      onClick={() => {
                        if (photo) {
                          const entry = entries.find(e => e.date === dateStr);
                          if (entry?.photos?.length) openLightbox(entry.photos, 0);
                        }
                      }}>
                      {photo && <img src={photo} alt={`${d}日`} />}
                      <span className={`day-number${!photo ? ' no-photo-num' : ''}`}>{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lbOpen && (
        <div className="lightbox show" onClick={e => { if (e.target.classList.contains('lightbox')) setLbOpen(false); }}>
          <img src={lbPhotos[lbIndex]} alt="" onClick={() => setLbOpen(false)} />
          {lbPhotos.length > 1 && (
            <div className="lightbox-nav">
              <button onClick={e => { e.stopPropagation(); setLbIndex((lbIndex - 1 + lbPhotos.length) % lbPhotos.length); }}>❮</button>
              <span className="lightbox-counter">{lbIndex + 1} / {lbPhotos.length}</span>
              <button onClick={e => { e.stopPropagation(); setLbIndex((lbIndex + 1) % lbPhotos.length); }}>❯</button>
            </div>
          )}
        </div>
      )}

      {/* ── Notebook Edit Modal ── */}
      {nbModal && (
        <div className="modal-overlay show" onClick={e => { if (e.target.classList.contains('modal-overlay')) setNbModal(false); }}>
          <div className="modal">
            <h3>编辑笔记本</h3>
            <div className="modal-field">
              <label>名称</label>
              <input type="text" value={nbEditName} onChange={e => setNbEditName(e.target.value)} maxLength={20} />
            </div>
            <div className="modal-field">
              <label>图标</label>
              <div className="emoji-grid">
                {EMOJIS.map(e => (
                  <button key={e} className={`emoji-option${e === nbEditEmoji ? ' selected' : ''}`}
                    onClick={() => setNbEditEmoji(e)}>{e}</button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-secondary" onClick={() => setNbModal(false)}>取消</button>
              <button className="modal-btn-primary" onClick={saveNbEdit}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <div className={`toast${toastMsg ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
