/**
 * Single Line Diagram - สถานีไฟฟ้าอ่าวลึก
 * Google Apps Script Web App (backend API)
 *
 * วิธีใช้งาน:
 * 1. สร้าง Google Sheet ใหม่ 1 ไฟล์
 * 2. สร้างชีตชื่อ "Devices" แล้ว import ไฟล์ devices.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 *    คอลัมน์: Feeder, DeviceID, Type, Rating, Description, Lat, Lon, Source, ParentID, MeterCount,
 *             VerifiedStatus, VerifiedDate, RatingConfidence, Unpositioned, Phase, CustomerImpact,
 *             SequenceVerified, MainChildId, SiblingPriority, ParentConfidence
 * 3. สร้างชีตชื่อ "Feeders" แล้ว import ไฟล์ feeders.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 * 4. สร้างชีตชื่อ "FieldVerification" ใส่หัวตารางแถวแรกเป็น:
 *    Timestamp, Feeder, DeviceID, Status, CorrectedRating, CorrectedDesc, Note, PhotoUrl, Inspector
 *    (ใช้เก็บประวัติการตรวจสอบภาคสนามทุกครั้ง แบบไม่ทับของเดิม — ถ้าไม่สร้างไว้ ระบบจะสร้างให้อัตโนมัติ)
 * 4.1 สร้างชีตชื่อ "ChangeLog" ใส่หัวตารางแถวแรกเป็น:
 *    Timestamp, Feeder, DeviceID, Action, Field, OldValue, NewValue, ChangedBy
 *    (บันทึกทุกการแก้ไข/ลบ/สร้างใหม่ ละเอียดถึงระดับฟิลด์ — ถ้าไม่สร้างไว้ ระบบจะสร้างให้อัตโนมัติเช่นกัน)
 * 4.2 สร้างชีตชื่อ "Admins" ใส่หัวตารางแถวแรกเป็น: Name, Password
 *    แล้วใส่ชื่อ+รหัสผ่านของผู้ดูแลระบบ (Admin) ทีละแถวด้านล่าง — ต้องสะกดชื่อตรงกับที่จะเลือก/พิมพ์ในหน้าเว็บทุกตัวอักษร
 *    ⚠️ รหัสผ่านเก็บเป็นตัวอักษรธรรมดา ไม่ได้เข้ารหัส (ข้อจำกัดของระบบนี้ที่ไม่มีเซิร์ฟเวอร์กลาง) เหมาะกับกันคนพิมพ์ชื่อคนอื่นมั่ว
 *    ไม่ใช่ความปลอดภัยระดับสูง — อย่าตั้งรหัสผ่านซ้ำกับบัญชีสำคัญอื่นของผู้ใช้แต่ละคน
 * 4.3 สร้างชีตชื่อ "Members" ใส่หัวตารางแถวแรกเป็น: Name, Password
 *    แล้วใส่ชื่อ+รหัสผ่านของสมาชิกทั่วไปที่อนุญาตให้แก้ไข/ยืนยันข้อมูลได้ ทีละแถวด้านล่าง
 *    (คนที่ชื่อไม่อยู่ทั้งใน Admins และ Members จะดูผังได้ปกติ แต่แก้ไข/ยืนยันข้อมูลไม่ได้เลย)
 * 4.4 ชีตชื่อ "Pending" (คำขอสมัครสมาชิกที่รออนุมัติ) ระบบจะสร้างให้เองอัตโนมัติ ไม่ต้องสร้างเอง
 *    ⚠️ สำคัญมาก — ผู้ดูแลระบบ (Admin) คนแรกสุด ต้องเข้าไปพิมพ์ชื่อ+ตั้งรหัสผ่านของตัวเองลงชีต "Admins" เอง
 *    โดยตรงก่อนเสมอ (เพราะยังไม่มีใครเป็น Admin จะกดอนุมัติผ่านเว็บให้ไม่ได้) หลังจากนั้น Admin คนนี้จะอนุมัติ
 *    คนอื่นที่สมัครเข้ามาผ่านเมนูในเว็บได้เลย ไม่ต้องเข้าชีตอีก
 * 5. เปิด Extensions > Apps Script แล้ววางไฟล์นี้ทับ Code.gs ที่มีอยู่
 * 6. Deploy > New deployment > เลือกประเภท "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone (หรือ Anyone with the link)
 *    (ไม่ต้องบังคับให้ล็อกอิน Google — ตอนแก้ไข/ยืนยันข้อมูล หน้าเว็บจะให้เลือกหรือพิมพ์ชื่อจากรายชื่อ
 *    Admins/Members ที่อนุมัติไว้แทน ไม่ใช่การยืนยันตัวตนด้วยบัญชี Google จริง)
 * 7. คัดลอก URL ของ Web app ที่ได้ ไปใส่ในตัวแปร GAS_WEB_APP_URL ในไฟล์ index.html (หรือกดปุ่ม ⚙ ในหน้าเว็บ)
 *
 * รูปถ่ายจากการตรวจสอบภาคสนามจะถูกอัปโหลดไปเก็บใน Google Drive โฟลเดอร์หลักที่กำหนดไว้ตายตัว
 * (https://drive.google.com/drive/folders/1YTMaYPDgc8GJPx6Q8wtoIquJAeGwcIbN)
 * และแยกเก็บเป็นโฟลเดอร์ย่อยตามชื่อผู้ตรวจสอบแต่ละคนโดยอัตโนมัติ (ของใครของมัน ไม่ปนกัน)
 * ⚠️ บัญชีที่ deploy Apps Script นี้ต้องมีสิทธิ์เข้าถึง (แก้ไขได้) โฟลเดอร์ดังกล่าวก่อน ไม่งั้นจะอัปโหลดไม่สำเร็จ
 *
 * เมื่อแก้ไขข้อมูลอุปกรณ์ในอนาคต ให้แก้ไขที่ Google Sheet โดยตรง (ไม่ต้องแก้โค้ด)
 * หน้าเว็บจะดึงข้อมูลล่าสุดจาก Sheet ทุกครั้งที่เปิดหน้าเว็บ
 */

