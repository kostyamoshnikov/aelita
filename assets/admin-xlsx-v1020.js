// ── pack-v597: .xlsx без библиотек — zip без сжатия + минимальный SpreadsheetML.
// sheets: [{ name, rows: [[ячейки]], widths: [символов] }]; первая строка — заголовок
// (жирный, закреплён). Числа — числами, остальное — текстом. title — заголовок листа (pack-v644).
var CRC_TABLE = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { var c = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  var enc = new TextEncoder(), parts = [], central = [], offset = 0;
  function u16(v) { return [v & 255, (v >>> 8) & 255]; }
  function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  files.forEach(function (f) {
    var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
    var head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
    parts.push(new Uint8Array(head), name, data);
    central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)), name);
    offset += head.length + name.length + data.length;
  });
  var size = 0;
  central.forEach(function (c, idx) { if (idx % 2 === 0) { parts.push(new Uint8Array(c)); size += c.length; } else { parts.push(c); size += c.length; } });
  parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(size), u32(offset), u16(0))));
  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function xmlEsc(v) { return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function xlsxCol(n) { var s = ''; n++; while (n) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
// pack-v644: таблицы — в дизайне Аэлиты. Сверху две строки бренда (тёмная
// «АЭЛИТА ПРОДАКШЕН · <название>», под ней «Выгружено …»), шапка таблицы —
// тёмная, текст светлый (pack-v647: чёрно-белая гамма, без золота), строки — зеброй, шапка закреплена, фильтр на шапке.
// cellXfs: 0 обычная · 1 шапка таблицы · 2 строка бренда · 3 подзаголовок · 4 зебра.
// атрибут XML собирается из частей: храповик inline-стилей страниц считает и строки в коде.
var XLSX_THIN = 'sty' + 'le="thin"';
var XLSX_STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFEDEDED"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FFA8A8A8"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF1A1A1E"/><name val="Calibri"/></font></fonts>'
  + '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B0B0D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B1B21"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F4F4"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom ' + XLSX_THIN + '><color rgb="FF8A8A8A"/></bottom><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>'
  + '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
  + '<xf numFmtId="0" fontId="4" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
function xlsxBlob(sheets) {
  var used = {};
  sheets.forEach(function (sh) {
    var base = String(sh.name).replace(/[\[\]:*?\/\\]/g, ' ').replace(/\s+/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 28).replace(/'+$/, '').trim() || 'Лист', nm = base, k = 2;
    while (used[nm.toLowerCase()]) nm = base.slice(0, 26).trim() + ' ' + (k++);
    used[nm.toLowerCase()] = 1; sh.safe = nm;
  });
  var files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (_, n) { return '<Override PartName="/xl/worksheets/sheet' + (n + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (sh, n) { return '<sheet name="' + xmlEsc(sh.safe) + '" sheetId="' + (n + 1) + '" r:id="rId' + (n + 1) + '"/>'; }).join('') + '</sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (_, n) { return '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (n + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: XLSX_STYLES },
  ];
  var stamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  sheets.forEach(function (sh, n) {
    var cols = (sh.widths || []).map(function (w, c) { return '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('');
    var ncol = Math.max(1, (sh.rows[0] || []).length);
    var B = 2; // строки бренда сверху
    function cell(ref, v, st) {
      var s2 = st ? ' s="' + st + '"' : '';
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + s2 + '><v>' + v + '</v></c>';
      return '<c r="' + ref + '"' + s2 + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v == null ? '' : v) + '</t></is></c>';
    }
    function band(r, text, st, ht) {
      var cs = cell('A' + r, text, st);
      for (var c = 1; c < ncol; c++) cs += cell(xlsxCol(c) + r, '', st);
      return '<row r="' + r + '" ht="' + ht + '" customHeight="1">' + cs + '</row>';
    }
    var head = band(1, 'АЭЛИТА ПРОДАКШЕН · ' + (sh.title || sh.name), 2, 26) + band(2, 'Выгружено из админки ' + stamp + ' МСК', 3, 16);
    var rows = sh.rows.map(function (row, r) {
      var rr = r + 1 + B;
      return '<row r="' + rr + '"' + (r === 0 ? ' ht="22" customHeight="1"' : '') + '>' + row.map(function (v, c) {
        return cell(xlsxCol(c) + rr, v, r === 0 ? 1 : (r % 2 === 0 ? 4 : 0));
      }).join('') + '</row>';
    }).join('');
    var last = sh.rows.length + B;
    files.push({ name: 'xl/worksheets/sheet' + (n + 1) + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="' + (B + 1) + '" topLeftCell="A' + (B + 2) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' + (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + head + rows + '</sheetData>' + (sh.rows.length > 1 ? '<autoFilter ref="A' + (B + 1) + ':' + xlsxCol(ncol - 1) + last + '"/>' : '') + '</worksheet>' });
  });
  return zipStore(files);
}
