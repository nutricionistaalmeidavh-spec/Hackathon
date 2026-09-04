import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './hackathon.css';
import './premium.css';
import './features/radar/radar.css';
import './features/planner/planner.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
