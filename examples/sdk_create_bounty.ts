import { StellarBountyClient, SorobanContractBuilder } from '../src/sdk/index.js';

async function main() {
  const client = new StellarBountyClient({ baseUrl: 'http://localhost:3001' });
  const builder = new SorobanContractBuilder('CADMWQPCCQP27UHQU4JG3C6V5I3UFNNC4DVOMSK2GUJFA6Q2PNW36S52');

  console.log('Building create_bounty contract invocation...');
  const invocation = builder.buildCreateBounty('GBDOSMGJGGPBIUAORRTYPEWPO5TXTXPQC7FLAP5ZZ4XVYHTDAFBCOMRX', 2500);
  console.log('Invocation Payload:', JSON.stringify(invocation, null, 2));

  console.log('Fetching active bounties via SDK client...');
  const bounties = await client.getBounties();
  console.log('Found', bounties.length, 'active bounties.');
}

main().catch(console.error);
