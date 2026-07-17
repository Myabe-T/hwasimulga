const fs = require('fs');
const path = 'C:\\Users\\Darshan-Tobi\\.gemini\\antigravity\\brain\\52d7cd1b-ca96-48db-939a-7b99c1b99533\\task.md';
let c = fs.readFileSync(path, 'utf8');
c = c.replace(/- \\[ \]\/g, "- [x]");
fs.writeFileSync(path, c);
