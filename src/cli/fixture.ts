import { resetFixture } from '../fixture/index.js';
const total = Number(process.argv[2] ?? 2);
await resetFixture(total);
console.log(
  `Created ${total} synthetic tenant schemas in the isolated benchmark database`,
);
