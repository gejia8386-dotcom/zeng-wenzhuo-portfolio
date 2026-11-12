/* =========================================================================
   ZipWriter — 纯原生 JS 的 ZIP 打包器（store 模式，无压缩、无依赖）
   用于后台「导出完整发布包」：把文本、原图与上传图片写进一个 ZIP。
   ========================================================================= */
(function (global) {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) {
    if (global.TextEncoder) return new TextEncoder().encode(str);
    var s = unescape(encodeURIComponent(str));
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  function concat(parts) {
    var total = 0, i;
    for (i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total), pos = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], pos); pos += parts[i].length; }
    return out;
  }

  function num(n, bytes) {
    var a = new Uint8Array(bytes);
    for (var i = 0; i < bytes; i++) a[i] = (n >>> (i * 8)) & 0xFF;
    return a;
  }

  function dosTime(d) {
    return (((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31)) & 0xFFFF;
  }
  function dosDate(d) {
    return ((((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)) & 0xFFFF;
  }

  function ZipWriter() {
    this.files = [];
    this._index = Object.create(null);
  }

  /* 同名文件后写覆盖前写，避免发布包里出现重复条目导致解压时提示覆盖 */
  ZipWriter.prototype.add = function (name, data) {
    var bytes = typeof data === 'string' ? utf8(data)
      : (data instanceof Uint8Array ? data : new Uint8Array(data));
    name = String(name).replace(/^\/+/, '');
    var entry = { name: utf8(name), data: bytes, crc: crc32(bytes) };
    var at = this._index[name];
    if (at === undefined) {
      this._index[name] = this.files.length;
      this.files.push(entry);
    } else {
      this.files[at] = entry;
    }
    return this;
  };

  ZipWriter.prototype.build = function () {
    var now = new Date();
    var t = dosTime(now), d = dosDate(now);
    var locals = [], centrals = [], offset = 0;
    var self = this;

    this.files.forEach(function (f) {
      var lh = concat([
        num(0x04034b50, 4), num(20, 2), num(0x0800, 2), num(0, 2),
        num(t, 2), num(d, 2), num(f.crc, 4),
        num(f.data.length, 4), num(f.data.length, 4),
        num(f.name.length, 2), num(0, 2), f.name
      ]);
      locals.push(lh, f.data);
      centrals.push(concat([
        num(0x02014b50, 4), num(20, 2), num(20, 2), num(0x0800, 2), num(0, 2),
        num(t, 2), num(d, 2), num(f.crc, 4),
        num(f.data.length, 4), num(f.data.length, 4),
        num(f.name.length, 2), num(0, 2), num(0, 2),
        num(0, 2), num(0, 2), num(0, 4),
        num(offset, 4), f.name
      ]));
      offset += lh.length + f.data.length;
    });

    var cd = concat(centrals);
    var eocd = concat([
      num(0x06054b50, 4), num(0, 2), num(0, 2),
      num(self.files.length, 2), num(self.files.length, 2),
      num(cd.length, 4), num(offset, 4), num(0, 2)
    ]);
    /* 必须用数组包一层：Uint8Array 本身可迭代，
       直接传给 Blob 会被当成「数字序列」逐字节转成十进制字符串，
       生成损坏的 ZIP。 */
    return new Blob([concat(locals.concat([cd, eocd]))], { type: 'application/zip' });
  };

  ZipWriter.prototype.count = function () { return this.files.length; };

  global.ZipWriter = ZipWriter;
  global.ZipCRC32 = crc32;
})(typeof window !== 'undefined' ? window : globalThis);
