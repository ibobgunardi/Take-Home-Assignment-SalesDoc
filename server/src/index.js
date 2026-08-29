import { createApp } from './app.js';
import { PORT } from './config.js';
import { seed } from './seed.js';

// R-108c: seed on boot, so a restarted instance is immediately usable. State is
// in memory (D-10), so a restart clears sessions and CRM data - leads come back
// automatically, and the UI handles a lost session (R-93).
const { leads } = seed();
console.log(`[server] seeded ${leads.length} leads`);

createApp().listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
