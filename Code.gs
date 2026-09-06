/**
 * Single Line Diagram - สถานีไฟฟ้าอ่าวลึก
 * Google Apps Script Web App (backend API)
 *
 * วิธีใช้งาน:
 * 1. สร้าง Google Sheet ใหม่ 1 ไฟล์
 * 2. สร้างชีตชื่อ "Devices" แล้ว import ไฟล์ devices.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 *    คอลัมน์: Feeder, DeviceID, Type, Rating, Description, Lat, Lon, Source, ParentID, MeterCount,
 *             VerifiedStatus, VerifiedDate  (2 คอลัมน์ท้ายนี้เพิ่มเองได้ ปล่อยว่างไว้ก่อนก็ได้)
 * 3. สร้างชีตชื่อ "Feeders" แล้ว import ไฟล์ feeders.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 * 4. สร้างชีตชื่อ "FieldVerification" ใส่หัวตารางแถวแรกเป็น:
 *    Timestamp, Feeder, DeviceID, Status, CorrectedRating, CorrectedDesc, Note, PhotoUrl, Inspector
 *    (ใช้เก็บประวัติการตรวจสอบภาคสนามทุกครั้ง แบบไม่ทับของเดิม — ถ้าไม่สร้างไว้ ระบบจะสร้างให้อัตโนมัติ)
 * 5. เปิด Extensions > Apps Script แล้ววางไฟล์นี้ทับ Code.gs ที่มีอยู่
 * 6. Deploy > New deployment > เลือกประเภท "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone (หรือ Anyone with the link)
 * 7. คัดลอก URL ของ Web app ที่ได้ ไปใส่ในตัวแปร GAS_WEB_APP_URL ในไฟล์ index.html (หรือกดปุ่ม ⚙ ในหน้าเว็บ)
 *
 * รูปถ่ายจากการตรวจสอบภาคสนามจะถูกอัปโหลดไปเก็บใน Google Drive โฟลเดอร์ชื่อ
 * "SLD-อ่าวลึก-ภาพตรวจสอบภาคสนาม" (สร้างอัตโนมัติในไดรฟ์ของบัญชีที่ deploy Apps Script นี้)
 *
 * เมื่อแก้ไขข้อมูลอุปกรณ์ในอนาคต ให้แก้ไขที่ Google Sheet โดยตรง (ไม่ต้องแก้โค้ด)
 * หน้าเว็บจะดึงข้อมูลล่าสุดจาก Sheet ทุกครั้งที่เปิดหน้าเว็บ
 */

