import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  const last = source.lastIndexOf(before);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one match`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "  WalletCards,\n  X,\n} from 'lucide-react';",
  "  WalletCards,\n} from 'lucide-react';",
  'remove local toast X import',
);

replaceOnce(
  "import { RadarPage } from './features/radar/RadarPage';\n",
  "import { RadarPage } from './features/radar/RadarPage';\nimport { FeedbackToast } from './stability/FeedbackToast';\n",
  'add FeedbackToast import',
);

replaceOnce(
  "  const demoStep = deriveDemoStep({ touchedReview: demoTouchedReview, touchedWatch: demoTouchedWatch, touchedPlan: demoTouchedPlan });",
  "  const demoStep = deriveDemoStep({ touchedReview: demoTouchedReview && attention.length === 0, touchedWatch: demoTouchedWatch, touchedPlan: demoTouchedPlan });",
  'keep demo guide on review until inbox is clear',
);

replaceOnce(
  "  function exitDemo() {",
  `  function resetDemo() {\n    const demo = createDemoState();\n    setRules(demo.rules);\n    setAccounts(demo.accounts);\n    setTxs(applyPatternIntelligence(demo.txs, demo.rules));\n    setPlanning(demo.planning);\n    setSelected(null);\n    setFilter('attention');\n    setTab('today');\n    setRadarSeenThisSession(false);\n    setDemoTouchedReview(false);\n    setDemoTouchedWatch(false);\n    setDemoTouchedPlan(false);\n    setUpgradeContext(null);\n    setMessage('Demo reiniciada com o cenário sintético original. Seus dados reais continuam preservados.');\n  }\n\n  function exitDemo() {`,
  'add isolated demo reset',
);

replaceOnce(
  "      setMessage(`${incoming.length} movimentações importadas.`);\n    } finally {",
  "      setMessage(`${incoming.length} movimentações importadas.`);\n    } catch {\n      setMessage('Não conseguimos ler esse arquivo. Confira o formato e tente novamente.');\n    } finally {",
  'contain statement import failures',
);

replaceOnce(
  "    {message && <div className=\"toast\"><span className=\"ok\"><Check size={14}/></span><p>{message}</p><button aria-label=\"Fechar\" onClick={() => setMessage('')}><X size={15}/></button></div>}",
  "    <FeedbackToast message={message} onClose={() => setMessage('')}/>",
  'replace hard-coded success toast',
);

replaceOnce(
  "<DemoProgress step={demoStep} onNext={",
  "<DemoProgress step={demoStep} onRestart={resetDemo} onNext={",
  'connect demo restart control',
);

fs.writeFileSync(path, source);
