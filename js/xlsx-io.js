/* =========================================================
   قارئ وكاتب Excel (xlsx) صغير، بلا مكتبات خارجية ويعمل دون إنترنت
   ---------------------------------------------------------
   - القراءة: يفك ملف ZIP (المضغوط بـ deflate عبر DecompressionStream المدمج
     في المتصفح، أو غير المضغوط)، ثم يقرأ أسماء الأوراق والخلايا (نص أو رقم).
   - الكتابة: ينشئ ملف xlsx غير مضغوط بعدة أوراق من اليمين لليسار (للقالب).
   - يعمل في المتصفح (window.XLSXIO) وفي Node 18+ (module.exports) للاختبار.
   ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XLSXIO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- ZIP ---------- */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('هذا المتصفح لا يدعم فك ملفات Excel. حدّث المتصفح أو استعمل Chrome.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  /* حدود للحماية من الملفات الضخمة أو التالفة */
  const LIMITS = { file: 10 * 1024 * 1024, entry: 40 * 1024 * 1024, total: 80 * 1024 * 1024, rows: 5000 };
  async function unzip(buf) {
    const b = new Uint8Array(buf), out = {};
    if (b.length > LIMITS.file) throw new Error('حجم الملف أكبر من 10 ميغابايت.');
    let total = 0;
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('الملف ليس ملف Excel (xlsx) صالحاً.');
    const count = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (u32(b, p) !== 0x02014b50) break;
      const method = u16(b, p + 10), csize = u32(b, p + 20), usize = u32(b, p + 24), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), loff = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      const start = loff + 30 + u16(b, loff + 26) + u16(b, loff + 28);
      if (start + csize > b.length) throw new Error('الملف تالف (محتوى ناقص).');
      const raw = b.subarray(start, start + csize);
      if (/\.xml$|\.rels$/i.test(name)) {
        if (usize > LIMITS.entry || (total += usize) > LIMITS.total) throw new Error('محتوى الملف بعد فك الضغط كبير جداً.');
        const data = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
        if (data && data.length > LIMITS.entry) throw new Error('محتوى الملف بعد فك الضغط كبير جداً.');
        out[name] = data;
      }
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }

  /* ---------- XML (بتعابير منتظمة، ليعمل في Node أيضاً) ---------- */
  function unescapeXml(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(+d); }).replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&amp;/g, '&');
  }
  function textOf(xml) { const parts = []; xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function (m, t) { parts.push(t); }); return unescapeXml(parts.join('')); }
  function colIndex(ref) { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (let i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }

  /* يُرجع { sheets: [{ name, rows: [[قيمة الخلية...]] }] } — القيمة رقم أو نص أو null */
  async function read(buf) {
    const files = await unzip(buf), dec = new TextDecoder();
    if (!files['xl/workbook.xml']) throw new Error('الملف ليس ملف Excel (xlsx) صالحاً: لا يحتوي مصنفاً.');
    const get = function (n) { return files[n] ? dec.decode(files[n]) : ''; };
    const shared = [];
    get('xl/sharedStrings.xml').replace(/<si>([\s\S]*?)<\/si>/g, function (m, si) { shared.push(textOf(si)); });
    const wb = get('xl/workbook.xml'), rels = get('xl/_rels/workbook.xml.rels');
    const relMap = {};
    rels.replace(/<Relationship\s([^>]*)\/?>/g, function (m, a) {
      const id = /Id="([^"]+)"/.exec(a), t = /Target="([^"]+)"/.exec(a);
      if (id && t) relMap[id[1]] = t[1].replace(/^\/?xl\//, '').replace(/^\//, '');
    });
    const sheets = [];
    wb.replace(/<sheet\s([^>]*)\/?>/g, function (m, a) {
      const nm = /name="([^"]*)"/.exec(a), rid = /r:id="([^"]+)"/.exec(a) || /\bid="([^"]+)"/.exec(a);
      sheets.push({ name: unescapeXml(nm ? nm[1] : ''), path: 'xl/' + (rid && relMap[rid[1]] ? relMap[rid[1]] : '') });
    });
    return {
      sheets: sheets.map(function (sh) {
        const xml = get(sh.path), rows = [];
        xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, function (m, ra, body) {
          const rn = /\br="(\d+)"/.exec(ra), r = rn ? +rn[1] - 1 : rows.length, row = [];
          body.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, function (mm, ca, inner) {
            const ref = /\br="([A-Z]+\d+)"/.exec(ca), t = /\bt="([^"]+)"/.exec(ca);
            const ci = ref ? colIndex(ref[1]) : row.length;
            let v = null;
            if (inner) {
              const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
              if (t && t[1] === 's') v = vm ? shared[+vm[1]] : null;
              else if (t && t[1] === 'inlineStr') v = textOf(inner);
              else if (t && (t[1] === 'str' || t[1] === 'e')) v = vm ? unescapeXml(vm[1]) : null;
              else if (t && t[1] === 'b') v = vm ? vm[1] === '1' : null;
              else v = vm ? (isFinite(+vm[1]) ? +vm[1] : unescapeXml(vm[1])) : null;
            }
            row[ci] = v;
          });
          if (r < LIMITS.rows) rows[r] = row;
        });
        for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
        return { name: sh.name, rows: rows };
      })
    };
  }

  /* ---------- الكتابة (ملف غير مضغوط، عدة أوراق) ---------- */
  const CRC = (function () { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function w16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
  function w32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    files.forEach(function (f) {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const local = [0x50, 0x4B, 0x03, 0x04].concat(w16(20), w16(0x0800), w16(0), w16(0), w16(0x21), w32(crc), w32(data.length), w32(data.length), w16(name.length), w16(0));
      parts.push(new Uint8Array(local), name, data);
      central.push(new Uint8Array([0x50, 0x4B, 0x01, 0x02].concat(w16(20), w16(20), w16(0x0800), w16(0), w16(0), w16(0x21), w32(crc), w32(data.length), w32(data.length), w16(name.length), w16(0), w16(0), w16(0), w16(0), w32(0), w32(off))), name);
      off += local.length + name.length + data.length;
    });
    const csize = central.reduce(function (s, x) { return s + x.length; }, 0);
    const end = new Uint8Array([0x50, 0x4B, 0x05, 0x06].concat(w16(0), w16(0), w16(files.length), w16(files.length), w32(csize), w32(off), w16(0)));
    return parts.concat(central, [end]);
  }
  function xesc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cname(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  /* sheets: [{ name, rows: [[...]], widths?: [..] }] — الصف الذي فيه header: true يُكتب عريضاً */
  function build(sheets) {
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + xesc(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF1DF"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ];
    sheets.forEach(function (s, i) {
      const widths = s.widths || [];
      const cols = widths.length ? '<cols>' + widths.map(function (w, j) { return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
      const rows = s.rows.map(function (r, ri) {
        const head = s.headerRows && s.headerRows.indexOf(ri) >= 0;
        return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
          if (v === null || v === undefined || v === '') return '';
          const ref = cname(ci) + (ri + 1);
          if (typeof v === 'number') return '<c r="' + ref + '"' + (head ? ' s="1"' : ' s="2"') + '><v>' + v + '</v></c>';
          return '<c r="' + ref + '" t="inlineStr"' + (head ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
        }).join('') + '</row>';
      }).join('');
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>' + cols + '<sheetData>' + rows + '</sheetData></worksheet>' });
    });
    return zip(files);
  }

  return { read: read, build: build, unzip: unzip };
});