const SHEET_DEVICES = 'Devices';
const SHEET_FEEDERS = 'Feeders';
const SHEET_FIELD_LOG = 'FieldVerification';
const PHOTO_FOLDER_NAME = 'SLD-อ่าวลึก-ภาพตรวจสอบภาคสนาม';

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
  deviceRows.shift(); // Feeder, DeviceID, Type, Rating, Description, Lat, Lon, Source, ParentID, MeterCount, VerifiedStatus, VerifiedDate

  deviceRows.forEach(r => {
    const feederId = String(r[0] || '').trim();
    const deviceId = String(r[1] || '').trim();
    if (!feederId || !deviceId) return;
    if (!feederById[feederId]) return; // skip rows with unknown feeder id
    const dev = {
      id: deviceId,
      type: String(r[2] || '').trim(),
      rating: String(r[3] || '').trim(),
      desc: String(r[4] || '').trim()
    };
    const lat = parseFloat(r[5]), lon = parseFloat(r[6]);
    if (!isNaN(lat) && !isNaN(lon)) { dev.lat = lat; dev.lon = lon; }
    dev.source = String(r[7] || 'manual').trim() || 'manual';
    const parentId = String(r[8] || '').trim();
    if (parentId) dev.parentId = parentId;
    const meterCount = parseInt(r[9], 10);
    if (!isNaN(meterCount)) dev.meterCount = meterCount;
    const verifiedStatus = String(r[10] || '').trim();
    const verifiedDate = String(r[11] || '').trim();
    if (verifiedStatus) dev.verified = { status: verifiedStatus, date: verifiedDate };
    feederById[feederId].devices.push(dev);
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
 * รับการแก้ไข/เพิ่ม/ลบ อุปกรณ์ และผลตรวจสอบภาคสนาม จากหน้าเว็บ
 * body ที่ส่งมาเป็น JSON รูปแบบ:
 *   { action: 'upsert', feeder: 'ALA05', device: {id, type, rating, desc, ...} }
 *   { action: 'delete', feeder: 'ALA05', id: 'ALA05WF-999' }
 *   { action: 'fieldVerify', feeder, deviceId, verification: {status, correctedRating,
 *       correctedDesc, note, inspector, date}, photoBase64, photoMimeType, updatedDevice }
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
      const rowData = [feederId, dev.id, dev.type || '', dev.rating || '', dev.desc || '',
                        dev.lat || '', dev.lon || '', dev.source || 'manual',
                        dev.parentId || '', dev.meterCount || '',
                        (dev.verified && dev.verified.status) || '', (dev.verified && dev.verified.date) || ''];
      if (rowIndex >= 0) {
        sheet.getRange(rowIndex + 1, 1, 1, 12).setValues([rowData]);
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

    } else if (body.action === 'fieldVerify') {
      return handleFieldVerify(body, sheet, values);
    }

    return jsonOut({ ok: false, error: 'unknown action: ' + body.action });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function handleFieldVerify(body, deviceSheet, deviceValues) {
  const feederId = body.feeder;
  const deviceId = body.deviceId;
  const v = body.verification || {};
  if (!feederId || !deviceId) return jsonOut({ ok: false, error: 'missing feeder/deviceId' });

  // 1) upload photo to Drive (if any) and get a shareable URL
  let photoUrl = '';
  if (body.photoBase64) {
    try {
      const folder = getOrCreatePhotoFolder();
      const bytes = Utilities.base64Decode(body.photoBase64);
      const mime = body.photoMimeType || 'image/jpeg';
      const filename = deviceId + '_' + new Date().getTime() + '.jpg';
      const blob = Utilities.newBlob(bytes, mime, filename);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = file.getUrl();
    } catch (photoErr) {
      // don't fail the whole verification just because the photo upload failed
      photoUrl = 'UPLOAD_FAILED: ' + String(photoErr);
    }
  }

  // 2) append to the FieldVerification audit-log sheet (never overwritten — full history)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(SHEET_FIELD_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_FIELD_LOG);
    logSheet.appendRow(['Timestamp', 'Feeder', 'DeviceID', 'Status', 'CorrectedRating',
                         'CorrectedDesc', 'Note', 'PhotoUrl', 'Inspector']);
  }
  logSheet.appendRow([new Date(), feederId, deviceId, v.status || '', v.correctedRating || '',
                       v.correctedDesc || '', v.note || '', photoUrl, v.inspector || '']);

  // 3) update the Devices row itself: verification badge always, corrected values if mismatch
  let rowIndex = -1;
  for (let i = 1; i < deviceValues.length; i++) {
    if (String(deviceValues[i][1]).trim() === deviceId) { rowIndex = i; break; }
  }
  if (rowIndex >= 0) {
    if (v.status === 'mismatch') {
      if (v.correctedRating) deviceSheet.getRange(rowIndex + 1, 4).setValue(v.correctedRating);
      if (v.correctedDesc) deviceSheet.getRange(rowIndex + 1, 5).setValue(v.correctedDesc);
      deviceSheet.getRange(rowIndex + 1, 8).setValue('field-verified'); // Source
    }
    deviceSheet.getRange(rowIndex + 1, 11).setValue(v.status || '');       // VerifiedStatus
    deviceSheet.getRange(rowIndex + 1, 12).setValue(v.date || '');        // VerifiedDate
  }

  return jsonOut({ ok: true, photoUrl: photoUrl });
}

function getOrCreatePhotoFolder() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
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
