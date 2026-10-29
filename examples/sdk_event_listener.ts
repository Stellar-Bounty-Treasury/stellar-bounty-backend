import { SdkEventStream } from '../src/sdk/index.js';

const stream = new SdkEventStream('http://localhost:3001');

console.log('Listening for live blockchain treasury events...');
const unsubscribe = stream.subscribe((event) => {
  console.log('Received Event:', event.type, event.data);
});

// Simulate synthetic event
stream.emitSyntheticEvent('milestone_paid', { bountyId: 1, milestoneId: 1, amountXlm: 1000 });
unsubscribe();
