import React from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import App from './App.jsx';
import './styles.css';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App supabase={supabase} /></React.StrictMode>,
);

