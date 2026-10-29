import { SorobanContractBuilder } from '../src/sdk/index.js';

function main() {
  const builder = new SorobanContractBuilder('CADMWQPCCQP27UHQU4JG3C6V5I3UFNNC4DVOMSK2GUJFA6Q2PNW36S52');

  console.log('Building milestone review verification...');
  const invocation = builder.buildVerifyMilestone(1, 1, 'GCETG2VIX2A2LRWI3FVIRV5VNOPP2FJQCDK6HYVTV3753L74JYRKV5ED', true);
  console.log('Verification Invocation:', JSON.stringify(invocation, null, 2));
}

main();
