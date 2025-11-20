const ts = 'a9684974656d4e616d656b626974636f696e2e70646664547970656466696c656a4d65726b6c65526f6f74407043757272656e744c696e6b436f756e7400694c656166436f756e74016b436f6e74656e7453697a651a0002cfe46744616753697a651a000000a36b436f6e74656e74486173685820b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f5536e4164646974696f6e616c4461746180';
const go = 'a9684974656d4e616d656b626974636f696e2e70646664547970656466696c656a4d65726b6c65526f6f74407043757272656e744c696e6b436f756e7400694c656166436f756e74016b436f6e74656e7453697a651a0002cfe46744616753697a65006b436f6e74656e74486173685820b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f5536e4164646974696f6e616c4461746180';

console.log('TypeScript length:', Buffer.from(ts, 'hex').length);
console.log('Go length:', Buffer.from(go, 'hex').length);

// Find first difference
const tsBuf = Buffer.from(ts, 'hex');
const goBuf = Buffer.from(go, 'hex');

for (let i = 0; i < Math.min(tsBuf.length, goBuf.length); i++) {
  if (tsBuf[i] !== goBuf[i]) {
    console.log('First difference at byte', i + ':');
    console.log('  TS:', tsBuf.slice(i, i + 20).toString('hex'));
    console.log('  Go:', goBuf.slice(i, i + 20).toString('hex'));
    break;
  }
}
