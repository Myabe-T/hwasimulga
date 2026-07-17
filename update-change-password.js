const fs = require('fs');
const path = 'app/api/hwasi/change-password/route.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import { getRegUsers, saveRegUsers } from '@/lib/redis';", "import { getRegUsers, saveRegUsers, getUsers, saveUsers } from '@/lib/redis';");

const newLogic = 
  const [staticUsers, regUsers] = await Promise.all([getUsers(), getRegUsers()]);
  
  let staticIdx = staticUsers.findIndex(u => u.id === session.sub);
  let regIdx = regUsers.findIndex(u => u.id === session.sub);
  
  if (staticIdx === -1 && regIdx === -1) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (staticIdx !== -1) {
    // Check static user plain text password
    if (staticUsers[staticIdx].password !== oldPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    staticUsers[staticIdx].password = newPassword;
    await saveUsers(staticUsers);
  } else if (regIdx !== -1) {
    // Check reg user hashed password
    const oldHash = await hashPassword(oldPassword);
    if (regUsers[regIdx].passwordHash !== oldHash) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    regUsers[regIdx].passwordHash = await hashPassword(newPassword);
    await saveRegUsers(regUsers);
  }

  return NextResponse.json({ ok: true });
;

content = content.replace(/const users = await getRegUsers\(\);[\s\S]*?return NextResponse\.json\(\{ ok: true \}\);/m, newLogic.trim());

fs.writeFileSync(path, content);