const SHEET_DEVICES = 'Devices';
const SHEET_FEEDERS = 'Feeders';
const SHEET_FIELD_LOG = 'FieldVerification';
const SHEET_CHANGE_LOG = 'ChangeLog';
const SHEET_ADMINS = 'Admins';
const SHEET_MEMBERS = 'Members';
const SHEET_PENDING = 'Pending';
const PHOTO_ROOT_FOLDER_ID = '1YTMaYPDgc8GJPx6Q8wtoIquJAeGwcIbN'; // โฟลเดอร์ Google Drive หลักที่กำหนดไว้สำหรับเก็บภาพตรวจสอบภาคสนามทั้งหมด

/** คืนชีตรายชื่อ (Admins/Members) สร้างให้อัตโนมัติพร้อมหัวตารางถ้ายังไม่มี (คอลัมน์: Name, Password) */
function getOrCreateNameSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['Name', 'Password']);
  }
  return sheet;
}

/** อ่านรายชื่อ+รหัสผ่านทั้งหมดจากชีตที่กำหนด คืนเป็น array [{name, password}] */
function readMembersFull_(sheetName) {
  const sheet = getOrCreateNameSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][0] || '').trim();
    if (name) out.push({ name: name, password: String(values[i][1] || '') });
  }
  return out;
}
/** อ่านเฉพาะรายชื่อ (ไม่รวมรหัสผ่าน) — ใช้ตอนแสดงผลในหน้าเว็บ (autocomplete/รายการจัดการสมาชิก) เท่านั้น ห้ามส่งรหัสผ่านออกไปที่ฝั่งเว็บเด็ดขาด */
function readNameList_(sheetName) {
  return readMembersFull_(sheetName).map(m => m.name);
}

/**
 * ตรวจสิทธิ์จากชื่อ+รหัสผ่านที่กรอกมา คืนค่า 'admin' | 'member' | null
 * null = ไม่พบชื่อนี้เลย หรือ พบชื่อแต่รหัสผ่านไม่ตรง — ไม่แยกแจ้งว่าผิดจุดไหน เพื่อความปลอดภัย (กันเดาสุ่มว่าชื่อไหนมีอยู่จริง)
 */
function getUserRole_(name, password) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const pass = String(password || '');
  const admin = readMembersFull_(SHEET_ADMINS).find(m => m.name.toLowerCase() === lower);
  if (admin) return admin.password === pass ? 'admin' : null;
  const member = readMembersFull_(SHEET_MEMBERS).find(m => m.name.toLowerCase() === lower);
  if (member) return member.password === pass ? 'member' : null;
  return null;
}

