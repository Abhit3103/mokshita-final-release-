require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const jwt = require('jsonwebtoken');

async function test() {
  try {
    const token = jwt.sign({ id: '00000000-0000-0000-0000-000000000000', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await fetch('http://localhost:3000/api/content/homepage_layout', {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: ['newsletter', 'hero', 'trust-strip'] })
    });
    console.log(await res.json());
  } catch(e) {
    console.error(e);
  }
}
test();
