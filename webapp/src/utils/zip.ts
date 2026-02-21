/**
 * Minimal ZIP file creator for stored (uncompressed) files.
 * No external dependencies — uses raw ArrayBuffer manipulation.
 */

// CRC32 lookup table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string; // path inside zip, e.g. "Users/get-profile.json"
  content: string;
}

export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const files: { name: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];

  // Calculate total size for pre-allocation
  let offset = 0;

  // Build file entries
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    files.push({ name, data, crc, offset });
    // Local file header (30 bytes) + name + data
    offset += 30 + name.length + data.length;
  }

  const centralDirOffset = offset;

  // Central directory size
  let centralDirSize = 0;
  for (const f of files) {
    centralDirSize += 46 + f.name.length;
  }

  const totalSize = offset + centralDirSize + 22; // +22 for EOCD
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  let pos = 0;

  // Write local file headers + data
  for (const f of files) {
    // Local file header signature
    view.setUint32(pos, 0x04034b50, true); pos += 4;
    // Version needed
    view.setUint16(pos, 20, true); pos += 2;
    // General purpose flags
    view.setUint16(pos, 0, true); pos += 2;
    // Compression method (0 = stored)
    view.setUint16(pos, 0, true); pos += 2;
    // Mod time & date
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    // CRC-32
    view.setUint32(pos, f.crc, true); pos += 4;
    // Compressed size
    view.setUint32(pos, f.data.length, true); pos += 4;
    // Uncompressed size
    view.setUint32(pos, f.data.length, true); pos += 4;
    // Filename length
    view.setUint16(pos, f.name.length, true); pos += 2;
    // Extra field length
    view.setUint16(pos, 0, true); pos += 2;
    // Filename
    bytes.set(f.name, pos); pos += f.name.length;
    // File data
    bytes.set(f.data, pos); pos += f.data.length;
  }

  // Write central directory
  for (const f of files) {
    // Central directory signature
    view.setUint32(pos, 0x02014b50, true); pos += 4;
    // Version made by
    view.setUint16(pos, 20, true); pos += 2;
    // Version needed
    view.setUint16(pos, 20, true); pos += 2;
    // Flags
    view.setUint16(pos, 0, true); pos += 2;
    // Compression
    view.setUint16(pos, 0, true); pos += 2;
    // Mod time & date
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    // CRC-32
    view.setUint32(pos, f.crc, true); pos += 4;
    // Compressed size
    view.setUint32(pos, f.data.length, true); pos += 4;
    // Uncompressed size
    view.setUint32(pos, f.data.length, true); pos += 4;
    // Filename length
    view.setUint16(pos, f.name.length, true); pos += 2;
    // Extra field length
    view.setUint16(pos, 0, true); pos += 2;
    // Comment length
    view.setUint16(pos, 0, true); pos += 2;
    // Disk number start
    view.setUint16(pos, 0, true); pos += 2;
    // Internal attributes
    view.setUint16(pos, 0, true); pos += 2;
    // External attributes
    view.setUint32(pos, 0, true); pos += 4;
    // Relative offset of local header
    view.setUint32(pos, f.offset, true); pos += 4;
    // Filename
    bytes.set(f.name, pos); pos += f.name.length;
  }

  // End of central directory record
  view.setUint32(pos, 0x06054b50, true); pos += 4;
  // Disk number
  view.setUint16(pos, 0, true); pos += 2;
  // Disk with central dir
  view.setUint16(pos, 0, true); pos += 2;
  // Entries on this disk
  view.setUint16(pos, files.length, true); pos += 2;
  // Total entries
  view.setUint16(pos, files.length, true); pos += 2;
  // Central directory size
  view.setUint32(pos, centralDirSize, true); pos += 4;
  // Central directory offset
  view.setUint32(pos, centralDirOffset, true); pos += 4;
  // Comment length
  view.setUint16(pos, 0, true); pos += 2;

  return new Blob([buf], { type: 'application/zip' });
}