/** คืนรายชื่อทั้งหมดที่แอดมินอนุมัติไว้ (Admins + Members) พร้อมระบุบทบาท — ชื่อเท่านั้น ไม่มีรหัสผ่านติดไปด้วยเด็ดขาด ให้หน้าเว็บเอาไปทำ dropdown/autocomplete เวลาเลือกชื่อผู้ใช้งาน */
function getMemberList_() {
  const admins = readNameList_(SHEET_ADMINS).map(n => ({ name: n, role: 'admin' }));
  const members = readNameList_(SHEET_MEMBERS).map(n => ({ name: n, role: 'member' }));
  return admins.concat(members);
}

/** เพิ่มชื่อ+รหัสผ่านใหม่ลงชีต Admins หรือ Members (ผ่านเมนูในเว็บ ไม่ต้องเข้า Google Sheet เอง) — เฉพาะ Admin เท่านั้นที่เพิ่มได้ */
function addMember_(name, role, password) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  if (role !== 'admin' && role !== 'member') return { ok: false, error: 'บทบาทไม่ถูกต้อง' };
  const passTrimmed = String(password || '').trim();
  if (!passTrimmed) return { ok: false, error: 'กรุณาตั้งรหัสผ่าน' };
  const lower = trimmed.toLowerCase();
  const existsInAdmins = readNameList_(SHEET_ADMINS).some(n => n.toLowerCase() === lower);
  const existsInMembers = readNameList_(SHEET_MEMBERS).some(n => n.toLowerCase() === lower);
  if (existsInAdmins || existsInMembers) {
    return { ok: false, error: 'มีชื่อนี้อยู่ในระบบแล้ว (เป็น ' + (existsInAdmins ? 'admin' : 'member') + ')' };
  }
  const sheetName = role === 'admin' ? SHEET_ADMINS : SHEET_MEMBERS;
  getOrCreateNameSheet_(sheetName).appendRow([trimmed, passTrimmed]);
  return { ok: true };
}

/** ลบชื่อออกจากชีต Admins หรือ Members — เฉพาะ Admin เท่านั้นที่ลบได้ */
function removeMember_(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  const lower = trimmed.toLowerCase();
  let removed = false;
  [SHEET_ADMINS, SHEET_MEMBERS].forEach(function (sheetName) {
    const sheet = getOrCreateNameSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][0] || '').trim().toLowerCase() === lower) {
        sheet.deleteRow(i + 1);
        removed = true;
      }
    }
  });
  return removed ? { ok: true } : { ok: false, error: 'ไม่พบชื่อนี้ในระบบ' };
}

/** คืนชีต "Pending" (คำขอสมัครสมาชิกที่รออนุมัติ) สร้างให้อัตโนมัติพร้อมหัวตารางถ้ายังไม่มี */
function getOrCreatePendingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PENDING);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PENDING);
    sheet.appendRow(['Name', 'Password', 'RequestedRole', 'Timestamp']);
  }
  return sheet;
}

/** ใครก็ตามสมัครสมาชิกเองได้ — จะเข้าคิว "Pending" รอแอดมินอนุมัติก่อน ยังใช้แก้ไข/บันทึกข้อมูลไม่ได้จนกว่าจะอนุมัติ */
function registerRequest_(name, password) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  const passTrimmed = String(password || '').trim();
  if (!passTrimmed) return { ok: false, error: 'กรุณาตั้งรหัสผ่าน' };
  const lower = trimmed.toLowerCase();
  if (readNameList_(SHEET_ADMINS).some(n => n.toLowerCase() === lower) ||
      readNameList_(SHEET_MEMBERS).some(n => n.toLowerCase() === lower)) {
    return { ok: false, error: 'มีชื่อนี้อยู่ในระบบแล้ว ลองเข้าสู่ระบบด้วยชื่อนี้แทนการสมัครใหม่' };
  }
  const pendingSheet = getOrCreatePendingSheet_();
  const pendingValues = pendingSheet.getDataRange().getValues();
  for (let i = 1; i < pendingValues.length; i++) {
    if (String(pendingValues[i][0] || '').trim().toLowerCase() === lower) {
      return { ok: false, error: 'มีคำขอสมัครด้วยชื่อนี้ค้างรออนุมัติอยู่แล้ว กรุณารอผู้ดูแลระบบอนุมัติ' };
    }
  }
  pendingSheet.appendRow([trimmed, passTrimmed, 'member', new Date()]);
  return { ok: true };
}

