import { bytesToBase64, base64ToBytes } from '../base64';

describe('base64', () => {
  it('encodes known vectors', () => {
    expect(bytesToBase64(Uint8Array.from([0x21, 0x01, 0x00]))).toBe('IQEA'); // chessnut init command
    expect(bytesToBase64(Uint8Array.from([]))).toBe('');
    expect(bytesToBase64(Uint8Array.from([0xff]))).toBe('/w==');
    expect(bytesToBase64(Uint8Array.from([0xff, 0xff]))).toBe('//8=');
  });

  it('round-trips all lengths', () => {
    for (let len = 0; len <= 40; len++) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + len) % 256);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    }
  });

  it('encodes a 38-byte board frame correctly', () => {
    // Precomputed with Node: Buffer.from([0,7,14,...,3]).toString('base64')
    const bytes = Uint8Array.from({ length: 38 }, (_, i) => (i * 7) % 256);
    const expected = 'AAcOFRwjKjE4P0ZNVFtiaXB3foWMk5qhqK+2vcTL0tng5+71/AM=';
    expect(bytesToBase64(bytes)).toBe(expected);
    expect(base64ToBytes(expected)).toEqual(bytes);
  });
});
