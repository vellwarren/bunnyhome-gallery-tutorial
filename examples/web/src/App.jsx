import { useCallback, useEffect, useMemo, useState } from 'react';
import { fileAsImagePayload, galleryApi } from './api.js';

function Login({ supabase }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (mode) => {
    setNotice('');
    const action = mode === 'signup' ? supabase.auth.signUp.bind(supabase.auth) : supabase.auth.signInWithPassword.bind(supabase.auth);
    const { error } = await action({ email, password });
    setNotice(error ? error.message : mode === 'signup' ? '请检查邮箱，或直接登录。' : '登录成功');
  };

  return <main className="login-shell">
    <section className="login-card">
      <p className="eyebrow">PRIVATE IMAGE MEMORY</p>
      <h1>看过一次，就不会忘</h1>
      <p>准确一点说：留下的是有损的语义记忆。</p>
      <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <div className="login-actions">
        <button onClick={() => submit('login')}>登录</button>
        <button className="quiet" onClick={() => submit('signup')}>注册</button>
      </div>
      {notice && <small>{notice}</small>}
    </section>
  </main>;
}

function Gallery({ items, selected, setSelected, onReuse, onRename, onRefresh }) {
  return <section className="gallery-panel">
    <header>
      <div><p className="eyebrow">OUR PICTURES</p><h2>Gallery</h2></div>
      <button className="quiet" onClick={onRefresh}>刷新签名链接</button>
    </header>
    {items.length ? <div className="gallery-grid">
      {items.map((item) => <button key={item.id} className="tile" onClick={() => setSelected(item)}>
        <img src={item.signed_url} alt={item.title || '收藏图片'} loading="lazy" />
        <span>{item.title || '一张图片'}</span>
      </button>)}
    </div> : <p className="empty">下一张愿意留下来的图，会住在这里。</p>}

    {selected && <div className="viewer" role="dialog" aria-modal="true">
      <button className="viewer-close" onClick={() => setSelected(null)}>关闭</button>
      <img src={selected.signed_url} alt={selected.title || '收藏图片'} />
      <h3>{selected.title}</h3>
      <article><small>中性的画面记忆</small><p>{selected.first_description}</p></article>
      <article className="impression"><small>当时留下的第一印象</small><p>{selected.first_impression}</p></article>
      <div className="viewer-actions">
        <button onClick={() => onReuse(selected)}>带去聊天</button>
        <button className="quiet" onClick={() => onRename(selected)}>改名</button>
      </div>
    </div>}
  </section>;
}

export default function App({ supabase }) {
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingGallery, setPendingGallery] = useState(null);
  const [message, setMessage] = useState('');
  const [save, setSave] = useState(true);
  const [messages, setMessages] = useState([]);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const token = session?.access_token;
  const refresh = useCallback(async () => {
    if (!token) return;
    try { setItems(await galleryApi.list(token)); setNotice(''); }
    catch (error) { setNotice(error.message); }
  }, [token]);
  useEffect(() => { refresh(); }, [refresh]);

  const preview = useMemo(() => pendingFile ? URL.createObjectURL(pendingFile) : pendingGallery?.signed_url, [pendingFile, pendingGallery]);
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  if (!session) return <Login supabase={supabase} />;

  const send = async () => {
    if (!message.trim() && !pendingFile && !pendingGallery) return;
    setWorking(true);
    setNotice('');
    try {
      const imagePayload = pendingFile ? await fileAsImagePayload(pendingFile) : null;
      const body = pendingGallery
        ? { message, gallery_image_id: pendingGallery.id }
        : {
            message,
            ...(imagePayload ? { image: imagePayload, save_to_gallery: save } : {}),
          };
      setMessages((all) => [...all, {
        role: 'user',
        text: message || '[图片]',
        image: pendingGallery?.signed_url || imagePayload?.data,
      }]);
      const result = await galleryApi.chat(token, body);
      setMessages((all) => [...all, {
        role: 'assistant',
        text: result.reply,
        note: result.reused_semantic_memory ? '本轮使用了有损语义记忆，没有重新传像素。' : '',
      }]);
      if (result.gallery_error) setNotice('聊天成功，但图片收藏失败；可以稍后重试。');
      setMessage('');
      setPendingFile(null);
      setPendingGallery(null);
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setWorking(false); }
  };

  const rename = async (item) => {
    const title = window.prompt('给它一个新名字', item.title || '');
    if (!title?.trim()) return;
    try {
      const updated = await galleryApi.rename(token, item.id, title.trim());
      setItems((all) => all.map((entry) => entry.id === updated.id ? updated : entry));
      setSelected(updated);
    } catch (error) { setNotice(error.message); }
  };

  return <main className="app-shell">
    <header className="topbar">
      <div><p className="eyebrow">GALLERY EXAMPLE</p><h1>看过一次，就不会忘</h1></div>
      <button className="quiet" onClick={() => supabase.auth.signOut()}>退出</button>
    </header>
    <div className="layout">
      <section className="chat-panel">
        <div className="messages">
          {messages.length ? messages.map((entry, index) => <div key={index} className={`message ${entry.role}`}>
            {entry.image && <img src={entry.image} alt="本轮发送" />}
            <p>{entry.text}</p>{entry.note && <small>{entry.note}</small>}
          </div>) : <p className="empty">选择一张图片，看看两条记忆线怎样汇合。</p>}
        </div>
        {preview && <div className="pending"><img src={preview} alt="待发送" /><span>{pendingGallery ? pendingGallery.title : pendingFile?.name}</span><button onClick={() => { setPendingFile(null); setPendingGallery(null); }}>×</button></div>}
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="说点什么…" />
        <div className="composer-actions">
          <label className="file-button">选择图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setPendingFile(event.target.files?.[0] || null); setPendingGallery(null); }} /></label>
          {pendingFile && <label className="save-toggle"><input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} /> 保存到 Gallery</label>}
          <button disabled={working} onClick={send}>{working ? '发送中…' : '发送'}</button>
        </div>
        {notice && <p className="notice">{notice}</p>}
      </section>
      <Gallery items={items} selected={selected} setSelected={setSelected} onRefresh={refresh} onRename={rename} onReuse={(item) => { setPendingGallery(item); setPendingFile(null); setSelected(null); }} />
    </div>
  </main>;
}