/** คืนรายชื่อคำขอสมัครที่รออนุมัติทั้งหมด (ไม่มีรหัสผ่านติดไปด้วย) — เฉพาะ Admin เท่านั้นที่ดูได้ */
function getPendingList_() {
  const sheet = getOrCreatePendingSheet_();
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][0] || '').trim();
    if (name) out.push({
      name: name,
      requestedRole: values[i][2] || 'member',
      timestamp: values[i][3] instanceof Date ? Utilities.formatDate(values[i][3], 'GMT+7', 'yyyy-MM-dd HH:mm') : String(values[i][3] || '')
    });
  }
  return out;
}

/** อนุมัติคำขอสมัคร — ย้ายชื่อ+รหัสผ่านจาก Pending ไปเป็น Admin หรือ Member จริง แล้วลบออกจาก Pending — เฉพาะ Admin เท่านั้นที่อนุมัติได้ */
function approvePending_(name, approvedRole) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  if (approvedRole !== 'admin' && approvedRole !== 'member') return { ok: false, error: 'บทบาทไม่ถูกต้อง' };
  const lower = trimmed.toLowerCase();
  const pendingSheet = getOrCreatePendingSheet_();
  const values = pendingSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === lower) {
      const password = String(values[i][1] || '');
      pendingSheet.deleteRow(i + 1);
      const targetSheet = approvedRole === 'admin' ? SHEET_ADMINS : SHEET_MEMBERS;
      getOrCreateNameSheet_(targetSheet).appendRow([trimmed, password]);
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบคำขอสมัครชื่อนี้ (อาจถูกอนุมัติ/ปฏิเสธไปแล้ว)' };
}

/** ปฏิเสธคำขอสมัคร — ลบออกจาก Pending โดยไม่เพิ่มเป็นสมาชิก — เฉพาะ Admin เท่านั้นที่ปฏิเสธได้ */
function rejectPending_(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  const lower = trimmed.toLowerCase();
  const pendingSheet = getOrCreatePendingSheet_();
  const values = pendingSheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0] || '').trim().toLowerCase() === lower) {
      pendingSheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบคำขอสมัครชื่อนี้' };
}

/**
 * บันทึกทุกการเปลี่ยนแปลงลง ChangeLog แบบละเอียด — 1 แถวต่อ 1 ฟิลด์ที่เปลี่ยน พร้อมค่าเดิม/ค่าใหม่/เวลา/ผู้แก้ไข
 * เพื่อให้ดึงออกมาเป็นรายงานส่งต่อให้แก้ไขข้อมูลต้นทาง (A0/GIS) ได้ครบถ้วน ตรวจสอบย้อนหลังได้เสมอ
 */
function logChange(action, feederId, deviceId, fieldChanges, changedBy) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(SHEET_CHANGE_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_CHANGE_LOG);
    logSheet.appendRow(['Timestamp', 'Feeder', 'DeviceID', 'Action', 'Field', 'OldValue', 'NewValue', 'ChangedBy']);
  }
  const who = (changedBy || '').trim() || '(ไม่ระบุชื่อ)';
  const now = new Date();
  if (!fieldChanges || !fieldChanges.length) {
    logSheet.appendRow([now, feederId, deviceId, action, '', '', '', who]);
  } else {
    fieldChanges.forEach(function (ch) {
      logSheet.appendRow([now, feederId, deviceId, action, ch.field, ch.oldValue, ch.newValue, who]);
    });
  }
}

