const fs = require('fs');
let content = fs.readFileSync('app/gallery/page.js', 'utf8');

// 1. Add curatedLoading state
if (!content.includes("curatedLoading")) {
  content = content.replace(
    "const [curated, setCurated] = useState({ trending: [], latest: [] });",
    "const [curated, setCurated] = useState({ trending: [], latest: [] });\n  const [curatedLoading, setCuratedLoading] = useState(true);"
  );

  content = content.replace(
    "setCurated(c.error ? { trending:[], latest:[] } : c);",
    "setCurated(c.error ? { trending:[], latest:[] } : c);\n        setCuratedLoading(false);"
  );
}

// Fix tabIds logic so it returns [] while loading, preventing fallback to allIds
content = content.replace(
  "if (homeTab === 'trending') return trendingIds.length ? trendingIds : allIds.slice(0, 24);",
  "if (homeTab === 'trending') return curatedLoading ? [] : (trendingIds.length ? trendingIds : allIds.slice(0, 24));"
);

// Modify openModal to immediately show loading modal
content = content.replace(
  /const openModal = useCallback\(async \(id\) => \{[\s\S]*?if \(!viewStatus\?\.isPremium[\s\S]*?\}\s*\}\s*setModal\(\{ id, index: idx >= 0 \? idx : 0, src: null, loading: true \}\);/m,
  const openModal = useCallback(async (id) => {
    const idx = allIds.indexOf(id);

    // Guest (not logged in) → show auth modal with pricing
    if (!user) {
      setGuestAuthModal(true);
      return;
    }
    
    // Immediately show loading modal so user knows click was registered
    setModal({ id, index: idx >= 0 ? idx : 0, src: null, loading: true });

    if (!viewStatus?.isPremium && user?.role !== 'admin' && user?.role !== 'advisor') {
      const fp = getFingerprint();
      const checkRes = await fetch('/api/hwasi/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, fingerprint: fp }),
      }).catch(() => ({ json: () => ({ allowed: true }) }));
      const check = await checkRes.json();
      setViewStatus(check);
      if (!check.allowed) {
        setModal(null);
        setUpgradeInfo(check);
        setShowUpgrade(true);
        return;
      }
    }
);

fs.writeFileSync('app/gallery/page.js', content);
console.log('Fixed Gallery page responsiveness');
