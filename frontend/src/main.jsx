import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Studio from './pages/Studio.jsx'
import './index.css'

const Root = () => {
  const path = window.location.pathname;
  if (path.startsWith('/studio')) return <Studio />;
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