/** เปรียบเทียบอุปกรณ์เก่ากับใหม่ทีละฟิลด์ คืนเฉพาะฟิลด์ที่ค่าเปลี่ยนจริง (ใช้ก่อนบันทึกทับ เพื่อรู้ว่าเปลี่ยนอะไรบ้าง) */
function diffDeviceFields(oldRow, newDev) {
  const fields = [
    { idx: 2, key: 'type', label: 'ประเภท' },
    { idx: 3, key: 'rating', label: 'ขนาด' },
    { idx: 4, key: 'desc', label: 'จุดติดตั้ง/คำอธิบาย' },
    { idx: 8, key: 'parentId', label: 'ต่อจากอุปกรณ์ (ParentID)' },
    { idx: 14, key: 'phase', label: 'เฟส' },
  ];
  const changes = [];
  fields.forEach(function (f) {
    const oldVal = oldRow ? String(oldRow[f.idx] || '') : '';
    const newVal = String(newDev[f.key] || '');
    if (oldVal !== newVal) changes.push({ field: f.label, oldValue: oldVal, newValue: newVal });
  });
  return changes;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getMemberList') {
    return jsonOut({ ok: true, members: getMemberList_() });
  }
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
    const ratingConfidence = String(r[12] || '').trim();
    if (ratingConfidence) dev.ratingConfidence = ratingConfidence;
    const unpositioned = String(r[13] || '').trim();
    if (unpositioned && unpositioned.toUpperCase() === 'TRUE') dev.unpositioned = true;
    const phase = String(r[14] || '').trim();
    if (phase) dev.phase = phase;
    const customerImpact = parseInt(r[15], 10);
    if (!isNaN(customerImpact)) dev.customerImpact = customerImpact;
    const sequenceVerified = String(r[16] || '').trim();
    if (sequenceVerified && sequenceVerified.toUpperCase() === 'TRUE') dev.sequenceVerified = true;
    const mainChildId = String(r[17] || '').trim();
    if (mainChildId) dev.mainChildId = mainChildId;
    const siblingPriority = parseFloat(r[18]);
    if (!isNaN(siblingPriority)) dev.siblingPriority = siblingPriority;
    const parentConfidence = String(r[19] || '').trim();
    if (parentConfidence) dev.parentConfidence = parentConfidence;
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

    if (body.action === 'getMemberList') {
      return jsonOut({ ok: true, members: getMemberList_() });
    }
    if (body.action === 'register') {
      // สมัครสมาชิกเอง — ไม่ต้องมีสิทธิ์อะไรมาก่อน (ยังไม่ใช่สมาชิก) เข้าคิว Pending รอแอดมินอนุมัติ
      const result = registerRequest_(body.newName, body.newPassword);
      if (result.ok) logChange('สมัครสมาชิก (รออนุมัติ)', '', body.newName, [], body.newName);
      return jsonOut(result);
    }

    // ตรวจสิทธิ์จากชื่อ+รหัสผ่านที่กรอกมา (ต้องอยู่ในรายชื่อ Admins หรือ Members ที่แอดมินอนุมัติไว้ล่วงหน้าเท่านั้น และรหัสผ่านต้องตรงกัน)
    const changedByName = (body.changedBy || '').trim();
    const changedByPassword = body.changedByPassword || '';
    const requesterRole = getUserRole_(changedByName, changedByPassword);
    if (body.action === 'whoAmI') {
      return jsonOut({ ok: true, name: changedByName, role: requesterRole });
    }
    if (!requesterRole) {
      return jsonOut({ ok: false, error: 'unauthorized', name: changedByName,
        message: 'ชื่อ "' + (changedByName || '(ยังไม่ได้เลือกชื่อ)') + '" หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง หรือติดต่อผู้ดูแลระบบ' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEVICES);
    const values = sheet.getDataRange().getValues();

    if (body.action === 'upsert') {
      const dev = body.device;
      const feederId = body.feeder;
      const changedBy = changedByName;
      if (!dev || !dev.id || !feederId) return jsonOut({ ok: false, error: 'missing feeder/device' });

      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === dev.id) { rowIndex = i; break; }
      }
      const isNew = rowIndex < 0;
      const oldRow = isNew ? null : values[rowIndex];
      const fieldChanges = diffDeviceFields(oldRow, dev);
      const rowData = [feederId, dev.id, dev.type || '', dev.rating || '', dev.desc || '',
                        dev.lat || '', dev.lon || '', dev.source || 'manual',
                        dev.parentId || '', dev.meterCount || '',
                        (dev.verified && dev.verified.status) || '', (dev.verified && dev.verified.date) || '',
                        dev.ratingConfidence || '', dev.unpositioned ? 'TRUE' : '',
                        dev.phase || '', dev.customerImpact != null ? dev.customerImpact : '',
                        dev.sequenceVerified ? 'TRUE' : '',
                        dev.mainChildId || '', dev.siblingPriority != null ? dev.siblingPriority : '',
                        dev.parentConfidence || ''];
      if (rowIndex >= 0) {
        sheet.getRange(rowIndex + 1, 1, 1, 20).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      // บันทึก log เฉพาะตอนมีการแก้ไขจริง (สร้างใหม่ หรือมีฟิลด์เปลี่ยนแปลง) — ไม่บันทึกซ้ำถ้าบันทึกค่าเดิมทับค่าเดิม
      if (isNew) {
        logChange('สร้างใหม่', feederId, dev.id, [], changedBy);
      } else if (fieldChanges.length) {
        logChange('แก้ไข', feederId, dev.id, fieldChanges, changedBy);
      }
      return jsonOut({ ok: true });

    } else if (body.action === 'delete') {
      const devId = body.id;
      const changedBy = changedByName;
      if (!devId) return jsonOut({ ok: false, error: 'missing device id' });
      let feederOfDeleted = '';
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === devId) {
          feederOfDeleted = values[i][0];
          sheet.deleteRow(i + 1);
          break;
        }
      }
      logChange('ลบ', feederOfDeleted, devId, [], changedBy);
      return jsonOut({ ok: true });

    } else if (body.action === 'bulkSetVerified') {
      // ตั้งค่ายืนยันลำดับ (SequenceVerified คอลัมน์ที่ 17) ให้อุปกรณ์หลายตัวพร้อมกันในรอบเดียว
      // เร็วกว่าและเชื่อถือได้กว่าการยิงทีละอุปกรณ์ทีละคำขอ (ซึ่งถ้าพลาดกลางทางจะไม่รู้ตัว)
      const deviceIds = body.deviceIds;
      const verified = !!body.verified;
      if (!Array.isArray(deviceIds) || !deviceIds.length) return jsonOut({ ok: false, error: 'missing deviceIds' });
      const idSet = {};
      deviceIds.forEach(function (id) { idSet[String(id).trim()] = true; });
      let updatedCount = 0;
      const notFound = [];
      const stillIdSet = Object.assign({}, idSet);
      for (let i = 1; i < values.length; i++) {
        const rowId = String(values[i][1]).trim();
        if (idSet[rowId]) {
          sheet.getRange(i + 1, 17).setValue(verified ? 'TRUE' : ''); // คอลัมน์ 17 = SequenceVerified
          updatedCount++;
          delete stillIdSet[rowId];
        }
      }
      Object.keys(stillIdSet).forEach(function (id) { notFound.push(id); });
      logChange(verified ? 'ยืนยันลำดับ (ทั้งชุด)' : 'ล้างยืนยันลำดับ (ทั้งชุด)', body.feeder || '', updatedCount + ' รายการ',
        [{ field: 'SequenceVerified', oldValue: '', newValue: verified ? 'TRUE' : 'FALSE' }], changedByName);
      return jsonOut({ ok: true, updatedCount: updatedCount, notFound: notFound });

    } else if (body.action === 'fieldVerify') {
      return handleFieldVerify(body, sheet, values, changedByName);

    } else if (body.action === 'getChangeLog') {
      return handleGetChangeLog(requesterRole);

    } else if (body.action === 'addMember') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เพิ่มรายชื่อได้' });
      const result = addMember_(body.newName, body.newRole, body.newPassword);
      if (result.ok) logChange('เพิ่มสมาชิก', '', body.newName, [{ field: 'บทบาท', oldValue: '', newValue: body.newRole }], changedByName);
      return jsonOut(result);

    } else if (body.action === 'removeMember') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ลบรายชื่อได้' });
      const result = removeMember_(body.targetName);
      if (result.ok) logChange('ลบสมาชิก', '', body.targetName, [], changedByName);
      return jsonOut(result);

    } else if (body.action === 'getPendingList') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ดูคำขอสมัครได้' });
      return jsonOut({ ok: true, pending: getPendingList_() });

    } else if (body.action === 'approvePending') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่อนุมัติได้' });
      const result = approvePending_(body.targetName, body.approvedRole);
      if (result.ok) logChange('อนุมัติสมาชิก', '', body.targetName, [{ field: 'บทบาท', oldValue: '', newValue: body.approvedRole }], changedByName);
      return jsonOut(result);

    } else if (body.action === 'rejectPending') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ปฏิเสธได้' });
      const result = rejectPending_(body.targetName);
      if (result.ok) logChange('ปฏิเสธคำขอสมัคร', '', body.targetName, [], changedByName);
      return jsonOut(result);

    }

    return jsonOut({ ok: false, error: 'unknown action: ' + body.action });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** ดึงประวัติการเปลี่ยนแปลงทั้งหมด (เฉพาะ Admin เท่านั้นที่ดึงได้ — ตรวจจากอีเมล Google จริงของผู้เรียก) */
