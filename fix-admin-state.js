const fs = require('fs');
const path = 'app/admin/page.js';
let c = fs.readFileSync(path, 'utf8');

// The broken section - between pendingUsers and useEffect
// Replace the corrupted section with proper state declarations
const badSection = `  const [regApproval,  setRegApproval]  = useState(false); // toggle\r\n  const [pendingUsers, setPendingUsers] = useState([]);    // pending registrations\r\n\r\n  // Reports + Deleted state (advisor + admin)\r\n      if (!d.auth || !['admin','advisor'].includes(d.role)) { window.location.href = '/gallery'; return; }\r\n      setUser(d);\r\n      loadAll(d.role);\r\n    }\r\n    init();\r\n  }, []);\r\n\r\n  // Poll online sessions every 30 sec`;

const goodSection = `  const [regApproval,  setRegApproval]  = useState(false); // toggle\r\n  const [pendingUsers, setPendingUsers] = useState([]);    // pending registrations\r\n\r\n  // Reports + Deleted state (advisor + admin)\r\n  const [reportsList,  setReportsList]  = useState([]);\r\n  const [deletedList,  setDeletedList]  = useState([]);\r\n  const [directDelForm, setDirectDelForm] = useState({ id: '', reason: 'duplicate' });\r\n  const [previewVideo,  setPreviewVideo]  = useState(null);\r\n  const [watchId,       setWatchId]       = useState('');\r\n  const [videoTitles,   setVideoTitles]   = useState({});\r\n  const [editTitleModal, setEditTitleModal] = useState(null);\r\n  const [editTitleInput, setEditTitleInput] = useState('');\r\n  const [editTitleSaving, setEditTitleSaving] = useState(false);\r\n  const [onlineUsers,   setOnlineUsers]   = useState([]);\r\n  const [showOnlineModal, setShowOnlineModal] = useState(false);\r\n  const [plansConfig,   setPlansConfig]   = useState(null);\r\n  const [plansMsg,      setPlansMsg]      = useState('');\r\n  const [plansSaving,   setPlansSaving]   = useState(false);\r\n  const [deviceData,    setDeviceData]    = useState({});\r\n  const [blockModal,    setBlockModal]    = useState(null);\r\n  const [blockReason,   setBlockReason]   = useState('');\r\n  // Device filter state\r\n  const [devSearch,     setDevSearch]     = useState('');\r\n  const [devMinDevices, setDevMinDevices] = useState('0');\r\n  const [devFlagFilter, setDevFlagFilter] = useState('all');\r\n  // Payment settings state\r\n  const [paySettings,   setPaySettings]   = useState({ maintenanceMode: false, upiId: '', qrUrl: '' });\r\n  const [paySettingsSaving, setPaySettingsSaving] = useState(false);\r\n  const [paySettingsMsg, setPaySettingsMsg] = useState('');\r\n  // UTR submissions\r\n  const [utrList,       setUtrList]       = useState([]);\r\n  // Device message modal\r\n  const [deviceMsgModal, setDeviceMsgModal] = useState(null);\r\n  const [deviceMsgText,  setDeviceMsgText]  = useState('');\r\n  const [deviceMsgSending, setDeviceMsgSending] = useState(false);\r\n  // Watch limit\r\n  const [watchLimit,    setWatchLimit]    = useState({ limit: 5, msg: '' });\r\n  const [watchLimitSaving, setWatchLimitSaving] = useState(false);\r\n  const [watchLimitMsg, setWatchLimitMsg]  = useState('');\r\n\r\n  useEffect(() => {\r\n    async function init() {\r\n      const r = await secureFetch('/api/verify');\r\n      const d = await r.json();\r\n      if (!d.auth || !['admin','advisor'].includes(d.role)) { window.location.href = '/gallery'; return; }\r\n      setUser(d);\r\n      loadAll(d.role);\r\n    }\r\n    init();\r\n  }, []);\r\n\r\n  // Poll online sessions every 30 sec`;

if (c.includes(badSection)) {
  c = c.replace(badSection, goodSection);
  console.log('Fixed admin state section');
} else {
  console.log('Bad section not found exactly. Checking...');
  // Try to find approximate location
  const idx = c.indexOf('pendingUsers, setPendingUsers');
  console.log('pendingUsers at:', idx);
  const ctx = c.substring(idx, idx + 500);
  console.log('Context:', JSON.stringify(ctx).substring(0, 300));
}

fs.writeFileSync(path, c);
console.log('Done');
