/**
 * Single Line Diagram - สถานีไฟฟ้าอ่าวลึก
 * Google Apps Script Web App (backend API)
 *
 * วิธีใช้งาน:
 * 1. สร้าง Google Sheet ใหม่ 1 ไฟล์
 * 2. สร้างชีตชื่อ "Devices" แล้ว import ไฟล์ devices.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 * 3. สร้างชีตชื่อ "Feeders" แล้ว import ไฟล์ feeders.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 * 4. เปิด Extensions > Apps Script แล้ววางไฟล์นี้ทับ Code.gs ที่มีอยู่
 * 5. Deploy > New deployment > เลือกประเภท "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone (หรือ Anyone with the link)
 * 6. คัดลอก URL ของ Web app ที่ได้ ไปใส่ในตัวแปร GAS_WEB_APP_URL ในไฟล์ index.html
 *
 * เมื่อแก้ไขข้อมูลอุปกรณ์ในอนาคต ให้แก้ไขที่ Google Sheet โดยตรง (ไม่ต้องแก้โค้ด)
 * หน้าเว็บจะดึงข้อมูลล่าสุดจาก Sheet ทุกครั้งที่เปิดหน้าเว็บ
 */

const SHEET_DEVICES = 'Devices';
const SHEET_FEEDERS = 'Feeders';

function doGet(e) {
  const data = buildData();
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const feederSheet = ss.getSheetByName(SHEET_FEEDERS);
  const feederRows = feederSheet.getDataRange().getValues();
  const feederHeader = feederRows.shift(); // FeederID, Name, Color, TieTo

  const feeders = feederRows
    .filter(r => r[0]) // skip blank rows
    .map(r => ({
      id: String(r[0]).trim(),
      name: String(r[1] || '').trim(),
      color: String(r[2] || '#888888').trim(),
      tieTo: String(r[3] || '').trim(),
      devices: []
    }));

  const feederById = {};
  feeders.forEach(f => feederById[f.id] = f);

  const deviceSheet = ss.getSheetByName(SHEET_DEVICES);
  const deviceRows = deviceSheet.getDataRange().getValues();
  deviceRows.shift(); // Feeder, DeviceID, Type, Rating, Description

  deviceRows.forEach(r => {
    const feederId = String(r[0] || '').trim();
    const deviceId = String(r[1] || '').trim();
    if (!feederId || !deviceId) return;
    if (!feederById[feederId]) return; // skip rows with unknown feeder id
    feederById[feederId].devices.push({
      id: deviceId,
      type: String(r[2] || '').trim(),
      rating: String(r[3] || '').trim(),
      desc: String(r[4] || '').trim()
    });
  });

  return {
    substation: {
      id: 'ALA',
      name: 'สถานีไฟฟ้าอ่าวลึก',
      region: 'กฟต.2',
      branch: 'กฟส.อ่าวลึก',
      sourceDrawing: 'ข้อมูลสดจาก Google Sheet'
    },
    feeders: feeders
  };
}

/**
 * รับการแก้ไข/เพิ่ม/ลบ อุปกรณ์ จากหน้าเว็บ (โหมดแก้ไขใน index.html)
 * body ที่ส่งมาเป็น JSON รูปแบบ:
 *   { action: 'upsert', feeder: 'ALA05', device: {id, type, rating, desc} }
 *   { action: 'delete', feeder: 'ALA05', id: 'ALA05WF-999' }
 *
 * หมายเหตุ: ส่งมาด้วย Content-Type: text/plain เพื่อเลี่ยงปัญหา CORS preflight
 * ของ Apps Script (เบราว์เซอร์จะไม่ยิง OPTIONS ก่อน) โค้ดฝั่งนี้ยัง parse เป็น JSON ตามปกติ
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEVICES);
    const values = sheet.getDataRange().getValues();

    if (body.action === 'upsert') {
      const dev = body.device;
      const feederId = body.feeder;
      if (!dev || !dev.id || !feederId) return jsonOut({ ok: false, error: 'missing feeder/device' });

      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === dev.id) { rowIndex = i; break; }
      }
      const rowData = [feederId, dev.id, dev.type || '', dev.rating || '', dev.desc || ''];
      if (rowIndex >= 0) {
        sheet.getRange(rowIndex + 1, 1, 1, 5).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      return jsonOut({ ok: true });

    } else if (body.action === 'delete') {
      const devId = body.id;
      if (!devId) return jsonOut({ ok: false, error: 'missing device id' });
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === devId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return jsonOut({ ok: true });
    }

    return jsonOut({ ok: false, error: 'unknown action: ' + body.action });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ฟังก์ชันช่วยตรวจสอบข้อมูล — เรียกใช้จากใน Apps Script editor (Run) ได้เลย
 * เพื่อดูผลลัพธ์ JSON ใน Logger ก่อนนำไป deploy จริง
 */
function testBuildData() {
  Logger.log(JSON.stringify(buildData(), null, 2));
}