function handleGetChangeLog(requesterRole) {
  if (requesterRole !== 'admin') {
    return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ดูประวัติการเปลี่ยนแปลงได้' });
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHANGE_LOG);
  if (!sheet) return jsonOut({ ok: true, rows: [] });
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const limit = 1000;
  const dataRows = values.slice(1);
  const recent = dataRows.slice(Math.max(0, dataRows.length - limit)).reverse(); // ล่าสุดขึ้นก่อน
  const rows = recent.map(function (r) {
    const obj = {};
    headers.forEach(function (h, i) {
      obj[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'GMT+7', 'yyyy-MM-dd HH:mm:ss') : r[i];
    });
    return obj;
  });
  return jsonOut({ ok: true, rows: rows });
}

function handleFieldVerify(body, deviceSheet, deviceValues, changedByName) {
  const feederId = body.feeder;
  const deviceId = body.deviceId;
  const v = body.verification || {};
  if (!feederId || !deviceId) return jsonOut({ ok: false, error: 'missing feeder/deviceId' });
  // ใช้ชื่อที่เลือกจากรายชื่อที่แอดมินอนุมัติไว้เป็นตัวระบุตัวตนหลัก
  const inspectorDisplay = changedByName;

  // 1) upload photo to Drive (if any) and get a shareable URL
  let photoUrl = '';
  if (body.photoBase64) {
    try {
      const folder = getOrCreateInspectorFolder(changedByName);
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
                         'CorrectedDesc', 'Note', 'PhotoUrl', 'Inspector',
                         'GpsLat', 'GpsLon', 'GpsDistanceMeters', 'GpsWithinTolerance']);
  }
  logSheet.appendRow([new Date(), feederId, deviceId, v.status || '', v.correctedRating || '',
                       v.correctedDesc || '', v.note || '', photoUrl, inspectorDisplay,
                       v.gpsLat != null ? v.gpsLat : '', v.gpsLon != null ? v.gpsLon : '',
                       v.gpsDistanceMeters != null ? Math.round(v.gpsDistanceMeters * 10) / 10 : '',
                       v.gpsWithinTolerance != null ? (v.gpsWithinTolerance ? 'TRUE' : 'FALSE') : '']);
  logChange('ตรวจสอบภาคสนาม', feederId, deviceId,
    [{ field: 'ผลตรวจสอบ', oldValue: '', newValue: (v.status === 'mismatch' ? 'ไม่ตรง - แก้ไข' : 'ตรงกับข้อมูล') }],
    changedByName);

  // 3) update the Devices row itself: verification badge always, corrected values if mismatch, GPS if newly captured
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
    const ud = body.updatedDevice;
    if (ud && ud.lat != null && ud.lon != null) {
      deviceSheet.getRange(rowIndex + 1, 6).setValue(ud.lat); // Lat
      deviceSheet.getRange(rowIndex + 1, 7).setValue(ud.lon); // Lon
    }
    deviceSheet.getRange(rowIndex + 1, 11).setValue(v.status || '');       // VerifiedStatus
    deviceSheet.getRange(rowIndex + 1, 12).setValue(v.date || '');        // VerifiedDate
  }

  return jsonOut({ ok: true, photoUrl: photoUrl });
}

/**
 * คืนโฟลเดอร์ย่อยของผู้ตรวจสอบแต่ละคน (แยกตามชื่อที่เลือกจากรายชื่อที่อนุมัติไว้) ภายในโฟลเดอร์หลักที่กำหนดไว้ (PHOTO_ROOT_FOLDER_ID)
 * เพื่อให้ภาพของแต่ละคนแยกเก็บเป็นสัดส่วนของตัวเอง ไม่ปนกัน
 */
function getOrCreateInspectorFolder(inspectorName) {
  const rootFolder = DriveApp.getFolderById(PHOTO_ROOT_FOLDER_ID);
  const name = (inspectorName || '').trim() || 'ไม่ระบุชื่อผู้ตรวจสอบ';
  const it = rootFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return rootFolder.createFolder(name);
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
